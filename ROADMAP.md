# Product Roadmap — AI Agent Config Manager (working name: AgentSync*)

> *Name check: `agentsync` is **already taken on GitHub** (dallay/agentsync, a symlink-based
> config sync tool). Candidates to replace it: **AgentRegistry**, **ConfigVault**, **AgentControl**.
> Decision pending — tracked in [Open decisions](#open-decisions).

---

## North Star

> **One definition. Every agent. In sync.**
>
> A user who runs Claude Code, Codex, opencode, Gemini CLI, Kilo, Pi, Mimo and Junie
> should be able to add a provider **once**, assign it to the agents that need it,
> and never hand-edit another agent config file again. The registry is the single
> source of truth; the agents' config files are generated output that stays correct.

## The problem (as users experience it)

- Every AI coding CLI has its **own config file, format, and location** (`.claude/…`,
  `.codex/config.toml`, `opencode.json`, `~/.gemini/settings.json`, `~/.pi/…`).
- Testing a provider = configuring it **N times, by hand, in N agent files**.
- MCP servers multiply the pain: each server is a JSON/TOML object per agent, and
  users don't just want *installation* — they want **curation** (“which MCP server
  belongs on which agent, and does my agent still perform with 40 servers attached?”).
- The ecosystem is **churning under users' feet** (see evidence below) — configs that
  worked last month silently break, and nobody has a diff to explain why.

## Field evidence (community review, Aug 2026)

| Signal | Where | What it means for us |
|---|---|---|
| **Protocol churn is real and ongoing** — Codex deprecated `wire_api = "chat"`; users are building hand-rolled proxies (VibeAround, codex-proxy) to bridge Responses ↔ Chat Completions | [openai/codex#7782](https://github.com/openai/codex/discussions/7782), [LocalLLaMA](https://www.reddit.com/r/LocalLLaMA/comments/1jdytwm/thoughts_on_openais_new_responses_api/) | Our **live API verification** (Chat ✓ / Responses ✓) is a differentiating feature, not a nice-to-have. Users need to know *before* testing which API an endpoint serves. |
| **MCP tool overload degrades agents** — 30–60+ tools hurt accuracy, latency, cost; OWASP flags excessive tool exposure as an attack surface | [r/mcp](https://www.reddit.com/r/mcp/comments/1skpbwy/58_mcp_servers_680_tools_how_i_avoid_tool_sprawl/), [Medium — "150 tools"](https://medium.com/@devalshah1619/your-ai-agent-has-150-tools-and-cant-do-anything-right-c31665c1ac54), [lunar.dev](https://www.lunar.dev/post/why-is-there-mcp-tool-overload-and-how-to-solve-it-for-your-ai-agents), [OWASP](https://genai.owasp.org/resource/cheatsheet-a-practical-guide-for-securely-using-third-party-mcp-servers-1-0/) | MCP management must be **selective and visible**: per-agent scoping, tool counts, cost/token awareness — not just copy-everything-to-everyone. |
| **The "config fragmentation" market is now crowded** — at least 7 projects solve variations (instructions-first: agnostic-ai, config-sync, re-agent, agentstd, azat-io/ai-config; capabilities/bidirectional: provider-config-sync, agent-setup) | GitHub (linked above) | Fast-follower growth. Our defensible edge: **registry-first (providers + keys + MCP) with GUI + live verification** — competitors are mostly instruction-file sync without connectivity probing or a dashboard. |
| **Effort drifts to "harness" not model** — users report switching tools costs "a week, not an afternoon"; onboarding a new agent takes an evening | [dev.to — 10 tips multi-agent](https://dev.to/davidmorais/10-tips-f-cig), [Moving 3-agent team](https://www.reddit.com/r/Anthropic/comments/1uvfq99/moving_my_threeagent_team_from_claude_code_to/) | **Zero-friction agent onboarding** is a headline job: add agent → everything it needs is already in the registry. |
| **Registry & governance trend** — enterprise platforms are building "agent registries" (Port, MS Agent 365); academic surveys frame registry-as-infrastructure | [arXiv 2508.03095](https://arxiv.org/html/2508.03095v3), [Cloud Wars/Agent 365](https://cloudwars.com/ai/microsoft-outlines-security-governance-and-interoperability-features-coming-to-agent-365) | Long-term direction: our local registry is the personal-device version of the same mental model. Positioning language should use "registry/control plane", not "config editor". |

## Strategic pillars

**P1 — Registry-first completeness.** Providers, models, MCP servers, permissions:
define each once, materialize everywhere, trust the output (shape-aware, merge-preserving writes).

**P2 — Verification & intelligence.** Every connection is *probed, not promised*:
live API support (chat vs responses), live model lists, per-agent compatibility,
stale-verification awareness.

**P3 — MCP curation & safety.** Install is half the job; the other half is
*which server on which agent*, tool exposure budgets, and secret hygiene
(env-var references over inline keys, OWASP-aligned defaults).

## Horizon plan

### ✅ Now — v0.1.0 (shipped)
Multi-agent detection (8 CLIs detected locally, 9 adapters) · provider registry +
per-agent install/remove · model management · MCP add/list/remove per agent ·
permissions · backup/restore · CLI surface (`detect`, `provider`, `model`, `mcp`,
`permission`, `gui`) · dashboard with registration/install UX, light/dark themes,
clean local-first URL (`127.0.0.1` + per-launch token) · **live API verification**
(/models, /chat/completions, /responses — curl + raw output, persisted) · provider
details view (copy key/URL, re-test).

### ✅ v0.2 shipped so far (Aug 20, 2026)
- **Install / uninstall agent CLIs from the dashboard** — whitelisted commands from a
  maintained agent catalog (`packages/core/src/agent-catalog.json`) run via the GUI
  server with live streamed output, confirm-by-typing for uninstalls, safe-command
  gate (`isSafeCommand`), per-agent concurrency guard, auto re-detection on finish.
- **Maintained agent catalog** — 11 known agents (9 adapters + reasonix, freebuff),
  versioned JSON with per-platform install/uninstall commands; unknown agents
  discovered on the machine still surface under a "new" badge. The dashboard now
  shows **Installed** agents first, then **Available to Install**.

### ▶️ Next — v0.2 “Trust & Curate” (this is the community-issues backlog)
| Deliverable | Impact |
|---|---|
| Agent compatibility hints in install flows (family → chat/responses/anthropic) | Answer "will this provider even work for opencode?" before clicking install |
| Anthropic-style verification (`x-api-key` + `/v1/messages`) | Third major auth family covered; parity for `anthropic`-type providers |
| Edit-modal “Use all N models” + verification-age display | Completes the verification loop (P2) |
| MCP exposure dashboard: tool counts per server + overload warning (≥30 tools) | Direct answer to the #1 community MCP complaint (P3) |
| Secret hygiene: env-var references in emitted configs (per-agent syntax matrix), warn on inline keys | OWASP alignment; audit-ready configs (P3) |
| Keyboard shortcuts, window-state persistence | Dashboard velocity (P2/P3 feel) |
| Unit tests for verification engine + TS check in CI | Engineering trust; enables community MRs |

### 🔭 Later — v0.3 “Drift & Share”
- **Drift detection watcher** — agents edited configs outside the tool? Show a diff, offer re-sync (registry → agent, or agent → registry “import”).
- **Registry export/import** (dashboard parity with CLI backup/restore); **git-friendly registry format** (pretty-printed, diffable, committable).
- **Presets & templates** — common MCP stacks (filesystem+memory+search), common provider profiles; one-clipboard onboarding for a new agent.
- **OS keychain integration** for API keys (macOS Keychain / libsecret) with registry storing only references.

### 🧭 Explore — v0.4 “Registry as control plane”
- Migration assistant: convert a single agent's existing config into registry entries (reverse materialization).
- Team sharing: share a registry via git; scope by project (`.agents/`-style layout awareness) vs global.
- Adapter SDK + community adapter catalog (new agents in hours, not weeks).
- Optional MCP-server exposure of the registry (let any MCP-capable agent *query* its own wiring — pattern shown by provider-config-sync).

## Non-goals (unless asked)
- ❌ Not an agent runtime — we never execute tools or models.
- ❌ No cloud hosting, no accounts, no telemetry — local-first by design (privacy is a feature).
- ❌ No OAuth driver — we write configs; per-tool login stays with the tool.

## Open decisions
1. **Name** — `agentsync` is taken. Pick from AgentRegistry / ConfigVault / AgentControl, or propose another. (Affects README badges + repo creation only.)
2. **Audience** — individual power users first (v0.2 plan above assumes this) vs. teams (pulls v0.4 team sharing forward). Recommendation: individuals first; keep registry format team-ready.
3. **Distribution** — `npm`/`brew` install as a growth lever: decide when v0.2 feature set justifies packaging.

## Success metrics (draft)
- **Setup time:** adding a new provider to N agents: manual ≈ 2–3 min × N → tool < 1 min total.
- **Verification usage:** ≥ 60% of providers registered via dashboard have a persisted verification within 7 days of use.
- **Drift incidents:** verified-config drift themes reported in issues → 0 “silent breakage” classes without a mitigation.
- **MCP curation:** median servers-per-agent ≤ 10 for dashboard users; overload warnings surfaced before performance complaints.
- **Community:** ≥ 2 external MRs/month once issue templates + CI land (v0.2).

## How decisions get made
Evidence (community threads, issues) → roadmap item → `docs/community-issues.md` draft
→ one small PR → reviewed by maintainer + AI assistant → release. Every roadmap item
above traces to at least one evidence row or shipped-feature gap.