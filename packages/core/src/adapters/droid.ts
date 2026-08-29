/**
 * Droid CLI Adapter (Factory AI)
 *
 * Droid (https://factory.ai) is Factory's terminal coding agent. Its MCP
 * servers live in a dedicated global file:
 *   - macOS/Linux: ~/.factory/mcp.json
 *   - Windows:     %APPDATA%\factory\mcp.json
 *
 * The file uses the keyed `mcpServers` map (string command + separate args,
 * or a url for remote servers). Droid has no separate provider/model settings
 * file that a config manager should rewrite — OAuth tokens live in the OS
 * keyring — so we treat mcp.json as both the main config and the MCP file
 * (same-file keyed mode) and set supports.modelProviders = false.
 *
 * Source: https://factory.ai (Droid CLI docs)
 */

import { createGenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter } from '../types';

const DROID_MCP_PATHS = {
  darwin: '~/.factory/mcp.json',
  win32: '%APPDATA%\\factory\\mcp.json',
  linux: '~/.factory/mcp.json',
} as const;

/**
 * Create a Droid CLI adapter.
 */
export function createDroidAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'droid',
    name: 'Droid',
    description: "Droid — Factory AI's terminal coding agent (MCP via ~/.factory/mcp.json).",
    binaries: ['droid'],
    configPath: DROID_MCP_PATHS.darwin,
    configPaths: { ...DROID_MCP_PATHS },
    format: 'json',
    mcpShape: 'keyed',
    modelConfigPaths: {
      darwin: [DROID_MCP_PATHS.darwin],
      win32: [DROID_MCP_PATHS.win32],
      linux: [DROID_MCP_PATHS.linux],
    },
    supports: {
      modelProviders: false,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };
  return createGenericAdapter(options);
}
