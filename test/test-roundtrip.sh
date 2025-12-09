#!/bin/bash
# Test: Full integration test suite
#
# Runs a series of tests to verify the InterClaude system is working correctly.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT="${SCRIPT_DIR}/../client/ask.sh"

HOST="${CLAUDE_BRIDGE_HOST:-localhost}"
PORT="${CLAUDE_BRIDGE_PORT:-3001}"
API_KEY="${CLAUDE_BRIDGE_API_KEY:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

pass() {
  echo -e "${GREEN}PASS${NC}: $1"
  ((PASSED++))
}

fail() {
  echo -e "${RED}FAIL${NC}: $1"
  ((FAILED++))
}

warn() {
  echo -e "${YELLOW}WARN${NC}: $1"
}

echo "=== InterClaude Integration Test Suite ==="
echo "Target: http://${HOST}:${PORT}"
echo ""

# Test 1: Health check
echo "--- Test 1: Health Check ---"
HEALTH_RESPONSE=$(curl -s --connect-timeout 5 "http://${HOST}:${PORT}/health" 2>&1) || {
  fail "Could not connect to server"
  echo "Make sure the server is running: npm start"
  exit 1
}

if echo "$HEALTH_RESPONSE" | jq -e '.status == "healthy"' &>/dev/null; then
  pass "Health endpoint returns healthy status"
else
  fail "Health endpoint did not return healthy status"
fi
echo ""

# Test 2: Invalid JSON
echo "--- Test 2: Invalid JSON Handling ---"
INVALID_RESPONSE=$(curl -s -X POST "http://${HOST}:${PORT}/ask" \
  -H "Content-Type: application/json" \
  ${API_KEY:+-H "X-API-Key: $API_KEY"} \
  -d 'not valid json' 2>&1)

if echo "$INVALID_RESPONSE" | jq -e '.success == false' &>/dev/null; then
  pass "Server correctly rejects invalid JSON"
else
  fail "Server did not reject invalid JSON"
fi
echo ""

# Test 3: Missing question field
echo "--- Test 3: Missing Question Validation ---"
MISSING_Q_RESPONSE=$(curl -s -X POST "http://${HOST}:${PORT}/ask" \
  -H "Content-Type: application/json" \
  ${API_KEY:+-H "X-API-Key: $API_KEY"} \
  -d '{}' 2>&1)

if echo "$MISSING_Q_RESPONSE" | jq -e '.success == false and (.error | contains("question"))' &>/dev/null; then
  pass "Server correctly rejects missing question"
else
  fail "Server did not reject missing question"
fi
echo ""

# Test 4: Empty question
echo "--- Test 4: Empty Question Validation ---"
EMPTY_Q_RESPONSE=$(curl -s -X POST "http://${HOST}:${PORT}/ask" \
  -H "Content-Type: application/json" \
  ${API_KEY:+-H "X-API-Key: $API_KEY"} \
  -d '{"question": ""}' 2>&1)

if echo "$EMPTY_Q_RESPONSE" | jq -e '.success == false' &>/dev/null; then
  pass "Server correctly rejects empty question"
else
  fail "Server did not reject empty question"
fi
echo ""

# Test 5: 404 handling
echo "--- Test 5: 404 Handling ---"
NOT_FOUND_RESPONSE=$(curl -s "http://${HOST}:${PORT}/nonexistent" 2>&1)

if echo "$NOT_FOUND_RESPONSE" | jq -e '.success == false and (.error | contains("Not found"))' &>/dev/null; then
  pass "Server correctly returns 404 for unknown routes"
else
  fail "Server did not return proper 404"
fi
echo ""

# Test 6: Check Claude availability
echo "--- Test 6: Claude Code Availability ---"
CLAUDE_AVAILABLE=$(echo "$HEALTH_RESPONSE" | jq -r '.claude_code_available')

if [[ "$CLAUDE_AVAILABLE" == "true" ]]; then
  pass "Claude Code CLI is available"

  # Test 7: Simple question (only if Claude is available)
  echo ""
  echo "--- Test 7: Simple Question ---"
  echo "Sending: 'What is 2 + 2? Reply with just the number.'"

  SIMPLE_RESPONSE=$("$CLIENT" \
    --host "$HOST" \
    --port "$PORT" \
    ${API_KEY:+--api-key "$API_KEY"} \
    --question "What is 2 + 2? Reply with just the number." \
    --json 2>&1) || true

  if echo "$SIMPLE_RESPONSE" | jq -e '.success == true' &>/dev/null; then
    pass "Simple question answered successfully"
    ANSWER=$(echo "$SIMPLE_RESPONSE" | jq -r '.answer')
    echo "  Answer: ${ANSWER:0:100}..."
  else
    fail "Simple question failed"
    echo "  Response: $SIMPLE_RESPONSE"
  fi
  echo ""

  # Test 8: Question with context
  echo "--- Test 8: Question with Context ---"
  CONTEXT_RESPONSE=$("$CLIENT" \
    --host "$HOST" \
    --port "$PORT" \
    ${API_KEY:+--api-key "$API_KEY"} \
    --question "What language is this code written in? Reply with just the language name." \
    --context "console.log('hello world');" \
    --json 2>&1) || true

  if echo "$CONTEXT_RESPONSE" | jq -e '.success == true' &>/dev/null; then
    pass "Context question answered successfully"
    ANSWER=$(echo "$CONTEXT_RESPONSE" | jq -r '.answer')
    echo "  Answer: ${ANSWER:0:100}..."
  else
    fail "Context question failed"
  fi
  echo ""

  # Test 9: Session continuity
  echo "--- Test 9: Session Continuity ---"
  FIRST_RESPONSE=$("$CLIENT" \
    --host "$HOST" \
    --port "$PORT" \
    ${API_KEY:+--api-key "$API_KEY"} \
    --question "Remember the number 42. Just acknowledge with 'OK'." \
    --json 2>&1) || true

  if echo "$FIRST_RESPONSE" | jq -e '.success == true' &>/dev/null; then
    SESSION_ID=$(echo "$FIRST_RESPONSE" | jq -r '.session_id')
    echo "  Session ID: $SESSION_ID"

    SECOND_RESPONSE=$("$CLIENT" \
      --host "$HOST" \
      --port "$PORT" \
      ${API_KEY:+--api-key "$API_KEY"} \
      --session "$SESSION_ID" \
      --question "What number did I ask you to remember?" \
      --json 2>&1) || true

    if echo "$SECOND_RESPONSE" | jq -e '.success == true' &>/dev/null; then
      pass "Session continuity works"
      ANSWER=$(echo "$SECOND_RESPONSE" | jq -r '.answer')
      echo "  Follow-up answer: ${ANSWER:0:100}..."
    else
      fail "Session follow-up failed"
    fi
  else
    fail "Initial session question failed"
  fi

else
  warn "Claude Code CLI is not available - skipping live tests"
  echo "  Tests 7-9 require Claude Code to be installed and accessible"
fi

echo ""
echo "=== Test Summary ==="
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [[ $FAILED -gt 0 ]]; then
  exit 1
fi

exit 0
