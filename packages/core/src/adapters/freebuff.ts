/**
 * FreeBuff CLI Adapter
 *
 * FreeBuff (https://freebuff.com/cli, npm `freebuff`) is a free, ad-supported
 * coding agent CLI built on the Codebuff platform. It stores user config
 * under ~/.config/manicode/ (the 'manicode' name is a Codebuff legacy relic):
 *   - settings.json  user settings: { mode, adsEnabled, freebuffModel, ... }
 *                    (auto-created on first run)
 *   - credentials.json, message-history.json, recent-projects.json, ...
 *
 * MCP servers live in a SEPARATE file, ~/.agents/mcp.json (home/global scope;
 * project-scoped .agents/mcp.json files also exist but are out of scope here),
 * in the standard keyed `mcpServers` shape:
 *   { mcpServers: { '<name>': { command, args, env } } }
 *
 * There is no BYOK / custom-provider surface in the CLI — the model is always
 * one of a small Freebuff-served catalog — so supports.modelProviders = false.
 *
 * Sources: https://github.com/CodebuffAI/codebuff (cli/src/utils/config-dir.ts,
 *          cli/src/utils/settings.ts, sdk/src/agents/load-mcp-config.ts)
 */

import { createGenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter } from '../types';

/**
 * Create a FreeBuff CLI adapter.
 */
export function createFreebuffAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'freebuff',
    name: 'FreeBuff',
    description:
      'FreeBuff CLI — free, ad-supported coding agent built on the Codebuff platform.',
    binaries: ['freebuff'],
    configPath: '~/.config/manicode/settings.json',
    configPaths: {
      darwin: '~/.config/manicode/settings.json',
      win32: '~/.config/manicode/settings.json',
      linux: '~/.config/manicode/settings.json',
    },
    mcpPath: '~/.agents/mcp.json',
    mcpConfigPaths: {
      darwin: '~/.agents/mcp.json',
      win32: '~/.agents/mcp.json',
      linux: '~/.agents/mcp.json',
    },
    format: 'json',
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
