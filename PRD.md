# Product Requirements Document

## Claude Code Inter-Instance Communication PoC

**Version:** 1.0  
**Date:** December 2024  
**Author:** Pete  
**Status:** Draft

---

## 1. Overview

### 1.1 Purpose

This document defines the requirements for a proof-of-concept (PoC) demonstrating bidirectional communication between two Claude Code instances running on separate machines over a network. The goal is to enable one Claude Code session to ask questions to another and receive responses automatically.

### 1.2 Background

When developing applications using Claude Code across multiple codebases (SDK, frontend, backend), developers often run separate Claude Code sessions to maintain isolated context windows. Currently, sharing information between sessions requires manual copy-paste. This PoC explores automated inter-instance communication.

### 1.3 Success Criteria

- Instance A can send a question to Instance B over HTTP
- Instance B receives the question, processes it, and sends a response
- Instance A receives and displays the response
- Round-trip communication completes without manual intervention
- Works across machines on the same network

---

## 2. Architecture

### 2.1 High-Level Design

```
┌─────────────────────┐         HTTP POST          ┌─────────────────────┐
│   Machine A         │ ────────────────────────▶  │   Machine B         │
│                     │                            │                     │
│  Claude Code        │         JSON Request       │  Claude Code        │
│  Instance 1         │    (question payload)      │  Instance 2         │
│  (Requester)        │                            │  (Responder)        │
│                     │ ◀────────────────────────  │                     │
│                     │         HTTP Response      │                     │
│                     │    (answer payload)        │                     │
└─────────────────────┘                            └─────────────────────┘
         │                                                   │
         │                                                   │
         ▼                                                   ▼
   ┌───────────┐                                      ┌───────────┐
   │ ask.sh    │                                      │ server.js │
   │ (client)  │                                      │ (webhook) │
   └───────────┘                                      └───────────┘
```

### 2.2 Components

| Component               | Location  | Purpose                                                             |
| ----------------------- | --------- | ------------------------------------------------------------------- |
| Webhook Server          | Machine B | Receives questions, invokes Claude Code headless, returns responses |
| Request Client          | Machine A | Sends questions to the webhook server                               |
| Claude Code (Responder) | Machine B | Processes questions in headless mode                                |
| Claude Code (Requester) | Machine A | Initiates questions and receives answers                            |

---

## 3. Functional Requirements

### 3.1 Webhook Server (Machine B)

**FR-1.1** The server SHALL listen for HTTP POST requests on a configurable port (default: 3001).

**FR-1.2** The server SHALL accept JSON payloads with the following structure:

```json
{
  "question": "string - the question to ask Claude Code",
  "context": "string - optional additional context",
  "session_id": "string - optional session ID for conversation continuity"
}
```

**FR-1.3** Upon receiving a valid request, the server SHALL:

1. Extract the question from the payload
2. Invoke Claude Code in headless mode with the question
3. Capture the response from Claude Code
4. Return the response as JSON

**FR-1.4** The server SHALL return responses with the following structure:

```json
{
  "success": true,
  "answer": "string - Claude Code's response",
  "session_id": "string - session ID for follow-up questions",
  "timestamp": "ISO 8601 timestamp",
  "duration_ms": "number - processing time"
}
```

**FR-1.5** The server SHALL handle errors gracefully and return appropriate error responses:

```json
{
  "success": false,
  "error": "string - error description",
  "timestamp": "ISO 8601 timestamp"
}
```

### 3.2 Request Client (Machine A)

**FR-2.1** The client SHALL be executable from the command line or from within Claude Code via bash.

**FR-2.2** The client SHALL accept the following parameters:

- `--host` or `-h`: Target server hostname/IP (required)
- `--port` or `-p`: Target server port (default: 3001)
- `--question` or `-q`: The question to send (required)
- `--context` or `-c`: Optional context string
- `--session` or `-s`: Optional session ID for conversation continuity

**FR-2.3** The client SHALL display the response in a readable format.

**FR-2.4** The client SHALL support piping output for integration with other tools.

### 3.3 Integration with Claude Code

**FR-3.1** Both components SHALL be invokable from within an active Claude Code session.

**FR-3.2** The system SHALL support Claude Code's `--output-format json` for structured responses.

**FR-3.3** The system SHALL use Claude Code's `--allowedTools` to restrict capabilities on the responder side if needed.

---

## 4. Non-Functional Requirements

### 4.1 Performance

**NFR-1.1** The webhook server SHALL respond within 60 seconds for typical questions.

**NFR-1.2** The server SHALL handle concurrent requests (minimum 2 simultaneous).

### 4.2 Security (PoC Scope)

**NFR-2.1** The server SHALL support a simple API key authentication via header.

**NFR-2.2** The server SHALL validate incoming JSON payloads.

**NFR-2.3** For PoC purposes, HTTPS is optional but recommended for production use.

### 4.3 Reliability

**NFR-3.1** The client SHALL retry failed requests up to 3 times with exponential backoff.

**NFR-3.2** The server SHALL log all requests and responses for debugging.

---

## 5. Technical Specification

### 5.1 Technology Stack

| Component          | Technology           | Rationale                                           |
| ------------------ | -------------------- | --------------------------------------------------- |
| Webhook Server     | Node.js with Express | Lightweight, widely available, easy to deploy       |
| Request Client     | Bash with curl       | Available on all systems, no dependencies           |
| Data Format        | JSON                 | Standard, easy to parse, Claude Code native support |
| Process Management | Node child_process   | Direct Claude Code CLI invocation                   |

### 5.2 File Structure

```
claude-code-bridge/
├── README.md                 # Setup and usage instructions
├── package.json              # Node.js dependencies
├── .env.example              # Environment variable template
│
├── server/
│   ├── index.js              # Main webhook server
│   ├── claude-handler.js     # Claude Code invocation logic
│   └── middleware/
│       └── auth.js           # Simple API key authentication
│
├── client/
│   ├── ask.sh                # Bash client script
│   └── ask.js                # Optional Node.js client
│
├── examples/
│   ├── demo-question.sh      # Example: Send a simple question
│   ├── demo-context.sh       # Example: Send with context
│   └── demo-session.sh       # Example: Multi-turn conversation
│
└── test/
    ├── test-server.sh        # Server health check
    └── test-roundtrip.sh     # Full round-trip test
```

### 5.3 API Specification

#### POST /ask

**Endpoint:** `POST http://{host}:{port}/ask`

**Headers:**

```
Content-Type: application/json
X-API-Key: {api_key}
```

**Request Body:**

```json
{
  "question": "What is the purpose of the useEffect hook in React?",
  "context": "I'm working on a React application",
  "session_id": null
}
```

**Success Response (200):**

```json
{
  "success": true,
  "answer": "The useEffect hook in React is used for...",
  "session_id": "abc123-def456",
  "timestamp": "2024-12-09T10:30:00Z",
  "duration_ms": 2340
}
```

**Error Response (4xx/5xx):**

```json
{
  "success": false,
  "error": "Invalid API key",
  "timestamp": "2024-12-09T10:30:00Z"
}
```

#### GET /health

**Endpoint:** `GET http://{host}:{port}/health`

**Response (200):**

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "claude_code_available": true
}
```

---

## 6. Implementation Plan

### 6.1 Phase 1: Server Setup (Machine B)

1. Initialize Node.js project with Express
2. Implement `/health` endpoint
3. Implement `/ask` endpoint (mock response initially)
4. Add Claude Code headless invocation
5. Add basic API key authentication
6. Add request logging

### 6.2 Phase 2: Client Setup (Machine A)

1. Create bash client script with curl
2. Add command-line argument parsing
3. Add retry logic
4. Add response formatting

### 6.3 Phase 3: Integration Testing

1. Test server health endpoint
2. Test simple question/answer
3. Test with context
4. Test session continuity
5. Test error handling

### 6.4 Phase 4: Demo Scenarios

1. Simple factual question
2. Code-related question with context
3. Multi-turn conversation

---

## 7. Demo Scenarios

### 7.1 Scenario 1: Simple Question

**From Machine A (Instance 1):**

```bash
./client/ask.sh -h 192.168.1.100 -q "What is dependency injection?"
```

**Expected Output:**

```
✓ Response from Instance 2:

Dependency injection is a design pattern where an object receives
its dependencies from external sources rather than creating them
internally. This promotes loose coupling and makes code more
testable and maintainable...

[Session: abc123 | Duration: 1.2s]
```

### 7.2 Scenario 2: Context-Aware Question

**From Machine A (Instance 1):**

```bash
./client/ask.sh \
  -h 192.168.1.100 \
  -q "How should I structure the authentication module?" \
  -c "Working on a Node.js Express API with JWT tokens"
```

### 7.3 Scenario 3: Follow-up Question (Session Continuity)

**First question:**

```bash
RESPONSE=$(./client/ask.sh -h 192.168.1.100 -q "Explain React hooks" --json)
SESSION_ID=$(echo $RESPONSE | jq -r '.session_id')
```

**Follow-up:**

```bash
./client/ask.sh -h 192.168.1.100 -s $SESSION_ID -q "Now explain useState specifically"
```

---

## 8. Configuration

### 8.1 Server Configuration (.env)

```bash
# Server Settings
PORT=3001
HOST=0.0.0.0

# Authentication
API_KEY=your-secret-api-key-here

# Claude Code Settings
CLAUDE_CODE_PATH=claude
CLAUDE_CODE_TIMEOUT=60000
CLAUDE_CODE_ALLOWED_TOOLS=Read,Grep,WebSearch

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/server.log
```

### 8.2 Client Configuration

```bash
# Default server (can be overridden via CLI)
export CLAUDE_BRIDGE_HOST=192.168.1.100
export CLAUDE_BRIDGE_PORT=3001
export CLAUDE_BRIDGE_API_KEY=your-secret-api-key-here
```

---

## 9. Testing

### 9.1 Unit Tests

- Server endpoint validation
- Request payload parsing
- Response formatting
- Error handling

### 9.2 Integration Tests

| Test Case | Description        | Expected Result       |
| --------- | ------------------ | --------------------- |
| TC-01     | Health check       | 200 OK with status    |
| TC-02     | Simple question    | Valid answer returned |
| TC-03     | Missing API key    | 401 Unauthorized      |
| TC-04     | Invalid JSON       | 400 Bad Request       |
| TC-05     | Timeout handling   | 504 Gateway Timeout   |
| TC-06     | Session continuity | Same session_id works |

### 9.3 End-to-End Test Script

```bash
#!/bin/bash
# test/test-roundtrip.sh

echo "Testing Claude Code Bridge..."

# Test 1: Health check
echo "1. Health check..."
curl -s http://$HOST:$PORT/health | jq .

# Test 2: Simple question
echo "2. Simple question..."
./client/ask.sh -h $HOST -q "What is 2+2?"

# Test 3: Context question
echo "3. Context question..."
./client/ask.sh -h $HOST -q "Best practices?" -c "Node.js API development"

echo "All tests completed!"
```

---

## 10. Future Enhancements (Out of Scope for PoC)

- **Async Processing**: Queue-based architecture for long-running questions
- **WebSocket Support**: Real-time streaming responses
- **Multi-Instance Mesh**: More than 2 instances communicating
- **Shared Context**: Common context file synchronization
- **Authentication**: OAuth2 or mTLS for production security
- **Observability**: Metrics, distributed tracing
- **Rate Limiting**: Prevent abuse in shared environments

---

## 11. Appendix

### A. Claude Code Headless Mode Reference

```bash
# Basic headless invocation
claude -p "Your question here" --output-format json

# With allowed tools
claude -p "Question" --allowedTools "Read,Grep"

# Session resume
claude --resume $SESSION_ID -p "Follow-up question" --output-format json
```

### B. Example Server Implementation (Pseudocode)

```javascript
// server/index.js
const express = require("express");
const { spawn } = require("child_process");

const app = express();
app.use(express.json());

app.post("/ask", authenticate, async (req, res) => {
  const { question, context, session_id } = req.body;

  const prompt = context ? `Context: ${context}\n\nQuestion: ${question}` : question;

  const args = ["-p", prompt, "--output-format", "json"];
  if (session_id) args.unshift("--resume", session_id);

  const result = await invokeClaudeCode(args);

  res.json({
    success: true,
    answer: result.response,
    session_id: result.session_id,
    timestamp: new Date().toISOString(),
    duration_ms: result.duration,
  });
});
```

### C. Example Client Implementation (Bash)

```bash
#!/bin/bash
# client/ask.sh

HOST="${CLAUDE_BRIDGE_HOST:-localhost}"
PORT="${CLAUDE_BRIDGE_PORT:-3001}"
API_KEY="${CLAUDE_BRIDGE_API_KEY}"

while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--host) HOST="$2"; shift 2 ;;
    -p|--port) PORT="$2"; shift 2 ;;
    -q|--question) QUESTION="$2"; shift 2 ;;
    -c|--context) CONTEXT="$2"; shift 2 ;;
    -s|--session) SESSION="$2"; shift 2 ;;
    *) shift ;;
  esac
done

PAYLOAD=$(jq -n \
  --arg q "$QUESTION" \
  --arg c "$CONTEXT" \
  --arg s "$SESSION" \
  '{question: $q, context: $c, session_id: $s}')

curl -s -X POST "http://${HOST}:${PORT}/ask" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${API_KEY}" \
  -d "$PAYLOAD" | jq .
```

---

## 12. Glossary

| Term          | Definition                                           |
| ------------- | ---------------------------------------------------- |
| Headless Mode | Running Claude Code non-interactively with `-p` flag |
| Instance      | A single running Claude Code session                 |
| Requester     | The Claude Code instance initiating a question       |
| Responder     | The Claude Code instance answering questions         |
| Session ID    | Unique identifier for conversation continuity        |
| Webhook       | HTTP endpoint that receives and processes requests   |

---

_End of Document_
