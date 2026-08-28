/**
 * Adapter exports and factory
 */

export type { AgentAdapter, AgentInfo, AgentCapabilities } from '../types';
export { createClaudeCodeAdapter, ClaudeCodeAdapter } from './claude-code';
export { createCodexAdapter, CodexAdapter } from './codex';
export {
  createOpenCodeAdapter,
  createMimoAdapter,
  OpenCodeStyleAdapter,
} from './opencode-style';
export { createKiloAdapter } from './kilo';
export { createFreebuffAdapter } from './freebuff';
export { createPiAdapter } from './pi';
export { createJunieAdapter } from './junie';
export { createGeminiAdapter } from './gemini';
export { createOmpAdapter } from './omp';
export { createGenericAdapter, GenericAdapter } from './generic';
export type { GenericAdapterOptions, MCPShape } from './generic';
export { createKimiAdapter, KimiAdapter } from './kimi';
export { createQwenAdapter } from './qwen';
export { createCursorCliAdapter } from './cursor-cli';
export { createClineAdapter } from './cline';
export { createDroidAdapter } from './droid';
export { createGooseAdapter, GooseAdapter } from './goose';
export { createContinueAdapter, ContinueAdapter } from './continue';
export { createCrushAdapter, CrushAdapter } from './crush';
export { createWindsurfAdapter } from './windsurf';
export { createRooCodeAdapter } from './roo-code';

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
import { createKimiAdapter } from './kimi';
import { createQwenAdapter } from './qwen';
import { createCursorCliAdapter } from './cursor-cli';
import { createClineAdapter } from './cline';
import { createDroidAdapter } from './droid';
import { createGooseAdapter } from './goose';
import { createContinueAdapter } from './continue';
import { createCrushAdapter } from './crush';
import { createWindsurfAdapter } from './windsurf';
import { createRooCodeAdapter } from './roo-code';
import type { AgentAdapter, Platform } from '../types';

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
  // Kimi Code (Moonshot) ("kimi")
  ['kimi', createKimiAdapter],
  // Qwen Code (Alibaba) ("qwen")
  ['qwen', createQwenAdapter],
  // Cursor CLI ("agent" / "cursor-agent")
  ['cursor-cli', createCursorCliAdapter],
  // Cline CLI ("cline")
  ['cline', createClineAdapter],
  // Droid (Factory AI) ("droid")
  ['droid', createDroidAdapter],
  // Goose (Block/AAIF) ("goose")
  ['goose', createGooseAdapter],
  // Continue.dev ("continue")
  ['continue', createContinueAdapter],
  // Crush (Charm) ("crush")
  ['crush', createCrushAdapter],
  // Windsurf (Cascade) ("windsurf")
  ['windsurf', createWindsurfAdapter],
  // Roo Code (Cline fork) ("roo")
  ['roo', createRooCodeAdapter],
]);

export function getAdapter(agentId: string): AgentAdapter | null {
  const factory = adapters.get(agentId);
  if (!factory) return null;
  return factory();
}

export function listAvailableAdapters(): AgentAdapter[] {
  return Array.from(adapters.values()).map((f) => f());
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
