/**
 * Memory Manager - Main orchestrator for conversation memory
 * Coordinates storage, indexing, and retrieval
 */

import { resolve, isAbsolute } from "path";
import {
  ensureDirectoryStructure,
  loadIndex,
  saveIndex,
  loadConversation,
  saveConversation,
  createConversation,
  appendToConversation,
  updateIndex,
  findConversationBySessionId,
  getStats,
} from "./storage.js";

import { extractKeywordsFromExchange, extractTopicsFromExchange } from "./indexer.js";

import {
  findRelevantConversations,
  formatContextForInjection,
  shouldRetrieveContext,
  createContextSummary,
  searchConversations,
} from "./retriever.js";

// Configuration
let config = {
  enabled: false,
  basePath: "./memory",
  instanceName: "unnamed-instance",
  maxContextItems: 3,
  maxContextTokens: 2000,
};

// In-memory cache of the index
let indexCache = null;
let indexCacheTime = 0;
const INDEX_CACHE_TTL = 30000; // 30 seconds

/**
 * Initialize the memory system
 * @param {string} instanceName - Name of this instance
 * @param {string} storagePath - Base path for storage
 * @param {object} options - Additional options
 */
export async function initializeMemory(instanceName, storagePath, options = {}) {
  config.instanceName = instanceName || "unnamed-instance";

  // Resolve storage path
  if (storagePath) {
    config.basePath = isAbsolute(storagePath) ? storagePath : resolve(process.cwd(), storagePath);
  }

  config.enabled = options.enabled !== false;
  config.maxContextItems = options.maxContextItems || 3;
  config.maxContextTokens = options.maxContextTokens || 2000;

  if (!config.enabled) {
    console.log("[Memory] Memory system disabled");
    return;
  }

  try {
    // Ensure directory structure exists
    await ensureDirectoryStructure(config.basePath, config.instanceName);

    // Pre-load index into cache
    indexCache = await loadIndex(config.basePath, config.instanceName);
    indexCacheTime = Date.now();

    console.log(`[Memory] Initialized for instance: ${config.instanceName}`);
    console.log(`[Memory] Storage path: ${config.basePath}`);
    console.log(`[Memory] Total conversations: ${indexCache.totalConversations}`);
  } catch (error) {
    console.error("[Memory] Failed to initialize:", error.message);
    config.enabled = false;
  }
}

/**
 * Check if memory is enabled
 * @returns {boolean}
 */
export function isMemoryEnabled() {
  return config.enabled;
}

/**
 * Get memory statistics
 * @returns {object} Memory statistics
 */
export async function getMemoryStats() {
  if (!config.enabled) {
    return { enabled: false };
  }

  try {
    const stats = await getStats(config.basePath, config.instanceName);
    return {
      enabled: true,
      ...stats,
    };
  } catch (error) {
    return {
      enabled: true,
      error: error.message,
    };
  }
}

/**
 * Get the current index (with caching)
 * @returns {object} The index data
 */
async function getCachedIndex() {
  const now = Date.now();

  if (!indexCache || now - indexCacheTime > INDEX_CACHE_TTL) {
    indexCache = await loadIndex(config.basePath, config.instanceName);
    indexCacheTime = now;
  }

  return indexCache;
}

/**
 * Invalidate the index cache
 */
function invalidateIndexCache() {
  indexCache = null;
  indexCacheTime = 0;
}

/**
 * Record a conversation exchange
 * @param {string} question - The question asked
 * @param {string} answer - The answer received
 * @param {string} sessionId - Session ID for continuity
 * @param {object} metadata - Additional metadata
 * @returns {object} Result with conversation ID and memory sources
 */
export async function recordConversation(question, answer, sessionId, metadata = {}) {
  if (!config.enabled) {
    return { recorded: false, reason: "Memory disabled" };
  }

  try {
    // Extract keywords and topics
    const keywords = extractKeywordsFromExchange(question, answer);
    const topics = extractTopicsFromExchange(question, answer);

    // Check if we have an existing conversation for this session
    let conversation = null;
    if (sessionId) {
      conversation = await findConversationBySessionId(
        config.basePath,
        config.instanceName,
        sessionId,
      );
    }

    let relativePath;

    if (conversation) {
      // Append to existing conversation
      conversation = appendToConversation(conversation, question, answer, keywords, topics);
      relativePath = await saveConversation(config.basePath, config.instanceName, conversation);
    } else {
      // Create new conversation
      conversation = createConversation(sessionId, question, answer, keywords, topics);
      relativePath = await saveConversation(config.basePath, config.instanceName, conversation);
    }

    // Update the index
    const index = await getCachedIndex();
    const updatedIndex = updateIndex(index, conversation, relativePath);
    await saveIndex(config.basePath, config.instanceName, updatedIndex);

    // Update cache
    indexCache = updatedIndex;
    indexCacheTime = Date.now();

    return {
      recorded: true,
      conversationId: conversation.id,
      isNewConversation: !sessionId || conversation.exchanges.length === 1,
      keywords,
      topics,
    };
  } catch (error) {
    console.error("[Memory] Failed to record conversation:", error.message);
    return { recorded: false, error: error.message };
  }
}

/**
 * Get relevant context for a question
 * @param {string} question - The question to find context for
 * @param {object} options - Retrieval options
 * @returns {object} Context data and metadata
 */
export async function getRelevantContext(question, options = {}) {
  if (!config.enabled) {
    return { contextUsed: false, reason: "Memory disabled" };
  }

  // Check if we should retrieve context for this question
  if (!shouldRetrieveContext(question)) {
    return { contextUsed: false, reason: "Question type does not need context" };
  }

  try {
    const index = await getCachedIndex();

    // Find relevant conversations
    const matches = findRelevantConversations(question, index, {
      maxResults: options.maxItems || config.maxContextItems,
      minScore: options.minScore || 0.1,
    });

    if (matches.length === 0) {
      return { contextUsed: false, reason: "No relevant conversations found" };
    }

    // Load full conversation data for matches
    const conversationsWithData = [];
    for (const match of matches) {
      const conversation = await loadConversation(config.basePath, config.instanceName, match.id);
      if (conversation) {
        conversationsWithData.push({
          ...match,
          exchanges: conversation.exchanges,
          topics: conversation.topics,
        });
      }
    }

    // Format context for injection
    const contextText = formatContextForInjection(
      conversationsWithData,
      options.maxTokens || config.maxContextTokens,
    );

    const summary = createContextSummary(conversationsWithData);

    return {
      contextUsed: true,
      context: contextText,
      summary,
      sources: matches.map((m) => m.id),
      matchCount: matches.length,
    };
  } catch (error) {
    console.error("[Memory] Failed to get context:", error.message);
    return { contextUsed: false, error: error.message };
  }
}

/**
 * Search conversations by keyword
 * @param {string} query - Search query
 * @param {number} limit - Maximum results
 * @returns {object[]} Matching conversations
 */
export async function search(query, limit = 10) {
  if (!config.enabled) {
    return [];
  }

  try {
    const index = await getCachedIndex();
    return searchConversations(query, index, limit);
  } catch (error) {
    console.error("[Memory] Search failed:", error.message);
    return [];
  }
}

/**
 * Get recent conversations
 * @param {number} limit - Maximum results
 * @returns {object[]} Recent conversations
 */
export async function getRecent(limit = 10) {
  if (!config.enabled) {
    return [];
  }

  try {
    const index = await getCachedIndex();
    return index.recent.slice(0, limit);
  } catch (error) {
    console.error("[Memory] Failed to get recent:", error.message);
    return [];
  }
}

/**
 * Get a specific conversation by ID
 * @param {string} conversationId - Conversation ID
 * @returns {object|null} Conversation data
 */
export async function getConversation(conversationId) {
  if (!config.enabled) {
    return null;
  }

  try {
    return await loadConversation(config.basePath, config.instanceName, conversationId);
  } catch (error) {
    console.error("[Memory] Failed to get conversation:", error.message);
    return null;
  }
}

/**
 * Export the current configuration (for debugging)
 * @returns {object} Current configuration
 */
export function getConfig() {
  return { ...config };
}
