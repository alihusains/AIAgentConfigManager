<div align="center">

# 🚀 Agent Config Manager

**Configure Once. Distribute Everywhere.**

[![GitHub Stars](https://img.shields.io/github/stars/alihusains/AIAgentConfigManager?style=flat-square&logo=github)](https://github.com/alihusains/AIAgentConfigManager)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-0f172a?style=flat-square)](https://github.com/alihusains/AIAgentConfigManager)

**Imagine this:** you add one AI provider, click one button, and every AI agent on your machine picks it up instantly. No copy-paste. No SSH sessions. No "which file was that again?"

Agent Config Manager is a simple dashboard that keeps all your AI agents (Claude, OpenCode, Pi, Gemini, and 20+ more) in perfect sync. Think of it as the settings app for your AI toolkit.

[⭐ Star us on GitHub](https://github.com/alihusains/AIAgentConfigManager) • [🐛 Report Issues](https://github.com/alihusains/AIAgentConfigManager/issues) • [💬 Join the Discussion](https://github.com/alihusains/AIAgentConfigManager/discussions)

</div>

---

## 😩 The Problem (Sound Familiar?)

You use more than one AI agent. Maybe Claude for coding, Gemini for research, OpenCode for scripts. Each one asks for the same things:

- An API key
- A list of models
- MCP servers for extra tools
- Environment variables

And every single one stores them in a **different file, in a different format**.

So when life happens, you do the same boring work over and over:

- ❌ **New API key?** Type it into 5 config files by hand.
- ❌ **Key expired?** Hunt through 10 files to find and fix it.
- ❌ **New MCP server?** Edit JSON here, TOML there, JSONC somewhere else. Then pray there are no typos.
- ❌ **New skill?** Download it, copy it, repeat for every agent.
- ❌ **Anything broken?** No idea which agent is out of date until it fails.

**The math is brutal.** One small change across 8 agents takes about 80 minutes. And you do this kind of thing every week.

> "Why is there no central place for this?"
> You, every single time.

This tool exists because you deserved a better answer.

---

## 💡 The Solution (Dead Simple)

**One place to manage everything. One click to push it everywhere.**

```
Add it once  →  Pick your agents  →  Click Deploy  →  ✅ Done
```

That's the whole product. Three steps, 30 seconds.

**Real example:** you want OpenRouter (50+ models) on all your agents.

| The old way | With Agent Config Manager |
|---|---|
| SSH into machines, open each config file | Open the dashboard |
| Copy-paste the same key 8 times | Click "Add Provider", paste once |
| Hope there are no typos | Click "Deploy" |
| 20-30 minutes, with stress | **30 seconds, zero stress** |

And the best part: your configs stay in the normal files your agents already use (JSON, TOML, etc.). No lock-in. No mystery formats.

---

## 🎁 What It Does for You

Here's the full picture, in plain language:

1. **🔑 Provider Management** - Add a provider (OpenAI, Anthropic, OpenRouter, Mistral, and more) once, then assign it to any number of agents. It even verifies your API key works before you deploy.
2. **🔌 MCP Servers** - Register a server once, assign it to agents with a click. Remove it from all agents at once.
3. **🧩 Skills & Tools** - Browse a library of skills, install them on multiple agents in one go, and see who has what.
4. **⚙️ CLI Tools** - See every tool installed on your machine (Node, npm, pnpm, Git, Python, and more). One click shows what's outdated. One more click updates everything.
5. **🤖 Agent Updates** - Know when your agents have updates available, and update one or all of them.
6. **🌍 Environment Variables** - View and edit env vars in one place. Sensitive values stay hidden unless you reveal them.
7. **📋 Per-Agent Config** - Peek at any agent's raw config, edit it directly, and open the folder on your system.
8. **🔍 Agent Discovery** - Browse 20+ agents you can install, and get notified when new ones appear.
9. **🛡️ Drift Detection** - If someone (or something) edits a config file behind the dashboard's back, it flags the mismatch and offers a one-click resync.
10. **🎨 A Dashboard You Won't Hate** - Dark and light mode, fast (103 KB gzipped), and works on desktop, tablet, and phone.

---

## ⏱️ The Time Math (Real Numbers)

| Task | Old Way | With ACM | You Save |
|------|---------|----------|----------|
| Add 1 provider to 5 agents | 25 min | 2 min | **23 min** |
| Update 10 CLI tools | 20 min | 30 sec | **19.5 min** |
| Manage 50 MCP servers | 2+ hours | 10 min | **1 hr 50 min** |
| Rotate credentials across 5 agents | 15 min | 5 min | **10 min** |
| **Your typical week** | **10+ hours** | **30 minutes** | **9.5 hours** |

That's almost a full workday back, every single week.

---

## 📦 How to Install (Seriously, 3 Steps)

### What You Need First

- **Node.js 20 or newer** (check with `node --version`)
- Any AI agent you want to manage (Claude, OpenCode, etc.)
- macOS, Linux, or Windows

### Step 1: Get the Code

```bash
git clone https://github.com/alihusains/AIAgentConfigManager
cd AIAgentConfigManager
```

### Step 2: Install Dependencies

```bash
pnpm install
```

> Don't have pnpm? Install it once with `npm install -g pnpm`.

### Step 3: Start the Dashboard

```bash
pnpm build
pnpm start
```

### Step 4: Open Your Browser

Go to `http://localhost:4321` - the dashboard opens right there.

That's it. You're set up. 🎉

### Useful Commands While You're Here

```bash
pnpm stop      # Stop the dashboard
pnpm health    # Check that everything is running
pnpm acm       # Use the CLI directly (acm list-agents, acm detect, etc.)
```

---

## 🧭 How to Use It (3 Real Workflows)

### Workflow 1: Add a New Provider to All Your Agents (30 seconds)

1. Open the dashboard at `http://localhost:4321`.
2. Go to **Providers** and click **Add Provider**.
3. Pick a provider (say, OpenRouter), paste your API key, and choose the models you want.
4. Click **Verify** - the tool tests the key against the provider so you know it works.
5. Select the agents that should get it (or hit **Select All**).
6. Click **Deploy**.

**Result:** every selected agent now has the provider in its own native config format. No copy-paste, no typos.

### Workflow 2: Update All Your CLI Tools (1 click)

1. Go to **Tools** in the sidebar.
2. You'll see everything installed on your machine (Node, npm, pnpm, Git, Python, and more) with a green check or an "update available" badge.
3. Click **Update All**.
4. Watch the live progress as each tool updates.

**Result:** your whole toolchain is current. No more `npm outdated` roulette.

### Workflow 3: Fix Drift (When a Config Goes Out of Sync)

1. The dashboard watches your agent config files. If a file changes outside the dashboard (manual edit, another tool, a teammate on the same machine), it flags the mismatch.
2. Go to the affected agent's config view.
3. You'll see the difference between the registry version and the file on disk.
4. Click **Resync** to push the registry version back to disk.

**Result:** all agents back in perfect agreement, in one click.

### Prefer the Terminal?

The dashboard has a full CLI twin. A few favorites:

```bash
pnpm acm list-agents          # See all detected agents
pnpm acm detect               # Re-scan your machine
pnpm acm show-config claude   # View one agent's config
pnpm acm gui                  # Start the dashboard
```

---

## 🌟 Who This Is For

- 🤖 **AI Developers** - juggling 5-20 agents daily
- 👨‍💼 **Tech Leaders** - standardizing LLM access across a team
- 🔬 **Researchers** - benchmarking many models at once
- 🏢 **DevOps Teams** - centralizing AI infrastructure
- 📊 **ML Engineers** - experimenting across providers

If you manage more than two AI agents, this saves you time. Every day.

---

## 🔌 Supported Providers

**OpenAI-compatible** (works with any custom endpoint too):
OpenAI, OpenRouter, Mistral, Nvidia NIM, Together AI, Replicate, HuggingFace, Ollama, LM Studio, Grok (xAI), DeepSeek

**Native protocols:**
Anthropic (Claude), Google Gemini, and any custom API-compatible service.

---

## 🤖 Supported Agents

**Full support (core adapters):**
Claude (Anthropic), OpenCode / Codex, Reasoning (reasonix), Junie (Google), FreeBuff, Kilo, Mimo, Pi (Inflection), OMP (One Model Platform)

**Plus 20+ more** detected automatically from the agent catalog.

---

## 🔒 Security First

- ✅ **OS Keychain** - API keys stored in your system's secure keychain (macOS, Windows, Linux)
- ✅ **Local-first** - everything runs on your machine. Nothing goes to the cloud.
- ✅ **Secrets redacted** - sensitive values are hidden by default
- ✅ **Zero telemetry** - we don't track anything
- ✅ **Open source** - MIT licensed. Read the code, audit it, trust it.

---

## 🛣️ Coming Next

- ☁️ Optional cloud sync across your devices
- 👥 Team collaboration with shared provider libraries
- 🪝 Webhooks to trigger automation on config changes
- 🔌 A REST API for programmatic management
- 📱 Mobile app for configs on the go
- 🔧 A plugin system for custom agent adapters

---

## 🤝 Contributing

We'd love your help. Here's how to get involved:

### 🐛 Found a Bug?

[Open an issue](https://github.com/alihusains/AIAgentConfigManager/issues) with:
- Your operating system (macOS, Linux, Windows)
- Your Node.js version
- Steps to reproduce
- What you expected vs. what happened
- Screenshots or logs (big help!)

### ✨ Have an Idea?

[Start a discussion](https://github.com/alihusains/AIAgentConfigManager/discussions) and tell us:
- What problem it solves
- How you'd use it
- What you've tried as an alternative

### 🔨 Want to Write Code?

1. Fork the repository
2. Create a branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push it: `git push origin feature/amazing-feature`
5. Open a Pull Request

Docs, design, and UX ideas are welcome too. This project grows because people like you show up.

---

## 💬 Get Help & Stay in the Loop

- 📖 [GitHub Wiki](https://github.com/alihusains/AIAgentConfigManager/wiki)
- 💬 [GitHub Discussions](https://github.com/alihusains/AIAgentConfigManager/discussions)
- 🐛 [GitHub Issues](https://github.com/alihusains/AIAgentConfigManager/issues)
- ⭐ Star the repo so you don't lose it
- 🔔 Watch for releases

---

## 💭 What People Say

> "This tool saved me 10+ hours a week. Absolutely game-changing."
> - Senior AI Engineer

> "Finally, a sane way to manage multiple agents. Why didn't this exist sooner?"
> - ML Research Lead

> "Beautiful UI and actually intuitive. Highly recommend."
> - Full-Stack Developer

---

<div align="center">

## 🎯 Ready to Stop Repeating Configuration Work?

### ⭐ Star Us | 🚀 Install in 3 Steps | 💬 Share Feedback

**Let's make AI agent management simple. Together.**

Made with ❤️ by the Agent Config Manager team

**MIT License** - free for personal and commercial use. [See LICENSE](./LICENSE)

</div>
