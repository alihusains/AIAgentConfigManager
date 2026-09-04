/**
 * Google Gemini CLI Adapter
 *
 * Gemini CLI (https://github.com/google-gemini/gemini-cli) stores its global
 * config at:
 *   - macOS/Linux: ~/.gemini/settings.json
 *   - Windows:     %USERPROFILE%\.gemini\settings.json
 *
 * MCP servers live INSIDE settings.json under the `mcpServers` key as a
 * keyed object map with STRING commands + separate args arrays (verified
 * locally: { "codegraph": { "type": "stdio", "command": "codegraph",
 * "args": ["serve", "--mcp"] } }).
 *
 * This adapter uses the generic adapter with NO mcpPath — same-file mode —
 * and the keyed MCP shape, so the registry installs MCP servers directly
 * into settings.json while every other key is preserved. Providers are
 * configured via the Google account/auth flow, so supports.modelProviders =
 * false and settings.json is never polluted with provider/model keys.
 *
 * Source: https://github.com/google-gemini/gemini-cli (settings.json reference)
 */

import { createGenericAdapter, type GenericAdapterOptions } from './generic';
import type { AgentAdapter } from '../types';

/**
 * Create a Google Gemini CLI adapter.
 */
export function createGeminiAdapter(): AgentAdapter {
  const options: GenericAdapterOptions = {
    id: 'gemini',
    name: 'Gemini CLI',
    description: "Google Gemini CLI — Google's terminal coding agent (MCP via settings.json).",
    binaries: ['gemini', 'gemini-cli'],
    configPath: '~/.gemini/settings.json',
    configPaths: {
      darwin: '~/.gemini/settings.json',
      win32: '%USERPROFILE%\\.gemini\\settings.json',
      linux: '~/.gemini/settings.json',
    },
    format: 'json',
    mcpShape: 'keyed',
    modelConfigPaths: {
      darwin: ['~/.gemini/settings.json'],
      win32: ['%USERPROFILE%\\.gemini\\settings.json'],
      linux: ['~/.gemini/settings.json'],
    },
    // Research 2026-09: Gemini CLI has NO custom OpenAI-compatible provider
    // support — settings.json has no baseUrl key of any kind; the only endpoint
    // override (GOOGLE_GEMINI_BASE_URL) speaks the Google GenAI protocol, not
    // OpenAI-compatible (GitHub issue #15430 confirms it fails for Ollama-style
    // endpoints). modelProviders stays false.
    supports: {
      modelProviders: false,
      mcpServers: true,
      permissions: false,
      projectConfig: false,
    },
  };
  return createGenericAdapter(options);
}
