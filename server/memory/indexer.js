/**
 * Indexer module for conversation memory
 * Handles keyword extraction and topic mapping
 */

// Common English stop words to filter out
const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "he",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "were",
  "will",
  "with",
  "would",
  "can",
  "could",
  "do",
  "does",
  "did",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "this",
  "these",
  "those",
  "i",
  "you",
  "we",
  "they",
  "my",
  "your",
  "our",
  "their",
  "me",
  "him",
  "her",
  "us",
  "them",
  "if",
  "then",
  "else",
  "but",
  "not",
  "no",
  "yes",
  "so",
  "just",
  "more",
  "most",
  "some",
  "any",
  "all",
  "also",
  "than",
  "only",
  "very",
  "too",
  "now",
  "here",
  "there",
  "up",
  "down",
  "out",
  "about",
  "into",
  "over",
  "after",
  "before",
  "between",
  "under",
  "again",
  "should",
  "need",
  "want",
  "like",
  "get",
  "make",
  "know",
  "think",
  "see",
  "use",
  "used",
  "using",
  "way",
  "work",
  "working",
  "thing",
  "please",
  "thanks",
  "thank",
  "help",
  "question",
  "answer",
  "example",
]);

// Topic categories with associated keywords
const TOPIC_KEYWORDS = {
  security: [
    "auth",
    "authentication",
    "authorization",
    "jwt",
    "token",
    "oauth",
    "password",
    "encrypt",
    "hash",
    "ssl",
    "tls",
    "https",
    "api-key",
    "secret",
    "credential",
    "permission",
    "role",
    "session",
    "cookie",
  ],
  "api-design": [
    "api",
    "rest",
    "graphql",
    "endpoint",
    "request",
    "response",
    "http",
    "get",
    "post",
    "put",
    "delete",
    "patch",
    "route",
    "path",
    "query",
    "parameter",
    "header",
    "body",
    "status",
    "swagger",
    "openapi",
  ],
  database: [
    "database",
    "db",
    "sql",
    "nosql",
    "query",
    "table",
    "schema",
    "index",
    "migration",
    "postgres",
    "mysql",
    "mongodb",
    "redis",
    "sqlite",
    "orm",
    "model",
    "relation",
    "join",
    "transaction",
  ],
  frontend: [
    "react",
    "vue",
    "angular",
    "svelte",
    "html",
    "css",
    "javascript",
    "typescript",
    "component",
    "state",
    "props",
    "hook",
    "dom",
    "browser",
    "ui",
    "ux",
    "style",
    "responsive",
    "mobile",
  ],
  backend: [
    "server",
    "node",
    "express",
    "fastify",
    "middleware",
    "handler",
    "controller",
    "service",
    "repository",
    "microservice",
    "monolith",
    "lambda",
    "serverless",
    "docker",
    "kubernetes",
  ],
  testing: [
    "test",
    "unit",
    "integration",
    "e2e",
    "jest",
    "mocha",
    "cypress",
    "playwright",
    "mock",
    "stub",
    "fixture",
    "assertion",
    "coverage",
    "tdd",
    "bdd",
  ],
  devops: [
    "deploy",
    "ci",
    "cd",
    "pipeline",
    "build",
    "release",
    "docker",
    "container",
    "kubernetes",
    "k8s",
    "aws",
    "gcp",
    "azure",
    "terraform",
    "ansible",
    "monitoring",
    "logging",
  ],
  performance: [
    "performance",
    "optimize",
    "cache",
    "speed",
    "latency",
    "throughput",
    "memory",
    "cpu",
    "profiling",
    "benchmark",
    "load",
    "scale",
    "concurrent",
  ],
  architecture: [
    "architecture",
    "design",
    "pattern",
    "mvc",
    "mvvm",
    "clean",
    "hexagonal",
    "domain",
    "layer",
    "module",
    "dependency",
    "injection",
    "solid",
    "dry",
    "kiss",
  ],
  "error-handling": [
    "error",
    "exception",
    "catch",
    "throw",
    "try",
    "finally",
    "debug",
    "log",
    "trace",
    "stack",
    "bug",
    "fix",
    "issue",
    "problem",
  ],
};

/**
 * Tokenize text into words
 * @param {string} text - Text to tokenize
 * @returns {string[]} Array of tokens
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

/**
 * Extract keywords from text
 * @param {string} text - Text to extract keywords from
 * @param {number} maxKeywords - Maximum number of keywords to return
 * @returns {string[]} Array of keywords
 */
export function extractKeywords(text, maxKeywords = 10) {
  const tokens = tokenize(text);

  // Count word frequencies
  const frequencies = {};
  for (const token of tokens) {
    if (!STOP_WORDS.has(token)) {
      frequencies[token] = (frequencies[token] || 0) + 1;
    }
  }

  // Sort by frequency and get top keywords
  const sorted = Object.entries(frequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);

  return sorted;
}

/**
 * Extract keywords from a question-answer pair
 * @param {string} question - The question
 * @param {string} answer - The answer
 * @param {number} maxKeywords - Maximum keywords to return
 * @returns {string[]} Array of keywords
 */
export function extractKeywordsFromExchange(question, answer, maxKeywords = 10) {
  // Weight question keywords higher by repeating them
  const combinedText = question + " " + question + " " + answer;
  return extractKeywords(combinedText, maxKeywords);
}

/**
 * Extract topics from text based on keyword matching
 * @param {string} text - Text to analyze
 * @param {string[]} existingTopics - Topics already assigned
 * @returns {string[]} Array of matched topics
 */
export function extractTopics(text, existingTopics = []) {
  const tokens = new Set(tokenize(text));
  const matchedTopics = new Set(existingTopics);

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    let matchCount = 0;
    for (const keyword of keywords) {
      if (tokens.has(keyword)) {
        matchCount++;
      }
    }
    // Require at least 2 keyword matches to assign a topic
    if (matchCount >= 2) {
      matchedTopics.add(topic);
    }
  }

  return Array.from(matchedTopics);
}

/**
 * Extract topics from a question-answer pair
 * @param {string} question - The question
 * @param {string} answer - The answer
 * @param {string[]} existingTopics - Topics already assigned
 * @returns {string[]} Array of matched topics
 */
export function extractTopicsFromExchange(question, answer, existingTopics = []) {
  const combinedText = question + " " + answer;
  return extractTopics(combinedText, existingTopics);
}

/**
 * Get topic suggestions based on keywords
 * @param {string[]} keywords - Keywords to match
 * @returns {string[]} Suggested topics
 */
export function getTopicSuggestions(keywords) {
  const suggestions = new Set();

  for (const keyword of keywords) {
    for (const [topic, topicKeywords] of Object.entries(TOPIC_KEYWORDS)) {
      if (topicKeywords.includes(keyword)) {
        suggestions.add(topic);
      }
    }
  }

  return Array.from(suggestions);
}

/**
 * Calculate keyword similarity between two sets
 * @param {string[]} keywords1 - First keyword set
 * @param {string[]} keywords2 - Second keyword set
 * @returns {number} Similarity score (0-1)
 */
export function calculateKeywordSimilarity(keywords1, keywords2) {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);

  let intersection = 0;
  for (const keyword of set1) {
    if (set2.has(keyword)) {
      intersection++;
    }
  }

  const union = new Set([...keywords1, ...keywords2]).size;

  return union > 0 ? intersection / union : 0;
}

/**
 * Find matching keywords in an index
 * @param {string[]} queryKeywords - Keywords from the query
 * @param {object} keywordIndex - Index mapping keywords to conversation IDs
 * @returns {object} Map of conversation IDs to match scores
 */
export function findKeywordMatches(queryKeywords, keywordIndex) {
  const matches = {};

  for (const keyword of queryKeywords) {
    const conversationIds = keywordIndex[keyword] || [];
    for (const id of conversationIds) {
      matches[id] = (matches[id] || 0) + 1;
    }
  }

  return matches;
}

/**
 * Normalize and deduplicate keywords
 * @param {string[]} keywords - Keywords to normalize
 * @returns {string[]} Normalized keywords
 */
export function normalizeKeywords(keywords) {
  const normalized = keywords
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length > 2 && !STOP_WORDS.has(k));

  return [...new Set(normalized)];
}

/**
 * Generate a summary from text (first N words)
 * @param {string} text - Text to summarize
 * @param {number} maxWords - Maximum words in summary
 * @returns {string} Summary
 */
export function generateSummary(text, maxWords = 10) {
  const words = text.split(/\s+/).slice(0, maxWords);
  return words.join(" ") + (text.split(/\s+/).length > maxWords ? "..." : "");
}
