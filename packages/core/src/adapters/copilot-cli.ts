/**
 * GitHub Copilot CLI Adapter
 *
 * GitHub Copilot CLI (`copilot`, https://github.com/features/copilot) keeps
 * its config in a directory (default `~/.copilot`, overridden by the
 * COPILOT_HOME env var):
 *   - macOS/Linux: ~/.copilot/settings.json   (JSONC — primary user settings)
 *   - Windows:     %USERPROFILE%\.copilot\settings.json
 *
 * MCP servers are NOT in settings.json — they live in the separate
 * ~/.copilot/mcp-config.json file as a keyed `mcpServers` map (the Claude
 * Code convention). This adapter points at settings.json as the main config
 * and mcp-config.json as the separate MCP file, so the registry edits
 * mcp-config.json while leaving settings.json's own keys untouched.
 *
 * Source: https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference
 */

import { createGenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter } from '../types';

const COPILOT_CLI_PATHS = {
  darwin: '~/.copilot/settings.json',
  win32: '%USERPROFILE%\\.copilot\\settings.json',
  linux: '~/.copilot/settings.json',
} as const;

const COPILOT_MCP_PATHS = {
  darwin: '~/.copilot/mcp-config.json',
  win32: '%USERPROFILE%\\.copilot\\mcp-config.json',
  linux: '~/.copilot/mcp-config.json',
} as const;

/**
 * Create a GitHub Copilot CLI adapter.
 */
export function createCopilotCliAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'copilot-cli',
    name: 'GitHub Copilot CLI',
    description: 'GitHub Copilot CLI — agentic coding in the terminal (MCP via mcp-config.json).',
    binaries: ['copilot'],
    configPath: COPILOT_CLI_PATHS.darwin,
    configPaths: { ...COPILOT_CLI_PATHS },
    mcpPath: COPILOT_MCP_PATHS.darwin,
    mcpConfigPaths: { ...COPILOT_MCP_PATHS },
    // settings.json is JSONC (comments allowed); the generic adapter parses
    // both formats with the lenient JSONC reader.
    format: 'jsonc',
    mcpShape: 'keyed',
    modelConfigPaths: {
      darwin: [COPILOT_CLI_PATHS.darwin],
      win32: [COPILOT_CLI_PATHS.win32],
      linux: [COPILOT_CLI_PATHS.linux],
    },
    // Research 2026-09: ~/.copilot/config.json is auto-managed internal
    // state and settings.json has no provider/endpoint keys — models are
    // GitHub-managed. modelProviders stays false.
    supports: {
      modelProviders: false,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };
  return createGenericAdapter(options);
}
