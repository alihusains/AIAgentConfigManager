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
import { AgentAdapter } from '../types';
/**
 * Create a Pi coding agent adapter.
 */
export declare function createPiAdapter(): AgentAdapter;
//# sourceMappingURL=pi.d.ts.map