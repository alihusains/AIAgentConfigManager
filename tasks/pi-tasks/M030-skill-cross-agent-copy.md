# M030 — Copy a skill from one agent to another agent (cross-platform, no symlinks)

## Identity

- Task ID: M030
- Parent workstream: Skill management improvements
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: 3102310
- Branch: pi/M030-skill-cross-agent-copy
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M030-skill-cross-agent-copy
- Type: feature
- Priority: P0
- Dependencies: none (independent of the GUI redesign workstream; a later task, M036, wires this into the SkillsView UI once this API exists)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M030-skill-cross-agent-copy`

Work ONLY within these repository paths:

- `packages/core/src/skills.ts`
- `packages/core/src/skills.test.ts`
- `packages/cli/src/gui-server.ts` (adding one new route only — see requirements)
- `packages/cli/src/gui-server.test.ts` (or `gui-server-delete.test.ts` sibling — add a new test file `packages/cli/src/gui-server-skills.test.ts` if that's cleaner; your call, keep it small)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not introduce new dependencies.

Do not implement symlinks anywhere in this task — see "Why this task exists" for why that decision is already made; do not relitigate it.

Do not touch any GUI `.tsx` file in this task — that is a separate downstream task (M036).

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

`packages/core/src/skills.ts` already implements a library-to-agent skill assignment model: `assignSkillToAgent(skillId, agentId)` copies a skill folder from the shared library (`getSkillsLibraryDir()`) into one agent's skills directory (`getAgentSkillsDir(agentId)`), and `removeSkillFromAgent` deletes the agent-side copy. This works today for exactly 4 catalog agents that declare `skillsPaths` in `packages/core/src/agent-catalog.json`: `chatgpt` (codex), `claude-code`, `opencode`, `aion-cli` — each with `darwin`/`linux`/`win32` path templates (Windows uses `%USERPROFILE%\...`, expanded by `expandPath()` in `packages/core/src/utils/index.ts`).

The founder wants to go one step further: copy a skill that is already installed on one agent directly to a different agent (agent A → agent B), not just library → agent. The founder also explicitly asked "check if windows supports symlink" before building this, worried about cross-platform reliability.

**Lead decision (do not relitigate): do NOT use symlinks.** Windows symlinks (`mklink`) require either Administrator privileges or Developer Mode enabled, which cannot be assumed for an end-user tool — a symlink-based design would silently fail or need elevated permissions on a large fraction of Windows machines. The codebase's existing design already avoids this entirely by using `fs.cp(source, dest, { recursive: true })` — a real recursive file copy, which behaves identically on macOS, Linux, and Windows with no special privileges. This task extends that same copy-based mechanism to agent-to-agent transfer; it does not introduce any new cross-platform risk.

## Current state

Read `packages/core/src/skills.ts` in full — it already has:
- `getSkillCapableAgentIds(platform)` — returns catalog agent ids with `skillsPaths` for the given platform (this IS the "check first if the agent supports skills" logic the founder asked for; reuse it, do not reimplement).
- `getAgentSkillsDir(agentId, platform)` — returns the expanded skills directory for an agent on a platform, or `null` if not skill-capable.
- `assignSkillToAgent(skillId, agentId, opts)` — library → agent copy, using `fs.cp` with `recursive: true`, after `fs.rm(targetPath, { recursive: true, force: true })` to clear any stale copy first.
- `removeSkillFromAgent(skillId, agentId, opts)` — deletes the agent-side copy.
- `listAgentSkills(agentId, opts)` — lists skills currently present in one agent's directory.
- `assertSafeId(id, label)` — path-traversal guard already applied to all skill/agent ids; reuse it for any new id parameters, do not bypass it.
- `SkillsDirOptions` — test seams (`libraryDir`, `platform`, `skillsDir` overrides) already used throughout the existing test file `packages/core/src/skills.test.ts` (17 tests); follow the same test patterns for your new tests.

Read `packages/core/src/skills.test.ts` in full to see the existing test conventions (temp directories, `SkillsDirOptions` overrides, platform mocking) before writing new tests — match that style exactly.

Read the relevant section of `packages/cli/src/gui-server.ts` that already exposes skills endpoints (search for `skills` in that file) to see the existing route conventions (response envelope shape, error handling, status codes) before adding a new route.

## Target state

A new exported function in `packages/core/src/skills.ts`:

```ts
export async function copySkillBetweenAgents(
  skillId: string,
  sourceAgentId: string,
  targetAgentId: string,
  opts: SkillsDirOptions = {},
): Promise<{ targetPath: string }>
```

Behavior:
1. Validate `skillId`, `sourceAgentId`, `targetAgentId` with `assertSafeId` (reuse existing helper, do not duplicate the logic).
2. Resolve the source agent's skills directory via `getAgentSkillsDir(sourceAgentId, opts.platform)` (or `opts.skillsDir` test override — but note this task needs TWO directory overrides, source and target, since both agents differ; extend `SkillsDirOptions` or add explicit optional params as makes sense given the existing shape — your call, keep it minimal and consistent with existing conventions).
3. If the source agent is not skill-capable on this platform (`getAgentSkillsDir` returns `null`), throw a clear error: `Agent does not support skills: <sourceAgentId>`.
4. If the target agent is not skill-capable on this platform, throw: `Agent does not support skills: <targetAgentId>`.
5. If the skill is not actually installed in the source agent's directory (no `SKILL.md` at `<sourceDir>/<skillId>/SKILL.md`), throw: `Skill is not assigned to this agent: <skillId> -> <sourceAgentId>`. (Match the exact error message shape already used in `removeSkillFromAgent` for consistency.)
6. If `sourceAgentId === targetAgentId`, throw a clear error (`Source and target agent are the same: <agentId>`) rather than silently no-op-ing or corrupting the folder via a self-copy.
7. Copy (not symlink, not move) the skill folder from the source agent's directory to the target agent's directory using the same `fs.mkdir(targetDir, { recursive: true })` → `fs.rm(targetPath, { recursive: true, force: true })` → `fs.cp(source, targetPath, { recursive: true })` sequence already used by `assignSkillToAgent`, so the library copy at the source agent is left untouched (this is agent A → agent B, the source keeps its copy).
8. Return `{ targetPath }`, matching `assignSkillToAgent`'s return shape.

Add one new HTTP route to `packages/cli/src/gui-server.ts`, following the exact conventions of the existing skills routes in that file (find them by searching for the existing `assignSkillToAgent`/`removeSkillFromAgent` route handlers and copy their envelope/error-handling pattern exactly):

- `POST /api/skills/:skillId/copy` with a JSON body `{ sourceAgentId: string, targetAgentId: string }`, calling `copySkillBetweenAgents` and returning the same success/error envelope shape the existing skills routes use (do not invent a new response shape).

## Read first

### Current code

- `packages/core/src/skills.ts` (full file, 350 lines)
- `packages/core/src/skills.test.ts` (full file)
- `packages/core/src/agent-catalog.json` (skim — confirm the 4 `skillsPaths` entries: chatgpt, claude-code, opencode, aion-cli)
- `packages/core/src/utils/index.ts` — read `expandPath` and `getCurrentPlatform` to confirm Windows `%USERPROFILE%` expansion behavior (do not reimplement, just confirm your new function relies on the existing expansion correctly)
- `packages/cli/src/gui-server.ts` — locate the existing skills routes (search for `assignSkillToAgent` and `removeSkillFromAgent` usage) and copy their exact request/response/error-handling pattern

### Reference / specification

- None beyond this task file — this is a bounded, already-decided extension of an existing mechanism.

### Tests

- `packages/core/src/skills.test.ts` — add new test cases here (or match its existing describe-block conventions) covering: happy path copy between two skill-capable agents; error when source agent not skill-capable; error when target agent not skill-capable; error when skill not installed on source; error when source === target; confirm the library/source copy is left untouched after a successful agent-to-agent copy.

## Allowed scope

- `packages/core/src/skills.ts`
- `packages/core/src/skills.test.ts`
- `packages/cli/src/gui-server.ts`
- `packages/cli/src/gui-server-skills.test.ts` (new file, only if you choose to add tests here instead of extending an existing cli test file — your call)

## Forbidden scope

- `packages/core/src/agent-catalog.json` or `.ts` (do not add new `skillsPaths` entries or agents — out of scope)
- Any `.tsx` file under `packages/gui/`
- Any adapter file
- Symlink-based implementation of any kind (`fs.symlink`, `fs.link`)
- Formatting-only changes outside the code you touch

## Exact requirements

1. Implement `copySkillBetweenAgents` exactly as specified in "Target state" above, reusing `assertSafeId`, `getAgentSkillsDir`, and the existing copy sequence pattern from `assignSkillToAgent`.
2. Add the `POST /api/skills/:skillId/copy` route to `gui-server.ts` matching existing skills-route conventions exactly (response envelope, status codes, error message passthrough).
3. Add test coverage for all 6 behaviors listed under "Tests" above, using the existing `SkillsDirOptions`/temp-directory test conventions already present in `skills.test.ts`.
4. Do not change the behavior of `assignSkillToAgent` or `removeSkillFromAgent` — they must continue to pass their existing tests unmodified.

## Non-goals

- No GUI changes — the SkillsView UI wiring is a separate task (M036) that depends on this API existing.
- No symlink support of any kind.
- No new catalog agents or `skillsPaths` entries.
- No change to how the shared library (`getSkillsLibraryDir`) works.

## Implementation constraints

- Preserve public APIs unless explicitly required — do not change the signature of `assignSkillToAgent` or `removeSkillFromAgent`.
- Follow existing naming and module conventions (function names, error message phrasing) exactly as found in the file today.
- Follow existing error handling — throw plain `Error` with descriptive messages, exactly like the rest of the file; do not introduce a new error class.
- Prefer the smallest correct diff.
- Do not introduce speculative abstractions (e.g. a generic "copy between any two locations" function beyond what's asked) — this is agent-to-agent copy specifically, not a general file-copy utility.
- Do not change unrelated behavior.

## Interface / contract

```ts
export async function copySkillBetweenAgents(
  skillId: string,
  sourceAgentId: string,
  targetAgentId: string,
  opts?: SkillsDirOptions,
): Promise<{ targetPath: string }>
```

`SkillsDirOptions` may need extending to support distinct source/target directory overrides for tests — if you extend it, keep the extension additive (new optional fields only) so no existing caller of `assignSkillToAgent`/`removeSkillFromAgent`/`listAgentSkills` breaks.

HTTP: `POST /api/skills/:skillId/copy` — body `{ sourceAgentId: string, targetAgentId: string }` — response envelope must match whatever shape the existing `POST`/`DELETE` skills routes in `gui-server.ts` already use (read them first, copy the pattern, do not invent a new one).

## Dependencies

- Upstream: none
- Downstream: M036 (SkillsView UI wiring — separate future task, not part of this dispatch round)

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M030-skill-cross-agent-copy
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
pnpm --filter @ai-agent-config/cli test
```

Also verify:

- `git status --short` shows changes only in the allowed scope
- All existing `skills.test.ts` tests (17) still pass unmodified in addition to your new ones
- All existing `gui-server*.test.ts` tests still pass
- The exact requested behavior works: write and run one throwaway manual check (can be part of your test suite) that actually copies a skill folder between two mocked agent directories on disk and confirms the target directory now contains `SKILL.md` with the same content as the source, and that the source directory is untouched afterward

## Expected evidence

The final report must include:

- exact commands executed
- real test output (full pass counts, before and after your change)
- files changed
- the new function's behavior confirmed via at least one real filesystem-level test (not just a mock)
- limitations or failures

## Completion criteria

The task is complete only when:

- all requirements are implemented
- no non-goal behavior was changed (zero `.tsx` diffs, no symlinks, no new catalog entries)
- scope is respected
- required verification passes (both core and cli test suites, full counts reported)
- the diff has been reviewed for accidental changes
- no unresolved issue remains

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
