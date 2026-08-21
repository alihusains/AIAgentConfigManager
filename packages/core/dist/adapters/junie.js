"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createJunieAdapter = createJunieAdapter;
const generic_1 = require("./generic");
/**
 * Create a JetBrains Junie CLI adapter.
 */
function createJunieAdapter() {
    const options = {
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
        supports: {
            modelProviders: false,
            mcpServers: true,
            permissions: false,
            projectConfig: false,
        },
    };
    return (0, generic_1.createGenericAdapter)(options);
}
//# sourceMappingURL=junie.js.map