# Reasonix — Config & MCP Footprint (Primary-Source Research)

**Date:** 2026-08-21
**Task:** M006 (agent-coverage-research-batch-1)
**Method:** primary sources only — the official repo `esengine/DeepSeek-Reasonix` (redirect target of `esengine/reasonix`) at commit `668cdee703680530901c67ff3908a95b720ad0d2` (2026-08-21), specifically `docs/CONFIG_PATHS.md`, `docs/GUIDE.md`, `docs/SPEC.md`, `reasonix.example.toml`, and the Go source under `internal/config/`. Source code is the most authoritative source for the exact on-disk shape.
**Scope:** resolves the `config.json` vs `config.toml` ambiguity in the catalog entry, documents the real MCP mechanism, provider-credential storage, and project-level config; ends with a labeled recommendation on adapter shape.

**Note on the repo URL:** `https://github.com/esengine/reasonix` 301-redirects to `https://github.com/esengine/DeepSeek-Reasonix`. The catalog's `source` field is stale but still resolves.

---

## 1. Actual config file format and exact path(s)

**Format: TOML. The `config.json` candidate is legacy (v0.x) only; the current global config is `config.toml`.**

| Platform | Global config path (v1.8.1+, current) |
| --- | --- |
| macOS | `~/.reasonix/config.toml` |
| Linux | `~/.reasonix/config.toml` |
| Windows | `%APPDATA%\reasonix\config.toml` (i.e. `AppData\Roaming\reasonix\config.toml`) |

- "Starting with **Reasonix v1.8.1**, Reasonix uses one user-facing home directory… `~/.reasonix` (macOS/Linux), `%APPDATA%\reasonix` (Windows)." Source: `docs/CONFIG_PATHS.md` ("Reasonix Home" table, <https://github.com/esengine/DeepSeek-Reasonix/blob/main/docs/CONFIG_PATHS.md>).
- Same paths confirmed in `docs/GUIDE.md` ("Configuration" section) and `docs/SPEC.md` §5, and in code: `internal/config/paths.go` `reasonixHomeDir()` returns `~/.reasonix` on non-Windows and `%USERPROFILE%\AppData\Roaming\reasonix` on Windows, with `config.toml` joined onto it (`internal/config/paths.go`, `userConfigPath()`).
- `REASONIX_HOME` env var overrides the home directory (fully self-contained tree). Source: `docs/CONFIG_PATHS.md`.
- **`~/.reasonix/config.json` is the v0.x (TypeScript line) legacy file.** `internal/config/mcpjson.go` (`legacyConfigPath()`) and `docs/CONFIG_PATHS.md` ("Legacy Migration") both list `~/.reasonix/config.json` as a legacy source. It is still *read* today, but only for its `mcpServers` (honoring `mcpDisabled`), as the **lowest-priority** MCP source, for upgrade compatibility — see `docs/GUIDE.md` "Upgrading from 0.x" and `internal/config/load.go` header comment. An adapter writing global config must target `config.toml`, not `config.json`.
- Other legacy locations migrated (non-destructively) since v1.8.1: `~/Library/Application Support/reasonix/config.toml`, `~/.config/reasonix/config.toml`, `~/.reasonix/reasonix.toml`. Source: `docs/CONFIG_PATHS.md` ("Legacy Migration").
- The repo ships `reasonix.example.toml` at the root — a sample of the global config shape (source: repo root listing at the commit above).

**Resolution of the catalog ambiguity: `~/.reasonix/config.toml` is correct for current builds; `config.json` survives only as a legacy read-only fallback. `REASONIX_HOME` override exists but is an advanced/test knob (docs say "Normal users should not need it").**

## 2. MCP server support — yes, first-class

Reasonix is an MCP client ("Reasonix is an MCP client." — `docs/GUIDE.md`, "Plugins (MCP)" section).

**Where MCP config lives:** there is **no separate MCP file** in the current design. MCP servers are `[[plugins]]` array-of-tables entries **inside the global `config.toml`** (or the project `reasonix.toml` / project-root `.mcp.json` — see §4). The `/mcp` slash command and `reasonix mcp auth|browse|install` CLI subcommands manage them (source: `docs/GUIDE.md` "Plugins (MCP)" and `docs/CLI.md` line 463).

**Exact shape** (TOML array of tables — an *array*, not a keyed object). Verified both in `docs/SPEC.md` §5, `reasonix.example.toml`, and the Go struct `internal/config/plugin_entry.go` (`PluginEntry`), which is authoritative:

```toml
[[plugins]]                       # stdio (default transport)
name    = "example"               # required
command = "npx"                   # required for stdio
args    = ["-y", "some-server"]   # optional
env     = { FOO = "bar" }         # optional

[[plugins]]                       # remote server
name    = "stripe"
type    = "http"                  # "stdio" (default) | "http" (Streamable HTTP) | "sse"
url     = "https://mcp.stripe.com"
headers = { Authorization = "Bearer ${STRIPE_KEY}" }   # ${VAR} / ${VAR:-default} expansion
```

Full field set per `PluginEntry` (`internal/config/plugin_entry.go`): `name`, `type`, `command`, `args`, `env`, `url`, `headers`, plus optional `startup_timeout_seconds`, `call_timeout_seconds`, `tool_timeout_seconds` (map of raw tool name → seconds), `concurrency` (`"parallel"` default / `"serial"`), `auto_start` (bool; nil = legacy auto-start behavior), and legacy `tier` (omitted on write).

**Field-for-field compatibility with Claude Code's `mcpServers` schema:** the struct's doc comment states "The fields mirror Claude Code's mcpServers spec, so entries can come from either reasonix.toml's [[plugins]] or a project-root .mcp.json". `docs/GUIDE.md` confirms: a project-root `.mcp.json` is read "as-is — the `mcpServers` spec (`command`/`args`/`env`, `type`/`url`/`headers`, `${VAR}` expansion) maps field-for-field onto `[[plugins]]`".

**Conversion note for the adapter:** the core's `mcpShape: 'keyed'` model (keyed object of `{command, args, env, url, headers}` entries) maps to Reasonix's TOML array by converting each keyed entry into one `[[plugins]]` table with a `name` taken from the key, and adding `type = "http"`/`"sse"` for remote entries (stdio is the default and may be omitted). This is the only structural difference from the generic keyed shape.

## 3. Model/provider credentials

- **Config stores a reference, not the secret.** `[[providers]]` entries in `config.toml` carry `api_key_env = "DEEPSEEK_API_KEY"` — "Provider entries store the name of the credential variable in `api_key_env`, not the secret value" (source: `docs/CONFIG_PATHS.md`, "Global config.toml").
- **The secret itself lives in a separate dotenv file: `<Reasonix home>/.env`** (e.g. `~/.reasonix/.env`), one `KEY=value` per line, written with restricted permissions. "For provider requests, Reasonix resolves only this global `.env`. Project `.env` files, home `.env` files, inherited shell environment variables, the old `credentials` file, and the OS keyring do not act as runtime provider-key fallbacks." Source: `docs/CONFIG_PATHS.md`, "Global .env".
- Example from the docs: `DEEPSEEK_API_KEY=sk-...` in `.env`; the setup wizard, desktop settings, and CLI missing-key prompts all read/write this same file.
- So the catalog note "DeepSeek API key required at first run" resolves to: first run prompts, then persists the key into `~/.reasonix/.env` alongside a `[[providers]]` entry (name/kind/base_url/models/`api_key_env`) in `~/.reasonix/config.toml`. The repo's root `.env.example` (containing `DEEPSEEK_API_KEY=`) is for *developers* of the repo, not the runtime credential store.
- Provider entry fields (verified in `internal/config/config.go` `ProviderEntry`): `name`, `kind` (e.g. `"anthropic"`, `"openai"`), `base_url`, `models`, `default`, `api_key_env`, `context_window`, `max_output_tokens`, `web_search`, `extra_body`, `headers`, `auth_header`, and more.

## 4. Project-level (per-repo) config — yes

- **Project config file: `./reasonix.toml` in the project root.** "The global user config is named `config.toml`. Project-local config files keep the name `reasonix.toml`." Source: `docs/CONFIG_PATHS.md`.
- **Precedence:** `command-line flags > project ./reasonix.toml > global <Reasonix home>/config.toml > compatible legacy global config > built-in defaults` (source: `docs/CONFIG_PATHS.md`, "Config Priority"; same order in `docs/SPEC.md` §5 and `internal/config/config.go` header comment).
- Some fields are **user/global only** — "Fields marked user/global only are not overridden by `./reasonix.toml`" (`docs/GUIDE.md`). E.g. `default_model` from a repo-local `reasonix.toml` is ignored (`internal/config/config.go` `IgnoredProjectDefaultModel`).
- **Project MCP:** a project can declare MCP servers in its own `reasonix.toml` `[[plugins]]` **and/or** a project-root **`.mcp.json`** (Claude Code's exact `mcpServers` schema). Merge order per MCP server name: `reasonix.toml` (project) > `config.toml` (global) > `.mcp.json` (project) > legacy `~/.reasonix/config.json` `mcpServers`. Source: `internal/config/load.go` (header comment + merge code) and `docs/SPEC.md` ("MCP servers may also be declared in a project-root .mcp.json… on a name collision reasonix.toml wins").
- **Writes always target the global path** (`docs/CONFIG_PATHS.md`): "Writes always target the new global path: macOS/Linux `~/.reasonix/config.toml`, Windows `%APPDATA%\reasonix\config.toml`" — explicit installs via `/mcp add` or `reasonix mcp install` "are saved to the user-global config.toml" (`docs/GUIDE.md`).

## 5. Adapter shape recommendation (opinion — not a verified fact)

**Closest match: `GenericAdapter` with `mcpShape: 'keyed'` and the MCP config in the *same file* as the main config — but the core's `ConfigFormat` (json/jsonc) does not support TOML, so this is not expressible with today's generic machinery and needs a small extension or a bespoke adapter.**

Justification, grounded in the existing adapters read for this task:

- It is **not** the `OpenCodeStyleAdapter` pattern (`kilo.ts`): that pattern assumes the main config is JSONC with an `mcp` key whose entries use `command: string[]` (OpenCode schema). Reasonix's main config is **TOML** and its MCP entries are a `[[plugins]]` **array of tables** with `command: string` + `args: []string` — a different format and a different schema, so `opencode-style.ts` cannot be parameterized for it.
- It **is** structurally the `GenericAdapter` pattern (`junie.ts`): single main config file, MCP servers as a set of named entries with `command`/`args`/`env` (stdio) or `url`/`headers` (remote) — `PluginEntry` mirrors Claude Code's `mcpServers` field-for-field, so the generic keyed-object decode/encode model fits the *data*; what differs is (a) the file format (TOML vs JSON) and (b) the container (TOML array-of-tables rather than a keyed JSON object).
- MCP lives in the **same file** as the main config (global scope), so the adapter would use the same-file mode (like `gemini.ts` writes `mcpServers` into `settings.json`), not a separate `mcpPath` (like `junie.ts`).
- Practical shape for the future implementation task: a bespoke adapter (or a TOML-capable generic mode) that (1) parses `~/.reasonix/config.toml` (Windows `%APPDATA%\reasonix\config.toml`), (2) maps keyed MCP entries ↔ `[[plugins]]` tables (key → `name`; stdio entries keep `command`/`args`/`env` and omit `type`; remote entries get `type = "http"`/`"sse"` + `url`/`headers`), (3) preserves all other TOML content verbatim (providers, ui, permissions, sandbox…), and (4) treats `~/.reasonix/.env` as a read-only credential surface (never write API keys into `config.toml` — the docs explicitly forbid it).
- Detection: binary `reasonix` (npm `reasonix` package pulls a prebuilt native binary — source: `README.md` "Install") plus config-based detection via the existence of `~/.reasonix/config.toml`.

## 6. Catalog-entry corrections implied (for the future implementation task)

- `settingsPaths`: replace `["~/.reasonix/config.json", "~/.reasonix/config.toml"]` with `~/.reasonix/config.toml` (darwin/linux) and `%APPDATA%\reasonix\config.toml` (win32). Keep `~/.reasonix/config.json` only as a legacy-detection hint, not a write target.
- `install`: `npm install -g reasonix` is correct per `README.md` ("`npm i -g reasonix` — any OS; pulls the prebuilt native binary"); `brew install esengine/reasonix/reasonix` also exists on macOS.
- The catalog's "Requires Node >= 22" description is not corroborated anywhere in the current repo (it is a Go single-binary; Node 24+ is required only for *building the frontend*, `README.md` "Development"). Unconfirmed for the shipped binary — likely a leftover from the v0.x TypeScript line.

## Sources

- Repository: <https://github.com/esengine/DeepSeek-Reasonix> (redirect target of <https://github.com/esengine/reasonix>), commit `668cdee` (2026-08-21)
- `docs/CONFIG_PATHS.md` — reasonix home per platform, global `config.toml` + `.env` structure, config priority, legacy migration (incl. `~/.reasonix/config.json`), Windows `%APPDATA%\reasonix`
- `docs/GUIDE.md` — "Configuration" (paths, resolution order, `[[plugins]]` example) and "Plugins (MCP)" (transports stdio/http/sse, field-for-field `.mcp.json` mapping, install paths, OAuth, legacy `config.json` `mcpServers` fallback)
- `docs/SPEC.md` — §5 "Configuration (TOML)" full schema incl. `[[providers]]` and `[[plugins]]` field comments; `.mcp.json` merge rules
- `reasonix.example.toml` — sample global config incl. commented `[[plugins]]` entries
- `internal/config/plugin_entry.go` — `PluginEntry` struct: authoritative MCP field names/types
- `internal/config/config.go` — `ProviderEntry` struct; load-order comment; user-global-only field rules
- `internal/config/paths.go` — `reasonixHomeDir()`/`userConfigPath()`: platform home dirs
- `internal/config/mcpjson.go` — `legacyConfigPath()` = `~/.reasonix/config.json`; legacy `mcpServers`/`mcp`/`mcpDisabled` read
- `internal/config/load.go` — merge order: reasonix.toml > config.toml > .mcp.json > legacy config.json
- `README.md` — npm install (`npm i -g reasonix`), brew tap, Node 24+ (frontend build only), `reasonix setup`
- Local reference (this repo): `docs/agent-cli-inventory.md` §3/§4.4–4.6 (format model), `packages/core/src/adapters/junie.ts`, `packages/core/src/adapters/kilo.ts` (adapter-shape grounding)
