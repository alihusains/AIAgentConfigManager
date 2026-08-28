# Security Audit — Adapter File I/O

## Scope

All adapter file read/write paths in `AIAgentConfigManager`. The GUI/CLI
surfaces, the `AgentConfigManager` core class, and the raw-file HTTP
endpoints in `gui-server.ts`.

## Architecture Summary

All file I/O flows through a narrow, well-designed choke point:

```
GUI/CLI → AgentConfigManager[...]
```

### Trust Boundary

The only finding is **theoretical** (symlink TOCTOU) that is not exploitable
within the tool's threat model (single-user, local, localhost-only server with
token auth).

### Findings

1. **Path Traversal** — **Clean.** All paths derive from static catalog
   templates + `os.homedir()`. The `agentId` from the URL is a lookup key into
   `this.adapters` (a `Map`), not a path component.

2. **TOCTOU / Race Conditions** — **Clean.** `writeFileSafe` uses atomic
   write-then-rename. `saveRegistry` uses the same pattern. No
   check-then-act gaps.

3. **Symlink Following** — **Theoretical only.** `writeFileSafe` does not
   resolve symlinks before writing. An attacker who already has local access
   could plant a symlink at a config path. This is outside the threat model
   (single-user, local).

4. **Secrets in Logs / Error Messages** — **Clean.**
   - `maskKey()` in `provider-test.ts` masks API keys in curl output
     (`sk-a3...9z`).
   - CLI `show-config --format json` prints the full config including
     `config.apiKey` — but this is an explicit user action (they asked to see
     their own config), not a leak.
   - CLI `provider list` and `show-config` (table mode) show only
     `id/name/type/enabled/priority` — no keys.
   - GUI server error responses use `String(error)` which could theoretically
     include a key if an error message contained one, but no code path
     constructs errors with key material.
   - No `console.log` of config content anywhere in the codebase.

5. **MCP Server Env Var Injection** — **Clean.** MCP `env` values are
   `Record<string, string>` — serialized as JSON in config files. No shell
   interpolation. The `command` field is an array (not a shell string), so
   no shell injection.

6. **Registry File Permissions** — **Minor.** `writeFileSafe` creates files
   with default umask (typically 644). The registry at
   `~/.aionrs/registry.json` contains API keys in `provider.config.apiKey`.
   On a multi-user system, other local users could read it. The fix is
   `chmod 600` after write. **Low severity** — single-user threat model.

7. **GUI API Key Exposure** — **By design.** The GUI intentionally displays
   API keys (with a reveal/hide toggle) so the user can copy them. The API
   returns the full registry state including `config.apiKey`. This is
   localhost-only with per-launch token auth.

8. **Raw File Endpoints** (`/api/raw-file`, `/api/write-raw-file`) — **Clean.**
   Path is validated against `getConfigPath()` and
   `getProviderStorePath()` — both derived from the static catalog. The
   `agentId` is a Map lookup, not a path.

9. **Backup Files** — **Clean.** `backupFile` writes to
   `<path>.backup.<timestamp>` in the same directory. No permission
   escalation.

10. **Input Validation** — **Clean.** `validateAgentConfig` uses Zod schemas
    with strict type checking. `MCPServerConfigSchema` validates `env` as
    `z.record(z.string())` — no injection vector.

## Verdict

**No security fixes required.** The codebase is well-designed for its threat
model (single-user, local, localhost-only). The only theoretical issues
(symlink TOCTOU, registry file permissions) are outside the threat model and
would require local access that an attacker already has.
