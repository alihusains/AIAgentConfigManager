# Phase 1: Secrets Management Design Proposal

**Status:** Research & Design  
**Last Updated:** August 2025  
**Author:** Claude Code (AI Agent)  
**Lead Decision:** Ali Sorathiya

## Executive Summary

The AIAgentConfigManager stores API credentials in plaintext across 25+ agent config files and the central `registry.json`. This research proposal evaluates OS keychain integration (macOS Keychain, Windows Credential Manager, Linux libsecret) as the foundation for Phase 1 secrets management. The proposal outlines three architecture options and recommends **Option 2: Unified Keychain Service with Registry References** as the optimal path balancing security, maintainability, and agent compatibility.

---

## Current State: Plaintext Credentials Everywhere

### Architecture Overview

The system manages credentials for 25+ coding agents (Claude Code, Codex, Cursor, Pi, Zed, Continue, Windsurf, Cline, Roo Code, Copilot CLI, GitHub Copilot CLI, Goose, Aider, Kilo, Kimi, Qwen, Crush, Junie, Freebuff, Amazon Q, OMP, Droid, and others) through a single registry:

```
┌─────────────────────────────────────────────────────────────┐
│  AIAgentConfigManager                                       │
├─────────────────────────────────────────────────────────────┤
│  1. Central Registry: ~/.ai-agent-config/registry.json      │
│     - Stores: [RegistryProvider] + [RegistryMCPServer]      │
│     - Each provider carries config.apiKey in plaintext      │
│     - ~710 bytes per API key instance (overhead included)   │
│                                                             │
│  2. Materialization (Agent Sync Layer)                      │
│     syncAgents() → materializeAgent() → adapter.writeConfig│
│     Writes registry-managed credentials into agent configs  │
│                                                             │
│  3. Agent Config Files (25+ targets)                        │
│     Codex:     ~/.codex/config.toml (env_key reference)    │
│     Claude:    ~/.claude/settings.json (apiKey plaintext)  │
│     OpenCode:  ~/.config/opencode/settings.json (options)  │
│     Pi:        ~/.pi/agent/models.json (apiKey plaintext)  │
│     Continue:  ~/.continue/config.yaml (no models; MCP)    │
│     Zed:       ~/.config/zed/settings.json (no models)     │
│     ... and 19 more                                         │
│                                                             │
│  4. GUI Dashboard (Localhost + Token Auth)                  │
│     - Displays full registry state (including apiKey)       │
│     - Reveal/Hide toggle for UI; curl masked by default    │
│     - Explicit copy to clipboard action                     │
│     - No HTTP transmission outside localhost               │
└─────────────────────────────────────────────────────────────┘
```

### Credential Placement by Agent Type

| **Agent ID** | **Config Format** | **Provider Support** | **Key Storage** |
| --- | --- | --- | --- |
| **claude-code** | JSON | Yes (settings.env) | Plaintext `env` dict |
| **codex** | TOML | Yes (env_key ref) | ENV VAR REFERENCE (`PROVIDER_API_KEY`) |
| **cursor-cli** | JSON | No | N/A (MCP only) |
| **pi** | JSON | Yes (models.json) | Plaintext `apiKey` field |
| **zed** | JSON | No | N/A (MCP only) |
| **continue** | YAML | No | N/A (MCP only) |
| **roo-code** | JSON | No | N/A (MCP only) |
| **cline** | JSON | No | N/A (MCP only) |
| **copilot-cli** | JSON | No | N/A (MCP only) |
| **goose** | YAML | No | N/A (MCP only) |
| **aider** | YAML | No (detect-only) | `.env` file (user-managed) |
| **gemini** | Detect-only | No | OAuth via Google account |
| **omp** | YAML | No (detect-only) | Detect-only, env var driven |
| **kimi** | TOML | No | N/A (MCP only) |

**Key Findings:**

- **5 agents** accept model providers: claude-code, codex, pi, opencode-style (and variants: cline, crush)
- **Codex** already uses ENV VAR references (`env_key: "PROVIDER_API_KEY"`) — closest to secrets pattern
- **19 agents** do NOT store credentials in their config (MCP-only or detect-only)
- **Plaintext exposure:** claude-code, pi, opencode-style variants write bare `apiKey` into JSON

### Security Audit Findings

The existing audit (`docs/audits/security-audit-adapter-io.md`) confirms:

- **Registry File Permissions:** Created with default umask (644). Multi-user systems leak plaintext keys.
- **GUI API Key Exposure:** By design—user requests reveal via UI toggle; localhost-only with per-launch token auth.
- **No console.log leaks:** Audit found no unintended key logging.
- **Curl masking:** Provider verification displays curl commands with keys masked (e.g., `sk-a3…9z`).
- **Verdict:** No security fixes required for local single-user threat model, but plaintext is the known risk.

---

## Keychain Landscape & Library Analysis

### OS Keychain Overview

| **Platform** | **Service** | **Scope** | **API** | **Notes** |
| --- | --- | --- | --- | --- |
| **macOS** | Keychain | User keychain (local or iCloud) | Security.framework | Native C/Swift API; sandboxed access control |
| **Windows** | Credential Manager | Local machine | Win32 DPAPI | Per-user credential vault (sync via Windows Account) |
| **Linux** | Secret Service API (D-Bus) | Session or persistent backends | org.freedesktop.Secret.Service | DBus interface; Gnome Keyring, KDE Wallet, pass, secretstorage |

### Node.js Keychain Libraries

#### **Candidate 1: `keytar` (atom/node-keytar)**

- **Status:** Actively maintained (v7.9.0, 2025)
- **API:** `getPassword(service, account)`, `setPassword(service, account, password)`, `deletePassword(service, account)`
- **Platform Coverage:** macOS (Keychain), Windows (Credential Manager), Linux (libsecret)
- **Installation:** Requires native build tools; Linux requires `libsecret-dev` + `pkg-config`
- **Limitations:**
  - Old libuv version (potential vulnerabilities)
  - Heavy native dependencies
  - Binary prebuilds only for LTS Node versions
- **Usage:** 1.9M weekly downloads (very stable, widely used)
- **Example:**

  ```typescript
  import keytar from 'keytar';
  await keytar.setPassword('AIAgentConfig', 'anthropic-key', 'sk-...'); 
  const pwd = await keytar.getPassword('AIAgentConfig', 'anthropic-key');
  ```

#### **Candidate 2: `@napi-rs/keyring` (Brooooooklyn/keyring-node)**

- **Status:** Actively maintained (v1.3.0, April 2026)
- **API:** `Entry` class with `set(service, account, password)`, `get(service, account)`, `delete(service, account)`
- **Platform Coverage:** macOS, Windows, Linux (libsecret)
- **Installation:** Pure NAPI (Rust) bindings; no libsecret-dev required on Linux (uses system libsecret via pkg-config)
- **Advantages:**
  - Modern NAPI architecture (no legacy libuv coupling)
  - **100% keytar-compatible** (marketed as drop-in replacement)
  - Smaller binary footprint (35KB unpacked)
  - Better async ergonomics
  - Weekly downloads: 235K (trending up)
- **Example:**

  ```typescript
  import { Entry } from '@napi-rs/keyring';
  const entry = new Entry('AIAgentConfig', 'anthropic-key');
  await entry.setPassword('sk-...');
  const pwd = await entry.getPassword();
  ```

#### **Candidate 3: `cross-keychain` (magarcia/cross-keychain)**

- **Status:** Newer (v1.1.0, October 2025)
- **API:** `SecretStore.set(service, key, value)`, `SecretStore.get(service, key)`
- **Platform Coverage:** macOS, Windows, Linux
- **Advantages:**
  - Fallback to CLI (`security`/`powershell`) when native modules fail
  - CLI interface included (useful for scripting)
  - No libsecret-dev requirement (tries native first, falls back to CLI)
- **Disadvantages:**
  - Newer, less battle-tested
  - Larger unpacked size (312KB)
  - Fallback CLI approach is slower
- **Weekly downloads:** ~1K (still ramping)

#### **Recommendation: `@napi-rs/keyring`**

**Choice:** `@napi-rs/keyring`  
**Rationale:**

- ✅ 100% keytar-compatible API (minimal migration risk)
- ✅ Modern NAPI architecture (no legacy libuv coupling)
- ✅ No libsecret-dev requirement on Linux (uses system libsecret dynamically)
- ✅ Smaller binary, better performance
- ✅ 235K weekly downloads (proven stability)
- ✅ Active maintenance (latest April 2026)

**Fallback:** `keytar` for maximum stability if @napi-rs/keyring encounters adoption friction.

---

## Architecture Options

### Option 1: Shallow Keychain (Registry Keys Only)

**Concept:** Store only the five providers' API keys in the system keychain; leave the registry file clean of credentials.

```
Registry: ~/.ai-agent-config/registry.json
  providers: [
    { id: "anthropic", name: "...", config: {} },  // NO apiKey
    { id: "openai", name: "...", config: {} }
  ]

Keychain:
  Service: "AIAgentConfig"
  Entry: "registry:anthropic" → "sk-ant-..."
  Entry: "registry:openai" → "sk-openai-..."

Materialization:
  1. Load registry (no credentials)
  2. Fetch from keychain for each provider
  3. Write config files (agents receive credentials)
```

**Pros:**

- Registry file is clean (shareable after redaction)
- Minimal code changes (decrypt at materialize time)
- Keychain acts as a simple key-value store

**Cons:**

- **High friction:** Every sync operation hits the keychain (latency + OS prompts)
- **MCP servers not covered** (only model providers benefited)
- **Agent-local credentials still in plaintext** (OpenCode `options.apiKey`, Pi `models.json`)
- **No credential rotation tracking**
- Does not address the 19 agents that write plaintext into their configs

**Verdict:** ❌ Insufficient. Doesn't solve the core problem: plaintext keys in agent configs.

---

### Option 2: Unified Keychain Service with Registry References ★ RECOMMENDED

**Concept:** All credentials (registry + agent-local) stored in keychain; registry and agent configs reference them by `service:account` tuple. Adapters decrypt on read, re-encrypt on write.

```
Registry: ~/.ai-agent-config/registry.json
  providers: [
    { 
      id: "anthropic",
      name: "Anthropic",
      config: {
        apiKey: "keychain://registry:anthropic"  // REFERENCE
      }
    }
  ]

Keychain:
  Service: "AIAgentConfig"
  Entry: "registry:anthropic" → "sk-ant-..."
  Entry: "agent:claude-code:anthropic" → "sk-ant-..."  // Shadow for agent-local override

Agent Config (Claude Code):
  "settings": {
    "env": {
      "ANTHROPIC_API_KEY": "keychain://agent:claude-code:anthropic"
    }
  }

Materialization:
  1. Load registry (all refs visible)
  2. For EACH provider → fetch from keychain
  3. Write to agent config:
     - Adapters that support env vars: ref + env var setup
     - Adapters that need plaintext: fetch + write plaintext (logged for user awareness)
     - Skip adapters that don't support credentials
```

**Implementation Approach:**

1. **Keychain Service Structure:**

   ```
   Service: "AIAgentConfig" (app-level namespace)
   Accounts (naming convention):
     - registry:${providerId}                    (canonical, synced from GUI)
     - agent:${agentId}:${providerId}           (agent-local override)
     - mcp:${serverName}                        (MCP env vars)
   ```

2. **Config File Reference Format:**

   ```
   "keychain://SERVICE:ACCOUNT"
   
   Examples:
     "keychain://registry:anthropic"
     "keychain://agent:claude-code:anthropic"
   ```

3. **Adapter Behavior:**
   - **Codex (env_key support):** Replace plaintext `apiKey` with reference; Codex reads `env_key` at runtime
   - **Claude Code, Pi, OpenCode (no env support):**
     - On read: Detect reference, fetch secret, cache in memory
     - On write: Fetch from keychain, write plaintext only if agent demands it
     - Dashboard shows: "Stored in keychain, writing plaintext to agent (rotation needed)"
   - **Continue, Zed, Roo, etc. (no credential support):** Untouched (MCP-only)

4. **Registry Mutation Protocol:**

   ```typescript
   async registerProvider(provider, models, agentIds) {
     const registry = await this.requireRegistry();
     
     // 1. Store secret in keychain
     const keyRef = `registry:${provider.id}`;
     if (provider.config.apiKey) {
       await keychain.setPassword("AIAgentConfig", keyRef, provider.config.apiKey);
     }
     
     // 2. Replace with reference in registry
     registry.providers.push({
       provider: {
         id: provider.id,
         config: {
           apiKey: `keychain://${keyRef}`,  // REFERENCE
           ...
         }
       },
       agentIds
     });
     
     // 3. Materialize to agents
     await this.syncAgents(agentIds);
   }
   ```

5. **Materialization with Decryption:**

   ```typescript
   async materializeAgent(agentId) {
     const registry = await this.requireRegistry();
     const config = await adapter.readConfig();
     
     // Resolve keychain references for this agent
     const resolvedProviders = config.modelProviders.map((p) => {
       if (typeof p.config.apiKey === 'string' && 
           p.config.apiKey.startsWith('keychain://')) {
         const [svc, acct] = p.config.apiKey.replace('keychain://', '').split(':');
         const secret = await keychain.getPassword(svc, acct);
         return { ...p, config: { ...p.config, apiKey: secret } };
       }
       return p;
     });
     
     // Write adapter-specific format
     await adapter.writeConfig({ ...config, modelProviders: resolvedProviders });
   }
   ```

6. **Backwards Compatibility (Plaintext Migration):**

   ```typescript
   // On first load, detect plaintext keys in registry
   if (registry.providers.some(p => p.config.apiKey && !p.config.apiKey.startsWith('keychain://'))) {
     // Trigger migration dialog:
     // "Move X API keys to system keychain? This is a one-time setup."
     for (const provider of registry.providers) {
       if (provider.config.apiKey) {
         await keychain.setPassword('AIAgentConfig', `registry:${provider.id}`, provider.config.apiKey);
         provider.config.apiKey = `keychain://registry:${provider.id}`;
       }
     }
     await saveRegistry(this.registryFilePath, registry);
   }
   ```

**Pros:**

- ✅ Central source of truth (keychain is the vault)
- ✅ Registry is reference-clean (shareable after redaction)
- ✅ Supports agent-local overrides (e.g., different keys per host)
- ✅ MCP servers can store their env vars in keychain too
- ✅ Seamless for env-var agents (Codex, Crush, Continue with future changes)
- ✅ Supports credential rotation via a single keychain update
- ✅ Clear audit trail: "This agent receives plaintext because its config format requires it"

**Cons:**

- ⚠️ Medium implementation complexity (keychain lookups in multiple hot paths)
- ⚠️ OS keychain must be unlocked (user-managed; PIN/passphrase on system unlock)
- ⚠️ Agents that need plaintext still leak it (but logged + visible in dashboard)
- ⚠️ Keychain unavailable → sync fails (must degrade gracefully)

**Verdict:** ✅ **Recommended.** Solves the core problem, future-proof for phase 2.

---

### Option 3: Hybrid Encryption + Keychain (Master Key)

**Concept:** Registry holds AES-256-GCM encrypted credentials; encryption key stored in OS keychain. Agent configs get env-var references only. Zero plaintext in any file.

```
Registry: ~/.ai-agent-config/registry.json
  providers: [
    {
      id: "anthropic",
      config: {
        apiKeyEncrypted: "aes256-gcm:IV:TAG:CIPHERTEXT",
        keyRef: "keychain://registry:encryption-key"  // Master key location
      }
    }
  ]

Keychain:
  Entry: "registry:encryption-key" → 32-byte AES key (random, stored per machine)

Agent Config:
  No credentials written; only env var references that point back to registry service
```

**Pros:**

- ✅ Strongest security: Zero plaintext anywhere on disk
- ✅ Registry is shareable without redaction (encrypted)
- ✅ All agents receive env-var references (none write plaintext)

**Cons:**

- ❌ High implementation complexity (AES encryption, key derivation, IV management)
- ❌ Crypto library required (libsodium, TweetNaCl, or crypto-js)
- ❌ Agent compatibility requires NEW adapter pattern (env refs + runtime fetch from registry service)
  - Current agents (Claude Code, Pi, OpenCode) don't support this
  - Would need a new "secrets service" daemon for agents to query
- ❌ Introduces operational complexity: master key rotation, backup/restore challenges
- ❌ Future team-sharing (Phase 2) would require KMS or key escrow (not in scope)

**Verdict:** ❌ **Too complex for Phase 1.** Defer to Phase 3 after team-sharing patterns stabilize.

---

## Recommended Implementation Plan: Option 2

### Phase 1 Scope

1. **Install keychain library:** `@napi-rs/keyring`
2. **Registry layer changes:**
   - Add `apiKey: "keychain://registry:${providerId}"` reference format detection
   - Implement `resolveKeychainReference()` function
   - Add backwards-compatible plaintext → keychain migration flow
3. **Adapter updates (5 adapters):**
   - **Codex:** Leave `env_key` as-is; at materialize time, fetch from keychain and set env var
   - **Claude Code, Pi, OpenCode:** Detect references, fetch at read/write boundaries, log plaintext materialize
   - No changes needed for 20+ other adapters (no credential support)
4. **GUI updates:**
   - Move "API Key" input in Provider setup to a "Store in Keychain" flow
   - Display: "✓ Stored in system keychain" instead of showing masked key
   - Add "Where are my keys?" view: for each provider, list all files holding plaintext copies
5. **CLI updates:**
   - `provider add` prompts for API key, stores in keychain automatically
   - `show-config` shows references only (no plaintext), with option `--reveal` (masked) and `--decrypt` (decrypt from keychain)
6. **Dashboard (gui-server):**
   - Hide API key by default (no keychain access in browser)
   - Show "Stored in system keychain" with "Copy reference" action (for admins)
   - Verification curl commands show masked keys as before
7. **Threat model update:**
   - Document: Registry is clean (references only); agent configs are agent-responsibility
   - Registry file can be committed to git (no secrets exposed)
   - Rotating a key is a keychain operation (affects all agents immediately)

### Exit Criteria

1. ✅ **New provider keys never plaintext in registry.json**
   - Existing keys optionally migrated via one-time flow
2. ✅ **Every plaintext location enumerated and visible**
   - Dashboard shows: "Claude Code receives plaintext (config format limitation)"
3. ✅ **Verification output redacted by default**
   - Curl commands show masked keys; reveal optional in dashboard
4. ✅ **Documented threat model**
   - Keychain security model + agent config plaintext awareness
5. ✅ **Registry shareable after redaction**
   - All plaintext stripped; references intact

---

## Security & Threat Model

### OS Keychain Trust & Access

| **Platform** | **Access Control** | **Unlock Behavior** | **Risk** |
| --- | --- | --- | --- |
| **macOS Keychain** | Per-keychain ACL; app must be signed | Unlocks with user session | Logged-in user = keychain accessible |
| **Windows Credential Manager** | Per-credential ACL; Windows Data Protection API (DPAPI) | Decrypts with user session key | Logged-in user = credentials accessible |
| **Linux libsecret** | D-Bus service (e.g., Gnome Keyring) | Unlocks per user session | Session manager controls lifetime |

### Threat Model

**In Scope (Mitigated by Phase 1):**

- ✅ Credential leak via file-system inspection (registry.json, agent configs)
- ✅ Accidental exposure in logs/curl output (masked by default)
- ✅ Registry sharing (git commits) no longer leak keys

**Out of Scope (Acknowledged):**

- ❌ Logged-in attacker with local shell access (can query unlocked keychain)
- ❌ Dump of OS keychain itself (requires OS-level breach)
- ❌ Memory inspection of running process (keys in memory during sync)
- ❌ Keychain database file theft (encrypted by OS, requires OS key)

**Mitigation Guidance:**

- Use OS login PIN/passphrase (enabled by default on modern OS)
- Rotate API keys periodically (keychain makes it seamless)
- Audit: Log every keychain access (OS-provided, not app-level)

### Implementation Risks & Mitigations

| **Risk** | **Mitigation** |
| --- | --- |
| Keychain unavailable (service crash, WSL, headless) | Graceful fallback: return `{ success: false, error: 'Keychain unavailable; cannot sync credentials' }` |
| Reference format collision | Use unique prefix `keychain://` (unlikely to appear in real keys) |
| Circular reference (reference → reference) | Validate on read; reject chains depth > 1 |
| Agent config requires plaintext | Dashboard warns: "Stored in keychain, but [Agent] requires plaintext file" + link to docs |
| Keychain not initialized (first run) | On first `registerProvider`, check keychain; if unavailable, prompt to re-add key manually |

---

## Implementation Roadmap

### Week 1–2: Foundation

- [ ] Add `@napi-rs/keyring` to `packages/core/package.json`
- [ ] Implement `KeychainService` class (get, set, delete, list operations)
- [ ] Add `resolveKeychainReference()` in `registry.ts`
- [ ] Write tests for keychain round-trip (mock OS keychain for CI)

### Week 3: Registry & Adapters

- [ ] Update `registerProvider()` to store in keychain
- [ ] Implement backwards-compatible plaintext migration
- [ ] Update **Codex** adapter: `env_key` setup + fetch-on-sync
- [ ] Update **Claude Code, Pi, OpenCode** adapters: reference detection + fetch boundaries

### Week 4: GUI & CLI

- [ ] Update provider setup flow: "Store in Keychain" automatic
- [ ] Add "Where are my keys?" view (dashboard)
- [ ] Update CLI `provider add`, `show-config` commands
- [ ] Update GUI server `getRegistryState()` to strip plaintext from response

### Week 5: Testing & Docs

- [ ] End-to-end test: register provider → keychain → materialize → agent config
- [ ] Test agent sync across all 5 adapters
- [ ] Document threat model and keychain behavior
- [ ] Update `productroadmap.md` with exit criteria attestation

---

## Dependency & Compatibility Analysis

### Node.js Version

- **Current:** Node 26.7.0 (project uses v26)
- **@napi-rs/keyring:** Supports Node ≥ 10 ✅
- **Engines in package.json:** Should update to `"node": ">=18"` (matches cross-keychain; safer than v10 for production)

### Platform Support

| **Platform** | **@napi-rs/keyring** | **Pre-built Binaries** | **Fallback** |
| --- | --- | --- | --- |
| **macOS (Intel, ARM)** | ✅ Yes | ✅ Yes (NAPI) | `security` CLI (manual) |
| **Windows (x64, ARM64)** | ✅ Yes | ✅ Yes | PowerShell `Add-Type` (manual) |
| **Linux (glibc, musl)** | ✅ Yes | ✅ Yes | CLI fallback (if libsecret missing) |

### CI/CD Considerations

- **GitHub Actions:** Pre-installed libsecret on Linux runners ✅
- **Native module builds:** NAPI handles cross-platform compilation
- **Test environment:** Mock keychain (in-memory store) for non-OS-specific tests

---

## Timeline & Effort Estimate

| **Phase** | **Effort** | **Duration** |
| --- | --- | --- |
| **Foundation** | 16 hours | Week 1–2 |
| **Integration** | 20 hours | Week 3 |
| **GUI/CLI** | 16 hours | Week 4 |
| **Testing & Docs** | 12 hours | Week 5 |
| **Contingency** | 10 hours | Floating |
| **Total** | ~74 hours | 5 weeks (one developer, 15 hrs/week) |

---

## Future Phases (Out of Scope)

### Phase 2: Credential Rotation & Team Sharing

- Implement rotation workflow: update key in keychain, propagate to all agents
- Registry versioning for team-shared registries (git-committed, encrypted)
- Per-agent override patterns (different keys on different machines)

### Phase 3: Secrets as a Service

- Standalone secrets daemon (respond to agent queries for decrypted values)
- Agents receive env-var references only (no plaintext files)
- KMS integration (AWS Secrets Manager, HashiCorp Vault) for cloud workflows

---

## Appendix: Keychain API Reference

### @napi-rs/keyring

```typescript
import { Entry } from '@napi-rs/keyring';

// Get a secret
const entry = new Entry('AIAgentConfig', 'registry:anthropic');
const secret = await entry.getPassword(); // => "sk-ant-..."

// Set a secret
const entry2 = new Entry('AIAgentConfig', 'registry:openai');
await entry2.setPassword('sk-openai-...');

// Delete a secret
await entry2.deletePassword();

// List entries (not available; iterate manually)
// (Platform-specific limitations: no bulk list without OS APIs)

// Error handling
try {
  const pwd = await entry.getPassword();
} catch (e) {
  if (e.code === 'NO_ENTRY_FOUND') {
    // Secret not in keychain
  } else if (e.code === 'KEYCHAIN_UNAVAILABLE') {
    // Keychain service not running or accessible
  }
}
```

### Entry Lifecycle

```typescript
const entry = new Entry(service, account);
// Service: string (app namespace, max 255 chars)
// Account: string (key identifier, max 255 chars)

// CRUD operations
await entry.getPassword() // → string | throws
await entry.setPassword(password) // → void | throws
await entry.deletePassword() // → void | throws

// Platform-specific behavior
// macOS: ~/.lldb/Keychain Items / Keychain.app
// Windows: Credential Manager → Stored User Passwords
// Linux: ~/.local/share/keyring/* (Gnome Keyring) or systemd --user
```

---

## Conclusion

**Recommended Decision:** Implement **Option 2: Unified Keychain Service with Registry References**.

This approach:

1. **Solves the immediate problem** (plaintext credentials in registry)
2. **Maintains backwards compatibility** (existing agents work unchanged)
3. **Scales to future phases** (foundation for team-sharing, rotation, KMS integration)
4. **Balances security & usability** (OS keychain is familiar to users; no new infrastructure)

The 5-week timeline is achievable with one developer, and the implementation aligns with the project's existing architecture (adapters, materialization layer, GUI/CLI surfaces).

---

**Document prepared for:** Lead technical decision  
**Status:** Ready for review and approval  
**Next step:** Lead review → Phase 1 implementation kickoff
