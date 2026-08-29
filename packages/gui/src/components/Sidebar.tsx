import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { api, type CatalogAgent } from '../api';
import { AgentIconTile } from './AgentIcon';
import { LayoutGrid, Database, Server, Bot, Settings, X, Terminal, Sparkles } from 'lucide-react';

interface SidebarProps {
  onClose?: () => void;
}

// Registry-scope nav (system/settings lives in its own group below).
const REGISTRY_VIEWS = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'providers', label: 'Providers', icon: Database },
  { id: 'mcp', label: 'MCP Servers', icon: Server },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'tools', label: 'CLI Tools', icon: Terminal },
] as const;

export function Sidebar({ onClose }: SidebarProps) {
  const { activeView, selectedAgentId, setActiveView, openAgent, registry, agents, sidebarOpen } =
    useStore();

  // Catalog provides per-agent icon names (and richer metadata); fall back to
  // the generic bot glyph for agents not in the catalog.
  const [catalog, setCatalog] = useState<CatalogAgent[] | null>(null);
  useEffect(() => {
    api.getAgentCatalog().then((res) => {
      if (res.ok && res.data) setCatalog(res.data.agents);
    });
  }, []);
  const iconForAgent = (id: string) => catalog?.find((c) => c.id === id)?.icon;

  // Counters must reflect real registry state (not placeholders). Views
  // without a directly available count simply render no counter.
  const countFor = (viewId: string): number | undefined => {
    switch (viewId) {
      case 'providers':
        return registry?.providers.length;
      case 'mcp':
        return registry?.mcpServers.length;
      case 'agents':
        return registry?.customAgents.length;
      default:
        return undefined;
    }
  };

  const installed = agents.filter((a) => a.detection.installed).length;

  const renderNavItem = (view: (typeof REGISTRY_VIEWS)[number]) => {
    const Icon = view.icon;
    const isActive = activeView === view.id;
    const count = countFor(view.id);
    return (
      <button
        key={view.id}
        className={`nav-item ${isActive ? 'active' : ''}`}
        onClick={() => setActiveView(view.id)}
      >
        <Icon className="nav-item-icon" />
        <span className="flex-1 truncate">{view.label}</span>
        {count !== undefined && <span className="nav-item-count">{count}</span>}
      </button>
    );
  };

  return (
    <aside
      className={`sidebar ${sidebarOpen ? 'open' : ''}`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="sidebar-header">
        <div className="flex items-center gap-3">
          <div className="sidebar-brand-mark">
            <Database size={18} />
          </div>
          <div className="min-w-0">
            <div className="sidebar-title">AI Config</div>
            <div className="text-xs text-tertiary">registry-first manager</div>
          </div>
        </div>
        <button className="btn-ghost btn-icon ml-auto" onClick={onClose} aria-label="Close sidebar">
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <span className="nav-section-title">Registry</span>
          {REGISTRY_VIEWS.map(renderNavItem)}
        </div>

        <div className="nav-section">
          <span className="nav-section-title">
            Detected Agents
            <span className="ml-1">
              ({installed}/{agents.length} installed)
            </span>
          </span>
          {agents.map((agent) => {
            const isCurrent = activeView === 'agent-detail' && selectedAgentId === agent.id;
            return (
              <button
                key={agent.id}
                className={`nav-item ${isCurrent ? 'active' : ''}`}
                onClick={() => openAgent(agent.id)}
                title={`${agent.name} — ${agent.detection.installed ? agent.detection.version || 'installed' : 'not installed'}`}
              >
                <AgentIconTile
                  icon={iconForAgent(agent.id)}
                  id={agent.id}
                  size={28}
                  iconSize={17}
                />
                <span className="flex-1 truncate">{agent.name}</span>
                {agent.detection.installed ? (
                  <span className="status-dot status-dot--on" aria-label="installed" />
                ) : (
                  <span className="status-dot status-dot--off" aria-label="not installed" />
                )}
              </button>
            );
          })}
        </div>

        <div className="nav-section">
          <span className="nav-section-title">System</span>
          <button
            className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveView('settings')}
          >
            <Settings className="nav-item-icon" />
            <span className="flex-1 truncate">Settings</span>
          </button>
        </div>
      </nav>

      {registry && (
        <div className="border-t p-3">
          <div className="text-xs text-tertiary mb-2">Registry</div>
          <div className="text-xs font-mono break-all text-secondary">{registry.path}</div>
        </div>
      )}
    </aside>
  );
}
