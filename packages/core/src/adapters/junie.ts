/**
 * JetBrains Junie CLI Adapter
 *
 * Junie (https://junie.jetbrains.com) stores user-scope config under ~/.junie/:
 *   - config.json    main CLI config (model, provider, byok, brave, hooks, …)
 *   - settings.json  settings
 *   - mcp/mcp.json   user-scope MCP servers:
 *                    { mcpServers: { "<name>": { command, args, env } } }
 *                    (project scope lives at <repo>/.junie/mcp/mcp.json)
 *
 * MCP servers live in a SEPARATE file from the main config, so this adapter
 * uses the generic adapter's configPath + mcpPath mechanism with the
 * keyed-object MCP shape (string command + args array). Junie's BYOK model
 * is single-provider, so supports.modelProviders = false.
 *
 * Sources: https://junie.jetbrains.com/docs/junie-cli-configuration.html
 *          https://junie.jetbrains.com/docs/junie-cli-mcp-configuration.html
 */

import { createGenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter } from '../types';

/**
 * Create a JetBrains Junie CLI adapter.
 */
export function createJunieAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'junie',
    name: 'Junie',
    description: 'JetBrains Junie CLI — coding agent from JetBrains (IDE-independent).',
    binaries: ['junie'],
    configPath: '~/.junie/config.json',
    configPaths: {
      darwin: '~/.junie/config.json',
      win32: '%USERPROFILE%\\.junie\\config.json',
      linux: '~/.junie/config.json',
    },
    mcpPath: '~/.junie/mcp/mcp.json',
    mcpConfigPaths: {
      darwin: '~/.junie/mcp/mcp.json',
      win32: '%USERPROFILE%\\.junie\\mcp\\mcp.json',
      linux: '~/.junie/mcp/mcp.json',
    },
    format: 'json',
    mcpShape: 'keyed',
    // Junie has no user-configurable model provider — the model is fixed
    // by the JetBrains backend. The main config file is still the
    // closest thing to a "model config" surface.
    modelConfigPaths: {
      darwin: ['~/.junie/config.json'],
      win32: ['%USERPROFILE%\\.junie\\config.json'],
      linux: ['~/.junie/config.json'],
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
