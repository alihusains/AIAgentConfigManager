/**
 * OMP (Oh My Pi) Adapter — detect-only
 *
 * OMP (https://omp.sh, @oh-my-pi/pi-coding-agent) stores config under
 * ~/.omp/agent/:
 *   - config.yml    modelRoles, defaultThinkingLevel, setupVersion
 *   - models.yml    provider/model routing (YAML)
 *   - settings.yml  tool defaults, rules, extensions
 *
 * All three are YAML. The core's unified materializer speaks JSON/JSONC —
 * writing YAML would mangle anchors/comments — and OMP additionally
 * INHERITS rules/skills/MCP servers from other agents' configs on first run.
 * So this adapter is detect-only:
 *   - binaries: ['omp'] → PATH detection
 *   - readConfig: parses config.yml into customSettings (read-only view)
 *   - writeConfig: throws — AgentConfigManager skips materialization when
 *     neither modelProviders nor mcpServers are supported.
 *
 * Source: https://github.com/can1357/oh-my-pi#readme
 */

import {
  AgentAdapter,
  AgentInfo,
  AgentConfig,
  ModelProvider,
  MCPServerConfig,
  PermissionConfig,
  Platform,
} from '../types';
import { resolveConfigPath, readFileSafe, parseConfig, validateAgentConfig } from '../utils';

const OMP_CONFIG_PATHS = {
  darwin: '~/.omp/agent/config.yml',
  win32: '%USERPROFILE%\\.omp\\agent\\config.yml',
  linux: '~/.omp/agent/config.yml',
} as const;

export function createOmpAdapter(): AgentAdapter {
  const info: AgentInfo = {
    id: 'omp',
    name: 'OMP (Oh My Pi)',
    description: 'OMP (Oh My Pi) — battery-included Pi fork (Rust core); YAML config, MCP inherited from other agents.',
    configFormat: 'yaml',
    configPaths: { ...OMP_CONFIG_PATHS } as Record<Platform, string>,
    supports: {
      modelProviders: false,
      mcpServers: false,
      permissions: false,
      projectConfig: false,
    },
    binaries: ['omp'],
  };

  return {
    info,

    getConfigPath(platform: Platform = 'darwin'): string {
      return resolveConfigPath(info.configPaths[platform], platform);
    },

    async readConfig(): Promise<AgentConfig> {
      const configPath = this.getConfigPath();
      const raw = await readFileSafe(configPath);
      if (raw === null) {
        return {
          version: '1.0.0',
          lastModified: Date.now(),
          modelProviders: [] as ModelProvider[],
          models: [],
          mcpServers: [] as MCPServerConfig[],
          permissions: [] as PermissionConfig[],
          customSettings: {},
        };
      }
      const parsed = parseConfig(raw, 'yaml');
      const config: AgentConfig = {
        version: '1.0.0',
        lastModified: Date.now(),
        modelProviders: [] as ModelProvider[],
        models: [],
        mcpServers: [] as MCPServerConfig[],
        permissions: [] as PermissionConfig[],
        customSettings: parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {},
      };
      const validation = validateAgentConfig(config);
      if (!validation.valid) {
        // YAML config.yml is not the unified schema — never fail reads
        // because of shape drift; surface the config as-is.
        return config;
      }
      return validation.data || config;
    },

    async writeConfig(): Promise<void> {
      throw new Error(
        'OMP stores YAML config and inherits MCP servers from other agents — materialization is not supported for this agent (detect-only).',
      );
    },

    validateConfig(config: unknown): { valid: boolean; errors: string[] } {
      return validateAgentConfig(config);
    },

    // No managed content for this agent: every operation is a no-op with a
    // clear error, and the manager filters by supports.* before calling.

    listModelProviders(): ModelProvider[] {
      return [];
    },

    async addModelProvider(): Promise<void> {
      throw new Error('OMP does not support model provider config (detect-only).');
    },

    async removeModelProvider(): Promise<void> {
      throw new Error('OMP does not support model provider config (detect-only).');
    },

    async updateModelProvider(): Promise<void> {
      throw new Error('OMP does not support model provider config (detect-only).');
    },

    listModels() {
      return [];
    },

    async addModel(): Promise<void> {
      throw new Error('OMP does not support model config (detect-only).');
    },

    async removeModel(): Promise<void> {
      throw new Error('OMP does not support model config (detect-only).');
    },

    async updateModel(): Promise<void> {
      throw new Error('OMP does not support model config (detect-only).');
    },

    listMCPServers(): MCPServerConfig[] {
      return [];
    },

    async addMCPServer(): Promise<void> {
      throw new Error('OMP inherits MCP servers from other agents (detect-only).');
    },

    async removeMCPServer(): Promise<void> {
      throw new Error('OMP inherits MCP servers from other agents (detect-only).');
    },

    async updateMCPServer(): Promise<void> {
      throw new Error('OMP inherits MCP servers from other agents (detect-only).');
    },

    listPermissions(): PermissionConfig[] {
      return [];
    },

    async addPermission(): Promise<void> {
      throw new Error('OMP does not support permission rules (detect-only).');
    },

    async removePermission(): Promise<void> {
      throw new Error('OMP does not support permission rules (detect-only).');
    },

    async updatePermission(): Promise<void> {
      throw new Error('OMP does not support permission rules (detect-only).');
    },

    async backupConfig(): Promise<string> {
      throw new Error('OMP is detect-only; backups are not supported.');
    },

    async restoreConfig(): Promise<void> {
      throw new Error('OMP is detect-only; restores are not supported.');
    },
  };
}