/**
 * OMP (Oh My Pi) Adapter — detect-only
 *
 * OMP (https://github.com/can1357/oh-my-pi) is the Pi fork with a Rust core
 * + Bun runtime. It stores its config under ~/.omp/agent/ as three files:
 *
 *   - config.yml   app settings (main config)
 *   - models.yml   provider/model store (YAML)
 *   - mcp.json     MCP servers (JSON)
 *
 * This adapter is DETECT-ONLY: it can discover whether OMP is installed and
 * where its config lives, but does NOT read/write the config files. The
 * unified AgentAdapter interface's model/provider/MCP/permission operations
 * are not supported for OMP because:
 *
 *   1. OMP's models.yml uses a provider-keyed YAML structure that doesn't map
 *      cleanly onto the flat ModelConfig[] + ModelProvider[] unified schema
 *      without lossy round-trips.
 *   2. OMP's permission model (tools.approval + tools.tools + bash.patterns)
 *      has no equivalent in the unified PermissionConfig schema.
 *   3. OMP imports MCP servers from other agents' configs with complex
 *      precedence rules, making the mcp.json file a partial view.
 *
 * Full read/write support is deferred. See agent-catalog.json note.
 */

import type {
  AgentAdapter,
  AgentInfo,
  AgentConfig,
  ModelProvider,
  ModelConfig,
  MCPServerConfig,
  PermissionConfig,
  Platform,
} from '../types';
import { resolveConfigPath, backupFile, restoreBackup, fileExists } from '../utils';

const OMP_CONFIG_PATHS: Record<Platform, string> = {
  darwin: '~/.omp/agent/config.yml',
  win32: '%USERPROFILE%\\.omp\\agent\\config.yml',
  linux: '~/.omp/agent/config.yml',
};

const OMP_MCP_PATHS: Record<Platform, string> = {
  darwin: '~/.omp/agent/mcp.json',
  win32: '%USERPROFILE%\\.omp\\agent\\mcp.json',
  linux: '~/.omp/agent/mcp.json',
};

class OMPAdapter implements AgentAdapter {
  readonly info: AgentInfo;

  constructor() {
    this.info = {
      id: 'omp',
      name: 'OMP (Oh My Pi)',
      description:
        'Oh My Pi (omp) — Pi fork with a Rust core + Bun runtime. Detect-only: config read/write not yet supported.',
      configFormat: 'yaml',
      configPaths: OMP_CONFIG_PATHS,
      supports: {
        modelProviders: false,
        mcpServers: false,
        permissions: false,
        projectConfig: false,
      },
      binaries: ['omp'],
      mcpConfigPaths: OMP_MCP_PATHS,
      modelConfigPaths: {
        darwin: [`${OMP_CONFIG_PATHS.darwin}`, '~/.omp/agent/models.yml'],
        win32: [`${OMP_CONFIG_PATHS.win32}`, '%USERPROFILE%\\.omp\\agent\\models.yml'],
        linux: [`${OMP_CONFIG_PATHS.linux}`, '~/.omp/agent/models.yml'],
      },
      versionArgs: ['--version'],
    };
  }

  private detectPlatform(): Platform {
    if (typeof process !== 'undefined' && process.platform) {
      const p = process.platform;
      if (p === 'darwin') return 'darwin';
      if (p === 'win32') return 'win32';
      return 'linux';
    }
    return 'darwin';
  }

  getConfigPath(platform?: Platform): string {
    const current = platform || this.detectPlatform();
    const template = OMP_CONFIG_PATHS[current] || OMP_CONFIG_PATHS.darwin;
    return resolveConfigPath(template, current);
  }

  getMCPConfigPath(platform?: Platform): string | null {
    const current = platform || this.detectPlatform();
    const template = OMP_MCP_PATHS[current] || OMP_MCP_PATHS.darwin;
    return resolveConfigPath(template, current);
  }

  async readConfig(): Promise<AgentConfig> {
    // Detect-only: return an empty config. OMP's file formats don't map
    // cleanly onto the unified schema without lossy round-trips.
    return {
      version: '1.0.0',
      lastModified: Date.now(),
      modelProviders: [],
      models: [],
      mcpServers: [],
      permissions: [],
      customSettings: {},
    };
  }

  async writeConfig(_config: AgentConfig): Promise<void> {
    throw new Error('OMP does not support config write (detect-only adapter)');
  }

  validateConfig(_config: unknown): { valid: boolean; errors: string[] } {
    return { valid: false, errors: ['OMP is detect-only; config validation not supported'] };
  }

  listModelProviders(): ModelProvider[] {
    return [];
  }

  async addModelProvider(_provider: ModelProvider): Promise<void> {
    throw new Error('OMP does not support model provider config (detect-only)');
  }

  async removeModelProvider(_providerId: string): Promise<void> {
    throw new Error('OMP does not support model provider config (detect-only)');
  }

  async updateModelProvider(
    _providerId: string,
    _updates: Partial<ModelProvider>
  ): Promise<void> {
    throw new Error('OMP does not support model provider config (detect-only)');
  }

  listModels(): ModelConfig[] {
    return [];
  }

  async addModel(_model: ModelConfig): Promise<void> {
    throw new Error('OMP does not support model config (detect-only)');
  }

  async removeModel(_modelId: string): Promise<void> {
    throw new Error('OMP does not support model config (detect-only)');
  }

  async updateModel(_modelId: string, _updates: Partial<ModelConfig>): Promise<void> {
    throw new Error('OMP does not support model config (detect-only)');
  }

  listMCPServers(): MCPServerConfig[] {
    return [];
  }

  async addMCPServer(_server: MCPServerConfig): Promise<void> {
    throw new Error('OMP does not support MCP server config (detect-only)');
  }

  async removeMCPServer(_serverName: string): Promise<void> {
    throw new Error('OMP does not support MCP server config (detect-only)');
  }

  async updateMCPServer(
    _serverName: string,
    _updates: Partial<MCPServerConfig>
  ): Promise<void> {
    throw new Error('OMP does not support MCP server config (detect-only)');
  }

  listPermissions(): PermissionConfig[] {
    return [];
  }

  async addPermission(_permission: PermissionConfig): Promise<void> {
    throw new Error('OMP does not support permission config (detect-only)');
  }

  async removePermission(_permissionId: string): Promise<void> {
    throw new Error('OMP does not support permission config (detect-only)');
  }

  async updatePermission(
    _permissionId: string,
    _updates: Partial<PermissionConfig>
  ): Promise<void> {
    throw new Error('OMP does not support permission config (detect-only)');
  }

  async backupConfig(): Promise<string> {
    const configPath = this.getConfigPath();
    if (!(await fileExists(configPath))) {
      throw new Error('No OMP config file found to back up');
    }
    return backupFile(configPath);
  }

  async restoreConfig(backupPath: string): Promise<void> {
    const configPath = this.getConfigPath();
    await restoreBackup(backupPath, configPath);
  }
}

export function createOmpAdapter(): AgentAdapter {
  return new OMPAdapter();
}
