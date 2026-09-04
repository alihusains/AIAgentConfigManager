/**
 * Agent Skills spec (agentskills.io) — SKILL.md frontmatter model, parser and
 * validator.
 *
 * Spec fields (2026-09 spec): name (required), description (required),
 * license, compatibility, metadata (string→string map), allowed-tools
 * (experimental). Name must be 1–64 chars of [a-z0-9-], no leading/trailing
 * or consecutive hyphens, and match the parent directory name. Description
 * 1–1024 chars. Compatibility ≤500 chars.
 *
 * Validation follows the spec's client-implementation guidance:
 *   - ERROR (skill should be skipped): missing/empty description, unparseable
 *     frontmatter, name missing.
 *   - WARN  (load anyway): name ≠ folder name, name pattern/length
 *     violations, description > 1024, compatibility > 500.
 *
 * The parser is deliberately dependency-free. It handles the flat scalar keys
 * plus a one-level `metadata:` map, and tolerates the common malformed YAML
 * of unquoted colons in values (per the spec's lenient-parsing advice).
 */

/** The parsed SKILL.md frontmatter (agentskills.io spec fields). */
export interface SkillFrontmatter {
  name?: string;
  description?: string;
  license?: string;
  compatibility?: string;
  /** metadata: nested string→string map (e.g. version, author). */
  metadata?: Record<string, string>;
  /** allowed-tools: space-separated pre-approved tools (experimental). */
  allowedTools?: string[];
  /** Raw key order seen in the file (informational, for round-trip edits). */
  extras?: Record<string, string>;
}

export interface SkillDiagnostic {
  level: 'error' | 'warn';
  /** Stable machine code for tests/UI filtering. */
  code:
    | 'unparseable-frontmatter'
    | 'missing-name'
    | 'missing-description'
    | 'name-mismatch'
    | 'name-too-long'
    | 'name-invalid-chars'
    | 'name-edge-hyphen'
    | 'name-consecutive-hyphens'
    | 'description-too-long'
    | 'compatibility-too-long';
  message: string;
}

export interface SkillValidation {
  ok: boolean;
  /** true when the skill may still be listed (warn-only diagnostics). */
  loadable: boolean;
  diagnostics: SkillDiagnostic[];
}

/** Spec: name is 1–64 chars of lowercase alphanumerics and hyphens. */
export const SKILL_NAME_MAX = 64;
/** Spec: description is 1–1024 chars. */
export const SKILL_DESCRIPTION_MAX = 1024;
/** Spec: compatibility is ≤500 chars. */
export const SKILL_COMPATIBILITY_MAX = 500;

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Parse SKILL.md frontmatter — the full agentskills.io field set.
 *
 * Lenient by design (per the spec's client guidance): unquoted colons inside
 * values are tolerated, single/double-quoted scalars are unescaped, and a
 * one-level `metadata:` map is captured. Anything unparseable returns {} —
 * callers decide via validateSkill whether that is fatal.
 */
export function parseSkillFrontmatterSpec(content: string): SkillFrontmatter {
  const lines = content.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return {};

  const out: SkillFrontmatter = {};
  const extras: Record<string, string> = {};
  let inMetadata = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '---') break;
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    // Nested map entries first: `metadata:` followed by indented
    // `key: value` lines. Must run before the top-level regex's
    // `if (!match) continue` — indented lines never match that anchor.
    if (inMetadata) {
      const nested = /^(\s+)([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
      if (nested) {
        out.metadata![nested[2].toLowerCase()] = unquote(nested[3].trim());
        continue;
      }
      // A dedented (or empty) line ends the metadata map.
      if (line.length > 0 && !/^\s/.test(line)) inMetadata = false;
    }

    const match = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const key = match[1].toLowerCase();
    let value = match[2].trim();

    if (key === 'metadata' && value === '') {
      inMetadata = true;
      out.metadata = {};
      continue;
    }

    switch (key) {
      case 'name':
        out.name = unquote(value);
        break;
      case 'description':
        out.description = unquote(value);
        break;
      case 'license':
        out.license = unquote(value);
        break;
      case 'compatibility':
        out.compatibility = unquote(value);
        break;
      case 'allowed-tools':
        out.allowedTools = value.split(/\s+/).filter(Boolean);
        break;
      default:
        if (value) extras[key] = unquote(value);
        break;
    }
  }
  if (Object.keys(extras).length > 0) out.extras = extras;
  return out;
}

/** Unquote a YAML scalar and tolerate unquoted colons (keep the whole value). */
function unquote(value: string): string {
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

/**
 * Validate a skill against the agentskills.io spec.
 *
 * @param frontmatter parsed frontmatter ({} when unparseable)
 * @param folderName the directory the skill lives in (name must match it)
 */
export function validateSkillSpec(
  frontmatter: SkillFrontmatter,
  folderName: string
): SkillValidation {
  const diagnostics: SkillDiagnostic[] = [];

  const name = frontmatter.name;
  if (!name || name.trim().length === 0) {
    diagnostics.push({
      level: 'error',
      code: 'missing-name',
      message: 'Frontmatter has no name — the spec requires one.',
    });
  } else {
    if (name !== folderName) {
      diagnostics.push({
        level: 'warn',
        code: 'name-mismatch',
        message: `name "${name}" does not match the folder name "${folderName}" — agents may not discover it.`,
      });
    }
    if (name.length > SKILL_NAME_MAX) {
      diagnostics.push({
        level: 'warn',
        code: 'name-too-long',
        message: `name is ${name.length} chars — the spec allows at most ${SKILL_NAME_MAX}.`,
      });
    } else {
      if (!NAME_PATTERN.test(name)) {
        diagnostics.push({
          level: 'warn',
          code: 'name-invalid-chars',
          message:
            'name should use only lowercase letters, digits and hyphens (no leading/trailing hyphen).',
        });
      }
      if (name.startsWith('-') || name.endsWith('-')) {
        diagnostics.push({
          level: 'warn',
          code: 'name-edge-hyphen',
          message: 'name must not start or end with a hyphen.',
        });
      }
      if (name.includes('--')) {
        diagnostics.push({
          level: 'warn',
          code: 'name-consecutive-hyphens',
          message: 'name must not contain consecutive hyphens.',
        });
      }
    }
  }

  const description = frontmatter.description;
  if (!description || description.trim().length === 0) {
    diagnostics.push({
      level: 'error',
      code: 'missing-description',
      message: 'Frontmatter has no description — agents cannot discover the skill without one.',
    });
  } else if (description.length > SKILL_DESCRIPTION_MAX) {
    diagnostics.push({
      level: 'warn',
      code: 'description-too-long',
      message: `description is ${description.length} chars — the spec allows at most ${SKILL_DESCRIPTION_MAX}.`,
    });
  }

  if (
    frontmatter.compatibility &&
    frontmatter.compatibility.length > SKILL_COMPATIBILITY_MAX
  ) {
    diagnostics.push({
      level: 'warn',
      code: 'compatibility-too-long',
      message: `compatibility is ${frontmatter.compatibility.length} chars — the spec allows at most ${SKILL_COMPATIBILITY_MAX}.`,
    });
  }

  const errors = diagnostics.filter((d) => d.level === 'error');
  return {
    ok: diagnostics.length === 0,
    loadable: errors.length === 0,
    diagnostics,
  };
}
