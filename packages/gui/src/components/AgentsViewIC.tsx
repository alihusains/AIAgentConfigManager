/**
 * AgentsView Refactored — IC Signature Dual-Pane Theme
 *
 * Refactored agent management interface using Infrastructure Control
 * plane design patterns. Dual-pane layout with agent list/filters (left)
 * and selected agent config preview (right).
 *
 * Features:
 * - Left pane: Agent list with filters
 * - Right pane: Selected agent config preview
 * - Shows: supported models, providers, capabilities
 * - Responsive: side-by-side desktop, stacked mobile
 * - WCAG AA accessibility
 */

import React, { useMemo, useState } from 'react';
import { Search, Settings } from 'lucide-react';
import { useStore } from '../store';
import {
  DualPaneLayout,
  ControlPanel,
  ControlGroup,
  PreviewPane,
  ActionButtonGroup,
  StatusIndicator,
  CommonActions,
} from './';
import type { DetectedAgent } from '@ai-agent-config/core';

/**
 * AgentListItem — a single agent row in the left pane
 */
interface AgentListItemProps {
  agent: DetectedAgent;
  isSelected: boolean;
  onSelect: () => void;
}

function AgentListItem({ agent, isSelected, onSelect }: AgentListItemProps) {
  return (
    <div
      className={`px-4 py-3 border-b border-border cursor-pointer transition-colors ${
        isSelected ? 'bg-accent/5 border-l-2 border-l-accent' : 'hover:bg-bg-secondary/50'
      }`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="flex items-start gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
          <div className="text-xs font-bold text-accent">
            {agent.name.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-primary truncate">
            {agent.name}
          </div>
          <div className="text-xs text-tertiary font-mono truncate">
            {agent.id}
          </div>
        </div>
      </div>

      {/* Status row */}
      <div className="mb-2">
        <StatusIndicator
          status={agent.detection.installed ? 'connected' : 'disabled'}
          label={agent.detection.installed ? 'Installed' : 'Not Installed'}
          inline
        />
      </div>

      {/* Quick stats */}
      <div className="text-xs text-secondary flex gap-2 flex-wrap">
        <span className="inline-block px-2 py-0.5 bg-bg-secondary rounded">
          {agent.supports.modelProviders ? 'Has Models' : 'No Models'}
        </span>
        <span className="inline-block px-2 py-0.5 bg-bg-secondary rounded">
          {agent.supports.mcpServers ? 'Has MCP' : 'No MCP'}
        </span>
      </div>
    </div>
  );
}

/**
 * AgentConfigPreview — right pane showing selected agent details
 */
interface AgentConfigPreviewProps {
  agent: DetectedAgent;
  onConfigure: () => void;
}

function AgentConfigPreview({ agent, onConfigure }: AgentConfigPreviewProps) {
  const { registry } = useStore();

  // Get associated providers and models
  const providers = registry?.providers.filter((p) =>
    p.agentIds.includes(agent.id)
  ) || [];

  const models = providers.flatMap((p) => p.models);
  const mcpServers = registry?.mcpServers.filter((s) =>
    s.agentIds.includes(agent.id)
  ) || [];

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="card">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
            <div className="text-lg font-bold text-accent">
              {agent.name.charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-primary mb-1 truncate">
              {agent.name}
            </h2>
            <p className="text-sm text-tertiary font-mono mb-2 truncate">
              {agent.id}
            </p>
            <StatusIndicator
              status={agent.detection.installed ? 'connected' : 'disabled'}
              label={agent.detection.installed ? 'Installed' : 'Not Installed'}
              inline
            />
          </div>
        </div>

        {/* Actions */}
        <ActionButtonGroup
          actions={[
            CommonActions.View(onConfigure),
            {
              label: 'Configure',
              icon: Settings,
              onClick: onConfigure,
              variant: 'primary',
            },
          ]}
          direction="row"
        />
      </div>

      {/* Configuration Support */}
      <div className="card">
        <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-widest">
          Configuration Support
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-tertiary">Model Providers</span>
            <StatusIndicator
              status={agent.supports.modelProviders ? 'connected' : 'disabled'}
              label={agent.supports.modelProviders ? 'Yes' : 'No'}
              inline
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-tertiary">MCP Servers</span>
            <StatusIndicator
              status={agent.supports.mcpServers ? 'connected' : 'disabled'}
              label={agent.supports.mcpServers ? 'Yes' : 'No'}
              inline
            />
          </div>
        </div>
      </div>

      {/* Installed Providers */}
      {providers.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-widest">
            Providers ({providers.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {providers.map((p) => (
              <span
                key={p.provider.id}
                className="inline-block px-3 py-1.5 text-xs bg-accent/10 text-accent rounded font-medium"
              >
                {p.provider.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Available Models */}
      {models.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-widest">
            Models ({models.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {models.slice(0, 10).map((m) => (
              <span
                key={m.id}
                className="inline-block px-2 py-1 text-xs font-mono bg-bg-secondary text-secondary rounded"
              >
                {m.name}
              </span>
            ))}
            {models.length > 10 && (
              <span className="inline-block px-2 py-1 text-xs text-tertiary">
                +{models.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* MCP Servers */}
      {mcpServers.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-widest">
            MCP Servers ({mcpServers.length})
          </h3>
          <div className="space-y-1">
            {mcpServers.slice(0, 5).map((server) => (
              <div key={server.id} className="text-xs text-secondary">
                {server.name}
              </div>
            ))}
            {mcpServers.length > 5 && (
              <div className="text-xs text-tertiary pt-2 border-t border-border">
                +{mcpServers.length - 5} more MCP server(s)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Installation info */}
      {agent.detection.installed && agent.detection.binaryPath && (
        <div className="card">
          <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-widest">
            Binary Location
          </h3>
          <div className="text-xs font-mono text-tertiary break-all bg-bg-secondary rounded p-2">
            {agent.detection.binaryPath}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * AgentsViewIC — Main refactored component
 */
export const AgentsViewIC: React.FC = () => {
  const { registry, agents, setActiveView } = useStore();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(agents[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByStatus, setFilterByStatus] = useState<'all' | 'installed' | 'not-installed'>(
    'all'
  );

  // Filter agents
  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      // Search filter
      const matchesSearch =
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.id.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Status filter
      if (filterByStatus === 'installed') return agent.detection.installed;
      if (filterByStatus === 'not-installed') return !agent.detection.installed;

      return true;
    });
  }, [agents, searchQuery, filterByStatus]);

  const selectedAgent = selectedAgentId
    ? agents.find((a) => a.id === selectedAgentId)
    : null;

  const handleConfigureAgent = () => {
    if (selectedAgent) {
      setActiveView('agents');
      // Could also open a configuration modal/page
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title mb-2">Installed Agents</h1>
        <p className="text-secondary text-sm">
          Manage agent configurations, providers, models, and integrations.
        </p>
      </div>

      {agents.length === 0 ? (
        // Empty state
        <div className="card">
          <div className="empty-state">
            <Settings size={64} className="empty-state-icon" />
            <h3 className="empty-state-title">No Agents Detected</h3>
            <p className="empty-state-message">
              Agent detection runs automatically when you start the app.
            </p>
          </div>
        </div>
      ) : (
        // Dual-pane layout
        <DualPaneLayout
          controlsPanel={
            <ControlPanel>
              {/* Search */}
              <ControlGroup label="Search">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-tertiary"
                  />
                  <input
                    type="text"
                    placeholder="Search agents..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-bg-primary text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </div>
              </ControlGroup>

              {/* Status filter */}
              <ControlGroup label="Filter">
                {(['all', 'installed', 'not-installed'] as const).map((status) => (
                  <label
                    key={status}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="agent-status"
                      value={status}
                      checked={filterByStatus === status}
                      onChange={() => setFilterByStatus(status)}
                      className="rounded"
                    />
                    <span className="text-sm text-primary capitalize">
                      {status === 'not-installed' ? 'Not Installed' : status}
                    </span>
                  </label>
                ))}
              </ControlGroup>

              {/* Agent List */}
              <ControlGroup label={`Agents (${filteredAgents.length})`}>
                {filteredAgents.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-tertiary">No agents match your filters</p>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                    {filteredAgents.map((agent) => (
                      <AgentListItem
                        key={agent.id}
                        agent={agent}
                        isSelected={selectedAgentId === agent.id}
                        onSelect={() => setSelectedAgentId(agent.id)}
                      />
                    ))}
                  </div>
                )}
              </ControlGroup>

              {/* Stats */}
              <div className="pt-4 border-t border-border">
                <div className="text-xs text-tertiary space-y-1">
                  <p>Total: {agents.length} agent(s)</p>
                  <p>Installed: {agents.filter((a) => a.detection.installed).length}</p>
                  <p>
                    With Models:{' '}
                    {agents.filter((a) => a.supports.modelProviders).length}
                  </p>
                </div>
              </div>
            </ControlPanel>
          }
          previewPane={
            <PreviewPane
              isEmpty={!selectedAgent}
              emptyIcon={<Settings size={48} className="text-tertiary opacity-50" />}
              emptyMessage="Select an agent to view configuration"
            >
              {selectedAgent && (
                <AgentConfigPreview
                  agent={selectedAgent}
                  onConfigure={handleConfigureAgent}
                />
              )}
            </PreviewPane>
          }
          controlsBasis="38%"
          previewBasis="62%"
        />
      )}
    </div>
  );
};

export default AgentsViewIC;
