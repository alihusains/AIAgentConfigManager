/**
 * Environment variables — read, categorize, redact, and edit user-level env vars.
 *
 * One registry-first place to see the environment variables this tool and the
 * user's shell actually use (mostly API keys, per the credential-placement
 * survey in docs/design/phase1-secrets-design.md).
 *
 * Platform honesty (this project's stated policy — a fake capability is worse
 * than an absent one):
 *
 * - macOS/Linux: there is NO clean "system-level environment variables" API
 *   (unlike Windows' HKLM/HKU split). We read `process.env` (what THIS tool
 *   sees) and the user's shell profile files. System-level vars
 *   (`/etc/environment`, global `launchctl`) are intentionally NOT read or
 *   written — there is no safe, universal way to do this without elevated
 *   privileges, and we do not assume elevation.
 * - Windows: user-level vars live in `HKCU\Environment` (read/written via
 *   `reg`/`setx`), system-level vars in `HKLM\...\Environment` are READ-ONLY
 *   (admin elevation required, which we cannot assume).
 *   NOTE: the Windows branch is written from documented `reg`/`setx` behavior
 *   and is UNVERIFIED on a real Windows machine (development happens on
 *   macOS). It must be tested there before being trusted.
 *
 * Redaction: any entry whose name looks like it holds a secret (KEY, TOKEN,
 * SECRET, PASSWORD, CREDENTIAL — case-insensitive) has its value redacted in
 * the DEFAULT `listEnvVars()` response. Real values are only returned through
 * the explicit `revealEnvVar(name)` path — never redacted-then-silently-
 * unredacted. This mirrors the provider-key redaction philosophy in
 * docs/design/phase1-secrets-design.md (Section 5).
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import type { Platform } from './types';

// ============================================================================
// Types
// ============================================================================

export interface EnvVarEntry {
  name: string;
  value: string;
  /** Where this value currently comes from. */
  source: 'process' | 'shell-profile' | 'windows-user' | 'windows-system';
  /** Absolute path of the file this was read from, when source is a file (undefined for 'process'). */
  sourceFile?: string;
  /** True if the name looks like it holds a secret. */
  looksSensitive: boolean;
  /** Whether this tool can safely edit this value. */
  editable: boolean;
  /** Short note explaining a non-default state (e.g. why editable is false). */
  note?: string;
}

export interface ListEnvVarsOptions {
  /** Force a platform instead of detecting the current one. */
  platform?: Platform;
}

export interface MutateEnvVarResult {
  ok: boolean;
  warning?: string;
}

// ============================================================================
// Sensitivity + redaction
// ============================================================================

const SENSITIVE_NAME_RE = /(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i;

/** Heuristic: does this variable name look like it holds a secret? */
export function isSensitiveName(name: string): boolean {
  return SENSITIVE_NAME_RE.test(name);
}

/**
 * Mask a secret value for display (first 3 + last 4, per the Phase 1
 * redaction proposal). Values too short to mask safely are fully hidden.
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 3)}...${value.slice(-4)}`;
}

/** Apply redaction to a single entry (in place semantics: returns the entry). */
function redact(entries: EnvVarEntry[]): EnvVarEntry[] {
  return entries.map((e) => (e.looksSensitive ? { ...e, value: maskSecret(e.value) } : e));
}

// ============================================================================
// Shell profile parsing (macOS/Linux)
// ============================================================================

/**
 * Shell profile files, in the order they are consulted. Only files that
 * actually exist are read.
 */
const PROFILE_FILENAMES = ['.zshrc', '.zprofile', '.bash_profile', '.bashrc', '.profile'];

/** Matches `export NAME=value`, `NAME=value`, and quoted/unquoted variants. */
const PROFILE_LINE_RE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;

interface ParsedProfile {
  file: string;
  /** name -> { value, lineIndex } for every assignment line in the file. */
  vars: Map<string, { value: string; lineIndex: number }>;
}

/** Strip a single matching pair of surrounding quotes from a value, if present. */
function stripQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Parse one shell profile file for `export NAME=value` / `NAME=value` lines.
 * Comments, blank lines, and unrelated shell code are ignored. A later
 * assignment to the same name in the same file wins (shells apply top-down).
 */
export function parseShellProfile(file: string, content: string): Map<string, string> {
  const lines = content.split(/\r?\n/);
  const result = new Map<string, string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = PROFILE_LINE_RE.exec(line);
    if (!m) continue;
    // Reject lines that are clearly not a plain assignment (e.g. `local x=1`
    // inside a function, `readonly`, `declare`, or the value starting with `(`
    // for arrays). Keep it conservative: only NAME = value.
    if (/^(?:local|readonly|declare|export\s+(?:-?\w+\s+)+)/.test(line.trim())) continue;
    const name = m[1];
    const rawValue = m[2] || '';
    // Skip values that use command substitution or unquoted shell constructs —
    // we cannot safely re-emit those byte-for-byte.
    if (/[`(]/.test(rawValue)) continue;
    result.set(name, stripQuotes(rawValue));
  }
  return result;
}

/** Read every existing profile file under `homeDir` and parse it. */
async function readProfileFiles(homeDir: string): Promise<ParsedProfile[]> {
  const parsed: ParsedProfile[] = [];
  for (const filename of PROFILE_FILENAMES) {
    const file = path.join(homeDir, filename);
    let content: string | null = null;
    try {
      content = await fs.readFile(file, 'utf-8');
    } catch {
      content = null; // does not exist or unreadable — skip
    }
    if (content === null) continue;
    const lines = content.split(/\r?\n/);
    const vars = new Map<string, { value: string; lineIndex: number }>();
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = PROFILE_LINE_RE.exec(lines[i]);
      if (!m) continue;
      if (/^(?:local|readonly|declare)/.test(trimmed)) continue;
      const rawValue = m[2] || '';
      if (/[`(]/.test(rawValue)) continue;
      vars.set(m[1], { value: stripQuotes(rawValue), lineIndex: i });
    }
    parsed.push({ file, vars });
  }
  return parsed;
}

/**
 * Pick the default target profile file for a brand-new variable based on the
 * user's shell ($SHELL, falling back to zsh — the macOS default).
 */
export function defaultProfileFile(homeDir: string, shell?: string): string {
  const shellName = (shell || process.env.SHELL || '').toLowerCase();
  const isBash = shellName.includes('bash');
  const filename = isBash ? '.bashrc' : '.zshrc';
  return path.join(homeDir, filename);
}

// ============================================================================
// Safe, non-destructive profile editing
// ============================================================================

/**
 * Build a new file content with the target variable updated in place (last
 * matching assignment line wins, matching shell semantics) — or appended at
 * the end when it does not exist yet. Everything else is preserved
 * byte-for-byte.
 */
export function updateProfileContent(content: string, name: string, value: string): string {
  const lines = content.split(/\r?\n/);
  const escapedValue = value.replace(/'/g, "'\\''");
  const newLine = `export ${name}='${escapedValue}'`;
  // Find the LAST line that assigns this name (export or bare).
  let lastIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = PROFILE_LINE_RE.exec(lines[i]);
    if (m && m[1] === name && !/^(?:local|readonly|declare)/.test(lines[i].trim())) {
      lastIdx = i;
    }
  }
  if (lastIdx === -1) {
    // Append; ensure the file ends with a newline before the new line.
    const hasTrailingNewline = content.endsWith('\n') || content.length === 0;
    const separator = content.length === 0 || hasTrailingNewline ? '' : '\n';
    return `${content}${separator}${newLine}\n`;
  }
  lines[lastIdx] = newLine;
  return lines.join('\n');
}

/** Build new file content with every assignment line for `name` removed. */
export function removeProfileContent(
  content: string,
  name: string
): { content: string; removed: boolean } {
  const lines = content.split(/\r?\n/);
  const kept: string[] = [];
  let removed = false;
  for (const line of lines) {
    const m = PROFILE_LINE_RE.exec(line);
    if (m && m[1] === name && !/^(?:local|readonly|declare)/.test(line.trim())) {
      removed = true;
      continue;
    }
    kept.push(line);
  }
  return { content: kept.join('\n'), removed };
}

/**
 * Write content to a profile file atomically (write temp file, then rename),
 * preserving the file's existing permissions when it already exists.
 */
async function writeProfileFile(file: string, content: string): Promise<void> {
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, content, 'utf-8');
  try {
    const stat = await fs.stat(file);
    await fs.chmod(tmp, stat.mode & 0o777);
  } catch {
    // New file: restrict permissions — profiles can carry secrets.
    await fs.chmod(tmp, 0o600).catch(() => undefined);
  }
  await fs.rename(tmp, file);
}

// ============================================================================
// Windows registry access (UNVERIFIED on real Windows — see module header)
// ============================================================================

/**
 * Run an external command and capture stdout/stderr. Resolves (never throws)
 * with code 0 on success or a non-zero code on failure.
 */
function runWinCommand(
  command: string,
  args: string[],
  timeoutMs = 15000
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          const errnoCode = (error as NodeJS.ErrnoException).code;
          const code = typeof errnoCode === 'number' ? errnoCode : 1;
          resolve({ code, stdout: String(stdout || ''), stderr: String(stderr || '') });
        } else {
          resolve({ code: 0, stdout: String(stdout || ''), stderr: String(stderr || '') });
        }
      }
    );
  });
}

/**
 * Parse `reg query` output for the given key into name -> value pairs.
 * Handles REG_SZ, REG_EXPAND_SZ, and REG_BINARY (skipped — not plain text).
 */
function parseRegQueryOutput(stdout: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Format: "    NAME    TYPE    VALUE" (4-space indent, tab or spaces).
    const m = /^\s{2,}([^\s]+)\s+(REG_SZ|REG_EXPAND_SZ|REG_DWORD|REG_BINARY)\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, name, type, value] = m;
    if (type === 'REG_SZ' || type === 'REG_EXPAND_SZ') {
      result.set(name, value.trim());
    }
    // REG_DWORD / REG_BINARY are not plain-text env values — skip.
  }
  return result;
}

const HKU_ENV_KEY = 'HKEY_CURRENT_USER\\Environment';
const HKLM_ENV_KEY =
  'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment';

async function readWindowsRegistryKey(key: string): Promise<Map<string, string> | null> {
  const result = await runWinCommand('reg', ['query', key]);
  if (result.code !== 0) return null;
  return parseRegQueryOutput(result.stdout);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * List environment variables: the current process environment merged with
 * shell-profile assignments (macOS/Linux) or the Windows user/system
 * registry keys (win32). Sensitive-looking values are REDACTED by default.
 */
export async function listEnvVars(opts: ListEnvVarsOptions = {}): Promise<EnvVarEntry[]> {
  const platform: Platform = opts.platform ?? (process.platform as Platform);
  const entries: EnvVarEntry[] = [];

  if (platform === 'win32') {
    // Windows: process env + HKCU (editable) + HKLM (read-only).
    for (const [name, value] of Object.entries(process.env)) {
      if (value === undefined) continue;
      entries.push({
        name,
        value,
        source: 'process',
        looksSensitive: isSensitiveName(name),
        editable: false,
        note: 'Process environment — set it in your shell profile or the registry to persist.',
      });
    }
    const [userVars, systemVars] = await Promise.all([
      readWindowsRegistryKey(HKU_ENV_KEY),
      readWindowsRegistryKey(HKLM_ENV_KEY),
    ]);
    for (const [name, value] of userVars?.entries() ?? []) {
      entries.push({
        name,
        value,
        source: 'windows-user',
        looksSensitive: isSensitiveName(name),
        editable: true,
      });
    }
    for (const [name, value] of systemVars?.entries() ?? []) {
      entries.push({
        name,
        value,
        source: 'windows-system',
        looksSensitive: isSensitiveName(name),
        editable: false,
        note: 'System-level registry key — changing it requires admin elevation, which this tool does not assume.',
      });
    }
  } else {
    // macOS/Linux: process env + shell profile files.
    const homeDir = os.homedir();
    const profiles = await readProfileFiles(homeDir);
    // Map of name -> profile entry (LAST file in PROFILE_FILENAMES order wins,
    // matching the order shells typically load them).
    const profileByName = new Map<string, { value: string; file: string }>();
    for (const profile of profiles) {
      for (const [name, { value }] of profile.vars) {
        profileByName.set(name, { value, file: profile.file });
      }
    }
    const processNames = new Set(Object.keys(process.env));
    const allNames = new Set([...processNames, ...profileByName.keys()]);
    for (const name of allNames) {
      const profileEntry = profileByName.get(name);
      const inProcess = processNames.has(name);
      if (profileEntry) {
        // Prefer the profile-file source: that's where a user would edit it.
        entries.push({
          name,
          value: profileEntry.value,
          source: 'shell-profile',
          sourceFile: profileEntry.file,
          looksSensitive: isSensitiveName(name),
          editable: true,
        });
      } else if (inProcess) {
        entries.push({
          name,
          value: process.env[name] ?? '',
          source: 'process',
          looksSensitive: isSensitiveName(name),
          editable: false,
          note: 'Only present in this process (e.g. exported by a parent shell or launchd) — not in any shell profile file, so this tool will not edit it.',
        });
      }
    }
  }

  return redact(entries);
}

/**
 * Reveal the REAL (unredacted) value of a single variable by name. This is
 * the ONLY path to an unredacted value — call it deliberately. Returns null
 * when the variable is not known to this tool.
 */
export async function revealEnvVar(
  name: string,
  opts: ListEnvVarsOptions = {}
): Promise<string | null> {
  const platform: Platform = opts.platform ?? (process.platform as Platform);
  if (platform === 'win32') {
    const userVars = await readWindowsRegistryKey(HKU_ENV_KEY);
    if (userVars?.has(name)) return userVars.get(name)!;
    const systemVars = await readWindowsRegistryKey(HKLM_ENV_KEY);
    if (systemVars?.has(name)) return systemVars.get(name)!;
    return process.env[name] ?? null;
  }
  const homeDir = os.homedir();
  const profiles = await readProfileFiles(homeDir);
  // Last profile file wins (same order as listEnvVars).
  let profileValue: string | null = null;
  for (const profile of profiles) {
    const v = profile.vars.get(name);
    if (v) profileValue = v.value;
  }
  if (profileValue !== null) return profileValue;
  return process.env[name] ?? null;
}

/**
 * Set (create or update) a user-level environment variable.
 *
 * macOS/Linux: updates (or appends) the `export NAME=value` line in the LAST
 * shell profile file it was found in, or the shell-appropriate default
 * profile for a brand-new var. The edit is surgical — the rest of the file is
 * preserved byte-for-byte.
 *
 * Windows: writes `HKCU\Environment` via `reg add` (not `setx` — `setx` has a
 * documented 1024-character truncation limit and trims trailing spaces).
 * UNVERIFIED on real Windows (see module header).
 */
export async function setEnvVar(
  name: string,
  value: string,
  opts: ListEnvVarsOptions = {}
): Promise<MutateEnvVarResult> {
  const platform: Platform = opts.platform ?? (process.platform as Platform);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return { ok: false, warning: `Invalid environment variable name: "${name}"` };
  }

  if (platform === 'win32') {
    // UNVERIFIED on real Windows. `reg add` avoids setx's 1024-char limit.
    const result = await runWinCommand('reg', [
      'add',
      HKU_ENV_KEY,
      `/v ${name}`,
      '/t REG_SZ',
      `/d ${value}`,
      '/f',
    ]);
    if (result.code !== 0) {
      return { ok: false, warning: `reg add failed: ${result.stderr.trim() || 'unknown error'}` };
    }
    return {
      ok: true,
      warning:
        'Written to HKCU\\Environment via `reg add`. UNVERIFIED on real Windows — please confirm the value there. New shells pick it up; already-running processes do not.',
    };
  }

  const homeDir = os.homedir();
  const profiles = await readProfileFiles(homeDir);
  // Find the LAST profile (in PROFILE_FILENAMES order) that contains the var.
  let target: string | null = null;
  for (const profile of profiles) {
    if (profile.vars.has(name)) target = profile.file;
  }
  if (target === null) {
    target = defaultProfileFile(homeDir);
  }
  let content: string;
  try {
    content = await fs.readFile(target, 'utf-8');
  } catch {
    content = '';
  }
  const updated = updateProfileContent(content, name, value);
  await writeProfileFile(target, updated);
  return {
    ok: true,
    warning: `Written to ${target}. Open a new shell (or \`source ${path.basename(target)}\`) to pick it up.`,
  };
}

/**
 * Remove a user-level environment variable.
 *
 * macOS/Linux: removes the `export NAME=value` / `NAME=value` line(s) from
 * the LAST shell profile file it was found in.
 *
 * Windows: `reg delete` on `HKCU\Environment`. UNVERIFIED on real Windows.
 */
export async function removeEnvVar(
  name: string,
  opts: ListEnvVarsOptions = {}
): Promise<MutateEnvVarResult> {
  const platform: Platform = opts.platform ?? (process.platform as Platform);

  if (platform === 'win32') {
    // UNVERIFIED on real Windows.
    const result = await runWinCommand('reg', ['delete', HKU_ENV_KEY, `/v ${name}`, '/f']);
    if (result.code !== 0) {
      return {
        ok: false,
        warning: `reg delete failed: ${result.stderr.trim() || 'unknown error'}`,
      };
    }
    return {
      ok: true,
      warning:
        'Deleted from HKCU\\Environment via `reg delete`. UNVERIFIED on real Windows — please confirm there. Already-running processes keep the old value.',
    };
  }

  const homeDir = os.homedir();
  const profiles = await readProfileFiles(homeDir);
  let target: string | null = null;
  for (const profile of profiles) {
    if (profile.vars.has(name)) target = profile.file;
  }
  if (target === null) {
    return { ok: false, warning: `Variable "${name}" is not set in any shell profile file.` };
  }
  let content: string;
  try {
    content = await fs.readFile(target, 'utf-8');
  } catch {
    return { ok: false, warning: `Could not read ${target}` };
  }
  const { content: updated, removed } = removeProfileContent(content, name);
  if (!removed) {
    return { ok: false, warning: `No removable line for "${name}" found in ${target}` };
  }
  await writeProfileFile(target, updated);
  return {
    ok: true,
    warning: `Removed from ${target}. Open a new shell to pick it up.`,
  };
}
