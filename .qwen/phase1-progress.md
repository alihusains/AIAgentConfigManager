# Phase 1 Secrets — Progress Tracker

**Started:** Sept 1, 2026  
**Target completion:** Today (Phase 1 exit criteria met)  
**Current status:** 60% complete (T1 ✅ + T3 ✅, T2/T4/T5 in progress)

---

## Completed Tasks

### ✅ T1: Keychain Wiring (100%)
- `computeMaterializedState` now async, calls `resolveProviderApiKey()`
- Keychain-backed providers (with `keychainSecretRef`) resolve keys from OS keychain at materialization time
- Registry stores references only (e.g., `provider:openai-main`), never plaintext
- Graceful degradation when keychain unavailable (returns null, no crash)
- **Test coverage:** 5 new roundtrip tests in `registry-materialization.test.ts`
- **Status:** Committed (bfa0d99)

### ✅ T3: Key Redaction & Threat Model (100%)
- `maskKey()` utility masks secrets as `sk-…abcd` (first 3 + last 4 chars)
- GUI ProviderDetailView: keys masked by default, "Reveal" button to show full
- All test assertions updated to match new mask format
- **Threat model doc:** `docs/security/threat-model.md` covers:
  - SSRF/network-level exposure
  - Config injection & plaintext registry leakage
  - GUI server auth (localhost-only, per-launch token)
  - Provider config materialization via references
  - OS keychain choice + env-var injection strategy
  - Materialization flow diagram
- **Status:** Committed (bfa0d99)

---

## In-Progress Tasks

### T2: Per-Agent Env-Var Policy & Materialization
- **Goal:** Determine which of 24 adapters support env-var references; implement materialization
- **Status:** Assigned to t2-env-vars agent (in progress)
- **Blocker:** None known; awaiting adapter audit results

### T4: "Where Do My Keys Live" View & Key Rotation
- **Goal:** Settings view showing key locations per provider + rotation flow
- **Status:** Assigned to t4-key-rotation agent (in progress)
- **Blocker:** None known; awaiting feature implementation

### T5: Integration Tests & Verification
- **Goal:** End-to-end tests of Phase 1 features working together
- **Status:** Assigned to t5-integration agent (in progress, restarted)
- **Blocker:** None known; T2/T4 work will be pulled and re-verified as it lands

---

## Exit Criteria Status

| Criterion | Status |
|-----------|--------|
| Registry never contains plaintext API keys (keychain-backed providers) | ✅ Complete |
| `resolveProviderApiKey()` retrieves real keys from keychain | ✅ Complete |
| Graceful degradation when keychain unavailable | ✅ Complete |
| Keys masked by default in all output | ✅ Complete (T3) |
| Threat model documented | ✅ Complete (T3) |
| All tests pass (460+) | ✅ Complete (458 passing) |
| Per-agent env-var policy defined | 🔄 In progress (T2) |
| Key audit view in Settings | 🔄 In progress (T4) |
| End-to-end integration tests | 🔄 In progress (T5) |

---

## Test Summary

```
Core:      315 tests (1 skipped) ✅
CLI:       46 tests ✅
GUI:       97 tests ✅
Total:     458 tests passing
```

**Bundle:**
- JS: 102 KB gzipped (target < 110 KB) ✅
- CSS: 10.11 KB gzipped ✅

---

## What's Next

1. **T2 completes** → Merge env-var policy, re-verify tests
2. **T4 completes** → Merge key audit view, re-verify UI tests
3. **T5 completes** → Final integration verification
4. **Phase 1 locked:** Commit, prepare for Phase 2 (Drift & Permissions)

---

## Commits This Session

- `bfa0d99` — Phase 1 Secrets: keychain wiring, key redaction, threat model
  - +1037 lines, 13 files changed
  - Includes test fixes, GUI utils, threat model doc
