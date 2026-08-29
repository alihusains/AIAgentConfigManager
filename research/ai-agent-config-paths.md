# AI Agent Configuration Paths Research

**Date**: 2026-08-19  
**Purpose**: Identify configuration file paths and formats for popular AI coding agents to build a unified Config Manager.

---

## Summary Table

| Agent | Config Format | Primary Config Path (macOS/Linux) | Primary Config Path (Windows) | MCP Config | Model Config |
| ------- | --------------- | ----------------------------------- | ------------------------------ | ------------ | -------------- |
| **Claude Code** | JSON | `~/.claude/settings.json` | `%USERPROFILE%\.claude\settings.json` | In `settings.json` | In `settings.json` |
| **Cursor** | JSON/MD | `~/.config/cursor/User/settings.json` | `%APPDATA%\Cursor\User\settings.json` | `~/.cursor/mcp.json` | In settings.json |
| **GitHub Copilot CLI** | JSONC | `~/.copilot/settings.json` | `%USERPROFILE%\.copilot\settings.json` | `~/.copilot/mcp-config.json` | In `settings.json` |
| **Windsurf** | JSON | `~/.codeium/windsurf/mcp_config.json` | `%USERPROFILE%\.codeium\windsurf\mcp_config.json` | `mcp_config.json` | In settings |
| **Continue.dev** | YAML | `~/.continue/config.yaml` | `%USERPROFILE%\.continue\config.yaml` | In `config.yaml` | In `config.yaml` |
| **Aider** | YAML | `~/.aider.conf.yml` | `%USERPROFILE%\.aider.conf.yml` | Not native | In `.aider.conf.yml` |
| **OpenInterpreter** | TOML | `~/.openinterpreter/config.toml` | `%USERPROFILE%\.openinterpreter\config.toml` | In `config.toml` | In `config.toml` |
| **Zed** | JSON | `~/.config/zed/settings.json` | `%APPDATA%\Zed\settings.json` | In `settings.json` | In `settings.json` |
| **Amazon Q Developer** | JSON | `~/.aws/amazonq/cli-agents` (CLI) | `%USERPROFILE%\.aws\amazonq\cli-agents` | In agent config | In agent config |
| **Gemini CLI** | JSON | `~/.gemini/settings.json` | `%USERPROFILE%\.gemini\settings.json` | In `settings.json` | In `settings.json` |
| **Ollama** | Env/Modelfile | `~/.ollama/` (models) | `%USERPROFILE%\.ollama\` | N/A | Modelfiles |
| **LM Studio** | JSON (hardcoded) | `~/.lmstudio` or `~/.cache/lm-studio` | `%USERPROFILE%\.lmstudio` | Via extensions | UI only |
| **Jan.ai** | `jan` | `~/Library/Application Support/Jan/data` (macOS) | `%APPDATA%\Jandata` | JSON | per-assistant config in data dir | same | local models (GGUF) | — |

---

## Detailed Findings

### 1. Claude Code (Anthropic)

**Source**: [code.claude.com/docs/en/setup](https://code.claude.com/docs/en/setup)

- **Config File**: `~/.claude/settings.json` (macOS/Linux/WSL) / `%USERPROFILE%\.claude\settings.json` (Windows)
- **Format**: JSON
- **MCP Support**: Configured within `settings.json`
- **Key Settings**:
  - `autoUpdatesChannel`: "latest" | "stable"
  - `minimumVersion`: version pinning
  - `env`: environment variables (e.g., `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`)
  - `DISABLE_AUTOUPDATER`: "1" to disable
- **Model Configuration**: Via environment variables or third-party providers (Bedrock, Vertex)

### 2. Cursor

**Source**: [mdskills.ai/learn/where-are-cursor-skills-stored](https://www.mdskills.ai/learn/where-are-cursor-skills-stored)

- **User Config**:
  - macOS: `~/Library/Application Support/Cursor/User/settings.json`
  - Linux: `~/.config/cursor/User/settings.json` (respects `XDG_CONFIG_HOME`)
  - Windows: `%APPDATA%\Cursor\User\settings.json`
- **Project Config**: `.cursorrules` in project root
- **Skills**: `~/Library/Application Support/Cursor/User/skills/` (macOS) / `%APPDATA%\Cursor\User\skills\` (Windows)
- **MCP Config**: `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project)
- **Format**: JSON

### 3. GitHub Copilot CLI

**Source**: [docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference)

- **Config Directory**: `~/.copilot` (default), overridden by `COPILOT_HOME` env var
- **Files**:
  - `settings.json` (JSONC) - primary user settings
  - `mcp-config.json` - MCP server definitions
  - `permissions-config.json` - tool/directory permissions per project
  - `config.json` - internal state (don't edit)
  - `copilot-instructions.md` - global instructions
  - `agents/` - custom agents
  - `skills/` - custom skills
- **MCP Format**: Standard `mcpServers` object in `mcp-config.json`
- **Config Precedence**: Built-in defaults → MDM → User → Repo → Local → Env vars → CLI flags

### 4. Windsurf (Codeium)

**Source**: [github.com/github/github-mcp-server/docs/installation-guides/install-windsurf.md](https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-windsurf.md)

- **MCP Config**: `~/.codeium/windsurf/mcp_config.json` (global only, no per-project)
- **Format**: JSON with `mcpServers` key
- **Supports**: Streamable HTTP (`serverUrl`) and stdio (`command`/`args`)
- **Limitations**: No environment variable interpolation, global config only

### 5. Continue.dev

**Source**: [continue-docs.mintlify.app/reference](https://continue-docs.mintlify.app/reference)

- **Config File**: `~/.continue/config.yaml` (preferred) or `config.json` (deprecated)
- **Format**: YAML (config.yaml)
- **Structure**:

  ```yaml
  name: "My Config"
  version: "1.0.0"
  schema: "v1"
  models:
    - name: "gpt-4"
      provider: "openai"
      model: "gpt-4"
      roles: ["chat", "edit", "apply", "summarize"]
  mcpServers:
    - name: "github"
      command: "docker"
      args: ["run", "-i", "--rm", "ghcr.io/github/github-mcp-server"]
  ```

- **Roles**: chat, autocomplete, embed, rerank, edit, apply, summarize
- **MCP Support**: Full MCP server configuration with stdio and HTTP transports

### 6. Aider

**Source**: [aider.chat/docs/config/aider_conf.html](https://aider.chat/docs/config/aider_conf.html)

- **Config File**: `.aider.conf.yml` (searched in: home dir → git root → current dir)
- **Format**: YAML
- **Model Settings**: Separate `.aider.model.settings.yml` and `.aider.model.metadata.json`
- **Key Options**: `model`, `weak-model`, `editor-model`, `edit-format`, `api-key`, `openai-api-base`, `alias`
- **No Native MCP**: Uses its own tool system

### 7. OpenInterpreter

**Source**: [openinterpreter.com/docs/terminal/config](https://www.openinterpreter.com/docs/terminal/config)

- **Config File**: `~/.openinterpreter/config.toml` (user) / `.openinterpreter/config.toml` (project)
- **Format**: TOML
- **Precedence**: Built-in → System → User → Project → Profile → CLI overrides
- **MCP Config**: Under `[mcp_servers]` section

  ```toml
  [mcp_servers.docs]
  command = "npx"
  args = ["-y", "@acme/docs-mcp"]
  env = { ACME_TOKEN = "env:ACME_TOKEN" }
  ```

- **Profiles**: Named groups of settings under `[profiles.<name>]`
- **Harness Modes**: `harness = "kimi-code"` etc. for compatibility

### 8. Zed Editor

**Source**: [zed.dev/docs/reference/all-settings](https://zed.dev/docs/reference/all-settings)

- **Config File**: `~/.config/zed/settings.json` (macOS/Linux) / `%APPDATA%\Zed\settings.json` (Windows)
- **Format**: JSON
- **AI Settings**:
  - `edit_predictions.provider`: "zed" | "copilot" | "none"
  - `disable_ai`: boolean
  - LSP configuration for language servers
- **MCP**: Not natively documented in settings reference

### 9. Amazon Q Developer

**Source**: [docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.md](https://docs.aws.amazon.com/amazonq/latest/qdeveloper-ug/qdev-mcp.md)

- **CLI Config**: `~/.aws/amazonq/cli-agents` (directory with agent configs)
- **IDE Config**: `~/.aws/amazonq/agents/default.json`
- **MCP Support**: Both local (stdio) and remote (HTTP) servers
- **Config Format**: JSON per agent
- **Server Init Timeout**: Configurable via `q settings mcp.initTimeout [ms]`

### 10. Gemini CLI

**Source**: [github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)

- **Config File**: `~/.gemini/settings.json`
- **Format**: JSON
- **MCP Config**: In `settings.json` under MCP section
- **Authentication**: Google account, API key, or Vertex AI
- **Context Files**: `GEMINI.md` for project context

### 11. Ollama

**Source**: [ollama.com](https://ollama.com), [github.com/ollama/ollama](https://github.com/ollama/ollama)

- **Configuration**: Primarily via environment variables
  - `OLLAMA_MODELS`: Model storage path
  - `OLLAMA_HOST`: Bind address
  - `OLLAMA_KEEP_ALIVE`: Model retention time
- **Model Definitions**: Modelfiles (text-based, not a central config)
- **Model Storage**:
  - macOS: `~/.ollama/models`
  - Linux: `/usr/share/ollama/.ollama/models`
  - Windows: `%USERPROFILE%\.ollama\models`
- **No Central Config File**: Uses Modelfiles per model

### 12. LM Studio

**Source**: [github.com/savagelysubtle/lmstudio-home-manager](https://github.com/savagelysubtle/lmstudio-home-manager)

- **Data Directory**: Hardcoded, no env var support
  - Windows: `C:\Users\<User>\.lmstudio` or `C:\Users\<User>\.cache\lm-studio`
  - macOS: `~/.lmstudio` or `~/.cache/lm-studio`
  - Linux: `~/.lmstudio` or `~/.cache/lm-studio`
- **Workaround**: `lmstudio-home-manager` tool uses junctions/symlinks
- **Config**: UI-based, no editable config file for models/providers
- **MCP**: Via extensions only

### 13. Jan.ai

**Source**: [janhq/jan/docs/src/pages/docs/desktop/data-folder.mdx](https://github.com/janhq/jan/blob/main/docs/src/pages/docs/desktop/data-folder.mdx)

- **Data Folder** (configurable in Settings):
  - macOS: `~/Library/Application Support/Jan/data`
  - Windows: `%APPDATA%\Jan\data`
  - Linux: `~/.local/share/Jan/data` (XDG_DATA_HOME)
- **Structure**:

  ```
  /assistants/jan/assistant.json    # AI personality config
  /extensions/extensions.json       # Extensions config
  /llamacpp/models/                 # llama.cpp models
  /mlx/models/                      # MLX models
  /threads/                         # Chat history
  ```

- **Assistant Config** (`assistant.json`): Model selection, tools, instructions
- **MCP**: Via extensions (RAG, vector DB, etc.)

---

## Phase 1 Implementation Strategy

### Target Agent: **Claude Code** (simplest, JSON-based, widely used)

**Rationale**:

1. Single JSON file (`settings.json`)
2. Well-documented schema
3. Native MCP support in config
4. Clear model/provider configuration via `env` block
5. Cross-platform paths are straightforward

### Configuration Operations Needed

| Operation | Implementation |
| ----------- | ---------------- |
| **Add Provider/Model** | Add to `env` block (e.g., `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`) or third-party provider config |
| **Remove Provider/Model** | Remove from `env` block |
| **Add MCP Server** | Add to `mcpServers` object in `settings.json` |
| **Remove MCP Server** | Delete from `mcpServers` object |
| **Add/Remove Permissions** | Configure tool permissions in `settings.json` |

### Cross-Platform Path Resolution

```typescript
function getClaudeCodeConfigPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE;
  if (process.platform === 'win32') {
    return path.join(home, '.claude', 'settings.json');
  }
  return path.join(home, '.claude', 'settings.json');
}
```

---

## Architecture for Multi-Agent Support

### Agent Adapter Pattern

```typescript
interface AgentAdapter {
  readonly id: string;
  readonly name: string;
  readonly configPath: string;
  readonly configFormat: 'json' | 'yaml' | 'toml' | 'jsonc';
  
  // Config operations
  readConfig(): Promise<AgentConfig>;
  writeConfig(config: AgentConfig): Promise<void>;
  
  // Model/Provider operations
  addModelProvider(provider: ModelProvider): Promise<void>;
  removeModelProvider(providerId: string): Promise<void>;
  listModelProviders(): ModelProvider[];
  
  // MCP operations
  addMCPServer(server: MCPServerConfig): Promise<void>;
  removeMCPServer(serverName: string): Promise<void>;
  listMCPServers(): MCPServerConfig[];
  
  // Permission operations
  addPermission(permission: PermissionConfig): Promise<void>;
  removePermission(permissionId: string): Promise<void>;
  listPermissions(): PermissionConfig[];
}
```

### Supported Operations Matrix

| Feature | Claude Code | Cursor | Copilot CLI | Windsurf | Continue | Aider | OpenInterpreter | Zed | Amazon Q | Gemini | Ollama | LM Studio | Jan.ai |
| --------- | ------------- | -------- | ------------- | ---------- | ---------- | ------- | ----------------- | ----- | ---------- | -------- | -------- | ----------- | -------- |
| Add Model/Provider | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Remove Model/Provider | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Add MCP Server | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ⚠️ |
| Remove MCP Server | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ⚠️ |
| Permissions | ✅ | ⚠️ | ✅ | ❌ | ⚠️ | ❌ | ✅ | ❌ | ✅ | ⚠️ | ❌ | ❌ | ❌ |

✅ = Full support | ⚠️ = Partial/Limited | ❌ = Not supported

---

## Next Steps

1. **Phase 1**: Build core for Claude Code adapter
2. **Phase 2**: Add Cursor and GitHub Copilot CLI adapters
3. **Phase 3**: Add Continue.dev, Windsurf, OpenInterpreter
4. **Phase 4**: Add remaining agents with varying support levels
5. **UI**: Build lightweight Electron/Tauri app with React
6. **Distribution**: Native binaries for Windows/macOS
