import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { api, type CatalogAgent } from '../api';
import { AgentIconTile } from './AgentIcon';
import {
  LayoutGrid,
  Database,
  Server,
  Bot,
  Settings,
  X,
  Terminal,
  Sparkles,
  KeyRound,
  Shield,
} from 'lucide-react';
import { Tooltip } from '../ui';

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
  { id: 'env-vars', label: 'Environment', icon: KeyRound },
  { id: 'permissions', label: 'Permissions', icon: Shield },
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

  // Real installed-agent count — the same metric the Agents page's
  // "Installed Agents" stat trusts: the maintained catalog's installed
  // entries once loaded, falling back to live detection from `getState`.
  const installed = useMemo(
    () =>
      catalog
        ? catalog.filter((a) => a.installed).length
        : agents.filter((a) => a.detection.installed).length,
    [catalog, agents]
  );

  // Counters must reflect real registry state (not placeholders). Views
  // without a directly available count simply render no counter.
  const countFor = (viewId: string): number | undefined => {
    switch (viewId) {
      case 'providers':
        return registry?.providers.length;
      case 'mcp':
        return registry?.mcpServers.length;
      case 'agents':
        return installed;
      default:
        return undefined;
    }
  };

  const renderNavItem = (view: (typeof REGISTRY_VIEWS)[number]) => {
    const Icon = view.icon;
    const isActive = activeView === view.id;
    const count = countFor(view.id);
    return (
      <button
        key={view.id}
        className={`chat-row ${isActive ? 'chat-row--active' : ''}`}
        onClick={() => setActiveView(view.id)}
        aria-current={isActive ? 'page' : undefined}
      >
        <div className="chat-row-avatar">
          <Icon className="chat-row-icon" />
        </div>
        <div className="chat-row-content">
          <div className="chat-row-label">{view.label}</div>
        </div>
        {count !== undefined && <span className="chat-row-badge">{count}</span>}
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
          <img
            src="/logo-icon-32.png"
            alt="AI Agent Config Manager"
            className="sidebar-brand-icon"
            width={32}
            height={32}
          />
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
            const statusText = agent.detection.installed ? agent.detection.version || 'installed' : 'not installed';
            return (
              <Tooltip
                key={agent.id}
                content={`${agent.name} — ${statusText}`}
              >
              <button
                className={`chat-row ${isCurrent ? 'chat-row--active' : ''}`}
                onClick={() => openAgent(agent.id)}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <div className="chat-row-avatar">
                  <AgentIconTile
                    icon={iconForAgent(agent.id)}
                    id={agent.id}
                    size={32}
                    iconSize={17}
                  />
                </div>
                <div className="chat-row-content">
                  <div className="chat-row-label">{agent.name}</div>
                  <div className="chat-row-preview text-xs">{statusText}</div>
                </div>
                {agent.detection.installed ? (
                  <span className="status-dot status-dot--on" aria-label="installed" />
                ) : (
                  <span className="status-dot status-dot--off" aria-label="not installed" />
                )}
              </button>
              </Tooltip>
            );
          })}
        </div>

        <div className="nav-section">
          <span className="nav-section-title">System</span>
          <button
            className={`chat-row ${activeView === 'settings' ? 'chat-row--active' : ''}`}
            onClick={() => setActiveView('settings')}
            aria-current={activeView === 'settings' ? 'page' : undefined}
          >
            <div className="chat-row-avatar">
              <Settings className="chat-row-icon" />
            </div>
            <div className="chat-row-content">
              <div className="chat-row-label">Settings</div>
            </div>
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
