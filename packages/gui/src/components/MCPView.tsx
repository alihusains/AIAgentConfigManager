import { useState } from 'react';
import { useStore } from '../store';
import { AgentPicker } from './AgentPicker';
import { AgentIconTile } from './AgentIcon';
import { useAgentCatalog } from '../hooks/useAgentCatalog';
import { ToolCountCell } from './MCPToolCountCell';
import type { MCPServerConfig, DetectedAgent } from '@ai-agent-config/core';
import { Plus, Edit, Trash2, Server, Terminal, Globe, Link } from 'lucide-react';
import { Tooltip } from '../ui';

const TYPE_ICONS: Record<MCPServerConfig['type'], React.ReactNode> = {
  stdio: <Terminal size={18} />,
  http: <Globe size={18} />,
  'streamable-http': <Link size={18} />,
  sse: <Globe size={18} />,
};

export function MCPView() {
  const { registry, agents, loading, toggleMCPAgent, deleteMCP } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<MCPServerConfig | null>(null);

  const servers = registry?.mcpServers || [];
  const catalog = useAgentCatalog();
  const agentName = (id: string) => agents.find((a) => a.id === id)?.name || id;
  const agentIcon = (id: string) => catalog.find((c) => c.id === id)?.icon;

  const handleDelete = async (server: MCPServerConfig) => {
    const installed =
      registry?.mcpServers.find((m) => m.server.name === server.name)?.agentIds.length || 0;
    if (
      !confirm(
        `Delete MCP server "${server.name}" from the registry?\n\nIt is currently installed on ${installed} agent(s) — those configs will be cleaned up.`
      )
    ) {
      return;
    }
    await deleteMCP(server.name);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">MCP Servers</h1>
          <p className="text-secondary text-sm mt-1">
            One definition per server — installed into the agents listed on each row.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowAdd(true)} disabled={loading}>
          <Plus size={16} />
          Add MCP Server
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Server size={64} className="empty-state-icon" />
            <h3 className="empty-state-title">No MCP Servers Registered</h3>
            <p className="empty-state-message">
              Register an MCP server once (stdio or remote), then install it onto any agent.
            </p>
            <button className="btn-primary mt-4" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Add MCP Server
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table mcp-table">
              <thead>
                <tr>
                  <th>Server</th>
                  <th>Command / Endpoint</th>
                  <th>Env</th>
                  <th>Tools</th>
                  <th>Installed On</th>
                  <th style={{ width: '110px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {servers.map(({ server, agentIds, agentOverrides }) => {
                  const envCount = server.env ? Object.keys(server.env).length : 0;
                  const visible = agentIds.slice(0, 4);
                  const overflow = agentIds.length - visible.length;
                  return (
                    <tr key={server.name}>
                      <td>
                        <div className="mcp-row-identity flex items-center gap-3">
                          <div className="mcp-type-icon flex-shrink-0">
                            {TYPE_ICONS[server.type] || <Server size={18} />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="mcp-server-name">{server.name}</p>
                              <span
                                className={`mcp-status ${server.enabled ? 'mcp-status-on' : 'mcp-status-off'}`}
                              >
                                {server.enabled ? 'active' : 'disabled'}
                              </span>
                            </div>
                            <p className="mcp-meta">
                              {server.type}
                              {server.approvalMode ? ` · ${server.approvalMode}` : ''}
                              {agentOverrides && Object.keys(agentOverrides).length > 0
                                ? ` · ${Object.keys(agentOverrides).length} override(s)`
                                : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="font-mono text-xs break-all mcp-meta">
                          {server.type === 'stdio'
                            ? `${server.command || ''} ${(server.args || []).join(' ')}`
                            : server.url || '—'}
                        </p>
                      </td>
                      <td>
                        {envCount > 0 ? (
                          <span className="mcp-meta">{envCount} var(s)</span>
                        ) : (
                          <span className="mcp-meta">—</span>
                        )}
                      </td>
                      <td>
                        <ToolCountCell name={server.name} />
                      </td>
                      <td>
                        <div className="flex items-center gap-2 mcp-agent-stack-wrap">
                          <div className="mcp-agent-stack">
                            {visible.length === 0 && <span className="mcp-meta">—</span>}
                            {visible.map((id) => (
                              <span key={id} className="mcp-agent-avatar">
                                <AgentIconTile
                                  id={id}
                                  icon={agentIcon(id)}
                                  size={26}
                                  iconSize={14}
                                />
                                <Tooltip content={`Remove from ${agentName(id)}`}>
                                <button
                                  className="mcp-avatar-remove"
                                  onClick={() => toggleMCPAgent(server.name, id)}
                                >
                                  ×
                                </button>
                                </Tooltip>
                              </span>
                            ))}
                            {overflow > 0 && (
                              <Tooltip content={agentIds.slice(4).map(agentName).join(', ')}>
                              <span
                                className="mcp-avatar-more"
                              >
                                +{overflow}
                              </span>
                              </Tooltip>
                            )}
                          </div>
                          <div className="mcp-agent-list">
                            {agentIds.map((id) => (
                              <span key={id} className="mcp-agent-list-item" title={agentName(id)}>
                                <AgentIconTile
                                  id={id}
                                  icon={agentIcon(id)}
                                  size={22}
                                  iconSize={13}
                                />
                                {agentName(id)}
                              </span>
                            ))}
                          </div>
                          <AgentPicker
                            targets={agentIds}
                            agents={agents}
                            onToggle={(agentId) => toggleMCPAgent(server.name, agentId)}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="mcp-row-actions flex items-center gap-1">
                          <Tooltip content="Edit">
                          <button
                            className="btn-ghost btn-icon btn-sm"
                            onClick={() => setEditing(server)}
                          >
                            <Edit size={14} />
                          </button>
                          </Tooltip>
                          <Tooltip content="Delete">
                          <button
                            className="btn-ghost btn-icon btn-sm text-error"
                            onClick={() => handleDelete(server)}
                          >
                            <Trash2 size={14} />
                          </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && <MCPServerModal onClose={() => setShowAdd(false)} agents={agents} />}
      {editing && (
        <MCPServerModal onClose={() => setEditing(null)} agents={agents} initial={editing} />
      )}
    </div>
  );
}

// ============================================================================
// Add / Edit MCP server modal (shared form)
// ============================================================================

interface MCPServerModalProps {
  onClose: () => void;
  agents: DetectedAgent[];
  /** When provided, the modal edits an existing server definition */
  initial?: MCPServerConfig;
}

function MCPServerModal({ onClose, agents, initial }: MCPServerModalProps) {
  const { addMCP, updateMCP } = useStore();
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name || '',
    type: initial?.type || 'stdio',
    command: initial?.command || '',
    args: (initial?.args || []).join(' '),
    env: Object.entries(initial?.env || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(','),
    url: initial?.url || '',
    headers: Object.entries(initial?.headers || {})
      .map(([k, v]) => `${k}=${v}`)
      .join(','),
    cwd: initial?.cwd || '',
    timeout: initial?.timeout ?? 30000,
    approvalMode: initial?.approvalMode || 'prompt',
    tools: (initial?.tools || []).join(','),
    enabled: initial?.enabled ?? true,
    targetAgentIds: isEdit ? [] : agents.filter((a) => a.detection.installed).map((a) => a.id),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Server name is required';
    if (form.type === 'stdio') {
      if (!form.command.trim()) e.command = 'Command is required';
    } else {
      if (!form.url.trim()) e.url = 'URL is required';
      else {
        try {
          new URL(form.url);
        } catch {
          e.url = 'Invalid URL';
        }
      }
    }
    if (!isEdit && form.targetAgentIds.length === 0) e.targetAgentIds = 'Pick at least one agent';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const parsePairs = (raw: string): Record<string, string> =>
    raw
      .split(',')
      .map((p) => p.split('='))
      .filter(([k, v]) => k && v)
      .reduce<Record<string, string>>((acc, [k, v]) => {
        acc[k.trim()] = (v ?? '').trim();
        return acc;
      }, {});

  const buildServer = (): MCPServerConfig => ({
    name: form.name.trim(),
    type: form.type as MCPServerConfig['type'],
    command: form.command.trim() || undefined,
    args: form.args ? form.args.trim().split(/\s+/).filter(Boolean) : undefined,
    env: form.env ? parsePairs(form.env) : undefined,
    url: form.url.trim() || undefined,
    headers: form.headers ? parsePairs(form.headers) : undefined,
    cwd: form.cwd.trim() || undefined,
    timeout: form.timeout || undefined,
    approvalMode: form.approvalMode as MCPServerConfig['approvalMode'],
    enabled: form.enabled,
    tools: form.tools
      ? form.tools
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
  });

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate() || submitting) return;
    setSubmitting(true);
    const server = buildServer();
    const ok = isEdit
      ? await updateMCP(initial!.name, server)
      : await addMCP(server, form.targetAgentIds);
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEdit ? `Edit MCP Server — ${initial!.name}` : 'Add MCP Server'}
          </h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '65vh' }}>
            <div className="form-group">
              <label className="form-label">Server Name</label>
              <input
                className={`input ${errors.name ? 'input-error' : ''}`}
                placeholder="e.g., github, filesystem, postgres"
                value={form.name}
                disabled={isEdit}
                onChange={(e) => set({ name: e.target.value })}
              />
              {errors.name && <p className="form-help text-error">{errors.name}</p>}
            </div>

            <div className="form-group">
              <label className="form-label">Transport Type</label>
              <select
                className="input select"
                value={form.type}
                onChange={(e) => set({ type: e.target.value as MCPServerConfig['type'] })}
              >
                <option value="stdio">STDIO (local process)</option>
                <option value="http">HTTP (remote)</option>
                <option value="streamable-http">Streamable HTTP (remote)</option>
                <option value="sse">SSE (remote)</option>
              </select>
            </div>

            {form.type === 'stdio' && (
              <>
                <div className="form-group">
                  <label className="form-label">Command</label>
                  <input
                    className={`input ${errors.command ? 'input-error' : ''}`}
                    placeholder="npx, docker, python, …"
                    value={form.command}
                    onChange={(e) => set({ command: e.target.value })}
                  />
                  {errors.command && <p className="form-help text-error">{errors.command}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Arguments</label>
                  <input
                    className="input"
                    placeholder="-y @modelcontextprotocol/server-github"
                    value={form.args}
                    onChange={(e) => set({ args: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Working Directory (optional)</label>
                  <input
                    className="input"
                    placeholder="/path/to/working/dir"
                    value={form.cwd}
                    onChange={(e) => set({ cwd: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Environment Variables (optional)</label>
                  <input
                    className="input"
                    placeholder="KEY=value,KEY2=value2"
                    value={form.env}
                    onChange={(e) => set({ env: e.target.value })}
                  />
                </div>
              </>
            )}

            {(form.type === 'http' || form.type === 'streamable-http' || form.type === 'sse') && (
              <>
                <div className="form-group">
                  <label className="form-label">Server URL</label>
                  <input
                    className={`input ${errors.url ? 'input-error' : ''}`}
                    type="url"
                    placeholder="https://api.example.com/mcp"
                    value={form.url}
                    onChange={(e) => set({ url: e.target.value })}
                  />
                  {errors.url && <p className="form-help text-error">{errors.url}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Headers (optional)</label>
                  <input
                    className="input"
                    placeholder="Authorization=Bearer token,Content-Type=application/json"
                    value={form.headers}
                    onChange={(e) => set({ headers: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Timeout (ms)</label>
                <input
                  className="input"
                  type="number"
                  min={1000}
                  max={300000}
                  value={form.timeout}
                  onChange={(e) => set({ timeout: parseInt(e.target.value) || 30000 })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Approval Mode</label>
                <select
                  className="input select"
                  value={form.approvalMode}
                  onChange={(e) =>
                    set({ approvalMode: e.target.value as MCPServerConfig['approvalMode'] })
                  }
                >
                  <option value="prompt">Prompt for each tool call</option>
                  <option value="auto">Auto-approve</option>
                  <option value="never">Never approve (read-only)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Allowed Tools (optional)</label>
              <input
                className="input"
                placeholder="tool1,tool2 (empty = all tools)"
                value={form.tools}
                onChange={(e) => set({ tools: e.target.value })}
              />
            </div>

            {isEdit ? (
              <div className="form-group">
                <label className="checkbox-wrapper">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={form.enabled}
                    onChange={(e) => set({ enabled: e.target.checked })}
                  />
                  <span className="checkbox-label">Server enabled</span>
                </label>
                <p className="form-help">
                  Edits update the shared definition and are written into every agent. Use per-agent
                  overrides in the registry file for one-off tweaks.
                </p>
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Install Into Agents</label>
                <div className="border rounded overflow-auto" style={{ maxHeight: 160 }}>
                  {agents.map((agent) => (
                    <label
                      key={agent.id}
                      className="flex items-center gap-2 cursor-pointer px-2 py-1 hover:bg-bg-hover"
                    >
                      <input
                        type="checkbox"
                        className="checkbox"
                        checked={form.targetAgentIds.includes(agent.id)}
                        onChange={(e) =>
                          set({
                            targetAgentIds: e.target.checked
                              ? [...form.targetAgentIds, agent.id]
                              : form.targetAgentIds.filter((id) => id !== agent.id),
                          })
                        }
                      />
                      <span className="flex-1 text-sm">{agent.name}</span>
                      {agent.detection.installed ? (
                        <span className="badge badge-success">
                          {agent.detection.version || 'installed'}
                        </span>
                      ) : (
                        <span className="text-xs text-tertiary">path-based</span>
                      )}
                    </label>
                  ))}
                </div>
                {errors.targetAgentIds && (
                  <p className="form-help text-error">{errors.targetAgentIds}</p>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <Plus size={16} />
              {isEdit ? 'Save Changes' : 'Add Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
