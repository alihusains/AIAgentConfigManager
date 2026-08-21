/**
 * Pi Coding Agent Adapter
 *
 * Pi (https://pi.dev, @earendil-works/pi-coding-agent) stores its runtime
 * state under ~/.pi/agent/ (override: $PI_CODING_AGENT_DIR):
 *   - settings.json  app settings (main config; arbitrary keys preserved)
 *   - models.json    provider/model store (managed by Pi's own auth flow)
 *   - mcp.json       MCP servers — written by the pi-mcp-adapter extension:
 *                    { mcpServers: { "<name>": { command, args, env } },
 *                      imports: [...] }
 *
 * MCP servers are NOT a core Pi feature: they arrive via the
 * `pi-mcp-adapter` extension, which reads ~/.pi/agent/mcp.json. This adapter
 * declares that file as its mcpPath so the registry can install/manage MCP
 * servers there while preserving the `imports` key via unknown-key
 * preservation.
 *
 * Providers are managed by Pi's own auth flow (models.json), not by
 * rewriting config files, so supports.modelProviders = false and the
 * provider/model keys are never written into settings.json.
 *
 * Source: https://github.com/earendil-works/pi-coding-agent
 */

import { createGenericAdapter, GenericAdapterOptions } from './generic';
import { AgentAdapter } from '../types';

const PI_PATHS = {
  darwin: '~/.pi/agent',
  win32: '%USERPROFILE%\\.pi\\agent',
  linux: '~/.pi/agent',
} as const;

/**
 * Create a Pi coding agent adapter.
 */
export function createPiAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'pi',
    name: 'Pi',
    description: 'Pi coding agent (earendil-works, pi.dev) — minimal extensible terminal harness.',
    binaries: ['pi'],
    configPath: `${PI_PATHS.darwin}/settings.json`,
    configPaths: {
      darwin: `${PI_PATHS.darwin}/settings.json`,
      win32: `${PI_PATHS.win32}\\settings.json`,
      linux: `${PI_PATHS.linux}/settings.json`,
    },
    mcpPath: `${PI_PATHS.darwin}/mcp.json`,
    mcpConfigPaths: {
      darwin: `${PI_PATHS.darwin}/mcp.json`,
      win32: `${PI_PATHS.win32}\\mcp.json`,
      linux: `${PI_PATHS.linux}/mcp.json`,
    },
    format: 'json',
    // Pi's MCP file is the keyed map written by pi-mcp-adapter
    mcpShape: 'keyed',
    supports: {
      modelProviders: false,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };
  return createGenericAdapter(options);
}