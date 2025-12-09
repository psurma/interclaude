#!/bin/bash
# InterClaude Client - Send questions to a Claude Code instance
#
# Usage:
#   ./ask.sh -h HOST -q "Your question" [-p PORT] [-c "context"] [-s SESSION_ID] [--json]
#
# Environment variables:
#   CLAUDE_BRIDGE_HOST     - Default host (default: localhost)
#   CLAUDE_BRIDGE_PORT     - Default port (default: 3001)
#   CLAUDE_BRIDGE_API_KEY  - API key for authentication

set -e

# Defaults from environment
HOST="${CLAUDE_BRIDGE_HOST:-localhost}"
PORT="${CLAUDE_BRIDGE_PORT:-3001}"
API_KEY="${CLAUDE_BRIDGE_API_KEY:-}"
QUESTION=""
CONTEXT=""
SESSION=""
JSON_OUTPUT=false
MAX_RETRIES=3
TIMEOUT=120

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--host)
      HOST="$2"
      shift 2
      ;;
    -p|--port)
      PORT="$2"
      shift 2
      ;;
    -q|--question)
      QUESTION="$2"
      shift 2
      ;;
    -c|--context)
      CONTEXT="$2"
      shift 2
      ;;
    -s|--session)
      SESSION="$2"
      shift 2
      ;;
    --json)
      JSON_OUTPUT=true
      shift
      ;;
    --api-key)
      API_KEY="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    --help)
      echo "InterClaude Client - Send questions to a Claude Code instance"
      echo ""
      echo "Usage: $0 -q QUESTION [OPTIONS]"
      echo ""
      echo "Required:"
      echo "  -q, --question    The question to ask"
      echo ""
      echo "Options:"
      echo "  -h, --host        Target host (default: localhost or CLAUDE_BRIDGE_HOST)"
      echo "  -p, --port        Target port (default: 3001 or CLAUDE_BRIDGE_PORT)"
      echo "  -c, --context     Additional context for the question"
      echo "  -s, --session     Session ID for conversation continuity"
      echo "  --api-key         API key for authentication"
      echo "  --json            Output raw JSON response"
      echo "  --timeout         Request timeout in seconds (default: 120)"
      echo "  --help            Show this help message"
      echo ""
      echo "Environment Variables:"
      echo "  CLAUDE_BRIDGE_HOST     Default host"
      echo "  CLAUDE_BRIDGE_PORT     Default port"
      echo "  CLAUDE_BRIDGE_API_KEY  API key"
      echo ""
      echo "Examples:"
      echo "  $0 -h 192.168.1.100 -q \"What is dependency injection?\""
      echo "  $0 -q \"How do I use the auth module?\" -c \"Node.js SDK v2.0\""
      echo "  $0 -q \"Follow up question\" -s abc123-session-id"
      exit 0
      ;;
    *)
      echo -e "${RED}Error: Unknown option: $1${NC}" >&2
      echo "Use --help for usage information" >&2
      exit 1
      ;;
  esac
done

# Validation
if [[ -z "$QUESTION" ]]; then
  echo -e "${RED}Error: Question is required (-q)${NC}" >&2
  echo "Use --help for usage information" >&2
  exit 1
fi

# Check for jq
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is required but not installed${NC}" >&2
  echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)" >&2
  exit 1
fi

# Build JSON payload
PAYLOAD=$(jq -n \
  --arg q "$QUESTION" \
  --arg c "$CONTEXT" \
  --arg s "$SESSION" \
  '{question: $q} + (if $c != "" then {context: $c} else {} end) + (if $s != "" then {session_id: $s} else {} end)')

# Build curl headers
HEADERS=(-H "Content-Type: application/json")
if [[ -n "$API_KEY" ]]; then
  HEADERS+=(-H "X-API-Key: $API_KEY")
fi

# Retry logic with exponential backoff
attempt=0
while [[ $attempt -lt $MAX_RETRIES ]]; do
  attempt=$((attempt + 1))

  # Make request
  HTTP_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST "http://${HOST}:${PORT}/ask" \
    "${HEADERS[@]}" \
    -d "$PAYLOAD" \
    --connect-timeout 10 \
    --max-time "$TIMEOUT" \
    2>&1) || {
      if [[ $attempt -lt $MAX_RETRIES ]]; then
        sleep_time=$((2 ** attempt))
        echo -e "${YELLOW}Connection failed, retrying in ${sleep_time}s (attempt $attempt/$MAX_RETRIES)...${NC}" >&2
        sleep $sleep_time
        continue
      fi
      echo -e "${RED}Error: Failed to connect after $MAX_RETRIES attempts${NC}" >&2
      exit 1
    }

  # Extract HTTP status and body
  HTTP_STATUS=$(echo "$HTTP_RESPONSE" | grep "HTTP_STATUS:" | cut -d':' -f2)
  BODY=$(echo "$HTTP_RESPONSE" | sed '/HTTP_STATUS:/d')

  # Check for retryable errors (5xx)
  if [[ "$HTTP_STATUS" =~ ^5[0-9][0-9]$ ]] && [[ $attempt -lt $MAX_RETRIES ]]; then
    sleep_time=$((2 ** attempt))
    echo -e "${YELLOW}Server error ($HTTP_STATUS), retrying in ${sleep_time}s (attempt $attempt/$MAX_RETRIES)...${NC}" >&2
    sleep $sleep_time
    continue
  fi

  break
done

# Output
if [[ "$JSON_OUTPUT" == true ]]; then
  echo "$BODY"
else
  # Check if response is valid JSON
  if ! echo "$BODY" | jq . &>/dev/null; then
    echo -e "${RED}Error: Invalid response from server${NC}" >&2
    echo "$BODY" >&2
    exit 1
  fi

  SUCCESS=$(echo "$BODY" | jq -r '.success // false')

  if [[ "$SUCCESS" == "true" ]]; then
    ANSWER=$(echo "$BODY" | jq -r '.answer')
    SESSION_ID=$(echo "$BODY" | jq -r '.session_id')
    INSTANCE=$(echo "$BODY" | jq -r '.instance_name // "unknown"')
    DURATION=$(echo "$BODY" | jq -r '.duration_ms')

    echo -e "${GREEN}Response from ${INSTANCE}:${NC}"
    echo "----------------------------------------"
    echo "$ANSWER"
    echo "----------------------------------------"
    echo -e "[Session: ${SESSION_ID} | Duration: ${DURATION}ms]"
  else
    ERROR=$(echo "$BODY" | jq -r '.error // "Unknown error"')
    echo -e "${RED}Error: $ERROR${NC}" >&2
    exit 1
  fi
fi
