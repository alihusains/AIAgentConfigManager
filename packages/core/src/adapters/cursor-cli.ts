/**
 * Cursor CLI Adapter
 *
 * Cursor's terminal agent (https://cursor.com/docs/cli) keeps its CLI settings
 * at:
 *   - macOS/Linux: ~/.cursor/cli-config.json
 *   - Windows:     %USERPROFILE%\.cursor\cli-config.json
 *
 * MCP servers are NOT in cli-config.json — they live in the editor-shared
 * global file ~/.cursor/mcp.json (keyed `mcpServers` map, the Claude Code
 * convention). This adapter points at cli-config.json as the main config and
 * at ~/.cursor/mcp.json as the separate MCP file, so the registry edits the
 * shared mcp.json while leaving cli-config.json's own keys untouched.
 *
 * Source: https://cursor.com/docs/cli
 */

import { createGenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter } from '../types';

const CURSOR_CLI_PATHS = {
  darwin: '~/.cursor/cli-config.json',
  win32: '%USERPROFILE%\\.cursor\\cli-config.json',
  linux: '~/.cursor/cli-config.json',
} as const;

const CURSOR_MCP_PATHS = {
  darwin: '~/.cursor/mcp.json',
  win32: '%USERPROFILE%\\.cursor\\mcp.json',
  linux: '~/.cursor/mcp.json',
} as const;

/**
 * Create a Cursor CLI adapter.
 */
export function createCursorCliAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'cursor-cli',
    name: 'Cursor CLI',
    description: 'Cursor’s terminal coding agent (shares MCP config with the editor).',
    binaries: ['agent', 'cursor-agent'],
    configPath: CURSOR_CLI_PATHS.darwin,
    configPaths: { ...CURSOR_CLI_PATHS },
    mcpPath: CURSOR_MCP_PATHS.darwin,
    mcpConfigPaths: { ...CURSOR_MCP_PATHS },
    format: 'json',
    mcpShape: 'keyed',
    modelConfigPaths: {
      darwin: [CURSOR_CLI_PATHS.darwin],
      win32: [CURSOR_CLI_PATHS.win32],
      linux: [CURSOR_CLI_PATHS.linux],
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
