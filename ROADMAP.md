# Product Roadmap — AI Agent Config Manager (working name: AgentSync*)

> *Name check: `agentsync` is **already taken on GitHub** (dallay/agentsync, a symlink-based
> config sync tool). Candidates to replace it: **AgentRegistry**, **ConfigVault**, **AgentControl**.
> Decision pending — tracked in [Open decisions](#open-decisions).

---

## North Star

> **One portal. Every agent. Everything in sync.**
>
> A single, local-first control plane where you manage *everything* about your AI
> coding agents — model providers, models, MCP servers, permissions, **skills**,
> and the **CLI tooling/environment** they run on. Define each thing **once** in the
> registry, install it into any agent, and the portal rewrites their config files for
> you. You never hand-edit another agent config file, and you never wonder whether
> your agents have drifted.

The registry is the single source of truth; the agents' config files are generated
output that stays correct. The GUI is the one portal that sees across all of it.

## The problem (as users experience it)

- Every AI coding CLI has its **own config file, format, and location** (`.claude/…`,
  `.codex/config.toml`, `opencode.json`, `~/.gemini/settings.json`, `~/.pi/…`).
- Testing a provider = configuring it **N times, by hand, in N agent files**.
- MCP servers multiply the pain: each server is a JSON/TOML object per agent, and
  users don't just want *installation* — they want **curation** ("which MCP server
  belongs on which agent, and does my agent still perform with 40 servers attached?").
- **Skills and capabilities** are agent-specific and opaque — users can't easily tell
  which agents support skills, or move a skill from one agent to another.
- The **environment itself drifts**: agent CLIs, package managers (npm/pnpm/bun) and
  runtimes go stale, and users discover broken setups only when something fails.
- The ecosystem is **churning under users' feet** (see evidence below) — configs that
  worked last month silently break, and nobody has a diff to explain why.

## Field evidence (community review, Aug 2026)

| Signal | Where | What it means for us |
| --- | --- | --- |
| **Protocol churn is real and ongoing** — Codex deprecated `wire_api = "chat"`; users build hand-rolled proxies (VibeAround, codex-proxy) to bridge Responses ↔ Chat Completions | [openai/codex#7782](https://github.com/openai/codex/discussions/7782), [LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/comments/1jdytwm/thoughts_on_openais_new_responses_api/) | Our **live API verification** (Chat ✓ / Responses ✓ / Anthropic ✓) is a differentiating feature, not a nice-to-have. Users need to know *before* testing which API an endpoint serves. |
| **MCP tool overload degrades agents** — 30–60+ tools hurt accuracy, latency, cost; OWASP flags excessive tool exposure as an attack surface | [r/mcp](https://www.reddit.com/r/mcp/comments/1skpbwy/58_mcp_servers_680_tools_how_i_avoid_tool_sprawl/), [Medium — "150 tools"](https://medium.com/@devalshah1619/your-ai-agent-has-150-tools-and-cant-do-anything-right-c31665c1ac54), [lunar.dev](https://www.lunar.dev/post/why-is-there-mcp-tool-overload-and-how-to-solve-it-for-your-ai-agents), [OWASP](https://genai.owasp.org/resource/cheatsheet-a-practical-guide-for-securely-using-third-party-mcp-servers-1-0/) | MCP management must be **selective and visible**: per-agent scoping, tool counts, cost/token awareness — not just copy-everything-to-everyone. |
| **The "config fragmentation" market is now crowded** — at least 7 projects solve variations (instructions-first: agnostic-ai, config-sync, re-agent, agentstd, azat-io/ai-config; capabilities/bidirectional: provider-config-sync, agent-setup) | GitHub (linked above) | Fast-follower growth. Our defensible edge: **registry-first (providers + keys + MCP + skills) with GUI + live verification** — competitors are mostly instruction-file sync without connectivity probing or a dashboard. |
| **Effort drifts to "harness" not model** — users report switching tools costs "a week, not an afternoon"; onboarding a new agent takes an evening | [dev.to — 10 tips multi-agent](https://dev.to/davidmorais/10-tips-f-cig), [Moving 3-agent team](https://www.reddit.com/r/Anthropic/comments/1uvfq99/moving_my_threeagent_team_from_claude_code_to/) | **Zero-friction agent onboarding** is a headline job: add agent → everything it needs is already in the registry. |
| **Registry & governance trend** — enterprise platforms are building "agent registries" (Port, MS Agent 365); academic surveys frame registry-as-infrastructure | [arXiv 2508.03095](https://arxiv.org/html/2508.03095v3), [Cloud Wars/Agent 365](https://cloudwars.com/ai/microsoft-outlines-security-governance-and-interoperability-features-coming-to-microsoft-agent-365) | Long-term direction: our local registry is the personal-device version of the same mental model. Positioning language should use "registry/control plane", not "config editor". |

## Strategic pillars

**P1 — Registry-first completeness.** Providers, models, MCP servers, permissions,
skills: define each once, materialize everywhere, trust the output (shape-aware,
merge-preserving writes). Deletions cascade — removing a provider strips it from every
agent it was installed into.

**P2 — Verification & intelligence.** Every connection is *probed, not promised*:
live API support (chat / responses / anthropic), live model lists, per-agent
compatibility, stale-verification awareness.

**P3 — MCP & skill curation/safety.** Install is half the job; the other half is
*which server/skill on which agent*, capability checks (does this agent support
skills?), tool exposure budgets, and secret hygiene (env-var references over inline
keys, OWASP-aligned defaults).

**P4 — Environment & tooling health.** The portal also sees the *runtime* your agents
depend on: detect the CLIs and package managers on the machine (npm, pnpm, bun, node,
git, …), surface what's installed vs missing vs out-of-date, and let the user update
them in place. One portal for config **and** environment.

## Horizon plan

### ✅ v0.1.0 — shipped

Multi-agent detection · provider registry + per-agent install/remove · model
management · MCP add/list/remove per agent · permissions · backup/restore · CLI
surface (`detect`, `provider`, `model`, `mcp`, `permission`, `gui`) · dashboard with
registration/install UX, light/dark themes, local-first URL (`127.0.0.1` + per-launch
token) · **live API verification** (/models, /chat/completions, /responses — curl +
raw output, persisted) · provider details view (copy key/URL, re-test).

### ✅ v0.2 — shipped

- **Install / uninstall agent CLIs from the dashboard** — whitelisted commands from a
  maintained agent catalog (`packages/core/src/agent-catalog.json`) run via the GUI
  server with live streamed output, confirm-by-typing for uninstalls, safe-command
  gate (`isSafeCommand`), per-agent concurrency guard, auto re-detection on finish.
- **Maintained agent catalog** — versioned JSON with per-platform install/uninstall
  commands; unknown agents discovered on the machine surface under a "new" badge;
  dashboard shows **Installed** first, then **Available to Install**.

### ✅ v0.2.x — shipped (this cycle)

- **32-agent catalog with wire-API metadata** — every entry declares `apiTypes`
  (`chat` / `responses` / `anthropic`) plus config/credential paths per platform and a
  real adapter; new adapters for kimi, qwen, cursor-cli, cline, droid, goose,
  continue, crush.
- **Dashboard revamp** — KPI stat cards, protocol-coverage bars, detected-agents strip
  with API badges, per-protocol verification ✓/✗; dependency-free windowing, memoized
  rows, catalog fetched once per session (no new deps, ~82 kB gzipped).
- **Reusable, optimized component library** + a minimal-agentic design system
  (theme-aware contrast tokens, AA in light+dark, reduced-motion aware).

### ✅ v0.3 "One Portal" — shipped

The release that made it *the* single portal for config **and** environment.

| Deliverable | Pillar | Impact | Status |
| --- | --- | --- | --- |
| **Provider-delete cascade** — deleting a provider strips it from every agent's on-disk config, not just the registry | P1 | Registry and agents can't silently disagree | ✅ shipped (covered by `registry-delete-cascade.test.ts`) |
| **Catalog expansion** — aion cli, DeepSeek harness, and more qualifying CLIs (adapter + apiTypes + config paths); 37 entries, catalog v12 | P1/P2 | More agents onboarded with zero hand-editing | ✅ shipped |
| **Skill management platform** — shared skill library (`<config home>/skills`, SKILL.md folders), browse/create skills, see which agents support skills (catalog `skillsPaths`: Claude Code, Codex, OpenCode, AionUi), assign/remove per agent | P3 | First-class skill curation across agents | ✅ shipped |
| **CLI tools tab** — detect npm/pnpm/bun/node/git/etc., installed vs missing, user-triggered re-check | P4 | Environment health visible at a glance | ✅ shipped |
| **CLI update checker + in-UI updates** — installed vs latest, "update available vX→vY", run the update from the portal (safe allow-listed commands, user-initiated only) | P4 | Keep the toolchain current without leaving the portal | ✅ shipped |
| **Settings revamp + project-wide minimal-agentic theme** — extremely low RAM, AA contrast, Lucide icons | — | A portal that feels as good as it works | ✅ shipped |
| **Reusable, optimized component library** (`src/ui/`) + dashboard revamp (KPI cards, windowing, memoization) | — | Fast, consistent, low-RAM UI | ✅ shipped |
| **roadmap.md** — this document, kept current as the single-portal plan | — | Shared direction for maintainers + contributors | ✅ shipped |

### 🔭 Later — v0.4 "Drift & Share"

- **Drift detection watcher** — agents edited configs outside the tool? Show a diff, offer re-sync (registry → agent, or agent → registry "import").
- **Registry export/import** (dashboard parity with CLI backup/restore); **git-friendly registry format** (pretty-printed, diffable, committable).
- **Presets & templates** — common MCP/skill stacks, common provider profiles; one-clipboard onboarding for a new agent.
- **OS keychain integration** for API keys (macOS Keychain / libsecret) with registry storing only references.
- **MCP exposure dashboard** — tool counts per server + overload warning (≥30 tools).

### 🧭 Explore — v0.5 "Registry as control plane"

- Migration assistant: convert a single agent's existing config into registry entries (reverse materialization).
- Team sharing: share a registry via git; scope by project (`.agents/`-style layout awareness) vs global.
- Adapter SDK + community adapter catalog (new agents in hours, not weeks).
- Optional MCP-server exposure of the registry (let any MCP-capable agent *query* its own wiring).

## Non-goals (unless asked)

- ❌ Not an agent runtime — we never execute tools or models.
- ❌ No cloud hosting, no accounts, no telemetry — local-first by design (privacy is a feature).
- ❌ No OAuth driver — we write configs; per-tool login stays with the tool.
- ❌ No destructive environment changes without an explicit user action (updates are opt-in and confirmed).

## Open decisions

1. **Name** — `agentsync` is taken. Pick from AgentRegistry / ConfigVault / AgentControl, or propose another. (Affects README badges + repo creation only.)
2. **Audience** — individual power users first (assumed here) vs. teams (pulls v0.4 team sharing forward). Recommendation: individuals first; keep registry format team-ready.
3. **Distribution** — `npm`/`brew` install as a growth lever: decide when the v0.3 feature set justifies packaging.

**Decided:** *Skill source of truth* — v0.3 ships a local library (`<config home>/skills`,
SKILL.md folders) as the source of truth; assigning copies a skill into the agent's own
skills directory (registry-first, same philosophy as providers). A curated remote index
remains a possible v0.4+ enhancement.

## Success metrics (draft)

- **Setup time:** adding a new provider to N agents: manual ≈ 2–3 min × N → tool < 1 min total.
- **Verification usage:** ≥ 60% of providers registered via dashboard have a persisted verification within 7 days of use.
- **Cascade correctness:** 0 reports of a deleted provider lingering in any agent config.
- **Environment health:** users can see installed/missing/out-of-date CLIs for npm/pnpm/bun at a glance; ≥ 50% run an in-portal update within a month.
- **MCP/skill curation:** median servers-per-agent ≤ 10; skill assignments only offered to skill-capable agents.
- **Performance:** dashboard stays lean (no new heavy deps, low RAM, fast initial paint) as the catalog grows.
- **Community:** ≥ 2 external MRs/month once issue templates + CI land.

## How decisions get made

Evidence (community threads, issues) → roadmap item → `docs/community-issues.md` draft
→ one small PR → reviewed by maintainer + AI assistant → release. Every roadmap item
above traces to at least one evidence row or shipped-feature gap.
