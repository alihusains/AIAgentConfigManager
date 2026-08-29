# QA Pass — AIAgentConfigManager GUI

**Date:** 2026-08-29
**Scope:** Full API + GUI review of the `ai-config gui` dashboard (port 4321, isolated `AI_CONFIG_HOME`)
**Method:** Live HTTP requests against a running server with a temp config dir; source review of `gui-server.ts`, `core/index.ts`, `core/skills.ts`, `core/agent-catalog.ts`, `gui/src/api.ts`, `gui/src/store/index.ts`, and key React components.

---

## Executive Summary

The dashboard is functional for its core use cases (provider/MCP/skill CRUD, agent detection, tools listing, registry import/export). However, the QA pass uncovered **2 critical bugs**, **5 high-severity issues**, and several medium/low findings. The most impactful:

1. **Server-side state desync** — the running server's in-memory registry is not updated by direct file edits, and `deleteCustomAgent` cannot remove entries with percent-encoded IDs via the API.
2. **Path traversal in skill creation** — `POST /api/skills` with `name: "../escape"` creates a skill directory outside the library.
3. **No DELETE route for library skills** — there is no `DELETE /api/skills/:id` endpoint, so library skills can only be removed by manually deleting files.

---

## Critical

### C1 — Server in-memory registry desyncs from disk; `deleteCustomAgent` cannot remove percent-encoded IDs

**Symptom:** After creating a custom agent with id `../evil` via `POST /api/agents/custom`, the entry is stored in the server's in-memory `this.registry.customAgents` and in the on-disk `registry.json`. Directly editing the disk file to remove the entry does NOT update the in-memory copy. Subsequent `DELETE /api/agents/custom/..%2Fevil` returns `400 "Agent \"..%2Fevil\" not found"` because the server looks up the **raw** (undecoded) string `..%2Fevil` in its in-memory list, which contains the decoded `../evil`.

**Reproduction:**

```bash
# 1. Create agent with traversal id
curl -X POST -H "x-config-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"id":"../evil","name":"x","configPath":"/tmp/x.json"}' \
  http://127.0.0.1:4321/api/agents/custom
# → 200, entry created

# 2. Try to delete it (GUI-style, percent-encoded)
curl -X DELETE -H "x-config-token: $TOKEN" \
  "http://127.0.0.1:4321/api/agents/custom/..%2Fevil"
# → 400 {"ok":false,"error":"Agent \"..%2Fevil\" not found"}

# 3. Edit disk file to remove the entry
#    (node: r.customAgents = r.customAgents.filter(a => a.id !== '../evil'))
# → disk now has no ../evil, but:

# 4. GET /api/state still shows it
curl -H "x-config-token: $TOKEN" http://127.0.0.1:4321/api/state
# → customAgents: ["../evil"]  (stale in-memory copy)
```

**Root cause:** `gui-server.ts` line 713 passes `parts[3]` (the raw URL segment) directly to `manager.removeCustomAgent()`. The server never calls `decodeURIComponent` on path segments. The core's `removeCustomAgent` does a `find(a => a.id === id)` against the in-memory registry, which stores decoded IDs. The mismatch means any ID containing special characters (`/`, ` `, `#`, etc.) is **permanently undeletable via the API** — the only recovery is restarting the server (which reloads from disk) or editing the disk file while the server is stopped.

**Impact:**

- Any custom agent ID with special characters is a zombie entry: visible in `/api/state` and `/api/agents/catalog`, selectable in the GUI, but undeletable.
- The stale in-memory state also means the GUI shows agents that no longer exist on disk, and mutations to those agents (e.g., `addProvider` with that agent in `agentIds`) will silently fail or corrupt state.
- This is a **data integrity** issue: the server's source of truth (in-memory) and the persistence layer (disk) diverge permanently.

**Suggested fix:**

1. In `gui-server.ts`, decode all path segments: `const id = decodeURIComponent(parts[3])` before passing to core methods.
2. Add a `reloadRegistry()` or file-watch mechanism so the server can recover from out-of-band disk edits (or at minimum, re-read the registry on a mismatch).
3. Validate custom agent IDs at creation time to reject IDs containing `/`, `\`, or other path-traversal characters (see H1).

---

### C2 — Path traversal in skill creation

**Symptom:** `POST /api/skills` with `name: "../escape-test"` creates a skill directory at `<skills-library-parent>/escape-test/` instead of `<skills-library>/escape-test/`. The `assertSafeId` check is applied to the **slugified** ID, not the raw name, so the traversal happens before validation.

**Reproduction:**

```bash
curl -X POST -H "x-config-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"../escape-test","description":"traversal"}' \
  http://127.0.0.1:4321/api/skills
# → 200, skill created at <parent>/escape-test/ (one directory above the library)

# Verify:
ls <AI_CONFIG_HOME>/skills/
# escape-test/  ← should be here, but is actually at <AI_CONFIG_HOME>/escape-test/
```

**Root cause:** `createSkill` in `core/skills.ts` calls `skillSlug(name)` which produces `escape-test` (the `../` is stripped by slugification), then calls `assertSafeId(slug)` which passes. But the **directory** is constructed from the raw name before slugification: `path.join(libraryDir, name)` → `path.join(lib, "../escape-test")` → resolves to `<parent>/escape-test/`.

**Impact:** An attacker (or a user with a typo) can create skill directories anywhere the server process can write. Since skills are later copied into agent directories via `assignSkill`, a traversal skill could be injected into any agent's skills directory, potentially overriding a legitimate skill.

**Suggested fix:** Validate the raw `name` before slugification. Reject names containing `/`, `\`, `..`, or any path separator. Apply `assertSafeId` to the raw name, not just the slug.

---

## High

### H1 — No DELETE route for library skills

**Symptom:** There is no `DELETE /api/skills/:id` endpoint. The GUI's SkillsView has no "Delete from library" button — only "Remove from agent" (unassign). To delete a library skill, the user must manually delete the directory from the filesystem.

**Evidence:**

```bash
curl -X DELETE -H "x-config-token: $TOKEN" "http://127.0.0.1:4321/api/skills/some-skill"
# → 404 {"ok":false,"error":"No route"}
```

The `api.ts` client has `createSkill`, `assignSkill`, `unassignSkill`, `copySkill` — but no `deleteSkill`. The server's route table in `gui-server.ts` has no `DELETE /api/skills/:id` handler.

**Impact:** Users cannot delete a skill they created by mistake. The only workaround is filesystem access, which defeats the purpose of a GUI.

---

### H2 — Inconsistent HTTP status codes for validation errors

**Symptom:** Client-side validation errors (missing name, duplicate skill, invalid agent ID) return **HTTP 500** instead of 400/409. The GUI's `run()` helper treats all non-`ok` responses the same (shows an error toast), so the user experience is not broken — but the API contract is wrong and will mislead any programmatic client.

**Evidence:**

```bash
# Missing name
curl -X POST -H "x-config-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{}' http://127.0.0.1:4321/api/skills
# → HTTP 500 {"ok":false,"error":"Error: Skill name is required"}

# Duplicate skill
curl -X POST -H "x-config-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"qa-dup-skill","description":"dup"}' http://127.0.0.1:4321/api/skills
# → HTTP 200 (first call)
curl -X POST -H "x-config-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"qa-dup-skill","description":"dup2"}' http://127.0.0.1:4321/api/skills
# → HTTP 500 {"ok":false,"error":"Error: Skill already exists: qa-dup-skill"}

# Invalid agent ID
curl -X POST -H "x-config-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"agentId":""}' http://127.0.0.1:4321/api/skills/some-skill/assign
# → HTTP 500 {"ok":false,"error":"Error: Invalid agent id: \"\""}

# Unknown agent
curl -X POST -H "x-config-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"agentId":"nonexistent"}' http://127.0.0.1:4321/api/skills/some-skill/assign
# → HTTP 500 {"ok":false,"error":"Error: Agent does not support skills: nonexistent"}
```

**Suggested fix:** The `handle()` wrapper in `gui-server.ts` should map `Error` instances to 400 (or 409 for duplicates) rather than defaulting to 500. Alternatively, the core methods could return `OperationResult` with a `status` field that the server respects.

---

### H3 — `POST /api/providers/verify` returns `ok: true` when all checks fail

**Symptom:** Verifying a provider with a fake endpoint returns `HTTP 200` with `ok: true` and `data.models.ok: false`, `data.chat.ok: false`. The `ok` field at the top level refers to "the verification request succeeded" (i.e., the server ran the checks), not "the provider is reachable." This is confusing: a client checking `res.ok` will think the provider is valid.

**Evidence:**

```bash
curl -X POST -H "x-config-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"baseUrl":"https://fake.example.com/v1","apiKey":"sk-fake"}' \
  http://127.0.0.1:4321/api/providers/verify
# → HTTP 200
# {"ok":true,"data":{"baseUrl":"...","models":{"ok":false,"reached":false,...},"chat":{"ok":false,...}}}
```

The GUI's `ProviderVerify.tsx` correctly checks `data.models.ok` and `data.chat.ok` individually, so the UI is not misled. But the API contract is ambiguous.

**Suggested fix:** Either rename the top-level `ok` to `requestOk` / `completed`, or make the top-level `ok` reflect whether the provider is actually reachable (`models.ok || chat.ok`).

---

### H4 — MCP deletion may not clean up agent config files

**Symptom:** After `DELETE /api/mcp/qa-fake-mcp` returned `HTTP 200` with `ok: true`, the server entry `qa-fake-mcp` remained in `~/.claude/settings.json` under `mcpServers`. The registry was updated (the server was removed from `registry.json`), but the materialization step that writes to agent config files did not fully clean up.

**Evidence:**

```bash
# Before delete:
grep -o "qa-fake-mcp" ~/.claude/settings.json
# → qa-fake-mcp

# Delete:
curl -X DELETE -H "x-config-token: $TOKEN" "http://127.0.0.1:4321/api/mcp/qa-fake-mcp"
# → HTTP 200 {"ok":true,...}

# After delete:
grep -o "qa-fake-mcp" ~/.claude/settings.json
# → qa-fake-mcp  (still present!)
```

**Possible root cause:** The `deleteMCPServer` method in `core/index.ts` calls `removeMCPServerFromAgent` for each agent in `server.agentIds`. If the agent's config file was modified externally (or if the materialization logic has a bug in the removal path), the stale entry persists. The server returns success based on the registry update, not on the file write.

**Impact:** Stale MCP server entries in agent config files can cause the agent to attempt connecting to a non-existent server, producing errors in the agent's logs.

---

### H5 — `isSafeCommand` is a weak allow-list

**Symptom:** The `isSafeCommand` function in `core/agent-catalog.ts` uses a **deny-list** of forbidden tokens (`sudo`, `rm -rf /`, `mkfs.`, `dd if=`, etc.) rather than an allow-list of safe commands. This is inherently fragile:

```typescript
const FORBIDDEN_TOKENS = [
  'sudo', 'su ', 'rm -rf /', 'mkfs.', 'dd if=',
  '> /dev/sd', 'shutdown', 'reboot', ':(){',
];

export function isSafeCommand(command: string): boolean {
  const trimmed = command.trim();
  if (!trimmed) return false;
  if (trimmed.length > 500) return false;
  return !FORBIDDEN_TOKENS.some((tok) => trimmed.includes(tok));
}
```

**Issues:**

- `rm -rf /` is blocked, but `rm -rf /*` or `rm -fr /` or `rm -rf / --no-preserve-root` are not.
- `su` (with trailing space) is blocked, but `su\n` or `su\t` might not be.
- The check is a simple `includes()`, so `rm -rf /` would also block a legitimate path like `/usr/local/bin/rm -rf /tmp/build/` (false positive), while `rm -rf /etc` would pass (false negative).
- Commands are executed via `/bin/sh -c`, so shell metacharacters (`;`, `&&`, `|`, `$()`, backticks) are all available.

**Context:** This function guards the agent install/uninstall commands from the catalog (e.g., `npm install -g @anthropic-ai/claude-code`). The commands are developer-curated, not user-supplied, so the risk is lower than a typical command injection. But the function's name (`isSafeCommand`) and the comment ("pre-filtered") suggest a stronger guarantee than it actually provides.

**Suggested fix:** Use an allow-list of known-safe command patterns (e.g., `^npm install -g [a-z@/.-]+$`, `^brew install [a-z-]+$`). Or, at minimum, expand the deny-list to cover common variants and shell metacharacters.

---

## Medium

### M1 — `POST /api/agents/custom` crashes on missing `name` field

**Symptom:** Creating a custom agent without a `name` field returns `HTTP 500` with `TypeError: Cannot read properties of undefined (reading 'trim')` instead of a clean validation error.

**Evidence:**

```bash
curl -X POST -H "x-config-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"configPath":"/tmp/x.json","mcpPath":"/tmp/x-mcp.json","format":"yaml"}' \
  http://127.0.0.1:4321/api/agents/custom
# → HTTP 500 {"ok":false,"error":"TypeError: Cannot read properties of undefined (reading 'trim')"}
```

**Root cause:** `addCustomAgent` in `core/index.ts` line 785: `const id = def.id.trim()` — if `def.id` is `undefined`, this throws. The `name` field is handled safely (`def.name.trim() || id`), but `id` is not.

**Suggested fix:** Add a guard: `if (!def?.id) return { success: false, error: 'Agent id is required' }`.

---

### M2 — `GET /api/registry/export` route does not exist

**Symptom:** The GUI's SettingsView "Export Registry" button works client-side (it serializes the in-memory `registry` state to a JSON blob and triggers a download). However, there is no server-side `GET /api/registry/export` endpoint. The `api.ts` client has no `exportRegistry` method. This means the export is purely a client-side operation — it exports whatever the GUI currently has in memory, not the authoritative server state.

**Impact:** If the GUI's state is stale (e.g., after a failed `refreshAll`), the exported file may not match the server's registry. There is no server-side export for programmatic use.

**Suggested fix:** Add a `GET /api/registry/export` endpoint that returns the full registry JSON, and use it in the GUI instead of the client-side blob.

---

### M3 — Agent install/uninstall commands run without a timeout

**Symptom:** `startAgentJob` in `gui-server.ts` spawns install/uninstall commands (e.g., `npm install -g @anthropic-ai/claude-code`) with no timeout. Only the tool update job has a `timeoutMs: 120000` (2 minutes). An install command that hangs (e.g., a stalled npm download) will run indefinitely, consuming a child process slot.

**Evidence:**

```typescript
// gui-server.ts line 948
const job = startAgentJob(agentId, 'install', command);  // no timeoutMs

// vs. line 449 (tool update)
const job = startAgentJob(toolName, 'update', command, { timeoutMs: 120000 });
```

**Suggested fix:** Add a reasonable default timeout (e.g., 5 minutes) to all agent jobs.

---

### M4 — `PUT /api/agents/custom/:id` with empty body `{}` succeeds silently

**Symptom:** Sending an empty object to update a custom agent returns `HTTP 200` with `ok: true` and the full registry state, even though nothing changed. The `configPath` is preserved (the `updates.configPath !== undefined` check skips it), but the response gives no indication that no fields were actually updated.

**Evidence:**

```bash
curl -X PUT -H "x-config-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{}' http://127.0.0.1:4321/api/agents/custom/fake-agent
# → HTTP 200 {"ok":true,"data":{...full registry...}}
```

**Impact:** Low. The operation is idempotent and harmless. But a client might expect a 400 for a no-op update.

---

### M5 — `pi` agent is not skill-capable (no `skillsPaths` in catalog)

**Symptom:** The `pi` agent (and most other agents like `codex`, `gemini-cli`, `opencode` on some platforms) do not have `skillsPaths` defined in `agent-catalog.json`. Only `chatgpt`, `claude-code`, `opencode`, and `aion-cli` have `skillsPaths`. This means `assignSkill` for `pi` returns `500 "Agent does not support skills: pi"`.

**Evidence:**

```bash
curl -X POST -H "x-config-token: $TOKEN" -H "Content-Type: application/json" \
  -d '{"agentId":"pi"}' http://127.0.0.1:4321/api/skills/qa-test-skill/assign
# → HTTP 500 {"ok":false,"error":"Error: Agent does not support skills: pi"}
```

**Context:** This may be intentional (pi may not support skills yet), but the error message is misleading — it says "does not support skills" rather than "skills are not configured for this agent." If pi does support skills (e.g., via `~/.pi/agent/skills/`), the catalog entry is missing the `skillsPaths` field.

**Suggested fix:** Either add `skillsPaths` for pi (and other skill-capable agents) in `agent-catalog.json`, or change the error message to clarify that the agent has no skills directory configured.

---

## Low

### L1 — `GET /api/health` is unauthenticated

**Symptom:** `GET /api/health` returns `HTTP 200` without a token. This is intentional (liveness probe), but it means an unauthenticated client can confirm the server is running. The token is still required for all data endpoints.

**Evidence:**

```bash
curl http://127.0.0.1:4321/api/health
# → HTTP 200 (no token needed)

curl http://127.0.0.1:4321/api/state
# → HTTP 401 (token required)
```

**Impact:** Minimal. The health endpoint exposes no data.

---

### L2 — Token is injected into HTML as `window.__AI_CONFIG_TOKEN__`

**Symptom:** The served HTML contains the auth token in a `<script>` tag: `window.__AI_CONFIG_TOKEN__="..."`. Any JavaScript running in the page (including injected scripts) can read the token. Since the server is local-only (127.0.0.1) and the token is per-launch, the risk is low. But it means the token is visible in the browser's DevTools → Sources.

**Suggested fix:** Consider using a `Set-Cookie` with `HttpOnly` + `Secure` + `SameSite=Strict` instead of a JS-visible global. Or at minimum, document that the token is visible in DevTools.

---

### L3 — `useAgentCatalog` caches the catalog for the entire session

**Symptom:** The `useAgentCatalog` hook in `gui/src/hooks/useAgentCatalog.ts` caches the agent catalog in a module-level variable and never refreshes it. If a new agent is installed via the GUI (e.g., "Install Claude Code"), the catalog will not reflect the new agent until the page is reloaded.

**Evidence:**

```typescript
let cache: CatalogAgent[] | null = null;  // module-level, never cleared
```

**Impact:** Low. The catalog is static reference data (it ships with the server), and agent installation changes the "installed" status, not the catalog itself. The `detected` field is populated from live detection, which is refreshed via `refreshAll()`. But the "Available to Install" section in the GUI may show agents that are already installed (or hide agents that were just installed) until a reload.

---

### L4 — `GET /api/tools/update-check` does not return per-tool update status in the `tools` array

**Symptom:** The `/api/tools/update-check` response has a separate `updates` array (with `updateAvailable`, `latestVersion`, `method`, `command`) in addition to the `tools` array (with `name`, `version`, `installed`). The GUI's `ToolsView` uses the `updates` array to render the update status cell. The two arrays are not joined — the client must match by `name`.

**Impact:** Low. The GUI handles this correctly. But the API shape is slightly redundant.

---

## Verified Working (no issues found)

- **Auth:** Token via `x-config-token` header and `?t=` query param both work. 401 on missing/wrong token. 401 clears cached token in the browser.
- **Provider CRUD:** `POST /api/providers`, `PUT /api/providers/:id`, `DELETE /api/providers/:id`, `DELETE /api/providers/:id/agents/:agentId` all work correctly. Warnings for unsupported agents (e.g., `junie`) are propagated in `data.warnings`.
- **MCP CRUD:** `POST /api/mcp`, `DELETE /api/mcp/:name` work for the registry. (See H4 for the agent config cleanup issue.)
- **Skills:** `GET /api/skills`, `POST /api/skills` (create), `POST .../assign`, `POST .../unassign`, `POST .../copy` all work for supported agents.
- **Agent detection:** `GET /api/state` returns accurate `installed`/`configExists` status for detected agents.
- **Tools:** `GET /api/tools` returns detected tools with versions. `GET /api/tools/update-check` returns update status. `POST /api/tools/:name/update` returns 400 for tools without allow-listed update commands.
- **Registry import:** `POST /api/registry/import` with valid JSON works. Invalid JSON returns 400.
- **Raw file:** `GET /api/agents/:id/raw-file?kind=config` and `PUT` work. Backup is created on write.
- **Custom agents:** `POST /api/agents/custom`, `PUT /api/agents/custom/:id`, `DELETE /api/agents/custom/:id` work for plain IDs. (See C1 for the percent-encoded ID issue.)
- **GUI components:** `Dashboard.tsx`, `ProvidersView.tsx`, `SkillsView.tsx`, `ToolsView.tsx`, `SettingsView.tsx`, `AgentDetailView.tsx`, `AgentsView.tsx` all render correctly and handle API errors with toasts.
- **Store:** `useStore` correctly refreshes state after mutations. The `run()` helper surfaces warnings and errors as toasts.

---

## Test Environment

- **Server:** `http://127.0.0.1:4321` (started with `AI_CONFIG_HOME=/var/folders/w3/.../tmp.OBbgoFQdGh/.ai-agent-config`)
- **Token:** stored in `.qa/token.txt`
- **Isolated registry:** `/var/folders/w3/.../tmp.OBbgoFQdGh/.ai-agent-config/registry.json`
- **Real agent configs (read-only verification):** `~/.claude/settings.json`, `~/.pi/agent/models.json`, `~/.config/opencode/`
- **OS:** macOS (darwin), Node v26.7.0
