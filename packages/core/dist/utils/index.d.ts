/**
 * Utility functions for file operations, path resolution, and config parsing
 */
import { type ConfigFormat, type Platform, type AgentConfig } from "../types";
/**
 * Resolve the user's home directory in the Tauri webview.
 * Falls back to an empty string when the IPC bridge is unavailable.
 */
export declare function getHomeDirAsync(): Promise<string>;
export declare function getCurrentPlatform(): Platform;
/**
 * Safe accessor for platform/arch/runtime info that works in Node, the Tauri
 * webview, and a plain browser (unlike direct `process.*` access).
 */
export declare function getEnvironmentInfo(): {
    platform: string;
    arch: string;
    nodeVersion: string;
};
export declare function getHomeDir(): string;
export declare function resolveConfigPath(template: string, _platform?: Platform): string;
export declare function expandPath(filePath: string): string;
export declare function fileExists(filePath: string): Promise<boolean>;
export declare function readFileSafe(filePath: string): Promise<string | null>;
export declare function writeFileSafe(filePath: string, content: string): Promise<void>;
export declare function backupFile(filePath: string): Promise<string>;
export declare function restoreBackup(backupPath: string, targetPath: string): Promise<void>;
type ExecResult = {
    code: number | null;
    stdout: string;
    stderr: string;
};
/**
 * Check whether a CLI binary is available on PATH.
 * Works in Node.js (via `which`/`where`) and in the Tauri webview (via IPC),
 * returns false in a plain browser.
 */
export declare function commandExists(command: string): Promise<boolean>;
/**
 * Resolve the absolute path of a CLI binary on PATH, or null when missing.
 */
export declare function getCommandPath(command: string): Promise<string | null>;
/**
 * Run an external command and capture stdout/stderr. Node.js only.
 */
export declare function runCommand(command: string, args?: string[], timeoutMs?: number): Promise<ExecResult>;
/**
 * Query an agent CLI's version string (e.g. `claude --version`).
 * Returns null when the CLI cannot be queried.
 */
export declare function getCommandVersion(command: string, args?: string[]): Promise<string | null>;
export declare function parseConfig(content: string, format: ConfigFormat): unknown;
export declare function stringifyConfig(obj: unknown, format: ConfigFormat): string;
export declare function validateAgentConfig(config: unknown): {
    valid: boolean;
    errors: string[];
    data?: AgentConfig;
};
export declare function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T;
export declare function generateJSONSchema(): object;
export {};
//# sourceMappingURL=index.d.ts.map