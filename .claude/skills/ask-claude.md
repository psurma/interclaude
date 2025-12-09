# Ask Claude Skill

Ask questions to remote Claude Code instances running InterClaude servers.

## Configuration

Set these environment variables to configure default targets:

```bash
# Default instance
export CLAUDE_BRIDGE_HOST=localhost
export CLAUDE_BRIDGE_PORT=3301

# Named instances (optional)
export CLAUDE_SDK_HOST=192.168.1.10
export CLAUDE_SDK_PORT=3301
export CLAUDE_FRONTEND_HOST=192.168.1.11
export CLAUDE_FRONTEND_PORT=3301
export CLAUDE_BACKEND_HOST=192.168.1.12
export CLAUDE_BACKEND_PORT=3301
```

## Usage

To ask a question to a remote Claude instance, use the Bash tool with curl:

### Default instance:
```bash
curl -s -X POST "http://${CLAUDE_BRIDGE_HOST:-localhost}:${CLAUDE_BRIDGE_PORT:-3301}/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "YOUR QUESTION HERE"}' | jq -r '.answer'
```

### Named instances:
```bash
# Ask the SDK developer
curl -s -X POST "http://${CLAUDE_SDK_HOST}:${CLAUDE_SDK_PORT}/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I authenticate with the SDK?"}' | jq -r '.answer'

# Ask the Frontend developer
curl -s -X POST "http://${CLAUDE_FRONTEND_HOST}:${CLAUDE_FRONTEND_PORT}/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "How should I structure this React component?"}' | jq -r '.answer'

# Ask the Backend developer
curl -s -X POST "http://${CLAUDE_BACKEND_HOST}:${CLAUDE_BACKEND_PORT}/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "What parameters does the /users endpoint accept?"}' | jq -r '.answer'
```

### With context:
```bash
curl -s -X POST "http://${CLAUDE_BRIDGE_HOST:-localhost}:${CLAUDE_BRIDGE_PORT:-3301}/ask" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What does this code do?",
    "context": "function foo() { return bar.map(x => x * 2); }"
  }' | jq -r '.answer'
```

### With session continuity:
```bash
# First question - capture session ID
RESPONSE=$(curl -s -X POST "http://${CLAUDE_BRIDGE_HOST:-localhost}:${CLAUDE_BRIDGE_PORT:-3301}/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "Remember the number 42"}')
SESSION_ID=$(echo "$RESPONSE" | jq -r '.session_id')

# Follow-up question using session
curl -s -X POST "http://${CLAUDE_BRIDGE_HOST:-localhost}:${CLAUDE_BRIDGE_PORT:-3301}/ask" \
  -H "Content-Type: application/json" \
  -d "{\"question\": \"What number did I mention?\", \"session_id\": \"$SESSION_ID\"}" | jq -r '.answer'
```

### Check available instances:
```bash
# Check what instances are available and their personas
curl -s "http://${CLAUDE_BRIDGE_HOST:-localhost}:${CLAUDE_BRIDGE_PORT:-3301}/health" | jq '{name: .instance_name, persona: .persona}'
```

## Using the ask.sh client

Alternatively, use the provided client script:

```bash
# Local
/Users/pete/vibe/interclaude/client/ask.sh -p 3301 -q "Your question"

# Remote machine
/Users/pete/vibe/interclaude/client/ask.sh -h 192.168.1.10 -p 3301 -q "Your question"

# With context
/Users/pete/vibe/interclaude/client/ask.sh -h 192.168.1.10 -p 3301 -q "What is this?" -c "const x = 42;"
```
