# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2024-12-09

### Added

- Initial release of InterClaude
- Webhook server with POST /ask and GET /health endpoints
- Server-side persona configuration via CLAUDE_SYSTEM_PROMPT
- Instance naming via INSTANCE_NAME for mesh discovery
- API key authentication (optional - only enforced if configured)
- Claude Code headless invocation with timeout handling
- Session management for conversation continuity
- Concurrent request limiting (configurable, default 2)
- Request logging with Winston
- Bash client with retry logic and exponential backoff
- Node.js client alternative
- Example scripts for common use cases
- Integration test suite
- Multi-instance mesh deployment documentation
