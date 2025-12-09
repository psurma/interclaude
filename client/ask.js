#!/usr/bin/env node
/**
 * InterClaude Client - Node.js version
 *
 * Send questions to a Claude Code instance over HTTP.
 *
 * Usage:
 *   node ask.js -q "Your question" [-h host] [-p port] [-c context] [-s session] [--json]
 */

import { parseArgs } from 'node:util';

const options = {
  host: {
    type: 'string',
    short: 'h',
    default: process.env.CLAUDE_BRIDGE_HOST || 'localhost'
  },
  port: {
    type: 'string',
    short: 'p',
    default: process.env.CLAUDE_BRIDGE_PORT || '3001'
  },
  question: {
    type: 'string',
    short: 'q'
  },
  context: {
    type: 'string',
    short: 'c'
  },
  session: {
    type: 'string',
    short: 's'
  },
  'api-key': {
    type: 'string',
    default: process.env.CLAUDE_BRIDGE_API_KEY || ''
  },
  json: {
    type: 'boolean',
    default: false
  },
  timeout: {
    type: 'string',
    default: '120000'
  },
  help: {
    type: 'boolean',
    default: false
  }
};

let values;
try {
  const parsed = parseArgs({ options, allowPositionals: false });
  values = parsed.values;
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}

if (values.help) {
  console.log(`
InterClaude Client - Send questions to a Claude Code instance

Usage: ask.js -q QUESTION [OPTIONS]

Required:
  -q, --question    The question to ask

Options:
  -h, --host        Target host (default: localhost or CLAUDE_BRIDGE_HOST)
  -p, --port        Target port (default: 3001 or CLAUDE_BRIDGE_PORT)
  -c, --context     Additional context for the question
  -s, --session     Session ID for conversation continuity
  --api-key         API key for authentication
  --json            Output raw JSON response
  --timeout         Request timeout in ms (default: 120000)
  --help            Show this help message

Environment Variables:
  CLAUDE_BRIDGE_HOST     Default host
  CLAUDE_BRIDGE_PORT     Default port
  CLAUDE_BRIDGE_API_KEY  API key

Examples:
  node ask.js -h 192.168.1.100 -q "What is dependency injection?"
  node ask.js -q "How do I use the auth module?" -c "Node.js SDK v2.0"
  node ask.js -q "Follow up question" -s abc123-session-id
`);
  process.exit(0);
}

if (!values.question) {
  console.error('Error: Question is required (-q)');
  console.error('Use --help for usage information');
  process.exit(1);
}

const MAX_RETRIES = 3;

async function makeRequest(attempt = 1) {
  const payload = {
    question: values.question,
    ...(values.context && { context: values.context }),
    ...(values.session && { session_id: values.session })
  };

  const headers = {
    'Content-Type': 'application/json',
    ...(values['api-key'] && { 'X-API-Key': values['api-key'] })
  };

  const url = `http://${values.host}:${values.port}/ask`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(parseInt(values.timeout, 10))
    });

    const data = await response.json();

    if (values.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (data.success) {
      const instanceName = data.instance_name || 'unknown';
      console.log(`\x1b[32mResponse from ${instanceName}:\x1b[0m`);
      console.log('----------------------------------------');
      console.log(data.answer);
      console.log('----------------------------------------');
      console.log(`[Session: ${data.session_id} | Duration: ${data.duration_ms}ms]`);
    } else {
      console.error(`\x1b[31mError: ${data.error}\x1b[0m`);
      process.exit(1);
    }
  } catch (error) {
    const isRetryable = error.name === 'TimeoutError' ||
                        error.code === 'ECONNREFUSED' ||
                        error.code === 'ECONNRESET';

    if (isRetryable && attempt < MAX_RETRIES) {
      const delay = Math.pow(2, attempt) * 1000;
      console.error(`\x1b[33mRequest failed, retrying in ${delay / 1000}s (attempt ${attempt}/${MAX_RETRIES})...\x1b[0m`);
      await new Promise(r => setTimeout(r, delay));
      return makeRequest(attempt + 1);
    }

    console.error(`\x1b[31mError: ${error.message}\x1b[0m`);
    process.exit(1);
  }
}

makeRequest();
