# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.6] - 2024-12-09

### Added

- `CLAUDE_MODEL` environment variable to specify model (opus, sonnet, haiku, or model ID)
- Fixes issue where remote instances default to wrong model

## [0.0.5] - 2024-12-09

### Added

- Display all network interface IP addresses on server startup
- Easier to find the correct IP for registry configuration

## [0.0.4] - 2024-12-09

### Added

- Instance registry system (`~/.claude/interclaude-registry.json`)
- `ask-instance.sh` client for querying instances by name
- `--list` flag to show registered instances
- `--discover` flag to check which instances are online
- Updated skill documentation for registry usage

## [0.0.3] - 2024-12-09

### Added

- Claude Code skill for asking remote instances (`.claude/skills/ask-claude.md`)
- CLAUDE.md with usage instructions for Claude Code integration
- Support for named remote instances via environment variables

## [0.0.2] - 2024-12-09

### Fixed

- Fixed Claude Code hanging by closing stdin immediately after spawn
- Added `--print` flag (was incorrectly using `-p`)
- Added `--dangerously-skip-permissions` for headless operation
- Set working directory to `/tmp` to avoid project-specific hooks

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
