# Cline — Config / MCP Footprint Research

**Date:** 2026-08-21
**Task:** M009 (agent-coverage-research-batch-1)
**Method:** primary sources — Cline GitHub README, `apps/cli/README.md`, official docs site (docs.cline.bot), npm registry for the `cline` package — plus local-machine verification of the existing `~/.cline/` footprint (structure only, secrets redacted).
**Scope:** terminal AI coding-agent CLI that a config manager can detect, configure, and manage MCP servers for.

---

## TL;DR

**Cline now ships a real, first-party standalone terminal CLI** — it is no longer
extension-only. The binary is `cline`, installed via the npm package `cline`
(`npm install -g cline`). The CLI **shares its agent core** with the VS Code
extension, JetBrains plugin, and SDK, so provider config and MCP servers behave
the same across surfaces.

The two open questions from `docs/agent-cli-inventory.md` §4.2/§4.4 are both
resolved by primary sources:

1. **A real terminal CLI exists.** (Confirmed — see Q1.)
2. **The guessed `.mcp.json`-per-project MCP location is WRONG.** The MCP
   config for the CLI is a **global** file at **`~/.cline/mcp.json`** using the
   standard `mcpServers` keyed shape. (Confirmed — see Q3.)
3. **`~/.cline/data` is shared app state, not a single config file.** It is
   present on this machine (extension-era), and the CLI also uses it for
   sessions/settings/teams/hooks — a config manager should treat it as state,
   not as a hand-editable config file. (See Q2.)

---

## Q1. Does Cline ship a standalone terminal CLI binary?

**Yes — verified fact.**

- **Binary name:** `cline` (npm also publishes a secondary `cline-host` bin).
- **Install:** `npm install -g cline` (nightly: `npm install -g cline@nightly`).
  The package resolves a platform binary (macOS / Linux / Windows, `arm64` and
  `x64`) via optional dependencies, so no Node/Bun/Zig runtime is required at
  install time.
- The GitHub README lists the CLI as a first-class product alongside the VS
  Code extension, JetBrains plugin, Kanban app, and SDK: *"Run Cline in your
  terminal. Interactive chat or fully headless for CI/CD and scripting."*
- The dedicated CLI README (`apps/cli/README.md`) documents the full CLI:
  interactive TUI, one-shot, `--json` NDJSON, `--yolo`, `--zen` (background hub),
  sub-agents/teams, cron schedules, chat connectors, and headless CI/CD mode.
- **npm registry** confirms the `cline` package is the Cline Bot Inc. CLI
  (description: *"Autonomous coding agent CLI - capable of creating/editing
  files, running commands, using the browser, and more"*), with `bin` entries
  `cline` and `cline-host`, `os: [darwin, linux, win32]`, `cpu: [x64, arm64]`.
  (Note: the earliest `cline` npm versions 0.1.0–0.8.2 belong to an unrelated
  "kucoe/cline" library; the Cline Bot Inc. agent CLI starts at the
  `1.0.0-nightly.*` releases. The `latest` dist-tag is the current release.)

**Source:** <https://github.com/cline/cline> (README) · <https://github.com/cline/cline/blob/main/apps/cli/README.md> · <https://registry.npmjs.org/cline>

> **Local note:** the `cline` binary is **not** currently on this machine's PATH
> (matches the inventory's "config trace without a binary" note). Detection on
> this box would therefore be config-based, like Gemini.

---

## Q2. Config file format and exact path(s) per platform

**Verified fact.** Cline uses **two scopes** (docs: *CLI Configuration*):

- **Global configuration** in `~/.cline/` — *"applies globally across all Cline
  applications, including IDE, CLI, and SDK."*
- **Project configuration** in `.cline/` at the repository root — *"applies only
  to the current workspace"* (team-shared, commit these).

Layout (docs: *Configuration Directory Layout*):

- Primary root `~/.cline/`, with **structured app state under `~/.cline/data/`**.
- *Global provider settings, global settings, and MCP settings are stored under
  `~/.cline/data/settings/`.*
- Global workflows resolve from `~/.cline/data/workflows/`.
- Global rules, hooks, skills, agents, plugins, and cron specs resolve directly
  under `~/.cline/`.
- Rules/hooks/plugins/workflows may also be discovered from `~/Documents/Cline/`
  for compatibility.

CLI flags/env that relocate config:

- `--config <path>` — configuration directory (docs CLI reference default:
  `~/.cline/data/settings`).
- `--data-dir <path>` — isolated local state instead of `~/.cline/data`
  (enables sandbox mode).
- `CLINE_DATA_DIR` — *"Custom data directory (replaces `~/.cline/data/`)."*
- `CLINE_HOOKS_DIR` / `--hooks-dir` — hooks (default `~/.cline/hooks`).

**Is `~/.cline/data` CLI config or extension state/cache?** Both, and it is
**app state, not a single hand-editable config file.** On this machine
`~/.cline/data/` contains `globalState.json`, `secrets.json` (0600 — provider
credentials), and a `workspaces/` dir — i.e. runtime/extension-era state. A
config manager should **not** treat `~/.cline/data` as a config file to read or
write; the declarative, hand-editable surface is the global `~/.cline/` tree
(settings/provider/MCP) and the per-project `.cline/` tree.

**Source:** <https://docs.cline.bot/cli/configuration> · <https://docs.cline.bot/cli> (CLI reference) · local `~/.cline/data/` inspection (values redacted)

---

## Q3. How are MCP servers configured? Where, and what shape?

**Verified fact — and this corrects the inventory's guess.**

- **CLI MCP file: `~/.cline/mcp.json`** (global). This is the file to edit
  manually for the CLI.
- **IDE extension MCP:** a separate MCP settings JSON opened from the Cline
  panel (MCP Servers → Configure → "Configure MCP Servers"); entries added under
  `mcpServers`.
- The CLI also manages MCP via a wizard: `cline mcp` / `cline config mcp`
  (list / add / edit / enable-disable / delete), and `cline mcp install <name>
  -- <command> <args…>` for stdio (name, transport, command-or-URL pre-filled).
  Non-interactive: `cline config mcp --json`.

**JSON shape** (docs: *MCP — Configuration examples*), keyed `mcpServers`
object:

Local (STDIO):

```json
{
  "mcpServers": {
    "local-server": {
      "command": "node",
      "args": ["/path/to/server.js"],
      "env": { "API_KEY": "your_api_key" },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Remote (Streamable HTTP):

```json
{
  "mcpServers": {
    "remote-server": {
      "type": "streamableHttp",
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer your-token" },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

- The `type` field selects the transport: `streamableHttp` (recommended),
  `sse` (legacy), or omitted → defaults to legacy `sse`.
- Per-entry extras: `disabled` (bool), `autoApprove` (array of tool names),
  `env` (stdio), `headers` (remote).

**Verdict on the `.mcp.json` per-project guess: INCORRECT.** The documented
MCP location is the **global `~/.cline/mcp.json`** (keyed `mcpServers` shape).
The docs do **not** document a per-project `.mcp.json`. (Project-scope config
lives in `.cline/`, but the cited MCP docs point to the global file.)

**Source:** <https://docs.cline.bot/mcp/mcp-overview> · <https://docs.cline.bot/cli> (MCP wizard) · <https://github.com/cline/cline/blob/main/apps/cli/README.md> (MCP servers section)

---

## Q4. How are model providers / API keys configured?

**Verified fact.** The CLI supports the same providers as the VS Code extension.

- **Interactive auth:** `cline auth` (opens the auth TUI — Sign in with Cline /
  ChatGPT Subscription / OCA / your own API key).
- **OAuth providers:** `cline auth cline`, `cline auth openai-codex`,
  `cline auth oca`. OAuth providers do not auto-launch a browser on startup;
  authenticate explicitly first.
- **API key / model:** `cline auth --provider <id> --apikey <key> --modelid
  <model>` (e.g. `--provider anthropic --apikey sk-... --modelid
  claude-sonnet-4-6`; also `openai-native` with `--baseurl`).
- **Per-run overrides:** `-P/--provider <id>` (default `cline`),
  `-m/--model <id>` (default `anthropic/claude-sonnet-4.6`), `-k/--key <api-key>`
  (takes precedence over env vars).
- **Env vars for keys:** `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`,
  `OPENROUTER_API_KEY`, `CLINE_API_KEY`, `AI_GATEWAY_API_KEY`, `V0_API_KEY`.
- **Storage:** provider settings + secrets live under the global `~/.cline/`
  tree (settings under `~/.cline/data/settings/`; credentials in
  `~/.cline/data/secrets.json`, mode 0600 — verified present locally).

**Source:** <https://github.com/cline/cline/blob/main/apps/cli/README.md> (Use any provider / Options / Environment variables) · <https://docs.cline.bot/cli/configuration>

---

## Q5. Adapter-shape recommendation

> **Recommendation (not a verified fact).**

**Use `GenericAdapter` with `mcpShape: 'keyed'`, mirroring `junie.ts`.**

Rationale, mapped to the existing shapes:

- **Not `OpenCodeStyleAdapter`.** That shape (used by `kilo.ts`) expects the MCP
  config as an `mcp` *array* inside a single main config file
  (`~/.config/kilo/kilo.jsonc`). Cline's MCP is a **separate file**
  (`~/.cline/mcp.json`) with a **keyed `mcpServers` object** — the exact
  opposite, i.e. the Junie/Pi/Gemini family, not the Kilo/OpenCode family.
- **`GenericAdapter` + `mcpShape: 'keyed'` fits directly** (see `junie.ts`):
  - `configPath` / `configPaths`: `~/.cline/` global config root (settings under
    `~/.cline/data/settings/`).
  - `mcpPath` / `mcpConfigPaths`: `~/.cline/mcp.json` (separate file — matches
    the generic adapter's `configPath` + `mcpPath` seam).
  - `format: 'json'`.
  - `mcpShape: 'keyed'` — the on-disk `mcpServers` object is the standard keyed
    shape the generic adapter already decodes/encodes.
  - `supports.mcpServers = true`.
  - `supports.modelProviders = false` (recommendation): provider/auth is managed
    through `cline auth` + `secrets.json` (0600), not a declarative JSON key a
    config manager should author — same posture as `junie.ts` BYOK.
  - `supports.permissions = false`, `projectConfig = true` (`.cline/` exists but
    is primarily for rules/skills/hooks; MCP is global).
- **Caveats to resolve before implementation:**
  1. Cline's MCP entries carry extra keys (`disabled`, `autoApprove`, `env`,
     `headers`, `type`) that the keyed encode must preserve on merge (the
     generic keyed encode already merges into existing entries, so this should
     survive — verify).
  2. `~/.cline/data` is shared app state (sessions/secrets/workspaces) — the
     adapter must **not** read/write it as config; detection can key off the
     presence of `~/.cline/` or `~/.cline/mcp.json`.
  3. The CLI is **not installed on this machine** — detection here would be
     `method: 'config'` (like Gemini), so the adapter's config-based detection
     path needs to work with the binary absent.

If a future task confirms the team wants minimal surface, a **detect-only**
adapter (detect + `configExists` + read MCP list) is a safe first step, with
MCP materialization a follow-up — the same staged approach used for OMP.

---

## Summary of the 5 answers

| # | Question | Answer | Status |
| --- | ---------- | -------- | -------- |
| 1 | Standalone terminal CLI? | **Yes** — binary `cline`, `npm i -g cline` (per-platform binaries) | Verified fact |
| 2 | Config format & paths | Global `~/.cline/` (settings under `~/.cline/data/settings/`), project `.cline/`; JSON; `~/.cline/data` is app **state**, not a config file | Verified fact |
| 3 | MCP config location & shape | **Global `~/.cline/mcp.json`**, keyed `mcpServers` (`command/args/env` or `type/url/headers` + `disabled`/`autoApprove`); the `.mcp.json`-per-project guess is **incorrect** | Verified fact |
| 4 | Providers / API keys | `cline auth` (OAuth + API key), per-run `-P/-m/-k`, env vars; secrets in `~/.cline/data/secrets.json` (0600) | Verified fact |
| 5 | Adapter shape | **`GenericAdapter`, `mcpShape: 'keyed'`** (Junie-style); not OpenCode-style | Recommendation |

---

## Sources

- Cline GitHub README: <https://github.com/cline/cline>
- Cline CLI README (primary CLI source): <https://github.com/cline/cline/blob/main/apps/cli/README.md>
- Cline docs — CLI reference: <https://docs.cline.bot/cli>
- Cline docs — CLI Configuration: <https://docs.cline.bot/cli/configuration>
- Cline docs — MCP: <https://docs.cline.bot/mcp/mcp-overview>
- npm registry `cline` package: <https://registry.npmjs.org/cline>
- Local footprint (structure only, secrets redacted): `~/.cline/`, `~/.cline/data/` (globalState.json, secrets.json, workspaces/)
