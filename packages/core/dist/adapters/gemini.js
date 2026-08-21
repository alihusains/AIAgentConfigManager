"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGeminiAdapter = createGeminiAdapter;
const generic_1 = require("./generic");
/**
 * Create a Google Gemini CLI adapter.
 */
function createGeminiAdapter() {
    const options = {
        id: 'gemini',
        name: 'Gemini CLI',
        description: 'Google Gemini CLI — Google\'s terminal coding agent (MCP via settings.json).',
        binaries: ['gemini'],
        configPath: '~/.gemini/settings.json',
        configPaths: {
            darwin: '~/.gemini/settings.json',
            win32: '%USERPROFILE%\\.gemini\\settings.json',
            linux: '~/.gemini/settings.json',
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
    return (0, generic_1.createGenericAdapter)(options);
}
//# sourceMappingURL=gemini.js.map