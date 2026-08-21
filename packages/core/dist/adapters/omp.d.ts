/**
 * OMP (Oh My Pi) Adapter — detect-only
 *
 * OMP (https://omp.sh, @oh-my-pi/pi-coding-agent) stores config under
 * ~/.omp/agent/:
 *   - config.yml    modelRoles, defaultThinkingLevel, setupVersion
 *   - models.yml    provider/model routing (YAML)
 *   - settings.yml  tool defaults, rules, extensions
 *
 * All three are YAML. The core's unified materializer speaks JSON/JSONC —
 * writing YAML would mangle anchors/comments — and OMP additionally
 * INHERITS rules/skills/MCP servers from other agents' configs on first run.
 * So this adapter is detect-only:
 *   - binaries: ['omp'] → PATH detection
 *   - readConfig: parses config.yml into customSettings (read-only view)
 *   - writeConfig: throws — AgentConfigManager skips materialization when
 *     neither modelProviders nor mcpServers are supported.
 *
 * Source: https://github.com/can1357/oh-my-pi#readme
 */
import { AgentAdapter } from '../types';
export declare function createOmpAdapter(): AgentAdapter;
//# sourceMappingURL=omp.d.ts.map