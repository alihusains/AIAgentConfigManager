# M066 — Skill marketplace backend: browse and install skills from a real public GitHub repo

## Identity

- Task ID: M066
- Parent workstream: Growth feature (research-identified: browse-and-install layer over existing skill ecosystem)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M066-skill-marketplace-backend
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M066-skill-marketplace-backend
- Type: feature
- Priority: P1
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M066-skill-marketplace-backend`

Work ONLY within these repository paths:

- `packages/core/src/marketplace.ts` (new file)
- `packages/core/src/marketplace.test.ts` (new file)
- `packages/core/src/index.ts` (export addition only)
- `packages/cli/src/gui-server.ts` (new routes only)

Read every file listed in "Read first" before writing code.

**This task introduces the app's FIRST outbound network call to a third-party service. This is a real, deliberate departure from the "no cloud, no telemetry" value proposition already stated in the README — treat it with real care:**
- The fetch must be 100% USER-TRIGGERED (an explicit "Browse marketplace" / "Refresh" action), never automatic on app startup or on a timer. No background polling.
- Only fetch PUBLIC, READ-ONLY GitHub API data (repo contents) — never send any local data, telemetry, or identifying information in the request beyond what a plain unauthenticated GitHub API call requires.
- Cache aggressively (GitHub's unauthenticated REST API is rate-limited to 60 requests/hour per IP) — never re-fetch on every page view.
- If the network is unavailable or GitHub is unreachable, fail with a clear, honest error — never fall back to fabricated/cached-forever data presented as fresh.

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

Run every required verification command. Paste the REAL output in your final report.

## Why this task exists

Deep research this session found: skills marketplaces are already a live, multi-player ecosystem, and this codebase already references a REAL public skills repository — `alihusains/enterprise-skills` — in `~/.claude/skills`-adjacent tooling and in the `ic-skills` registry's own "Adoption candidates from the public repository" section (`registry.md`: "Skills in [`alihusains/enterprise-skills`](https://github.com/alihusains/enterprise-skills) that map onto planned IC skills"). This task builds real interop with that SAME real, already-known repo — not a fabricated or guessed external marketplace API — reusing the skill-copy plumbing already built (M030/M041/M044/M045).

## Current state

Read `packages/core/src/skills.ts` in full: `createSkill`, `getSkillsLibraryDir`, `parseSkillFrontmatter`, `assertSafeId`. This task's "install" action should reuse these exact primitives (write a real skill folder into the shared library, validated the same way a locally-created skill is) rather than inventing a parallel write path.

Verify the real, current shape of `https://github.com/alihusains/enterprise-skills` yourself (e.g. via the GitHub REST API `GET /repos/alihusains/enterprise-skills/contents/` and drilling into subdirectories, unauthenticated, no token needed for public repos) before writing any fetch code — confirm how skills are actually laid out in that repo (one folder per skill with a `SKILL.md`? A different structure?) rather than assuming the exact same `<skill-id>/SKILL.md` convention used locally. If the real repo structure differs from what's assumed here, adapt to what you actually find — do not force a mismatched assumption.

## Target state

A new module `packages/core/src/marketplace.ts`:

```ts
export interface MarketplaceSkillSummary {
  id: string;           // folder/skill name in the source repo
  name: string;         // from SKILL.md frontmatter
  description?: string;
  sourceRepo: string;   // 'alihusains/enterprise-skills'
  sourcePath: string;   // path within that repo
  htmlUrl: string;      // link to view it on github.com
}

export async function listMarketplaceSkills(opts?: { force?: boolean }): Promise<MarketplaceSkillSummary[]>
export async function fetchMarketplaceSkillContent(id: string): Promise<{ files: Array<{ path: string; content: string }> } | null>
export async function installMarketplaceSkill(id: string, opts?: SkillsDirOptions): Promise<{ targetPath: string }>
```

Behavior:
- `listMarketplaceSkills`: fetches the real repo's directory listing via the unauthenticated GitHub REST API (`https://api.github.com/repos/alihusains/enterprise-skills/contents/...` — use Node's built-in `fetch`, no new HTTP client dependency), parses each skill's `SKILL.md` frontmatter (reuse `parseSkillFrontmatter` from `skills.ts`), and returns a summary list. Cache the result in memory with a reasonable TTL (e.g. 10 minutes) or on disk (your call, document it) so repeated GUI loads within a session don't re-hit the rate limit; `force: true` bypasses the cache for an explicit user-triggered refresh.
- `fetchMarketplaceSkillContent`: fetches the full file contents of one skill folder (SKILL.md plus any companion files) for preview or install.
- `installMarketplaceSkill`: writes the fetched skill's files into the shared library (`getSkillsLibraryDir()`), using the same safety checks as `createSkill` (`assertSafeId` on the id, no path traversal, no overwriting without the caller knowing). If a skill with that id already exists locally, do not silently overwrite — return a clear error (or add an explicit `overwrite: true` param — your call, document the choice) so the user isn't surprised.
- Handle GitHub API rate-limiting (HTTP 403 with a rate-limit message) with a clear, honest error — do not retry silently in a loop, do not fabricate a fallback list.

Add HTTP routes to `gui-server.ts` following existing conventions exactly: `GET /api/marketplace/skills`, `GET /api/marketplace/skills/:id`, `POST /api/marketplace/skills/:id/install`.

## Read first

### Current code

- `packages/core/src/skills.ts` (full file — reuse `parseSkillFrontmatter`, `getSkillsLibraryDir`, `assertSafeId`, and the `createSkill` write pattern)
- `packages/cli/src/gui-server.ts` (existing skills routes, for the exact convention to follow)
- The REAL current structure of `https://github.com/alihusains/enterprise-skills` (verify via a real API call before assuming its shape)

### Tests

- `packages/core/src/marketplace.test.ts` — new file. Mock the GitHub API calls (do not make real network calls in the automated test suite — use a test seam, e.g. an injectable fetch function, following whatever pattern is cleanest given this codebase's existing test conventions). Cover: listing parses frontmatter correctly from a mocked response; caching avoids a second fetch within the TTL; `force: true` bypasses it; install writes files correctly and refuses to silently overwrite an existing local skill; a mocked rate-limit response produces a clear error, not a crash or a silent retry loop.

## Allowed scope

- `packages/core/src/marketplace.ts` (new)
- `packages/core/src/marketplace.test.ts` (new)
- `packages/core/src/index.ts` (export addition only)
- `packages/cli/src/gui-server.ts` (new routes only)

## Forbidden scope

- `packages/core/src/skills.ts` (consume its existing exports only, do not modify it)
- Any GUI file (M067's territory)
- Any new npm dependency (Node's built-in `fetch` is available in Node 20+; do not add an HTTP client library)

## Exact requirements

1. Real interop with the real `alihusains/enterprise-skills` repo structure (verified, not assumed).
2. 100% user-triggered fetching, never automatic/background.
3. Caching to respect GitHub's rate limit.
4. Install reuses `skills.ts`'s existing safety primitives, never silently overwrites.
5. Honest error handling for network failure / rate-limiting — no silent retries, no fabricated fallback data.
6. Full core + cli test suites green, with real (mocked, not live) test coverage for the new module.

## Non-goals

- No support for a second marketplace source in this task (one real, working source first).
- No automatic periodic sync.
- No GUI (M067).

## Implementation constraints

- No new dependency — use built-in `fetch`.
- Follow existing naming/error-handling conventions.
- Smallest correct diff.
- No speculative abstractions beyond what's needed for this one real source (design the interface so a second source COULD be added later without a rewrite, but do not build a generic multi-source system now).

## Interface / contract

See the three exported functions above — this is the frozen contract for M067 (the GUI task).

## Dependencies

- Upstream: none
- Downstream: M067 (GUI)

## Verification

Run:

```bash
cd /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M066-skill-marketplace-backend
pnpm install --frozen-lockfile
pnpm build
pnpm --filter @ai-agent-config/core test
pnpm --filter @ai-agent-config/cli test
```

Also verify:

- `git status --short` within allowed scope only
- A real, one-off manual check (not part of the automated suite) that a real unauthenticated call to `https://api.github.com/repos/alihusains/enterprise-skills/contents/` actually succeeds and matches what your parsing code expects — paste the real response shape you found

## Expected evidence

- exact commands executed
- real test output
- files changed
- the real repo structure you verified before writing the fetch/parse logic
- limitations or failures

## Completion criteria

- real, verified interop with the real repo
- user-triggered only, cached, rate-limit-safe
- reuses existing skill-write safety primitives
- full test suites green

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
