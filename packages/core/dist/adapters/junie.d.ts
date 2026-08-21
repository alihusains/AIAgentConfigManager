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
import { AgentAdapter } from '../types';
/**
 * Create a JetBrains Junie CLI adapter.
 */
export declare function createJunieAdapter(): AgentAdapter;
//# sourceMappingURL=junie.d.ts.map