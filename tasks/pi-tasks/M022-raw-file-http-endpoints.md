# M022 — HTTP endpoints + client for reading/writing an agent's raw file

## Identity

- Task ID: M022
- Parent workstream: agents-tab-revamp-2
- Owner: Pi
- Lead: Claude (main session)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: working tree HEAD (main, with many other uncommitted changes already present — do not discard them)
- Branch: none — sequential execution directly in the repository (no worktree isolation)
- Worktree: none (main checkout)
- Type: feature
- Priority: P1
- Dependencies: M020 (done — `AgentConfigManager.readAgentFile`/`writeAgentFile` now exist in `packages/core/src/index.ts`)

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/AIAgentConfigManager`

Work ONLY within these repository paths:

- `packages/cli/src/gui-server.ts`
- `packages/gui/src/api.ts`

Do NOT touch any GUI component file (`packages/gui/src/components/**`) — a
later task (M025) builds the editor UI against the client methods this task
adds.

Read every file listed in "Read first" before writing code.

Do not reset, clean, stash, rebase, checkout, or overwrite unrelated work —
the working tree already has many other uncommitted changes from earlier
work; leave everything outside your allowed scope untouched.

Do not introduce new dependencies.

Do not redesign the routing architecture — follow the exact existing
pattern in `gui-server.ts` (the `parts`/`method`/`handle`/`readBody`
convention already used by every other route in that file).

Do not broaden scope because you notice adjacent improvements.

If requirements are insufficient or contradictory, stop and report BLOCKED.

Run every required verification command.

Paste the REAL output of every verification command in the final report.

## Why this task exists

`packages/core/src/index.ts` now has `readAgentFile(agentId, kind)` and
`writeAgentFile(agentId, kind, content)` (added by task M020), but nothing
exposes them over HTTP yet, and the GUI's `api.ts` client has no way to call
them. This task wires the core methods into the existing local HTTP server
and the browser-side API client, so a future GUI task (M025) can build an
in-browser file editor on top.

## Current state

`packages/cli/src/gui-server.ts` already has, in the same request handler:

- a parsed `url = new URL(req.url || '', 'http://localhost')` and
  `parts = url.pathname.split('/').filter(Boolean)` (e.g.
  `['api','agents','claude-code','config']`)
- a `handle(async () => ({ data } | { error, status }))` wrapper that JSON-
  encodes the result and catches thrown errors as 500s (read it to match its
  exact shape)
- a `readBody()` helper that parses the JSON request body (used by the
  `reveal` endpoint — search for `'reveal'`)
- an existing raw-config read route:

```ts
// ---- Raw agent config (directory checking) ----
// GET /api/agents/:id  or  GET /api/agents/:id/config
if (
  parts[1] === 'agents' &&
  method === 'GET' &&
  (parts.length === 3 || (parts.length === 4 && parts[3] === 'config'))
) {
  return handle(async () => {
    const result = await manager.readRawConfig(parts[2]);
    if (!result.success) return { error: result.error || 'Agent not found', status: 404 };
    return { data: result.data };
  });
}
```

`packages/gui/src/api.ts` already has, in the same style:

```ts
getAgentConfig: (id: string) =>
  request<RawConfigResult>(
    'GET',
    `/api/agents/${encodeURIComponent(id)}/config`
  ),
revealAgent: (id: string, kind: 'config' | 'mcp' | 'model' = 'config') =>
  request<{ dir: string; path: string; kind: string }>(
    'POST',
    `/api/agents/${encodeURIComponent(id)}/reveal`,
    { kind }
  ),
```

## Target state

### 1. `packages/cli/src/gui-server.ts` — two new routes

Place these near the existing raw-config route (search for `'Raw agent
config'`). Do not modify the existing `config` route.

```ts
// ---- Raw agent file (config or MCP) — read for the in-browser editor ----
// GET /api/agents/:id/raw-file?kind=config|mcp
if (
  parts[1] === 'agents' &&
  method === 'GET' &&
  parts.length === 4 &&
  parts[3] === 'raw-file'
) {
  return handle(async () => {
    const kind = url.searchParams.get('kind');
    if (kind !== 'config' && kind !== 'mcp') {
      return { error: `Invalid or missing kind (expected 'config' or 'mcp')`, status: 400 };
    }
    const result = await manager.readAgentFile(parts[2], kind);
    if (!result.success) return { error: result.error || 'Not found', status: 404 };
    return { data: result.data };
  });
}

// ---- Raw agent file (config or MCP) — save from the in-browser editor ----
// PUT /api/agents/:id/raw-file?kind=config|mcp   Body: { content: string }
if (
  parts[1] === 'agents' &&
  method === 'PUT' &&
  parts.length === 4 &&
  parts[3] === 'raw-file'
) {
  return handle(async () => {
    const kind = url.searchParams.get('kind');
    if (kind !== 'config' && kind !== 'mcp') {
      return { error: `Invalid or missing kind (expected 'config' or 'mcp')`, status: 400 };
    }
    const body = await readBody();
    const content =
      body && typeof body === 'object' && 'content' in body
        ? (body as { content?: unknown }).content
        : undefined;
    if (typeof content !== 'string') {
      return { error: 'Body must be { content: string }', status: 400 };
    }
    const result = await manager.writeAgentFile(parts[2], kind, content);
    if (!result.success) return { error: result.error || 'Write failed', status: 500 };
    return { data: result.data };
  });
}
```

Match the exact variable names already in scope in this file (`manager`,
`url`, `parts`, `method`, `handle`, `readBody`) — if any of these differ
slightly from what's shown here, use the real names from the file, not
these names verbatim.

### 2. `packages/gui/src/api.ts` — two new client methods

Add these next to `getAgentConfig`/`revealAgent` in the "Raw config /
directory" section:

```ts
getAgentRawFile: (id: string, kind: 'config' | 'mcp') =>
  request<{ path: string; content: string; exists: boolean }>(
    'GET',
    `/api/agents/${encodeURIComponent(id)}/raw-file?kind=${kind}`
  ),
saveAgentRawFile: (id: string, kind: 'config' | 'mcp', content: string) =>
  request<{ path: string; backupPath: string | null }>(
    'PUT',
    `/api/agents/${encodeURIComponent(id)}/raw-file?kind=${kind}`,
    { content }
  ),
```

Check the `request<T>()` helper's signature in this file first (it's used by
every other method here) — match its actual parameter order/shape exactly;
the snippet above assumes `request(method, path, body?)` matching
`revealAgent`'s call shape directly above it in the file.

## Read first

### Current code

- `packages/cli/src/gui-server.ts` — the full request-handling function:
  read the `handle`, `readBody`, `url`/`parts`/`method` setup, and the
  existing `config` and `reveal` routes referenced above
- `packages/core/src/index.ts` — the `readAgentFile`/`writeAgentFile`
  signatures added by M020 (search for `readAgentFile`)
- `packages/gui/src/api.ts` — the `request<T>()` helper and the existing
  `getAgentConfig`/`revealAgent` methods

## Allowed scope

- `packages/cli/src/gui-server.ts`
- `packages/gui/src/api.ts`

## Forbidden scope

- `packages/core/src/**`
- `packages/gui/src/components/**`
- any other file
- unrelated refactors
- dependency upgrades
- architecture changes
- formatting-only changes outside touched code

## Exact requirements

1. Add the `GET /api/agents/:id/raw-file?kind=` route exactly as specified.
2. Add the `PUT /api/agents/:id/raw-file?kind=` route exactly as specified.
3. Add `getAgentRawFile`/`saveAgentRawFile` to the `api` object in `api.ts`
   exactly as specified (adjusted only for the file's real `request<T>()`
   signature if it differs).
4. Both routes validate `kind` is exactly `'config'` or `'mcp'` and return
   HTTP 400 otherwise.
5. The PUT route validates the body has a string `content` field and
   returns HTTP 400 otherwise.
6. Do not modify the existing `config` or `reveal` routes.

## Non-goals

- Any GUI component or editor UI (that's M025).
- Any change to core (`packages/core/src/**`) — M020 already did that.
- Any `'model'` kind support (intentionally not needed — see M020's task
  file for why).

## Implementation constraints

- Match the file's existing routing style exactly (no new routing
  abstraction, no middleware, no new HTTP framework).
- Follow existing error-response shape (`{ error, status }` via `handle`).
- Prefer the smallest correct diff.

## Interface / contract

```
GET /api/agents/:id/raw-file?kind=config|mcp
  200 -> { ok: true, data: { path: string, content: string, exists: boolean } }
  400 -> { ok: false, error: string }  (bad/missing kind)
  404 -> { ok: false, error: string }  (agent/file not found)

PUT /api/agents/:id/raw-file?kind=config|mcp
  Body: { content: string }
  200 -> { ok: true, data: { path: string, backupPath: string | null } }
  400 -> { ok: false, error: string }  (bad kind or bad body)
  500 -> { ok: false, error: string }  (write failed)
```

```ts
getAgentRawFile: (id: string, kind: 'config' | 'mcp') => Promise<ApiEnvelope<{ path: string; content: string; exists: boolean }>>
saveAgentRawFile: (id: string, kind: 'config' | 'mcp', content: string) => Promise<ApiEnvelope<{ path: string; backupPath: string | null }>>
```

This exact shape is frozen — M025 (the GUI editor) will be written against
it exactly.

## Dependencies

- Upstream: M020 (done)
- Downstream: M025 (GUI editor UI calls these two client methods)

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
pnpm --filter @ai-agent-config/cli run build
pnpm --filter @ai-agent-config/cli run test
pnpm --filter @ai-agent-config/gui run typecheck
```

Also verify, as real runtime evidence (this repo's CLI can start the actual
dashboard server locally):

```bash
node packages/cli/dist/index.js start
sleep 1
TOKEN=$(curl -s http://127.0.0.1:4321/ | grep -o '__AI_CONFIG_TOKEN__="[^"]*"' | sed -E 's/.*"(.*)"/\1/')
curl -s -H "x-config-token: $TOKEN" "http://127.0.0.1:4321/api/agents/claude-code/raw-file?kind=config"
node packages/cli/dist/index.js stop
```

(Requires `pnpm --filter @ai-agent-config/cli run build` and
`pnpm --filter @ai-agent-config/gui run build` to have run first, since the
server serves the built GUI's `dist/`.) Confirm the curl call returns a JSON
body with `ok: true` and a `data.path`/`data.content` — a 400/404 with a
clear error is also acceptable evidence IF `claude-code` genuinely has no
config on this machine, but report which one actually happened.

Also verify:

- `git status --short` shows changes ONLY in the allowed-scope files
- `git diff --name-only` matches the allowed scope exactly

## Expected evidence

The final report must include:

- exact commands executed
- real output of build/test/typecheck
- the real curl output from the runtime check (or the reason it couldn't
  run, e.g. port already in use — check with `node packages/cli/dist/index.js health` first and stop any already-running instance before starting your own, then restart it however it was before you're done if you can tell it was already running)
- files changed (`git diff --name-only`)

## Completion criteria

The task is complete only when:

- both routes exist exactly as specified
- both client methods exist exactly as specified
- no non-goal behavior changed
- scope is respected
- build/test/typecheck pass
- the runtime curl check was actually performed and its real output pasted
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
