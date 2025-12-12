# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InterClaude enables multiple Claude Code instances to communicate over HTTP. Each instance can be configured with a persona (SDK Developer, Frontend Developer, etc.), allowing specialized Claude agents to collaborate across machines.

## Commands

```bash
# Start the webhook server
npm start

# Start with auto-reload (development)
npm run dev

# Start the web UI (browser interface)
npm run web

# Run integration tests
npm test
```

## Architecture

### Three Entry Points

1. **server/index.js** - Main webhook server (Express on port 3001)
   - `POST /ask` - Send questions to Claude
   - `GET /health` - Instance status and capabilities
   - `GET /memory/*` - Memory system endpoints

2. **web/server.js** - Web UI server (Express on port 3000)
   - Serves `web/index.html` - Single-page app for interacting with instances
   - Reads instance registry from `~/.claude/interclaude-registry.json`

3. **client/ask.sh** and **client/ask.js** - CLI clients for querying instances

### Server Components

```
server/
├── index.js           # Express app, routes, startup
├── config.js          # Environment loading (dotenv)
├── claude-handler.js  # Spawns Claude CLI in headless mode
├── package-context.js # Monorepo package detection and CLAUDE.md loading
├── middleware/auth.js # API key authentication
└── memory/            # Conversation memory system
    ├── index.js       # Memory orchestrator
    ├── storage.js     # Markdown file I/O
    ├── indexer.js     # Keyword extraction
    └── retriever.js   # Context retrieval
```

### Key Data Flow

1. Request to `/ask` with question
2. Package context loader detects mentioned packages and loads their CLAUDE.md files
3. `claude-handler.js` spawns `claude --print` with system prompt + context
4. Response returned with session_id for conversation continuity
5. If memory enabled, conversation saved as markdown in `memory/{instance}/`

### Package Context (Monorepo Support)

For large codebases, instances can automatically detect and load relevant package documentation:

1. Set `CLAUDE_WORKING_DIR` to your monorepo root
2. Create CLAUDE.md files in packages that need documentation
3. When questions mention package names, their CLAUDE.md is automatically injected

Supported structures: `packages/`, `apps/`, `libs/`, `services/`, `modules/`

Example: "How do announcements work?" will load `packages/announcements/CLAUDE.md`

### Instance Registry

Instances are registered in `~/.claude/interclaude-registry.json`:

```json
{
  "instances": {
    "sdk-developer": { "host": "192.168.1.10", "port": 3001 }
  }
}
```

## Configuration

Key environment variables in `.env`:

- `INSTANCE_NAME` - Identity for mesh discovery
- `CLAUDE_SYSTEM_PROMPT` - Persona/expertise for this instance
- `CLAUDE_MODEL` - Model selection (opus, sonnet, haiku)
- `CLAUDE_WORKING_DIR` - Working directory for codebase-aware responses
- `MEMORY_ENABLED` - Enable conversation memory system
- `PACKAGE_CONTEXT_ENABLED` - Enable automatic package CLAUDE.md loading (default: true)

## Ask Remote Claude Instances

```bash
curl -s -X POST "http://HOST:PORT/ask" \
  -H "Content-Type: application/json" \
  -d '{"question": "YOUR QUESTION"}' | jq -r '.answer'
```

Check instance identity:

```bash
curl -s "http://HOST:PORT/health" | jq '{name: .instance_name, persona: .persona}'
```
