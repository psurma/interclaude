# InterClaude

Enable multiple Claude Code instances to communicate over HTTP. Each instance can be configured with a persona (SDK Developer, Frontend Developer, Backend Developer, etc.), allowing specialized Claude agents to collaborate across machines.

## Quick Start

### 1. Install Dependencies

```bash
cd interclaude
npm install
```

### 2. Configure the Server

```bash
cp .env.example .env
# Edit .env to set your instance name and persona
```

### 3. Start the Server

```bash
npm start
```

### 4. Send a Question (from another machine or terminal)

```bash
./client/ask.sh -h localhost -q "What is dependency injection?"
```

## Configuration

Edit `.env` to configure your instance:

```bash
# Identity
INSTANCE_NAME=sdk-developer
CLAUDE_SYSTEM_PROMPT="You are an SDK developer expert..."

# Server
PORT=3001
HOST=0.0.0.0

# Authentication (optional)
API_KEY=your-secret-key

# Claude Code settings
CLAUDE_CODE_TIMEOUT=60000
CLAUDE_CODE_ALLOWED_TOOLS=Read,Grep,Glob,WebSearch
```

## API Reference

### GET /health

Check server status and discover instance capabilities.

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "claude_code_available": true,
  "instance_name": "sdk-developer",
  "persona": "You are an SDK developer expert..."
}
```

### POST /ask

Send a question to the Claude instance.

```bash
curl -X POST http://localhost:3001/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I authenticate with the SDK?"}'
```

Request body:
```json
{
  "question": "Your question here",
  "context": "Optional context",
  "session_id": "Optional session ID for follow-ups"
}
```

Response:
```json
{
  "success": true,
  "answer": "The SDK authentication...",
  "session_id": "abc123-def456",
  "instance_name": "sdk-developer",
  "timestamp": "2024-12-09T10:30:00Z",
  "duration_ms": 2340
}
```

## Client Usage

### Bash Client

```bash
# Simple question
./client/ask.sh -h 192.168.1.100 -q "How do I use the auth module?"

# With context
./client/ask.sh -h 192.168.1.100 -q "Best practices?" -c "Node.js API development"

# With session for follow-up
./client/ask.sh -h 192.168.1.100 -q "Tell me more" -s abc123-session-id

# JSON output
./client/ask.sh -h 192.168.1.100 -q "Question" --json
```

### Node.js Client

```bash
node client/ask.js -h 192.168.1.100 -q "Your question"
```

### Environment Variables

```bash
export CLAUDE_BRIDGE_HOST=192.168.1.100
export CLAUDE_BRIDGE_PORT=3001
export CLAUDE_BRIDGE_API_KEY=your-api-key

# Now you can omit -h and -p
./client/ask.sh -q "Your question"
```

## Multi-Instance Mesh

Run specialized Claude instances on different machines:

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  Machine A          │     │  Machine B          │     │  Machine C          │
│  SDK Developer      │◄───►│  Frontend Dev       │◄───►│  Backend Dev        │
│  192.168.1.10:3001  │     │  192.168.1.11:3001  │     │  192.168.1.12:3001  │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
```

### Machine A - SDK Developer (.env)

```bash
INSTANCE_NAME=sdk-developer
CLAUDE_SYSTEM_PROMPT="You are an SDK developer expert. Answer questions about SDK architecture, API design patterns, authentication flows, and provide code examples. Be technical and precise."
PORT=3001
```

### Machine B - Frontend Developer (.env)

```bash
INSTANCE_NAME=frontend-developer
CLAUDE_SYSTEM_PROMPT="You are a frontend developer expert. Answer questions about React, Vue, UI/UX patterns, state management, and component design. Provide practical examples."
PORT=3001
```

### Machine C - Backend Developer (.env)

```bash
INSTANCE_NAME=backend-developer
CLAUDE_SYSTEM_PROMPT="You are a backend developer expert. Answer questions about API endpoints, database design, authentication, and server architecture. Include request/response formats."
PORT=3001
```

### Cross-Instance Queries

```bash
# Frontend dev asks SDK dev about authentication
./client/ask.sh -h 192.168.1.10 -q "How do I implement OAuth flow with the SDK?"

# Frontend dev asks Backend dev about API params
./client/ask.sh -h 192.168.1.12 -q "What parameters does POST /users accept?"

# SDK dev asks Backend dev about expected response format
./client/ask.sh -h 192.168.1.12 -q "What is the response schema for /api/auth/token?"
```

### Discover Available Instances

```bash
# Check each instance's identity and capabilities
curl http://192.168.1.10:3001/health | jq '{name: .instance_name, persona: .persona}'
curl http://192.168.1.11:3001/health | jq '{name: .instance_name, persona: .persona}'
curl http://192.168.1.12:3001/health | jq '{name: .instance_name, persona: .persona}'
```

## Testing

```bash
# Health check only
./test/test-server.sh

# Full integration test
./test/test-roundtrip.sh

# Or via npm
npm test
```

## Examples

```bash
# Simple question
./examples/demo-question.sh

# Question with context
./examples/demo-context.sh

# Multi-turn conversation with session
./examples/demo-session.sh
```

## Development

```bash
# Run with auto-reload
npm run dev
```

## Requirements

- Node.js 18+
- Claude Code CLI installed and accessible
- jq (for bash client)

## License

MIT
