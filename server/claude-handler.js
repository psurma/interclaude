import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

const TIMEOUT_MS = parseInt(process.env.CLAUDE_CODE_TIMEOUT || '60000', 10);
const CLAUDE_PATH = process.env.CLAUDE_CODE_PATH || 'claude';
const ALLOWED_TOOLS = process.env.CLAUDE_CODE_ALLOWED_TOOLS || '';
const SYSTEM_PROMPT = process.env.CLAUDE_SYSTEM_PROMPT || '';
const INSTANCE_NAME = process.env.INSTANCE_NAME || 'unnamed-instance';

/**
 * Invoke Claude Code in headless mode with the given question
 *
 * @param {string} question - The question to ask Claude
 * @param {string} context - Optional context to prepend
 * @param {string} sessionId - Optional session ID for conversation continuity
 * @returns {Promise<{response: string, sessionId: string, duration: number, instanceName: string}>}
 */
export async function invokeClaudeCode(question, context, sessionId) {
  const startTime = Date.now();

  // Build the prompt with optional system prompt and context
  let prompt = '';

  if (SYSTEM_PROMPT) {
    prompt += `System: ${SYSTEM_PROMPT}\n\n`;
  }

  if (context) {
    prompt += `Context: ${context}\n\n`;
  }

  prompt += question;

  // Build command arguments
  const args = [];

  if (sessionId) {
    args.push('--resume', sessionId);
  }

  args.push('-p', prompt, '--output-format', 'json');

  if (ALLOWED_TOOLS) {
    args.push('--allowedTools', ALLOWED_TOOLS);
  }

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    const child = spawn(CLAUDE_PATH, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 5000);
      reject(new Error(`Claude Code timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (code !== 0) {
        return reject(new Error(`Claude Code exited with code ${code}: ${stderr || 'Unknown error'}`));
      }

      try {
        // Try to parse JSON output
        const result = JSON.parse(stdout);
        resolve({
          response: result.result || result.content || result.text || stdout,
          sessionId: result.session_id || sessionId || uuidv4(),
          duration,
          instanceName: INSTANCE_NAME
        });
      } catch (parseError) {
        // Non-JSON output - return as plain text
        resolve({
          response: stdout.trim(),
          sessionId: sessionId || uuidv4(),
          duration,
          instanceName: INSTANCE_NAME
        });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to spawn Claude Code: ${err.message}`));
    });
  });
}

/**
 * Check if Claude Code CLI is available
 *
 * @returns {Promise<boolean>}
 */
export async function checkClaudeAvailability() {
  return new Promise((resolve) => {
    const child = spawn(CLAUDE_PATH, ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * Get instance information
 *
 * @returns {{instanceName: string, persona: string}}
 */
export function getInstanceInfo() {
  return {
    instanceName: INSTANCE_NAME,
    persona: SYSTEM_PROMPT ? SYSTEM_PROMPT.substring(0, 100) + (SYSTEM_PROMPT.length > 100 ? '...' : '') : ''
  };
}
