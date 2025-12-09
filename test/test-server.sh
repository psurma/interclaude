#!/bin/bash
# Test: Server health check
#
# Verifies that the server is running and healthy.

set -e

HOST="${1:-${CLAUDE_BRIDGE_HOST:-localhost}}"
PORT="${2:-${CLAUDE_BRIDGE_PORT:-3001}}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo "=== Server Health Check ==="
echo "Testing: http://${HOST}:${PORT}/health"
echo ""

# Make health check request
RESPONSE=$(curl -s --connect-timeout 5 "http://${HOST}:${PORT}/health" 2>&1) || {
  echo -e "${RED}FAIL: Could not connect to server${NC}"
  echo "Make sure the server is running: npm start"
  exit 1
}

# Validate response is JSON
if ! echo "$RESPONSE" | jq . &>/dev/null; then
  echo -e "${RED}FAIL: Invalid JSON response${NC}"
  echo "$RESPONSE"
  exit 1
fi

# Check status
STATUS=$(echo "$RESPONSE" | jq -r '.status')
VERSION=$(echo "$RESPONSE" | jq -r '.version')
CLAUDE_AVAILABLE=$(echo "$RESPONSE" | jq -r '.claude_code_available')
INSTANCE_NAME=$(echo "$RESPONSE" | jq -r '.instance_name // "not set"')
PERSONA=$(echo "$RESPONSE" | jq -r '.persona // "not set"')

if [[ "$STATUS" == "healthy" ]]; then
  echo -e "${GREEN}PASS: Server is healthy${NC}"
  echo ""
  echo "Server Details:"
  echo "  Version:              $VERSION"
  echo "  Claude Code Available: $CLAUDE_AVAILABLE"
  echo "  Instance Name:        $INSTANCE_NAME"
  echo "  Persona:              ${PERSONA:0:50}..."
  echo ""

  if [[ "$CLAUDE_AVAILABLE" != "true" ]]; then
    echo -e "${RED}WARNING: Claude Code CLI is not available${NC}"
    echo "The /ask endpoint will fail until 'claude' command is accessible."
  fi

  exit 0
else
  echo -e "${RED}FAIL: Server health check failed${NC}"
  echo "$RESPONSE" | jq .
  exit 1
fi
