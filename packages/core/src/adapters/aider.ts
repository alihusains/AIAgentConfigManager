/**
 * Aider Adapter — detect-only
 *
 * Aider (https://aider.chat) is a Python terminal pair-programmer. Its config
 * is YAML at:
 *   - macOS/Linux/Windows: ~/.aider.conf.yml (home dir; also searched at the
 *     git repo root and cwd, later files overriding earlier ones)
 *
 * Verified against the Aider source and docs (see
 * research/agent-research-aider.md): Aider has NO native MCP support — no
 * mcpServers/.mcp.json handling anywhere in the codebase, no MCP CLI flag,
 * no MCP docs page. Keys are env-var/.env-driven (home → git root → cwd,
 * plus ~/.aider/oauth-keys.env for OpenRouter), not provider objects.
 *
 * So this adapter is detect-only, like OMP:
 *   - binaries: ['aider'] → PATH detection
 *   - readConfig: parses .aider.conf.yml into customSettings (read-only view)
 *   - writeConfig: throws — nothing is materializable
 *
 * Sources: https://aider.chat/docs/config/aider_conf.html +
 * https://github.com/Aider-AI/aider (main.py config search, .env loading)
 */

import type {
  AgentAdapter,
  AgentInfo,
  AgentConfig,
  ModelProvider,
  MCPServerConfig,
  PermissionConfig,
  Platform,
} from '../types';
import { resolveConfigPath, readFileSafe, parseConfig, validateAgentConfig } from '../utils';

const AIDER_CONFIG_PATHS = {
  darwin: '~/.aider.conf.yml',
  win32: '%USERPROFILE%\\.aider.conf.yml',
  linux: '~/.aider.conf.yml',
} as const;

export function createAiderAdapter(): AgentAdapter {
  const info: AgentInfo = {
    id: 'aider',
    name: 'Aider',
    description:
      'Aider — AI pair programming in your terminal (Python). YAML config; no native MCP.',
    configFormat: 'yaml',
    configPaths: { ...AIDER_CONFIG_PATHS } as Record<Platform, string>,
    supports: {
      modelProviders: false,
      mcpServers: false,
      permissions: false,
      projectConfig: false,
    },
    binaries: ['aider'],
    modelConfigPaths: {
      darwin: ['~/.aider.conf.yml'],
      win32: ['%USERPROFILE%\\.aider.conf.yml'],
      linux: ['~/.aider.conf.yml'],
    },
    modelCredentialPaths: {
      darwin: ['~/.aider.conf.yml', '~/.env'],
      win32: ['%USERPROFILE%\\.aider.conf.yml', '%USERPROFILE%\\.env'],
      linux: ['~/.aider.conf.yml', '~/.env'],
    },
  };

  return {
    info,

    getConfigPath(platform: Platform = 'darwin'): string {
      return resolveConfigPath(info.configPaths[platform], platform);
    },

    async readConfig(): Promise<AgentConfig> {
      const configPath = this.getConfigPath();
      const raw = await readFileSafe(configPath);
      const parsed = raw !== null ? parseConfig(raw, 'yaml') : null;
      const config: AgentConfig = {
        version: '1.0.0',
        lastModified: Date.now(),
        modelProviders: [] as ModelProvider[],
        models: [],
        mcpServers: [] as MCPServerConfig[],
        permissions: [] as PermissionConfig[],
        // Aider's YAML is flat scalar options (model, edit-format, alias...)
        // plus per-provider keys — surface it as a read-only customSettings
        // view; the manager never writes back.
        customSettings:
          parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {},
      };
      return config;
    },

    async writeConfig(): Promise<void> {
      throw new Error(
        'Aider has no native MCP support and keeps provider keys in .env files — materialization is not supported for this agent (detect-only).'
      );
    },

    validateConfig(config: unknown): { valid: boolean; errors: string[] } {
      return validateAgentConfig(config);
    },

    getMCPConfigPath(): string | null {
      return null;
    },

    listModelProviders(): ModelProvider[] {
      return [];
    },

    async addModelProvider(): Promise<void> {
      throw new Error('Aider manages provider keys via .env files (detect-only).');
    },

    async removeModelProvider(): Promise<void> {
      throw new Error('Aider manages provider keys via .env files (detect-only).');
    },

    async updateModelProvider(): Promise<void> {
      throw new Error('Aider manages provider keys via .env files (detect-only).');
    },

    listModels() {
      return [];
    },

    async addModel(): Promise<void> {
      throw new Error('Aider does not support model config here (detect-only).');
    },

    async removeModel(): Promise<void> {
      throw new Error('Aider does not support model config here (detect-only).');
    },

    async updateModel(): Promise<void> {
      throw new Error('Aider does not support model config here (detect-only).');
    },

    listMCPServers(): MCPServerConfig[] {
      return [];
    },

    async addMCPServer(): Promise<void> {
      throw new Error('Aider has no native MCP support (detect-only).');
    },

    async removeMCPServer(): Promise<void> {
      throw new Error('Aider has no native MCP support (detect-only).');
    },

    async updateMCPServer(): Promise<void> {
      throw new Error('Aider has no native MCP support (detect-only).');
    },

    listPermissions(): PermissionConfig[] {
      return [];
    },

    async addPermission(): Promise<void> {
      throw new Error('Aider does not support permission rules (detect-only).');
    },

    async removePermission(): Promise<void> {
      throw new Error('Aider does not support permission rules (detect-only).');
    },

    async updatePermission(): Promise<void> {
      throw new Error('Aider does not support permission rules (detect-only).');
    },

    async backupConfig(): Promise<string> {
      throw new Error('Aider is detect-only; backups are not supported.');
    },

    async restoreConfig(): Promise<void> {
      throw new Error('Aider is detect-only; restores are not supported.');
    },
  };
}
