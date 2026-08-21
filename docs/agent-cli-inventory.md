# Agent CLI Inventory — Detection Research

**Date:** 2026-08-19
**Method:** primary sources (official docs / GitHub READMEs / docs sites) + local machine verification (`command -v`, global npm/bun listings, config-file structure inspection with values redacted).
**Scope:** terminal AI coding-agent CLIs that a config manager can detect, configure, and manage MCP servers for.

---

## 1. TL;DR

- **No canonical "total number" of AI agents exists, but two authoritative catalogs bracket it.** [best-of-Agent-Harnesses](https://github.com/RyanAlberts/best-of-Agent-Harnesses) (RyanAlberts, stars captured 2026-08-16) hand-curates **160 agent harnesses in 12 categories** — of which **22 are "coding agent products"**, and **~15 of those are terminal CLIs with on-disk config + MCP settings** that a config manager can detect/manage. [Paseo's catalog](https://paseo.sh/agents) cross-checks the native-CLI subset from a different angle at **39** (it includes cloud-backed ones: Copilot, Devin, Factory, Poolside, Auggie…). The long tail (cherry-agent, openagents, tabby, community lists) adds dozens more beyond both.
- **Relevance filter:** frameworks, multi-agent orchestration, memory layers, eval suites, browser agents and sandboxes (most of the 160) are *not* detection targets — they are libraries/daemons, not config-carrying agent CLIs. Only ~15–20 of the 160 qualify for adapter work.
- **This machine has 8 agent CLIs installed** — **all 8 are now detected** by the config manager (`codex/chatgpt`, `claude-code`, `opencode`, `mimo`, `kilo`, `pi`, `omp`, `junie`).
- **Gemini CLI is not installed** but left a full config footprint (`~/.gemini/settings.json` incl. a `codegraph` MCP server) → supports *config-based* detection.
- Every installed agent already has **MCP servers configured somewhere on disk** except Kilo (format known; none configured yet).

---

## 2. This machine — verified installs (2026-08-19)

| # | Agent (id) | Binary | Path | Version | Installed via |
|---|-----------|--------|------|---------|---------------|
| 1 | chatgpt (OpenAI Codex) | `codex` / `chatgpt` | `~/.bun/bin/codex` | codex-cli 0.148.0 | `bun add -g @openai/codex` |
| 2 | claude-code | `claude` | `~/.local/bin/claude` → `~/.local/share/claude/versions/2.1.235` | 2.1.235 | native installer |
| 3 | opencode | `opencode` | `/opt/homebrew/bin/opencode` | 1.18.15 | brew (+ npm beta `@opencode-ai/cli`) |
| 4 | mimo | `mimo` | `~/.mimocode/bin/mimo` | 0.1.13 | npm (`@mimo-ai/cli@0.1.13`, `mimocode@0.38.9`) |
| 5 | **kilo** (Kilo Code CLI) | `kilo` | `/opt/homebrew/bin/kilo` | 7.4.22 | npm `-g @kilocode/cli` (npm prefix → `/opt/homebrew/bin`) |
| 6 | **pi** (Pi coding agent) | `pi` | `/opt/homebrew/bin/pi` | 0.84.2 | npm `-g @earendil-works/pi-coding-agent` |
| 7 | **omp** (Oh My Pi) | `omp` | `~/.local/bin/omp` | omp/17.3.8 | curl installer (Rust core + Bun; `@oh-my-pi/pi-coding-agent`) |
| 8 | **junie** (JetBrains Junie) | `junie` | `~/.local/bin/junie` (23 KB launcher script) | — (`--version` prints nothing; flag TBD) | JetBrains installer script |

Related npm globals: `pi-mcp-adapter@2.5.4` (the MCP extension that gives Pi its `mcp.json`), `pi-cmux@0.1.16`, `mimocode@0.38.9`.
Non-agent CLIs also present (excluded from agent detection): `jan` (Jan desktop), `omlx` (oMLX app), `smallcode`, `composio`, `lightning-mlx` / `vllm-mlx` (inference).

## 3. This machine — config & MCP footprint per agent (structure only; secrets redacted)

### kilo — `~/.config/kilo/kilo.jsonc` (exists, 795 B)
- Top-level keys: `$schema`, `model`, `provider`, `permission`, `indexing`.
- `model: "openai-compatible/my-model"`; `provider.openai-compatible.options.apiKey` present (redacted). **No `mcp` key yet.**
- Legacy dir `~/.kilocode/` exists (extension-era: `node_modules`, `skills`). Homebrew at `/opt/homebrew/bin/kilo`; also `~/.config/kilo/node_modules` (npm artifacts).

### pi — `~/.pi/agent/` (exists, rich)
- `mcp.json` (269 B): `{ "mcpServers": { drawio, miro, rezi }, "imports": [ … ] }` → **3 configured MCP servers** (via `pi-mcp-adapter`).
- Also: `settings.json` (n/a yet), `models.json` + `models-store.json` (custom providers), `auth.json`, `keybindings.json` (absent), `extensions/`, `git/`, `npm/` (installed pi packages), `cert.pem`, `mcp-onboarding.json`, `mcp-cache.json`, `bin/`.
- Sessions: `~/.pi/agent/sessions/`.

### omp — `~/.omp/agent/` (exists)
- `config.yml` (99 B): `setupVersion: 1`, `modelRoles.vision: tokenrouter/qwen/qwen3.8-max-free`, `defaultThinkingLevel: auto`.
- `models.yml` + `models.json`: custom provider `icmarket` → `https://ic-chat.devenv.icm/api/v1` (internal), apiKey present (redacted). **YAML format.**
- SQLite state: `agent.db` (+WAL), `history.db`, `models.db`. MCP: inherited on first run from `.claude`, `.cursor`, `.windsurf`, `.gemini`, `.codex`, `.cline`, `.github/copilot`, `.vscode` (README, "Discovery" section).

### junie — `~/.junie/` (exists)
- `mcp/mcp.json` (338 B): `{ "mcpServers": { codegraphcontext, context7, codegraph } }` → **3 configured MCP servers**.
- Dirs: `agents/` (50), `commands/` (82), `extensions/`, `mcp/`, `logs/`, `plans/`, `processes/`, `misc/`, `instances/`; `AGENTS.md`, `history.jsonl`.

### gemini — NOT installed, config trace only
- `~/.gemini/settings.json` (161 B): key `mcpServers` only → server **`codegraph`**: `{ "type": "stdio", "command": "codegraph", "args": ["serve", "--mcp"] }`.
- Also `~/.gemini/GEMINI.md`, `antigravity/`, `config/`, `skills/`.

### Config traces without a binary (no adapter value today)
- `~/.crush/crush.db` (Charm Crush was used), `~/.cursor/skills`, `~/.windsurf/skills`, `~/.codebuddy/skills` (skill dirs only, no agent config), `~/.cline/data`, `~/.qoder/skills`, `~/.codeium/` (full Windsurf app data — `brain`, `cascade`, `database`…).

---

## 4. The landscape — the full list (2026-08-19, from best-of-Agent-Harnesses llms.txt + Paseo cross-check)

### 4.1 The authoritative catalog: 160 harnesses in 12 categories

Source: https://github.com/RyanAlberts/best-of-Agent-Harnesses/blob/main/llms.txt — hand-curated, ranked (stars 2026-08-16), 4-tier adoption-surface ratings, license signal, per-project capability tags; also machine-readable via `harnesses.json` and an MCP server (`uvx agent-harnesses-mcp`: recommend / compare / pick_harness / search_harnesses). Category counts (sum = 160):

| # | Category | Projects | Relevance to this config manager |
|---|----------|----------|----------------------------------|
| 1 | Progressive disclosure harnesses | 8 | Low — libraries/proxies (Headroom, MCP-Zero, ToolGen…), no per-agent config |
| 2 | **Coding agent products** | **22** | **Core** — turnkey CLIs/IDEs this tool detects & configures |
| 3 | Coding harness configs & SDKs | 17 | Medium — skill packs (superpowers, GStack…) + SDKs (Claude Agent SDK, ADK); config-adjacent |
| 4 | Personal agent runtimes | 10 | Low — always-on daemons (OpenClaw, Hermes, Khoj…) |
| 5 | Frameworks | 25 | Low — libraries (langchain, langgraph, pydantic-ai…) |
| 6 | Multi-agent & orchestration | 12 | Low — frameworks |
| 7 | Plugins, MCPs, CLI tools | 19 | Medium — MCP servers + helper CLIs (aider, cocoindex…) |
| 8 | Memory and state | 5 | Low |
| 9 | Evaluation & benchmarking harnesses | 18 | Low |
| 10 | Observability and eval-ops | 4 | Low |
| 11 | Research & task-specific harnesses | 5 | Low |
| 12 | Libraries and SDKs | 15 | Low |

### 4.2 The 22 coding-agent products — screened for CLI detectability

| Agent | Repo (★ 2026-08-16) | Kind | Terminal CLI | On this machine |
|-------|---------------------|------|--------------|-----------------|
| opencode | anomalyco/opencode (198k) | CLI + TUI, MCP, provider-agnostic | ✅ `opencode` | ✓ detected (adapter exists) |
| Gemini CLI | google-gemini/gemini-cli (107k) | CLI, plugin/MCP loop | ✅ `gemini` | config trace only (`~/.gemini/`) |
| Codex | openai/codex (106k) | CLI, sandboxed loop | ✅ `codex` | ✓ detected (adapter exists) |
| **pi** | earendil-works/pi (91.3k) | CLI + TUI; *the upstream harness oh-my-pi builds on* | ✅ `pi` | ✓ detected (`~/.pi/agent/`) |
| OpenHands | OpenHands/OpenHands (84.2k) | Dockerized server agent | ⚠️ daemon | – |
| Open Interpreter | openinterpreter/openinterpreter (68k) | CLI for open models | ✅ `interpreter` | – |
| Cline | cline/cline (66.3k) | VS Code ext (+ later CLI) | ⚠️ ext-first | `~/.cline/data` (dir only) |
| goose | aaif-goose/goose (52.9k) — Linux Foundation Agentic AI | CLI, MCP/ACP extension model | ✅ `goose` | – |
| DeepSeek-Reasonix | esengine/DeepSeek-Reasonix (34.6k) | CLI + TUI (prefix-cache tuned) | ✅ `deepseek-reasonix` | – |
| vibe-kanban | BloopAI/vibe-kanban (27.8k) | task-queue fleet manager, not a loop | ⚠️ orchestrator | – |
| crush | charmbracelet/crush (27.4k) | CLI (OpenCode fork) | ✅ `crush` | `~/.crush/` db, binary absent |
| qwen-code | QwenLM/qwen-code (27.1k) | CLI (Gemini-CLI fork) | ✅ `qwen` | – |
| Kilo Code | Kilo-Org/kilocode (26.9k) | **CLI + VS Code ext**, Cline/Roo lineage | ✅ `kilo` | ✓ detected (`~/.config/kilo/`) |
| Symphony | openai/symphony (26.7k) | hosted headless fan-out | ❌ | – |
| **oh-my-pi** | can1357/oh-my-pi (25.2k) | CLI (Pi fork, ~55k-line Rust core, 40+ providers) | ✅ `omp` | ✓ detected (`~/.omp/`) |
| Roo Code | RooCodeInc/Roo-Code (24.3k) | VS Code/Cursor ext (archived upstream per catalog) | ⚠️ ext | – |
| jcode | 1jehuang/jcode (17.7k) | CLI (Rust, MCP, multi-provider) | ✅ `jcode` | – |
| eigent | eigent-ai/eigent (15k) | desktop app | ❌ | – |
| cc-haha | NanmiCoder/cc-haha (14.1k) | desktop workspace harness | ❌ | – |
| claw-code-agent | HarnessLab/claw-code-agent (543) | CLI (Python reimpl. of Claude Code arch; MCP) | ✅ `claw` | – |
| AgentBox | madarco/agentbox (352) | VM-per-agent fleet runner | ⚠️ orchestrator | – |
| Proliferate | proliferate-ai/proliferate (167) | AI IDE / workspace orchestration | ❌ | – |

→ **~15 of the 22 are terminal CLIs** with on-disk config (+ MCP settings in most): opencode, gemini, codex, pi, open-interpreter, goose, deepseek-reasonix, crush, qwen-code, kilo, oh-my-pi, jcode, claw-code-agent — plus aider (cat. 7, 48.3k★, MCP-capable) and Junie (first-party JetBrains CLI; absent from this catalog, covered in §2).

### 4.3 Cross-check: Paseo's 39 native CLIs

Paseo (https://paseo.sh/agents) catalogs **39 native CLIs** it can drive remotely — incl. cloud-backed agents absent from the harness catalog: GitHub Copilot, Cursor, Auggie (Augment), Cortex Code (Snowflake), Corust, crow-cli, DeepAgents (LangChain), CodeWhale/DeepSeek TUI, DimCode, Dirac, Factory Droid, fast-agent, GLM (Zhipu), Hermes (Nous), Kimi Code (Moonshot), Minion Code, Mistral Vibe, Nova (Compass), Poolside, Qoder, siGit Code, Stakpak, VT Code, Agoragentic, Autohand Code, Grok Build (xAI). It independently confirms the same P0 set (Kilo, Pi, OMP, Junie). `mimo` (installed here) is in neither catalog — an extra.

### 4.4 Priority table for this tool (adapter work)

| Agent | Binary | Priority | Config location (primary source) | MCP config | Notes |
|-------|--------|----------|----------------------------------|-----------|-------|
| **kilo** | `kilo` | **P0** (installed) | `~/.config/kilo/kilo.jsonc` global; `./kilo.json[c]` / `./.kilo/kilo.json[c]` project; legacy `opencode.json[c]`, `.kilocode/` | Inside main config under **`mcp` key** (OpenCode heritage!): `{type: local\|remote, command: [..], environment, url, headers, enabled, timeout}`. `kilo mcp list\|add` CLI. Source: kilo.ai CLI docs | **Same schema family as the existing OpenCode/MIMO adapter** → parameterize `OpenCodeStyleAdapter` |
| **pi** | `pi` | **P0** (installed) | `~/.pi/agent/` (env `PI_CODING_AGENT_DIR`): `settings.json` global, `.pi/settings.json` project; providers via `models.json`; sessions `~/.pi/agent/sessions/` | No core MCP — via extension (`pi-mcp-adapter`): `~/.pi/agent/mcp.json` `{mcpServers, imports}` (verified on machine, 3 servers) | JSON ✓; permissions unsupported (no popups philosophy); source: pi.dev + GitHub README |
| **omp** | `omp` | **P0** (installed) | `~/.omp/agent/`: `config.yml` (modelRoles), `models.yml` (providers), `settings.yml` | Inherits MCP from `.claude/.cursor/.windsurf/.gemini/.codex/.cline/.github/copilot/.vscode` (README "Discovery") | **YAML configs** → format outside current json/jsonc support; adapter = detect + configExists + read, materialization deferred; source: omp.sh GitHub README |
| **junie** | `junie` | **P0** (installed) | `~/.junie/config.json` user, `.junie/config.json` project (fields: `model`, `provider`, `byok`, `brave`, `hooks`, `mcp-locations`…); settings `~/.junie/settings.json` | **Separate file** `~/.junie/mcp/mcp.json` (user) / `.junie/mcp/mcp.json` (project), standard `mcpServers` `{command,args,env}` (verified, 3 servers); older docs reference `~/.junie/mcp.json` | JSON ✓; MCP-only file matches the generic adapter's `mcpPath` seam; source: junie.jetbrains.com |
| **gemini** | `gemini` | **P1** (config present, binary absent) | `~/.gemini/settings.json`; `~/.gemini/GEMINI.md`, `antigravity/`, `config/`, `skills/` | `mcpServers` key inside `settings.json` (verified: `codegraph` stdio entry) | Detection via `method: 'config'` even without binary; source: local file |
| goose | `goose` | P2 | `~/.config/goose/config.yaml` (global settings + providers); now Linux Foundation `aaif-goose` | `goose mcp add` → same `config.yaml` | YAML again; verify before adapting |
| amp | `amp` | P2 | `~/.config/amp/config.json` | via `amp` config | verify |
| qwen-code | `qwen` (Gemini-CLI fork, 27.1k★) | P2 | `~/.config/qwen/…` | same `mcpServers`-in-settings pattern as Gemini | verify binary + path |
| jcode | `jcode` (Rust, 17.7k★) | P2 | `~/.config/jcode/…` | MCP tag; verify | |
| deepseek-reasonix | `deepseek-reasonix` | P3 | verify | verify | |
| open-interpreter | `interpreter` | P3 | `~/.config/interpreter/…` | verify | |
| kimi-code | `kimi` / `qe`? | P2 | `~/.kimi` / `~/.config/kimi` | verify | binary name must be confirmed |
| cline | `cline` | P2 | `~/.cline/data` (present locally) | `.mcp.json` per project | VS Code-extension heritage |
| aider | `aider` | P2 | `~/.aider.conf.yml` / `~/.config/aider/aider.conf.yml` | `~/.mcp.json` (project) | YAML config; 48.3k★, MCP tag |
| copilot | `gh copilot` | P2 | `~/.config/github-copilot/` (auth) | via GitHub Copilot settings | `gh` 2.97.0 installed, extension list checked — empty |
| cursor / windsurf / codebuddy / qoder / nova / poolside / roo-code / … (rest of the two catalogs) | — | P3 | verify from docs during adapter work | — | no local footprint → no urgency |

### 4.5 Implementation status (2026-08-20)

All P0/P1 adapters from §4.4 are **implemented and registered** in `packages/core/src/adapters/`:

| Agent | Adapter file | MCP shape | MCP file location | Notes |
|-------|-------------|-----------|-------------------|-------|
| kilo | `kilo.ts` → `OpenCodeStyleAdapter` | array (unified, `mcp` key) | same file (`kilo.jsonc`) | 8-line parameterization; `info.mcpConfigPaths` = config path |
| pi | `pi.ts` → `GenericAdapter` | `mcpShape: 'keyed'` | separate `~/.pi/agent/mcp.json` | `imports` + tool-specific keys (`directTools`) preserved by merge-encode; `supports.modelProviders = false` |
| junie | `junie.ts` → `GenericAdapter` | `mcpShape: 'keyed'` | separate `~/.junie/mcp/mcp.json` | preserves per-entry `type` (`http`/`stdio`) + headers; user scope only |
| gemini | `gemini.ts` → `GenericAdapter` | `mcpShape: 'keyed'` | same file (`settings.json`) | same-file mode: `mcpServers` written into main config; detected via `method: 'config'` (binary absent) |
| omp | `omp.ts` (standalone) | — | — | **detect-only**: YAML `config.yml` read into `customSettings`; `writeConfig` throws; materializer skips agents with no supported capabilities |

Shared machinery in the rewrite of `generic.ts`: per-platform `configPaths`/`mcpConfigPaths` on `AgentInfo` (`mcpConfigPaths` added to the type), `mcpShape: 'array' | 'keyed'` with decode/encode conversion (keyed encode merges into existing entries so tool-specific keys survive and brand-new stdio servers are written without a `type` key — the intersection-safe shape pi/junie/gemini all accept), and a provider-key guard so `settings.json`-style files are never polluted with `modelProviders`/`models` empty arrays. Every registered adapter appears in `/api/state` (`DetectedAgent[]` includes `mcpConfigPaths`), and `AgentsView` shows an MCP File column (path, or "same file").

### 4.6 Key structural insight

Kilo (OpenCode fork) uses the **`mcp` key inside the main config** with `command: string[]` + `environmentVariables`/`environment` — byte-for-byte the schema the existing `OpenCodeStyleAdapter` already speaks. Adding Kilo is a 5-line parameterization. Junie and Pi use **main config + separate MCP file** (standard `mcpServers` shape) — matching the existing generic adapter's `mcpPath` mechanism. OMP is the only one that requires **YAML**, which the core's `ConfigFormat` (json/jsonc) does not support — detect-only for now.

---

## 5. Sources

- Kilo Code CLI: https://kilo.ai/docs/code-with-ai/platforms/cli · https://kilo.ai/docs/code-with-ai/platforms/cli-reference · https://kilo.ai/docs/automate/mcp/using-in-kilo-code · https://github.com/Kilo-Org/kilocode
- Pi: https://pi.dev/ · https://github.com/earendil-works/pi/tree/main/packages/coding-agent/README.md
- OMP (Oh My Pi): https://github.com/can1357/oh-my-pi#readme · https://omp.sh
- Junie: https://junie.jetbrains.com/docs/junie-cli-configuration.html · https://junie.jetbrains.com/docs/junie-cli-mcp-configuration.html · https://junie.jetbrains.com/docs/parameters.html
- Landscape (full catalog, 160 harnesses / 12 categories): https://github.com/RyanAlberts/best-of-Agent-Harnesses/blob/main/llms.txt · structured data: https://raw.githubusercontent.com/RyanAlberts/best-of-Agent-Harnesses/main/harnesses.json · MCP server: `uvx agent-harnesses-mcp`
- Native-CLI cross-check: https://paseo.sh/agents (39 agents) · WolframResearch/AgentTools PR #159 (Junie MCP client paths)
- Local files: `~/.config/kilo/*`, `~/.pi/agent/*`, `~/.omp/agent/*`, `~/.junie/*`, `~/.gemini/*`, `~/.local/bin`, npm/bun global listings