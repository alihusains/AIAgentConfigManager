/**
 * Qwen Code Adapter
 *
 * Qwen Code (https://github.com/QwenLM/qwen-code) is Alibaba's terminal coding
 * agent. Its global config is at:
 *   - macOS/Linux: ~/.qwen/settings.json
 *   - Windows:     %APPDATA%\qwen\settings.json
 *
 * MCP servers live INSIDE settings.json under the `mcpServers` key as a keyed
 * object map (standard mcpServers shape). Provider API keys are supplied via
 * environment variables, so supports.modelProviders = false and settings.json
 * is never polluted with provider/model keys.
 *
 * Source: https://github.com/QwenLM/qwen-code (settings.json reference)
 */

import { createGenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter } from '../types';

const QWEN_PATHS = {
  darwin: '~/.qwen/settings.json',
  win32: '%APPDATA%\\qwen\\settings.json',
  linux: '~/.qwen/settings.json',
} as const;

/**
 * Create a Qwen Code adapter.
 */
export function createQwenAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'qwen',
    name: 'Qwen Code',
    description: "Qwen Code — Alibaba's terminal coding agent (MCP via settings.json).",
    binaries: ['qwen'],
    configPath: QWEN_PATHS.darwin,
    configPaths: {
      darwin: QWEN_PATHS.darwin,
      win32: QWEN_PATHS.win32,
      linux: QWEN_PATHS.linux,
    },
    format: 'json',
    mcpShape: 'keyed',
    modelConfigPaths: {
      darwin: [QWEN_PATHS.darwin],
      win32: [QWEN_PATHS.win32],
      linux: [QWEN_PATHS.linux],
    },
    modelCredentialPaths: {
      darwin: ['~/.qwen/mcp-oauth-tokens.json'],
      win32: ['%APPDATA%\\qwen\\mcp-oauth-tokens.json'],
      linux: ['~/.qwen/mcp-oauth-tokens.json'],
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
