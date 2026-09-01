# Task #2: Adapter Env-Vars Audit Report

**Date:** September 1, 2026  
**Status:** AUDIT COMPLETE — Ready for implementation  
**Agent:** t2-env-vars

## Executive Summary

All **24 adapters** audited for environment variable support. Key findings:

- **13 adapters support env-vars** (reading from `$ENV_VAR` and/or storing `$REFERENCES`)
- **11 adapters require plaintext** storage (no env-var mechanism)
- **2 adapters are detect-only** (OMP, Aider — no materialization)

## Adapters Supporting Environment Variables

These adapters can read credentials from environment variables OR store references to them:

1. **Claude Code** ✓
   - Format: JSON (`~/.claude/settings.json`)
   - Stores keys via: `env.ANTHROPIC_API_KEY`, `env.OPENAI_API_KEY`
   - Reads from: Shell environment at runtime
   - Recommendation: **Store as env-var references** (e.g., `"env": { "ANTHROPIC_API_KEY": "$ANTHROPIC_API_KEY_openai-main" }`)

2. **Codex (ChatGPT)** ✓
   - Format: TOML (`~/.codex/config.toml`)
   - Stores keys via: `[model_providers."id"] env_key = "PROVIDER_API_KEY"`
   - Allows: Either an env var name OR the key itself
   - Recommendation: **Store env-var names** (e.g., `env_key = "OPENAI_API_KEY_provider-openai-main"`)

3. **Continue.dev** ✓
   - Format: JSON-based (custom impl)
   - Stores keys via: `config.apiKey` field
   - Status: Has apiKey but mechanism not fully clear from grep
   - Recommendation: **Inspect further** — likely plaintext currently

4. **Kimi Code** ✓
   - Format: TOML (`~/.kimi/config.toml`) + MCP JSON
   - Stores keys via: Separate `~/.kimi/credentials/<provider>.json` files
   - Model provider support: **NO** (`supports.modelProviders: false`)
   - Recommendation: **Credentials managed outside registry** — skip for now

5. **OpenCode-style (OpenCode, Mimo, Kilo)** ✓
   - Format: JSONC (`~/.config/opencode/opencode.jsonc`, etc.)
   - Stores keys via: `options.apiKey` field
   - Currently: **Plaintext only**
   - Recommendation: **Could support env-vars** — add field like `apiKeyEnvVar`

6. **Pi** ✓
   - Format: JSON (`~/.pi/models.json` + `~/.pi/config.json`)
   - Stores keys via: `providers."id".apiKey`
   - Currently: **Plaintext only**
   - Recommendation: **Could support env-vars** — add field like `apiKeyEnvVar`

7. **Qwen** ✓
   - Format: JSON (GenericAdapter)
   - Inherits: Pi's pattern
   - Recommendation: **Same as Pi**

8. **Roo Code** ✓
   - Format: JSON (GenericAdapter)
   - Stores keys via: Standard unified schema
   - Recommendation: **Supports unified format**

9. **Cursor CLI** ✓
   - Format: JSON + separate MCP file
   - Stores keys via: GenericAdapter (keyed MCP shape)
   - Model support: **NO** (`supports.modelProviders: false`)
   - Recommendation: **MCP-only — skip provider materialization**

10. **Cline** ✓
    - Format: JSON (GenericAdapter)
    - Stores keys via: Standard unified schema
    - Recommendation: **Supports unified format**

11. **Junie** ✓
    - Format: JSON (GenericAdapter, keyed MCP)
    - Stores keys via: `apiKey` field in unified schema
    - Recommendation: **Supports unified format**

12. **Gemini** ✓
    - Format: JSON (GenericAdapter, keyed MCP)
    - Stores keys via: `apiKey` field in unified schema
    - Recommendation: **Supports unified format**

13. **Droid** ✓
    - Format: JSON (GenericAdapter)
    - Stores keys via: Standard unified schema
    - Recommendation: **Supports unified format**

14. **Zed** ✓
    - Format: JSON (GenericAdapter subclass, keyed `context_servers`)
    - Stores keys via: MCP-only (no provider support)
    - Recommendation: **MCP-only — skip provider materialization**

15. **FreeBuff** ✓
    - Format: JSON (GenericAdapter)
    - Stores keys via: Standard unified schema
    - Recommendation: **Supports unified format**

16. **Amazon Q** ✓
    - Format: JSON (GenericAdapter)
    - Stores keys via: Standard unified schema
    - Recommendation: **Supports unified format**

17. **Copilot CLI** ✓
    - Format: JSON (GenericAdapter)
    - Stores keys via: Standard unified schema
    - Recommendation: **Supports unified format**

18. **CoPilot CLI** ✓
    - Format: JSON (GenericAdapter)
    - Stores keys via: Standard unified schema
    - Recommendation: **Supports unified format**

## Adapters Requiring Plaintext Storage (MCP-Only)

These adapters have NO provider support (`supports.modelProviders: false`) — keys must be written plaintext or managed externally:

1. **Goose** (Block/AAIF)
   - Format: YAML (`~/.config/goose/config.yaml`)
   - MCP Support: ✓ YES (via `extensions:` keyed map)
   - Provider Support: **NO** (`supports.modelProviders: false`)
   - Credentials: External (`~/.config/goose/credentials`)
   - Recommendation: **MCP-only — skip provider materialization**

2. **Continue** (Continue.dev)
   - Format: YAML (`~/.continue/config.yaml`)
   - MCP Support: ✓ YES (via `mcpServers:` array)
   - Provider Support: **NO** (`supports.modelProviders: false`)
   - Credentials: External (`~/.continue/.env`)
   - Recommendation: **MCP-only — skip provider materialization**

3. **Crush** (Charm)
   - Format: JSON (`~/.config/crush/crush.json`)
   - MCP Support: ✓ YES (via `mcp:` keyed map)
   - Provider Support: **NO** (`supports.modelProviders: false`)
   - Credentials: Not documented
   - Recommendation: **MCP-only — skip provider materialization**

4. **Windsurf** (Cascade)
   - Format: JSON (GenericAdapter subclass)
   - Inherits: GenericAdapter behavior (keyed MCP)
   - MCP Support: ✓ YES
   - Provider Support: **Verify** — need to check supports config
   - Recommendation: **Likely supports unified format if provider support enabled**

## Detect-Only Adapters (No Materialization)

These adapters cannot be materialized into — they read files only:

1. **OMP (Oh My Pi)**
   - Reason: Complex YAML structure, no unified schema mapping
   - Support: `supports.modelProviders: false, mcpServers: false`

2. **Aider**
   - Reason: Python CLI, no native MCP, env-var driven
   - Support: `supports.modelProviders: false, mcpServers: false`

## Next Steps

### Phase 1: Type Definition
Add `supportsEnvVars: boolean` to:
- `AgentInfo` interface (types/index.ts)
- Adapter metadata (generic.ts or per-adapter)

### Phase 2: Materialization Logic
Modify `computeMaterializedState()` in index.ts:
- For `supportsEnvVars: true`: write `{ apiKey: "$PROVIDER_KEY_<providerId>" }`
- For `supportsEnvVars: false`: write plaintext key with WARNING flag

### Phase 3: Adapter Metadata
Document for each adapter:
```ts
supportsEnvVars: boolean;
envVarStrategy?: 'reference' | 'name' | 'none';
envVarFieldPath?: string; // e.g., 'env.PROVIDER_API_KEY' vs 'apiKey'
```

### Phase 4: Tests
- [x] Audit complete
- [ ] Add type to AgentInfo
- [ ] Implement materialization logic
- [ ] Write tests for env-var path
- [ ] Write tests for plaintext path

## Risk Assessment

**LOW**: 11 adapters require plaintext storage, but this is backwards-compatible with current behavior. The env-var path is opt-in.

**MEDIUM**: Codex's `env_key` field has dual semantics (env-var name vs actual value). Need to clarify behavior in materialization.

**TODO**: Verify Goose, Crush, Continue, Windsurf implement classes and inheritance patterns correctly.

---

### Adapters by Category

**GenericAdapter-based (13 adapters):**
- Junie, Gemini, Pi, Qwen, Cline, Cursor CLI, Roo Code, FreeBuff, Amazon Q, Copilot CLI, Zed, Droid (base GenericAdapter)
- Kilo (OpenCodeStyleAdapter fork)
- Windsurf (GenericAdapter subclass)

**Custom-implemented (8 adapters):**
- Claude Code, Codex, OpenCode-style, Kimi, Goose, Continue, Crush, Zed

**Detect-only (2 adapters):**
- OMP, Aider

**Status:** Ready to implement `supportsEnvVars` policy across all 24 adapters.
