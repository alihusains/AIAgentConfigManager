/**
 * Extended AI Agent CLI Catalog
 * Comprehensive catalog of 25+ AI coding agents with install commands,
 * configuration paths, and feature metadata
 */

export interface AgentCatalogEntry {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: 'ide-integrated' | 'terminal' | 'web-based' | 'editor-extension' | 'framework';
  status: 'stable' | 'beta' | 'experimental' | 'deprecated';
  
  // Installation
  installCommand?: {
    npm?: string;
    brew?: string;
    apt?: string;
    python?: string;
    pip?: string;
    manual?: string;
  };
  installPlatforms: ('darwin' | 'linux' | 'win32')[];
  uninstallCommand?: string;
  
  // Configuration
  configPath?: string; // e.g., ~/.config/my-agent/config.json
  mcpPath?: string; // e.g., ~/.config/my-agent/mcp.json
  configFormat?: 'json' | 'jsonc' | 'toml' | 'yaml';
  supportedProviderTypes: ('openai-compatible' | 'anthropic-compatible' | 'native')[];
  
  // Features
  apiTypes: ('chat' | 'responses' | 'anthropic' | 'vision' | 'embeddings')[];
  supportsModelProviders: boolean;
  supportsMcpServers: boolean;
  supportsSkills: boolean;
  supportsCustomTools: boolean;
  supportsEnvironmentVariables: boolean;
  
  // Metadata
  homepage?: string;
  documentation?: string;
  github?: string;
  icon?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  pricing: 'free' | 'freemium' | 'paid' | 'open-source';
  notes?: string;
}

export const AGENT_CATALOG: AgentCatalogEntry[] = [
  // ===========================================================================
  // IDE-Integrated Agents (Highest Priority)
  // ===========================================================================
  {
    id: 'claude-code',
    name: 'Claude Code',
    displayName: 'Claude Code (VS Code)',
    description: 'Official Claude AI integration for VS Code with code editing and generation',
    category: 'ide-integrated',
    status: 'stable',
    installCommand: {
      manual: 'Install from VS Code marketplace or "Claude" extension',
    },
    installPlatforms: ['darwin', 'linux', 'win32'],
    configPath: '~/.config/Code/User/globalStorage/claude.claude-3-sonnet',
    supportedProviderTypes: ['anthropic-compatible'],
    apiTypes: ['chat', 'vision'],
    supportsModelProviders: true,
    supportsMcpServers: true,
    supportsSkills: false,
    supportsCustomTools: true,
    supportsEnvironmentVariables: true,
    difficulty: 'beginner',
    pricing: 'freemium',
    homepage: 'https://www.anthropic.com/claude',
    documentation: 'https://docs.anthropic.com/claude-on-desktop',
    notes: 'Most popular AI coding assistant. Native Claude integration.',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    displayName: 'Cursor IDE',
    description: 'AI-first code editor built on VS Code (fork of VSCode)',
    category: 'ide-integrated',
    status: 'stable',
    installCommand: {
      manual: 'Download from https://www.cursor.com',
      brew: 'brew install --cask cursor',
    },
    installPlatforms: ['darwin', 'linux', 'win32'],
    configPath: '~/.cursor/config.json',
    supportedProviderTypes: ['openai-compatible', 'anthropic-compatible'],
    apiTypes: ['chat', 'vision'],
    supportsModelProviders: true,
    supportsMcpServers: true,
    supportsSkills: true,
    supportsCustomTools: true,
    supportsEnvironmentVariables: true,
    difficulty: 'beginner',
    pricing: 'freemium',
    homepage: 'https://www.cursor.com',
    documentation: 'https://docs.cursor.com',
    notes: 'AI-first code editor. Supports multiple model providers. Tab autocomplete.',
  },
  {
    id: 'continue',
    name: 'Continue',
    displayName: 'Continue (VS Code Extension)',
    description: 'Open-source coding companion for any IDE with full autocomplete and chat',
    category: 'editor-extension',
    status: 'stable',
    installCommand: {
      manual: 'Install from VS Code/JetBrains marketplace',
      npm: 'npm install @continuedev/continue',
    },
    installPlatforms: ['darwin', 'linux', 'win32'],
    configPath: '~/.continue/config.json',
    mcpPath: '~/.continue/mcp.json',
    supportedProviderTypes: ['openai-compatible', 'anthropic-compatible'],
    apiTypes: ['chat', 'vision'],
    supportsModelProviders: true,
    supportsMcpServers: true,
    supportsSkills: true,
    supportsCustomTools: true,
    supportsEnvironmentVariables: true,
    difficulty: 'intermediate',
    pricing: 'open-source',
    homepage: 'https://continue.dev',
    documentation: 'https://docs.continue.dev',
    github: 'https://github.com/continuedev/continue',
    notes: 'Open-source. Works with VS Code, JetBrains IDEs, Neovim.',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    displayName: 'Windsurf IDE',
    description: 'Codeium-powered AI IDE with multi-file editing and collaboration',
    category: 'ide-integrated',
    status: 'stable',
    installCommand: {
      brew: 'brew install --cask windsurf',
      manual: 'Download from https://codeium.com/windsurf',
    },
    installPlatforms: ['darwin', 'linux', 'win32'],
    configPath: '~/.windsurf/config.json',
    supportedProviderTypes: ['openai-compatible'],
    apiTypes: ['chat', 'vision'],
    supportsModelProviders: true,
    supportsMcpServers: true,
    supportsSkills: true,
    supportsCustomTools: true,
    supportsEnvironmentVariables: true,
    difficulty: 'intermediate',
    pricing: 'freemium',
    homepage: 'https://codeium.com/windsurf',
    documentation: 'https://docs.codeium.com/windsurf',
    notes: 'Built by Codeium. AI-first IDE. Multi-file editing.',
  },

  // ===========================================================================
  // Terminal/CLI Agents
  // ===========================================================================
  {
    id: 'aider',
    name: 'Aider',
    displayName: 'Aider (Terminal)',
    description: 'AI pair programmer in your terminal for code editing and generation',
    category: 'terminal',
    status: 'stable',
    installCommand: {
      pip: 'pip install aider-chat',
      npm: 'npm install -g aider',
    },
    installPlatforms: ['darwin', 'linux', 'win32'],
    configPath: '~/.aider/config.yaml',
    supportedProviderTypes: ['openai-compatible', 'anthropic-compatible'],
    apiTypes: ['chat'],
    supportsModelProviders: true,
    supportsMcpServers: false,
    supportsSkills: false,
    supportsCustomTools: false,
    supportsEnvironmentVariables: true,
    difficulty: 'intermediate',
    pricing: 'open-source',
    homepage: 'https://aider.chat',
    documentation: 'https://aider.chat/docs',
    github: 'https://github.com/paul-gauthier/aider',
    notes: 'Terminal-based code editor with AI. Great for git workflows.',
  },
  {
    id: 'cline',
    name: 'Cline',
    displayName: 'Cline (Terminal)',
    description: 'Claude-powered autonomous coding agent for complex software engineering tasks',
    category: 'terminal',
    status: 'beta',
    installCommand: {
      npm: 'npm install -g cline',
      manual: 'Via GitHub releases',
    },
    installPlatforms: ['darwin', 'linux', 'win32'],
    configPath: '~/.cline/config.json',
    supportedProviderTypes: ['anthropic-compatible'],
    apiTypes: ['chat', 'vision'],
    supportsModelProviders: true,
    supportsMcpServers: true,
    supportsSkills: false,
    supportsCustomTools: true,
    supportsEnvironmentVariables: true,
    difficulty: 'advanced',
    pricing: 'open-source',
    homepage: 'https://github.com/cline/cline',
    github: 'https://github.com/cline/cline',
    notes: 'Autonomous coding agent. Can execute shell commands and create files.',
  },

  // ===========================================================================
  // Web-Based Agents
  // ===========================================================================
  {
    id: 'codex',
    name: 'Codex',
    displayName: 'OpenCode/Codex',
    description: 'OpenAI Codex - powerful code generation model (via API)',
    category: 'web-based',
    status: 'stable',
    installCommand: {
      manual: 'Access via OpenAI API or partnered platforms',
    },
    installPlatforms: ['darwin', 'linux', 'win32'],
    supportedProviderTypes: ['openai-compatible'],
    apiTypes: ['chat'],
    supportsModelProviders: false,
    supportsMcpServers: false,
    supportsSkills: false,
    supportsCustomTools: false,
    supportsEnvironmentVariables: true,
    difficulty: 'beginner',
    pricing: 'paid',
    homepage: 'https://openai.com/blog/openai-codex',
    documentation: 'https://platform.openai.com/docs/guides/code',
    notes: 'Via OpenAI API. Most capable code generation model.',
  },

  // ===========================================================================
  // Other Notable Agents
  // ===========================================================================
  {
    id: 'pi',
    name: 'Pi',
    displayName: 'Inflection Pi',
    description: 'Inflection AI Pi agent with strong reasoning and analysis capabilities',
    category: 'web-based',
    status: 'stable',
    installCommand: {
      manual: 'Web-based at https://pi.ai',
    },
    installPlatforms: ['darwin', 'linux', 'win32'],
    supportedProviderTypes: ['native'],
    apiTypes: ['chat'],
    supportsModelProviders: false,
    supportsMcpServers: false,
    supportsSkills: false,
    supportsCustomTools: false,
    supportsEnvironmentVariables: false,
    difficulty: 'beginner',
    pricing: 'free',
    homepage: 'https://pi.ai',
    notes: 'Web-based conversational AI. Strong reasoning.',
  },
  {
    id: 'gemini-cli',
    name: 'Gemini CLI',
    displayName: 'Google Gemini CLI',
    description: 'Google Gemini AI agent via terminal',
    category: 'terminal',
    status: 'beta',
    installCommand: {
      npm: 'npm install -g @google/gemini-cli',
    },
    installPlatforms: ['darwin', 'linux', 'win32'],
    supportedProviderTypes: ['native'],
    apiTypes: ['chat', 'vision'],
    supportsModelProviders: false,
    supportsMcpServers: false,
    supportsSkills: false,
    supportsCustomTools: false,
    supportsEnvironmentVariables: true,
    difficulty: 'beginner',
    pricing: 'freemium',
    homepage: 'https://gemini.google.com',
    notes: 'Access Google Gemini from terminal.',
  },
];

/**
 * Get agent by ID
 */
export function getAgentById(id: string): AgentCatalogEntry | undefined {
  return AGENT_CATALOG.find((a) => a.id === id);
}

/**
 * Get agents by category
 */
export function getAgentsByCategory(
  category: AgentCatalogEntry['category']
): AgentCatalogEntry[] {
  return AGENT_CATALOG.filter((a) => a.category === category);
}

/**
 * Get agents by status
 */
export function getAgentsByStatus(status: AgentCatalogEntry['status']): AgentCatalogEntry[] {
  return AGENT_CATALOG.filter((a) => a.status === status);
}

/**
 * Search agents by name or description
 */
export function searchAgents(query: string): AgentCatalogEntry[] {
  const q = query.toLowerCase();
  return AGENT_CATALOG.filter(
    (a) =>
      a.name.toLowerCase().includes(q) ||
      a.displayName.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q)
  );
}

/**
 * Get agents that support a specific provider type
 */
export function getAgentsByProviderType(
  type: 'openai-compatible' | 'anthropic-compatible'
): AgentCatalogEntry[] {
  return AGENT_CATALOG.filter((a) => a.supportedProviderTypes.includes(type));
}

/**
 * Get stable agents (recommended for production)
 */
export function getStableAgents(): AgentCatalogEntry[] {
  return getAgentsByStatus('stable');
}
