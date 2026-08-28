# Product Roadmap

**Product:** AI agent config manager (working name AgentSync, final name undecided, see [Open decisions](#open-decisions))
**Audience for this document:** maintainer, contributors, and anyone deciding whether to depend on this tool
**Date:** 2026-08-28
**Companion documents:** [ROADMAP.md](ROADMAP.md) (release history and pillars), [docs/community-issues.md](docs/community-issues.md) (ready-to-paste backlog)

---

## The problem, in one sentence

A developer running Cursor and Claude Code in the same repo can have Cursor rules that allow unrestricted Bash while CLAUDE.md forbids it, so the agent's effective permissions depend on which tool they happened to launch ([source](https://dev.to/avifenesh/your-ai-agent-configs-are-probably-broken-and-you-dont-know-it-16n1)).

That is the whole thesis. Every AI coding agent keeps its own config file, in its own format, at its own path. Providers, API keys, model lists, MCP servers, and permissions get duplicated by hand across all of them. The copies drift, nothing detects the drift, and the failure shows up later as a broken agent, a contradictory permission, or a key that still works somewhere it should not.

This tool answers with a registry: define each provider, model, MCP server, and permission once, install it into any agent, and let format-aware adapters rewrite each agent's config file without touching what they don't understand.

## Evidence base

We collected 20 sourced findings from dev blogs, GitHub issues, Hacker News, and security research (August 2026). The strongest signals:

**Fragmentation is the default experience.** Every MCP client uses a different config file, path, and schema ([chatforest.com](https://chatforest.com/guides/mcp-setup-ai-coding-tools/)). Developers hand-maintain a canonical `~/.mcp-servers.json` and copy it per tool as a workaround ([remoet.dev](https://www.remoet.dev/blog/how-to-set-up-mcp-server-claude-cursor-windsurf)). Teams running three tools report that someone always misses updating one instruction file, and the miss stays invisible until an agent acts on the stale copy ([getunblocked.com](https://getunblocked.com/blog/keeping-claude-md-agents-md-cursorrules-in-sync/)). Developers describe spending hours converting configs when they switch tools ([programmerspace.substack.com](https://programmerspace.substack.com/p/agentsmd-explained-how-one-file-is)).

**Secrets in config files are the industry's open wound.** Local MCP client configs routinely hold OAuth tokens and API keys in plaintext ([thehackernews.com](https://thehackernews.com/2026/08/how-mcp-servers-can-expose-enterprise.html)). A scan of 7,000+ public MCP servers found 36.7% potentially vulnerable to SSRF, some with no client auth at all ([Checkmarx](https://checkmarx.com/learn/mcp-security-risks-real-world-incidents-and-security-controls/)). Security guidance is converging on one recommendation: pull credentials out of config files and into a governed store ([obot.ai](https://obot.ai/blog/mcp-security-inside-the-rising-crisis-of-exposed-agent-credentials/)). Agents also accumulate permissions across systems that nobody would approve if requested all at once ([knostic.ai](https://www.knostic.ai/blog/mcp-security)).

**Demand shows up as feature requests.** OpenCode users asked it to read Claude Code's `.mcp.json` directly because forcing a second config file on a shared repo is friction ([opencode#14888](https://github.com/anomalyco/opencode/issues/14888)), and asked for project-level MCP config matching Claude Code's model ([opencode#9931](https://github.com/anomalyco/opencode/issues/9931)).

**Caveat on sourcing.** Our search surfaced dev blogs, GitHub issues, HN threads, and security research. Direct Reddit-thread evidence (r/ChatGPTCoding, r/LocalLLaMA, r/cursor, r/ClaudeAI) did not come through the search tooling we used, so this evidence base leans on written-up accounts rather than raw community posts. Treat claims about "what Reddit says" in any of our material with that in mind. ROADMAP.md's field-evidence table carries some Reddit links gathered earlier; we have not re-verified them this cycle.

## Where we actually stand (August 2026)

The honest inventory, including what is broken:

**Shipped and working.**
- 24 adapters (count verified against the adapter registry in `packages/core/src/adapters/index.ts`): Claude Code, Codex, opencode, Mimo, Kilo, Pi, Gemini CLI, Junie, FreeBuff, Kimi, Qwen, Cursor CLI, Cline, Droid, Goose, Continue, Crush, Windsurf, Roo Code, Aider, Zed, Amazon Q, Copilot CLI, and OMP. Six of these (Windsurf, Roo Code, Aider, Zed, Amazon Q, Copilot CLI) landed this cycle.
- Two of the 24 are detect-only, deliberately. **Aider** has no native MCP support (verified against its source and HISTORY.md, not assumed), so there is nothing for us to write. **OMP** was investigated for full read/write and descoped on purpose: its YAML provider store, MCP import behavior, and permission model do not map onto our unified schema, and forcing the mapping would have meant type surgery across the codebase disproportionate to the value. The owner reverted to an honest detect-only adapter instead of shipping a half-migration. We would rather state a limitation than fake coverage; anyone evaluating this repo should read that as policy, not as an apology.
- A 37-entry agent catalog with per-platform install/uninstall commands, wire-API metadata, and config paths.
- Live API verification (`/models`, `/chat/completions`, `/responses`) with curl and raw output shown to the user.
- CLI surface (`detect`, `provider`, `model`, `mcp`, `permission`, `backup`, `gui`) and a local-first dashboard behind a per-launch session token.

**Broken until this cycle (status at time of writing, 2026-08-28).**
- **Provider delete cascade regressed and was caught in the wild.** Deleting a provider from the dashboard either did nothing (multi-agent case) or showed a success toast while the agent still listed the provider (single-agent case, reproduced against Mimo; root cause involved GUI-encoded provider ids with spaces). A fix now sits in the working tree with four passing regression tests covering the multi-agent cascade and both spaced-id symptoms (`gui-server-delete.test.ts`), but it is not yet committed or verified end to end in the dashboard. Until that verification lands, treat the README's cascade claim as test-backed intent, not a proven guarantee.
- **Codex rename bug** produced a second silent failure; fixed this cycle (commit history: `fix(core)` series).

**Debt we are carrying.**
- **GUI design debt.** A full audit (`docs/audits/gui-design-audit.md`) found weak typographic hierarchy (page titles at 20px, stat values at body size), four competing accent hues, two divergent dark themes that render differently depending on how dark mode is triggered, hardcoded hex values that never adapt to theme, pill badges on nearly every data point, and a better StatCard design that exists as dead CSS while the worse one ships.
- **Test coverage was thin until this round.** Seven adapters had no tests and `packages/gui` had no test script at all. Measured on 2026-08-28: core 88 passing (1 skipped), cli 24 passing, gui 32 passing, 144 total. Coverage is now real but young, and no coverage-percentage claim is made because none has been measured.
- **Lint was formatting-only.** `pnpm lint` checked whitespace, not correctness. Real lint rules are landing with the current fixes.

**What we do not have at all.**
- **No secrets story.** API keys live in plaintext inside `registry.json` and inside every agent config we materialize them into. We are exactly the plaintext-key pattern the security findings above describe, multiplied across 24 agents. This is the largest gap between what the evidence says matters and what the product does.
- No drift detection: if an agent's config is edited outside the tool, nothing notices.
- No packaged distribution (`npm`/`brew`); users build from source.

## Competitive landscape

The config-fragmentation space is active. An honest map:

| Project | What it does | Where we differ |
|---|---|---|
| [agent-permissions](https://github.com/Mearman/agent-permissions) | One `.agents/permissions.json` policy file evaluated across agents, deny-first, with a sync daemon | Permissions only. No providers, models, MCP install, or GUI. Its policy format is a candidate for us to read or emit rather than compete with. |
| agnix | Lints agent configs (skills, hooks, MCP, agent definitions) across seven tools | Validation only; it reports problems but does not write configs. A natural complement: we write, it checks. |
| agent-contract-tests | CI gate: YAML tool-ACL registry, fails builds when an agent declares an ungranted tool | Team CI enforcement, not local management. Different layer of the stack. |
| agent-kit, anywhere-agents, and the instruction-sync cluster | Derive CLAUDE.md/GEMINI.md/copilot-instructions from one AGENTS.md; sync instruction files across repos | Instructions only. None of them touch providers, keys, model lists, MCP server installs, or verification. |

What no one else in this list does: format-aware write across 24 agents, live API verification before you trust a provider, and a GUI over all of it. What several of them do better than us today: permissions policy depth (agent-permissions) and validation (agnix). Where the evidence points, we should interoperate with those rather than rebuild them. That is on the roadmap below, not a vague intention.

### Why this still matters if AGENTS.md wins

AGENTS.md is consolidating as a real standard: Linux Foundation stewardship, 30+ tools reading it as of mid-2026 ([thepromptshelf.dev](https://thepromptshelf.dev/blog/agents-md-vs-claude-md-vs-gemini-md-2026/)). A fair question follows: if one instruction file works everywhere, why does this tool exist?

Because AGENTS.md covers instructions and nothing else. It does not carry provider base URLs, API keys, model lists, MCP server definitions, or permission grants, and the tools that read it still keep all of those in their own incompatible files. The instruction layer standardizing is good for us: it removes the crowded, low-differentiation part of the problem and leaves the part that involves credentials, connectivity, and write-access to config files, which is where a registry with verification earns its keep. If AGENTS.md later grows scope, the right move is to read and emit it, and the adapter architecture is built for exactly that kind of addition.

## Phases

Sequenced, with exit criteria. A phase is done when its exit criteria hold, not when its features merge.

### Phase 0: Make the claims true (now)

The README advertises cascade correctness and safe writes. Two live silent-failure bugs say otherwise. Nothing else on this roadmap matters while the product's core promise is regressed, because the entire pitch is "trust the tool to write your configs."

Scope:
- Fix the provider delete cascade (dashboard delete removes the provider from the registry and from every agent config it was installed into, and the dashboard reflects it without a manual refresh).
- Fix the Codex rename silent failure.
- Land real lint rules (correctness, not just formatting) and keep CI green with them.
- Keep growing the new test base: every adapter has roundtrip tests, and the GUI harness covers the provider CRUD flow end to end, including the delete path that just failed in the wild.

Exit criteria:
- A regression test reproduces the delete-cascade bug and passes after the fix; a manual check against a real agent config confirms it.
- No known bug where the UI reports success and the write did not happen.
- `pnpm build && pnpm test && pnpm lint` green in CI with the new rules.
- README claims audited against reality; anything not yet true is removed or marked planned.

### Phase 1: Secrets (next)

The evidence is unambiguous: plaintext credentials in agent config files are the industry default and the industry's biggest identified risk. We read and write those files across 24 agents, which makes us either part of the problem or the best-placed tool to fix it. We are currently part of the problem.

Scope:
- OS keychain integration (macOS Keychain, libsecret on Linux): `registry.json` stores a reference, not the key.
- Materialization policy per agent: write an env-var reference where the agent supports it, and be explicit in the UI wherever we have no choice but to write plaintext into an agent's config.
- Redaction by default: keys masked in the dashboard, in CLI output, and in the curl commands that verification displays, with an explicit reveal action.
- A "where do my keys live" view: for each provider, every file on disk that currently holds the key in plaintext, so rotation stops being guesswork.

Exit criteria:
- A newly added provider key never appears in plaintext in `registry.json`.
- Every location that still receives a plaintext key (agent limitations) is enumerated and visible to the user.
- Verification output shows no unredacted key by default.
- Documented threat model for the registry and the GUI server, kept in the repo.

### Phase 2: Drift and permissions visibility

This is the finding-9 phase: make contradictions visible before they bite.

Scope:
- Drift watcher: detect when an agent's config was edited outside the tool, show a diff, offer re-sync in either direction (registry to agent, or import agent changes into the registry).
- Cross-agent permissions report: one view of what each agent is allowed to do, with contradictions flagged (the Cursor-allows-what-Claude-forbids case, on your own machine).
- Interop, concretely: read `agent-permissions`-style policy files as an input, and evaluate whether emitting that format is cheaper than growing our own policy schema.
- MCP exposure counts per agent with an overload warning (30+ tools degrades agents; the ROADMAP evidence table covers this).

Exit criteria:
- Editing an agent config by hand is detected and shown as a diff within one refresh.
- The permissions report renders for every adapter that models permissions, and contradiction detection has test fixtures reproducing the documented Cursor/Claude case.
- One interop decision made and recorded (adopt, emit, or documented no with reasons).

### Phase 3: Control plane UX

The GUI audit and the founder's redesign brief describe the same problem from two angles: the current dashboard reads as generic admin CRUD, with pill overuse, weak hierarchy, and two divergent dark themes. The redesign is specced as an epic with separate stories (design tokens, sidebar restructure, providers page, provider detail tabs, command palette); see `docs/epics/agentic-control-plane-redesign.md`. It deliberately starts only after Phase 0's exit criteria hold. Layering a visual overhaul onto a product with unverified writes would repaint a house with a cracked foundation.

Scope: the epic, plus killing the specific audit findings (single accent color, one dark theme, no hardcoded hex, skeleton loading, real confirm dialogs instead of `window.confirm`).

Exit criteria:
- Every audit item marked 🔴 in `docs/audits/gui-design-audit.md` closed or explicitly waived with a reason.
- Both themes pass WCAG AA on the screens the epic touches.
- Provider CRUD, agent install, model management, verification, search, and settings all still work, proven by the Phase 0 GUI test harness, extended to the new components.
- Performance holds: no new heavy dependencies, initial paint and memory comparable to today's baseline.

### Phase 4: Distribution and sharing

Growth work, gated on the product being trustworthy and presentable.

Scope:
- Packaged install (`npm`, then `brew`), which first requires the name decision.
- Registry export/import parity between CLI and dashboard; git-friendly registry format (pretty-printed, diffable, committable).
- Migration assistant: import an existing agent's config into registry entries, so onboarding does not start from zero.
- Team sharing via git-committed registries, scoped per project. This stays last: individuals first, but the registry format is kept team-ready from Phase 1 onward (secret references, not secrets, are what make a registry shareable at all).

Exit criteria:
- A new user goes from install command to a verified provider in under five minutes without cloning the repo.
- A registry with secret references round-trips through git with zero credential material in the diff.

## Production-readiness themes (cross-phase)

These are standing requirements, not a phase:

- **Battle-tested:** every adapter has roundtrip tests against real config fixtures; bugs found in the wild become regression tests before the fix merges (the delete-cascade bug is the first case).
- **Low memory and optimized:** the dashboard stays dependency-light; windowing and memoization already landed and the Phase 3 epic must not regress them.
- **Secure:** Phase 1 is the headline, but the standing rule is that no release widens plaintext credential exposure, and the GUI server keeps its localhost-plus-token boundary.

## Non-goals

Unchanged from ROADMAP.md, restated because they define the product's edges:

- Not an agent runtime. We never execute tools or models.
- No cloud, no accounts, no telemetry. Local-first is a feature, not a phase.
- No OAuth driver. We write configs; per-tool login stays with the tool.
- No destructive environment changes without explicit user action.

## Open decisions

1. **Name.** `agentsync` is taken on GitHub. Candidates: AgentRegistry, ConfigVault, AgentControl. Blocks the Phase 4 packaging work and the README badges. Once decided, fix CONTRIBUTING.md in the same pass: it currently says "AgentSync" as if final and its clone instructions use `cd agentsync`. We are deliberately fixing that once, after the decision, rather than twice.
2. **Audience.** Individual power users first (assumed throughout this document) versus teams. Current call: individuals first, registry format kept team-ready. Revisit if Phase 2 interop work surfaces team demand.
3. **Distribution timing.** Package when Phase 0 and Phase 1 exit criteria hold, not before. Shipping a one-line installer for a tool with a known silent-failure bug and plaintext keys would spend trust we cannot buy back.

## How decisions get made

Evidence (community threads, issues, our own bug reports) becomes a roadmap item, then a draft in `docs/community-issues.md`, then one small PR, reviewed, then released. Every phase above traces to either a sourced finding or a defect we have reproduced. When new evidence contradicts a phase, the phase changes; this document is versioned in git for exactly that reason.
