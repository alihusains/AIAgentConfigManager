/**
 * Amazon Q Developer CLI Adapter
 *
 * Amazon Q Developer CLI (`q`, https://aws.amazon.com/q/developer) stores its
 * MCP servers at:
 *   - macOS/Linux: ~/.aws/amazonq/mcp.json
 *   - Windows:     %USERPROFILE%\.aws\amazonq\mcp.json
 *
 * The file is a keyed `mcpServers` map (the Claude Code convention):
 *   { "mcpServers": { "name": { "command", "args"?, "env"? } } }
 * Remote servers use the same map with a `url` entry. Auth is AWS
 * SSO/profile-based (AWS_PROFILE) — there are no provider objects in the
 * config, so this adapter is MCP-only.
 *
 * Source: https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/command-line-mcp-config-CLI.html
 *         + https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.html
 */

import { createGenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter } from '../types';

const AMAZON_Q_MCP_PATHS = {
  darwin: '~/.aws/amazonq/mcp.json',
  win32: '%USERPROFILE%\\.aws\\amazonq\\mcp.json',
  linux: '~/.aws/amazonq/mcp.json',
} as const;

/**
 * Create an Amazon Q Developer CLI adapter.
 */
export function createAmazonQAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'amazonq',
    name: 'Amazon Q Developer CLI',
    description: 'Amazon Q Developer CLI — AWS coding agent (MCP via ~/.aws/amazonq/mcp.json).',
    binaries: ['q', 'amazon-q'],
    configPath: AMAZON_Q_MCP_PATHS.darwin,
    configPaths: { ...AMAZON_Q_MCP_PATHS },
    format: 'json',
    mcpShape: 'keyed',
    modelConfigPaths: {
      darwin: ['~/.aws/amazonq'],
      win32: ['%USERPROFILE%\\.aws\\amazonq'],
      linux: ['~/.aws/amazonq'],
    },
    modelCredentialPaths: {
      darwin: ['~/.aws/amazonq'],
      win32: ['%USERPROFILE%\\.aws\\amazonq'],
      linux: ['~/.aws/amazonq'],
    },
    // Research 2026-09: Amazon Q is Bedrock-hosted only — ~/.aws/amazonq/
    // holds MCP servers and agent definitions (tools/context), not model
    // providers. modelProviders stays false.
    supports: {
      modelProviders: false,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };
  return createGenericAdapter(options);
}
