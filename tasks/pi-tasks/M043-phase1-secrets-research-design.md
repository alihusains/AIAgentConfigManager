# M043 — Phase 1 secrets: research + design doc (research/proposal only, no implementation)

## Identity

- Task ID: M043
- Parent workstream: Phase 1 (Secrets) — productroadmap.md
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M043-phase1-secrets-research-design
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M043-phase1-secrets-research-design
- Type: docs
- Priority: P0
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M043-phase1-secrets-research-design`

Work ONLY within these repository paths:

- `docs/design/phase1-secrets-design.md` (new file)

**This is a research and design-proposal task ONLY.** Do NOT implement OS keychain integration, do NOT change `registry.json`'s schema, do NOT modify any adapter's materialization logic, do NOT add any new dependency. Credential handling and security architecture are decisions the lead makes explicitly after reviewing your research — this task's job is to gather real information and lay out concrete options with tradeoffs, not to decide or build.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

## Why this task exists

`productroadmap.md`'s Phase 1 says: "The evidence is unambiguous: plaintext credentials in agent config files are the industry default and the industry's biggest identified risk... We are currently part of the problem." This project currently stores every API key in plaintext in `~/.ai-agent-config/registry.json` AND materializes it in plaintext into every agent config file it's installed into (across up to 33 skill/provider-capable-relevant agents in the catalog). The founder wants to move to OS-keychain-backed storage and asked specifically for research into how, given that most third-party agents can only read a literal key string from their own config file (they cannot call out to a keychain themselves), which limits how much plaintext exposure can actually be eliminated versus just reduced and made visible.

## Target state

A research/design doc at `docs/design/phase1-secrets-design.md` covering:

1. **Cross-platform Node keychain library survey** — research real, currently-maintained (as of your research date) options for storing/retrieving secrets from macOS Keychain, Linux libsecret/gnome-keyring, and Windows Credential Manager from Node.js. For each candidate: maintenance status (last release date, open issue volume, whether it's actively maintained or abandoned), whether it requires native compilation (a real risk for a CLI tool that needs to `npm install` cleanly across platforms — check if a candidate needs `node-gyp`/prebuilt binaries and how that's handled), and license. Do not recommend a library you have not actually checked the current state of (npm registry page, GitHub repo activity) — cite what you found, with dates.

2. **Registry schema proposal** — how would `registry.json`'s provider entries represent "the key lives in the OS keychain under reference X" instead of the raw key value? Propose the exact shape (e.g. a `{ secretRef: string, backend: 'keychain' | 'plaintext' }` field replacing or alongside the current key field) and how this interacts with the existing `provider-test.ts` verification flow (which needs the real key value to make a live API call) and with export/import (a registry exported to git must never carry the real key, only the reference).

3. **Per-adapter materialization capability survey** — for a representative sample of the 24+ existing adapters in `packages/core/src/adapters/`, determine: does this agent's config format support an environment-variable reference (e.g. `${OPENAI_API_KEY}`-style) instead of a literal key, or does it only accept a literal string value? Read at least 8 real adapter files (mix of the OpenAI-Chat-Completions-shaped ones, the Anthropic-Messages-shaped ones, and at least one from the `opencode-style.ts` shared-base family) to answer this from real code, not assumption. Produce a table: agent id | literal-only or env-ref-capable | evidence (file/line).

4. **Materialization policy proposal** — for agents that support an env-var reference: what should the resulting config actually look like (write a real example snippet), and where does the tool tell the user they still need to set that env var themselves (or does the tool offer to write it to their shell profile — flag this as a real decision with real risk/tradeoff, do not just assume the answer)? For agents that only accept a literal value: how does the "where do my keys live" view surface this per-provider, per-agent, so the user has an honest map of every remaining plaintext location, mirroring the honesty precedent already set for agents that can't store model providers at all (see `ProvidersView.tsx`'s dimmed-avatar treatment).

5. **Redaction proposal** — where in the current codebase does a raw key value currently reach the CLI output, the GUI, or the curl commands shown during verification (`packages/core/src/provider-test.ts` and wherever the GUI renders its output)? List every real location found by grepping for where key/credential values are read and displayed, with a proposed masking format (e.g. `sk-...ab12`) and an explicit "reveal" affordance design.

6. **Threat model** — a short, concrete threat model for the registry file and the local GUI server (who can read `registry.json` today, what does the per-session dashboard token actually protect against, what does keychain-backing change about the blast radius if this machine is compromised versus just this file being read).

7. **Phased implementation proposal** — break the above into a sequence of small, independently-shippable microtasks (in the same style as this project's existing `tasks/pi-tasks/*.md` files), each with a clear scope boundary, so the lead can decompose real implementation work from this research without re-deriving the investigation.

## Read first

### Current code

- `packages/core/src/registry.ts` (current registry schema and how a provider's key is stored/read)
- `packages/core/src/provider-test.ts` (live verification flow, where the real key is used)
- At least 8 real files under `packages/core/src/adapters/` (see requirement 3)
- `packages/cli/src/gui-server.ts` (how the dashboard token gates access, and where key values might reach an HTTP response)

### Reference / specification

- `productroadmap.md` Phase 1 section (the existing scope/exit-criteria this research must inform)
- `docs/audits/security-audit-adapter-io.md` if it exists (prior security findings, don't re-discover what's already documented)

### Tests

- N/A — no code in this task.

## Allowed scope

- `docs/design/phase1-secrets-design.md` (new file)

## Forbidden scope

- Any `.ts`/`.tsx`/`.json` file
- Adding any dependency (even for research purposes — investigate via npm registry web pages / `npm view <pkg>` metadata, do not `pnpm add` anything)

## Exact requirements

1. All 7 sections above, each backed by real findings (library research with dates/evidence, real adapter code citations, real grep results for key-exposure locations).
2. A concrete phased microtask breakdown at the end, ready for the lead to turn into real task files.
3. Zero code changes.

## Non-goals

- No implementation.
- No final decision on which keychain library to use — present options with real tradeoffs; the lead decides.

## Implementation constraints

- N/A.

## Interface / contract

N/A — this task produces a proposal, not an interface.

## Dependencies

- Upstream: none
- Downstream: the lead will decompose real Phase 1 implementation microtasks from this doc's phased proposal

## Verification

Also verify:

- `git status --short` shows only the new doc file
- Every adapter-capability claim in section 3 cites a real file/line
- Every library recommendation in section 1 cites what you actually found (registry page state, last commit date), not general knowledge that might be stale

## Expected evidence

- the full doc content
- confirmation no code files were touched
- the specific evidence (file/line, or web research finding) behind each claim

## Completion criteria

- doc covers all 7 required sections with real evidence
- zero code changes
- a usable phased microtask breakdown at the end

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- <file>

VERIFICATION:
- <result>

KNOWN_ISSUES:
- <none or issue>

FOLLOW_UP:
- <none or required action>
