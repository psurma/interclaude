# Multi-Profile Support for InterClaude

## Summary
Enable a single InterClaude server to handle multiple profiles (frontend, backend, etc.) with isolated configuration and memory per profile.

## User Choices
- **Profile selection**: URL path parameter (POST /ask/:profile)
- **Config storage**: Profiles directory (profiles/frontend.env, profiles/backend.env)
- **Memory**: Completely isolated per profile

---

## Implementation Plan

### Phase 1: Profile Loader

**Create `server/profile-loader.js`**
- Scan `profiles/` directory for `*.env` files at startup
- Parse each file using `dotenv.parse()` (not `config()`)
- Store in `Map<profileName, profileConfig>`
- If no profiles/ dir exists, create "default" profile from root `.env`

**Profile config structure:**
```javascript
{
  name: "frontend",
  instanceName: "frontend-dev",
  systemPrompt: "You are a frontend...",
  workingDir: "/path/to/frontend",
  model: "opus",
  timeout: 180000,
  allowedTools: "Read,Grep,Glob",
  memoryEnabled: true,
  memoryStoragePath: "./memory",
  memoryMaxContextItems: 3,
  memoryMaxContextTokens: 2000,
  packageContextEnabled: true
}
```

---

### Phase 2: Refactor claude-handler.js

**Modify `invokeClaudeCode()` signature:**
```javascript
// Before: invokeClaudeCode(question, context, sessionId)
// After:  invokeClaudeCode(question, context, sessionId, profileConfig = null)
```

- If `profileConfig` is null, fall back to env vars (backwards compatible)
- Use `profileConfig.workingDir` in spawn() call instead of module constant
- Same pattern for systemPrompt, model, timeout, allowedTools

---

### Phase 3: Refactor package-context.js

**Add workingDir parameter:**
```javascript
// Before: discoverPackages()
// After:  discoverPackages(workingDir = null)

// Before: buildPackageContext(question)
// After:  buildPackageContext(question, workingDir = null)
```

Falls back to env var if null (backwards compatible).

---

### Phase 4: Memory System - Factory Pattern

**Create `server/memory/profile-memory.js`**
- `profileMemoryManagers = new Map()`
- `initializeMemoryForProfile(profileName, profile)` - creates isolated manager
- `getMemoryManagerForProfile(profileName)` - retrieves manager

**Refactor `server/memory/index.js`**
- Convert module-level state to class or factory
- Each profile gets isolated `indexCache`, `config`
- Directory structure: `./memory/{profileName}/conversations/`

---

### Phase 5: Route Updates

**Add middleware `resolveProfile`:**
```javascript
function resolveProfile(req, res, next) {
  const profileName = req.params.profile || 'default';
  const profile = profileRegistry.get(profileName);
  if (!profile) return res.status(404).json({ error: `Profile '${profileName}' not found` });
  req.profile = profile;
  next();
}
```

**New routes:**
| Endpoint | Description |
|----------|-------------|
| `POST /ask` | Default profile (backwards compatible) |
| `POST /ask/:profile` | Ask specific profile |
| `GET /health` | Server health + all profiles summary |
| `GET /health/:profile` | Specific profile health |
| `GET /packages/:profile` | Packages for specific profile |
| `GET /memory/stats/:profile` | Memory stats for profile |
| `GET /memory/search/:profile?q=` | Search memory for profile |
| `GET /memory/recent/:profile` | Recent conversations for profile |

---

### Phase 6: Update /health responses

**`GET /health` (summary):**
```json
{
  "status": "healthy",
  "profiles": [
    { "name": "frontend", "working_dir": "/path/to/frontend", "memory_enabled": true },
    { "name": "backend", "working_dir": "/path/to/backend", "memory_enabled": true }
  ],
  "total_profiles": 2
}
```

**`GET /health/:profile` (detailed):**
- Same as current /health but for specific profile
- Shows working_dir, packages_discovered, memory_stats, etc.

---

## Files to Modify

| File | Changes |
|------|---------|
| `server/profile-loader.js` | **NEW** - Profile discovery and loading |
| `server/memory/profile-memory.js` | **NEW** - Multi-profile memory factory |
| `server/index.js` | Add profile routes, resolveProfile middleware, startup init |
| `server/claude-handler.js` | Accept profileConfig parameter, use in spawn() |
| `server/package-context.js` | Accept workingDir parameter |
| `server/memory/index.js` | Refactor to factory/class pattern |

---

## Example Profile File

`profiles/frontend.env`:
```env
INSTANCE_NAME=frontend-dev
CLAUDE_SYSTEM_PROMPT=You are a frontend developer expert...
CLAUDE_WORKING_DIR=/Users/pete/projects/app/frontend
CLAUDE_MODEL=opus
MEMORY_ENABLED=true
PACKAGE_CONTEXT_ENABLED=true
```

---

## Backwards Compatibility

- No `profiles/` directory = single "default" profile from root `.env`
- `/ask` without profile = uses default
- All existing functionality preserved
