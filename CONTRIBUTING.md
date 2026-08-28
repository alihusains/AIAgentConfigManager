# Contributing to AgentSync

Thank you for wanting to help. AgentSync is a small, friendly project. The maintainer is
non-technical by trade and relies on contributors (and an AI review assistant) to keep
quality high, so your contribution is genuinely valued and will never sit unreviewed.

## The short version

1. **Open an issue first.** Describe what you want to change, or pick one from
   [`docs/community-issues.md`](docs/community-issues.md).
2. **Keep PRs small.** One logical change per pull request: a bug fix, a feature, a doc
   improvement. Tiny PRs are far easier to review.
3. **Make it pass checks.** `pnpm lint && pnpm build && pnpm typecheck && pnpm test` must
   all be green; CI runs exactly those four on every push and PR.
4. **No secrets, ever.** Never commit API keys, tokens, or real config data. Redact examples.
5. **Wait for review.** Every PR is reviewed (the maintainer's AI assistant helps). Expect
   questions and small change requests; they are normal and welcome.

## Development setup

```bash
git clone <your-fork-url>
cd <your-clone-directory>
pnpm install        # pnpm >= 9 required (see packageManager in package.json)
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

## Running tests

Run everything:

```bash
pnpm test
```

Or one package at a time, which is faster while you iterate:

```bash
pnpm --filter @ai-agent-config/core test   # adapters, registry, verification
pnpm --filter @ai-agent-config/cli test    # CLI + GUI server (slower: spawns servers)
pnpm --filter gui test                     # dashboard components
```

Run a single test file by name:

```bash
pnpm --filter @ai-agent-config/core test adapter-roundtrip
```

Bugs found in the wild become regression tests before the fix merges. If you fix a bug,
add the test that would have caught it.

## Adding a new agent adapter (the most valuable contribution)

Every supported agent is one adapter file in `packages/core/src/adapters/`. Adding one
gets a whole community of that agent's users onto the registry, and the pattern is
well-worn: 24 adapters exist to copy from.

### 1. Research the agent's config format first

Before writing code, answer these from the agent's own source or docs, not from memory:

- Where does its config live on each platform (macOS, Linux)? One file or several?
- What format: JSON, JSONC (comments), TOML, YAML?
- How does it store model providers and API keys?
- How does it configure MCP servers, and does it support them at all?
- Does it have a permissions model?

If the agent does not support a capability (Aider has no native MCP support, for
example), the honest answer is a detect-only or partial adapter that throws a clear
error, not a fake write. See `aider.ts` and `omp.ts` for the detect-only pattern.

### 2. Implement the `AgentAdapter` interface

The contract is `AgentAdapter` in `packages/core/src/types/index.ts`. The core surface:

- `info`: agent id, name, binary names, capabilities
- `getConfigPath(platform)` / `getMCPConfigPath(platform)`: where config lives
- `readConfig()` / `writeConfig(config)` / `validateConfig(config)`
- Provider operations: `listModelProviders`, `addModelProvider`, `removeModelProvider`, `updateModelProvider`
- Model operations: `listModels`, `addModel`, `removeModel`, `updateModel`
- MCP operations: `listMCPServers`, `addMCPServer`, `removeMCPServer`, and friends
- Backup/restore hooks

Pick the closest existing adapter as your starting point:

- JSON config with an `mcpServers` map: start from `claude-code.ts` or `cline.ts`
- OpenCode-style JSON (providers + models in one file): start from `opencode-style.ts`
- TOML: start from `codex.ts`
- Detect-only: start from `aider.ts`

### 3. Preserve what you don't understand

The one rule that makes this tool trustworthy: **writes must be shape-aware and
merge-preserving.** Unknown keys in the user's config survive untouched, comments in
JSONC files survive, and you only add or remove the entries the registry manages. Read
`generic.ts` and the existing adapters before inventing new write logic.

### 4. Register it

- Export your factory from `packages/core/src/adapters/index.ts` and add it to the
  `adapters` map with the agent's id.
- Add a catalog entry in `packages/core/src/agent-catalog.json`: display name, binary
  names, per-platform config/credential paths, `apiTypes` (`chat` / `responses` /
  `anthropic`), and install/uninstall commands if the agent has a standard install.

### 5. Test it

Add a roundtrip test following `adapter-roundtrip.test.ts`: write a provider, model,
and MCP server through your adapter into a fixture config, read them back, and prove
that pre-existing unknown keys survived. Adapters without tests do not merge.

## Commit messages

Conventional commits, matching the existing history:

```
<type>(<scope>): <description>
```

Types in use: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`.
Scope is the package or area: `core`, `cli`, `gui`. Examples from the log:

```
feat(core): add Windsurf and Roo Code adapters
fix(core): OMP adapter is detect-only - revert to honest scope
docs: canonical redesign epic spec
```

## Pull request process

1. Fork, branch from `main`, make your change.
2. Run the full gate locally: `pnpm lint && pnpm build && pnpm typecheck && pnpm test`.
3. Open the PR with: what changed, why, and how you verified it. If it's an adapter,
   name the agent version you tested against.
4. CI must be green before review starts.
5. Review happens on every PR. Address CRITICAL/HIGH feedback before merge; smaller
   suggestions can land as follow-ups.

## Reporting bugs and asking questions

Use the issue templates. For bugs, the agent involved and your OS matter more than
anything else here, because this project is entirely about cross-tool config paths.

## Code of conduct

Be kind. The full policy is in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
