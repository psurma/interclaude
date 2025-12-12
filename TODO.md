# InterClaude TODO

Future feature ideas for InterClaude.

## Communication & Collaboration

- [ ] **Broadcast/Multicast** - Send a question to multiple instances simultaneously and aggregate responses
- [ ] **Instance Chaining** - Route questions through a pipeline of specialized instances (e.g., architect → implementer → reviewer)
- [ ] **Pub/Sub Topics** - Instances subscribe to topics and receive relevant messages automatically

## Orchestration

- [ ] **Task Delegation** - An orchestrator instance that breaks down complex tasks and assigns subtasks to specialists
- [ ] **Consensus Mode** - Multiple instances vote/discuss before returning a final answer
- [ ] **Workflow Templates** - Predefined multi-instance workflows for common patterns (code review, design discussions)

## Memory & Context

- [ ] **Shared Memory** - Cross-instance memory store so instances can share context
- [ ] **Project Context Sync** - Automatically sync relevant codebase context across instances
- [ ] **Conversation Replay** - Resume or branch from any point in conversation history

## Monitoring & DevEx

- [ ] **Web Dashboard Enhancements**
  - Real-time instance status/activity
  - Conversation visualization
  - Network topology view
- [ ] **Streaming Responses** - SSE/WebSocket for real-time output instead of waiting for full response
- [ ] **Rate Limiting & Queuing** - Handle concurrent requests gracefully with a job queue

## Security & Operations

- [ ] **Instance Authentication** - Instances authenticate with each other (not just API keys)
- [ ] **Audit Log** - Track all inter-instance communications
- [ ] **Health Checks with Auto-Recovery** - Restart unhealthy instances
