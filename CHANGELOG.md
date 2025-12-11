# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.49] - 2024-12-11

### Changed

- User messages now rendered with Markdown formatting (code blocks, links, etc.)
- User messages now show timestamp and relative time (e.g., "14:11:45 - 5 minutes ago")

## [0.0.48] - 2024-12-11

### Changed

- Log entries now prefixed with instance name (e.g., `[SDK-Developer] [info]:`)

## [0.0.47] - 2024-12-11

### Added

- Conversation memory system for persistent Q&A storage per instance
- Memory stores conversations as markdown files with frontmatter metadata
- Keyword extraction and topic classification for indexing
- Automatic context retrieval from past conversations
- Memory endpoints: GET /memory/stats, /memory/search?q=, /memory/recent, /memory/conversation/:id
- Environment variables: MEMORY_ENABLED, MEMORY_STORAGE_PATH, MEMORY_MAX_CONTEXT_ITEMS, MEMORY_MAX_CONTEXT_TOKENS
- /ask request supports `use_memory` and `save_to_memory` options
- /ask response includes `memory_context_used` and `memory_sources` fields
- /health endpoint now includes memory_enabled and memory_stats

## [0.0.46] - 2024-12-11

### Changed

- Response duration now human-readable (e.g., "26.7s" instead of "26725ms")
- Added relative time to responses (e.g., "15 minutes ago")
- Relative times auto-update every minute

## [0.0.45] - 2024-12-11

### Fixed

- Preserve line breaks in user messages (newlines now display as line breaks)

## [0.0.44] - 2024-12-11

### Fixed

- Fixed context toggle click handler (replaced label with div + explicit onclick)

## [0.0.43] - 2024-12-11

### Fixed

- Fixed context toggle click not working in input area (CSS positioning issue)

## [0.0.42] - 2024-12-11

### Changed

- Moved context toggle from conversation header to input area (below Send button)
- Smaller, more compact context toggle design in input area

## [0.0.41] - 2024-12-11

### Changed

- Context toggle is now per-instance (each instance can have its own context setting)
- Context settings persisted separately per instance in localStorage
- Toast messages now show instance name when toggling context

### Migration

- Old global context mode setting automatically removed on upgrade

## [0.0.40] - 2024-12-11

### Fixed

- Fixed layout so input pane stays visible at bottom (html/body overflow:hidden, height:100%)

## [0.0.39] - 2024-12-11

### Fixed

- Input pane now properly sticks to bottom of window

## [0.0.38] - 2024-12-11

### Added

- Visual divider in conversation when context mode is toggled on/off
- Dividers are persisted in conversation history

## [0.0.37] - 2024-12-11

### Added

- Context toggle in conversation header (enables conversation memory with instances)
- Session ID tracking for conversation continuity using Claude's --resume flag
- Context mode preference persisted in localStorage

### Fixed

- System prompt no longer truncated to 100 characters in health endpoint

## [0.0.36] - 2024-12-11

### Changed

- Responses now expanded by default (previously collapsed)

## [0.0.35] - 2024-12-11

### Added

- Selected instance persisted in localStorage (remembers last used instance)

## [0.0.34] - 2024-12-11

### Fixed

- Version badge now hidden if version API unavailable (requires web server restart)

## [0.0.33] - 2024-12-11

### Fixed

- System prompt scrolling improved with better word wrapping
- Instance details section now scrollable (max 50vh)
- Scrollbar thumb has minimum height for better visibility

## [0.0.32] - 2024-12-11

### Changed

- User chat bubbles now have blue background with white text

## [0.0.31] - 2024-12-11

### Removed

- "Sending to: instance" hint text below textarea (info now in placeholder)

## [0.0.30] - 2024-12-11

### Added

- Version number displayed in header next to InterClaude title
- API endpoint `/api/version` to serve version info

## [0.0.29] - 2024-12-11

### Changed

- Textarea placeholder now shows selected instance name (e.g., "Ask a question to sdk-developer...")
- Placeholder updates dynamically when switching instances or when instance status changes

## [0.0.28] - 2024-12-11

### Fixed

- System prompt scrollbar now always visible with styled scrollbar
- Increased max-height to 200px for better readability

## [0.0.27] - 2024-12-11

### Changed

- Collapse/expand toggle moved to vertical bar on left side of response messages
- Toggle now uses arrow icon with tooltip instead of text label

## [0.0.26] - 2024-12-11

### Added

- Instance count shown in sidebar header as online/total (e.g., "Instances (2/3)")

## [0.0.25] - 2024-12-11

### Changed

- Enter now sends the message (previously Cmd/Ctrl+Enter)
- Shift+Enter now creates a new line

## [0.0.24] - 2024-12-11

### Added

- Full system prompt displayed in sidebar with scrollable container
- "System Prompt" label for persona section

## [0.0.23] - 2024-12-11

### Removed

- API key input field from sidebar (API keys still work via config file)

## [0.0.22] - 2024-12-10

### Added

- Collapsed sidebar now shows status dots for each instance
- Hover tooltip on collapsed instances shows name and status

## [0.0.21] - 2024-12-10

### Fixed

- Textarea now properly expands to fill resizable input pane height
- Sidebar toggle button now visible (increased z-index, moved to fixed position)

## [0.0.20] - 2024-12-10

### Added

- Collapsible sidebar (click arrow button to collapse/expand)
- Sidebar state persisted in localStorage

## [0.0.19] - 2024-12-10

### Added

- Retry button on failed requests
- Send button now correctly re-enables after errors

### Fixed

- Send button staying disabled after failed requests

## [0.0.18] - 2024-12-10

### Added

- Parallel requests to multiple instances (can send questions to different instances simultaneously)
- Per-instance loading state with visual indicator in sidebar
- Loading badge shows which instances are processing requests

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
