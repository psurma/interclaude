#!/bin/bash
# Demo: Question with context
#
# This example sends a question with additional context to help
# the Claude instance provide a more relevant answer.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT="${SCRIPT_DIR}/../client/ask.sh"

# Configuration - update these for your setup
HOST="${CLAUDE_BRIDGE_HOST:-localhost}"
PORT="${CLAUDE_BRIDGE_PORT:-3001}"

echo "=== Context-Aware Question Demo ==="
echo "Sending question with context to http://${HOST}:${PORT}"
echo ""

"$CLIENT" \
  --host "$HOST" \
  --port "$PORT" \
  --question "How should I handle authentication errors?" \
  --context "I'm building a Node.js Express API using JWT tokens. The API serves a React frontend."
