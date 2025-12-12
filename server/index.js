// Load environment variables FIRST, before any other imports that use them
import "./config.js";

import express from "express";
import { createLogger, format, transports } from "winston";
import { authenticate } from "./middleware/auth.js";
import {
  invokeClaudeCode,
  checkClaudeAvailability,
  getInstanceInfo,
} from "./claude-handler.js";
import {
  initializeMemory,
  isMemoryEnabled,
  getMemoryStats,
  recordConversation,
  getRelevantContext,
  search as searchMemory,
  getRecent as getRecentMemory,
  getConversation,
} from "./memory/index.js";
import {
  buildPackageContext,
  discoverPackages,
  getPackageContextSummary,
} from "./package-context.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { networkInterfaces } from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get version from package.json
let version = "0.1.0";
try {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, "..", "package.json"), "utf8"),
  );
  version = packageJson.version;
} catch (err) {
  // Use default version
}

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_REQUESTS || "2", 10);

// Memory configuration
const MEMORY_ENABLED = process.env.MEMORY_ENABLED === "true";
const MEMORY_STORAGE_PATH = process.env.MEMORY_STORAGE_PATH || "./memory";
const MEMORY_MAX_CONTEXT_ITEMS = parseInt(process.env.MEMORY_MAX_CONTEXT_ITEMS || "3", 10);
const MEMORY_MAX_CONTEXT_TOKENS = parseInt(process.env.MEMORY_MAX_CONTEXT_TOKENS || "2000", 10);

// Package context configuration
const PACKAGE_CONTEXT_ENABLED = process.env.PACKAGE_CONTEXT_ENABLED !== "false"; // Enabled by default

// Instance name for logging
const INSTANCE_NAME = process.env.INSTANCE_NAME || "unnamed-instance";

// Generate a consistent color code for the instance name (ANSI 256 colors)
function getInstanceColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Use colors 17-230 (avoiding too dark/light colors)
  return 17 + (Math.abs(hash) % 214);
}

const INSTANCE_COLOR = getInstanceColor(INSTANCE_NAME);
// ANSI escape: \x1b[48;5;{color}m for background, \x1b[38;5;{color}m for foreground
const INSTANCE_BADGE = `\x1b[48;5;${INSTANCE_COLOR}m\x1b[38;5;15m ${INSTANCE_NAME} \x1b[0m`;

// Logger setup
const logger = createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? ` ${JSON.stringify(meta)}`
            : "";
          // Gray timestamp using ANSI dim/gray color (90)
          const grayTimestamp = `\x1b[90m${timestamp}\x1b[0m`;
          return `${grayTimestamp} ${INSTANCE_BADGE} [${level}]: ${message}${metaStr}`;
        }),
      ),
    }),
  ],
});

// Concurrency control
let activeRequests = 0;

async function executeWithConcurrencyLimit(fn) {
  if (activeRequests >= MAX_CONCURRENT) {
    throw new Error("Server at capacity. Please retry later.");
  }

  activeRequests++;
  try {
    return await fn();
  } finally {
    activeRequests--;
  }
}

// Express app setup
const app = express();
app.use(express.json());

// CORS middleware - allow cross-origin requests from Web UI
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-API-Key");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("Request processed", {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });
  next();
});

// Health check endpoint
app.get("/health", async (req, res) => {
  const claudeAvailable = await checkClaudeAvailability();
  const instanceInfo = getInstanceInfo();
  const memoryStats = await getMemoryStats();

  // Get package info
  const packages = PACKAGE_CONTEXT_ENABLED ? discoverPackages() : [];
  const packagesWithDocs = packages.filter(p => p.hasClaudeMd).length;

  res.json({
    status: "healthy",
    version,
    claude_code_available: claudeAvailable,
    instance_name: instanceInfo.instanceName,
    persona: instanceInfo.persona,
    active_requests: activeRequests,
    max_concurrent: MAX_CONCURRENT,
    memory_enabled: isMemoryEnabled(),
    memory_stats: memoryStats,
    package_context_enabled: PACKAGE_CONTEXT_ENABLED,
    packages_discovered: packages.length,
    packages_with_docs: packagesWithDocs,
  });
});

// Ask endpoint
app.post("/ask", authenticate, async (req, res) => {
  const { question, context, session_id, use_memory = true, save_to_memory = true, use_package_context = true } = req.body;

  // Validation
  if (!question || typeof question !== "string" || question.trim() === "") {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "question" field. Must be a non-empty string.',
      timestamp: new Date().toISOString(),
    });
  }

  logger.info("Processing question", {
    question: question.substring(0, 500) + (question.length > 500 ? '...' : ''),
    hasContext: !!context,
    hasSession: !!session_id,
    useMemory: use_memory,
    usePackageContext: use_package_context,
  });

  try {
    // Get package context if enabled
    let packageContext = null;
    let detectedPackages = [];
    if (PACKAGE_CONTEXT_ENABLED && use_package_context) {
      packageContext = buildPackageContext(question);
      detectedPackages = packageContext.packages;
      if (detectedPackages.length > 0) {
        logger.info("Package context detected", {
          packages: detectedPackages,
          totalPackages: packageContext.totalPackages,
        });
      }
    }

    // Get relevant context from memory if enabled
    let memoryContext = null;
    let memorySources = [];
    if (isMemoryEnabled() && use_memory) {
      memoryContext = await getRelevantContext(question, {
        maxItems: MEMORY_MAX_CONTEXT_ITEMS,
        maxTokens: MEMORY_MAX_CONTEXT_TOKENS,
      });
      if (memoryContext.contextUsed) {
        memorySources = memoryContext.sources || [];
        logger.info("Memory context retrieved", {
          sources: memorySources.length,
          summary: memoryContext.summary,
        });
      }
    }

    // Combine all context: package context + memory context + provided context
    let fullContext = "";
    if (packageContext?.context) {
      fullContext += packageContext.context + "\n\n";
    }
    if (memoryContext?.contextUsed && memoryContext.context) {
      fullContext += memoryContext.context + "\n\n";
    }
    if (context) {
      fullContext += context;
    }
    fullContext = fullContext.trim();

    const result = await executeWithConcurrencyLimit(() =>
      invokeClaudeCode(question, fullContext || undefined, session_id),
    );

    // Record conversation to memory if enabled
    let memoryRecorded = false;
    if (isMemoryEnabled() && save_to_memory) {
      const recordResult = await recordConversation(
        question,
        result.response,
        result.sessionId,
        { duration: result.duration }
      );
      memoryRecorded = recordResult.recorded;
      if (memoryRecorded) {
        logger.info("Conversation recorded to memory", {
          conversationId: recordResult.conversationId,
          keywords: recordResult.keywords?.slice(0, 5),
        });
      }
    }

    logger.info("Question answered successfully", {
      duration: result.duration,
      sessionId: result.sessionId,
      memoryUsed: memoryContext?.contextUsed || false,
      memoryRecorded,
      packagesUsed: detectedPackages.length,
      answer: result.response.substring(0, 500) + (result.response.length > 500 ? '...' : ''),
    });

    res.json({
      success: true,
      answer: result.response,
      session_id: result.sessionId,
      instance_name: result.instanceName,
      timestamp: new Date().toISOString(),
      duration_ms: result.duration,
      memory_context_used: memoryContext?.contextUsed || false,
      memory_sources: memorySources,
      package_context_used: detectedPackages.length > 0,
      packages_detected: detectedPackages,
    });
  } catch (error) {
    logger.error("Error processing question", {
      error: error.message,
      questionLength: question.length,
    });

    let statusCode = 500;
    if (error.message.includes("timed out")) {
      statusCode = 504;
    } else if (error.message.includes("capacity")) {
      statusCode = 503;
    }

    res.status(statusCode).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Packages endpoint - list discovered packages
app.get("/packages", authenticate, async (req, res) => {
  if (!PACKAGE_CONTEXT_ENABLED) {
    return res.status(404).json({
      success: false,
      error: "Package context is not enabled",
      timestamp: new Date().toISOString(),
    });
  }

  const packages = discoverPackages();
  res.json({
    success: true,
    packages: packages.map(p => ({
      name: p.name,
      path: p.path,
      has_documentation: p.hasClaudeMd,
    })),
    total: packages.length,
    with_documentation: packages.filter(p => p.hasClaudeMd).length,
    timestamp: new Date().toISOString(),
  });
});

// Memory stats endpoint
app.get("/memory/stats", authenticate, async (req, res) => {
  if (!isMemoryEnabled()) {
    return res.status(404).json({
      success: false,
      error: "Memory system is not enabled",
      timestamp: new Date().toISOString(),
    });
  }

  const stats = await getMemoryStats();
  res.json({
    success: true,
    ...stats,
    timestamp: new Date().toISOString(),
  });
});

// Memory search endpoint
app.get("/memory/search", authenticate, async (req, res) => {
  if (!isMemoryEnabled()) {
    return res.status(404).json({
      success: false,
      error: "Memory system is not enabled",
      timestamp: new Date().toISOString(),
    });
  }

  const query = req.query.q;
  const limit = parseInt(req.query.limit || "10", 10);

  if (!query) {
    return res.status(400).json({
      success: false,
      error: "Missing query parameter 'q'",
      timestamp: new Date().toISOString(),
    });
  }

  const results = await searchMemory(query, limit);
  res.json({
    success: true,
    query,
    results,
    count: results.length,
    timestamp: new Date().toISOString(),
  });
});

// Memory recent endpoint
app.get("/memory/recent", authenticate, async (req, res) => {
  if (!isMemoryEnabled()) {
    return res.status(404).json({
      success: false,
      error: "Memory system is not enabled",
      timestamp: new Date().toISOString(),
    });
  }

  const limit = parseInt(req.query.limit || "10", 10);
  const recent = await getRecentMemory(limit);

  res.json({
    success: true,
    conversations: recent,
    count: recent.length,
    timestamp: new Date().toISOString(),
  });
});

// Get specific conversation
app.get("/memory/conversation/:id", authenticate, async (req, res) => {
  if (!isMemoryEnabled()) {
    return res.status(404).json({
      success: false,
      error: "Memory system is not enabled",
      timestamp: new Date().toISOString(),
    });
  }

  const conversation = await getConversation(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      error: "Conversation not found",
      timestamp: new Date().toISOString(),
    });
  }

  res.json({
    success: true,
    conversation,
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: "Internal server error",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
  });
});

// Get local IP addresses
function getLocalIPs() {
  const nets = networkInterfaces();
  const ips = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (net.family === "IPv4" && !net.internal) {
        ips.push({ interface: name, address: net.address });
      }
    }
  }
  return ips;
}

// Print prominent startup banner
function printStartupBanner() {
  const cyan = "\x1b[36m";
  const bold = "\x1b[1m";
  const reset = "\x1b[0m";

  // Build version line with proper padding (58 chars between ║ markers)
  const versionText = `C L A U D E  v${version}`;
  const padding = 58 - versionText.length;
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  const versionLine = " ".repeat(leftPad) + versionText + " ".repeat(rightPad);

  const banner = `
${cyan}${bold}╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ██╗███╗   ██╗████████╗███████╗██████╗                  ║
║   ██║████╗  ██║╚══██╔══╝██╔════╝██╔══██╗                 ║
║   ██║██╔██╗ ██║   ██║   █████╗  ██████╔╝                 ║
║   ██║██║╚██╗██║   ██║   ██╔══╝  ██╔══██╗                 ║
║   ██║██║ ╚████║   ██║   ███████╗██║  ██║                 ║
║   ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝╚═╝  ╚═╝                 ║
║${reset}${bold}${versionLine}${cyan}║
║                                                          ║
╚══════════════════════════════════════════════════════════╝${reset}
`;
  console.log(banner);
}

// Start server
async function startServer() {
  const instanceInfo = getInstanceInfo();

  // Initialize memory system if enabled
  if (MEMORY_ENABLED) {
    await initializeMemory(instanceInfo.instanceName, MEMORY_STORAGE_PATH, {
      enabled: true,
      maxContextItems: MEMORY_MAX_CONTEXT_ITEMS,
      maxContextTokens: MEMORY_MAX_CONTEXT_TOKENS,
    });
  }

  app.listen(PORT, HOST, () => {
    const localIPs = getLocalIPs();

    // Print prominent startup banner
    printStartupBanner();

    logger.info(`Server ready`, {
      host: HOST,
      port: PORT,
      instanceName: instanceInfo.instanceName,
      hasPersona: !!instanceInfo.persona,
      maxConcurrent: MAX_CONCURRENT,
      memoryEnabled: MEMORY_ENABLED,
    });

    logger.info(`Local: http://localhost:${PORT}`);

    if (localIPs.length > 0) {
      logger.info(`Network interfaces:`);
      for (const ip of localIPs) {
        logger.info(`  ${ip.interface}: http://${ip.address}:${PORT}`);
      }
    }

    logger.info(`Health: GET /health | Ask: POST /ask`);
    if (MEMORY_ENABLED) {
      logger.info(`Memory: GET /memory/stats | /memory/search?q= | /memory/recent`);
    }
    if (PACKAGE_CONTEXT_ENABLED) {
      const pkgs = discoverPackages();
      logger.info(`Package Context: ${pkgs.length} packages discovered, ${pkgs.filter(p => p.hasClaudeMd).length} with CLAUDE.md`);
    }
  });
}

startServer().catch((err) => {
  logger.error("Failed to start server", { error: err.message });
  process.exit(1);
});
