<div align="center">

# ⚙️ AgentSync

**One registry. Every agent. In sync.**

[![GitHub stars](https://img.shields.io/github/stars/your-name/agentsync?style=social&label=Stars)<!-- replace `your-name` with your GitHub username -->](https://github.com/your-name/agentsync)
![Version](https://img.shields.io/badge/version-v0.1.0-3b82f6)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-0f172a)
![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

*A local-first configuration manager for your AI coding agents — providers, models, MCP servers and permissions, defined **once** and synced into every agent you use.*

</div>

---

## What is this?

If you work with more than one AI coding agent (Claude Code, Codex, opencode, Gemini CLI, Kilo, Pi, Junie, Mimo, OMP…), you know the pain: each agent has its **own config file, its own format, its own place** for model providers, API keys and MCP servers. Change your model in one agent and the other eight silently drift.

AgentSync fixes that with a single idea:

> **Define each thing once in a registry, install it into any agent, and let the tool rewrite their config files for you.**

Everything runs **on your machine**. No cloud, no accounts, no telemetry — your API keys never leave the registry file on disk.

## What can it do?

| Capability | What you get |
|---|---|
| 🔍 **Agent detection** | Scans your machine and detects 10+ agent CLIs — binary, version, config path, MCP layout (9 adapters: Claude Code, Codex, opencode, Mimo, Kilo, Pi, Gemini, Junie, OMP) |
| 🧩 **MCP server registry** | Define a server **once**, install it into any combination of agents — the tool handles every filesystem quirk (JSON, JSONC, keyed `mcpServers`, same-file mode) |
| 🔌 **Model provider registry** | One provider definition (base URL + API key), materialized into every selected agent's config |
| ✅ **Live API verification** | When you add a provider, AgentSync *actually calls* the endpoint: `GET /models`, `POST /chat/completions`, `POST /responses` — and shows you the exact curl command + raw response, so you know **which APIs the provider supports** (some, like ChatGPT accounts, have dropped Chat Completions entirely and only answer on the Responses API) |
| 📊 **Dashboard (GUI)** | Point-and-click management with light/dark themes, copy-to-clipboard credentials, per-provider API badges and one-click connectivity tests |
| 🖥️ **CLI** | Full command surface for scripting: `detect`, `provider`, `model`, `mcp`, `permission`, `backup`, `gui` |
| 🧬 **Format-aware writing** | Shape-aware adapters preserve unknown keys, `imports`, headers and JSONC comments — nothing of yours gets clobbered |

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

> **Security note:** the dashboard is bound to `127.0.0.1` and guarded by a per-launch session token (the `?t=…` bit in the URL). That token is what stops other websites or local processes from reaching your configs. After the page loads, the token is moved out of the address bar — the URL simply reads `http://127.0.0.1:<port>/`.

## Roadmap

The product vision, field evidence from current community discussions, and the
next horizons live in [`ROADMAP.md`](ROADMAP.md) — including the ready-to-paste
backlog in [`docs/community-issues.md`](docs/community-issues.md).

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

> 💡 **In the dashboard**, when you add a provider you'll see **Verify APIs** — run it and AgentSync probes the endpoint and reports:
> - ✓ / ✗ **Chat Completions** (`POST {base}/chat/completions`)
> - ✓ / ✗ **Responses** (`POST {base}/responses`)
> - the **model list** (`GET {base}/models`) — with a one-click *"use all N models"*
> - the **curl command + raw output** of every probe, so you can eyeball the exact response

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

### 5. Permissions, backups

```bash
ai-config permission add claude-code
ai-config permission list claude-code
ai-config backup opencode           # snapshot before big changes
ai-config restore opencode ./backup.json
```

### 6. Registry under the hood

Everything lives in a single `registry.json` (plus per-agent materializations). Registry-first means: **one source of truth**, and any agent you add later can be instantly installed into.

## Frequently Asked Questions

<details>
<summary><b>Which agents are supported?</b></summary>

Claude Code, OpenAI Codex (ChatGPT), opencode, Mimo, Kilo Code, Pi, Gemini CLI, Junie, and Oh My Pi (OMP) — 9 adapters, each with format-aware read/write. OMP is detect-only (its YAML settings are honored but not rewritten by design). New agents are a small, well-documented adapter each — see `CONTRIBUTING.md`.

</details>

<details>
<summary><b>Is this safe? Will it overwrite my configs?</b></summary>

Writes are **shape-aware and merge-preserving**: unknown keys in your config files survive untouched, brand-new MCP entries are written without keys your agent wouldn't understand, and server entries merge into existing on-disk structures (your `directTools`, headers, `imports` stay). Every registry write is atomic (temp file + rename), and `ai-config backup <agent>` snapshots files before you do anything risky.

</details>

<details>
<summary><b>Why does the dashboard URL contain a token?</b></summary>

The dashboard is a small web server on your machine that can edit configs, so a per-launch session token protects it: without it, any website you visit could ask your browser to call `http://localhost:PORT/api/…` and read your API keys or rewrite configs. Each launch mints a fresh token; the page keeps working while open, and the token disappears from the address bar after load.

</details>

<details>
<summary><b>What does "Chat Completions vs Responses API" mean?</b></summary>

OpenAI-style gateways expose two wire protocols: the classic **Chat Completions** API (`POST /chat/completions`) and the newer **Responses** API (`POST /responses`). Providers differ — ChatGPT accounts, for example, have removed Chat Completions and only serve Responses. AgentSync verifies **both** when you add a provider, so you instantly see which of your agents can use it (e.g. opencode-style agents expect Chat Completions; Responses-only providers target Responses-capable agents).

</details>

<details>
<summary><b>Can I contribute?</b></summary>

Yes — issues are curated for onboarding and every MR is reviewed by the maintainer's AI assistant, so help is never more than a PR away. See `CONTRIBUTING.md` and the ready-to-paste issue drafts in `docs/community-issues.md`.

</details>

## Repository topics (tags)

`ai` · `agents` · `claude-code` · `codex` · `opencode` · `gemini-cli` · `junie` · `kilo` · `mimo` · `pi` · `mcp` · `model-providers` · `config-management` · `registry` · `cli` · `dashboard` · `react` · `vite` · `typescript` · `local-first` · `privacy`

## License

MIT (add your `LICENSE` file before publishing the repository).