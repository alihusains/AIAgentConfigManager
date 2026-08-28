<div align="center">

# ⚙️ AgentSync

**One registry. Every agent. In sync.**

![Repo name](https://img.shields.io/badge/repo%20name-TBD-orange)
![Version](https://img.shields.io/badge/version-v0.1.0-3b82f6)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-0f172a)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)
![License](https://img.shields.io/badge/license-TBD-lightgrey)

*A local-first configuration manager for your AI coding agents: providers, models, MCP servers, and permissions, defined once and synced into every agent you use.*

</div>

> **Note on the name and repo URL:** `AgentSync` is a working title. `agentsync` is already
> taken on GitHub, so the final name and repo path are still open — see
> [ROADMAP.md → Open decisions](ROADMAP.md#open-decisions). Badges above will link to the
> real repo once that's settled; don't copy a placeholder URL from this file.

---

## The problem

You run more than one AI coding agent. Maybe Claude Code for one project, Codex for
another, opencode or Gemini CLI on the side. Each one keeps its provider keys, model
list, MCP servers, and permissions in its own file, its own format, its own path on
disk.

Add a provider, and you type the same API key into five config files. Rotate a key,
and you have to remember which five. Add an MCP server, and you hand-edit JSON in one
agent, then TOML in another, then hope you didn't typo the fourth one. Nothing tells
you when the configs drift apart, so you find out when an agent fails silently or an
old key still works somewhere it shouldn't.

AgentSync replaces that with one rule: define a provider, model, or MCP server once in
a local registry, then install it into any agent you pick. The tool rewrites each
agent's config file for you, in its native format, without touching the keys and
structure it doesn't understand.

Everything runs on your machine. No cloud, no accounts, no telemetry. Your API keys
stay in the registry file on disk.

## What it does today

| Capability | What you get |
| --- | --- |
| 🔍 **Agent detection** | Scans your machine for installed agent CLIs: binary, version, config path, MCP layout |
| 🧩 **MCP server registry** | Define a server once, install it into any combination of agents; the tool handles each agent's JSON/JSONC/TOML quirks |
| 🔌 **Model provider registry** | One provider definition (base URL + API key), materialized into every agent you select |
| ✅ **Live API verification** | Calls the endpoint for real (`GET /models`, `POST /chat/completions`, `POST /responses`) and shows you the curl command and raw response, so you know which APIs a provider actually supports |
| 📊 **Dashboard (GUI)** | Point-and-click management, light/dark themes, copy-to-clipboard credentials, per-provider API badges, one-click connectivity tests |
| 🖥️ **CLI** | Full command surface for scripting: `detect`, `provider`, `model`, `mcp`, `permission`, `backup`, `gui` |
| 🧬 **Format-aware writing** | Adapters preserve unknown keys, `imports`, headers, and JSONC comments; your existing config never gets clobbered |

### Supported agents

24 agents have an adapter today: Claude Code, OpenAI Codex (ChatGPT), opencode,
Mimo, Kilo Code, Pi, Gemini CLI, Junie, FreeBuff, Kimi, Qwen, Cursor CLI, Cline,
Droid, Goose, Continue, Crush, Windsurf, Roo Code, Aider, Zed, Amazon Q, GitHub
Copilot CLI, and Oh My Pi (OMP). Two are detect-only on purpose: Aider has no
native MCP support, so there is nothing to write, and OMP's YAML settings are
honored but not rewritten because its config model doesn't map cleanly onto the
unified schema. We state limitations instead of faking coverage.

The install/detect catalog covers 37 agent entries in total; the remainder are
tracked for detection and CLI install/uninstall, with adapters landing as demand
shows up. Adding a new one is a small, documented adapter; see `CONTRIBUTING.md`.

## Quick start

```bash
# install dependencies (pnpm recommended)
pnpm install

# build all packages (core + cli + gui)
pnpm build

# detect what's installed on your machine
pnpm cli detect

# open the dashboard — it prints a local URL like
# http://127.0.0.1:31456/?t=<session-token>
pnpm cli gui
```

> **Security note:** the dashboard binds to `127.0.0.1` and requires a per-launch
> session token (the `?t=…` part of the URL). Without that token, no other website or
> local process can reach your configs. Once the page loads, the token drops out of
> the address bar and the URL reads `http://127.0.0.1:<port>/`.

### Dashboard

<!-- TODO: add screenshots before publishing -->
> 📷 *Screenshot: agent detection view (installed vs. available to install)*

> 📷 *Screenshot: provider add flow with live API verification results*

> 📷 *Screenshot: MCP server registry and per-agent install picker*

## Roadmap

The product vision, field evidence from community discussions, and what's next live
in [`ROADMAP.md`](ROADMAP.md), including the ready-to-paste backlog in
[`docs/community-issues.md`](docs/community-issues.md).

## Usage

### 1. Detect agents

```bash
ai-config detect                 # list every detected agent (binary, version, path)
ai-config list-agents            # same info, table format
```

### 2. Manage providers

```bash
ai-config provider add opencode   # interactive: add a provider to opencode
ai-config provider list opencode  # what opencode has configured
ai-config provider remove opencode anthropic-main
```

> 💡 In the dashboard, adding a provider shows a **Verify APIs** button. Run it and
> AgentSync reports:
>
> - ✓ / ✗ **Chat Completions** (`POST {base}/chat/completions`)
> - ✓ / ✗ **Responses** (`POST {base}/responses`)
> - the model list (`GET {base}/models`), with a one-click "use all N models"
> - the curl command and raw output of every probe, so you can check the response yourself

### 3. Manage models

```bash
ai-config model add opencode        # attach a model to a provider
ai-config model list opencode
ai-config model remove opencode gpt-4o
```

### 4. Manage MCP servers

```bash
ai-config mcp add opencode          # define a server once…
ai-config mcp list opencode
ai-config mcp remove opencode filesystem
```

### 5. Permissions and backups

```bash
ai-config permission add claude-code
ai-config permission list claude-code
ai-config backup opencode           # snapshot before big changes
ai-config restore opencode ./backup.json
```

### 6. The registry, under the hood

Everything lives in a single `registry.json`, plus per-agent materializations. One
source of truth means any agent you add later gets installed into instantly, and
deleting a provider or server removes it from every agent it touched, not just the
registry.

## Frequently asked questions

<details>
<summary><b>Which agents are supported?</b></summary>

24 agents have an adapter: Claude Code, OpenAI Codex (ChatGPT), opencode, Mimo,
Kilo Code, Pi, Gemini CLI, Junie, FreeBuff, Kimi, Qwen, Cursor CLI, Cline, Droid,
Goose, Continue, Crush, Windsurf, Roo Code, Aider, Zed, Amazon Q, GitHub Copilot
CLI, and Oh My Pi. Aider and Oh My Pi are detect-only by design (Aider has no
native MCP support; OMP's config model doesn't map onto the unified schema). The
wider catalog tracks 37 agents for detection and install. New agents are a small,
documented adapter each; see `CONTRIBUTING.md`.

</details>

<details>
<summary><b>Is this safe? Will it overwrite my configs?</b></summary>

Writes are shape-aware and merge-preserving: unknown keys in your config files
survive untouched, new MCP entries get written without keys your agent wouldn't
recognize, and server entries merge into your existing on-disk structures (your
`directTools`, headers, and `imports` stay put). Every registry write is atomic
(temp file plus rename), and `ai-config backup <agent>` snapshots files before you
do anything risky.

</details>

<details>
<summary><b>Why does the dashboard URL contain a token?</b></summary>

The dashboard is a small web server on your machine that can edit configs. A
per-launch session token protects it: without one, any website you visit could ask
your browser to call `http://localhost:PORT/api/…` and read your API keys or rewrite
your configs. Each launch mints a fresh token; the page keeps working while it's
open, and the token disappears from the address bar after load.

</details>

<details>
<summary><b>What does "Chat Completions vs. Responses API" mean?</b></summary>

OpenAI-style gateways expose two wire protocols: the older Chat Completions API
(`POST /chat/completions`) and the newer Responses API (`POST /responses`).
Providers differ. ChatGPT accounts, for example, dropped Chat Completions and only
serve Responses. AgentSync verifies both when you add a provider, so you see
immediately which of your agents can use it: opencode-style agents expect Chat
Completions, and Responses-only providers target Responses-capable agents.

</details>

<details>
<summary><b>Can I contribute?</b></summary>

Yes. Issues are curated for onboarding and every PR gets reviewed. See
`CONTRIBUTING.md` and the ready-to-paste issue drafts in `docs/community-issues.md`.

</details>

## Repository topics (tags)

`ai` · `agents` · `claude-code` · `codex` · `opencode` · `gemini-cli` · `junie` ·
`kilo` · `mimo` · `pi` · `mcp` · `model-providers` · `config-management` · `registry` ·
`cli` · `dashboard` · `react` · `vite` · `typescript` · `local-first` · `privacy`

## License

Not yet decided. No `LICENSE` file exists and `package.json` declares no license; the
maintainer will pick one before the repository is published. Until then, all rights
reserved by default.
