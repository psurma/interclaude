import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Storage module for conversation memory
 * Handles markdown file read/write operations
 */

/**
 * Ensure directory structure exists for an instance
 * @param {string} basePath - Base storage path
 * @param {string} instanceName - Name of the instance
 */
export async function ensureDirectoryStructure(basePath, instanceName) {
  const instancePath = join(basePath, instanceName);
  const conversationsPath = join(instancePath, 'conversations');

  await fs.mkdir(conversationsPath, { recursive: true });

  // Create index.md if it doesn't exist
  const indexPath = join(instancePath, 'index.md');
  try {
    await fs.access(indexPath);
  } catch {
    await saveIndex(basePath, instanceName, createEmptyIndex(instanceName));
  }

  return { instancePath, conversationsPath, indexPath };
}

/**
 * Create an empty index structure
 * @param {string} instanceName - Name of the instance
 */
function createEmptyIndex(instanceName) {
  return {
    instance: instanceName,
    lastUpdated: new Date().toISOString(),
    totalConversations: 0,
    topics: {},
    keywords: {},
    recent: []
  };
}

/**
 * Get today's date directory path
 */
function getDateDirectory() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Parse markdown frontmatter
 * @param {string} content - Markdown content with frontmatter
 * @returns {{metadata: object, body: string}}
 */
export function parseMarkdownFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, body: content };
  }

  const frontmatterLines = match[1].split('\n');
  const metadata = {};

  for (const line of frontmatterLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();

      // Parse arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1).split(',').map(s => s.trim());
      }

      metadata[key] = value;
    }
  }

  return { metadata, body: match[2] };
}

/**
 * Generate markdown frontmatter from metadata
 * @param {object} metadata - Metadata object
 * @returns {string}
 */
function generateFrontmatter(metadata) {
  const lines = ['---'];

  for (const [key, value] of Object.entries(metadata)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(', ')}]`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  lines.push('---\n');
  return lines.join('\n');
}

/**
 * Generate markdown for a conversation
 * @param {object} conversationData - Conversation data
 * @returns {string}
 */
export function generateConversationMarkdown(conversationData) {
  const { id, sessionId, created, updated, keywords, topics, exchanges } = conversationData;

  const metadata = {
    id,
    session_id: sessionId,
    created,
    updated,
    keywords: keywords || [],
    topics: topics || []
  };

  let body = '';

  for (let i = 0; i < exchanges.length; i++) {
    const exchange = exchanges[i];
    body += `## Question ${i + 1}\n`;
    body += `**Timestamp:** ${exchange.timestamp}\n\n`;
    body += `${exchange.question}\n\n`;
    body += `### Answer\n\n`;
    body += `${exchange.answer}\n\n`;
    if (i < exchanges.length - 1) {
      body += '---\n\n';
    }
  }

  return generateFrontmatter(metadata) + body;
}

/**
 * Parse a conversation markdown file
 * @param {string} content - Markdown content
 * @returns {object} Conversation data
 */
export function parseConversationMarkdown(content) {
  const { metadata, body } = parseMarkdownFrontmatter(content);

  // Parse exchanges from body
  const exchangeRegex = /## Question \d+\n\*\*Timestamp:\*\* ([^\n]+)\n\n([\s\S]*?)\n\n### Answer\n\n([\s\S]*?)(?=\n---\n|$)/g;
  const exchanges = [];
  let match;

  while ((match = exchangeRegex.exec(body)) !== null) {
    exchanges.push({
      timestamp: match[1],
      question: match[2].trim(),
      answer: match[3].trim()
    });
  }

  return {
    id: metadata.id,
    sessionId: metadata.session_id,
    created: metadata.created,
    updated: metadata.updated,
    keywords: metadata.keywords || [],
    topics: metadata.topics || [],
    exchanges
  };
}

/**
 * Load a conversation by ID
 * @param {string} basePath - Base storage path
 * @param {string} instanceName - Instance name
 * @param {string} conversationId - Conversation ID
 * @returns {object|null} Conversation data or null
 */
export async function loadConversation(basePath, instanceName, conversationId) {
  const index = await loadIndex(basePath, instanceName);

  // Find conversation path in index
  for (const item of index.recent) {
    if (item.id === conversationId) {
      const fullPath = join(basePath, instanceName, item.path);
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        return parseConversationMarkdown(content);
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Save a conversation
 * @param {string} basePath - Base storage path
 * @param {string} instanceName - Instance name
 * @param {object} conversationData - Conversation data
 * @returns {string} Relative path to the saved file
 */
export async function saveConversation(basePath, instanceName, conversationData) {
  const dateDir = getDateDirectory();
  const conversationsPath = join(basePath, instanceName, 'conversations', dateDir);

  await fs.mkdir(conversationsPath, { recursive: true });

  const filename = `conv-${conversationData.id}.md`;
  const relativePath = join('conversations', dateDir, filename);
  const fullPath = join(basePath, instanceName, relativePath);

  const content = generateConversationMarkdown(conversationData);

  // Atomic write: write to temp file, then rename
  const tempPath = fullPath + '.tmp';
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, fullPath);

  return relativePath;
}

/**
 * Create a new conversation
 * @param {string} sessionId - Session ID
 * @param {string} question - Initial question
 * @param {string} answer - Initial answer
 * @param {string[]} keywords - Extracted keywords
 * @param {string[]} topics - Extracted topics
 * @returns {object} New conversation data
 */
export function createConversation(sessionId, question, answer, keywords = [], topics = []) {
  const now = new Date().toISOString();
  return {
    id: uuidv4().substring(0, 8),
    sessionId,
    created: now,
    updated: now,
    keywords,
    topics,
    exchanges: [{
      timestamp: now,
      question,
      answer
    }]
  };
}

/**
 * Append an exchange to an existing conversation
 * @param {object} conversationData - Existing conversation
 * @param {string} question - New question
 * @param {string} answer - New answer
 * @param {string[]} newKeywords - Additional keywords
 * @param {string[]} newTopics - Additional topics
 * @returns {object} Updated conversation data
 */
export function appendToConversation(conversationData, question, answer, newKeywords = [], newTopics = []) {
  const now = new Date().toISOString();

  // Merge keywords and topics, removing duplicates
  const allKeywords = [...new Set([...conversationData.keywords, ...newKeywords])];
  const allTopics = [...new Set([...conversationData.topics, ...newTopics])];

  return {
    ...conversationData,
    updated: now,
    keywords: allKeywords,
    topics: allTopics,
    exchanges: [
      ...conversationData.exchanges,
      {
        timestamp: now,
        question,
        answer
      }
    ]
  };
}

/**
 * Load the index file
 * @param {string} basePath - Base storage path
 * @param {string} instanceName - Instance name
 * @returns {object} Index data
 */
export async function loadIndex(basePath, instanceName) {
  const indexPath = join(basePath, instanceName, 'index.md');

  try {
    const content = await fs.readFile(indexPath, 'utf8');
    return parseIndexMarkdown(content);
  } catch {
    return createEmptyIndex(instanceName);
  }
}

/**
 * Parse index markdown file
 * @param {string} content - Markdown content
 * @returns {object} Index data
 */
function parseIndexMarkdown(content) {
  const { metadata, body } = parseMarkdownFrontmatter(content);

  // Parse topics section
  const topics = {};
  const topicsMatch = body.match(/## By Topic\n\n([\s\S]*?)(?=\n## |$)/);
  if (topicsMatch) {
    const topicRegex = /### (\w+)\n([\s\S]*?)(?=\n### |\n## |$)/g;
    let match;
    while ((match = topicRegex.exec(topicsMatch[1])) !== null) {
      const topicName = match[1];
      const entries = match[2].match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
      topics[topicName] = entries.map(e => {
        const m = e.match(/\[([^\]]+)\]\(([^)]+)\)/);
        return { id: m[1], path: m[2] };
      });
    }
  }

  // Parse keywords table
  const keywords = {};
  const keywordsMatch = body.match(/## By Keyword\n\n\|[\s\S]*?\n\n/);
  if (keywordsMatch) {
    const rows = keywordsMatch[0].split('\n').slice(3); // Skip header rows
    for (const row of rows) {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 2) {
        keywords[cells[0]] = cells[1].split(',').map(s => s.trim());
      }
    }
  }

  // Parse recent conversations
  const recent = [];
  const recentMatch = body.match(/## Recent Conversations\n\n([\s\S]*?)$/);
  if (recentMatch) {
    const lines = recentMatch[1].trim().split('\n');
    for (const line of lines) {
      const match = line.match(/\d+\. \[([^\]]+)\] ([^ ]+) - ([^(]+)\(keywords: ([^)]+)\) - path: ([^\s]+)/);
      if (match) {
        recent.push({
          date: match[1],
          id: match[2],
          summary: match[3].trim(),
          keywords: match[4].split(',').map(s => s.trim()),
          path: match[5]
        });
      }
    }
  }

  return {
    instance: metadata.instance,
    lastUpdated: metadata.last_updated,
    totalConversations: parseInt(metadata.total_conversations) || 0,
    topics,
    keywords,
    recent
  };
}

/**
 * Save the index file
 * @param {string} basePath - Base storage path
 * @param {string} instanceName - Instance name
 * @param {object} indexData - Index data
 */
export async function saveIndex(basePath, instanceName, indexData) {
  const indexPath = join(basePath, instanceName, 'index.md');

  const metadata = {
    instance: indexData.instance,
    last_updated: new Date().toISOString(),
    total_conversations: indexData.totalConversations
  };

  let body = '# Conversation Memory Index\n\n';

  // Topics section
  body += '## By Topic\n\n';
  for (const [topic, entries] of Object.entries(indexData.topics)) {
    body += `### ${topic}\n`;
    for (const entry of entries) {
      body += `- [${entry.id}](${entry.path}) - ${entry.summary || ''}\n`;
    }
    body += '\n';
  }

  // Keywords table
  body += '## By Keyword\n\n';
  body += '| Keyword | Conversations |\n';
  body += '|---------|---------------|\n';
  for (const [keyword, convIds] of Object.entries(indexData.keywords)) {
    body += `| ${keyword} | ${convIds.join(', ')} |\n`;
  }
  body += '\n';

  // Recent conversations
  body += '## Recent Conversations\n\n';
  for (let i = 0; i < indexData.recent.length; i++) {
    const item = indexData.recent[i];
    body += `${i + 1}. [${item.date}] ${item.id} - ${item.summary} (keywords: ${item.keywords.join(', ')}) - path: ${item.path}\n`;
  }

  const content = generateFrontmatter(metadata) + body;

  // Ensure directory exists
  await fs.mkdir(dirname(indexPath), { recursive: true });

  // Atomic write
  const tempPath = indexPath + '.tmp';
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, indexPath);
}

/**
 * Update the index with a new/updated conversation
 * @param {object} indexData - Current index data
 * @param {object} conversationData - Conversation data
 * @param {string} relativePath - Relative path to conversation file
 * @returns {object} Updated index data
 */
export function updateIndex(indexData, conversationData, relativePath) {
  const { id, keywords, topics, exchanges, created } = conversationData;

  // Get first question as summary
  const summary = exchanges[0]?.question?.substring(0, 50) + '...' || 'No summary';
  const date = created.split('T')[0];

  // Update topics
  const newTopics = { ...indexData.topics };
  for (const topic of topics) {
    if (!newTopics[topic]) {
      newTopics[topic] = [];
    }
    const existing = newTopics[topic].find(e => e.id === id);
    if (!existing) {
      newTopics[topic].push({ id, path: relativePath, summary });
    }
  }

  // Update keywords
  const newKeywords = { ...indexData.keywords };
  for (const keyword of keywords) {
    if (!newKeywords[keyword]) {
      newKeywords[keyword] = [];
    }
    if (!newKeywords[keyword].includes(id)) {
      newKeywords[keyword].push(id);
    }
  }

  // Update recent list
  const newRecent = indexData.recent.filter(r => r.id !== id);
  newRecent.unshift({
    date,
    id,
    summary,
    keywords,
    path: relativePath
  });

  // Keep only last 50 recent conversations
  if (newRecent.length > 50) {
    newRecent.length = 50;
  }

  // Count unique conversations
  const uniqueIds = new Set(newRecent.map(r => r.id));

  return {
    ...indexData,
    lastUpdated: new Date().toISOString(),
    totalConversations: uniqueIds.size,
    topics: newTopics,
    keywords: newKeywords,
    recent: newRecent
  };
}

/**
 * Find conversations by session ID
 * @param {string} basePath - Base storage path
 * @param {string} instanceName - Instance name
 * @param {string} sessionId - Session ID to find
 * @returns {object|null} Conversation data or null
 */
export async function findConversationBySessionId(basePath, instanceName, sessionId) {
  const index = await loadIndex(basePath, instanceName);

  for (const item of index.recent) {
    const conversation = await loadConversation(basePath, instanceName, item.id);
    if (conversation && conversation.sessionId === sessionId) {
      return conversation;
    }
  }

  return null;
}

/**
 * Get memory statistics
 * @param {string} basePath - Base storage path
 * @param {string} instanceName - Instance name
 * @returns {object} Statistics
 */
export async function getStats(basePath, instanceName) {
  const index = await loadIndex(basePath, instanceName);

  return {
    totalConversations: index.totalConversations,
    totalTopics: Object.keys(index.topics).length,
    totalKeywords: Object.keys(index.keywords).length,
    lastUpdated: index.lastUpdated
  };
}
