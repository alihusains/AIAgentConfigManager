# Contributing to AgentSync

Thank you for wanting to help! AgentSync is a small, friendly project — the maintainer is
**non-technical by trade** and relies on contributors (and an AI review assistant) to keep
quality high. That means your contribution is genuinely valued and will never sit unreviewed.

## The short version

1. **Open an issue first** — describe what you want to change (or pick one from
   [`docs/community-issues.md`](docs/community-issues.md)).
2. **Keep PRs small** — one logical change per pull request (a bug fix, a feature, a doc
   improvement). Tiny PRs are far easier to review.
3. **Make sure it builds and passes checks** — `pnpm build` must be green.
4. **No secrets, ever** — never commit API keys, tokens, or real config data. Redact examples.
5. **Wait for review** — every MR is reviewed (the maintainer's AI assistant helps). Expect
   questions and small change requests; they are normal and welcome.

## Development setup

```bash
git clone <your-fork-url>
cd agentsync
pnpm install        # pnpm ≥ 9 required (see packageManager in package.json)
pnpm build          # builds core, cli, gui (turbo)
pnpm cli detect     # sanity check against your own machine
```

Workspace layout:

```
packages/
├── core/   # adapters (per-agent read/write), registry, API-verification engine
├── cli/    # `ai-config` command surface + the local GUI server (REST API)
└── gui/    # React dashboard (Vite) — pure API client, never touches the filesystem
```

## How an MR gets made (with the maintainer)

The maintainer uses an AI assistant to co-drive changes. Practically:

1. You open/clarify the issue — state *what* and *why* in plain terms.
2. You (or the assistant, if you prefer) implement the change.
3. The assistant reviews your diff, runs the build, and summarizes the review **before**
   the maintainer merges — so the merge decision is always human, but never blind.

If you'd rather write the issue and let the tooling do the coding, say so in the issue —
that workflow is supported and appreciated.

## Code style

- TypeScript, strict types; match the style of the surrounding file.
- Core package ships **no UI** and no `node:fetch`-free assumptions (Node ≥ 20).
- GUI package imports **only types** from core — the browser never touches the filesystem.
- Prefer small focused modules (see `packages/core/src/provider-test.ts` as an example).
- Don't bloat: no new runtime dependencies without a good reason discussed in the issue.

## Checking your work

```bash
pnpm build                # turbo: core → cli → gui (must pass)
cd packages/gui && pnpm typecheck
```

Add or update tests where the change is logic-heavy (`vitest` lives in `packages/cli` /
`packages/core`). Behavioral changes to the API-verification engine should include a
probe-case in the smoke suite.

## Questions?

Open a discussion or an issue at any time — "how do I…" questions are welcome and answered
quickly. We'd rather have a shy first contributor than a perfect first PR.