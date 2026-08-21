import { useStore } from '../store';
import {
  LayoutGrid,
  Database,
  Server,
  Bot,
  Settings,
  X,
} from 'lucide-react';

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const { activeView, setActiveView, registry, agents, sidebarOpen } = useStore();

  const views = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'providers', label: 'Providers', icon: Database },
    { id: 'mcp', label: 'MCP Servers', icon: Server },
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  const installed = agents.filter((a) => a.detection.installed).length;
  const customCount = registry?.customAgents.length || 0;

  return (
    <aside
      className={`sidebar ${sidebarOpen ? 'open' : ''}`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="sidebar-header">
        <div className="flex items-center gap-2">
          <Database size={24} className="text-accent" />
          <div className="min-w-0">
            <div className="sidebar-title">AI Config</div>
            <div className="text-xs text-tertiary">registry-first manager</div>
          </div>
        </div>
        <button
          className="btn-ghost btn-icon ml-auto"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <span className="nav-section-title">Registry</span>
          {views.map((view) => {
            const Icon = view.icon;
            const isActive = activeView === view.id;
            const count =
              view.id === 'providers'
                ? registry?.providers.length
                : view.id === 'mcp'
                  ? registry?.mcpServers.length
                  : view.id === 'agents'
                    ? customCount
                    : undefined;
            return (
              <button
                key={view.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveView(view.id)}
              >
                <Icon className="nav-item-icon" />
                <span className="flex-1">{view.label}</span>
                {count !== undefined && count > 0 && (
                  <span className="badge badge-neutral">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="nav-section">
          <span className="nav-section-title">
            Detected Agents
            <span className="ml-1">({installed}/{agents.length} installed)</span>
          </span>
          {agents.map((agent) => (
            <button
              key={agent.id}
              className="nav-item"
              onClick={() => setActiveView('agents')}
              title={`${agent.name} — ${agent.detection.installed ? agent.detection.version || 'installed' : 'not installed'}`}
            >
              <Bot size={16} className="nav-item-icon" />
              <span className="flex-1 truncate">{agent.name}</span>
              {agent.detection.installed ? (
                <span className="badge badge-success">on</span>
              ) : (
                <span className="badge badge-neutral">—</span>
              )}
            </button>
          ))}
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