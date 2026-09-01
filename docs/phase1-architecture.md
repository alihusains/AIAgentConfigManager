# Phase 1 Secrets — Architecture

**Goal:** API keys stored in OS keychain, never plaintext in registry or agent configs.

---

## Design Principles

1. **Keychain as the single source of truth** — secrets live in the OS keychain (macOS Keychain, Windows Credential Manager, Linux libsecret via @napi-rs/keyring)
2. **Registry stores references only** — `registry.json` holds `keychainSecretRef: "provider:openai-main"`, not the actual key
3. **Materialization resolves on write** — when agents are written, `resolveProviderApiKey()` fetches the real key from keychain
4. **Graceful degradation** — when keychain unavailable (CI, headless), materialization proceeds safely (returns null, logs warning)
5. **Masking by default** — keys displayed as `sk-…last4chars` in all output; explicit reveal action required

---

## Flow Diagrams

### 1. Provider Creation → Keychain Storage

```
User adds provider "openai-gpt4" with key "sk-real-key-12345"
    ↓
POST /api/provider/add
    ↓
Manager.addProvider()
    ↓
keychain.setSecret("provider:openai-gpt4", "sk-real-key-12345")
    ↓
OS Keychain Store
    ↓
Registry writes:
  {
    "id": "openai-gpt4",
    "type": "openai",
    "keychainSecretRef": "provider:openai-gpt4",
    "config": { "apiKey": "", "baseUrl": "https://api.openai.com/v1" }
  }
    ↓
registry.json saved (NO plaintext key)
```

### 2. Agent Materialization → Keychain Resolution

```
Materialize provider to Claude Code
    ↓
computeMaterializedState() [now async]
    ↓
FOR each provider in registry:
  - resolveProviderApiKey(provider)
      ↓
      IF keychainSecretRef exists:
        - keychain.getSecret("provider:openai-gpt4")
        - Returns: "sk-real-key-12345" (or null if unavailable)
      ELSE:
        - Use config.apiKey (backward compat for plaintext providers)
    ↓
Materialize to agent config:
  Claude: ~/.claude/profile.json gets the real key
  OpenCode: ~/.config/opencode/opencode.jsonc gets env-var reference $PROVIDER_KEY_openai-gpt4
    ↓
Agent can now authenticate with API
```

### 3. Keychain Unavailable → Graceful Fallback

```
Keychain unavailable (CI, headless, locked)
    ↓
resolveProviderApiKey() calls keychain.getSecret()
    ↓
@napi-rs/keyring throws error
    ↓
isKeychainAvailable() returns false
    ↓
resolveProviderApiKey() returns null
    ↓
Materialization uses empty string OR warns user
    ↓
No crash; agent config written (without key or with warning)
    ↓
Next time keychain is available, re-materialize
```

### 4. Key Display → Redaction

```
User clicks "Show API key" in ProviderDetailView
    ↓
[Reveal Button]
    ↓
state.revealed = true
    ↓
Display options:
  - Masked: maskKey("sk-real-key-12345") → "sk-…5"
  - Revealed: "sk-real-key-12345"
    ↓
Copy button copies actual key (never masked in clipboard)
```

---

## File Structure

### Core (Keychain & Registry)

```
packages/core/src/
├── keychain.ts               # OS keychain wrapper
│   ├── isKeychainAvailable()
│   ├── setSecret()
│   ├── getSecret()
│   ├── deleteSecret()
│   └── KeychainError (typed failures)
├── registry.ts              # Registry with keychain integration
│   ├── addProvider()        # calls keychain.setSecret()
│   ├── materializeAgent()   # async, calls resolveProviderApiKey()
│   ├── resolveProviderApiKey() # keychain.getSecret() + fallback
│   └── computeMaterializedState() # async materialization
└── registry-materialization.test.ts # roundtrip tests
    ├── Full keychain roundtrip
    ├── Missing keychain entry (graceful)
    ├── Unavailable keychain (graceful)
    └── Multiple keychain-backed providers
```

### GUI (Masking & Display)

```
packages/gui/src/
├── utils.ts                 # Masking utilities
│   ├── maskKey()
│   ├── maskKeyWithPrefix()
│   └── looksLikeSecret()
├── components/
│   └── ProviderDetailView.tsx
│       └── ApiConfigTab
│           ├── Shows masked key by default
│           ├── Reveal button toggles full display
│           └── Copy button works in both states
└── smoke.test.tsx           # Updated regex for masked keys
    └── /sk-…\w{4}/ format tests
```

### Documentation

```
docs/
├── security/
│   └── threat-model.md      # Comprehensive threat model
│       ├── SSRF mitigation
│       ├── Config injection prevention
│       ├── GUI server auth
│       ├── Materialization strategy
│       └── OWASP alignment
└── phase1-architecture.md   # This file
```

---

## Type Changes

### Provider Type (Before & After)

```typescript
// BEFORE
interface Provider {
  id: string;
  config: {
    apiKey: string;  // ← plaintext in registry.json
    baseUrl: string;
  };
}

// AFTER
interface Provider {
  id: string;
  keychainSecretRef?: string;  // ← "provider:openai-main"
  config: {
    apiKey: string;  // ← EMPTY STRING in registry.json when keychainSecretRef set
    baseUrl: string;
  };
}

// At retrieval time:
interface ResolvedProvider extends Provider {
  resolvedApiKey?: string;  // ← Real key from keychain, never persisted
}
```

---

## Adapter Compatibility

### Adapters Supporting Env-Var References (T2 in progress)

Will be determined by T2. Examples (anticipated):
- **Claude Code** — supports env-vars in profile
- **Cursor** — supports env-vars in config
- **OpenCode** — supports env-vars
- **Windsurf** — likely supports env-vars
- **OMP** — may require plaintext (known limitation)

### Materialization Strategy per Adapter

```typescript
interface AdapterMaterializationPolicy {
  supportsEnvVars: boolean;  // Can we write $PROVIDER_KEY_ID?
  plaintext_fallback: boolean; // If no env-var, write key anyway?
  warn_on_plaintext: boolean; // Show warning badge in UI?
}

// Example:
// Claude Code: supportsEnvVars=true, plaintext_fallback=false, warn=false
// OMP: supportsEnvVars=false, plaintext_fallback=true, warn=true
```

---

## Testing Strategy

### Unit Tests (Keychain)

✅ Already passing in `keychain.test.ts`:
- `isKeychainAvailable()` success path
- `isKeychainAvailable()` failure path (graceful)
- `setSecret()` / `getSecret()` / `deleteSecret()`
- Error handling (no exceptions escape)

### Integration Tests (Registry + Keychain)

✅ Already passing in `registry-materialization.test.ts`:
- Full roundtrip: add provider → keychain → registry → materialize → agent
- Missing entry: graceful degradation
- Unavailable keychain: graceful degradation
- Multiple keychain-backed providers: independent resolution

### End-to-End Tests (T5 in progress)

🔄 Planned:
- Provider add → keychain → materialize to real agent → verify agent config
- Key masking in ProviderDetailView: masked by default, revealed on button click
- Threat model claims verified against code (CI/headless degradation actually works)
- Bundle size stays under 110 KB

---

## CI/Headless Behavior

When `@napi-rs/keyring` is unavailable (CI environment, no native binding):

1. **`isKeychainAvailable()` returns `false`** (non-destructive probe)
2. **`setSecret()` throws `KeychainError('unavailable')`** — caller handles
3. **`getSecret()` returns `null`** — treated as "no entry"
4. **Materialization proceeds anyway** — logs warning, uses empty or plaintext key

Result: CI builds don't crash, but keys aren't stored. On next run in a keychain-available environment, they re-materialize correctly.

---

## Security Considerations

### What This Phase Addresses

✅ Prevents plaintext keys in `registry.json`  
✅ Prevents plaintext keys in agent configs (where adapters support env-vars)  
✅ Keychain entries encrypted by OS (DPAPI on Windows, Keychain on macOS)  
✅ File permissions strict (0600 on Unix)  
✅ Verification output masked by default  

### What Remains (Phase 2+)

⚠️ Plaintext keys for adapters without env-var support (OMP, etc.) — flagged with WARNING badge  
⚠️ Drift detection — detecting if agent configs are edited outside the tool  
⚠️ Team sharing — credentials in git (Phase 2 will use env-var refs only)  

---

## Deployment Notes

### Breaking Changes

None. Existing plaintext providers in `registry.json` remain readable and functional (backward compatible). New providers are automatically keychain-backed.

### Migration Path (Future)

Users can manually migrate existing plaintext providers to keychain:
1. Add provider via UI (new one goes to keychain automatically)
2. Or: CLI command `agm provider migrate-to-keychain <id>` (future)

### Dependencies

- `@napi-rs/keyring@1.3.0` — already vendored, no new prod deps
- No new heavy bundle dependencies for GUI

---

## References

- **Security Audit:** `docs/audits/security-audit-adapter-io.md` (baseline + Phase 1 analysis)
- **Threat Model:** `docs/security/threat-model.md` (this phase's deliverable)
- **OWASP Findings:** Cited in threat model (SSRF, config injection, credential exposure)
- **Keychain Module:** `packages/core/src/keychain.ts` (typed facade with error handling)
