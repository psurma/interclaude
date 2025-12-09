#!/bin/bash
# Ask a named Claude instance from the registry
#
# Usage:
#   ./ask-instance.sh <instance-name> "Your question"
#   ./ask-instance.sh --list
#   ./ask-instance.sh --discover
#
# Examples:
#   ./ask-instance.sh local "What is React?"
#   ./ask-instance.sh sdk-developer "How do I authenticate?"
#   ./ask-instance.sh frontend-dev "Best practices for state management?"

set -e

REGISTRY="${INTERCLAUDE_REGISTRY:-$HOME/.claude/interclaude-registry.json}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Check for jq
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is required but not installed${NC}" >&2
  exit 1
fi

# Check registry exists
if [[ ! -f "$REGISTRY" ]]; then
  echo -e "${RED}Error: Registry not found at $REGISTRY${NC}" >&2
  echo "Create one with instance definitions or set INTERCLAUDE_REGISTRY env var" >&2
  exit 1
fi

# List instances
list_instances() {
  echo -e "${CYAN}Available Claude instances:${NC}"
  echo ""
  jq -r '.instances | to_entries[] | "  \(.key): \(.value.description) (\(.value.host):\(.value.port))"' "$REGISTRY"
  echo ""
  DEFAULT=$(jq -r '.default // "none"' "$REGISTRY")
  echo -e "Default: ${GREEN}$DEFAULT${NC}"
}

# Discover instances (check which are online)
discover_instances() {
  echo -e "${CYAN}Discovering Claude instances...${NC}"
  echo ""

  for name in $(jq -r '.instances | keys[]' "$REGISTRY"); do
    HOST=$(jq -r ".instances[\"$name\"].host" "$REGISTRY")
    PORT=$(jq -r ".instances[\"$name\"].port" "$REGISTRY")
    DESC=$(jq -r ".instances[\"$name\"].description" "$REGISTRY")

    HEALTH=$(curl -s --connect-timeout 2 "http://${HOST}:${PORT}/health" 2>/dev/null) || HEALTH=""

    if [[ -n "$HEALTH" ]]; then
      STATUS="${GREEN}ONLINE${NC}"
      INSTANCE_NAME=$(echo "$HEALTH" | jq -r '.instance_name // "unknown"')
      PERSONA=$(echo "$HEALTH" | jq -r '.persona // ""' | head -c 50)
      echo -e "  ${GREEN}$name${NC} ($HOST:$PORT) - $STATUS"
      echo -e "    Instance: $INSTANCE_NAME"
      if [[ -n "$PERSONA" ]]; then
        echo -e "    Persona: ${PERSONA}..."
      fi
    else
      STATUS="${RED}OFFLINE${NC}"
      echo -e "  ${YELLOW}$name${NC} ($HOST:$PORT) - $STATUS"
    fi
    echo ""
  done
}

# Ask an instance
ask_instance() {
  local INSTANCE="$1"
  local QUESTION="$2"
  local CONTEXT="$3"

  # Get instance config
  HOST=$(jq -r ".instances[\"$INSTANCE\"].host // empty" "$REGISTRY")
  PORT=$(jq -r ".instances[\"$INSTANCE\"].port // empty" "$REGISTRY")

  if [[ -z "$HOST" || -z "$PORT" ]]; then
    echo -e "${RED}Error: Instance '$INSTANCE' not found in registry${NC}" >&2
    echo "Use --list to see available instances" >&2
    exit 1
  fi

  # Build payload
  if [[ -n "$CONTEXT" ]]; then
    PAYLOAD=$(jq -n --arg q "$QUESTION" --arg c "$CONTEXT" '{question: $q, context: $c}')
  else
    PAYLOAD=$(jq -n --arg q "$QUESTION" '{question: $q}')
  fi

  # Make request
  echo -e "${CYAN}Asking ${GREEN}$INSTANCE${CYAN} ($HOST:$PORT)...${NC}" >&2

  RESPONSE=$(curl -s -X POST "http://${HOST}:${PORT}/ask" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    --connect-timeout 5 \
    --max-time 120) || {
      echo -e "${RED}Error: Could not connect to $INSTANCE${NC}" >&2
      exit 1
    }

  SUCCESS=$(echo "$RESPONSE" | jq -r '.success // false')

  if [[ "$SUCCESS" == "true" ]]; then
    ANSWER=$(echo "$RESPONSE" | jq -r '.answer')
    INSTANCE_NAME=$(echo "$RESPONSE" | jq -r '.instance_name // "unknown"')
    DURATION=$(echo "$RESPONSE" | jq -r '.duration_ms // 0')

    echo ""
    echo -e "${GREEN}Response from $INSTANCE_NAME:${NC}"
    echo "----------------------------------------"
    echo "$ANSWER"
    echo "----------------------------------------"
    echo -e "[Duration: ${DURATION}ms]"
  else
    ERROR=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"')
    echo -e "${RED}Error: $ERROR${NC}" >&2
    exit 1
  fi
}

# Parse arguments
case "${1:-}" in
  --list|-l)
    list_instances
    ;;
  --discover|-d)
    discover_instances
    ;;
  --help|-h)
    echo "Usage: $0 <instance-name> \"Your question\" [\"Optional context\"]"
    echo "       $0 --list        List registered instances"
    echo "       $0 --discover    Check which instances are online"
    echo ""
    echo "Examples:"
    echo "  $0 local \"What is React?\""
    echo "  $0 sdk-developer \"How do I authenticate?\" \"Using JWT tokens\""
    ;;
  "")
    echo -e "${RED}Error: Instance name required${NC}" >&2
    echo "Use --list to see available instances, or --help for usage" >&2
    exit 1
    ;;
  *)
    if [[ -z "${2:-}" ]]; then
      echo -e "${RED}Error: Question required${NC}" >&2
      echo "Usage: $0 <instance-name> \"Your question\"" >&2
      exit 1
    fi
    ask_instance "$1" "$2" "${3:-}"
    ;;
esac
