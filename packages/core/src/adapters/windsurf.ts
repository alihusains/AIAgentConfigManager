/**
 * Windsurf Adapter
 *
 * Windsurf (formerly Codeium; https://windsurf.com) keeps its global MCP
 * config at:
 *   - macOS/Linux: ~/.codeium/windsurf/mcp_config.json
 *   - Windows:     %APPDATA%\Codeium\windsurf\mcp_config.json
 *
 * The file is a keyed `mcpServers` map (the Claude Code convention). Entries
 * use `command`/`args`/`env` for stdio servers or `serverUrl` (NOT `url`) for
 * remote ones — and Windsurf does no env-var interpolation, so values are
 * written verbatim. Models are managed through Windsurf's account, not the
 * config file.
 *
 * This adapter subclasses the generic (keyed) adapter only to map the
 * unified `url` field onto Windsurf's `serverUrl` key on write and accept
 * it on read.
 *
 * Source: https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-windsurf.md
 */

import { GenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter, AgentConfig } from '../types';

const WINDSURF_MCP_PATHS = {
  darwin: '~/.codeium/windsurf/mcp_config.json',
  win32: '%APPDATA%\\Codeium\\windsurf\\mcp_config.json',
  linux: '~/.codeium/windsurf/mcp_config.json',
} as const;

class WindsurfAdapter extends GenericAdapter {
  /**
   * Windsurf spells the remote endpoint `serverUrl`, not `url`. Decode it
   * into the unified `url` field after the base read.
   */
  override async readConfig(): Promise<AgentConfig> {
    const config = await super.readConfig();
    const rawServers = this.rawMcpServers();
    config.mcpServers = config.mcpServers.map((s) => {
      const raw = rawServers[s.name];
      const serverUrl = raw && typeof raw.serverUrl === 'string' ? raw.serverUrl : undefined;
      return { ...s, url: s.url ?? serverUrl };
    });
    return config;
  }

  /**
   * Swap the unified `url` back onto `serverUrl` before the keyed encoder
   * runs (the base encoder merges unknown prior keys, so serverUrl survives).
   */
  override async writeConfig(config: AgentConfig): Promise<void> {
    const servers = config.mcpServers.map((s) =>
      s.type === 'stdio' || s.command ? s : { ...s, serverUrl: s.url }
    );
    await super.writeConfig({ ...config, mcpServers: servers });
  }

  /**
   * Raw keyed `mcpServers` object from disk, populated by the base read.
   * SAFETY: `mcpRawCache` is a private GenericAdapter field with this exact
   * shape — the cast below only bypasses the access modifier, not the type.
   */
  private rawMcpServers(): Record<string, Record<string, unknown>> {
    // SAFETY: same field, only the private modifier is bypassed.
    const raw = (this as unknown as { mcpRawCache: Record<string, unknown> | null }).mcpRawCache;
    const mcp = raw?.mcpServers as Record<string, Record<string, unknown>> | undefined;
    return mcp && typeof mcp === 'object' ? mcp : {};
  }
}

/**
 * Create a Windsurf adapter.
 */
export function createWindsurfAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'windsurf',
    name: 'Windsurf',
    description: 'Windsurf (Cascade) — AI IDE with terminal agent (MCP via mcp_config.json).',
    binaries: ['windsurf'],
    configPath: WINDSURF_MCP_PATHS.darwin,
    configPaths: { ...WINDSURF_MCP_PATHS },
    format: 'json',
    mcpShape: 'keyed',
    modelConfigPaths: {
      darwin: [WINDSURF_MCP_PATHS.darwin],
      win32: [WINDSURF_MCP_PATHS.win32],
      linux: [WINDSURF_MCP_PATHS.linux],
    },
    // Research 2026-09: Windsurf BYOK is UI-only for specific providers —
    // no documented editable config file for a custom OpenAI-compatible base
    // URL. modelProviders stays false.
    supports: {
      modelProviders: false,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };
  return new WindsurfAdapter(options);
}
