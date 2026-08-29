# Design Doc: Multi-Format Skill Adapter Architecture

## Overview

This document proposes an adapter pattern for handling divergent skill storage formats across different agent CLI tools. Today, all skill-capable agents use identical conventions: a folder per skill containing `SKILL.md` with flat YAML frontmatter, copied byte-for-byte via `fs.cp`. This works because the current catalog (Claude Code, OpenAI Codex, OpenCode, AionUi, and after M041, Pi/Continue/Roo/Qwen/Junie) all share this format.

When a future agent with a genuinely different format (e.g., single flat `.md` per skill, no subfolder, different frontmatter or none) is added to the catalog, the current `assignSkillToAgent`/`copySkillBetweenAgents`/`removeSkillFromAgent` functions will either fail silently or produce broken results. This proposal outlines an adapter-based architecture parallel to the existing **provider adapter pattern** already proven in this codebase, ensuring graceful handling of multi-format agents while preserving backwards compatibility.

## Precedent: The Provider Adapter Pattern

This proposal directly mirrors the architecture in `packages/core/src/adapters/`, which already solves the "one canonical schema, N format-specific adapters" problem for agent configuration files.

### Current Provider Adapter Implementation

- **Registry**: `packages/core/src/adapters/index.ts` maintains a `Map<string, () => AgentAdapter>` called `adapters`, where keys are agent IDs (e.g., `'claude-code'`, `'pi'`, `'gemini'`) and values are factory functions returning adapter instances.
- **Shared base**: `packages/core/src/adapters/generic.ts` exports `GenericAdapter` — a concrete implementation and factory `createGenericAdapter()` that handles "flat-config" agents with JSON/JSONC files and configurable MCP server shapes ('array' vs. 'keyed').
- **Agent-specific adapters**: Individual adapters like `ClaudeCodeAdapter`, `CodexAdapter`, `PiAdapter` build on or wrap `GenericAdapter` to handle agent-specific quirks (separate provider-store files, custom encoding rules, etc.).
- **Registry entry**: `packages/core/src/agent-catalog.ts` includes `AgentCatalogEntry` with fields like `configPaths`, `mcpConfigPaths`, `modelCredentialPaths` that describe where an agent's config lives, effectively declaring its "shape" to the adapter layer.
- **Factory pattern**: `getAdapter(agentId)` returns the right adapter instance; `registerAdapter()` allows runtime registration of new adapters.

### Fidelity Reporting Precedent

The GUI already acknowledges format limitations honestly in `packages/gui/src/components/ProvidersView.tsx`:

- **Dimmed avatars**: Agents whose config format cannot store model providers (e.g., Pi, Junie, FreeBuff manage their own model lists) are rendered with `.avatar-dim` (reduced opacity) or `.cursor-not-allowed`.
- **Honest titles/tooltips**: "X's config format cannot store model providers — nothing was written to its files" rather than silently pretending the operation succeeded.
- **UI state**: Checkboxes are `disabled={!supported}` and show a badge `"no model support"` instead of misleading users into selecting unsupported agents.

This pattern should apply to skill format fidelity too.

## Proposed Architecture

### 1. Canonical Skill Representation

**Goal**: A data structure that holds all information needed for ANY format adapter to encode/decode a skill correctly.

```typescript
/**
 * Universal representation of a skill, independent of on-disk format.
 * Adapters serialize this into their target format; deserializers return it.
 */
export interface CanonicalSkill {
  /** Stable id — used as folder name in folder-based formats. */
  id: string;
  /** Display name from frontmatter or fallback to id. */
  name: string;
  description?: string;
  version?: string;
  /**
   * The markdown body after frontmatter (everything the user reads).
   * Some formats may inline this into their single file; folder-based formats
   * store it as the body of SKILL.md.
   */
  body: string;
  /**
   * Companion files within the skill folder (e.g. DESIGN.md, examples/,
   * images/, etc.). Maps file paths (relative to skill root) to file content.
   * Empty for skills with only SKILL.md.
   *
   * Example:
   *   { "DESIGN.md": "# Design...", "examples/example.md": "..." }
   */
  files: Record<string, string>;
}
```

**Rationale**: The current `SkillDef` interface (`packages/core/src/skills.ts`) only carries metadata + path; it cannot represent companion files. `CanonicalSkill` includes the full tree, so adapters can preserve or deliberately drop companion content based on their format constraints.

### 2. SkillFormatAdapter Interface

**Goal**: Define how to read, write, and remove skills in different formats. Parallel to `AgentAdapter` in `packages/core/src/adapters/index.ts`.

```typescript
/**
 * Outcome of writing a skill in a specific format. Must report PARTIAL
 * fidelity honestly rather than hiding loss of information.
 */
export interface SkillWriteResult {
  /** Path to the skill on disk (folder root or the single .md file, depending on format). */
  targetPath: string;
  /**
   * Fidelity flags: what this format could NOT represent from the canonical skill.
   * When non-empty, the UI should surface them as a warning (like dimmed avatars for providers).
   *
   * Examples:
   *   - "companion-files-dropped: 2 files not representable in single-file format"
   *   - "version-field-dropped: format does not support semver"
   */
  fidelityWarnings: string[];
}

/**
 * Adapter interface for reading and writing skills in a specific format.
 * Parallel to AgentAdapter in packages/core/src/adapters/index.ts.
 */
export interface SkillFormatAdapter {
  /** Adapter id (e.g. 'skill-folder', 'skill-flat-md'). */
  id: string;
  /** Human-readable format name. */
  name: string;
  /** Brief description of what this format supports/doesn't support. */
  description: string;

  /**
   * Read a skill from disk in this format, returning the canonical representation.
   * Returns null if the skill doesn't exist or isn't readable.
   *
   * @param targetDir - The agent's skills directory (the parent of the skill itself).
   * @param skillId - The skill id to read.
   * @return CanonicalSkill or null if not found.
   */
  read(targetDir: string, skillId: string): Promise<CanonicalSkill | null>;

  /**
   * Write a canonical skill to disk in this format. Overwrites any existing skill.
   * Must report fidelity warnings honestly when the format cannot represent all
   * parts of the canonical skill.
   *
   * @param skill - The canonical skill to write.
   * @param targetDir - The agent's skills directory.
   * @return Write result with targetPath and fidelity warnings.
   */
  write(skill: CanonicalSkill, targetDir: string): Promise<SkillWriteResult>;

  /**
   * Remove a previously assigned skill from disk (delete only the copy).
   * Should not throw if the skill doesn't exist — just succeed silently.
   *
   * @param targetDir - The agent's skills directory.
   * @param skillId - The skill id to remove.
   */
  remove(targetDir: string, skillId: string): Promise<void>;
}
```

**Rationale**:

- Mirrors `AgentAdapter` from `packages/core/src/adapters/index.ts` (config read/write methods).
- `fidelityWarnings` array allows honest UI surface of format limitations without silently corrupting data.
- `skillId` parameter lets flat-file formats know what id to use when the disk location doesn't encode it.

### 3. Default SkillFolderAdapter

**Goal**: Wrap the current `fs.cp` logic as one concrete adapter, preserving existing behavior.

```typescript
/**
 * The "folder + SKILL.md" format used by all currently-catalogued skill-capable agents.
 * This is the default adapter for Claude Code, OpenCode, AionUi, and future agents
 * that share this format.
 *
 * On-disk layout:
 *   <skillsDir>/<skillId>/
 *     SKILL.md (frontmatter + body)
 *     DESIGN.md (optional companion)
 *     examples/ (optional companion folder)
 *     ... any other files in the skill folder
 */
export class SkillFolderAdapter implements SkillFormatAdapter {
  id = 'skill-folder';
  name = 'Skill Folder (SKILL.md)';
  description =
    'Standard format: a folder named after the skill id, containing SKILL.md with YAML frontmatter and optional companion files.';

  async read(targetDir: string, skillId: string): Promise<CanonicalSkill | null> {
    const skillDir = path.join(targetDir, skillId);
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    const content = await readFileSafe(skillMdPath);
    if (!content) return null;

    const meta = parseSkillFrontmatter(content);
    const body = extractBody(content); // Everything after the closing ---
    const files = await readCompanionFiles(skillDir);

    return {
      id: skillId,
      name: meta.name ?? skillId,
      description: meta.description,
      version: meta.version,
      body,
      files,
    };
  }

  async write(skill: CanonicalSkill, targetDir: string): Promise<SkillWriteResult> {
    const skillDir = path.join(targetDir, skill.id);
    await fs.mkdir(skillDir, { recursive: true });
    await fs.rm(skillDir, { recursive: true, force: true });
    await fs.mkdir(skillDir, { recursive: true });

    // Write SKILL.md with frontmatter + body
    const frontmatter = this.buildFrontmatter(skill);
    const skillMdContent = `${frontmatter}\n\n${skill.body.trim()}\n`;
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), skillMdContent, 'utf8');

    // Write companion files
    for (const [relPath, content] of Object.entries(skill.files)) {
      const fullPath = path.join(skillDir, relPath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf8');
    }

    return {
      targetPath: skillDir,
      fidelityWarnings: [], // No loss of fidelity — this format stores everything.
    };
  }

  async remove(targetDir: string, skillId: string): Promise<void> {
    const skillDir = path.join(targetDir, skillId);
    await fs.rm(skillDir, { recursive: true, force: true });
  }

  private buildFrontmatter(skill: CanonicalSkill): string {
    const lines = ['---', `name: ${yamlScalar(skill.name)}`];
    if (skill.description) lines.push(`description: ${yamlScalar(skill.description)}`);
    if (skill.version) lines.push(`version: ${yamlScalar(skill.version)}`);
    lines.push('---');
    return lines.join('\n');
  }
}
```

**Rationale**:

- Encapsulates the exact `fs.cp` + `parseSkillFrontmatter` logic currently inline in `packages/core/src/skills.ts`.
- Preserves 100% backwards compatibility: existing agents don't change.
- Serves as the canonical reference for what the "standard" format looks like.

### 4. Worked Example: Single-File Flat Adapter

**Goal**: Illustrate a divergent-format adapter by designing one concretely.

**Hypothetical agent**: OpenWebUI or similar, which stores skills as single flat `.md` files (one file = one skill), no subfolder, no folder nesting.

On-disk layout:

```
<skillsDir>/
  skill-name-1.md
  skill-name-2.md
```

File format (example):

```markdown
---
id: skill-name-1
name: My Skill
description: A description
---

# My Skill

Markdown body here.

## Limitations

This single-file format cannot represent companion files (DESIGN.md, examples/, etc.).
```

```typescript
/**
 * Flat single-file adapter for agents that store skills as individual .md files
 * with no subfolder nesting. Companion files are dropped with a fidelity warning.
 */
export class SkillFlatMarkdownAdapter implements SkillFormatAdapter {
  id = 'skill-flat-md';
  name = 'Flat Markdown (single .md per skill)';
  description =
    'Single-file format: each skill is one <skillId>.md file in the skills directory, no subfolders. Companion files cannot be represented and are dropped.';

  async read(targetDir: string, skillId: string): Promise<CanonicalSkill | null> {
    const filePath = path.join(targetDir, `${skillId}.md`);
    const content = await readFileSafe(filePath);
    if (!content) return null;

    const meta = parseSkillFrontmatter(content);
    const body = extractBody(content);

    return {
      id: skillId,
      name: meta.name ?? skillId,
      description: meta.description,
      version: meta.version,
      body,
      files: {}, // No companion files in this format.
    };
  }

  async write(skill: CanonicalSkill, targetDir: string): Promise<SkillWriteResult> {
    await fs.mkdir(targetDir, { recursive: true });
    const filePath = path.join(targetDir, `${skill.id}.md`);

    // Build frontmatter with id field (so read() can recover it)
    const frontmatter = [
      '---',
      `id: ${yamlScalar(skill.id)}`,
      `name: ${yamlScalar(skill.name)}`,
    ];
    if (skill.description) frontmatter.push(`description: ${yamlScalar(skill.description)}`);
    if (skill.version) frontmatter.push(`version: ${yamlScalar(skill.version)}`);
    frontmatter.push('---');

    const content = `${frontmatter.join('\n')}\n\n${skill.body.trim()}\n`;
    await fs.writeFile(filePath, content, 'utf8');

    // Fidelity warnings for dropped companion files
    const fidelityWarnings: string[] = [];
    if (Object.keys(skill.files).length > 0) {
      fidelityWarnings.push(
        `companion-files-dropped: ${Object.keys(skill.files).length} file(s) (DESIGN.md, examples, etc.) not representable in single-file format`
      );
    }

    return {
      targetPath: filePath,
      fidelityWarnings,
    };
  }

  async remove(targetDir: string, skillId: string): Promise<void> {
    const filePath = path.join(targetDir, `${skillId}.md`);
    await fs.rm(filePath, { recursive: false, force: true });
  }
}
```

**Design decisions**:

- **Companion files**: Dropped entirely with an explicit warning, not inlined into the markdown body. Inlining would corrupt the skill's structure and make parsing fragile.
- **Frontmatter**: Includes an explicit `id` field so `read()` doesn't need to infer the id from the filename (defensive against filename mismatches).
- **Fidelity warning**: Clear, specific message tells the UI and user exactly what was lost.

### 5. Catalog Schema Extension

**Goal**: Add optional format metadata to agent catalog entries.

```typescript
// In packages/core/src/agent-catalog.ts

export interface AgentCatalogEntry {
  // ... existing fields ...

  /**
   * Skill format id for this agent (e.g. 'skill-folder', 'skill-flat-md').
   * When omitted, defaults to 'skill-folder' (the current standard).
   * Used to route assign/remove/copy operations through the right SkillFormatAdapter.
   */
  skillsFormat?: string;
}
```

**Registry mapping** (new):

```typescript
// In packages/core/src/skills.ts or a new file packages/core/src/skill-adapters/index.ts

const skillFormatAdapters = new Map<string, () => SkillFormatAdapter>([
  ['skill-folder', () => new SkillFolderAdapter()],
  ['skill-flat-md', () => new SkillFlatMarkdownAdapter()],
  // Future divergent formats registered here
]);

export function getSkillFormatAdapter(agentId: string): SkillFormatAdapter {
  const entry = getAgentCatalogEntry(agentId);
  const formatId = entry?.skillsFormat ?? 'skill-folder'; // Default to folder format
  const factory = skillFormatAdapters.get(formatId);
  if (!factory) {
    throw new Error(`Unknown skill format: ${formatId} (for agent ${agentId})`);
  }
  return factory();
}

export function registerSkillFormatAdapter(
  formatId: string,
  factory: () => SkillFormatAdapter
): void {
  skillFormatAdapters.set(formatId, factory);
}
```

**Current catalog**: Zero changes needed. All 4 currently skill-capable agents (chatgpt, claude-code, opencode, aion-cli) omit `skillsFormat` and implicitly use `'skill-folder'`.

### 6. Routing Changes in skills.ts

**Goal**: Identify exactly where routing through adapters would happen.

Current functions in `packages/core/src/skills.ts` that assume hardcoded `fs.cp`:

1. **`assignSkillToAgent(skillId, agentId, opts)`** (line ~260)
   - Current: `await fs.cp(source, targetPath, { recursive: true })`
   - Proposal:

     ```typescript
     const adapter = getSkillFormatAdapter(agentId);
     const canonical = await adapter.read(opts.libraryDir ?? getSkillsLibraryDir(), skillId);
     if (!canonical) throw new Error(`Skill not found: ${skillId}`);
     const result = await adapter.write(canonical, opts.skillsDir ?? getAgentSkillsDir(agentId, opts.platform));
     return { targetPath: result.targetPath, fidelityWarnings: result.fidelityWarnings };
     ```

2. **`copySkillBetweenAgents(skillId, sourceAgentId, targetAgentId, opts)`** (line ~280)
   - Current: `await fs.cp(sourcePath, targetPath, { recursive: true })`
   - Proposal: Same as assignSkillToAgent but read from source agent's skills directory via `sourceAgentId`'s adapter, then write via `targetAgentId`'s adapter. If adapters mismatch, the canonical form ensures lossless round-trip up to the target format's limits.

3. **`removeSkillFromAgent(skillId, agentId, opts)`** (line ~305)
   - Current: `await fs.rm(targetPath, { recursive: true, force: true })`
   - Proposal: `const adapter = getSkillFormatAdapter(agentId); await adapter.remove(...)`

4. **`listAgentSkills(agentId, opts)`** (line ~180)
   - Current: Enumerates folders in the skills directory, reads each `SKILL.md`
   - Proposal: Still enumerates the directory (format-agnostic), but delegates the actual read to the adapter for each skill's metadata

5. **GUI return type for `assignSkillToAgent`** (currently `{ targetPath: string }`)
   - Proposal: Extend to `{ targetPath: string; fidelityWarnings?: string[] }` so the UI can display warnings (paralleling how ProvidersView dims unsupported agents)

### 7. Non-Goal / Trigger Condition

**DO NOT IMPLEMENT** this adapter architecture until a real agent with a divergent skill format is actually added to the catalog. This proposal should be treated as **speculative generality** per this project's own coding standards.

**Trigger condition for implementation**:

- A new agent CLI enters the catalog (`skillsPaths` declared for it in `packages/core/src/agent-catalog.json`)
- AND that agent's skill format differs from the standard "folder + SKILL.md" convention
- AND the team has confirmed the format difference is intentional and not worth adapting to the standard

**Why not now?**:

- You Aren't Gonna Need It (YAGNI): Building abstractions for hypothetical use cases invites accidental complexity (see project standards in task dispatch docs — "do what has been asked, nothing more, nothing less").
- Zero currently-skill-capable agents diverge from the folder format; adding adapter infrastructure now would hide the real problem (agent mismatch) under a layer of indirection that's never exercised, making it hard to debug when the first divergent format actually shows up.
- The precedent (provider adapters) was built reactively: when multiple real agents had genuinely different config storage, the abstraction emerged organically and proved its worth immediately.

## Comparison to Existing Provider Adapter Pattern

| Aspect | Provider Adapter | Proposed Skill Adapter |
| -------- | ------------------ | ---------------------- |
| **Registry** | `packages/core/src/adapters/index.ts` Map | `packages/core/src/skill-adapters/index.ts` Map (new) |
| **Canonical type** | `AgentConfig` (unified schema) | `CanonicalSkill` (unified schema) |
| **Interface** | `AgentAdapter` (read/write/mutate config) | `SkillFormatAdapter` (read/write/remove skill) |
| **Default impl** | `GenericAdapter` (flat JSON/JSONC) | `SkillFolderAdapter` (folder + SKILL.md) |
| **Fidelity reporting** | `supports: Partial<AgentCapabilities>` + UI dimming (ProvidersView line 86–90) | `SkillWriteResult.fidelityWarnings` + UI dimming (same pattern) |
| **Catalog entry** | No format field (all use `GenericAdapter` or variants) | `skillsFormat?: string` (default `'skill-folder'`) |
| **Backwards compatibility** | Perfect — adapters wrap existing behavior | Perfect — all existing agents default to folder adapter |
| **Migration path** | Zero changes to existing agents | Wrap current `fs.cp` in SkillFolderAdapter, register for all 4 current agents, zero behavior change |

## Files Affected by Future Implementation

When a divergent-format agent is added:

1. **`packages/core/src/skills.ts`**: Route `assignSkillToAgent`, `copySkillBetweenAgents`, `removeSkillFromAgent` through `getSkillFormatAdapter()`.
2. **`packages/core/src/skill-adapters/index.ts`** (new): Define `SkillFormatAdapter` interface, `CanonicalSkill` type, registry Map, and default `SkillFolderAdapter`.
3. **`packages/core/src/agent-catalog.json`**: Add `skillsFormat` field to the new agent entry.
4. **`packages/gui/src/components/SkillsView.tsx`**: Display fidelity warnings as tooltips or badges, similar to ProvidersView's "format cannot store model providers."

## Open Questions / Considerations

1. **Companion file handling**: Should different adapters be allowed to inline or transform companion files (e.g., concatenate DESIGN.md into the body as a "## Design" section)? Current proposal: drop with warning (simpler, honest).

2. **Version field semantics**: Should `CanonicalSkill.version` be semver-only, or allow arbitrary strings? Flat-file example preserves it in frontmatter, but some formats might not.

3. **Bidirectional conversion**: When copying from agent A (flat-md format) to agent B (folder format), the canonical round-trip works, but should the UI warn the user that companion files are now missing? Yes — explicit `listAgentSkills()` should include fidelity metadata per skill, not just per adapter.

## Conclusion

This adapter pattern solves the divergent-format problem by:

1. **Preserving existing behavior**: All currently-skill-capable agents continue working without changes.
2. **Enabling new formats**: When an agent with a different skill format enters the catalog, adapters route operations correctly.
3. **Honesty**: Fidelity warnings surface format limitations (like dimmed provider avatars) instead of silently losing data.
4. **Consistency**: Direct parallel to the proven provider adapter pattern already in this codebase.
5. **Deferred complexity**: Only implemented when a real need exists, respecting YAGNI and this project's coding standards.

The design is ready for implementation the moment a divergent-format agent is added to the catalog.
