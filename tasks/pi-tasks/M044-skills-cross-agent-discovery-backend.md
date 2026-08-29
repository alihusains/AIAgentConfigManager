# M044 — Skills backend: discover skills already on every agent (not just the library) + fix path-traversal bug

## Identity

- Task ID: M044
- Parent workstream: Skills feature — core requirement fix
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M044-skills-cross-agent-discovery-backend
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M044-skills-cross-agent-discovery-backend
- Type: bug
- Priority: P0
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M044-skills-cross-agent-discovery-backend`

Work ONLY within these repository paths:

- `packages/core/src/skills.ts`
- `packages/core/src/skills.test.ts`
- `packages/cli/src/gui-server.ts`

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not touch `packages/gui/**` — the UI rework is a separate downstream task (M045).

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

Live investigation of the running dashboard on this machine found `GET /api/skills` returns `"skills": []` (the shared library at `~/.ai-agent-config/skills` is empty) while `claude-code`'s own real directory (`~/.claude/skills`) has ~283 real skill folders already installed. The founder's core requirement — "browse skills, attach one from one agent to another" — is broken because the current model only ever shows/manages skills that live in the tool's own separate shared library; it never surfaces a skill that is *already installed directly on an agent* unless a copy of it also happens to exist in the library. Since the founder never manually recreated every skill inside this tool's library, browsing shows nothing and there is nothing to copy from.

The founder drew an explicit analogy to how Providers work in this tool: Providers are managed as one registry that gets installed onto agents. Skills need the mirror capability — the tool must be able to see what is *already* on each agent's disk, and let the user copy any of it to any other skill-capable agent, not only push from a central library outward.

A second, unrelated but co-located bug from the QA pass (`docs/audits/qa-pass.md`, finding C2) also lives in this file: `createSkill`'s path-traversal check runs on the slugified name, not the raw one, so `POST /api/skills` with `name: "../escape-test"` creates a directory **outside** the skills library. Fix this in the same task since it's the same file and a small, mechanical fix.

## Current state

Read `packages/core/src/skills.ts` in full. Key existing pieces:
- `getSkillsSnapshot()` — returns `{ libraryDir, skills, agents, assignments }` where `skills` comes ONLY from `listSkillsInDir(libraryDir)` (the shared library), and `agents[].skillIds` already correctly lists whatever is really in each agent's own directory (`listSkillsInDir(skillsDir)`) — so the per-agent real data is already being read correctly, it's just never exposed as a first-class browsable/copyable list independent of the library.
- `assignSkillToAgent` — library → agent copy (unchanged, keep working).
- `copySkillBetweenAgents` (from M030) — already supports copying a skill between ANY two skill-capable agents by reading the skill folder directly from the SOURCE AGENT's directory (not the library) — **this function already does exactly what's needed for cross-agent copy; it does not need to change.** The gap is purely that the GUI/snapshot never surfaces a skill that only exists on an agent (not the library) as something the user can select as a copy source.
- `createSkill` — the path-traversal bug: `skillSlug(name)` computes a safe slug, `assertSafeId(id, ...)` validates the SLUG, but the actual directory join happens with... re-read the function carefully to find exactly where the raw `name` vs the validated `id`/slug diverge, and confirm the real bug (the QA report's claim) before fixing it — do not assume, verify against the actual current code.

## Target state

1. **Fix the path-traversal bug in `createSkill`:** validate that no path-unsafe characters/traversal survive into the actual directory path used, using the already-existing `assertSafeId` guard applied correctly (before or on the value that is actually used to construct the directory path — trace the exact current bug, it's about the raw `name` reaching `path.join` before slugification/validation, per the QA report). Add a regression test reproducing the QA report's exact repro case (`name: "../escape-test"`) and asserting the skill directory ends up INSIDE the library, never outside it.

2. **Add a new function `getAllKnownSkills(opts): Promise<AggregatedSkill[]>`** (or a well-named equivalent — your call on the exact name, document it) that:
   - For every skill-capable agent (from `getSkillCapableAgentIds`), lists the skills actually present in that agent's real directory (reuse `listAgentSkills`/`listSkillsInDir`, do not duplicate that logic).
   - For the shared library, lists what's there too (reuse `listSkills`).
   - Merges these into one list keyed by skill id (folder name), where each entry carries: the skill's metadata (name/description/version — prefer the library's copy if present, otherwise the metadata from whichever agent copy was read first), and a `foundOn: string[]` field listing every location it currently exists (agent ids, plus `'library'` if it's in the shared library).
   - Two different agents' folders with the SAME id but genuinely different content (different SKILL.md) are still merged as one logical entry for now (do not build content-diffing in this task — out of scope); just note this as a known limitation in your final report if it comes up.

3. **Extend `getSkillsSnapshot()` (or add a new exported function used alongside it — your call, keep the existing snapshot shape backward compatible since other code may depend on it)** to also return this aggregated cross-agent view, so the GUI (a separate task, M045) has one round-trip to fetch everything: what's in the library, what's on every agent, and where each skill id is found.

4. **Add a new HTTP route** exposing this (e.g. `GET /api/skills/all` returning the aggregated list, or fold it into the existing `GET /api/skills` response under a new key like `allSkills` — your call, pick whichever is the smaller, cleaner diff given the existing route structure; document your choice in the final report since M045 depends on it).

## Read first

### Current code

- `packages/core/src/skills.ts` (full file)
- `packages/core/src/skills.test.ts` (existing test conventions)
- `packages/cli/src/gui-server.ts` — the existing `GET /api/skills` route and `POST /api/skills/:skillId/copy` route (from M030), to match conventions for your new route

### Reference / specification

- `docs/audits/qa-pass.md` — finding C2 (path traversal), read the exact repro and root-cause analysis
- Live evidence (already gathered by the lead): `curl` against the running dashboard's `/api/skills` returned `"skills": []` while `claude-code`'s `skillIds` array had ~283 real entries — this confirms the per-agent read path already works; only the aggregation/exposure is missing

### Tests

- `packages/core/src/skills.test.ts` — add tests for: the path-traversal fix (regression test matching the QA report's exact case), and the new aggregation function (using temp-dir fixtures in the existing test style, covering: a skill only in the library, a skill only on one agent, a skill on two agents, a skill in both the library and an agent).

## Allowed scope

- `packages/core/src/skills.ts`
- `packages/core/src/skills.test.ts`
- `packages/cli/src/gui-server.ts`

## Forbidden scope

- `packages/gui/**` (M045's territory)
- `packages/core/src/agent-catalog.json`/`.ts`
- `packages/core/src/index.ts` (a different bug fix, M046, lives there — do not touch it here)

## Exact requirements

1. Fix the `createSkill` path-traversal bug with a regression test matching the QA report's exact repro.
2. Add the cross-agent skill aggregation function with real test coverage across the 4 scenarios listed above.
3. Expose the aggregation via a new/extended HTTP route, documented clearly for M045 to consume.
4. Full core test suite still green, plus your new tests.

## Non-goals

- No GUI changes (M045).
- No content-diffing between two agents' copies of "the same" skill id.
- No automatic import of discovered agent-side skills into the shared library (browsing + copying is the requirement; forcing everything into the library is a bigger, separate design decision not asked for here).

## Implementation constraints

- Preserve `getSkillsSnapshot()`'s existing return shape (additive only) since other code/tests may depend on it.
- Follow existing naming/error-message/test conventions in the file exactly.
- Prefer the smallest correct diff.
- No speculative abstractions beyond what's specified.

## Interface / contract

```ts
export interface AggregatedSkill extends SkillDef {
  foundOn: string[]; // agent ids, plus 'library' if present in the shared library
}
export async function getAllKnownSkills(opts?: SkillsDirOptions): Promise<AggregatedSkill[]>
```
(Adjust field/type names if a cleaner shape emerges from reusing `SkillDef` — keep it additive and document any deviation.)

HTTP: extend or add a route under `/api/skills*` — document the exact final shape in your report so M045 can consume it without re-deriving it from the diff.

## Dependencies

- Upstream: none
- Downstream: M045 (GUI rework) consumes this directly

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M044-skills-cross-agent-discovery-backend
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
pnpm --filter @ai-agent-config/cli test
```

Also verify:

- `git status --short` within allowed scope only
- A real, manual check (can be part of your test suite, or a one-off script) confirming that against a temp dir shaped like this machine's real layout (a populated `claude-code` dir, an empty library), `getAllKnownSkills` returns the `claude-code`-only skills with `foundOn: ['claude-code']`

## Expected evidence

- exact commands executed
- real test output (before/after counts)
- files changed
- the final HTTP route shape you exposed, documented plainly for the downstream task
- limitations or failures

## Completion criteria

- path-traversal bug fixed with a regression test
- aggregation function implemented and tested across all 4 scenarios
- HTTP route exposed and documented
- full test suite green
- scope respected

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- <file>

COMMANDS_RUN:
```text
<real commands and relevant output>
```

VERIFICATION:
- <result>

KNOWN_ISSUES:
- <none or issue>

FOLLOW_UP:
- <none or required action>
