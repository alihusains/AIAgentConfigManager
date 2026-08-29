# M048 — Environment variables backend: read, categorize, redact, and edit user-level env vars

## Identity

- Task ID: M048
- Parent workstream: New feature — centralized environment variable management
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M048-env-vars-backend
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M048-env-vars-backend
- Type: feature
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M048-env-vars-backend`

Work ONLY within these repository paths:

- `packages/core/src/env-vars.ts` (new file)
- `packages/core/src/env-vars.test.ts` (new file)
- `packages/core/src/index.ts` (export the new module only — a one-line addition)
- `packages/cli/src/gui-server.ts` (new routes only)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work.

Do not modify any real environment variable on this machine as a side effect of running your tests — all tests must operate against temp files / mocked shell profiles, never the founder's real `~/.zshrc`/`~/.bashrc`/`~/.bash_profile`/`~/.zprofile` or real Windows registry.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The founder wants a single place in this tool to see and manage environment variables — "so the user doesn't have to go through different places to get the key values" — mirroring the tool's existing philosophy for providers/skills (one registry-first place instead of scattered per-tool config). Environment variables are used across many of the 24+ adapters for API keys (per `docs/design/phase1-secrets-design.md`'s credential-placement survey), so a unified view is directly useful today, independent of the Phase 1 keychain work (which is a separate, larger effort).

**Be honest about platform reality (this project's stated policy — a fake capability is worse than an absent one):** there is no clean, universal "system-level environment variables" API on macOS/Linux the way Windows has `HKEY_LOCAL_MACHINE\...\Environment` vs `HKEY_CURRENT_USER\Environment`. Scope this task realistically per platform rather than pretending a uniform system/user split exists everywhere.

## Target state

A new module `packages/core/src/env-vars.ts` exporting:

```ts
export interface EnvVarEntry {
  name: string;
  value: string;
  /** Where this value currently comes from. */
  source: 'process' | 'shell-profile' | 'windows-user' | 'windows-system';
  /** Absolute path of the file this was read from, when source is a file (undefined for 'process'). */
  sourceFile?: string;
  /** True if the name looks like it holds a secret (heuristic: contains KEY, TOKEN, SECRET, PASSWORD, CREDENTIAL, case-insensitive). Values for these must be redacted by default wherever they're returned to a caller other than an explicit "reveal" request. */
  looksSensitive: boolean;
  /** Whether this tool can safely edit this value (false for anything requiring elevated/admin permissions it cannot assume, or a file format it doesn't understand). */
  editable: boolean;
}

export async function listEnvVars(opts?: { platform?: Platform }): Promise<EnvVarEntry[]>
export async function setEnvVar(name: string, value: string, opts?: { platform?: Platform }): Promise<{ ok: boolean; warning?: string }>
export async function removeEnvVar(name: string, opts?: { platform?: Platform }): Promise<{ ok: boolean; warning?: string }>
```

Behavior per platform:

- **macOS/Linux:** Read `process.env` for the CURRENT process (this reflects what THIS tool sees, `source: 'process'`). Additionally, parse the user's shell profile files that actually exist among `~/.zshrc`, `~/.zprofile`, `~/.bash_profile`, `~/.bashrc`, `~/.profile` for `export NAME=value` (and bare `NAME=value`) lines, marking those `source: 'shell-profile'` with the real `sourceFile`. Merge by name (a var in both `process` and a profile file is one entry, prefer the profile-file source since that's where a user would edit it; if it's process-only — e.g. exported by a parent shell/launchd — mark `editable: false` and explain why in a short note field if you add one). `setEnvVar`/`removeEnvVar` append/modify/remove the corresponding `export NAME=value` line in the LAST profile file it was found in (or `~/.zshrc` as the default target for a brand-new var — check the current shell via `$SHELL` or `os.userInfo()`/`process.env.SHELL` and pick zsh vs bash conventions accordingly), always in a way that is safe to run with the file already containing arbitrary other content (do not blindly overwrite the file — read, find/replace or append the specific line only, preserve everything else byte-for-byte). Do NOT attempt to modify any "system-level" (`/etc/environment`, `launchctl` global) variables — there is no safe, universal way to do this without elevated privileges; if you determine this is genuinely infeasible within scope, state so explicitly rather than half-implementing it.
- **Windows:** Read `process.env` (`source: 'process'`). Read user-level env vars via the registry (`HKEY_CURRENT_USER\Environment`) using a real Windows API/CLI call (e.g. `reg query`) — `source: 'windows-user'`, `editable: true` via `reg add`/`reg delete` or `setx` (research the correct non-destructive approach — `setx` has a documented 1024-character truncation bug for some variable types; note this if relevant). Read system-level vars (`HKEY_LOCAL_MACHINE\...\Environment`) as READ-ONLY (`source: 'windows-system'`, `editable: false`) since modifying these requires admin elevation this tool cannot assume — if you determine you cannot safely test Windows-specific code paths in this environment (likely, since you're running on macOS), write the Windows branch carefully from documented API behavior, add a clear code comment stating it is unverified on real Windows and should be tested there, and say so explicitly in your final report rather than claiming verified behavior you could not test.
- **Redaction:** any `EnvVarEntry` with `looksSensitive: true` must have its `value` field redacted (e.g. `sk-...ab12` style, first 3 + last 4 characters) in the DEFAULT `listEnvVars()` response. Add a separate, explicit function or parameter (e.g. `listEnvVars({ reveal: ['SPECIFIC_NAME'] })` or a dedicated `revealEnvVar(name)`) for retrieving a real value on demand — never redact-then-silently-unredact by accident; be deliberate about this boundary, mirroring the existing provider-key redaction philosophy already planned in `docs/design/phase1-secrets-design.md`.

## Read first

### Current code

- `packages/core/src/utils/index.ts` (`getCurrentPlatform`, `expandPath`, existing file-read helpers — reuse, don't duplicate)
- `packages/core/src/registry.ts` (existing patterns for reading/writing config-like files safely, atomic writes, `0o600` permissions where relevant — mirror those safety practices)
- `docs/design/phase1-secrets-design.md` (the redaction philosophy and threat-model context this feature should be consistent with)

### Reference / specification

- `docs/design/phase1-secrets-design.md`

### Tests

- `packages/core/src/env-vars.test.ts` — new file. Use temp directories/files for every shell-profile-parsing/writing test (never touch the founder's real dotfiles). Cover: parsing a realistic `.zshrc` sample with mixed `export FOO=bar`, plain `FOO=bar`, comments, and unrelated shell code; redaction of sensitive-looking names; setEnvVar appending a new line without disturbing existing content; setEnvVar updating an existing line in place; removeEnvVar removing only the targeted line.

## Allowed scope

- `packages/core/src/env-vars.ts` (new)
- `packages/core/src/env-vars.test.ts` (new)
- `packages/core/src/index.ts` (export addition only)
- `packages/cli/src/gui-server.ts` (new routes: `GET /api/env`, `POST /api/env` (set), `DELETE /api/env/:name`, and a reveal endpoint — follow the existing route/response-envelope conventions in this file exactly)

## Forbidden scope

- Any GUI (`.tsx`) file (M049's territory)
- Any modification to a real dotfile on this machine during tests or manual verification — always use a temp/mocked path
- Any new npm dependency (use Node's built-in `child_process`/`fs`/`os` only; for Windows registry access, shell out to `reg`/`setx`, do not add a native registry-editing dependency)

## Exact requirements

1. `listEnvVars`/`setEnvVar`/`removeEnvVar` implemented for macOS/Linux with real shell-profile parsing and safe, non-destructive file edits.
2. Windows user-level read/write implemented via `reg`/`setx`, honestly flagged as unverified-on-real-Windows in your report; system-level Windows vars read-only.
3. Redaction by default for sensitive-looking names, with an explicit, separate reveal path.
4. New HTTP routes added following existing conventions.
5. Full test coverage per the scenarios listed above, using only temp files — zero touches to real dotfiles.

## Non-goals

- No system-level (`/etc/environment`, global `launchctl`) write support on macOS/Linux.
- No admin-elevation flows.
- No GUI.

## Implementation constraints

- Preserve existing safe-write patterns from `registry.ts` (atomic writes, restrictive permissions where a new file is created).
- Follow existing naming/error-handling conventions.
- Prefer the smallest correct diff.
- No speculative abstractions.

## Interface / contract

See the `EnvVarEntry`/function signatures above — treat them as the frozen contract for M049 (the GUI task) to consume.

## Dependencies

- Upstream: none
- Downstream: M049 (GUI)

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M048-env-vars-backend
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
pnpm --filter @ai-agent-config/cli test
```

Also verify:

- `git status --short` within allowed scope only
- Confirm via `git diff`/`ls` that no real dotfile on this machine was modified by your test run (checksum or diff `~/.zshrc` etc. before/after running the test suite, paste the confirmation)

## Expected evidence

- exact commands executed
- real test output
- files changed
- explicit confirmation no real dotfile was touched
- explicit statement of what is verified vs. unverified-on-real-Windows
- limitations or failures

## Completion criteria

- all requirements implemented with real test coverage
- zero real-dotfile side effects
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
