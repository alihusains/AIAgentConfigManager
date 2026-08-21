# Goose — Config & MCP Footprint Research

**Date:** 2026-08-21
**Task:** M008 (agent-coverage-research-batch-1)
**Method:** primary sources only — official docs (<https://goose-docs.ai>), the canonical GitHub repo (aaif-goose/goose), and the actual Rust source code (sparse clone of `main` at commit `7f4eeac7`, workspace version 1.47.0, commit date 2026-08-21) read directly for the config-loading module.
**Purpose:** turn the "verify before adapting" guess in `docs/agent-cli-inventory.md` §4.4 into a verified finding, so a future Goose adapter task can be built from fact.

---

## 0. What is Goose / where does it live

- Goose is an open-source, extensible AI agent (CLI + desktop app) now part of the **Agentic AI Foundation (AAIF)** at the Linux Foundation. Canonical repo: **<https://github.com/aaif-goose/goose>** (the `block/goose` URL redirects there). [S1]
- Documentation site: **<https://goose-docs.ai>** (docs source lives in-repo under `documentation/docs/`). [S1][S2]
- Binary: `goose` (CLI). Rust workspace with `crates/goose` (core) and `crates/goose-cli` (CLI). [S3]

## 1. Config file format and exact paths per platform

**Format: YAML** (primary file `config.yaml`; plus `permission.yaml` and, when file-based secret storage is in use, `secrets.yaml`). [S2]

**Verified paths** (from source `crates/goose/src/config/base.rs` + `crates/goose/src/config/paths.rs`):

| Platform | Primary config file |
| ---------- | -------------------- |
| macOS | `~/.config/goose/config.yaml` |
| Linux | `~/.config/goose/config.yaml` |
| Windows | `%APPDATA%\Block\goose\config\config.yaml` |

- macOS/Linux: `Paths::config_dir()` resolves via the `etcetera` crate (`AppStrategyArgs { top_level_domain: "Block", author: "Block", app_name: "goose" }`) → XDG `~/.config/goose`. [S3]
- Windows: same `etcetera` strategy → `%APPDATA%\Block\goose\config`. [S3]
- The `"Block"` segment in the Windows path (and the macOS data dir `~/Library/Application Support/Block/goose/`) is kept **for backwards compatibility** with pre-Linux-Foundation installs — the source comment says changing it "would orphan existing installations". [S3]
- **Data dir is separate from config dir** (sessions, recipes, scheduled recipes): macOS `~/Library/Application Support/Block/goose/`, Linux `~/.local/share/goose/`, Windows `%APPDATA%\Block\goose\`. Overridable with `GOOSE_PATH_ROOT` (which then forces `<root>/config`, `<root>/data`, `<root>/state`). [S2][S3]
- **Config is a layered list, not one file** (`Config::default()` in `base.rs`): 1. system config `/etc/goose/config.yaml` (Linux) or `%PROGRAMDATA%\goose\config.yaml` (Windows), 2. extra files from `GOOSE_ADDITIONAL_CONFIG_FILES` (path-list), 3. user config `~/.config/goose/config.yaml` (last, wins). [S3]
- Precedence for values: **environment variables > config file > defaults**. [S2]
- Verify on a machine with: `goose info -v` (shows config location + active settings). [S2]

**Verdict on the existing guess:** `~/.config/goose/config.yaml` is **CONFIRMED** for macOS/Linux (exact path, YAML) — and it does hold global settings **and** the provider *selection* block. The Windows path in the inventory was not guessed (absent), now known: `%APPDATA%\Block\goose\config\config.yaml`. The one inaccuracy in the §4.4 row: providers' **API keys do NOT live in config.yaml** (see §4 below).

## 2. Project-level (per-repo) config

**None for the main config.** Verified fact:

- The config loader only consults the system path, `GOOSE_ADDITIONAL_CONFIG_FILES`, and the user config dir — there is no cwd-relative or `.goose/` project config search in `crates/goose/src/config/` (grep for `project`/`current_dir`/`cwd` over the config module returns no project-config logic). [S3]
- The official config-files doc lists exactly five config artifacts, all under the user config dir: `config.yaml`, `permission.yaml`, `secrets.yaml`, `permissions/tool_permissions.json` (auto-managed), `prompts/`. No project-scoped file. [S2]

What *is* project-scoped (adjacent, but not "config"):

- **Context/hint files**: `.goosehints` and `AGENTS.md` in the working directory (default `CONTEXT_FILE_NAMES` = `[".goosehints", "AGENTS.md"]`, overridable via env). [S4]
- **`.agents/checks/*.md` + `.agents/REVIEW.md`** — reviewed by `goose review` (repo-local review checks/instructions). [S5]
- **Installed plugins** live at `~/.agents/plugins/<name>/` (user dir, not per-repo). [S5]

So for adapter purposes: **single global config file, no project scope** (analogous to `supports.projectConfig = false`).

## 3. MCP servers — how they are configured

**Goose calls MCP servers "extensions".** Verified fact:

- **Same file as the main config** — MCP servers live under the `extensions:` key in `~/.config/goose/config.yaml`. The official "Using Extensions" doc: "For advanced users, you can also directly edit the config file (`~/.config/goose/config.yaml`) to add, remove, or update an extension". [S6]
- **There is no `goose mcp add` command.** The current CLI's `mcp` subcommand is "Run one of the mcp servers bundled with goose" (`goose mcp <name>`) — it launches a bundled server, it does not configure one. [S5] The §4.4 guess of `goose mcp add` is **CORRECTED**.
- Add/remove is done via **`goose configure` → "Add Extension"** (interactive TUI: pick *Built-in* / *Command-line (stdio)* / *Remote (Streamable HTTP)*), or by hand-editing the YAML. Source: `crates/goose-cli/src/commands/configure.rs` — `configure_extensions_dialog()` → `configure_stdio_extension()` / `configure_streamable_http_extension()` → `set_extension()` → `Config::global()` → `update_param("extensions", …)`, i.e. **written into the extensions map of the global config.yaml** (confirmed by the outro "Configuration saved successfully to {config.path()}"). [S3][S5]
- Session-scoped (non-persisted) alternatives exist: `goose session --with-extension "cmd args"`, `--with-streamable-http-extension <url>`, `--with-builtin <id>`, and in-session `/extension`. These do NOT write config. [S5]

**Exact YAML shape** (verified against the serde deserializer `ExtensionConfig` in `crates/goose/src/agents/extension.rs`; `#[serde(tag = "type")]` enum, so `type` is the discriminator):

```yaml
extensions:
  # stdio (local command) — field names are cmd/args/envs, NOT command/args/env
  filesystem:
    type: stdio
    name: filesystem
    description: maps and stores files
    cmd: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
    envs: { "SOME_VAR": "value" }     # inline env vars (alias: env)
    env_keys: []                       # names of vars resolved from the secret store
    timeout: 300                       # seconds
    cwd: null
    available_tools: []                # empty = all tools
    enabled: true                      # sibling of the flattened config (ExtensionEntry)

  # remote (MCP Streamable HTTP) — field is uri, NOT url
  remote-tools:
    type: streamable_http
    name: remote-tools
    uri: "https://example.com/mcp"
    headers: {}
    envs: {}
    env_keys: []
    timeout: 300
    client_id: null                    # optional pre-registered OAuth client
    client_secret_key: null            # optional secret-store key name
    scopes: []
    enabled: true

  # builtin / platform
  developer:
    type: builtin
    name: developer
    enabled: true
    bundled: true
    timeout: 300
```

Field-name gotchas vs. the standard `mcpServers` shape (all verified from the serde struct, [S3], matching the docs examples [S2][S6]):

| Standard MCP JSON | Goose YAML |
| ------------------- | ----------- |
| `mcpServers` (root) | `extensions` (root) |
| `command` | `cmd` |
| `args` | `args` (same) |
| `env` | `envs` (map; `env` accepted as a read alias via `#[serde(alias = "env")]`); secret-store names in `env_keys` |
| `url` | `uri` (streamable_http) |
| — | `type` discriminator: `stdio` \| `streamable_http` \| `builtin` \| `platform` \| `frontend` \| `inline_python` (`sse` = legacy read-only) |
| — | `enabled` (bool, per entry), `name`, `description`, `timeout` (seconds), `available_tools` |

Note: the key under `extensions:` is derived from the extension name (`name_to_key` — lowercased, non-alphanumerics → `_`); if `name` is missing it is injected from the key. [S3]

## 4. Model providers / API keys

Verified fact (docs "Security Considerations" + source):

- **Provider selection** goes in `config.yaml`: `active_provider: <name>` plus a `providers:` map, each entry `{ enabled, model, configured }` (serde struct `ProviderEntry` in `crates/goose/src/config/providers.rs`). [S2][S3]
- **API keys do NOT go in `config.yaml`** — "goose does not read provider API keys from config.yaml. A key placed there is ignored". [S2]
- Keys live in the **system keyring** (Keychain on macOS) by default, written via `goose configure`. When the keyring is unavailable/disabled (headless, `GOOSE_DISABLE_KEYRING` set, or builds without the `system-keyring` feature), goose falls back to **file-based secret storage: `secrets.yaml` in the same config dir** (`config_dir.join("secrets.yaml")` in `base.rs` — plain text). [S2][S3]
- **Env vars also work and take precedence**: `GOOSE_PROVIDER`, `GOOSE_MODEL`, and `GOOSE_PROVIDER__API_KEY` / `GOOSE_PROVIDER__HOST` / `GOOSE_PROVIDER__TYPE` for custom endpoints, plus per-provider vars like `OPENAI_API_KEY`. Precedence: env > config file > defaults. [S4]

So: provider *identity/model* = `config.yaml`; provider *credentials* = keyring or `secrets.yaml` or env vars. An adapter should never expect (or write) API keys into `config.yaml`.

## 5. Adapter-shape recommendation (RECOMMENDATION, not fact)

Facts that drive this:

- Config is **YAML** — the core's `ConfigFormat` (json/jsonc) does not support it (same blocker as OMP, per `docs/agent-cli-inventory.md` §4.6). [S7]
- Unlike OMP, Goose's MCP servers **are** in the same file, under a well-defined `extensions:` map with a clean, stable serde schema (verified above). So "read" is trivially possible (YAML parse → `customSettings` or a dedicated decode); "write" is the problem: the core materializer speaks JSON/JSONC, and blind YAML re-serialization would mangle comments/anchors and risk dropping unknown keys (`headers`, `client_id`, `socket`, `available_tools`, …).
- Goose has no separate MCP file (rules out the `GenericAdapter` `mcpPath` seam), and its MCP schema is **not** the OpenCode `mcp` array (rules out `OpenCodeStyleAdapter`).

**Recommendation: OMP-style detect-only adapter first** (closest match among the three referenced shapes — `omp.ts`), i.e.:

1. `binaries: ['goose']` + `configFormat: 'yaml'`, `configPaths` = the three platform paths from §1.
2. `readConfig`: parse `config.yaml` into `customSettings` (optionally also surface the `extensions:` map as a read-only MCP listing, similar to how the docs show the shape — clearly optional).
3. `writeConfig` throws (detect-only), `supports.modelProviders = false` (keys are keyring-managed — out of scope for a file adapter), `supports.projectConfig = false`.
4. A later phase could add YAML-aware write support (e.g. a `serde_yaml`-equivalent round-trip that preserves unknown keys, plus a `cmd`/`envs`/`uri` field mapping in the unified MCPServerConfig codec) — but that is a core capability change, not a Goose-specific one, and should be its own task.

Do **not** reach for `GenericAdapter` (JSON-only + separate-MCP-file mechanism) or `OpenCodeStyleAdapter` (JSON/JSONC + `mcp` array schema) for the initial implementation — both would either fail on the format or corrupt the file.

---

## Confirm / correct summary for `docs/agent-cli-inventory.md` §4.4

| §4.4 claim | Verdict |
| ------------ | --------- |
| `~/.config/goose/config.yaml` (global settings + providers) | **CONFIRMED** (macOS/Linux, YAML; Windows: `%APPDATA%\Block\goose\config\config.yaml`). "Providers" = selection/model only; API keys are NOT in this file. |
| MCP via `goose mcp add` → same config.yaml | **PARTIALLY CORRECTED**: same file is right (`extensions:` key in `config.yaml`), but the command is `goose configure` → Add Extension (or hand-edit); `goose mcp <name>` only *runs* a bundled server. |
| "YAML again; verify before adapting" | **CONFIRMED**: YAML; recommend detect-only (OMP-style) per §5 above. |

## Sources

- [S1] Goose canonical repo (Linux Foundation AAIF): <https://github.com/aaif-goose/goose> (README: "goose is part of the Agentic AI Foundation (AAIF) at the Linux Foundation")
- [S2] Official docs — Configuration Files: <https://goose-docs.ai/docs/guides/config-files/> (in-repo: `documentation/docs/guides/config-files.md`)
- [S3] Goose source code, `main` @ `7f4eeac7` (v1.47.0, 2026-08-21), read directly: `crates/goose/src/config/base.rs` (config path layering, `secrets.yaml`, keyring fallback), `crates/goose/src/config/paths.rs` (`etcetera` AppStrategy `Block/goose`, `GOOSE_PATH_ROOT`), `crates/goose/src/config/extensions.rs` (`extensions` key, `ExtensionEntry`, `set_extension` → `Config::global()`), `crates/goose/src/agents/extension.rs` (`ExtensionConfig` serde enum: `cmd`/`args`/`envs`/`env_keys`/`uri`/`headers`/`timeout`/`client_id`…; `env` alias), `crates/goose/src/config/providers.rs` (`active_provider`/`providers` + `ProviderEntry`), `crates/goose-cli/src/commands/configure.rs` (Add Extension dialog → `set_extension`), `crates/goose-cli/src/cli.rs` (`Mcp` subcommand = run bundled server)
- [S4] Official docs — Environment Variables: <https://goose-docs.ai/docs/guides/environment-variables/> (`GOOSE_PROVIDER`, `GOOSE_MODEL`, `GOOSE_PROVIDER__API_KEY`, `CONTEXT_FILE_NAMES`, `GOOSE_PATH_ROOT` defaults, `GOOSE_DISABLE_KEYRING` → secrets.yaml paths)
- [S5] Official docs — CLI Commands: <https://goose-docs.ai/docs/guides/goose-cli-commands/> (`configure`, `info -v`, `mcp <name>`, `--with-extension`, `--with-streamable-http-extension`, `plugin install` → `~/.agents/plugins/`, `goose review` → `.agents/checks/*.md`)
- [S6] Official docs — Using Extensions: <https://goose-docs.ai/docs/getting-started/using-extensions/> ("directly edit the config file (`~/.config/goose/config.yaml`) to add, remove, or update an extension"; stdio/remote YAML examples; OAuth `client_id`/`client_secret_key`)
- [S7] Local: `docs/agent-cli-inventory.md` §4.4 (the row under test) and §4.6 (core `ConfigFormat` = json/jsonc only)
