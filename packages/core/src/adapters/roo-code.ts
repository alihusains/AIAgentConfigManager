/**
 * Roo Code Adapter (Cline fork)
 *
 * Roo Code (https://roocode.com) is a Cline fork. It does NOT share Cline's
 * CLI config layout — verified against the Roo-Code source:
 *
 *   - Global MCP file: `mcp_settings.json` (GlobalFileNames.mcpSettings), a
 *     keyed `mcpServers` map identical in spirit to Cline's mcp.json.
 *     - VS Code extension: <globalStorage>/RooVeterinaryInc.roo-cline/
 *       mcp_settings.json
 *     - Standalone CLI (apps/cli): the vscode-shim writes global state to
 *       ~/.vscode-mock/global-storage/, so the file resolves to
 *       ~/.vscode-mock/global-storage/mcp_settings.json
 *   - CLI settings (onboarding, provider choice): ~/.roo/cli-settings.json
 *
 * On-disk server shape (McpHub.ts ServerConfigSchema):
 *   stdio:   { type: "stdio", command, args?, env?, cwd? }
 *   remote:  { type: "sse" | "streamable-http", url, headers? }
 *   plus    { disabled?, timeout?, alwaysAllow?, disabledTools?, watchPaths? }
 *
 * The generic keyed adapter covers this shape directly (string command +
 * args[], url/headers for remote, unknown per-server keys preserved on
 * merge).
 *
 * Sources:
 *   https://github.com/RooCodeInc/Roo-Code (src/services/mcp/McpHub.ts,
 *   src/shared/globalFileNames.ts, apps/cli/src/lib/storage/,
 *   packages/vscode-shim/src/context/ExtensionContext.ts)
 */

import { createGenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter } from '../types';

const ROO_MCP_PATHS = {
  darwin: '~/.vscode-mock/global-storage/mcp_settings.json',
  win32: '%USERPROFILE%\\.vscode-mock\\global-storage\\mcp_settings.json',
  linux: '~/.vscode-mock/global-storage/mcp_settings.json',
} as const;

const ROO_CLI_SETTINGS_PATHS = {
  darwin: '~/.roo/cli-settings.json',
  win32: '%APPDATA%\\Roo\\cli-settings.json',
  linux: '~/.roo/cli-settings.json',
} as const;

/**
 * Create a Roo Code adapter.
 */
export function createRooCodeAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'roo',
    name: 'Roo Code',
    description:
      'Roo Code — open-source autonomous coding agent (Cline fork; MCP via mcp_settings.json).',
    binaries: ['roo', 'roo-code'],
    // Main config = the CLI settings file (kept untouched; models are managed
    // through Roo's own provider flows, so no provider keys are written here).
    configPath: ROO_CLI_SETTINGS_PATHS.darwin,
    configPaths: { ...ROO_CLI_SETTINGS_PATHS },
    mcpPath: ROO_MCP_PATHS.darwin,
    mcpConfigPaths: { ...ROO_MCP_PATHS },
    format: 'json',
    mcpShape: 'keyed',
    modelConfigPaths: {
      darwin: [ROO_CLI_SETTINGS_PATHS.darwin],
      win32: [ROO_CLI_SETTINGS_PATHS.win32],
      linux: [ROO_CLI_SETTINGS_PATHS.linux],
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
