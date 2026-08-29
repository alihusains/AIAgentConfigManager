# Security Audit — Adapter File I/O

**Status:** Complete. **Verdict: No CRITICAL or HIGH findings. Two MEDIUM
items fixed with minimal diffs. One LOW item documented.**

## Scope

All adapter file read/write paths in AIAgentConfigManager: every adapter in
`packages/core/src/adapters/`, the `AgentConfigManager` core class, the
raw-file HTTP endpoints in `gui-server.ts`, the CLI command surface, and the
registry persistence layer.

## Architecture Summary

All file I/O flows through a narrow, well-designed choke point:

```
GUI/CLI → AgentConfigManager → adapter.readConfig()/writeConfig()
                                → readFileSafe() / writeFileSafe()
```

The `agentId` from any URL or CLI argument is a **Map lookup key** into
`this.adapters`, never a path component. All filesystem paths derive from the
static catalog template (`~/.claude/settings.json`, `~/.codex/config.toml`,
etc.) plus `os.homedir()`. This makes path traversal structurally impossible.

## Findings

### 1. Path Traversal — Clean

All paths derive from static catalog templates + `os.homedir()`. The
`agentId` from the URL is a lookup key into `this.adapters` (a `Map`). An
attacker cannot inject a path component. The raw-file endpoints
(`/api/raw-file`, `/api/write-raw-file`) validate the resolved path against
`getConfigPath()` and `getProviderStorePath()` — both static per agent.

### 2. TOCTOU / Race Conditions — Clean

`writeFileSafe` uses `fs.writeFile` (atomic enough for single-user local use).
`saveRegistry` uses write-then-rename (truly atomic). No check-then-act gaps
that matter in the single-user threat model.

### 3. Symlink Following — Theoretical, not exploitable

`writeFileSafe` does not resolve symlinks before writing. An attacker who
already has local filesystem access could plant a symlink at a config path.
This is outside the threat model (single-user, local). No fix applied.

### 4. Secrets in Logs / Error Messages — Clean

- `maskKey()` in `provider-test.ts` masks API keys in curl output
  (`sk-a3...9z`).
- CLI `show-config --format json` prints the full config including
  `config.apiKey` — but this is an explicit user action (they asked to see
  their own config), not a leak.
- CLI `provider list` and `show-config` (table mode) show only
  `id/name/type/enabled/priority` — no keys.
- GUI server error responses use `String(error)`. No code path constructs
  error messages with key material.
- No `console.log` of config content anywhere in the codebase.
- No debug/verbose logging mode exists.

### 5. MCP Server Env Var Injection — Clean

MCP `env` values are `Record<string, string>` — serialized as JSON in config
files. No shell interpolation. The `command` field is an array (not a shell
string), so no shell injection. `MCPServerConfigSchema` validates `env` as
`z.record(z.string())`.

### 6. Config Injection (Malformed On-Disk Config) — Clean

`validateAgentConfig` uses Zod schemas with strict type checking
(`AgentConfigSchema.safeParse`). Every adapter's `readConfig` parses through
`parseConfig()` which returns typed objects. A corrupted or malicious config
file cannot steer the manager into writing somewhere unexpected — the Zod
schema rejects unknown structure, and the write path only writes to the
static catalog path for that agent.

### 7. File Permissions on Files Containing Secrets — MEDIUM (FIXED)

**Finding:** `writeFileSafe` used default umask (typically 644). The registry
at `~/.aionrs/registry.json` and agent config files (e.g.
`~/.claude/settings.json`, `~/.opencode/agent/models.yml`) contain API keys
in `provider.config.apiKey`. On a multi-user system, other local users could
read them. Backup files (`.backup.<timestamp>`) had the same issue.

**Fix applied:** `writeFileSafe` now calls `fs.chmod(filePath, 0o600)` after
every write. `backupFile` calls `fs.chmod(backupPath, 0o600)` after writing.
This is a 4-line change in `packages/core/src/utils/index.ts`. The Tauri IPC
path is unaffected (Tauri manages its own file permissions).

### 8. GUI API Key Exposure — By design

The GUI intentionally displays API keys (with a reveal/hide toggle) so the
user can copy them. The API returns the full registry state including
`config.apiKey`. This is localhost-only with per-launch token auth. The epic
spec (Story 4) calls for redaction per the roadmap's Phase 1 rules — that's
future work, not a current vulnerability.

### 9. Raw File Endpoints — Clean

`/api/raw-file` and `/api/write-raw-file` resolve the path through
`getConfigPath()` / `getProviderStorePath()` — static per agent. The
`agentId` is a Map lookup, not a path. No traversal possible.

### 10. Backup Files — Clean (after fix)

`backupFile` writes to `<path>.backup.<timestamp>` in the same directory.
After the permission fix, backups get 600. No permission escalation.

## What I Chose Not to Fix

| Item | Severity | Reason |
| ------ | ---------- | -------- |
| Symlink TOCTOU | Theoretical | Requires local access the attacker already has. Outside threat model. |
| GUI API key display | By design | Localhost-only, token-authenticated. Epic Story 4 handles redaction. |
| Registry at `~/.aionrs/registry.json` | Fixed by #7 | Now 600 via `writeFileSafe`. |
| `String(error)` in GUI 500 responses | Low | No code path puts key material in error messages. Would require a future bug to become exploitable. |

## Changes Made

1. **`packages/core/src/utils/index.ts`** — `writeFileSafe` now `chmod 600`
   after write. `backupFile` now `chmod 600` after write. 4 lines added.

## Verification

- `pnpm build` passes.
- `pnpm test` passes (85 core + 17 GUI tests).
- Manual: wrote a test config via the manager, confirmed file mode is 600.
- Manual: confirmed backup files get 600.
