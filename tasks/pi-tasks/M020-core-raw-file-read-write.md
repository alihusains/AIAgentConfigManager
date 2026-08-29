# M020 — Core: read/write an agent's raw config or MCP file

## Identity

- Task ID: M020
- Parent workstream: agents-tab-revamp-2
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: working tree HEAD (main, with many other uncommitted changes already present — do not discard them)
- Branch: none — sequential execution directly in the repository (no worktree isolation)
- Worktree: none (main checkout)
- Type: feature
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/AIAgentConfigManager`

Work ONLY within these repository paths:

- `packages/core/src/index.ts`
- `packages/core/src/agent-catalog.test.ts` (only to add a focused test for the new methods, in the same style as existing tests there)

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work —
the working tree already has many other uncommitted changes from earlier
work; leave everything outside your allowed scope untouched.

Do not introduce new dependencies.

Do not redesign the architecture — this is an additive feature on the
existing `AgentConfigManager` class, following the exact pattern already
used by `readRawConfig`/`backupConfig` in the same file.

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

The GUI's Agents tab is about to get an in-browser file editor (a follow-up
task, M022+M025, not this one) so the user can edit an agent's config file or
MCP file and save it without opening a terminal. That editor needs a backend
capability that does not exist yet: reading AND writing an agent's raw config
file, or its raw MCP file (when the MCP file is a separate file from the main
config), as plain text — with a timestamped backup taken before any write, so
a bad edit is always recoverable.

The existing `readRawConfig(agentId)` method (packages/core/src/index.ts,
around line 1230) only reads the main config file and has no write
counterpart, and has no notion of "the MCP file specifically." The existing
`reveal` endpoint in `packages/cli/src/gui-server.ts` (around line 640)
already knows how to resolve `kind: 'config' | 'mcp' | 'model'` to a real
path for a given agent — reuse that exact resolution logic (do not invent a
different one):

- `kind === 'config'` → `manager.getConfigPath(agentId)` (already a method
  on the class, resolves via `resolveConfigPathForAgent`)
- `kind === 'mcp'` → `(await manager.detectAgent(agentId))?.detection.mcpPath`

This task only needs `'config'` and `'mcp'` — NOT `'model'`. A separate,
already-decided product change is removing the "Model Config" column/concept
from the GUI entirely (it was redundant with Config Path in every case that
mattered), so no `'model'` kind is needed here.

## Current state

`packages/core/src/index.ts` has:

```ts
async readRawConfig(
  agentId: string
): Promise<OperationResult<{ path: string; content: string; exists: boolean }>> {
  const adapter = this.adapters.get(agentId);
  if (!adapter) return { success: false, error: `Agent "${agentId}" not found` };
  try {
    const configPath = adapter.getConfigPath();
    const exists = await fileExists(configPath);
    const content = exists ? (await readFileSafe(configPath)) || '' : '';
    return { success: true, data: { path: configPath, content, exists } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Utility
async backupConfig(agentId: string): Promise<OperationResult<string>> {
  const adapter = this.adapters.get(agentId);
  if (!adapter) {
    return { success: false, error: `Agent "${agentId}" not found` };
  }
  try {
    const backupPath = await adapter.backupConfig();
    return { success: true, data: backupPath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
```

`packages/core/src/utils/index.ts` already exports a generic
`backupFile(filePath: string): Promise<string>` that takes ANY absolute path
(not tied to an adapter) and writes a `<path>.backup.<ISO-timestamp>` copy —
this is the right utility to reuse for writing, since it works for both the
config path and the MCP path. It's likely already imported into
`packages/core/src/index.ts` (check); if not, add it to the existing import
from `./utils`.

## Target state

Two new public methods added to the `AgentConfigManager` class in
`packages/core/src/index.ts`, placed near the existing `readRawConfig`/
`backupConfig` methods:

```ts
/**
 * Read an agent's raw config file or its separate MCP file (when it has
 * one) as plain text, for the in-browser editor.
 */
async readAgentFile(
  agentId: string,
  kind: 'config' | 'mcp'
): Promise<OperationResult<{ path: string; content: string; exists: boolean }>> {
  const targetPath = await this.resolveAgentFilePath(agentId, kind);
  if (!targetPath.success) return targetPath;
  const target = targetPath.data as string;
  try {
    const exists = await fileExists(target);
    const content = exists ? (await readFileSafe(target)) || '' : '';
    return { success: true, data: { path: target, content, exists } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Overwrite an agent's raw config file or its separate MCP file with new
 * content, taking a timestamped backup of the previous content first (if
 * the file already existed). Content is written exactly as given — no
 * parsing, validation, or reformatting; the caller (GUI editor) is
 * responsible for the file being well-formed for its format.
 */
async writeAgentFile(
  agentId: string,
  kind: 'config' | 'mcp',
  content: string
): Promise<OperationResult<{ path: string; backupPath: string | null }>> {
  const targetPath = await this.resolveAgentFilePath(agentId, kind);
  if (!targetPath.success) return targetPath;
  const target = targetPath.data as string;
  try {
    const existed = await fileExists(target);
    const backupPath = existed ? await backupFile(target) : null;
    await writeFileSafe(target, content);
    return { success: true, data: { path: target, backupPath } };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/** Shared path resolution for readAgentFile/writeAgentFile — mirrors the
 * kind resolution already used by the `reveal` endpoint in gui-server.ts. */
private async resolveAgentFilePath(
  agentId: string,
  kind: 'config' | 'mcp'
): Promise<OperationResult<string>> {
  if (kind === 'config') {
    const path = this.getConfigPath(agentId);
    if (!path) return { success: false, error: `Agent "${agentId}" not found or has no config path` };
    return { success: true, data: path };
  }
  const detected = await this.detectAgent(agentId);
  const mcpPath = detected?.detection.mcpPath;
  if (!mcpPath) {
    return { success: false, error: `This agent has no separate MCP file on this machine` };
  }
  return { success: true, data: mcpPath };
}
```

The exact method bodies above are a strong reference — match the existing
file's error-handling and naming conventions if a small deviation is needed
(e.g. if `getConfigPath`, `detectAgent`, `fileExists`, `readFileSafe`,
`writeFileSafe`, `backupFile` are named or imported slightly differently
already in this file — use what's actually there instead of inventing a
new import). Do not change `readRawConfig` or `backupConfig` — they stay
exactly as they are; this is purely additive.

Also add one focused test in `packages/core/src/agent-catalog.test.ts` (in
the same style as existing tests in that file) that:

1. Calls `readAgentFile('claude-code', 'config')` (or another already-known
   catalog id used elsewhere in that test file) and asserts it does not
   throw and returns an `OperationResult` shape (`success` boolean present).
2. Calls `readAgentFile('claude-code', 'mcp')` similarly.

Do not write a test that actually mutates real files on the test machine —
read-only assertions only (no `writeAgentFile` call in the test, since that
would write to the real `~/.claude` directory on whatever machine runs the
test suite in CI).

## Read first

### Current code

- `packages/core/src/index.ts` — read the full `readRawConfig`,
  `backupConfig`, `restoreConfig`, `getConfigPath`, and `detectAgent` method
  bodies, and the top-of-file imports, before writing anything
- `packages/core/src/utils/index.ts` — `backupFile`, `readFileSafe`,
  `writeFileSafe`, `fileExists` signatures
- `packages/cli/src/gui-server.ts` — the `reveal` endpoint (search for
  `'reveal'` — around line 640) to see the exact `kind` → path resolution
  this task must mirror

### Tests

- `packages/core/src/agent-catalog.test.ts` — existing test style/imports to
  match

## Allowed scope

- `packages/core/src/index.ts`
- `packages/core/src/agent-catalog.test.ts`

## Forbidden scope

- `packages/cli/src/gui-server.ts` (a separate task, M022, wires these into
  HTTP endpoints — do not add routes here)
- `packages/gui/src/**` (a separate task, M025, builds the editor UI)
- any adapter file
- `packages/core/src/agent-catalog.json`
- any other file
- unrelated refactors
- dependency upgrades
- architecture changes
- formatting-only changes outside touched code

## Exact requirements

1. Add `readAgentFile(agentId, kind)`, `writeAgentFile(agentId, kind, content)`,
   and the private `resolveAgentFilePath` helper to the
   `AgentConfigManager` class exactly as specified in "Target state"
   (adjusting only for actual existing helper names/imports in the file).
2. `writeAgentFile` must back up the existing file (if it exists) before
   overwriting, using the existing generic `backupFile` utility — never skip
   the backup when the file already exists.
3. Neither method touches `readRawConfig` or `backupConfig`.
4. Add the read-only test described above.
5. `kind` is only `'config' | 'mcp'` — do not add a `'model'` kind.

## Non-goals

- Any HTTP endpoint (that's M022).
- Any GUI component (that's M025).
- Validating or parsing the file content by format (JSON/YAML/TOML) — this
  is intentionally raw-text read/write only.
- Removing the "Model Config" concept anywhere else in the codebase (that
  UI-level cleanup is scoped to M025, a GUI-only task).

## Implementation constraints

- Preserve public APIs of `AgentConfigManager` — this is purely additive.
- Follow existing naming and module conventions in `index.ts`.
- Follow existing error handling (`OperationResult` pattern, try/catch
  returning `{ success: false, error: String(error) }`).
- Prefer the smallest correct diff.
- Do not introduce speculative abstractions beyond what's specified.

## Interface / contract

```ts
async readAgentFile(
  agentId: string,
  kind: 'config' | 'mcp'
): Promise<OperationResult<{ path: string; content: string; exists: boolean }>>

async writeAgentFile(
  agentId: string,
  kind: 'config' | 'mcp',
  content: string
): Promise<OperationResult<{ path: string; backupPath: string | null }>>
```

This exact shape (field names and types) is a frozen contract — M022 (the
HTTP layer) will be written against exactly this signature. Do not rename
fields or change types.

## Dependencies

- Upstream: none
- Downstream: M022 (HTTP endpoints), M025 (GUI editor) both call these
  methods through the HTTP layer M022 builds

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
pnpm --filter @ai-agent-config/core run build
pnpm --filter @ai-agent-config/core run test
pnpm --filter @ai-agent-config/core run typecheck 2>/dev/null || pnpm --filter @ai-agent-config/core run build
```

Also verify:

- `git status --short` shows changes ONLY in the allowed-scope files
- `git diff --name-only` matches the allowed scope exactly
- the new test passes

## Expected evidence

The final report must include:

- exact commands executed
- real output of build/test
- files changed (`git diff --name-only`)
- the exact final method signatures added (paste them)
- confirmation the backup-before-write behavior is implemented

## Completion criteria

The task is complete only when:

- both methods and the private helper exist with the exact frozen contract
- the backup-before-write requirement is implemented
- the new test passes
- no non-goal behavior changed
- scope is respected
- build and test both pass
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
