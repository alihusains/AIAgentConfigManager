/**
 * Utility functions for file operations, path resolution, and config parsing
 */

import { load as parseYAML, dump as dumpYAML } from 'js-yaml';
import { parse as parseTOML } from 'toml';
import { z } from 'zod';
import { type ConfigFormat, type Platform, type AgentConfig, AgentConfigSchema } from '../types';

// Re-export redaction utilities for public use
export { maskKey, maskKeyWithPrefix, looksLikeSecret } from './redact';

// ============================================================================
// Environment Detection
// ============================================================================

declare const window: unknown & typeof globalThis;

// Tauri injects the IPC invoke function into the webview global scope
declare const __TAURI_INVOKE__:
  | ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>)
  | undefined;

type TauriInvoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

const isBrowser = typeof window !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions?.node;
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

// ============================================================================
// Dynamic Imports (to avoid bundler issues)
// ============================================================================

let fs: typeof import('fs/promises') | null = null;
let pathNs: typeof import('path') | null = null;
let osNs: typeof import('os') | null = null;
let tauriInvoke: TauriInvoke | null = null;
let tauriInvokeFailed = false;

async function loadNodeModules() {
  if (!isNode) return;
  if (!fs) fs = await import('node:fs/promises');
  if (!pathNs) pathNs = await import('node:path');
  if (!osNs) osNs = await import('node:os');
}

/**
 * Lazy-load the Tauri IPC bridge. Returns null in non-Tauri environments.
 */
function getTauriInvoke(): TauriInvoke | null {
  if (tauriInvoke) return tauriInvoke;
  if (!isTauri || tauriInvokeFailed) return null;
  try {
    if (typeof __TAURI_INVOKE__ === 'function') {
      tauriInvoke = __TAURI_INVOKE__;
      return tauriInvoke;
    }
  } catch {
    // fall through
  }
  tauriInvokeFailed = true;
  return null;
}

let homeDirCache: string | null = null;

/**
 * Resolve the user's home directory in the Tauri webview.
 * Falls back to an empty string when the IPC bridge is unavailable.
 */
export async function getHomeDirAsync(): Promise<string> {
  if (homeDirCache) return homeDirCache;
  const invoke = getTauriInvoke();
  if (invoke) {
    try {
      const dir = await invoke('get_home_dir');
      if (typeof dir === 'string' && dir) {
        homeDirCache = dir;
        return dir;
      }
    } catch {
      // fall through to empty string
    }
  }
  return '';
}

// ============================================================================
// Platform & Path Utilities
// ============================================================================

export function getCurrentPlatform(): Platform {
  // Node.js environment (CLI)
  if (isNode && typeof process !== 'undefined') {
    const platform = process.platform;
    if (platform === 'darwin') return 'darwin';
    if (platform === 'win32') return 'win32';
    return 'linux';
  }

  // Tauri webview: Tauri exposes platform info via IPC; before that resolves,
  // fall back to the user agent detection below.
  // Browser/Tauri fallback - detect from user agent
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    if (ua.includes('Mac OS X') || ua.includes('Macintosh')) return 'darwin';
    if (ua.includes('Windows')) return 'win32';
    if (ua.includes('Linux')) return 'linux';
  }

  return 'darwin'; // Default fallback
}

/**
 * Safe accessor for platform/arch/runtime info that works in Node, the Tauri
 * webview, and a plain browser (unlike direct `process.*` access).
 */
export function getEnvironmentInfo(): {
  platform: string;
  arch: string;
  nodeVersion: string;
} {
  const platform = getCurrentPlatform();
  let arch = '';
  let nodeVersion = '';

  if (typeof process !== 'undefined' && process.versions?.node) {
    arch = process.arch;
    nodeVersion = process.version;
  } else if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    if (/arm64|aarch64/i.test(ua)) arch = 'arm64';
    else if (/x64|amd64/i.test(ua)) arch = 'x64';
    nodeVersion = '';
  }

  return { platform, arch, nodeVersion };
}

export function getHomeDir(): string {
  // Node.js environment
  if (isNode && typeof process !== 'undefined') {
    return process.env.HOME || process.env.USERPROFILE || '/';
  }

  // Tauri/webview: home dir is resolved lazily via IPC (getHomeDirAsync)
  if (homeDirCache) return homeDirCache;
  return '';
}

export function resolveConfigPath(template: string, _platform?: Platform): string {
  const home = getHomeDir();

  // Replace placeholders
  let resolved = template
    .replace('~', home)
    .replace('${HOME}', home)
    .replace(
      '${USERPROFILE}',
      (typeof process === 'undefined' ? '' : process.env.USERPROFILE) || home
    )
    .replace(
      '%USERPROFILE%',
      (typeof process === 'undefined' ? '' : process.env.USERPROFILE) || home
    )
    .replace('%APPDATA%', (typeof process === 'undefined' ? '' : process.env.APPDATA) || '');

  // Simplified path resolution for browser environment
  if (isBrowser && !isTauri) {
    // In browser, we can't resolve actual paths
    // Return a placeholder that should be handled by the Tauri backend
    if (template.includes('~/.claude/')) return '/config/claude/settings.json';
    if (template.includes('%USERPROFILE%')) return 'C:\\Users\\...\\.claude\\settings.json';
  }

  try {
    if (pathNs) {
      resolved = resolved
        .replace(
          '$XDG_CONFIG_HOME',
          (typeof process === 'undefined' ? '' : process.env.XDG_CONFIG_HOME) ||
            pathNs.join(home, '.config')
        )
        .replace(
          '$XDG_DATA_HOME',
          (typeof process === 'undefined' ? '' : process.env.XDG_DATA_HOME) ||
            pathNs.join(home, '.local', 'share')
        )
        .replace(
          '$XDG_CACHE_HOME',
          (typeof process === 'undefined' ? '' : process.env.XDG_CACHE_HOME) ||
            pathNs.join(home, '.cache')
        );
    }
  } catch {
    // Path operations not available, use string replacement
  }

  return resolved;
}

export function expandPath(filePath: string): string {
  return resolveConfigPath(filePath);
}

export { isSafeConfigPath } from './path-safety';

// ============================================================================
// File Operations (Node.js + Tauri IPC)
// ============================================================================

export async function fileExists(filePath: string): Promise<boolean> {
  await loadNodeModules();
  if (isNode && fs) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  const invoke = getTauriInvoke();
  if (invoke) {
    try {
      return Boolean(await invoke('file_exists', { path: filePath }));
    } catch {
      return false;
    }
  }
  return false;
}

export async function readFileSafe(filePath: string): Promise<string | null> {
  await loadNodeModules();
  if (isNode && fs) {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }
  const invoke = getTauriInvoke();
  if (invoke) {
    try {
      const content = await invoke('read_file', { path: filePath });
      return typeof content === 'string' ? content : null;
    } catch {
      return null;
    }
  }
  throw new Error(
    'File system access not available in this environment. Use Tauri IPC or Node.js.'
  );
}

export async function writeFileSafe(filePath: string, content: string): Promise<void> {
  await loadNodeModules();
  if (isNode && fs) {
    const dir = pathNs ? pathNs.dirname(filePath) : '.';
    if (pathNs) await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content, 'utf-8');
    // Restrict permissions: config files and the registry contain API keys.
    await fs.chmod(filePath, 0o600).catch(() => undefined);
    return;
  }
  const invoke = getTauriInvoke();
  if (invoke) {
    await invoke('write_file', { path: filePath, content });
    return;
  }
  throw new Error(
    'File system access not available in this environment. Use Tauri IPC or Node.js.'
  );
}

export async function backupFile(filePath: string): Promise<string> {
  await loadNodeModules();
  if (!fs || !pathNs) throw new Error('File system access not available');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${filePath}.backup.${timestamp}`;
  const content = await readFileSafe(filePath);
  if (content !== null) {
    await writeFileSafe(backupPath, content);
  }
  return backupPath;
}

export async function restoreBackup(backupPath: string, targetPath: string): Promise<void> {
  await loadNodeModules();
  if (!fs) throw new Error('File system access not available');
  const content = await readFileSafe(backupPath);
  if (content !== null) {
    await writeFileSafe(targetPath, content);
  }
}

// ============================================================================
// CLI Detection (Node.js + Tauri IPC)
// ============================================================================

type ExecResult = { code: number | null; stdout: string; stderr: string };

let execFile: typeof import('node:child_process').execFile | null = null;

/**
 * Lazy-load child_process. Only available in Node.js.
 */
async function loadExec(): Promise<typeof import('node:child_process').execFile | null> {
  await loadNodeModules();
  if (!isNode || !fs) return null;
  if (!execFile) {
    try {
      const cp = await import('node:child_process');
      execFile = cp.execFile;
    } catch {
      execFile = null;
    }
  }
  return execFile;
}

/**
 * Check whether a CLI binary is available on PATH.
 * Works in Node.js (via `which`/`where`) and in the Tauri webview (via IPC),
 * returns false in a plain browser.
 */
export async function commandExists(command: string): Promise<boolean> {
  return (await getCommandPath(command)) !== null;
}

/**
 * Resolve the absolute path of a CLI binary on PATH, or null when missing.
 */
export async function getCommandPath(command: string): Promise<string | null> {
  const exec = await loadExec();
  if (exec) {
    try {
      const resolver = getCurrentPlatform() === 'win32' ? 'where' : 'which';
      const result = await runNodeCommand(exec, resolver, [command]);
      const firstLine = result.stdout.split(/\r?\n/)[0].trim();
      return firstLine || null;
    } catch {
      return null;
    }
  }

  const invoke = getTauriInvoke();
  if (invoke) {
    try {
      const path = await invoke('resolve_command', { command });
      return typeof path === 'string' && path ? path : null;
    } catch {
      return null;
    }
  }

  return null; // Plain browser: cannot detect CLI binaries
}

/**
 * Run an external command and capture stdout/stderr. Node.js only.
 */
export async function runCommand(
  command: string,
  args: string[] = [],
  timeoutMs = 10000
): Promise<ExecResult> {
  const exec = await loadExec();
  if (!exec) {
    throw new Error('External commands are not available in this environment');
  }
  return runNodeCommand(exec, command, args, timeoutMs);
}

/**
 * Query an agent CLI's version string (e.g. `claude --version`).
 * Returns null when the CLI cannot be queried. Tries each args set in
 * order and rejects output that is clearly an error message (e.g. Junie's
 * "[Junie] Error: No version found.").
 */
export async function getCommandVersion(
  command: string,
  args: string[] = ['--version'],
  /**
   * Absolute path to the binary, when the caller already resolved it
   * (e.g. via resolveBinary in detectAgent). Skips the redundant
   * `commandExists` / `which` spawn — saves one subprocess per agent.
   */
  resolvedPath?: string
): Promise<string | null> {
  if (!resolvedPath && !(await commandExists(command))) return null;
  const execTarget = resolvedPath || command;
  const attempts = args.length > 0 ? args : ['--version'];
  for (const attempt of attempts) {
    try {
      const result = await runCommand(execTarget, [attempt], 15000);
      const raw = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
      const version = raw.split(/\r?\n/)[0].trim();
      if (version && !isErrorString(version)) return version;
    } catch {
      // try the next argument form
    }
  }
  return null;
}

/** Heuristic: is this "version" output actually an error message? */
function isErrorString(line: string): boolean {
  return /\b(error|failed|failure|not found|no version)\b/i.test(line) && !/\d/.test(line);
}

function runNodeCommand(
  exec: typeof import('node:child_process').execFile,
  command: string,
  args: string[],
  timeoutMs = 10000
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    try {
      const child = exec(
        command,
        args,
        { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 },
        (error, stdout, stderr) => {
          resolve({
            code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
            stdout: String(stdout || ''),
            stderr: String(stderr || ''),
          });
        }
      );
      // Prevent hanging if the process never exits
      child.on('error', (err) => {
        reject(err);
      });
      child.unref?.();
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================================
// Config Parsing
// ============================================================================

export function parseConfig(content: string, format: ConfigFormat): Record<string, unknown> {
  switch (format) {
    case 'json':
    case 'jsonc':
      return parseJSONC(content);
    case 'yaml':
      return parseYAML(content) as Record<string, unknown>;
    case 'toml':
      return parseTOML(content) as Record<string, unknown>;
    default:
      throw new Error(`Unsupported config format: ${format}`);
  }
}
export function stringifyConfig(obj: unknown, format: ConfigFormat): string {
  switch (format) {
    case 'json':
    case 'jsonc':
      return JSON.stringify(obj, null, 2);
    case 'yaml':
      return dumpYAML(obj, { indent: 2, lineWidth: -1, noRefs: true });
    case 'toml':
      return stringifyTOML(obj);
    default:
      throw new Error(`Unsupported config format: ${format}`);
  }
}

/**
 * Sanitize JSONC content: strip // and /* *\/ comments (correctly ignoring
 * comment markers that appear inside string literals, e.g. URLs like
 * "https://api.example.com") and drop trailing commas before } or ] —
 * agents' own tooling (e.g. Pi) writes lenient JSON the strict parser
 * would reject.
 */
function stripJSONCComments(content: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  // Advance past whitespace and comments; stop at the first significant
  // character (a quote stops the scan — it starts a string, not a bracket).
  const nextSignificant = (start: number): number => {
    let i = start;
    while (i < content.length) {
      const c = content[i];
      if (c === '"') break;
      if (c === '/' && content[i + 1] === '/') {
        while (i < content.length && content[i] !== '\n') i++;
        continue;
      }
      if (c === '/' && content[i + 1] === '*') {
        i += 2;
        while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++;
        i++;
        continue;
      }
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        i++;
        continue;
      }
      break;
    }
    return i;
  };

  for (let i = 0; i < content.length; i++) {
    const c = content[i];

    if (inString) {
      out += c;
      if (escaped) {
        escaped = false;
      } else if (c === '\\') {
        escaped = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }

    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }

    // Line comment // ... (outside a string)
    if (c === '/' && content[i + 1] === '/') {
      while (i < content.length && content[i] !== '\n') i++;
      out += '\n';
      continue;
    }

    // Block comment /* ... */
    if (c === '/' && content[i + 1] === '*') {
      i += 2;
      while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i++;
      i++; // Skip the closing '/'
      out += ' ';
      continue;
    }

    // Trailing comma before } or ] (outside a string)
    if (c === ',') {
      const j = nextSignificant(i + 1);
      if (j < content.length && (content[j] === '}' || content[j] === ']')) {
        continue;
      }
    }

    out += c;
  }

  return out;
}

function parseJSONC(content: string): Record<string, unknown> {
  try {
    return JSON.parse(stripJSONCComments(content)) as Record<string, unknown>;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON/JSONC: ${reason}`);
  }
}

function stringifyTOML(obj: unknown): string {
  // Simple TOML stringification
  const lines: string[] = [];
  function stringifyValue(val: unknown): string {
    if (val === null || val === undefined) return '""';
    if (typeof val === 'string') return `"${val.replace(/"/g, '\\"')}"`;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) {
      return `[${val.map(stringifyValue).join(', ')}]`;
    }
    if (typeof val === 'object') {
      return `{ ${Object.entries(val as Record<string, unknown>)
        .map(([k, v]) => `${tomlSegment(k)} = ${stringifyValue(v)}`)
        .join(', ')} }`;
    }
    return String(val);
  }

  // A key segment containing anything other than [A-Za-z0-9_-] must be quoted
  function tomlSegment(key: string): string {
    return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
  }

  // prefix holds already-escaped section path segments, e.g. ["model_providers", "\"my.provider\""]
  function processObject(o: Record<string, unknown>, prefix: string[] = []): void {
    const entries = Object.entries(o);
    // Emit scalar/array values first, then nested-object sections, so sibling
    // keys never land inside a previously-opened section.
    const scalars = entries.filter(([, v]) => !v || typeof v !== 'object' || Array.isArray(v));
    const sections = entries.filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v));
    // Keys inside a section (or at the top level) are written bare
    for (const [key, value] of scalars) {
      lines.push(`${tomlSegment(key)} = ${stringifyValue(value)}`);
    }
    for (const [key, value] of sections) {
      const proto = Object.getPrototypeOf(value);
      if (proto === Object.prototype || proto === null) {
        const segment = tomlSegment(key);
        lines.push(`[${[...prefix, segment].join('.')}]`);
        processObject(value as Record<string, unknown>, [...prefix, segment]);
      } else {
        lines.push(`${tomlSegment(key)} = ${stringifyValue(value)}`);
      }
    }
  }

  if (obj && typeof obj === 'object') {
    processObject(obj as Record<string, unknown>);
  }
  return lines.join('\n');
}

// ============================================================================
// Config Validation
// ============================================================================

export function validateAgentConfig(config: unknown): {
  valid: boolean;
  errors: string[];
  data?: AgentConfig;
} {
  const result = AgentConfigSchema.safeParse(config);
  if (result.success) {
    return { valid: true, errors: [], data: result.data };
  }
  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}

// ============================================================================
// Deep Merge Utility
// ============================================================================

export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target } as Record<string, unknown>;

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (sourceValue === undefined) continue;

    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      result[key] = deepMerge(targetValue as T, sourceValue as Partial<T>) as T[Extract<
        keyof T,
        string
      >];
    } else {
      result[key] = sourceValue;
    }
  }

  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

// ============================================================================
// JSON Schema Generation
// ============================================================================

export function generateJSONSchema(): object {
  // Generate JSON schema for Zod schemas for editor integration
  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: 'AI Agent Config',
    type: 'object',
    properties: {
      version: { type: 'string' },
      lastModified: { type: 'number' },
      modelProviders: { type: 'array', items: { type: 'object' } },
      models: { type: 'array', items: { type: 'object' } },
      mcpServers: { type: 'array', items: { type: 'object' } },
      permissions: { type: 'array', items: { type: 'object' } },
      customSettings: { type: 'object' },
    },
    required: ['version', 'lastModified'],
  };
}
