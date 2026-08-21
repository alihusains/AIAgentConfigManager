import { useStore } from '../store';
import { Database, Server, Bot, UserPlus, AlertTriangle } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: string;
  onClick?: () => void;
}

function StatCard({ title, value, icon, color, trend, onClick }: StatCardProps) {
  return (
    <div className="card flex-1 cursor-pointer" onClick={onClick} style={{ minWidth: 0 }}>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-secondary text-sm truncate">{title}</p>
          <p className="font-bold text-lg mt-1" style={{ color }}>{value}</p>
          {trend && <p className="text-xs text-success mt-1 truncate">{trend}</p>}
        </div>
        <div className="p-2 rounded-lg flex-shrink-0" style={{ background: `${color}15` }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { agents, registry, platform, loading, error, authError, setActiveView, refreshAll } = useStore();

  if (loading && !registry) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="spinner" style={{ width: 40, height: 40 }} />
        <p className="text-secondary">Loading registry state…</p>
      </div>
    );
  }

  if (error && !registry) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="empty-state">
          <AlertTriangle size={64} className="empty-state-icon text-warning" />
          {authError ? (
            <>
              <h3 className="empty-state-title">Dashboard access token missing or expired</h3>
              <p className="empty-state-message">
                The page loads, but this browser no longer holds the per-session token of the
                running dashboard (401 Unauthorized). The agents and registry live behind the
                local API and cannot be shown without it.
              </p>
              <div className="mt-4">
                <button className="btn-primary" onClick={() => refreshAll()}>
                  Try Again
                </button>
              </div>
              <p className="empty-state-message mt-2">
                Still failing? Re-run <span className="font-mono">ai-config gui</span> in the
                terminal and open the printed{' '}
                <span className="font-mono">http://127.0.0.1:…/?t=…</span> URL — old tabs and
                bookmarks are rejected by design.
              </p>
            </>
          ) : (
            <>
              <h3 className="empty-state-title">Cannot reach the config server</h3>
              <p className="empty-state-message text-error">{error}</p>
              <button className="btn-primary mt-4" onClick={() => refreshAll()}>
                Retry
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const providers = registry?.providers || [];
  const mcpServers = registry?.mcpServers || [];
  const customAgents = registry?.customAgents || [];
  const installedAgents = agents.filter((a) => a.detection.installed);
  const agentsWithConfig = agents.filter((a) => a.detection.configExists);

  // Providers installed into each agent (for the agent column)
  const providerTargets = (agentId: string): string[] =>
    providers
      .filter((p) => p.agentIds.includes(agentId))
      .map((p) => p.provider.name);

  return (
    <div className="p-4">
      {/* Stat cards */}
      <div className="flex gap-4 mb-6 flex-wrap">
        <StatCard
          title="Model Providers (registry)"
          value={providers.length}
          icon={<Database size={24} />}
          color="#3b82f6"
          trend={providers.length > 0 ? `${providers.filter((p) => p.provider.enabled).length} enabled` : 'Add your first provider'}
          onClick={() => setActiveView('providers')}
        />
        <StatCard
          title="MCP Servers (registry)"
          value={mcpServers.length}
          icon={<Server size={24} />}
          color="#10b981"
          trend={mcpServers.length > 0 ? `${mcpServers.filter((m) => m.server.enabled).length} enabled` : 'Add your first MCP server'}
          onClick={() => setActiveView('mcp')}
        />
        <StatCard
          title="Agents (installed)"
          value={`${installedAgents.length}/${agents.length}`}
          icon={<Bot size={24} />}
          color="#8b5cf6"
          trend={`${agentsWithConfig.length} have a config file`}
          onClick={() => setActiveView('agents')}
        />
        <StatCard
          title="Custom Agents"
          value={customAgents.length}
          icon={<UserPlus size={24} />}
          color="#f59e0b"
          trend={customAgents.length > 0 ? 'user-defined config paths' : 'Register custom tools'}
          onClick={() => setActiveView('agents')}
        />
      </div>

      {/* Registry summary */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title">Registry — single source of truth</h3>
          <span className="badge badge-primary">
            {registry?.updatedAt ? new Date(registry.updatedAt).toLocaleString() : '—'}
          </span>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-tertiary text-xs">Location</p>
            <p className="font-mono text-sm break-all mt-1">{registry?.path}</p>
            <p className="text-tertiary text-xs mt-2 mb-1">
              One definition per provider / MCP server; each entry lists the agents it is installed on.
              Agent files are generated from this registry — never edit them by hand.
            </p>
          </div>
          <div className="flex-shrink-0">
            <p className="text-tertiary text-xs">Info</p>
            <div className="mt-1 space-y-1">
              <div className="text-sm"><span className="text-tertiary">Platform:</span> <span className="font-mono">{platform}</span></div>
              <div className="text-sm"><span className="text-tertiary">Providers:</span> {providers.length}</div>
              <div className="text-sm"><span className="text-tertiary">MCP servers:</span> {mcpServers.length}</div>
              <div className="text-sm"><span className="text-tertiary">Custom agents:</span> {customAgents.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Agents table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Agents on this machine</h3>
          <button className="btn-ghost btn-sm" onClick={() => setActiveView('agents')}>
            Manage agents →
          </button>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Status</th>
                <th>Config</th>
                <th>Registry providers installed</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 rounded-lg bg-bg-tertiary flex-shrink-0">
                        <Bot size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{agent.name}</p>
                        <p className="text-xs text-tertiary">{agent.id}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    {agent.detection.installed ? (
                      <span className="badge badge-success">
                        {agent.detection.version || 'installed'}
                      </span>
                    ) : (
                      <span className="badge badge-neutral">not installed</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${agent.detection.configExists ? 'badge-success' : 'badge-neutral'}`}>
                      {agent.detection.configExists ? 'file exists' : 'no config'}
                    </span>
                  </td>
                  <td>
                    {providerTargets(agent.id).length === 0 ? (
                      <span className="text-tertiary text-xs">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {providerTargets(agent.id).map((name) => (
                          <span key={name} className="chip">{name}</span>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}