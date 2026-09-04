import { useState } from 'react';
import { Plus, Database } from 'lucide-react';
import { useStore } from '../store';
import { AddProviderModal } from './AddProviderModal';
import { CustomProviderForm } from './CustomProviderForm';
import { ProviderCard } from './ProviderCard';
import { EditProviderModal, ProviderDetailsModal } from './ProvidersView';
import type { ModelProvider, RegistryProvider } from '@ai-agent-config/core';

export function ProvidersViewRevamped() {
  const { registry, agents, loading, deleteProvider, toggleProviderAgent } = useStore();
  const [showCatalog, setShowCatalog] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<ModelProvider | null>(null);
  const [selectedProviderDetails, setSelectedProviderDetails] = useState<RegistryProvider | null>(
    null
  );

  const providers = registry?.providers || [];

  const handleDelete = async (provider: ModelProvider) => {
    const entry = registry?.providers.find((p) => p.provider.id === provider.id);
    const installed = entry?.agentIds.length || 0;

    if (
      !confirm(
        `Delete provider "${provider.name}" from the registry?\n\nIt is currently installed on ${installed} agent(s) — those configs will be cleaned up.`
      )
    ) {
      return;
    }

    await deleteProvider(provider.id);
  };

  return (
    <div className="page-container">
      {/* Hero Header */}
      <div className="mb-8 px-4 sm:px-6 md:px-8">
        <h1 className="page-title mb-2">Model Providers</h1>
        <p className="text-secondary text-sm max-w-2xl">
          One definition per provider — the registry installs it into every agent listed. Choose
          from our curated catalog or create a custom provider.
        </p>
      </div>

      {/* Dual Action Buttons — responsive stack on mobile */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-8 px-4 sm:px-6 md:px-8">
        <button
          type="button"
          className="btn-primary flex-1 sm:flex-initial flex items-center justify-center gap-2"
          onClick={() => setShowCatalog(true)}
          disabled={loading}
        >
          <Plus size={18} />
          Add Provider
        </button>
        <button
          type="button"
          className="btn-secondary flex-1 sm:flex-initial flex items-center justify-center gap-2"
          onClick={() => setShowCustomForm(true)}
          disabled={loading}
        >
          <Plus size={18} />
          Add Custom Provider
        </button>
      </div>

      {/* Empty State */}
      {providers.length === 0 ? (
        <div className="card mx-4 sm:mx-6 md:mx-8">
          <div className="empty-state">
            <Database size={64} className="empty-state-icon" />
            <h3 className="empty-state-title">No Providers Registered</h3>
            <p className="empty-state-message max-w-sm text-center">
              Add a model provider from our curated catalog or create a custom one. Each provider
              can be installed on multiple agents.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-6 justify-center">
              <button
                type="button"
                className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
                onClick={() => setShowCatalog(true)}
              >
                <Plus size={16} />
                Add Provider
              </button>
              <button
                type="button"
                className="btn-secondary flex items-center justify-center gap-2 w-full sm:w-auto"
                onClick={() => setShowCustomForm(true)}
              >
                <Plus size={16} />
                Custom Provider
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-4 sm:px-6 md:px-8">
          {providers.map(({ provider, models, agentIds, apiCapabilities }) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              modelCount={models.length}
              apiCapabilities={apiCapabilities}
              agentIds={agentIds}
              agents={agents}
              onToggleAgent={(agentId) => toggleProviderAgent(provider.id, agentId)}
              onEdit={() => setEditingProvider(provider)}
              onDelete={() => handleDelete(provider)}
              onDetails={() =>
                setSelectedProviderDetails({
                  provider,
                  models,
                  agentIds,
                  apiCapabilities,
                })
              }
            />
          ))}
        </div>
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
          role="presentation"
          onClick={() => setShowCustomForm(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowCustomForm(false);
          }}
        >
          <div
            className="modal modal-lg"
            role="dialog"
            aria-modal="true"
            aria-label="Add Custom Provider"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            <div className="modal-header">
              <h2 className="modal-title">Add Custom Provider</h2>
              <button
                type="button"
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

      {selectedProviderDetails && (
        <ProviderDetailsModal
          entry={selectedProviderDetails}
          onClose={() => setSelectedProviderDetails(null)}
        />
      )}
    </div>
  );
}
