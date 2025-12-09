#!/bin/bash
# Demo: Multi-turn conversation with session continuity
#
# This example demonstrates how to maintain context across
# multiple questions using session IDs.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT="${SCRIPT_DIR}/../client/ask.sh"

# Configuration - update these for your setup
HOST="${CLAUDE_BRIDGE_HOST:-localhost}"
PORT="${CLAUDE_BRIDGE_PORT:-3001}"

echo "=== Session Continuity Demo ==="
echo "Demonstrating multi-turn conversation with session IDs"
echo ""

# First question - get initial response and capture session ID
echo "--- Question 1: Initial question ---"
RESPONSE=$("$CLIENT" \
  --host "$HOST" \
  --port "$PORT" \
  --question "I'm designing a user authentication system. What are the main components I need to consider?" \
  --json)

echo "$RESPONSE" | jq -r '.answer'
echo ""

# Extract session ID
SESSION_ID=$(echo "$RESPONSE" | jq -r '.session_id')
echo "[Captured Session ID: $SESSION_ID]"
echo ""

# Second question - follow up using the session
echo "--- Question 2: Follow-up question ---"
"$CLIENT" \
  --host "$HOST" \
  --port "$PORT" \
  --session "$SESSION_ID" \
  --question "Based on what you just described, how should I implement the token refresh mechanism?"

echo ""
echo "=== Demo Complete ==="
echo "The second question used the session from the first to maintain context."
