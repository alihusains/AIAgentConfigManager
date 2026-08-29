# Agent CLI — Config & MCP Path Reference (Consolidated)

**Date:** 2026-08-21
**Status:** v1 — consolidated from 4 research batches (primary sources only)
**Purpose:** single reference for the open-source config manager. Each agent gets a
machine-usable row (paths per platform, format, MCP key/shape, model/credential paths,
binary, env overrides) so adapters and the catalog can be generated/verified from one table.

**Key shapes used in the "MCP key" column:**
- `mcpServers` — keyed JSON object `{name: {command, args, env} | {url, headers}}` (Claude Code convention)
- `mcp` — keyed object used by OpenCode/Kilo (`{name: {type, command, url, enabled}}`)
- `mcp_servers.<name>` — TOML table (Codex)
- `[[plugins]]` — TOML array-of-tables (Reasonix)
- inline — MCP lives inside the main config file, no separate file

---

## Summary table (global/home scope)

| Agent | Binary | Config (macOS/Linux) | Config (Windows) | Format | MCP location | MCP key/shape | Model/credential | Env override |
|---|---|---|---|---|---|---|---|---|
| **OpenAI Codex** | `codex`, `chatgpt` | `~/.codex/config.toml` | `%USERPROFILE%\.codex\config.toml` | TOML | same file | `mcp_servers.<name>` TOML tables | `model`, `[model_providers.*]` in config.toml; keys in `auth.json` or keyring | `CODEX_HOME` |
| **Claude Code** | `claude` | `~/.claude/settings.json` | `%USERPROFILE%\.claude\settings.json` | JSON | `~/.claude/mcp.json` (global) / `.mcp.json` (project) | `mcpServers` | `settings.json` env block; `ANTHROPIC_API_KEY` env | `CLAUDE_CONFIG_DIR` |
| **Gemini CLI** | `gemini` | `~/.gemini/settings.json` | `%USERPROFILE%\.gemini\settings.json` | JSON | same file | `mcpServers` | `model.name`; `GEMINI_API_KEY` env / OAuth; `~/.gemini/.env` auto-loaded | `GEMINI_CLI_SYSTEM_DEFAULTS_PATH` |
| **Cline** | `cline` | `~/.cline/settings/settings.json` (CLI) | `%APPDATA%\Cline\settings.json` | JSON | `~/.cline/mcp/mcp.json` (CLI) / `mcpState.json` (IDE) | `mcpServers` | provider config in settings; API keys in IDE keychain / env | `CLINE_HOME` |
| **Aider** | `aider` | `~/.aider.conf.yml` | `%USERPROFILE%\.aider.conf.yml` | YAML | **none — no native MCP** | — | `model:` in conf.yml; other keys in `.env` | `AIDER_*` per flag (no dir override) |
| **Goose** | `goose` | `~/.config/goose/config.yaml` | `%APPDATA%\goose\config.yaml` | YAML | `~/.config/goose/config.yaml` (`mcp_servers:`) | `mcp_servers` (YAML list) | `extensions`/providers in config.yaml; `~/.config/goose/credentials/` | `GOOSE_CONFIG` |
| **OpenCode** | `opencode` | `~/.config/opencode/opencode.json` | `%USERPROFILE%\.config\opencode\opencode.json` | JSON/JSONC | same file | `mcp` (keyed object) | `model`, `provider` in same file; keys in `~/.local/share/opencode/auth.json` | `OPENCODE_CONFIG`, `OPENCODE_CONFIG_DIR` |
| **Kilo Code** | `kilo` | `~/.config/kilo/kilo.jsonc` | `%USERPROFILE%\.config\kilo\kilo.jsonc` | JSONC | same file | `mcp` (keyed object) | `model`, `provider` in same file; legacy `~/.kilocode/` | `KILO_CONFIG` |
| **Zed** | `zed` (GUI) | `~/.config/zed/settings.json` | `%APPDATA%\Zed\settings.json` | JSON | same file (`context_servers`) | `context_servers` (Zed-specific) | `~/.local/share/zed/auth.json` (API keys) | `ZED_CONFIG_DIR` (n/a GUI) |
| **Continue.dev** | `continue` | `~/.continue/config.yaml` | `%USERPROFILE%\.continue\config.yaml` | YAML | same file | `mcpServers` (list) | `models:` in config.yaml; keys in `.env` | `CONTINUE_CONFIG` |
| **Amazon Q** | `q` (aws) | `~/.aws/amazonq/` | `%USERPROFILE%\.aws\amazonq\` | JSON | per-agent JSON | `mcpServers` | AWS SSO/profile credentials | `AWS_PROFILE` |
| **GitHub Copilot CLI** | `gh-copilot` / `copilot` | `~/.copilot/settings.json` | `%USERPROFILE%\.copilot\settings.json` | JSONC | `~/.copilot/mcp-config.json` | `mcpServers` | GitHub auth in keyring; `gh` credentials | `COPILOT_HOME` |
| **Cursor CLI** | `agent` | `~/.cursor/cli-config.json` | `%USERPROFILE%\.cursor\cli-config.json` | JSON | `~/.cursor/mcp.json` (shared w/ editor) | `mcpServers` | account auth; `model` in cli-config.json | `CURSOR_CONFIG_DIR` |
| **Windsurf (Cascade)** | `windsurf` (IDE) | `~/.codeium/windsurf/` | `%APPDATA%\Codeium\windsurf\` | JSON | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` | account auth | — |
| **Devin CLI** | `devin` | `~/.config/devin/config.json` | `%APPDATA%\devin\config.json` | JSONC | same file | `mcpServers` | account auth | `DEVIN_CONFIG` |
| **OpenInterpreter** | `interpreter` (`python -m openinterpreter`) | `~/.openinterpreter/config.toml` | `%USERPROFILE%\.openinterpreter\config.toml` | TOML | same file (`[mcp_servers]` / plugins) | TOML tables | model in config.toml; provider keys env | `OPENINTERPRETER_*` |
| **Ollama** | `ollama` | `~/.ollama/` (models dir) | `%USERPROFILE%\.ollama\` | binary models | **N/A (server, not agent)** | — | local models; no API key | `OLLAMA_HOST`, `OLLAMA_MODELS` |
| **LM Studio** | `lms` | `~/.lmstudio/` (models) | `%USERPROFILE%\.lmstudio\` | binary models | **N/A (server)** | — | local models | `LMSTUDIO_*` |
| **Jan.ai** | `jan` | `~/Library/Application Support/Jan/data` (macOS) | `%APPDATA%\Jan\data` | JSON | per-assistant in data dir | assistant config | local models (GGUF) | — |
| **Junie** | `junie` | `~/.junie/mcp/mcp.json` (MCP) | `%USERPROFILE%\.junie\mcp\mcp.json` | JSON | `~/.junie/mcp/mcp.json` | `mcpServers` | JetBrains account auth | — |
| **Reasonix** | `reasonix`, `deepseek-reasonix` | `~/.reasonix/config.toml` | `%APPDATA%\reasonix\config.toml` | TOML | same file | `[[plugins]]` TOML array | model in config.toml; keys in `~/.reasonix/.env` | `REASONIX_HOME` |
| **Freebuff** | `freebuff` | `~/.config/manicode/settings.json` | `%APPDATA%\manicode\settings.json` | JSON | `~/.agents/mcp.json` (shared) | `mcpServers` | ad-funded, no key | — |
| **Pi** | `pi` | `~/.pi/agent/settings.json` | `%USERPROFILE%\.pi\agent\settings.json` | JSON | `~/.pi/agent/mcp.json` | `mcpServers` | `~/.pi/agent/models.json`; keys in settings | `PI_CONFIG_DIR` |
| **Oh My Pi** | `omp` | `~/.omp/agent/config.yml` | `%USERPROFILE%\.omp\agent\config.yml` | YAML | same file | `mcp:` (YAML) | `~/.omp/agent/models.yml` | `OMP_CONFIG_DIR` |
| **Mimo** | `mimo` | `~/.config/mimocode/mimocode.jsonc` | `%APPDATA%\mimocode\mimocode.jsonc` | JSONC | same file | `mcp` (keyed) | `model`, `provider` in same file | `MIMO_CONFIG` |
| **Kimi Code** (Moonshot) | `kimi` | `~/.kimi/config.toml` | `%APPDATA%\kimi\config.toml` | TOML | `~/.kimi/mcp.json` | `mcpServers` | `~/.kimi/credentials/<provider>.json`; MCP OAuth `~/.kimi/mcp-oauth/` | `KIMI_SHARE_DIR` |
| **Qwen Code** (Alibaba) | `qwen` | `~/.qwen/settings.json` | `%APPDATA%\qwen\settings.json` | JSON | same file | `mcpServers` | env-var keys; MCP OAuth `~/.qwen/mcp-oauth-tokens.json` | `QWEN_CONFIG` |
| **Crush** (Charm) | `crush` | `~/.config/crush/crush.json` + `crushrc` | `%APPDATA%\crush\crush.json` | JSON + Bash | same file (`mcp` section) | `mcp` (inline) | `~/.config/crush/` | `CRUSH_CONFIG` |
| **Droid** (Factory) | `droid` | `~/.factory/mcp.json` | `%APPDATA%\factory\mcp.json` | JSON | same file | `mcpServers` | OAuth tokens in OS keyring | `FACTORY_CONFIG` |
| **Little Coder** | `little-coder` | *(not yet researched)* | — | — | — | — | — | — |

---

## Notes & caveats

- **Verified 2026-08-21** (primary sources): Codex, Claude Code, Gemini, Cline, Aider,
  Goose, OpenCode, Kilo, Cursor CLI, Windsurf/Devin, Kimi, Qwen, Crush, Droid, Reasonix,
  Freebuff. Full per-agent source citations live in the batch reports:
  - `research/agent-research-reasonix.md`, `agent-research-freebuff.md`,
    `agent-research-aider.md`, `agent-research-cline.md`, `agent-research-goose.md`
  - Tier-1 / tier-1b / tier-2 / longtail batch reports (this file is the consolidation)
- **Needs verification before adapter work** (lower confidence / GUI-centric):
  Zed (`context_servers` shape), Continue.dev, Amazon Q, OpenInterpreter, Ollama,
  LM Studio, Jan.ai, Junie (version probe is broken — see detection-coverage),
  Little Coder (no config schema researched).
- **MCP shape families** (drives the adapter `mcpShape` field):
  1. `mcpServers` keyed JSON — Codex (as TOML tables), Claude Code, Gemini, Cline, Copilot,
     Cursor, Windsurf, Devin, Qwen, Droid, Junie, Freebuff, Pi, Kimi
  2. `mcp` keyed object — OpenCode, Kilo, Mimo
  3. `[[plugins]]` TOML array — Reasonix
  4. `mcp_servers` YAML list — Goose
  5. `context_servers` — Zed
  6. inline / no separate file — Aider (none), Crush, OpenInterpreter
- **No native MCP** (do not generate MCP UI for these): Aider, Ollama, LM Studio.
- **Shared MCP files:** Freebuff and Pi both read `~/.agents/mcp.json` / `~/.pi/agent/mcp.json`
  respectively — the `~/.agents/` dir is a cross-agent shared location worth first-class support.

## Next steps (feeds the tickets)

1. Add the 12 new agents (Kimi, Qwen, Crush, Droid, Cursor CLI, Devin, Goose, Cline,
   Aider, Continue, Zed, OpenInterpreter) to `agent-catalog.json` with the verified paths.
2. Write adapters for the high-value ones (Kimi, Qwen, Cursor CLI, Goose, Cline,
   Continue, Crush, Droid).
3. Verify the "needs verification" rows against primary sources before shipping.
4. Research Little Coder's config schema (it's the one we have installed but no schema for).