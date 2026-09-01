# AgentControl Implementation Guide

**For:** Future maintainers and developers onboarding to this project
**Last updated:** 2026-09-01
**Scope:** Architecture, file organization, key concepts, and how to extend

---

## 0. What This Is

AgentControl is a local-first configuration manager for AI coding agents. It maintains one registry of providers, models, MCP servers, and permissions — then materializes those definitions into every agent's native config format. The tool:

- Detects what agents you have installed
- Lets you define providers/models/MCP servers once
- Rewrites each agent's config files without touching unknown keys
- Shows contradictions between agents (Cursor allows X, Claude forbids X)
- Stores API keys in your OS keychain, not in plaintext

**Working name:** AgentControl  
**CLI binary:** `agm`  
**NPM package:** `agentcontrol` (not yet published)

---

## 1. Architecture Overview

```
packages/
├── core/                  # Business logic: registry, adapters, detection, keychain
│   └── src/
│       ├── adapters/      # 24 adapters (claude-code.ts, codex.ts, etc.)
│       ├── registry.ts    # Provider/Model/MCP/Permission storage + CRUD
│       ├── index.ts       # Main Controller (public API entry point)
│       ├── keychain.ts    # OS keychain integration
│       ├── env-vars.ts    # Read + redact environment variables
│       ├── types/         # Unified types all adapters implement
│       └── utils/
│           ├── redact.ts  # Key masking for safe output
│           └── ...
├── cli/                   # Command-line interface + GUI server
│   └── src/
│       ├── index.ts       # Commander.js CLI entry (agm command)
│       └── gui-server.ts  # Express server for dashboard
└── gui/                   # React dashboard UI
    └── src/
        ├── components/    # Views: Providers, MCP, Agents, Settings, etc.
        ├── ui/            # Primitives: Button, Card, Status, Skeleton, etc.
        ├── hooks/         # useWindowedList, useAsync, etc.
        └── index.css      # Design tokens (114 CSS variables across 2 themes)
```

### Dataflow

```
┌─────────────────────────────────┐
│   User action (CLI/GUI)         │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   Controller (packages/core)    │  ← registerProvider() / updateModel() / etc.
│   - Validates                   │
│   - Persists to registry.json   │
│   - Stores secrets in keychain  │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   Adapter selection             │  ← getAdapter(agentId)
│   (claude-code, codex, etc.)    │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   materializeToAgent()          │  ← Read agent's native config
│   - Resolve keychain refs       │  ← Materialize registry entries
│   - Merge with existing config  │  ← Write atomically (temp + rename)
│   - Preserve unknown keys       │
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│   Agent's native config file    │  ← ~/config.json, ~/.codeium/..., etc.
│   (format-aware, not clobbered) │
└─────────────────────────────────┘
```

---

## 2. Key Concepts

### Adapters

Each agent (Claude Code, Cursor, opencode, etc.) has an **adapter** — a class implementing the `AgentAdapter` interface:

```typescript
interface AgentAdapter {
  info: AgentInfo;  // name, version check, config path for this OS
  readConfig(): Promise<Config>;
  writeConfig(config: Config): Promise<void>;
  addProvider(provider: ProviderConfig): Promise<void>;
  // ... + addModel, addMcp, addPermission, detectTools, etc.
}
```

**Location:** `packages/core/src/adapters/`

**Why separate adapters?**
- Each agent uses a different config file format (JSON, JSONC, TOML, YAML)
- Config paths differ per OS (`~/.cursor/settings.json` on macOS vs Windows `%APPDATA%\...`)
- Some agents embed MCP definitions in the main file; others use an `mcp_servers.json` sidecar
- Some agents support permissions (Claude Code's `CLAUDE.md`); others don't

**Adding a new adapter:**
1. Create `packages/core/src/adapters/my-agent.ts`
2. Implement `AgentAdapter` interface
3. Export `createMyAgentAdapter()` factory
4. Register in `packages/core/src/adapters/index.ts` (add to the `adapters` Map)
5. Add roundtrip test in `packages/core/src/adapters/adapter-roundtrip.test.ts`
6. See `CONTRIBUTING.md` for the 5-step documented process

### Registry

**File:** `~/.aicm/registry.json`

**Contains:**
```json
{
  "providers": [
    { "id": "openai-main", "config": { "baseUrl": "...", "apiKey": "" }, "keychainSecretRef": "provider:openai-main" },
    { "id": "anthropic-main", "config": { ... }, "keychainSecretRef": "provider:anthropic-main" }
  ],
  "models": [
    { "id": "gpt-4o", "providerId": "openai-main", "display": "GPT-4o" }
  ],
  "mcp": [
    { "id": "filesystem", "servers": [...] }
  ],
  "permissions": [
    { "id": "unrestricted-bash", "agents": ["claude-code", "cursor-cli"] }
  ]
}
```

**Key points:**
- API keys are **never stored here** (Phase 1) — only a `keychainSecretRef` like `"provider:openai-main"`
- The real key lives in the OS keychain
- Registry is the single source of truth for all agents
- Materialization reads the registry and writes agent-specific config files

**CRUD operations in `packages/core/src/registry.ts`:**
- `registerProvider(provider)` — add to registry + keychain
- `getProvider(id)` — read from registry
- `updateProvider(id, updates)` — merge updates
- `deleteProvider(id)` — remove from registry, delete cascade (remove from all agents), clean keychain

### Drift Detection

**What is drift?** An agent's config file was edited outside the tool. Example:
- User adds an MCP server to Claude Code manually (via `claude mcp add`)
- AgentControl doesn't know about it
- Next materialization could overwrite it (or leave it orphaned)

**How it works:**
- `detectDrift(agentId)` reads the agent's current config
- Computes what the registry-managed subset *should* look like
- Compares: if they differ, drift is detected
- Shows the diff to the user (Phase 2 feature, partially complete)

**Location:** `packages/core/src/index.ts` method `detectDrift()`

### Permissions Audit

**What is it?** Cross-agent contradiction detection.

**Example:**
```
Claude Code: { permissions: { "allow": ["bash", "python"] } }
Cursor CLI:  { permissions: { "deny": ["bash"] } }
→ CONTRADICTION: Bash allowed in Claude but denied in Cursor
```

**Location:** `packages/core/src/index.ts` method `auditPermissions()`

**Returns:** List of permission entries and which agents grant/deny them.

### Keychain Integration

**Why?** API keys should never be written to `registry.json` in plaintext.

**How?**
1. User creates a provider: "Store in OS keychain" (default)
2. Real key is passed to `storeProviderApiKeyInKeychain(provider)`
3. OS keychain stores it under account name `"provider:openai-main"` (or similar)
4. Registry stores only the reference: `{ keychainSecretRef: "provider:openai-main", config: { apiKey: "" } }`
5. At materialization time, `resolveProviderApiKey()` fetches from keychain

**Platforms:**
- macOS: Keychain API
- Linux: libsecret / KWallet
- Windows: Credential Manager

**Location:** `packages/core/src/keychain.ts`

**Graceful degradation:** If keychain is unavailable (headless CI, locked vault), resolution returns `null` and the agent materializes with an empty API key (no crash, no silent fallback to plaintext).

---

## 3. File Organization

### packages/core/src

| File | Purpose |
|------|---------|
| `index.ts` | Main `Controller` class + public API (registerProvider, materializeToAgent, detectDrift, auditPermissions, etc.) |
| `registry.ts` | Registry read/write/delete, keychain primitives, cascade logic |
| `keychain.ts` | OS keychain backend (macOS Keychain, libsecret, Windows Credential Manager) |
| `env-vars.ts` | Read shell profile, mask sensitive values, edit environment variables |
| `types/index.ts` | Unified type definitions (ProviderConfig, ModelConfig, MCPConfig, PermissionConfig, etc.) |
| `utils/redact.ts` | Mask API keys for safe output (`maskKey()`, `maskKeyWithPrefix()`, `looksLikeSecret()`) |
| `agent-catalog.json` | 37-entry catalog of agent CLI metadata (install commands, config paths per OS, wire-API types) |
| `adapters/` | 24 agent adapters (claude-code.ts, codex.ts, cursor-cli.ts, etc.) + generic.ts base class |
| `adapters/index.ts` | Adapter registry Map + factory functions |
| `*test.ts` | Test files (co-located with source) |

### packages/cli/src

| File | Purpose |
|------|---------|
| `index.ts` | Commander.js CLI definition (commands: detect, provider, model, mcp, permission, backup, gui) |
| `gui-server.ts` | Express server for dashboard; token-gated HTTP routes for API operations |
| `*test.ts` | CLI + GUI server tests |

### packages/gui/src

| File | Purpose |
|------|---------|
| `components/` | React components: ProviderView, MCPView, AgentView, SettingsView, SkillsView, etc. |
| `ui/` | Primitives: Button, Card, Modal, Input, Status (dot + text, not color-only), Skeleton, Logo, etc. |
| `hooks/` | useAsync (with abort), useWindowedList (memoized, dependency-light), useTheme, etc. |
| `index.css` | 114 design tokens in light + dark themes; all color/type/spacing/motion defined here |
| `store/` | (Optional) state management if needed beyond React hooks |
| `*test.tsx` | Component tests (Vitest + React Testing Library) |

---

## 4. How to Extend

### Adding a New Agent

**File:** Create `packages/core/src/adapters/my-agent.ts`

```typescript
import type { AgentAdapter, AgentInfo, Config } from '../types';

export const createMyAgentAdapter = (): AgentAdapter => {
  return {
    info: {
      name: 'My Agent',
      binaries: ['my-agent', 'my-agent-cli'],
      supports: {
        providers: true,
        models: true,
        mcp: true,
        permissions: false,
      },
      platforms: {
        darwin: { configPath: '~/.my-agent/config.json' },
        linux: { configPath: '~/.my-agent/config.json' },
        win32: { configPath: '%APPDATA%\\.my-agent\\config.json' },
      },
    },
    getConfigPath: (platform) => {
      // Return config path for the given platform
    },
    readConfig: async () => {
      // Parse the agent's native config file, return Config
    },
    writeConfig: async (config: Config) => {
      // Serialize Config to agent's native format, write atomically
    },
    addProvider: async (provider: ProviderConfig) => {
      // Merge provider into the agent's config
    },
    // ... addModel, addMcp, addPermission, removeProvider, detectTools, etc.
  };
};

export const MyAgentAdapter = createMyAgentAdapter;
```

**Register it:**
In `packages/core/src/adapters/index.ts`:
```typescript
export { createMyAgentAdapter } from './my-agent';
// ... in imports
import { createMyAgentAdapter } from './my-agent';
// ... in the Map
['my-agent', createMyAgentAdapter],
```

**Add tests:**
In `packages/core/src/adapters/adapter-roundtrip.test.ts`, add a fixture and roundtrip test that verifies:
1. Read a sample config
2. Add a provider/model/MCP entry
3. Write back
4. Re-read and confirm the entry is there (and unknown keys survived)

**See:** `CONTRIBUTING.md` for the complete 5-step guide.

### Adding a New CLI Command

**File:** `packages/cli/src/index.ts`

```typescript
program
  .command('my-command')
  .description('Do something useful')
  .option('--flag', 'A flag')
  .action(async (options) => {
    try {
      const controller = new Controller();
      const result = await controller.myMethod(options);
      console.log(result);
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });
```

### Adding a GUI Component

**File:** `packages/gui/src/components/MyView.tsx`

```typescript
import type { FC } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export const MyView: FC = () => {
  return (
    <Card>
      <h2>My View</h2>
      <Button onClick={() => alert('Hello')}>Click me</Button>
    </Card>
  );
};
```

**Use design tokens only** — no hex literals. Example:
```css
.my-component {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  padding: var(--space-4);
  border-radius: var(--radius-md);
}
```

**Add tests:** Co-locate a `.test.tsx` file using Vitest + React Testing Library.

---

## 5. Testing Philosophy

### Unit Tests (adapters)

Each adapter has a roundtrip test:
```typescript
const config = readConfig(fixtureFile);
const updated = adapter.addProvider(config, newProvider);
const written = adapter.writeConfig(updated);
const read = adapter.readConfig(written);
// Confirm newProvider is in the result
// Confirm unknown keys survived
```

**Run:** `pnpm test` or `pnpm --filter @ai-agent-config/core test`

### Integration Tests (registry + adapters)

Test the full flow:
```typescript
const registry = createRegistry();
await registry.registerProvider(provider);
await registry.materializeToAgent('claude-code');
// Confirm Claude Code's config file now has the provider
```

### GUI Tests (React Testing Library)

Test components in isolation:
```typescript
render(<ProviderForm onSubmit={jest.fn()} />);
const input = screen.getByPlaceholderText('API Key');
fireEvent.change(input, { target: { value: 'sk-test' } });
// Confirm form state updates
```

### End-to-End Tests

Manual: Start the GUI server, open the dashboard, add a provider, verify it appears in an agent's config file.

```bash
node packages/cli/dist/index.js start  # Starts GUI on http://127.0.0.1:4321/?t=<token>
```

---

## 6. Build, Test, Deploy

### Local Development

```bash
# Install dependencies (pnpm required)
pnpm install

# Build all packages (type-check + transpile)
pnpm build

# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @ai-agent-config/core test

# Start the dashboard (for manual testing)
node packages/cli/dist/index.js start
# Then open http://127.0.0.1:4321 and use the token from the output
```

### CI/CD

GitHub Actions (see `.github/workflows/ci.yml`):
1. Lint: `pnpm lint` (Biome)
2. Type-check: `tsc --noEmit` (in each package)
3. Build: `pnpm build`
4. Test: `pnpm test`

**Lint rules:**
- `@biomejs/biome lint` with `recommended` config
- `noUnusedVariables` → error
- `noExplicitAny` → warn
- `noNonNullAssertion` → explicitly disabled (see `biome.json`)

### Publishing (Future)

```bash
# Bump version in all package.json files
pnpm version patch  # or minor, major

# Tag and push (requires founder approval)
git tag v0.2.0
git push origin v0.2.0

# Publish to npm (requires npm token)
npm publish --workspace packages/core
npm publish --workspace packages/cli
npm publish --workspace packages/gui
```

---

## 7. Common Patterns

### Masking Secrets in Output

Always use `maskKey()`:
```typescript
import { maskKey } from '../utils/redact';

console.log(`Using API key: ${maskKey(apiKey)}`);
// Output: Using API key: sk-a3…9z12
```

### Atomic File Writes

Never overwrite directly:
```typescript
import { writeFileSync, renameSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

const tempFile = join(dirname(configPath), `.${randomUUID()}.tmp`);
writeFileSync(tempFile, JSON.stringify(config, null, 2), { mode: 0o600 });
renameSync(tempFile, configPath);  // Atomic
```

### Error Handling

Use `OperationResult<T>`:
```typescript
type OperationResult<T = void> = 
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function doSomething(): Promise<OperationResult> {
  try {
    // ...
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}
```

### Async Detection

CLI commands scan for agent binaries asynchronously:
```typescript
const agents = await detectAgents();  // Platform-aware, parallel
// agents: Map<agentId, AgentInfo>
```

---

## 8. Known Limitations & TODOs

### Secrets (Phase 1)

- ✅ OS keychain integration landed
- ✅ New providers opt into keychain by default
- ⏳ Plaintext migration helpers (Phase 1 continuation)
- ⏳ Encrypted registry export (Phase 4)

### Drift Detection (Phase 2)

- ✅ `detectDrift()` method exists and is tested
- ✅ Tests verify drift is detected
- ⏳ UI to show drift and offer re-sync (Phase 2)

### Permissions Audit (Phase 2)

- ✅ `auditPermissions()` method exists and is tested
- ✅ Contradiction detection works
- ⏳ UI to display contradictions (Phase 2)

### GUI Design Debt

- ✅ Design token system v2 (electric violet + signal green)
- ✅ Single dark theme (removed divergent themes)
- ✅ WCAG AA contrast verified for all text tokens
- ⏳ Full audit findings (see `docs/audits/gui-design-audit.md`)

### Performance

- ✅ Adapter detection runs in parallel
- ✅ Config reads are memoized
- ✅ GUI table windowing (useWindowedList) for large lists
- ⏳ Profile results and optimize further if needed

---

## 9. Security Model

### Secret Storage

1. **New providers:** OS keychain (default)
   - Keychain stores real key under `provider:<id>`
   - Registry stores only reference: `{ keychainSecretRef: "provider:openai-main", config: { apiKey: "" } }`

2. **Existing/plaintext providers:** (rare, documented with WARNING badge)
   - Some adapters require plaintext (historical constraint)
   - Plan: migrate to env vars or keychain

3. **At materialization:**
   - `resolveProviderApiKey()` fetches from keychain
   - Returns `null` if keychain unavailable (headless CI) — agent materializes with empty key, no fallback

### GUI Server

- Binds to `127.0.0.1:5900` (localhost only)
- Per-launch session token (unique UUID, not reusable)
- All `/api/*` routes require `?token=<uuid>`
- Token disappears from address bar after page load

### Output Redaction

- CLI output masks keys: `sk-a3…9z12` instead of `sk-a3vxb…q9z12`
- Env vars detected as sensitive (names containing KEY, TOKEN, SECRET, PASSWORD, CREDENTIAL) are masked by default
- Reveal is explicit per-variable (not automatic, not persistent)

**See:** `docs/security/threat-model.md` for full security model.

---

## 10. Useful Links

- **ROADMAP.md** — Product vision and phase definitions
- **productroadmap.md** — Evidence sourcing and current state
- **CONTRIBUTING.md** — How to add an adapter, PR checklist
- **docs/epics/agentic-control-plane-redesign-v2.md** — Design token spec with exact colors
- **docs/security/threat-model.md** — Security model, keychain flow, testing checklist
- **docs/audits/** — Security audit, GUI design audit, performance baseline
- **CHECKPOINT.md** — Hand-off notes from previous agent sessions

---

## 11. Onboarding Checklist

- [ ] Clone the repo: `git clone https://github.com/ali-sorathiya/agentcontrol`
- [ ] Install: `pnpm install`
- [ ] Verify: `pnpm build && pnpm test` (all green)
- [ ] Explore adapters: `ls packages/core/src/adapters/ | head -5`
- [ ] Read an adapter: `cat packages/core/src/adapters/claude-code.ts` (300 lines)
- [ ] Start the GUI: `node packages/cli/dist/index.js start`
- [ ] Add a test provider and verify it materializes to Claude Code's config
- [ ] Pick a Phase 2 task from `productroadmap.md` and start here
- [ ] Ask for help in the repo's discussions or issues

---

**Good luck! This is a solid codebase with strong testing and documentation. The next developer will be proud to maintain it.**
