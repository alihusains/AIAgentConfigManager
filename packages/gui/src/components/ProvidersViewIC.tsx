/**
 * ProvidersView Refactored — IC Signature Dual-Pane Theme
 *
 * Refactored provider management interface using Infrastructure Control
 * plane design patterns. Dual-pane layout with provider list (left) and
 * selected provider details (right).
 *
 * Design:
 * - Left pane: Provider list with filters
 * - Right pane: Selected provider details/preview
 * - Responsive: side-by-side desktop, stacked mobile
 * - High-contrast, professional, efficient
 * - Dark mode support
 * - WCAG AA accessibility
 */

import { useState, useEffect } from 'react';
import { Plus, Database, Search, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import { AddProviderModal } from './AddProviderModal';
import { CustomProviderForm } from './CustomProviderForm';
import { ProviderCard } from './ProviderCard';
import { EditProviderModal, ProviderDetailsModal } from './ProvidersView';
import {
  DualPaneLayout,
  ControlPanel,
  ControlGroup,
  PreviewPane,
  ActionButton,
  ActionButtonGroup,
  StatusIndicator,
  CommonActions,
} from './';
import type { ModelProvider, RegistryProvider } from '@ai-agent-config/core';
import type { KnownProvider } from '../data/known-providers';

interface ProviderListItemProps {
  provider: ModelProvider;
  isSelected: boolean;
  onSelect: () => void;
  modelCount: number;
  agentCount: number;
  onDelete: () => void;
  onEdit: () => void;
}

/**
 * ProviderListItem — a single provider row in the left pane list
 */
function ProviderListItem({
  provider,
  isSelected,
  onSelect,
  modelCount,
  agentCount,
  onDelete,
  onEdit,
}: ProviderListItemProps) {
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
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-primary truncate">
            {provider.name}
          </div>
          <div className="text-xs text-tertiary font-mono truncate">
            {provider.id}
          </div>
        </div>
        <StatusIndicator
          status={provider.enabled ? 'connected' : 'disabled'}
          label={provider.enabled ? 'On' : 'Off'}
          inline
        />
      </div>

      {/* Metadata row */}
      <div className="text-xs text-secondary flex gap-3 mb-2">
        <span>{modelCount} models</span>
        <span>•</span>
        <span>{agentCount} agents</span>
      </div>

      {/* Actions row (only on hover/selection) */}
      {isSelected && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-border/50">
          <ActionButton
            label="Edit"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            variant="ghost"
            className="flex-1 py-1.5 px-2 text-xs"
          />
          <ActionButton
            label="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            variant="danger"
            className="flex-1 py-1.5 px-2 text-xs"
          />
        </div>
      )}
    </div>
  );
}

/**
 * ProviderDetailsPreview — right pane content showing selected provider details
 */
interface ProviderDetailsPreviewProps {
  entry: RegistryProvider;
  onEdit: () => void;
  onDelete: () => void;
}

function ProviderDetailsPreview({
  entry,
  onEdit,
  onDelete,
}: ProviderDetailsPreviewProps) {
  const { registry } = useStore();

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-primary mb-1">
              {entry.provider.name}
            </h2>
            <p className="text-sm text-tertiary font-mono">
              {entry.provider.id}
            </p>
          </div>
          <StatusIndicator
            status={entry.provider.enabled ? 'connected' : 'disabled'}
            label={entry.provider.enabled ? 'Enabled' : 'Disabled'}
          />
        </div>

        {/* Actions */}
        <ActionButtonGroup
          actions={[
            CommonActions.Edit(onEdit),
            CommonActions.Delete(onDelete),
          ]}
          direction="row"
        />
      </div>

      {/* Overview */}
      <div className="card">
        <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-widest">
          Overview
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-tertiary">Type</span>
            <span className="font-medium text-primary">
              {entry.provider.type}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-tertiary">Status</span>
            <span className="font-medium text-primary">
              {entry.provider.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          {entry.apiCapabilities?.verifiedAt && (
            <div className="flex justify-between">
              <span className="text-tertiary">Last Verified</span>
              <span className="text-xs font-mono text-primary">
                {new Date(entry.apiCapabilities.verifiedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Models */}
      {entry.models.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-widest">
            Models ({entry.models.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {entry.models.map((m) => (
              <span
                key={m.id}
                className="inline-block px-2 py-1 text-xs font-mono bg-bg-secondary text-secondary rounded"
              >
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Agents */}
      {entry.agentIds.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-secondary mb-3 uppercase tracking-widest">
            Installed On ({entry.agentIds.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {entry.agentIds.map((agentId) => {
              const agent = registry?.agents.find((a) => a.id === agentId);
              return (
                <span
                  key={agentId}
                  className="inline-block px-2 py-1 text-xs bg-accent/10 text-accent rounded font-medium"
                >
                  {agent?.name || agentId}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ProvidersViewIC — Main refactored component
 */
export function ProvidersViewIC() {
  const { registry, agents, loading, refreshAll, deleteProvider } = useStore();
  const [showCatalog, setShowCatalog] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const providers = registry?.providers || [];

  // Filter providers based on search
  const filteredProviders = providers.filter((p) =>
    p.provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.provider.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected provider details
  const selectedEntry = selectedProviderId
    ? providers.find((p) => p.provider.id === selectedProviderId)
    : null;

  const handleAddFromCatalog = async (catalogProvider: KnownProvider) => {
    try {
      const provider: ModelProvider = {
        id: catalogProvider.id,
        name: catalogProvider.name,
        type: catalogProvider.type,
        config: {
          baseUrl: catalogProvider.baseUrl,
        },
        enabled: true,
        priority: 0,
      };

      const targetAgents = agents
        .filter((a) => a.detection.installed && a.supports.modelProviders)
        .map((a) => a.id);

      if (targetAgents.length === 0) {
        useStore.getState().addToast({
          type: 'warning',
          title: 'No Compatible Agents',
          message: 'No agents found that support model providers',
        });
        return;
      }

      const res = await api.addProvider(provider, [], targetAgents);

      if (!res || !res.ok) {
        useStore.getState().addToast({
          type: 'error',
          title: 'Failed to Add Provider',
          message: res?.error || 'Unknown error',
        });
        return;
      }

      useStore.getState().addToast({
        type: 'success',
        title: 'Provider Added',
        message: `"${provider.name}" has been added`,
      });

      await refreshAll();
      setShowCatalog(false);
    } catch (error) {
      useStore.getState().addToast({
        type: 'error',
        title: 'Error',
        message: error instanceof Error ? error.message : 'An error occurred',
      });
    }
  };

  const handleDelete = async (provider: ModelProvider) => {
    const entry = registry?.providers.find((p) => p.provider.id === provider.id);
    const installed = entry?.agentIds.length || 0;

    if (
      !confirm(
        `Delete provider "${provider.name}"?\n\nIt is installed on ${installed} agent(s).`
      )
    ) {
      return;
    }

    await deleteProvider(provider.id);
    setSelectedProviderId(null);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title mb-2">Model Providers</h1>
        <p className="text-secondary text-sm">
          Define model providers once, install across multiple agents.
        </p>
      </div>

      {providers.length === 0 ? (
        // Empty state
        <div className="card">
          <div className="empty-state">
            <Database size={64} className="empty-state-icon" />
            <h3 className="empty-state-title">No Providers Registered</h3>
            <p className="empty-state-message">
              Add a model provider to begin distributing models across agents.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-6 justify-center">
              <button
                className="btn-primary flex items-center justify-center gap-2"
                onClick={() => setShowCatalog(true)}
              >
                <Plus size={16} />
                Add Provider
              </button>
              <button
                className="btn-secondary flex items-center justify-center gap-2"
                onClick={() => setShowCustomForm(true)}
              >
                <Plus size={16} />
                Custom
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Dual-pane layout
        <>
          {/* Action buttons above layout */}
          <div className="mb-6 flex gap-2">
            <button
              className="btn-primary flex items-center gap-2"
              onClick={() => setShowCatalog(true)}
              disabled={loading}
            >
              <Plus size={16} />
              Add Provider
            </button>
            <button
              className="btn-secondary flex items-center gap-2"
              onClick={() => setShowCustomForm(true)}
              disabled={loading}
            >
              <Plus size={16} />
              Custom
            </button>
          </div>

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
                      placeholder="Search providers..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-border rounded-lg bg-bg-primary text-primary placeholder-tertiary focus:outline-none focus:ring-2 focus:ring-accent/50"
                    />
                  </div>
                </ControlGroup>

                {/* Provider List */}
                {filteredProviders.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertTriangle size={32} className="mx-auto mb-2 text-tertiary opacity-50" />
                    <p className="text-sm text-tertiary">No providers match your search</p>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-hidden">
                    {filteredProviders.map(({ provider, models, agentIds }) => (
                      <ProviderListItem
                        key={provider.id}
                        provider={provider}
                        isSelected={selectedProviderId === provider.id}
                        onSelect={() => setSelectedProviderId(provider.id)}
                        modelCount={models.length}
                        agentCount={agentIds.length}
                        onDelete={() => handleDelete(provider)}
                        onEdit={() => setEditingProvider(provider)}
                      />
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className="pt-4 border-t border-border">
                  <div className="text-xs text-tertiary">
                    <p>Total: {providers.length} provider(s)</p>
                    <p>Enabled: {providers.filter((p) => p.provider.enabled).length}</p>
                  </div>
                </div>
              </ControlPanel>
            }
            previewPane={
              <PreviewPane
                isEmpty={!selectedEntry}
                emptyIcon={<Database size={48} className="text-tertiary opacity-50" />}
                emptyMessage="Select a provider to view details"
              >
                {selectedEntry && (
                  <ProviderDetailsPreview
                    entry={selectedEntry}
                    onEdit={() => setEditingProvider(selectedEntry.provider)}
                    onDelete={() => handleDelete(selectedEntry.provider)}
                  />
                )}
              </PreviewPane>
            }
          />
        </>
      )}

      {/* Modals */}
      {showCatalog && (
        <AddProviderModal 
          onClose={() => setShowCatalog(false)} 
          agents={agents}
          existingIds={providers.map((p) => p.provider.id)}
        />
      )}

      {showCustomForm && (
        <div
          className="modal-overlay"
          onClick={() => setShowCustomForm(false)}
        >
          <div
            className="modal modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">Add Custom Provider</h2>
              <button
                className="modal-close"
                onClick={() => setShowCustomForm(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <CustomProviderForm
                onClose={() => setShowCustomForm(false)}
                agents={agents}
                existingIds={providers.map((p) => p.provider.id)}
              />
            </div>
          </div>
        </div>
      )}

      {editingProvider && (
        <EditProviderModal provider={editingProvider} onClose={() => setEditingProvider(null)} />
      )}
    </div>
  );
}

export default ProvidersViewIC;
