"use strict";
/**
 * Utility functions for file operations, path resolution, and config parsing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHomeDirAsync = getHomeDirAsync;
exports.getCurrentPlatform = getCurrentPlatform;
exports.getEnvironmentInfo = getEnvironmentInfo;
exports.getHomeDir = getHomeDir;
exports.resolveConfigPath = resolveConfigPath;
exports.expandPath = expandPath;
exports.fileExists = fileExists;
exports.readFileSafe = readFileSafe;
exports.writeFileSafe = writeFileSafe;
exports.backupFile = backupFile;
exports.restoreBackup = restoreBackup;
exports.commandExists = commandExists;
exports.getCommandPath = getCommandPath;
exports.runCommand = runCommand;
exports.getCommandVersion = getCommandVersion;
exports.parseConfig = parseConfig;
exports.stringifyConfig = stringifyConfig;
exports.validateAgentConfig = validateAgentConfig;
exports.deepMerge = deepMerge;
exports.generateJSONSchema = generateJSONSchema;
const js_yaml_1 = require("js-yaml");
const toml_1 = require("toml");
const types_1 = require("../types");
const isBrowser = typeof window !== "undefined";
const isNode = typeof process !== "undefined" && process.versions?.node;
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
// ============================================================================
// Dynamic Imports (to avoid bundler issues)
// ============================================================================
let fs = null;
let pathNs = null;
let osNs = null;
let tauriInvoke = null;
let tauriInvokeFailed = false;
async function loadNodeModules() {
    if (!isNode)
        return;
    if (!fs)
        fs = await import("fs/promises");
    if (!pathNs)
        pathNs = await import("path");
    if (!osNs)
        osNs = await import("os");
}
/**
 * Lazy-load the Tauri IPC bridge. Returns null in non-Tauri environments.
 */
function getTauriInvoke() {
    if (tauriInvoke)
        return tauriInvoke;
    if (!isTauri || tauriInvokeFailed)
        return null;
    try {
        if (typeof __TAURI_INVOKE__ === "function") {
            tauriInvoke = __TAURI_INVOKE__;
            return tauriInvoke;
        }
    }
    catch {
        // fall through
    }
    tauriInvokeFailed = true;
    return null;
}
let homeDirCache = null;
/**
 * Resolve the user's home directory in the Tauri webview.
 * Falls back to an empty string when the IPC bridge is unavailable.
 */
async function getHomeDirAsync() {
    if (homeDirCache)
        return homeDirCache;
    const invoke = getTauriInvoke();
    if (invoke) {
        try {
            const dir = await invoke("get_home_dir");
            if (typeof dir === "string" && dir) {
                homeDirCache = dir;
                return dir;
            }
        }
        catch {
            // fall through to empty string
        }
    }
    return "";
}
// ============================================================================
// Platform & Path Utilities
// ============================================================================
function getCurrentPlatform() {
    // Node.js environment (CLI)
    if (isNode && typeof process !== "undefined") {
        const platform = process.platform;
        if (platform === "darwin")
            return "darwin";
        if (platform === "win32")
            return "win32";
        return "linux";
    }
    // Tauri webview: Tauri exposes platform info via IPC; before that resolves,
    // fall back to the user agent detection below.
    // Browser/Tauri fallback - detect from user agent
    if (typeof navigator !== "undefined") {
        const ua = navigator.userAgent;
        if (ua.includes("Mac OS X") || ua.includes("Macintosh"))
            return "darwin";
        if (ua.includes("Windows"))
            return "win32";
        if (ua.includes("Linux"))
            return "linux";
    }
    return "darwin"; // Default fallback
}
/**
 * Safe accessor for platform/arch/runtime info that works in Node, the Tauri
 * webview, and a plain browser (unlike direct `process.*` access).
 */
function getEnvironmentInfo() {
    let platform = getCurrentPlatform();
    let arch = "";
    let nodeVersion = "";
    if (typeof process !== "undefined" && process.versions?.node) {
        arch = process.arch;
        nodeVersion = process.version;
    }
    else if (typeof navigator !== "undefined") {
        const ua = navigator.userAgent;
        if (/arm64|aarch64/i.test(ua))
            arch = "arm64";
        else if (/x64|amd64/i.test(ua))
            arch = "x64";
        nodeVersion = "";
    }
    return { platform, arch, nodeVersion };
}
function getHomeDir() {
    // Node.js environment
    if (isNode && typeof process !== "undefined") {
        return process.env.HOME || process.env.USERPROFILE || "/";
    }
    // Tauri/webview: home dir is resolved lazily via IPC (getHomeDirAsync)
    if (homeDirCache)
        return homeDirCache;
    return "";
}
function resolveConfigPath(template, _platform) {
    const home = getHomeDir();
    // Replace placeholders
    let resolved = template
        .replace("~", home)
        .replace("${HOME}", home)
        .replace("${USERPROFILE}", (typeof process === "undefined" ? "" : process.env.USERPROFILE) || home)
        .replace("%USERPROFILE%", (typeof process === "undefined" ? "" : process.env.USERPROFILE) || home)
        .replace("%APPDATA%", (typeof process === "undefined" ? "" : process.env.APPDATA) || "");
    // Simplified path resolution for browser environment
    if (isBrowser && !isTauri) {
        // In browser, we can't resolve actual paths
        // Return a placeholder that should be handled by the Tauri backend
        if (template.includes("~/.claude/"))
            return "/config/claude/settings.json";
        if (template.includes("%USERPROFILE%"))
            return "C:\\Users\\...\\.claude\\settings.json";
    }
    try {
        if (pathNs) {
            resolved = resolved
                .replace("$XDG_CONFIG_HOME", (typeof process === "undefined" ? "" : process.env.XDG_CONFIG_HOME) ||
                pathNs.join(home, ".config"))
                .replace("$XDG_DATA_HOME", (typeof process === "undefined" ? "" : process.env.XDG_DATA_HOME) ||
                pathNs.join(home, ".local", "share"))
                .replace("$XDG_CACHE_HOME", (typeof process === "undefined" ? "" : process.env.XDG_CACHE_HOME) ||
                pathNs.join(home, ".cache"));
        }
    }
    catch {
        // Path operations not available, use string replacement
    }
    return resolved;
}
function expandPath(filePath) {
    return resolveConfigPath(filePath);
}
// ============================================================================
// File Operations (Node.js + Tauri IPC)
// ============================================================================
async function fileExists(filePath) {
    await loadNodeModules();
    if (isNode && fs) {
        try {
            await fs.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    const invoke = getTauriInvoke();
    if (invoke) {
        try {
            return Boolean(await invoke("file_exists", { path: filePath }));
        }
        catch {
            return false;
        }
    }
    return false;
}
async function readFileSafe(filePath) {
    await loadNodeModules();
    if (isNode && fs) {
        try {
            return await fs.readFile(filePath, "utf-8");
        }
        catch {
            return null;
        }
    }
    const invoke = getTauriInvoke();
    if (invoke) {
        try {
            const content = await invoke("read_file", { path: filePath });
            return typeof content === "string" ? content : null;
        }
        catch {
            return null;
        }
    }
    throw new Error("File system access not available in this environment. Use Tauri IPC or Node.js.");
}
async function writeFileSafe(filePath, content) {
    await loadNodeModules();
    if (isNode && fs) {
        const dir = pathNs ? pathNs.dirname(filePath) : ".";
        if (pathNs)
            await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, content, "utf-8");
        return;
    }
    const invoke = getTauriInvoke();
    if (invoke) {
        await invoke("write_file", { path: filePath, content });
        return;
    }
    throw new Error("File system access not available in this environment. Use Tauri IPC or Node.js.");
}
async function backupFile(filePath) {
    await loadNodeModules();
    if (!fs || !pathNs)
        throw new Error("File system access not available");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = `${filePath}.backup.${timestamp}`;
    const content = await readFileSafe(filePath);
    if (content !== null) {
        await writeFileSafe(backupPath, content);
    }
    return backupPath;
}
async function restoreBackup(backupPath, targetPath) {
    await loadNodeModules();
    if (!fs)
        throw new Error("File system access not available");
    const content = await readFileSafe(backupPath);
    if (content !== null) {
        await writeFileSafe(targetPath, content);
    }
}
let execFile = null;
/**
 * Lazy-load child_process. Only available in Node.js.
 */
async function loadExec() {
    await loadNodeModules();
    if (!isNode || !fs)
        return null;
    if (!execFile) {
        try {
            const cp = await import("node:child_process");
            execFile = cp.execFile;
        }
        catch {
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
async function commandExists(command) {
    return (await getCommandPath(command)) !== null;
}
/**
 * Resolve the absolute path of a CLI binary on PATH, or null when missing.
 */
async function getCommandPath(command) {
    const exec = await loadExec();
    if (exec) {
        try {
            const resolver = getCurrentPlatform() === "win32" ? "where" : "which";
            const result = await runNodeCommand(exec, resolver, [command]);
            const firstLine = result.stdout.split(/\r?\n/)[0].trim();
            return firstLine || null;
        }
        catch {
            return null;
        }
    }
    const invoke = getTauriInvoke();
    if (invoke) {
        try {
            const path = await invoke("resolve_command", { command });
            return typeof path === "string" && path ? path : null;
        }
        catch {
            return null;
        }
    }
    return null; // Plain browser: cannot detect CLI binaries
}
/**
 * Run an external command and capture stdout/stderr. Node.js only.
 */
async function runCommand(command, args = [], timeoutMs = 10000) {
    const exec = await loadExec();
    if (!exec) {
        throw new Error("External commands are not available in this environment");
    }
    return runNodeCommand(exec, command, args, timeoutMs);
}
/**
 * Query an agent CLI's version string (e.g. `claude --version`).
 * Returns null when the CLI cannot be queried.
 */
async function getCommandVersion(command, args = ["--version"]) {
    if (!(await commandExists(command)))
        return null;
    try {
        const result = await runCommand(command, args, 15000);
        const version = (result.stdout || result.stderr).trim().split(/\r?\n/)[0];
        return version || null;
    }
    catch {
        return null;
    }
}
function runNodeCommand(exec, command, args, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        try {
            const child = exec(command, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
                resolve({
                    code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
                    stdout: String(stdout || ""),
                    stderr: String(stderr || ""),
                });
            });
            // Prevent hanging if the process never exits
            child.on("error", (err) => {
                reject(err);
            });
            child.unref?.();
        }
        catch (err) {
            reject(err);
        }
    });
}
// ============================================================================
// Config Parsing
// ============================================================================
function parseConfig(content, format) {
    switch (format) {
        case "json":
        case "jsonc":
            return parseJSONC(content);
        case "yaml":
            return (0, js_yaml_1.load)(content);
        case "toml":
            return (0, toml_1.parse)(content);
        default:
            throw new Error(`Unsupported config format: ${format}`);
    }
}
function stringifyConfig(obj, format) {
    switch (format) {
        case "json":
        case "jsonc":
            return JSON.stringify(obj, null, 2);
        case "yaml":
            return stringifyYAML(obj);
        case "toml":
            return stringifyTOML(obj);
        default:
            throw new Error(`Unsupported config format: ${format}`);
    }
}
/**
 * Strip // and /* *\/ comments from JSONC content, correctly ignoring
 * comment markers that appear inside string literals (e.g. URLs like
 * "https://api.example.com").
 */
function stripJSONCComments(content) {
    let out = "";
    let inString = false;
    let escaped = false;
    for (let i = 0; i < content.length; i++) {
        const c = content[i];
        if (inString) {
            out += c;
            if (escaped) {
                escaped = false;
            }
            else if (c === "\\") {
                escaped = true;
            }
            else if (c === '"') {
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
        if (c === "/" && content[i + 1] === "/") {
            while (i < content.length && content[i] !== "\n")
                i++;
            out += "\n";
            continue;
        }
        // Block comment /* ... */
        if (c === "/" && content[i + 1] === "*") {
            i += 2;
            while (i < content.length && !(content[i] === "*" && content[i + 1] === "/"))
                i++;
            i++; // Skip the closing '/'
            out += " ";
            continue;
        }
        out += c;
    }
    return out;
}
function parseJSONC(content) {
    return JSON.parse(stripJSONCComments(content));
}
function stringifyYAML(obj) {
    // Simple YAML stringification - for production, use js-yaml dump
    const lines = [];
    function stringifyValue(val, indent = 0) {
        const spaces = " ".repeat(indent);
        if (val === null || val === undefined)
            return `${spaces}null`;
        if (typeof val === "string")
            return `${spaces}"${val}"`;
        if (typeof val === "number" || typeof val === "boolean")
            return `${spaces}${val}`;
        if (Array.isArray(val)) {
            if (val.length === 0)
                return `${spaces}[]`;
            return val
                .map((v) => `${spaces}- ${stringifyValue(v).trim()}`)
                .join("\n");
        }
        if (typeof val === "object") {
            const entries = Object.entries(val);
            if (entries.length === 0)
                return `${spaces}{}`;
            return entries
                .map(([k, v]) => `${spaces}${k}: ${stringifyValue(v).trim()}\n`)
                .join("");
        }
        return `${spaces}${String(val)}`;
    }
    return stringifyValue(obj);
}
function stringifyTOML(obj) {
    // Simple TOML stringification
    const lines = [];
    function stringifyValue(val) {
        if (val === null || val === undefined)
            return '""';
        if (typeof val === "string")
            return `"${val.replace(/"/g, '\\"')}"`;
        if (typeof val === "number" || typeof val === "boolean")
            return String(val);
        if (Array.isArray(val)) {
            return `[${val.map(stringifyValue).join(", ")}]`;
        }
        if (typeof val === "object") {
            return `{ ${Object.entries(val)
                .map(([k, v]) => `${tomlSegment(k)} = ${stringifyValue(v)}`)
                .join(", ")} }`;
        }
        return String(val);
    }
    // A key segment containing anything other than [A-Za-z0-9_-] must be quoted
    function tomlSegment(key) {
        return /^[A-Za-z0-9_-]+$/.test(key) ? key : JSON.stringify(key);
    }
    // prefix holds already-escaped section path segments, e.g. ["model_providers", "\"my.provider\""]
    function processObject(o, prefix = []) {
        const entries = Object.entries(o);
        // Emit scalar/array values first, then nested-object sections, so sibling
        // keys never land inside a previously-opened section.
        const scalars = entries.filter(([, v]) => !v || typeof v !== "object" || Array.isArray(v));
        const sections = entries.filter(([, v]) => v && typeof v === "object" && !Array.isArray(v));
        // Keys inside a section (or at the top level) are written bare
        for (const [key, value] of scalars) {
            lines.push(`${tomlSegment(key)} = ${stringifyValue(value)}`);
        }
        for (const [key, value] of sections) {
            const proto = Object.getPrototypeOf(value);
            if (proto === Object.prototype || proto === null) {
                const segment = tomlSegment(key);
                lines.push(`[${[...prefix, segment].join(".")}]`);
                processObject(value, [...prefix, segment]);
            }
            else {
                lines.push(`${tomlSegment(key)} = ${stringifyValue(value)}`);
            }
        }
    }
    if (obj && typeof obj === "object") {
        processObject(obj);
    }
    return lines.join("\n");
}
// ============================================================================
// Config Validation
// ============================================================================
function validateAgentConfig(config) {
    const result = types_1.AgentConfigSchema.safeParse(config);
    if (result.success) {
        return { valid: true, errors: [], data: result.data };
    }
    return {
        valid: false,
        errors: result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
}
// ============================================================================
// Deep Merge Utility
// ============================================================================
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const sourceValue = source[key];
        const targetValue = result[key];
        if (sourceValue === undefined)
            continue;
        if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
            result[key] = deepMerge(targetValue, sourceValue);
        }
        else {
            result[key] = sourceValue;
        }
    }
    return result;
}
function isPlainObject(value) {
    return (value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) === Object.prototype);
}
// ============================================================================
// JSON Schema Generation
// ============================================================================
function generateJSONSchema() {
    // Generate JSON schema for Zod schemas for editor integration
    return {
        $schema: "http://json-schema.org/draft-07/schema#",
        title: "AI Agent Config",
        type: "object",
        properties: {
            version: { type: "string" },
            lastModified: { type: "number" },
            modelProviders: { type: "array", items: { type: "object" } },
            models: { type: "array", items: { type: "object" } },
            mcpServers: { type: "array", items: { type: "object" } },
            permissions: { type: "array", items: { type: "object" } },
            customSettings: { type: "object" },
        },
        required: ["version", "lastModified"],
    };
}
//# sourceMappingURL=index.js.map