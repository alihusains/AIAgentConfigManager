/**
 * Adapter exports and factory
 */
export type { AgentAdapter, AgentInfo, AgentCapabilities } from '../types';
export { createClaudeCodeAdapter, ClaudeCodeAdapter } from './claude-code';
export { createCodexAdapter, CodexAdapter } from './codex';
export { createOpenCodeAdapter, createMimoAdapter, OpenCodeStyleAdapter } from './opencode-style';
export { createKiloAdapter } from './kilo';
export { createPiAdapter } from './pi';
export { createJunieAdapter } from './junie';
export { createGeminiAdapter } from './gemini';
export { createOmpAdapter } from './omp';
export { createGenericAdapter, GenericAdapter } from './generic';
export type { GenericAdapterOptions, MCPShape } from './generic';
import { AgentAdapter, Platform } from '../types';
export declare function getAdapter(agentId: string): AgentAdapter | null;
export declare function listAvailableAdapters(): AgentAdapter[];
export declare function getAdapterInfo(agentId: string): AgentAdapter['info'] | null;
export declare function registerAdapter(agentId: string, factory: () => AgentAdapter): void;
export declare function resolveConfigPathForAgent(agentId: string, platform?: Platform): string | null;
//# sourceMappingURL=index.d.ts.map