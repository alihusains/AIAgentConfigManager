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
  Zap,
  Search,
} from 'lucide-react';
import { Tooltip } from '../ui';

interface SidebarProps {
  onClose?: () => void;
}

// Registry-scope nav (system/settings lives in its own group below).
const REGISTRY_VIEWS = [
  { id: 'overview', label: 'Overview', desc: 'Registry health at a glance', icon: LayoutGrid },
  { id: 'providers', label: 'Providers', desc: 'Keys, models, verification', icon: Database },
  { id: 'mcp', label: 'MCP Servers', desc: 'Tool servers and targets', icon: Server },
  { id: 'agents', label: 'Agents', desc: 'Detect, install, configure', icon: Bot },
  { id: 'skills', label: 'Skills', desc: 'Library and assignments', icon: Sparkles },
  { id: 'tools', label: 'CLI Tools', desc: 'Versions and updates', icon: Terminal },
  { id: 'cli', label: 'CLI Manager', desc: 'Run and track commands', icon: Zap },
  { id: 'env-vars', label: 'Environment', desc: 'Shell vars and secrets', icon: KeyRound },
] as const;

/** Platform-appropriate shortcut hint (matches the panel header). */
const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

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

  const openPalette = () => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        [IS_MAC ? 'metaKey' : 'ctrlKey']: true,
      })
    );
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
          <Icon className="chat-row-icon" size={19} />
        </div>
        <div className="chat-row-content">
          <div className="chat-row-label">{view.label}</div>
          <div className="chat-row-preview">{view.desc}</div>
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
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/logo-icon-32.png"
            alt="AI Config Manager"
            className="sidebar-brand-icon"
            width={32}
            height={32}
          />
          <div className="min-w-0">
            <div className="sidebar-title">AI Config</div>
            <div className="sidebar-subtitle">registry-first manager</div>
          </div>
        </div>
        <button className="sidebar-close" onClick={onClose} aria-label="Close sidebar">
          <X size={18} />
        </button>
      </div>

      <button className="sb-search" onClick={openPalette} aria-label="Open command palette">
        <Search size={14} />
        <span>Search</span>
        <kbd>{IS_MAC ? '⌘K' : 'Ctrl-K'}</kbd>
      </button>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <span className="nav-section-title">
            <span className="num">01</span>Registry
          </span>
          {REGISTRY_VIEWS.map(renderNavItem)}
        </div>

        <div className="nav-section">
          <span className="nav-section-title">
            <span className="num">02</span>Detected Agents ({installed})
          </span>
          {agents
            .filter((agent) => agent.detection.installed)
            .map((agent) => {
            const isCurrent = activeView === 'agent-detail' && selectedAgentId === agent.id;
            const statusText = agent.detection.version || 'installed';
            return (
              <Tooltip key={agent.id} content={`${agent.name} — ${statusText}`}>
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
                    <div className="chat-row-preview">{statusText}</div>
                  </div>
                  <span className="status-dot status-dot--on" aria-label="installed" />
                </button>
              </Tooltip>
            );
          })}
        </div>

        <div className="nav-section">
          <span className="nav-section-title">
            <span className="num">03</span>System
          </span>
          <button
            className={`chat-row ${activeView === 'settings' ? 'chat-row--active' : ''}`}
            onClick={() => setActiveView('settings')}
            aria-current={activeView === 'settings' ? 'page' : undefined}
          >
            <div className="chat-row-avatar">
              <Settings className="chat-row-icon" size={19} />
            </div>
            <div className="chat-row-content">
              <div className="chat-row-label">Settings</div>
              <div className="chat-row-preview">App preferences</div>
            </div>
          </button>
        </div>
      </nav>

      {registry && (
        <div className="sidebar-footer">
          <span className="sidebar-footer-label">Registry</span>
          <span className="sidebar-footer-path" title={registry.path}>
            {registry.path}
          </span>
        </div>
      )}
    </aside>
  );
}
