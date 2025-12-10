# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.17] - 2024-12-10

### Added

- Collapsible responses (long messages start collapsed with "Show more" button)
- Collapse all / Expand all buttons in conversation header
- Chat bubble style layout (user messages right-aligned, responses left-aligned)

## [0.0.16] - 2024-12-10

### Added

- API keys can be configured in registry file (`~/.claude/interclaude-registry.json`)
- "from config" badge shows when API key comes from config file

## [0.0.15] - 2024-12-10

### Added

- API key support in Web UI (per-instance, saved to localStorage)
- Toggle visibility button for API key input

## [0.0.14] - 2024-12-10

### Added

- Conversation persistence per instance (saved to localStorage)
- Clear conversation button with trash icon
- Human-readable duration format (e.g., "1m 30s" instead of "89821ms")
- Resizable input panel (drag handle at top)
- Log actual question and answer in server logs (first 500 chars)

### Fixed

- Send button no longer stretches when resizing input panel

## [0.0.13] - 2024-12-10

### Added

- Display version number in server startup log

## [0.0.12] - 2024-12-10

### Added

- CORS support for cross-origin requests from Web UI to remote instances

## [0.0.11] - 2024-12-10

### Added

- Light/dark mode toggle for Web UI
- Theme preference persisted in localStorage
- Sun/moon icons for theme toggle button

## [0.0.10] - 2024-12-10

### Added

- Web UI (`npm run web`) - browser-based interface at http://localhost:3000
- Markdown rendering with syntax highlighting for responses
- Copy to clipboard button for responses
- Real-time request timer
- Dark theme with modern design

## [0.0.9] - 2024-12-10

### Added

- `--env` / `-e` flag to specify custom environment file
- Run multiple instances from single install: `node server/index.js --env .env.frontend`
- Example env files for frontend and backend instances

## [0.0.8] - 2024-12-09

### Fixed

- `.env` file now loads correctly regardless of working directory
- Uses absolute path to project root for dotenv configuration

## [0.0.7] - 2024-12-09

### Added

- `CLAUDE_WORKING_DIR` environment variable to set Claude's working directory
- Enables codebase-aware responses from remote instances

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
