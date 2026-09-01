import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../api';
import type {
  DetectedAgent,
  RegistryState,
  CustomAgentDef,
  ModelProvider,
  ModelConfig,
  MCPServerConfig,
  ProviderApiCapabilities,
} from '@ai-agent-config/core';

// ============================================================================
// Types
// ============================================================================

export type View =
  | 'overview'
  | 'providers'
  | 'provider-detail'
  | 'mcp'
  | 'agents'
  | 'agent-detail'
  | 'skills'
  | 'tools'
  | 'env-vars'
  | 'permissions'
  | 'settings';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface GUIState {
  // Server state (mirror of the registry + detection)
  agents: DetectedAgent[];
  registry: RegistryState | null;
  platform: string;
  loading: boolean;
  error: string | null;

  // UI state
  activeView: View;
  /** Agent id currently shown in the agent-detail view (null = not on a detail page). */
  selectedAgentId: string | null;
  /** Provider id currently shown in the provider-detail view (null = not on a detail page). */
  selectedProviderId: string | null;
  sidebarOpen: boolean;
  toasts: Toast[];

  // UI actions
  setActiveView: (view: View) => void;
  openAgent: (id: string) => void;
  openProvider: (id: string) => void;
  toggleSidebar: () => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;

  // Data actions (API-backed)
  refreshAll: () => Promise<boolean>;

  addProvider: (
    provider: ModelProvider,
    models: ModelConfig[],
    agentIds: string[],
    apiCapabilities?: ProviderApiCapabilities
  ) => Promise<boolean>;
  updateProvider: (
    id: string,
    provider: Partial<ModelProvider>,
    apiCapabilities?: ProviderApiCapabilities,
    models?: ModelConfig[]
  ) => Promise<boolean>;
  toggleProviderAgent: (id: string, agentId: string) => Promise<boolean>;
  deleteProvider: (id: string) => Promise<boolean>;

  addMCP: (server: MCPServerConfig, agentIds: string[]) => Promise<boolean>;
  updateMCP: (name: string, server: Partial<MCPServerConfig>) => Promise<boolean>;
  toggleMCPAgent: (name: string, agentId: string) => Promise<boolean>;
  deleteMCP: (name: string) => Promise<boolean>;

  addCustomAgent: (def: CustomAgentDef) => Promise<boolean>;
  updateCustomAgent: (
    id: string,
    updates: Partial<
      Pick<CustomAgentDef, 'name' | 'description' | 'configPath' | 'mcpPath' | 'format'>
    >
  ) => Promise<boolean>;
  deleteCustomAgent: (id: string) => Promise<boolean>;

  revealAgent: (id: string, kind?: 'config' | 'mcp' | 'model') => Promise<boolean>;
}

// ============================================================================
// Helpers
// ============================================================================

function toastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function notify(type: Toast['type'], title: string, message: string): void {
  useStore.getState().addToast({ type, title, message });
}

/**
 * Run an API call; on success refresh the server state and toast, on failure
 * toast the error. Returns whether the operation succeeded.
 */
async function run(
  task: () => Promise<{ ok: boolean; error?: string; warnings?: string[] }>,
  successTitle: string,
  successMessage: string
): Promise<boolean> {
  try {
    const result = await task();
    if (!result.ok) {
      notify('error', 'Operation Failed', result.error || 'Unknown error');
      return false;
    }
    for (const warning of result.warnings || []) {
      notify('warning', 'Warning', warning);
    }
    notify('success', successTitle, successMessage);
    await useStore.getState().refreshAll();
    return true;
  } catch (err) {
    notify('error', 'Operation Failed', err instanceof Error ? err.message : String(err));
    return false;
  }
}

// ============================================================================
// Store
// ============================================================================

export const useStore = create<GUIState>()(
  persist(
    (set, get) => ({
      agents: [],
      registry: null,
      platform: 'unknown',
      loading: false,
      error: null,
      activeView: 'overview',
      selectedAgentId: null,
      selectedProviderId: null,
      sidebarOpen: typeof window !== 'undefined' ? window.innerWidth > 768 : true,
      toasts: [],

      setActiveView: (view) => set({ activeView: view }),
      openAgent: (id) => set({ activeView: 'agent-detail', selectedAgentId: id }),
      openProvider: (id) => set({ activeView: 'provider-detail', selectedProviderId: id }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      addToast: (toast) => set((s) => ({ toasts: [...s.toasts, { ...toast, id: toastId() }] })),
      removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      refreshAll: async () => {
        set({ loading: true, error: null });
        try {
          const res = await api.getState();
          if (!res.ok || !res.data) {
            set({
              loading: false,
              error: res.error || 'Failed to load state',
            });
            return false;
          }
          set({
            agents: res.data.agents,
            registry: res.data.registry,
            platform: res.data.platform,
            loading: false,
          });
          return true;
        } catch (err) {
          set({
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          });
          return false;
        }
      },

      // ---- Providers ----
      addProvider: (provider, models, agentIds, apiCapabilities) =>
        run(
          () => api.addProvider(provider, models, agentIds, apiCapabilities),
          'Provider Added',
          `"${provider.name}" registered and installed into ${agentIds.length} agent(s)`
        ),
      updateProvider: (id, provider, apiCapabilities, models) =>
        run(
          () => api.updateProvider(id, { provider, apiCapabilities, models }),
          'Provider Updated',
          `"${provider.name || id}" updated`
        ),
      toggleProviderAgent: async (id, agentId) => {
        const registry = get().registry;
        const entry = registry?.providers.find((p) => p.provider.id === id);
        if (!entry) return false;
        const installing = !entry.agentIds.includes(agentId);
        return run(
          () =>
            installing
              ? api.addProviderAgents(id, [agentId])
              : api.removeProviderAgent(id, agentId),
          installing ? 'Installed' : 'Removed',
          `Provider "${entry.provider.name}" ${installing ? 'installed into' : 'removed from'} ${agentId}`
        );
      },
      deleteProvider: (id) => {
        const entry = get().registry?.providers.find((p) => p.provider.id === id);
        return run(
          () => api.deleteProvider(id),
          'Provider Deleted',
          `"${entry?.provider.name || id}" removed from the registry`
        );
      },

      // ---- MCP servers ----
      addMCP: (server, agentIds) =>
        run(
          () => api.addMCP(server, agentIds),
          'MCP Server Added',
          `"${server.name}" registered and installed into ${agentIds.length} agent(s)`
        ),
      updateMCP: (name, server) =>
        run(
          () => api.updateMCP(name, server),
          'MCP Server Updated',
          `"${server.name || name}" updated`
        ),
      toggleMCPAgent: async (name, agentId) => {
        const entry = get().registry?.mcpServers.find((m) => m.server.name === name);
        if (!entry) return false;
        const installing = !entry.agentIds.includes(agentId);
        return run(
          () =>
            installing ? api.addMCPAgents(name, [agentId]) : api.removeMCPAgent(name, agentId),
          installing ? 'Installed' : 'Removed',
          `MCP server "${entry.server.name}" ${installing ? 'installed into' : 'removed from'} ${agentId}`
        );
      },
      deleteMCP: (name) => {
        const entry = get().registry?.mcpServers.find((m) => m.server.name === name);
        return run(
          () => api.deleteMCP(name),
          'MCP Server Deleted',
          `"${entry?.server.name || name}" removed from the registry`
        );
      },

      // ---- Custom agents ----
      addCustomAgent: (def) =>
        run(
          () => api.addCustomAgent(def),
          'Custom Agent Added',
          `"${def.name || def.id}" registered with config path ${def.configPath}`
        ),
      updateCustomAgent: (id, updates) =>
        run(() => api.updateCustomAgent(id, updates), 'Custom Agent Updated', `"${id}" updated`),
      deleteCustomAgent: (id) =>
        run(
          () => api.deleteCustomAgent(id),
          'Custom Agent Removed',
          `"${id}" removed from the registry`
        ),

      // ---- Folder reveal ----
      revealAgent: async (id, kind) => {
        const res = await api.revealAgent(id, kind);
        if (!res.ok) {
          notify('error', 'Reveal Failed', res.error || 'Unknown error');
          return false;
        }
        notify(
          'success',
          'Revealed',
          `Opened ${res.data?.path || res.data?.dir || 'config folder'}`
        );
        return true;
      },
    }),
    {
      name: 'ai-agent-config-gui',
      partialize: (state) => ({
        activeView: state.activeView,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);

// Re-export for existing call sites that imported addToast from the store
export const addToast = (toast: Omit<Toast, 'id'>) => useStore.getState().addToast(toast);
