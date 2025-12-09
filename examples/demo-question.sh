#!/bin/bash
# Demo: Simple question to a Claude instance
#
# This example sends a basic question without any context or session.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT="${SCRIPT_DIR}/../client/ask.sh"

# Configuration - update these for your setup
HOST="${CLAUDE_BRIDGE_HOST:-localhost}"
PORT="${CLAUDE_BRIDGE_PORT:-3001}"

echo "=== Simple Question Demo ==="
echo "Sending question to http://${HOST}:${PORT}"
echo ""

"$CLIENT" \
  --host "$HOST" \
  --port "$PORT" \
  --question "What are the key benefits of using dependency injection in software design?"
