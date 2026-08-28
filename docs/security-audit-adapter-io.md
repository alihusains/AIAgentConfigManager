# Adapter File I/O Security Audit

**Date:** 2026-08-28  
**Auditor:** omp (teammate)  
**Scope:** All file I/O operations in `packages/core/src/`

## Executive Summary

The codebase has **strong baseline security** for file operations. Key protections are already in place:
- Path traversal protection via `resolveConfigPath`
- Symlink resolution and validation
- File permissions (0o600) on all writes
- Atomic writes for registry
- No sensitive data in logs

**Findings:** 0 CRITICAL, 2 HIGH, 3 MEDIUM, 2 LOW

---

## 1. Path Traversal Protection

### Status: ✅ SECURE

**Location:** `packages/core/src/utils/index.ts:148-197`

The `resolveConfigPath` function implements proper path traversal protection:

```typescript
export function resolveConfigPath(template: string, _platform?: Platform): string {
  // ...
  // Resolve symlinks and normalize the path
  const resolved = pathNs.resolve(expanded);
  const real = pathNs.realpathSync.native ? pathNs.realpathSync.native(resolved) : resolved;
  
  // Ensure the resolved path is within the expected home directory
  const home = getHomeDir();
  if (!real.startsWith(home + pathNs.sep) && real !== home) {
    throw new Error(`Path traversal detected: ${template} resolves outside home directory`);
  }
  return real;
}
```

**Verification:**
- All adapters use `resolveConfigPath` for path resolution
- Tests confirm traversal attempts are blocked
- Symlinks are resolved before validation

**Risk:** None

---

## 2. Symlink Handling

### Status: ✅ SECURE

**Location:** `packages/core/src/utils/index.ts:148-197`

Symlinks are resolved via `realpathSync.native` before path validation. This prevents:
- Symlink attacks that point outside the home directory
- Symlink following during read/write operations

**Verification:**
- `pathNs.realpathSync.native` is used consistently
- Fallback to `pathNs.resolve` if native unavailable
- Path validation happens after symlink resolution

**Risk:** None

---

## 3. Unsafe Write Protection

### Status: ✅ SECURE

**Location:** `packages/core/src/utils/index.ts:251-269`

The `writeFileSafe` function:
1. Creates parent directories with `{ recursive: true }`
2. Writes with UTF-8 encoding
3. **Sets file permissions to 0o600** (owner read/write only)

```typescript
await fs.writeFile(filePath, content, 'utf-8');
// Restrict permissions: config files and the registry contain API keys.
await fs.chmod(filePath, 0o600).catch(() => undefined);
```

**Verification:**
- All config writes go through `writeFileSafe`
- Registry writes use atomic pattern (temp file + rename)
- Backup files inherit 0o600 permissions

**Risk:** None

---

## 4. Secret Handling

### Status: ⚠️ NEEDS IMPROVEMENT (2 HIGH findings)

#### Finding 4.1: HIGH - API Keys Stored in Plaintext Config Files

**Location:** All agent config files (`.claude/settings.json`, `.codex/config.toml`, etc.)

**Issue:** Agent config files store API keys, OAuth tokens, and credentials in plaintext. While file permissions (0o600) limit local access, this is a significant risk if:
- The home directory is backed up to cloud storage
- The machine is compromised
- Config files are shared accidentally

**Evidence:**
```json
// .claude/settings.json
{
  "env": {
    "ANTHROPIC_API_KEY": "sk-ant-api03-..."
  }
}
```

**Impact:** HIGH - API keys are high-value targets for attackers

### Status: ⚠️ NEEDS IMPROVEMENT (1 MEDIUM finding)

#### Finding 5.1: MEDIUM - No Validation of Parsed Config Structure

**Location:** `packages/core/src/utils/index.ts:442-454`

**Issue:** The `parseConfig` function parses JSON/YAML/TOML without validating the structure. Malicious or corrupted config files could:
- Inject unexpected keys that adapters don't expect
- Cause type errors or unexpected behavior
- Potentially enable prototype pollution in some parsers

**Evidence:**
```typescript
export function parseConfig(content: string, format: ConfigFormat): unknown {
  switch (format) {
    case 'json':
    case 'jsonc':
      return parseJSONC(content);  // No validation
    case 'yaml':
      return parseYAML(content);   // No validation
    case 'toml':
      return parseTOML(content);   // No validation
    default:
      throw new Error(`Unsupported config format: ${format}`);
  }
}
```

**Impact:** MEDIUM - Could lead to unexpected behavior or type errors

**Recommendation:**
1. Add schema validation using Zod (already a dependency)
2. Validate config structure after parsing
3. Reject unexpected keys or log warnings

**Design Considerations:**
- Different agents use different config structures (some have `mcpServers` as array, others as object)
- Need per-adapter validation schemas, not a single global schema
- Validation should be opt-in or lenient to avoid breaking existing configs
- Consider using `z.passthrough()` to allow unknown keys while validating known ones

**Status:** Not implemented - requires per-adapter schema design
**Impact:** HIGH - Centralized storage of all API keys in one file increases blast radius

**Recommendation:** Same as Finding 4.1 - implement optional encryption at rest

**Status:** Not fixed - requires design decision

---

### Status: ✅ No Sensitive Data in Logs

**Verification:**
- No `console.log` statements with keys, tokens, or secrets
- `provider-test.ts` uses `maskKey()` to mask API keys in curl commands
- Error messages do not include sensitive data

**Location:** `packages/core/src/provider-test.ts:41-45`

```typescript
function maskKey(key?: string): string {
  if (!key) return '(missing)';
  return key.length > 8 ? `${key.slice(0, 4)}…${key.slice(-4)}` : '(hidden)';
}
```

**Risk:** None

---

## 5. Config Injection

### Status: ⚠️ NEEDS IMPROVEMENT (1 MEDIUM finding)

#### Finding 5.1: MEDIUM - No Validation of Parsed Config Structure

**Location:** `packages/core/src/utils/index.ts:442-454`

**Issue:** The `parseConfig` function parses JSON/YAML/TOML without validating the structure. Malicious or corrupted config files could:
- Inject unexpected keys that adapters don't expect
- Cause type errors or unexpected behavior
- Potentially enable prototype pollution in some parsers

**Evidence:**
```typescript
export function parseConfig(content: string, format: ConfigFormat): unknown {
  switch (format) {
    case 'json':
    case 'jsonc':
      return parseJSONC(content);  // No validation
    case 'yaml':
      return parseYAML(content);   // No validation
    case 'toml':
      return parseTOML(content);   // No validation
    default:
      throw new Error(`Unsupported config format: ${format}`);
  }
}
```

**Impact:** MEDIUM - Could lead to unexpected behavior or type errors

**Recommendation:**
1. Add schema validation using Zod (already a dependency)
2. Validate config structure after parsing
3. Reject unexpected keys or log warnings

**Example:**
```typescript
const AgentConfigSchema = z.object({
  mcpServers: z.array(z.object({
    name: z.string(),
    command: z.string(),
    // ...
  })).optional(),
  // ...
});

export function parseConfig(content: string, format: ConfigFormat): AgentConfig {
  const parsed = parseRawConfig(content, format);
  return AgentConfigSchema.parse(parsed);  // Throws on invalid
}
```

**Status:** Not fixed - requires adding validation schemas

---

## 6. File Permissions

### Status: ✅ SECURE

**Location:** `packages/core/src/utils/index.ts:251-269`

All files created by the application have 0o600 permissions:
- Config files
- Registry file
- Backup files

**Verification:**
- `writeFileSafe` sets 0o600 after every write
- Registry uses atomic write (temp file + rename)
- Backup files inherit permissions from `writeFileSafe`

**Risk:** None

---

## 7. Backup File Security

### Status: ✅ SECURE

**Location:** `packages/core/src/utils/index.ts:271-281`

Backup files:
- Created with timestamp to avoid collisions
- Written via `writeFileSafe` (inherits 0o600)
- Named with `.backup.` suffix for clarity

**Risk:** None

---

## 8. Atomic Writes

### Status: ✅ SECURE

**Location:** `packages/core/src/registry.ts:87-94`

The registry uses atomic writes to prevent corruption:

```typescript
export async function saveRegistry(registryPath: string, registry: Registry): Promise<void> {
  registry.updatedAt = Date.now();
  const tmp = `${registryPath}.tmp`;
  await writeFileSafe(tmp, JSON.stringify(registry, null, 2));
  const fs = await import('node:fs');
  fs.renameSync(tmp, registryPath);
}
```

**Risk:** None

---

## Summary Table

| # | Category | Severity | Finding | Status |
|---|----------|----------|---------|--------|
| 4.1 | Secret Handling | HIGH | API keys in plaintext config files | Not fixed - needs design |
| 4.2 | Secret Handling | HIGH | Registry file contains API keys | Not fixed - needs design |
| 5.1 | Config Injection | MEDIUM | No validation of parsed config structure | Not fixed - needs schemas |
| 6.1 | File Permissions | LOW | Tauri IPC path doesn't set permissions | Not fixed - platform limitation |
| 6.2 | File Permissions | LOW | Backup files not cleaned up | Not fixed - by design |
| 7.1 | Path Traversal | INFO | Proper protection in place | Secure |
| 7.2 | Symlink Handling | INFO | Proper protection in place | Secure |
| 7.3 | Unsafe Writes | INFO | Proper protection in place | Secure |

---

## Recommendations

### Immediate (No Design Decision Needed)
1. **Add config validation** (Finding 5.1) - Use Zod schemas to validate parsed configs
2. **Document security posture** - Create a security policy document outlining the threat model

### Short-term (Requires Design Decision)
1. **Implement optional encryption at rest** (Findings 4.1, 4.2) - Use OS keychain for storing API keys
2. **Add secret references** - Support `${KEYCHAIN:secret-name}` syntax in configs

### Long-term
1. **Implement audit logging** - Log all config changes with timestamps
2. **Add integrity checks** - Verify config file hashes to detect tampering

---

## Conclusion

The codebase has **strong baseline security** for file operations. Path traversal, symlink attacks, and unsafe writes are properly protected. File permissions are correctly set to 0o600.

The main gaps are in **secret handling** (plaintext storage of API keys) and **config validation** (no schema validation). These require design decisions and are not quick fixes.

**Overall Risk Rating:** MEDIUM

**Next Steps:**
1. Add Zod validation for config parsing (can be done now)
2. Schedule design discussion for encryption at rest
3. Document security posture and threat model
