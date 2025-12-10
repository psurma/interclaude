import express from 'express';
import { config } from 'dotenv';
import { createLogger, format, transports } from 'winston';
import { authenticate } from './middleware/auth.js';
import { invokeClaudeCode, checkClaudeAvailability, getInstanceInfo } from './claude-handler.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { networkInterfaces } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from project root
config({ path: join(__dirname, '..', '.env') });

// Get version from package.json
let version = '0.1.0';
try {
  const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
  version = packageJson.version;
} catch (err) {
  // Use default version
}

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '2', 10);

// Logger setup
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      )
    })
  ]
});

// Concurrency control
let activeRequests = 0;

async function executeWithConcurrencyLimit(fn) {
  if (activeRequests >= MAX_CONCURRENT) {
    throw new Error('Server at capacity. Please retry later.');
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

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request processed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const claudeAvailable = await checkClaudeAvailability();
  const instanceInfo = getInstanceInfo();

  res.json({
    status: 'healthy',
    version,
    claude_code_available: claudeAvailable,
    instance_name: instanceInfo.instanceName,
    persona: instanceInfo.persona,
    active_requests: activeRequests,
    max_concurrent: MAX_CONCURRENT
  });
});

// Ask endpoint
app.post('/ask', authenticate, async (req, res) => {
  const { question, context, session_id } = req.body;

  // Validation
  if (!question || typeof question !== 'string' || question.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid "question" field. Must be a non-empty string.',
      timestamp: new Date().toISOString()
    });
  }

  logger.info('Processing question', {
    questionLength: question.length,
    hasContext: !!context,
    hasSession: !!session_id
  });

  try {
    const result = await executeWithConcurrencyLimit(() =>
      invokeClaudeCode(question, context, session_id)
    );

    logger.info('Question answered successfully', {
      duration: result.duration,
      sessionId: result.sessionId
    });

    res.json({
      success: true,
      answer: result.response,
      session_id: result.sessionId,
      instance_name: result.instanceName,
      timestamp: new Date().toISOString(),
      duration_ms: result.duration
    });
  } catch (error) {
    logger.error('Error processing question', {
      error: error.message,
      questionLength: question.length
    });

    let statusCode = 500;
    if (error.message.includes('timed out')) {
      statusCode = 504;
    } else if (error.message.includes('capacity')) {
      statusCode = 503;
    }

    res.status(statusCode).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Get local IP addresses
function getLocalIPs() {
  const nets = networkInterfaces();
  const ips = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ interface: name, address: net.address });
      }
    }
  }
  return ips;
}

// Start server
app.listen(PORT, HOST, () => {
  const instanceInfo = getInstanceInfo();
  const localIPs = getLocalIPs();

  logger.info(`InterClaude server started`, {
    host: HOST,
    port: PORT,
    instanceName: instanceInfo.instanceName,
    hasPersona: !!instanceInfo.persona,
    maxConcurrent: MAX_CONCURRENT
  });

  logger.info(`Local: http://localhost:${PORT}`);

  if (localIPs.length > 0) {
    logger.info(`Network interfaces:`);
    for (const ip of localIPs) {
      logger.info(`  ${ip.interface}: http://${ip.address}:${PORT}`);
    }
  }

  logger.info(`Health: GET /health | Ask: POST /ask`);
});
