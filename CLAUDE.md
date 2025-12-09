# InterClaude Project

This project enables multiple Claude Code instances to communicate over HTTP.

## Ask Remote Claude Instances

To ask a question to another Claude instance on the network, use:

```bash
curl -s -X POST "http://HOST:PORT/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "YOUR QUESTION"}' | jq -r '.answer'
```

### Examples:

```bash
# Local instance on port 3301
curl -s -X POST "http://localhost:3301/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I use the SDK?"}' | jq -r '.answer'

# Remote instance on another machine
curl -s -X POST "http://192.168.1.10:3301/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "What API endpoints are available?"}' | jq -r '.answer'
```

### Check instance identity:
```bash
curl -s "http://HOST:PORT/health" | jq '{name: .instance_name, persona: .persona}'
```

## Running the Server

```bash
npm start
```

Configure in `.env`:
- `PORT` - Server port (default: 3001)
- `INSTANCE_NAME` - Name for this instance
- `CLAUDE_SYSTEM_PROMPT` - Persona/expertise for this instance
