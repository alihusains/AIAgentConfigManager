# M062 — Real npm distribution (npx-able CLI, no clone-and-build required)

## Identity

- Task ID: M062
- Parent workstream: Distribution (pulled forward from Phase 4 per adoption research)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M062-npm-distribution
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M062-npm-distribution
- Type: feature
- Priority: P0
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M062-npm-distribution`

Work ONLY within these repository paths:

- `packages/cli/package.json`
- `package.json` (root, only if a workspace-level publish script is needed)
- `packages/cli/src/index.ts` (only if a real packaging blocker is found there — read first, don't assume)
- `README.md`
- `.github/workflows/ci.yml` (only if adding a publish step — read the existing workflow first, do not restructure it)

Read every file listed in "Read first" before making any change.

**Do NOT actually run `npm publish` or push a git tag that triggers a release — this task prepares and verifies the package is publishable, it does not publish it.** Publishing to a public registry is the founder's explicit action, not something dispatched automatically.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

Research (real, cited, this session) found a live GitHub issue on `openai/codex` explicitly asking for real distribution because users resist installing a whole toolchain for one binary. Today this project can only be run by cloning the repo and building it — there is no `npm install -g` or `npx` path. Distribution is currently scoped as Phase 4 (last), but the evidence says installer friction is blocking adoption right now, not later.

## Current state

Read `packages/cli/package.json` in full: current `name`, `bin` field (if any), `main`/`exports`, `files` allowlist, and whether `packages/core`/`packages/gui` are declared as workspace dependencies or need to be bundled. Read `docs/epics/agentic-control-plane-redesign-v2.md`/`README.md`/`productroadmap.md`'s existing naming decisions (product name `AgentControl`, npm package name `agentcontrol`, CLI binary `agm` — these are already decided per `CHECKPOINT.md`'s naming section, verified free on npm; do not reopen or change them).

Read how `packages/gui`'s built `dist/` output is currently referenced by the CLI at runtime (`packages/cli/src/gui-server.ts`'s `distDir` — confirm whether it currently assumes a monorepo-relative path that would break once this package is installed standalone via npm, outside this repo's folder structure).

## Target state

1. Fix `packages/cli/package.json` so that installing JUST this package (via `npm install -g agentcontrol` or `npx agentcontrol`) works standalone — this means:
   - `bin` field maps `agm` to the built CLI entry.
   - `dependencies` includes `@ai-agent-config/core` as a REAL published dependency reference (not a workspace-only `workspace:*` protocol that breaks outside this monorepo) — if `@ai-agent-config/core` and the GUI's built assets are not yet meant to be published as separate packages, restructure so the CLI package bundles everything it needs (the built GUI `dist/` assets, the compiled core code) into its own `files`/`dist` output, so a standalone `npm install` of just the CLI package is fully self-contained. Decide the cleanest approach given the existing build tooling (turbo/tsc/vite) — document your choice.
   - `files` allowlist includes exactly what's needed to run (compiled JS, the built GUI dist assets) and excludes source/tests/dev tooling.
2. Verify the standalone-install path actually works: build a real tarball with `npm pack` and install THAT tarball into a completely separate temp directory (not this monorepo), then run the resulting binary and confirm `agm --help`, `agm start`, and `agm health` work correctly from a directory outside this repo, with no monorepo-relative path assumptions leaking through.
3. Update `README.md`'s installation instructions to show the real `npm install -g agentcontrol` / `npx agentcontrol` path as the primary instructions, with the "clone and build from source" path kept as a secondary/contributor path, not the only one.
4. If any part of this is genuinely blocked (e.g. the npm package name `agentcontrol` turns out to no longer be free, or a monorepo-workspace restructuring is too large for this task's scope), STOP and report BLOCKED with exactly what you found, rather than force a half-working package.

## Read first

### Current code

- `packages/cli/package.json`, `package.json` (root), `pnpm-workspace.yaml`
- `packages/cli/src/index.ts`, `packages/cli/src/gui-server.ts` (`distDir` resolution — the real risk area for a standalone install)
- `CHECKPOINT.md` §2 (the already-decided naming: product `AgentControl`, npm package `agentcontrol`, binary `agm`)
- `README.md` (current install instructions)

### Reference / specification

- `productroadmap.md` Phase 4 (distribution scope — you are pulling this forward, not inventing new scope beyond what's already described there)

### Tests

- No new automated test framework needed — the verification IS the real `npm pack` + standalone-install-and-run check described above; paste its real terminal output.

## Allowed scope

- `packages/cli/package.json`
- `package.json` (root, only if truly needed)
- `packages/cli/src/index.ts` (only if a real blocker requires it)
- `README.md`
- `.github/workflows/ci.yml` (only if adding a publish-readiness check, not an actual publish step)

## Forbidden scope

- Any actual `npm publish`
- Any git tag/release creation
- Any GUI component file
- `packages/core/src/**`, `packages/gui/src/**` (source code itself — this is a packaging task, not a feature task)

## Exact requirements

1. `npm pack` produces a tarball that installs and runs standalone outside this monorepo, verified with real commands.
2. README reflects the real, working install path.
3. Nothing is actually published — verification only.
4. If genuinely blocked, report BLOCKED with specifics rather than a half-working result.

## Non-goals

- No actual publish to npm/brew.
- No Homebrew formula in this task (npm first; brew can follow once npm is proven).
- No CI publish-on-tag automation (that's a founder decision about when/how to release, not part of this task).

## Implementation constraints

- Preserve the already-decided naming (`agentcontrol`/`agm`) — do not rename anything.
- Smallest correct diff that achieves a genuinely standalone-installable package.
- No speculative abstractions.

## Interface / contract

CLI binary name (`agm`) and its existing commands/behavior must not change — only how the package is built/packaged/installed changes.

## Dependencies

- Upstream: none
- Downstream: none (a future, founder-approved task actually publishes it)

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M062-npm-distribution
pnpm install --frozen-lockfile
pnpm build
cd packages/cli && npm pack
# then install the resulting tarball into a completely separate temp dir and
# run `agm --help` / `agm health` from there, outside this repo
```

Also verify:

- `git status --short` within allowed scope only
- The real standalone-install-and-run transcript, from a directory outside this repo

## Expected evidence

- exact commands executed
- real terminal output of the standalone install-and-run test
- files changed
- limitations or failures (report BLOCKED honestly if something is genuinely not resolvable in this task's scope)

## Completion criteria

- a real tarball installs and runs standalone, verified with real commands
- README reflects real instructions
- nothing published

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
