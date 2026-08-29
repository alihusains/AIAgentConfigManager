/**
 * Zed Editor Adapter
 *
 * Zed (https://zed.dev) keeps its user settings at:
 *   - macOS/Linux: ~/.config/zed/settings.json
 *   - Windows:     %APPDATA%\Zed\settings.json
 *
 * MCP servers live INSIDE settings.json under the `context_servers` key as a
 * keyed map (NOT `mcpServers`):
 *
 *   "context_servers": {
 *     "local":  { "command": "some-command", "args": ["arg-1"], "env": {} },
 *     "remote": { "url": "https://example.com/mcp", "headers": { ... } }
 *   }
 *
 * Zed has no per-server enabled flag — a server exists in the map or it does
 * not. This adapter subclasses the generic (keyed) adapter only to alias
 * `context_servers` onto the base adapter's `mcpServers` seam:
 *   - read:  after super.readConfig(), copy context_servers → mcpServers in
 *            mainRawCache so decodeMCPRaw and encodeMCP's merge see it.
 *   - write: after super.writeConfig(), move the encoded mcpServers map back
 *            onto context_servers and rewrite the file.
 * Every other settings.json key is preserved by the base adapter.
 *
 * Source: https://zed.dev/docs/ai/mcp
 */

import { GenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter, AgentConfig } from '../types';
import { writeFileSafe, stringifyConfig } from '../utils';

const ZED_CONFIG_PATHS = {
  darwin: '~/.config/zed/settings.json',
  win32: '%APPDATA%\\Zed\\settings.json',
  linux: '~/.config/zed/settings.json',
} as const;

class ZedAdapter extends GenericAdapter {
  /**
   * After the base read, alias context_servers → mcpServers in mainRawCache
   * so the keyed decoder and the encodeMCP merge both see the right key.
   */
  override async readConfig(): Promise<AgentConfig> {
    const config = await super.readConfig();
    // SAFETY: mainRawCache is a private GenericAdapter field of exactly
    // this type; the cast only bypasses the access modifier, not the type.
    const self = this as unknown as { mainRawCache: Record<string, unknown> | null };
    const main = self.mainRawCache;
    if (main && main.context_servers !== undefined) {
      // The base read decoded mcpServers from main.mcpServers (absent for
      // Zed), so config.mcpServers is stale — re-decode from the alias.
      main.mcpServers = main.context_servers;
      // Re-decode: the base already ran decodeMCPRaw on the (absent)
      // mcpServers key, so we re-decode from the aliased key here.
      config.mcpServers = this.decodeFromRaw(main.context_servers);
    }
    return config;
  }

  /**
   * After the base write, move the encoded mcpServers map back onto
   * context_servers and rewrite the file (the base wrote mcpServers).
   */
  override async writeConfig(config: AgentConfig): Promise<void> {
    await super.writeConfig(config);
    // SAFETY: same private-field access as in readConfig — modifier bypass only.
    const self = this as unknown as { mainRawCache: Record<string, unknown> | null };
    const main = self.mainRawCache;
    if (!main) return;
    if (main.mcpServers !== undefined) {
      main.context_servers = main.mcpServers;
      delete main.mcpServers;
      self.mainRawCache = main;
    }
    // Rewrite the file with context_servers (not mcpServers)
    const filePath = this.getConfigPath();
    await writeFileSafe(filePath, stringifyConfig(main, 'json'));
  }

  /**
   * Decode a keyed MCP map from raw JSON (mirrors the base decodeMCPRaw for
   * the keyed shape). Extracted here so readConfig can re-decode after
   * aliasing context_servers → mcpServers.
   */
  private decodeFromRaw(raw: unknown): AgentConfig['mcpServers'] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const out: AgentConfig['mcpServers'] = [];
    for (const [name, entry] of Object.entries(raw as Record<string, unknown>)) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const e = entry as Record<string, unknown>;
      const command = e.command;
      const isUrl = typeof e.url === 'string';
      out.push({
        name,
        type: isUrl ? 'http' : 'stdio',
        command:
          Array.isArray(command) && typeof command[0] === 'string'
            ? command[0]
            : typeof command === 'string'
              ? command
              : undefined,
        args: Array.isArray(command)
          ? (command.slice(1) as string[])
          : Array.isArray(e.args)
            ? (e.args as string[])
            : undefined,
        env:
          e.env && typeof e.env === 'object' && !Array.isArray(e.env)
            ? (e.env as Record<string, string>)
            : undefined,
        url: typeof e.url === 'string' ? e.url : undefined,
        headers:
          e.headers && typeof e.headers === 'object' && !Array.isArray(e.headers)
            ? (e.headers as Record<string, string>)
            : undefined,
        enabled: e.enabled !== false,
      });
    }
    return out;
  }
}

/**
 * Create a Zed adapter.
 */
export function createZedAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'zed',
    name: 'Zed',
    description:
      'Zed — high-performance editor with a built-in AI agent (MCP via context_servers).',
    binaries: ['zed'],
    configPath: ZED_CONFIG_PATHS.darwin,
    configPaths: { ...ZED_CONFIG_PATHS },
    format: 'json',
    mcpShape: 'keyed',
    modelConfigPaths: {
      darwin: [ZED_CONFIG_PATHS.darwin],
      win32: [ZED_CONFIG_PATHS.win32],
      linux: [ZED_CONFIG_PATHS.linux],
    },
    modelCredentialPaths: {
      darwin: ['~/.local/share/zed/auth.json'],
      win32: ['%APPDATA%\\Zed\\auth.json'],
      linux: ['~/.local/share/zed/auth.json'],
    },
    supports: {
      modelProviders: false,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };
  return new ZedAdapter(options);
}
