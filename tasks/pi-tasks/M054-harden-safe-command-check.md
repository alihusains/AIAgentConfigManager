# M054 — Harden `isSafeCommand` from a weak deny-list to a real allow-list (QA finding H5)

## Identity

- Task ID: M054
- Parent workstream: Bug-free hardening (QA pass follow-up)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M054-harden-safe-command-check
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M054-harden-safe-command-check
- Type: bug
- Priority: P2
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M054-harden-safe-command-check`

Work ONLY within these repository paths:

- `packages/core/src/agent-catalog.ts`
- `packages/core/src/agent-catalog.test.ts`

Read `docs/audits/qa-pass.md` finding H5 in full before writing any code.

Do not touch any other file. Commit your changes with git before finishing.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

`docs/audits/qa-pass.md` finding H5: `isSafeCommand` in `packages/core/src/agent-catalog.ts` uses a fragile deny-list (`FORBIDDEN_TOKENS` like `'sudo'`, `'rm -rf /'`) checked via plain `.includes()`. This both false-negatives (e.g. `rm -rf /*`, `rm -fr /`, `su\n` bypass it) and false-positives (a legitimate path containing the substring `rm -rf /` would incorrectly match). Commands are executed via `/bin/sh -c`, so shell metacharacters are fully available. The function guards install/uninstall commands from the (developer-curated, not user-supplied) agent catalog, which lowers real-world risk, but the function's name and comment promise a stronger guarantee than it delivers.

## Current state

Read `isSafeCommand` and every real call site in `packages/core/src/agent-catalog.ts` (and any other file that calls it, if any — grep for it across the repo). Read every real `install`/`uninstall` command string actually present in `packages/core/src/agent-catalog.json` (37 entries) — the allow-list you build must accept every one of these real, legitimate commands without exception, or you will break real functionality.

## Target state

Replace the deny-list with an allow-list of known-safe command SHAPES, derived from the real commands actually present in the catalog today (e.g. `npm install -g <package>`, `npm uninstall -g <package>`, `brew install <formula>`, `pip install <package>`, `pipx install <package>`, etc. — enumerate the REAL shapes from the actual catalog data, do not guess a generic set). A command is safe only if it matches one of these known-good patterns exactly (anchored regex, no shell metacharacters permitted within the matched segments: reject if the command contains `;`, `&&`, `||`, `|`, `` ` ``, `$(`, or a newline anywhere, even before pattern-matching the rest). Keep the function name `isSafeCommand` (external contract), but its internal logic moves from deny-list to allow-list.

Every one of the 37 catalog entries' real `install`/`uninstall` commands must still pass `isSafeCommand` after your change — this is close to a golden-master test: run every real command from the catalog through the new function and confirm none regress to `false`.

## Read first

### Current code

- `packages/core/src/agent-catalog.ts` (`isSafeCommand`, `FORBIDDEN_TOKENS`, and every call site)
- `packages/core/src/agent-catalog.json` (all 37 entries' real `install`/`uninstall` command strings — this is your ground truth for the allow-list shapes)

### Reference / specification

- `docs/audits/qa-pass.md` finding H5

### Tests

- `packages/core/src/agent-catalog.test.ts` — add: (a) a golden-master test that every real catalog command still passes; (b) tests for the specific bypasses named in the QA report (`rm -rf /*`, `rm -fr /`, `su\n`, shell metacharacter injection via `;`/`&&`/backticks) now correctly rejected; (c) a test confirming a plausible NEW legitimate command shape not yet in the catalog (e.g. a hypothetical `npm install -g @new-scope/pkg`) still passes if it matches an established safe shape.

## Allowed scope

- `packages/core/src/agent-catalog.ts`
- `packages/core/src/agent-catalog.test.ts`

## Forbidden scope

- `packages/core/src/agent-catalog.json` (do not change catalog data)
- Any other file

## Exact requirements

1. `isSafeCommand` rebuilt as a real allow-list, rejecting shell metacharacters unconditionally.
2. Every real catalog command (all 37 entries) still passes — golden-master test proves it.
3. Every QA-report-named bypass now correctly rejected.
4. Full core test suite still green.

## Non-goals

- No change to how/where `isSafeCommand` is called (the execution context/sandboxing is out of scope).
- No change to catalog data.

## Implementation constraints

- Preserve the function's external signature/name.
- Smallest correct diff.
- No speculative abstractions beyond what real catalog data requires.

## Interface / contract

`isSafeCommand(command: string): boolean` — signature unchanged.

## Dependencies

- Upstream: none
- Downstream: none

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M054-harden-safe-command-check
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
```

Also verify:

- `git status --short` within allowed scope only
- The golden-master test output listing all 37 real commands checked and passing

## Expected evidence

- exact commands executed
- real test output including the golden-master pass list
- files changed
- limitations or failures

## Completion criteria

- allow-list implemented, all real catalog commands still pass, all named bypasses rejected
- full core test suite green

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
