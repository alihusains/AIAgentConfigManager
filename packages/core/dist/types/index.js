"use strict";
/**
 * Core type definitions for AI Agent Config Manager
 * Provides a unified interface for managing configurations across different AI agents
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentConfigSchema = exports.PermissionConfigSchema = exports.MCPServerConfigSchema = exports.ModelConfigSchema = exports.ModelProviderSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// Zod Schemas for Validation
// ============================================================================
exports.ModelProviderSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    type: zod_1.z.enum(['builtin', 'custom', 'openai-compatible', 'anthropic', 'google', 'azure', 'bedrock', 'vertex']),
    config: zod_1.z.record(zod_1.z.unknown()),
    enabled: zod_1.z.boolean(),
    priority: zod_1.z.number().int().min(0),
});
exports.ModelConfigSchema = zod_1.z.object({
    id: zod_1.z.string(),
    providerId: zod_1.z.string(),
    name: zod_1.z.string(),
    displayName: zod_1.z.string(),
    roles: zod_1.z.array(zod_1.z.enum(['chat', 'edit', 'apply', 'summarize', 'autocomplete', 'embed', 'rerank'])),
    contextLength: zod_1.z.number().int().positive().optional(),
    maxTokens: zod_1.z.number().int().positive().optional(),
    temperature: zod_1.z.number().min(0).max(2).optional(),
    topP: zod_1.z.number().min(0).max(1).optional(),
    capabilities: zod_1.z.array(zod_1.z.enum(['tool_use', 'image_input', 'reasoning', 'vision', 'code_generation'])).optional(),
    customOptions: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.MCPServerConfigSchema = zod_1.z.object({
    name: zod_1.z.string(),
    type: zod_1.z.enum(['stdio', 'http', 'sse', 'streamable-http']),
    command: zod_1.z.string().optional(),
    args: zod_1.z.array(zod_1.z.string()).optional(),
    env: zod_1.z.record(zod_1.z.string()).optional(),
    url: zod_1.z.string().url().optional(),
    headers: zod_1.z.record(zod_1.z.string()).optional(),
    cwd: zod_1.z.string().optional(),
    timeout: zod_1.z.number().int().positive().optional(),
    enabled: zod_1.z.boolean(),
    approvalMode: zod_1.z.enum(['prompt', 'auto', 'never']).optional(),
    tools: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.PermissionConfigSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.enum(['tool', 'directory', 'url', 'command', 'mcp', 'custom']),
    scope: zod_1.z.enum(['global', 'project']),
    projectPath: zod_1.z.string().optional(),
    allowed: zod_1.z.boolean(),
    pattern: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
});
exports.AgentConfigSchema = zod_1.z.object({
    version: zod_1.z.string(),
    lastModified: zod_1.z.number(),
    modelProviders: zod_1.z.array(exports.ModelProviderSchema),
    models: zod_1.z.array(exports.ModelConfigSchema),
    mcpServers: zod_1.z.array(exports.MCPServerConfigSchema),
    permissions: zod_1.z.array(exports.PermissionConfigSchema),
    customSettings: zod_1.z.record(zod_1.z.unknown()),
});
//# sourceMappingURL=index.js.map