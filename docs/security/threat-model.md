# AgentControl Security Threat Model

**Phase 1 (Secrets)** — Redaction, keychain storage, and materialization hardening.

---

## Executive Summary

AgentControl manages API keys, authentication tokens, and other secrets across multiple AI agents on a single developer machine. This document outlines the security threats we address in Phase 1 and our mitigation strategy.

**Key principle:** Secrets are stored in the OS keychain by default. The registry stores references only — never plaintext keys. CLI/GUI output masks keys to prevent accidental leakage during screenshots or log sharing.

---

## Threat Categories

### 1. SSRF & Network-Level Key Exposure

**Threat:** Plaintext API keys visible in CLI output (curl commands, JSON responses) could be intercepted by network monitoring, logged by proxies, or captured in shell history.

**Mitigation:**
- **Verification curl commands:** Masked in all output (`curl -H 'Authorization: Bearer sk-a3…9z12'`)
- **Shell history:** Keys never appear in command-line arguments; always passed via environment variables or stdin
- **Logs:** CLI output uses masked keys in debug/trace output

**Evidence:** OWASP A01:2021 – Broken Access Control, OWASP A02:2021 – Cryptographic Failures

---

### 2. Configuration Injection & Plaintext Registry Leakage

**Threat:** Malicious actors with shell access could read `registry.json` and steal plaintext keys if the migration to keychain is incomplete.

**Mitigation:**
- **Default keychain storage:** New providers are stored in the OS keychain immediately on creation
- **Mandatory migration:** Existing plaintext keys have a clear UI/CLI path to migrate to keychain
- **File permissions:** Registry file is created with user-only permissions (0600 on Unix)
- **Registry blanking:** After keychain migration, `config.apiKey` is set to empty string; only `keychainSecretRef` exists

**Implementation:**
```typescript
// After storing key in keychain:
provider.config.apiKey = '';  // Blank the plaintext
provider.keychainSecretRef = 'provider:openai-gpt4';  // Store reference only
```

---

### 3. GUI Server Authentication & Localhost Binding

**Threat:** An unauthenticated HTTP server on `localhost:5900` could allow other processes on the same machine to call API endpoints and extract keys.

**Mitigation:**
- **Localhost-only binding:** GUI server listens on `127.0.0.1:5900` (not `0.0.0.0`)
- **Per-launch token auth:** Each server launch generates a unique token; CLI/GUI must present it
- **Short-lived session tokens:** Token is valid only for the duration of the server process
- **CORS disabled:** No cross-origin requests allowed

**Implementation:**
```typescript
// gui-server.ts
const token = crypto.randomUUID();
server.listen(5900, '127.0.0.1');  // Localhost only
// All /api/* requests require ?token=<uuid>
```

---

### 4. Provider Config Exposure in Agent Configs

**Threat:** When materializing provider definitions to agent config files (e.g., Claude's `settings.json`), plaintext keys could end up in user-readable agent configs.

**Mitigation:**
- **Materialization via references:** Agent configs reference providers by ID, not inline
- **Env-var injection:** Keys are injected at agent runtime via environment variables set by the registry manager
- **Adapter-specific fallback:** Some adapters require plaintext (historical constraint); these are explicitly documented with WARNING badges

**Flow:**
```
Keychain: "sk-real-key-12345"
  ↓
Registry entry: { keychainSecretRef: "provider:openai", config: { apiKey: "" } }
  ↓
Agent config: { "providers": { "openai": { "ref": "provider:openai" } } }
  ↓
Runtime: Agent receives OPENAI_API_KEY=sk-real-key-12345 via env (never written to disk)
```

---

### 5. Keychain Access Control & OS-Level Security

**Threat:** Compromised parent process or malware could read the OS keychain by impersonating the user.

**Mitigation:**
- **OS keychain integration:** macOS Keychain, Windows Credential Manager, or Linux Secret Service
- **User prompt:** Most OSes prompt the user when an app reads the keychain for the first time
- **Process isolation:** Keys are never copied to child processes (e.g., spawned agent CLIs); instead, env vars are set

**Limitations:**
- If an attacker has shell access (`sudo su user`), they can read the keychain (this is OS-level and out of scope)
- Keychain must be unlocked for AgentControl to work; we cannot protect an unlocked keychain from a compromised process

---

### 6. Secrets in Logs & Error Messages

**Threat:** Verbose logging or error stack traces could leak keys.

**Mitigation:**
- **Redaction in logs:** All debug/error output uses `maskKey()` utility
- **No stack traces in user output:** Internal errors are logged; users see sanitized messages
- **Verification curl masking:** Network test output masks keys before display

**Exit Criteria:**
- `grep -r "sk-[a-zA-Z0-9_-]" src/` should find zero real keys in code/tests
- All user-facing error messages use `maskKey(value)`

---

## Key Materialization Flow

### New Provider (Recommended Path)

```
User creates provider in GUI → Chooses "Store in OS keychain" (default)
  ↓
Registry stores: {
  provider: { id: "openai", config: { baseUrl: "https://...", apiKey: "" } },
  keychainSecretRef: "provider:openai"
}
  ↓
Key is stored in OS keychain under "provider:openai"
  ↓
Agent materialization calls resolveProviderApiKey() → retrieves from keychain
  ↓
Agent env is populated: OPENAI_API_KEY=sk-real-key-abc123
```

### Plaintext Path (Unavoidable Legacy Cases)

Some adapters require plaintext (e.g., `~/.opencode/opencode.json`). These providers:
1. Display a WARNING badge in the UI
2. Are documented in docs/security/adapters.md
3. Receive a clear migration path to keychain (if the adapter supports it)

---

## Verification & Testing

### Security Test Cases

1. **T1: Masked key in curl output**
   - Run `POST /api/providers/verify` with a test key
   - Confirm curl command shows masked key, not real key
   - ✓ Pass: `curl -H 'Authorization: Bearer sk-***…key'`

2. **T2: GUI reveal toggle**
   - Open API Configuration tab
   - Confirm key is masked by default
   - Click eye icon → key is revealed
   - Click eye icon → key is masked again
   - ✓ Pass: Reveal is explicit and reversible

3. **T3: Registry reference-only**
   - Add provider with keychain storage
   - Check registry.json: `config.apiKey` must be `""`
   - ✓ Pass: Only `keychainSecretRef` is set

4. **T4: Keychain fallback**
   - Simulate keychain unavailable (KEYCHAIN_DEBUG=unavailable)
   - Create plaintext provider
   - Confirm UI explains the fallback with WARNING
   - ✓ Pass: User is informed of the fallback

5. **T5: No keys in CLI output**
   - Run `agm list-agents`
   - Inspect stderr/stdout and shell history
   - ✓ Pass: No real keys appear anywhere

### Audit Checklist

- [ ] `maskKey()` is used in all curl outputs (provider-test.ts)
- [ ] `maskKey()` is used in all error messages (gui-server.ts, index.ts)
- [ ] GUI key field is masked by default, reveal action is explicit
- [ ] Registry key migration shows keychainSecretRef, blanks apiKey
- [ ] No `process.env.OPENAI_API_KEY=…` in shell commands (use passenv only)
- [ ] GUI server token auth is enforced on all /api/* routes
- [ ] GUI server listens on 127.0.0.1 only, never 0.0.0.0
- [ ] Tests cover masked output scenarios

---

## Known Limitations & Out of Scope

### Out of Scope (OS-Level, Not Our Responsibility)

- **Keychain compromise:** If an attacker has shell access (`sudo su user`) or malware runs as the user, the OS keychain is readable
- **Memory disclosure:** If a process is suspended and memory is dumped, decrypted keys in memory are readable
- **Keyboard sniffing:** Hardware keyloggers capture typed keys
- **Screenshot/screen recording:** Visual screen capture always shows what's on screen, even if masked

### Explicitly Out of Scope

- **Per-agent key scoping:** We store one key per provider, shared across agents. To prevent key leakage if one agent is compromised, use separate API keys per agent (configure them as separate providers)
- **Key rotation automation:** Phase 2 feature (Task #4)
- **Encrypted registry backup:** Future enhancement

---

## Implementation Checklist (Phase 1 Deliverables)

### Code Changes

- [x] Create `maskKey()` utility in packages/core/src/utils/redact.ts
- [x] Update provider-test.ts to use maskKey() in curl commands
- [x] Update GUI ProviderDetailView to mask API key by default + reveal toggle
- [x] Update CLI output to mask keys (grep all apiKey references)
- [x] Ensure registry stores reference-only (empty config.apiKey + keychainSecretRef)
- [x] GUI server: enforce token auth on /api/* routes
- [x] GUI server: bind to 127.0.0.1:5900 only

### Documentation

- [x] This threat model document
- [x] docs/security/adapters.md (which adapters require plaintext)
- [x] docs/security/migration-guide.md (how to migrate from plaintext to keychain)

### Tests

- [x] Verify masked key in curl output (smoke test)
- [x] Verify GUI reveal toggle works
- [x] Verify registry.json shows reference-only after keychain migration
- [x] No real keys in CLI output tables

### Deployment

- [ ] pnpm build passes
- [ ] All smoke tests pass
- [ ] Security review by team lead

---

## Future Work (Phase 2+)

- **Task #4:** Key rotation helper (show which providers use which keys, rotate via API)
- **Encrypted backup:** Export registry with encrypted keys
- **Per-agent API key:** Separate key per agent → per-agent compromise isolation
- **Audit log:** Log all key access (read-only, show when and what accessed the key)

---

## References

- [OWASP A01:2021 – Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [OWASP A02:2021 – Cryptographic Failures](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)
- [OWASP A05:2021 – Broken Access Control → Secrets in Logs](https://owasp.org/www-project-log4shell/)
- [CWE-798: Use of Hard-Coded Credentials](https://cwe.mitre.org/data/definitions/798.html)
- [CWE-200: Exposure of Sensitive Information to an Unauthorized Actor](https://cwe.mitre.org/data/definitions/200.html)
- [macOS Keychain Security Architecture](https://developer.apple.com/library/archive/documentation/Security/Conceptual/keychainServConcepts/01introduction/introduction.html)
- [Windows Credential Manager API](https://docs.microsoft.com/en-us/windows/win32/api/wincred/)
- [Secret Service (freedesktop.org)](https://specifications.freedesktop.org/secret-service/)

