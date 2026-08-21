/**
 * Adapter exports and factory
 */

export type { AgentAdapter, AgentInfo, AgentCapabilities } from '../types';
export { createClaudeCodeAdapter, ClaudeCodeAdapter } from './claude-code';
export { createCodexAdapter, CodexAdapter } from './codex';
export { createOpenCodeAdapter, createMimoAdapter, OpenCodeStyleAdapter } from './opencode-style';
export { createKiloAdapter } from './kilo';
export { createFreebuffAdapter } from './freebuff';
export { createPiAdapter } from './pi';
export { createJunieAdapter } from './junie';
export { createGeminiAdapter } from './gemini';
export { createOmpAdapter } from './omp';
export { createGenericAdapter, GenericAdapter } from './generic';
export type { GenericAdapterOptions, MCPShape } from './generic';

// Adapter registry
import { createClaudeCodeAdapter } from './claude-code';
import { createCodexAdapter } from './codex';
import { createOpenCodeAdapter, createMimoAdapter } from './opencode-style';
import { createKiloAdapter } from './kilo';
import { createFreebuffAdapter } from './freebuff';
import { createPiAdapter } from './pi';
import { createJunieAdapter } from './junie';
import { createGeminiAdapter } from './gemini';
import { createOmpAdapter } from './omp';
import { AgentAdapter, Platform } from '../types';

/**
 * Every agent CLI the manager understands. Detection of whether a particular
 * CLI is actually installed happens at runtime via AgentInfo.binaries.
 */
const adapters = new Map<string, () => AgentAdapter>([
  // Claude Code CLI ("claude")
  ['claude-code', createClaudeCodeAdapter],
  // OpenAI Codex / ChatGPT CLI ("codex" / "chatgpt")
  ['chatgpt', createCodexAdapter],
  // Gemini CLI ("gemini")
  ['gemini', createGeminiAdapter],
  // Junie CLI ("junie")
  ['junie', createJunieAdapter],
  // FreeBuff CLI ("freebuff")
  ['freebuff', createFreebuffAdapter],
  // Kilo Code CLI ("kilo")
  ['kilo', createKiloAdapter],
  // MIMO CLI ("mimo")
  ['mimo', createMimoAdapter],
  // OMP / Oh My Pi ("omp") — detect-only
  ['omp', createOmpAdapter],
  // OpenCode CLI ("opencode")
  ['opencode', createOpenCodeAdapter],
  // Pi coding agent ("pi")
  ['pi', createPiAdapter],
]);

export function getAdapter(agentId: string): AgentAdapter | null {
  const factory = adapters.get(agentId);
  if (!factory) return null;
  return factory();
}

export function listAvailableAdapters(): AgentAdapter[] {
  return Array.from(adapters.values()).map(f => f());
}

export function getAdapterInfo(agentId: string): AgentAdapter['info'] | null {
  const adapter = getAdapter(agentId);
  return adapter?.info || null;
}

export function registerAdapter(agentId: string, factory: () => AgentAdapter): void {
  adapters.set(agentId, factory);
}

export function resolveConfigPathForAgent(agentId: string, platform?: Platform): string | null {
  const adapter = getAdapter(agentId);
  if (!adapter) return null;
  return adapter.getConfigPath(platform);
}