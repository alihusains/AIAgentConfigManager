# M041 — Expand skillsPaths to agents already using the folder+SKILL.md convention

## Identity

- Task ID: M041
- Parent workstream: Skill management improvements
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M041-skills-catalog-expansion
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M041-skills-catalog-expansion
- Type: feature
- Priority: P0
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M041-skills-catalog-expansion`

Work ONLY within these repository paths:

- `packages/core/src/agent-catalog.json`
- `packages/core/src/skills.test.ts`

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not add `skillsPaths` for any agent unless you have verified — by reading real files on this machine or the tool's own documentation — that it actually uses the folder-containing-SKILL.md-with-YAML-frontmatter convention. Do not guess or assume based on the tool name alone.

Do not broaden scope into building the multi-format adapter architecture — that is a separate task (M042, design doc only, not this task).

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The founder tried to copy a Claude Code skill to Pi (the CLI coding agent) via the dashboard's Skills view and it wasn't offered as a target. Investigation found Pi already stores skills at `~/.pi/agent/skills/<id>/SKILL.md`, byte-for-byte the same convention `packages/core/src/skills.ts` already assumes (a folder per skill containing `SKILL.md` with `---\nname: ...\ndescription: ...\n---` YAML frontmatter) — it's just missing from the catalog's `skillsPaths`, so `getSkillCapableAgentIds`/`getAgentSkillsDir` never recognize it as skill-capable. The same investigation found `~/.continue/skills/`, `~/.roo/skills/`, `~/.qwen/skills/`, and `~/.junie/skills/` already exist on this machine with the identical folder+SKILL.md layout.

## Current state

Read `packages/core/src/agent-catalog.json` — currently exactly 4 entries carry `skillsPaths`: `chatgpt` (`~/.codex/skills`), `claude-code` (`~/.claude/skills`), `opencode` (`~/.config/opencode/skills`), `aion-cli` (`~/.aionui/skills`), each with `darwin`/`linux`/`win32` variants (Windows using `%USERPROFILE%\...` syntax, expanded by `expandPath()` in `packages/core/src/utils/index.ts` — follow this exact path-template convention for any new entry, do not invent a different placeholder syntax).

Read `packages/core/src/skills.ts` docstring (top of file) — it already names "Claude Code, OpenAI Codex CLI, OpenCode and AionUi" as the verified set; you are extending that verified set, so apply the same rigor: don't add an entry unless you can point to real evidence (a real directory found on a real machine, or the tool's own published docs/source describing this exact convention), and update that docstring comment to include whichever agents you verify.

## Target state

Add `skillsPaths` entries (with real, correct per-platform path templates — verify Windows/Linux paths from the tool's own documented config-home convention, not just by guessing the macOS path pattern applies elsewhere unchanged) to the existing catalog entries for these candidates, verifying each one individually before adding it — do not add all 5 blindly just because 5 were mentioned as candidates:

1. `pi` — confirmed on this machine at `~/.pi/agent/skills/<id>/SKILL.md`. Note: the catalog's darwin skills path template should point at wherever pi's config actually resolves this directory from (check if it's genuinely `~/.pi/agent/skills` for all platforms, or if pi's config-home resolution differs per-platform — check pi's own documentation/source if accessible, or reason from the config-home pattern already used elsewhere in this catalog for the `pi` entry's other paths).
2. `continue` — check `packages/core/src/agent-catalog.json`'s existing `continue` entry for its established config-home pattern (it should already have `configPaths`/similar for its provider config; use the same base directory family for the skills path). Verify the real directory convention (`~/.continue/skills` was found on this machine — confirm this is Continue's actual documented/standard location, not just where this machine happens to have one).
3. `roo` — same approach; verify against Roo Code's own documented conventions, and cross-check against `packages/core/src/adapters/roo-code.ts` (this adapter was previously verified NOT to be Cline-compatible despite being a fork — per CHECKPOINT.md history — so do not assume Roo's skills path mirrors Cline's without checking).
4. `qwen` — same approach.
5. `junie` — same approach.

For each agent you add, also verify the SKILL.md frontmatter format genuinely matches what `parseSkillFrontmatter` in `packages/core/src/skills.ts` expects (flat `name`/`description`/`version` keys) — read at least one real SKILL.md file from that agent's directory on this machine if one exists, or from the tool's own skill-authoring documentation if none exists locally, and confirm it parses correctly (write a quick test against a real or representative sample).

If any candidate turns out NOT to actually match (different frontmatter shape, different file name, skills stored as a single file rather than a folder, etc.), do NOT add it — report it as a mismatch in KNOWN_ISSUES instead, with what you found instead of the assumed format. This is exactly the class of "divergent format" case the founder is separately having a design doc written for (M042) — don't force a bad fit into this task's copy-based model.

## Read first

### Current code

- `packages/core/src/agent-catalog.json` (the 4 existing `skillsPaths` entries, and the full entries for `pi`, `continue`, `roo`, `qwen`, `junie` so you know their existing platform-path conventions)
- `packages/core/src/skills.ts` (full file — `parseSkillFrontmatter`, `getAgentSkillsDir`, `getSkillCapableAgentIds`)
- `packages/core/src/utils/index.ts` (`expandPath`, to confirm how `~` and `%USERPROFILE%` are handled)

### Reference / specification

- None beyond this task file; verify against real evidence per agent as described above.

### Tests

- `packages/core/src/skills.test.ts` — add test coverage confirming `getSkillCapableAgentIds` now includes each newly-added agent (on the relevant platform), and that a representative SKILL.md sample for each parses correctly via `parseSkillFrontmatter`.

## Allowed scope

- `packages/core/src/agent-catalog.json`
- `packages/core/src/skills.ts` (docstring update only, to name the newly-verified agents — no logic changes)
- `packages/core/src/skills.test.ts`

## Forbidden scope

- Any adapter file
- Any GUI file
- Adding an agent whose format you could not verify — report it instead

## Exact requirements

1. For each of the 5 candidates, verify real evidence of the folder+SKILL.md convention before adding a `skillsPaths` entry; skip and report any that don't match.
2. Add correct per-platform path templates for each verified agent, following the existing `%USERPROFILE%`/`~` convention.
3. Update the `skills.ts` docstring to name the full verified set.
4. Add test coverage for each newly-added agent.
5. Full test suite still green.

## Non-goals

- No multi-format adapter architecture (that's M042, a design doc only).
- No GUI changes (the Skills view already reads from `getSkillCapableAgentIds`/`getSkillsSnapshot`, so it will pick up new entries automatically once the catalog changes — do not touch `SkillsView.tsx`).
- No OpenWebUI or any agent not already in the catalog.

## Implementation constraints

- Preserve the existing JSON schema/shape for catalog entries.
- Follow the existing path-template convention exactly.
- Prefer the smallest correct diff.
- No speculative abstractions.

## Interface / contract

`SkillCapableAgent`/`SkillsSnapshot` shapes in `packages/core/src/skills.ts` do not change — this task only adds catalog data, consumed by existing, unchanged logic.

## Dependencies

- Upstream: none
- Downstream: none (the founder can immediately use the existing Skills view UI once this lands, no UI changes needed)

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M041-skills-catalog-expansion
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
```

Also verify:

- `git status --short` within allowed scope only
- For at least one newly-added agent (ideally `pi`, since it's directly verifiable on this machine), a real end-to-end check: call `getSkillCapableAgentIds()` and confirm the new agent id is present; call `listAgentSkills('pi')` against the real `~/.pi/agent/skills` directory (read-only, do not write/modify anything there) and confirm it returns real skills with correct names/descriptions parsed from real SKILL.md files

## Expected evidence

- exact commands executed
- real test output (before/after counts)
- files changed
- the verification evidence for each agent you added (what real file/path confirmed it) and for each you rejected (what you found instead)
- limitations or failures

## Completion criteria

- every added agent is backed by real verified evidence
- every rejected candidate is documented with what was actually found
- tests pass
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
