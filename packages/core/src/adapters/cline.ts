/**
 * Cline CLI Adapter
 *
 * Cline (https://docs.cline.bot) ships a standalone terminal CLI (`cline`,
 * npm: `cline`). Its global provider settings live at:
 *   - macOS/Linux: ~/.cline/settings.json
 *   - Windows:     %APPDATA%\Cline\settings.json
 *
 * MCP servers for the CLI live in a SEPARATE global file ~/.cline/mcp.json
 * (keyed `mcpServers` map: { "<name>": { command, args, env } |
 * { type, url, headers } }). This adapter points at settings.json as the main
 * config and at mcp.json as the separate MCP file, so the registry edits
 * mcp.json while preserving settings.json's own keys.
 *
 * Source: https://docs.cline.bot (CLI reference + MCP configuration)
 */

import { createGenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter } from '../types';

const CLINE_CLI_PATHS = {
  darwin: '~/.cline/settings.json',
  win32: '%APPDATA%\\Cline\\settings.json',
  linux: '~/.cline/settings.json',
} as const;

const CLINE_MCP_PATHS = {
  darwin: '~/.cline/mcp.json',
  win32: '%APPDATA%\\Cline\\mcp.json',
  linux: '~/.cline/mcp.json',
} as const;

/**
 * Create a Cline CLI adapter.
 */
export function createClineAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'cline',
    name: 'Cline',
    description: 'Cline — autonomous coding agent CLI (MCP via ~/.cline/mcp.json).',
    binaries: ['cline'],
    configPath: CLINE_CLI_PATHS.darwin,
    configPaths: { ...CLINE_CLI_PATHS },
    mcpPath: CLINE_MCP_PATHS.darwin,
    mcpConfigPaths: { ...CLINE_MCP_PATHS },
    format: 'json',
    mcpShape: 'keyed',
    modelConfigPaths: {
      darwin: [CLINE_CLI_PATHS.darwin],
      win32: [CLINE_CLI_PATHS.win32],
      linux: [CLINE_CLI_PATHS.linux],
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
