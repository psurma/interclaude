# Ask Claude Skill

Ask questions to remote Claude Code instances by name using the InterClaude registry.

## Registry

Instances are defined in `~/.claude/interclaude-registry.json`:

```json
{
  "instances": {
    "local": {"host": "localhost", "port": 3301, "description": "Local instance"},
    "sdk-developer": {"host": "192.168.1.10", "port": 3301, "description": "SDK expert"},
    "frontend-dev": {"host": "192.168.1.11", "port": 3301, "description": "React/Vue specialist"},
    "backend-dev": {"host": "192.168.1.12", "port": 3301, "description": "Node.js/API expert"}
  },
  "default": "local"
}
```

## Usage

### List available instances:
```bash
/Users/pete/vibe/interclaude/client/ask-instance.sh --list
```

### Discover which instances are online:
```bash
/Users/pete/vibe/interclaude/client/ask-instance.sh --discover
```

### Ask a named instance:
```bash
# Ask the local instance
/Users/pete/vibe/interclaude/client/ask-instance.sh local "What is React?"

# Ask the SDK developer
/Users/pete/vibe/interclaude/client/ask-instance.sh sdk-developer "How do I authenticate with the SDK?"

# Ask the frontend developer
/Users/pete/vibe/interclaude/client/ask-instance.sh frontend-dev "Best practices for React state management?"

# Ask the backend developer
/Users/pete/vibe/interclaude/client/ask-instance.sh backend-dev "What parameters does POST /users accept?"
```

### Ask with context:
```bash
/Users/pete/vibe/interclaude/client/ask-instance.sh local "What does this do?" "const x = arr.map(i => i * 2)"
```

## Direct curl (without registry)

If you know the host/port directly:

```bash
curl -s -X POST http://HOST:PORT/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "YOUR QUESTION"}' | jq -r '.answer'
```

## Check instance health/persona:
```bash
curl -s http://HOST:PORT/health | jq '{name: .instance_name, persona: .persona}'
```
