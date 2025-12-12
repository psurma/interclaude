/**
 * Retriever module for conversation memory
 * Handles finding and ranking relevant past conversations
 */

import {
  extractKeywords,
  extractTopics,
  findKeywordMatches,
  calculateKeywordSimilarity,
} from "./indexer.js";

/**
 * Find relevant conversations for a question
 * @param {string} question - The incoming question
 * @param {object} index - The conversation index
 * @param {object} options - Retrieval options
 * @returns {object[]} Array of matched conversations with scores
 */
export function findRelevantConversations(question, index, options = {}) {
  const { maxResults = 3, minScore = 0.1, recencyBoost = 0.1 } = options;

  // Extract keywords and topics from the question
  const queryKeywords = extractKeywords(question);
  const queryTopics = extractTopics(question);

  // Find keyword matches
  const keywordMatches = findKeywordMatches(queryKeywords, index.keywords);

  // Score each conversation
  const scores = {};
  const conversationInfo = {};

  // Score from keyword matches
  for (const [id, matchCount] of Object.entries(keywordMatches)) {
    scores[id] = matchCount / queryKeywords.length; // Normalize by query keyword count
  }

  // Add topic matching bonus
  for (const [topic, entries] of Object.entries(index.topics)) {
    if (queryTopics.includes(topic)) {
      for (const entry of entries) {
        scores[entry.id] = (scores[entry.id] || 0) + 0.3; // Topic match bonus
        conversationInfo[entry.id] = entry;
      }
    }
  }

  // Add recency boost from recent list
  const recentIds = index.recent.map((r) => r.id);
  for (let i = 0; i < recentIds.length; i++) {
    const id = recentIds[i];
    if (scores[id]) {
      // More recent = higher boost, decaying by position
      const boost = recencyBoost * (1 - i / recentIds.length);
      scores[id] += boost;
    }

    // Store conversation info from recent list
    if (!conversationInfo[id]) {
      conversationInfo[id] = index.recent.find((r) => r.id === id);
    }
  }

  // Sort by score and filter
  const ranked = Object.entries(scores)
    .filter(([_, score]) => score >= minScore)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxResults)
    .map(([id, score]) => ({
      id,
      score,
      ...conversationInfo[id],
    }));

  return ranked;
}

/**
 * Rank conversation matches by relevance
 * @param {object[]} matches - Matches from findRelevantConversations
 * @param {string} question - The original question
 * @param {object[]} conversations - Full conversation data
 * @returns {object[]} Re-ranked matches
 */
export function rankByRelevance(matches, question, conversations) {
  const questionKeywords = extractKeywords(question);

  return matches
    .map((match) => {
      const conversation = conversations.find((c) => c.id === match.id);
      if (!conversation) return match;

      // Calculate deeper relevance based on conversation content
      let relevanceBoost = 0;

      // Check if any exchange directly mentions query keywords
      for (const exchange of conversation.exchanges) {
        const exchangeKeywords = extractKeywords(exchange.question + " " + exchange.answer);
        const similarity = calculateKeywordSimilarity(questionKeywords, exchangeKeywords);
        relevanceBoost = Math.max(relevanceBoost, similarity);
      }

      return {
        ...match,
        score: match.score + relevanceBoost * 0.5,
        relevanceBoost,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Format matched conversations for context injection
 * @param {object[]} matches - Matched conversations with conversation data
 * @param {number} maxTokens - Maximum tokens for context (rough estimate)
 * @returns {string} Formatted context string
 */
export function formatContextForInjection(matches, maxTokens = 2000) {
  if (matches.length === 0) return "";

  const lines = ["--- Relevant Past Conversations ---\n"];
  let estimatedTokens = 10; // Header overhead

  for (const match of matches) {
    if (!match.exchanges || match.exchanges.length === 0) continue;

    // Format each exchange
    for (const exchange of match.exchanges) {
      const exchangeText = `Q: ${exchange.question}\nA: ${exchange.answer}\n\n`;
      const exchangeTokens = Math.ceil(exchangeText.length / 4); // Rough token estimate

      if (estimatedTokens + exchangeTokens > maxTokens) {
        // Truncate if we're running out of space
        const remainingTokens = maxTokens - estimatedTokens;
        if (remainingTokens > 50) {
          const truncatedLength = remainingTokens * 4;
          lines.push(exchangeText.substring(0, truncatedLength) + "...\n");
        }
        break;
      }

      lines.push(exchangeText);
      estimatedTokens += exchangeTokens;
    }

    // Check if we've hit the token limit
    if (estimatedTokens >= maxTokens * 0.9) break;
  }

  lines.push("--- End Past Conversations ---\n");
  return lines.join("");
}

/**
 * Determine if we should retrieve context for a question
 * @param {string} question - The question to analyze
 * @returns {boolean} Whether to retrieve context
 */
export function shouldRetrieveContext(question) {
  // Skip very short questions
  if (question.length < 10) return false;

  // Skip questions that are clearly standalone greetings or meta-questions
  const skipPatterns = [
    /^(hi|hello|hey|thanks|thank you|bye|goodbye)[\s!.]*$/i,
    /^(yes|no|ok|okay|sure|great)[\s!.]*$/i,
    /^what('s| is) your name/i,
    /^who are you/i,
    /^are you (an? )?(ai|bot|claude)/i,
  ];

  for (const pattern of skipPatterns) {
    if (pattern.test(question.trim())) {
      return false;
    }
  }

  return true;
}

/**
 * Create a context summary from matches
 * @param {object[]} matches - Matched conversations
 * @returns {string} Brief summary of what context is being used
 */
export function createContextSummary(matches) {
  if (matches.length === 0) return "No relevant past conversations found.";

  const topics = new Set();
  const keywords = new Set();

  for (const match of matches) {
    if (match.keywords) {
      match.keywords.forEach((k) => keywords.add(k));
    }
  }

  // Get topics from matches
  for (const match of matches) {
    if (match.topics) {
      match.topics.forEach((t) => topics.add(t));
    }
  }

  const parts = [];
  if (topics.size > 0) {
    parts.push(`Topics: ${Array.from(topics).slice(0, 3).join(", ")}`);
  }
  if (keywords.size > 0) {
    parts.push(`Keywords: ${Array.from(keywords).slice(0, 5).join(", ")}`);
  }

  return `Found ${matches.length} relevant conversation(s). ${parts.join(". ")}`;
}

/**
 * Search conversations by keyword
 * @param {string} query - Search query
 * @param {object} index - The conversation index
 * @param {number} limit - Maximum results
 * @returns {object[]} Matching conversations
 */
export function searchConversations(query, index, limit = 10) {
  const queryKeywords = extractKeywords(query);

  if (queryKeywords.length === 0) {
    // Return recent conversations if no keywords
    return index.recent.slice(0, limit);
  }

  const matches = findRelevantConversations(query, index, {
    maxResults: limit,
    minScore: 0.05, // Lower threshold for search
  });

  return matches;
}
