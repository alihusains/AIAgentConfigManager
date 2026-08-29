# M042 — Design doc: multi-format skill adapter architecture (docs only, no code)

## Identity

- Task ID: M042
- Parent workstream: Skill management improvements
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M042-skill-format-adapter-design-doc
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M042-skill-format-adapter-design-doc
- Type: docs
- Priority: P2
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M042-skill-format-adapter-design-doc`

Work ONLY within these repository paths:

- `docs/design/skill-format-adapters.md` (new file)

This is a DESIGN DOC ONLY task. Do not write, modify, or scaffold any implementation code (no new adapter files, no interface definitions in `.ts` files, nothing under `packages/`). The founder explicitly decided this stays a design doc for now since no agent in the current catalog actually needs a divergent format yet — building the abstraction speculatively would violate this project's own YAGNI convention.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

## Why this task exists

Today, `packages/core/src/skills.ts`'s `assignSkillToAgent`/`copySkillBetweenAgents`/`removeSkillFromAgent` all assume every skill-capable agent uses the identical convention: a folder named after the skill id, containing `SKILL.md` with flat YAML frontmatter (`name`/`description`/`version`), copied byte-for-byte via `fs.cp`. This works today because every currently-catalogued skill-capable agent (Claude Code, Codex, OpenCode, AionUi, and — after M041 — Pi/Continue/Roo/Qwen/Junie) happens to use exactly this format.

The founder asked: what happens when a future agent uses a genuinely different format — e.g. a hypothetical tool (they named OpenWebUI as an example, though it is not currently in this catalog) that only supports a single flat `.md` file per skill, no subfolder, no companion assets, possibly different frontmatter or none at all? A raw `fs.cp` would either fail or silently produce a broken result for such an agent.

## Target state

A design document at `docs/design/skill-format-adapters.md` proposing an architecture modeled directly on this codebase's existing PROVIDER adapter pattern (`packages/core/src/adapters/*.ts` + the registry `Map` in `packages/core/src/adapters/index.ts`) — read that pattern first and make the parallel explicit in the doc, since this project already has a proven, working precedent for "one canonical schema, N format-specific adapters, a registry mapping agent id to adapter."

The doc should cover, at minimum:

1. **Canonical skill representation** — what a `CanonicalSkill` needs to carry so ANY format adapter has enough information to encode it: id, name, description, version, the full file tree of the skill folder (not just SKILL.md — real skills in this codebase's own `.agents/skills/` already carry companion files like `DESIGN.md`), not just a single markdown string.

2. **`SkillFormatAdapter` interface** — propose the exact shape (e.g. `write(skill, targetDir): Promise<WriteResult>`, `read(targetDir, skillId): Promise<CanonicalSkill | null>`, `remove(targetDir, skillId): Promise<void>`), where `WriteResult` must be able to report PARTIAL fidelity honestly (e.g. "3 of 4 companion files could not be represented in this format") rather than silently claiming full success — this directly mirrors how `assignSkillToAgent` already returns `{ targetPath }` and how the Providers table already dims agents whose config format "cannot store model providers" rather than pretending they can.

3. **A default `SkillFolderAdapter`** implementing today's actual behavior (the folder+SKILL.md convention), so the migration path for existing code is: wrap the current `fs.cp` logic in this one adapter, register it for every currently-skill-capable agent, zero behavior change for any agent that already works today.

4. **A worked example of a divergent-format adapter** — pick ONE concrete hypothetical (e.g. "single flat `.md` file, no subfolder") and show exactly what its `write`/`read` would do: how it flattens a multi-file `CanonicalSkill` into one file (what happens to companion files — inline them under a heading? drop with an explicit warning surfaced to the UI? your call, but justify it), and what its `read` can and cannot recover (e.g. it can recover name/description/body but not a multi-file skill's other assets, so `listAgentSkills` for that agent should report reduced fidelity).

5. **Catalog schema extension** — propose adding an optional `skillsFormat?: string` field to the catalog entry type (defaulting to a `'skill-folder'` constant when omitted, so all 9 currently-catalogued agents need zero changes), plus a small format-id → adapter registry mirroring `packages/core/src/adapters/index.ts`'s existing `adapters` Map pattern.

6. **Where the routing changes** — name exactly which functions in `packages/core/src/skills.ts` would need to route through `getSkillFormatAdapter(agentId)` instead of a hardcoded `fs.cp`, without actually making that change in this task.

7. **A non-goal / trigger condition** — state explicitly that this should NOT be implemented until a real agent needing a divergent format is actually added to the catalog, and that implementing it earlier would be speculative generality this project's own coding standards explicitly warn against (cite `CLAUDE.md`'s YAGNI section if present, or state the principle plainly).

## Read first

### Current code

- `packages/core/src/skills.ts` (full file — the current single-format assumption)
- `packages/core/src/adapters/index.ts` (the existing provider-adapter registry pattern to mirror)
- `packages/core/src/adapters/generic.ts` (an example of a shared base adapter multiple agent-specific adapters build on, analogous to the proposed default `SkillFolderAdapter`)
- `packages/gui/src/components/ProvidersView.tsx` (the existing "dimmed avatar, cannot store model providers" honesty pattern — the design doc's `WriteResult` fidelity-reporting proposal should explicitly reference this precedent)

### Reference / specification

- None beyond this task file.

### Tests

- N/A — no code in this task.

## Allowed scope

- `docs/design/skill-format-adapters.md` (new file)

## Forbidden scope

- Any `.ts`/`.tsx` file
- Any change to `packages/core/src/skills.ts` or `packages/core/src/agent-catalog.json` (M041, a separate task/worktree, may be touching these concurrently — do not touch them here regardless)

## Exact requirements

1. A complete design doc covering all 7 points above.
2. Explicit, direct comparison to the existing provider-adapter pattern already in this codebase (not a generic "adapter pattern" description — reference the actual files).
3. Zero code/schema changes — proposal only.
4. Explicit statement of the non-goal / trigger condition (point 7).

## Non-goals

- No implementation of any kind.
- No changes to the skills catalog (that's M041, separate task).

## Implementation constraints

- N/A.

## Interface / contract

N/A — this task produces no interface, only a proposal for one.

## Dependencies

- Upstream: none
- Downstream: none — this doc informs a future implementation task if/when a divergent-format agent is actually added

## Verification

Also verify:

- `git status --short` shows only the new doc file
- The doc explicitly cross-references the real file paths named above (not paraphrased/invented file names)

## Expected evidence

- the full doc content
- confirmation no code files were touched

## Completion criteria

- doc covers all 7 required points
- zero code changes
- real file references throughout, not invented ones

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
