"use strict";
/**
 * Adapter exports and factory
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericAdapter = exports.createGenericAdapter = exports.createOmpAdapter = exports.createGeminiAdapter = exports.createJunieAdapter = exports.createPiAdapter = exports.createKiloAdapter = exports.OpenCodeStyleAdapter = exports.createMimoAdapter = exports.createOpenCodeAdapter = exports.CodexAdapter = exports.createCodexAdapter = exports.ClaudeCodeAdapter = exports.createClaudeCodeAdapter = void 0;
exports.getAdapter = getAdapter;
exports.listAvailableAdapters = listAvailableAdapters;
exports.getAdapterInfo = getAdapterInfo;
exports.registerAdapter = registerAdapter;
exports.resolveConfigPathForAgent = resolveConfigPathForAgent;
var claude_code_1 = require("./claude-code");
Object.defineProperty(exports, "createClaudeCodeAdapter", { enumerable: true, get: function () { return claude_code_1.createClaudeCodeAdapter; } });
Object.defineProperty(exports, "ClaudeCodeAdapter", { enumerable: true, get: function () { return claude_code_1.ClaudeCodeAdapter; } });
var codex_1 = require("./codex");
Object.defineProperty(exports, "createCodexAdapter", { enumerable: true, get: function () { return codex_1.createCodexAdapter; } });
Object.defineProperty(exports, "CodexAdapter", { enumerable: true, get: function () { return codex_1.CodexAdapter; } });
var opencode_style_1 = require("./opencode-style");
Object.defineProperty(exports, "createOpenCodeAdapter", { enumerable: true, get: function () { return opencode_style_1.createOpenCodeAdapter; } });
Object.defineProperty(exports, "createMimoAdapter", { enumerable: true, get: function () { return opencode_style_1.createMimoAdapter; } });
Object.defineProperty(exports, "OpenCodeStyleAdapter", { enumerable: true, get: function () { return opencode_style_1.OpenCodeStyleAdapter; } });
var kilo_1 = require("./kilo");
Object.defineProperty(exports, "createKiloAdapter", { enumerable: true, get: function () { return kilo_1.createKiloAdapter; } });
var pi_1 = require("./pi");
Object.defineProperty(exports, "createPiAdapter", { enumerable: true, get: function () { return pi_1.createPiAdapter; } });
var junie_1 = require("./junie");
Object.defineProperty(exports, "createJunieAdapter", { enumerable: true, get: function () { return junie_1.createJunieAdapter; } });
var gemini_1 = require("./gemini");
Object.defineProperty(exports, "createGeminiAdapter", { enumerable: true, get: function () { return gemini_1.createGeminiAdapter; } });
var omp_1 = require("./omp");
Object.defineProperty(exports, "createOmpAdapter", { enumerable: true, get: function () { return omp_1.createOmpAdapter; } });
var generic_1 = require("./generic");
Object.defineProperty(exports, "createGenericAdapter", { enumerable: true, get: function () { return generic_1.createGenericAdapter; } });
Object.defineProperty(exports, "GenericAdapter", { enumerable: true, get: function () { return generic_1.GenericAdapter; } });
// Adapter registry
const claude_code_2 = require("./claude-code");
const codex_2 = require("./codex");
const opencode_style_2 = require("./opencode-style");
const kilo_2 = require("./kilo");
const pi_2 = require("./pi");
const junie_2 = require("./junie");
const gemini_2 = require("./gemini");
const omp_2 = require("./omp");
/**
 * Every agent CLI the manager understands. Detection of whether a particular
 * CLI is actually installed happens at runtime via AgentInfo.binaries.
 */
const adapters = new Map([
    // Claude Code CLI ("claude")
    ['claude-code', claude_code_2.createClaudeCodeAdapter],
    // OpenAI Codex / ChatGPT CLI ("codex" / "chatgpt")
    ['chatgpt', codex_2.createCodexAdapter],
    // Gemini CLI ("gemini")
    ['gemini', gemini_2.createGeminiAdapter],
    // Junie CLI ("junie")
    ['junie', junie_2.createJunieAdapter],
    // Kilo Code CLI ("kilo")
    ['kilo', kilo_2.createKiloAdapter],
    // MIMO CLI ("mimo")
    ['mimo', opencode_style_2.createMimoAdapter],
    // OMP / Oh My Pi ("omp") — detect-only
    ['omp', omp_2.createOmpAdapter],
    // OpenCode CLI ("opencode")
    ['opencode', opencode_style_2.createOpenCodeAdapter],
    // Pi coding agent ("pi")
    ['pi', pi_2.createPiAdapter],
]);
function getAdapter(agentId) {
    const factory = adapters.get(agentId);
    if (!factory)
        return null;
    return factory();
}
function listAvailableAdapters() {
    return Array.from(adapters.values()).map(f => f());
}
function getAdapterInfo(agentId) {
    const adapter = getAdapter(agentId);
    return adapter?.info || null;
}
function registerAdapter(agentId, factory) {
    adapters.set(agentId, factory);
}
function resolveConfigPathForAgent(agentId, platform) {
    const adapter = getAdapter(agentId);
    if (!adapter)
        return null;
    return adapter.getConfigPath(platform);
}
//# sourceMappingURL=index.js.map