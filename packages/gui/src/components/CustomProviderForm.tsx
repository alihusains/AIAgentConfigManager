import { useState, useEffect } from 'react';
import { Plus, Eye, EyeOff } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import { Tooltip } from '../ui';
import type { ModelProvider, ModelConfig, DetectedAgent, ProviderApiCapabilities } from '@ai-agent-config/core';

interface PrefilledProvider {
  name: string;
  baseUrl: string;
  logoUrl?: string;
  apiType?: 'openai-compatible' | 'anthropic-compatible' | 'custom';
}

interface CustomProviderFormProps {
  onClose: () => void;
  agents: DetectedAgent[];
  existingIds: string[];
  prefilledProvider?: PrefilledProvider;
}

const DEFAULT_ROLES: ModelConfig['roles'] = ['chat', 'edit', 'apply', 'summarize'];

export function CustomProviderForm({ onClose, agents, existingIds, prefilledProvider }: CustomProviderFormProps) {
  const { addToast, refreshAll } = useStore();
  
  // Initialize with prefilled data if provided
  const defaultAgents = agents
    .filter((a) => a.detection.installed && a.supports.modelProviders)
    .map((a) => a.id);

  // Only installed agents with provider-capable config formats are offered.
  const installableAgents = agents.filter(
    (a) => a.supports.modelProviders && a.detection.installed
  );

  const [form, setForm] = useState({
    id: prefilledProvider?.name?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || '',
    name: prefilledProvider?.name || '',
    baseUrl: prefilledProvider?.baseUrl || '',
    logoUrl: prefilledProvider?.logoUrl || '',
    apiType: prefilledProvider?.apiType || 'openai-compatible' as 'openai-compatible' | 'anthropic-compatible' | 'custom',
    authMethod: 'api-key' as 'api-key' | 'bearer' | 'custom-header',
    authHeaderName: 'Authorization',
    apiKey: '',
    defaultModel: '',
    features: {
      vision: false,
      reasoning: false,
      functionCalling: false,
      streaming: true,
    },
    rateLimitRequests: '',
    rateLimitWindow: '',
    targetAgentIds: defaultAgents,
  });
  
  const [showApiKey, setShowApiKey] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [logoPreviewError, setLogoPreviewError] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    
    if (!form.id.trim()) e.id = 'Provider ID is required';
    else if (!/^[a-z0-9-]+$/.test(form.id)) e.id = 'ID must contain only lowercase letters, numbers, and hyphens';
    else if (existingIds.includes(form.id)) e.id = 'This ID already exists';
    
    if (!form.name.trim()) e.name = 'Provider name is required';
    if (!form.baseUrl.trim()) e.baseUrl = 'Base URL is required';
    else {
      try {
        new URL(form.baseUrl);
      } catch {
        e.baseUrl = 'Invalid URL format';
      }
    }
    
    if (!form.apiKey.trim()) e.apiKey = 'API key is required';
    
    if (form.authMethod === 'custom-header' && !form.authHeaderName.trim()) {
      e.authHeaderName = 'Header name is required';
    }
    
    if (form.logoUrl && !isValidUrl(form.logoUrl)) {
      e.logoUrl = 'Invalid logo URL';
    }
    
    if (form.targetAgentIds.length === 0) {
      e.targetAgentIds = 'Select at least one agent';
    }
    
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate() || submitting) return;

    setSubmitting(true);

    try {
      const config: Record<string, unknown> = {
        apiKey: form.apiKey,
        baseUrl: form.baseUrl,
      };

      if (form.authMethod !== 'api-key') {
        config.authMethod = form.authMethod;
        if (form.authMethod === 'custom-header') {
          config.authHeaderName = form.authHeaderName;
        }
      }

      if (form.logoUrl) {
        config.logoUrl = form.logoUrl;
      }

      if (form.rateLimitRequests && form.rateLimitWindow) {
        config.rateLimit = {
          requests: parseInt(form.rateLimitRequests),
          window: parseInt(form.rateLimitWindow),
        };
      }

      const provider: ModelProvider = {
        id: form.id.trim(),
        name: form.name.trim(),
        type: form.apiType === 'custom' ? 'native' : form.apiType,
        config,
        enabled: true,
        priority: 0,
      };

      const models: ModelConfig[] = form.defaultModel.trim()
        ? [
            {
              id: form.defaultModel.trim(),
              providerId: provider.id,
              name: form.defaultModel.trim(),
              displayName: form.defaultModel.trim(),
              roles: [...DEFAULT_ROLES],
              capabilities: [
                'tool_use',
                form.features.vision ? 'vision' : null,
                form.features.reasoning ? 'reasoning' : null,
                form.features.functionCalling ? 'function_calling' : null,
              ].filter(Boolean) as string[],
            },
          ]
        : [];

      const res = await api.addProvider(provider, models, form.targetAgentIds);

      if (!res || !res.ok) {
        addToast({
          type: 'error',
          title: 'Failed to Add Provider',
          message: res?.error || 'Unknown error occurred',
        });
        return;
      }

      addToast({
        type: 'success',
        title: 'Custom Provider Added',
        message: `"${provider.name}" has been registered and installed`,
      });

      await refreshAll();
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Error Adding Provider',
        message: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Provider Identity */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Provider Identity</h3>
        <div className="space-y-3">
          <div className="form-group">
            <label className="form-label">Provider ID *</label>
            <input
              className={`input ${errors.id ? 'input-error' : ''} ${prefilledProvider ? 'opacity-60 cursor-not-allowed' : ''}`}
              placeholder="e.g., my-custom-llm"
              value={form.id}
              onChange={(e) => !prefilledProvider && set({ id: e.target.value })}
              disabled={!!prefilledProvider}
            />
            {errors.id && <p className="form-help text-error">{errors.id}</p>}
            <p className="form-help">Lowercase letters, numbers, and hyphens only</p>
          </div>

          <div className="form-group">
            <label className="form-label">Display Name *</label>
            <input
              className={`input ${errors.name ? 'input-error' : ''} ${prefilledProvider ? 'opacity-60 cursor-not-allowed' : ''}`}
              placeholder="e.g., My Custom LLM"
              value={form.name}
              onChange={(e) => !prefilledProvider && set({ name: e.target.value })}
              disabled={!!prefilledProvider}
            />
            {errors.name && <p className="form-help text-error">{errors.name}</p>}
            {prefilledProvider && <p className="form-help text-secondary">Auto-populated from catalog</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Logo URL {prefilledProvider && '(from catalog)'}</label>
            <div className="flex gap-2">
              <input
                className={`input flex-1 ${errors.logoUrl ? 'input-error' : ''} ${prefilledProvider ? 'opacity-60 cursor-not-allowed' : ''}`}
                placeholder="https://..."
                value={form.logoUrl}
                onChange={(e) => !prefilledProvider && set({ logoUrl: e.target.value })}
                disabled={!!prefilledProvider}
              />
              {form.logoUrl && !logoPreviewError && (
                <div className="flex items-center justify-center px-3 py-2 rounded-lg border border-border">
                  <img
                    src={form.logoUrl}
                    alt="Logo preview"
                    className="h-6 w-6 object-contain"
                    onError={() => setLogoPreviewError(true)}
                  />
                </div>
              )}
            </div>
            {errors.logoUrl && <p className="form-help text-error">{errors.logoUrl}</p>}
            {logoPreviewError && form.logoUrl && (
              <p className="form-help text-warning mt-2">Logo could not be loaded</p>
            )}
          </div>
        </div>
      </div>

      {/* API Configuration */}
      <div>
        <h3 className="text-sm font-semibold mb-3">API Configuration</h3>
        <div className="space-y-3">
          <div className="form-group">
            <label className="form-label">Base URL * {prefilledProvider && '(from catalog)'}</label>
            <input
              className={`input ${errors.baseUrl ? 'input-error' : ''} ${prefilledProvider ? 'opacity-60 cursor-not-allowed' : ''}`}
              placeholder="https://api.example.com/v1"
              value={form.baseUrl}
              onChange={(e) => !prefilledProvider && set({ baseUrl: e.target.value })}
              disabled={!!prefilledProvider}
            />
            {errors.baseUrl && <p className="form-help text-error">{errors.baseUrl}</p>}
            {prefilledProvider && <p className="form-help text-secondary">From provider catalog</p>}
          </div>

          <div className="form-group">
            <label className="form-label">API Type {prefilledProvider && '(from catalog)'}</label>
            <select
              className={`input select ${prefilledProvider ? 'opacity-60 cursor-not-allowed' : ''}`}
              value={form.apiType}
              onChange={(e) => !prefilledProvider && set({ apiType: e.target.value as any })}
              disabled={!!prefilledProvider}
            >
              <option value="openai-compatible">OpenAI Compatible</option>
              <option value="anthropic-compatible">Anthropic Compatible</option>
              <option value="custom">Custom / Other</option>
            </select>
            <p className="form-help">How this provider's API format is structured</p>
          </div>

          <div className="form-group">
            <label className="form-label">Authentication Method</label>
            <select
              className="input select"
              value={form.authMethod}
              onChange={(e) => set({ authMethod: e.target.value as any })}
            >
              <option value="api-key">API Key in Authorization header</option>
              <option value="bearer">Bearer Token</option>
              <option value="custom-header">Custom Header</option>
            </select>
          </div>

          {form.authMethod === 'custom-header' && (
            <div className="form-group">
              <label className="form-label">Header Name *</label>
              <input
                className={`input ${errors.authHeaderName ? 'input-error' : ''}`}
                placeholder="X-API-Key"
                value={form.authHeaderName}
                onChange={(e) => set({ authHeaderName: e.target.value })}
              />
              {errors.authHeaderName && (
                <p className="form-help text-error">{errors.authHeaderName}</p>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">API Key * <span className="text-error">(Required)</span></label>
            <div className="relative">
              <input
                className={`input pr-10 ${errors.apiKey ? 'input-error' : ''}`}
                type={showApiKey ? 'text' : 'password'}
                placeholder="sk-…"
                value={form.apiKey}
                onChange={(e) => set({ apiKey: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.apiKey && <p className="form-help text-error">{errors.apiKey}</p>}
            <p className="form-help">Your API key will be securely stored. You can optionally migrate it to the OS keychain later.</p>
          </div>
        </div>
      </div>

      {/* Model Configuration */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Model Configuration</h3>
        <div className="space-y-3">
          <div className="form-group">
            <label className="form-label">Default Model (optional)</label>
            <input
              className="input"
              placeholder="e.g., model-name-123"
              value={form.defaultModel}
              onChange={(e) => set({ defaultModel: e.target.value })}
            />
            <p className="form-help">Primary model to use with this provider</p>
          </div>

          <div className="form-group">
            <label className="form-label">Capabilities</label>
            <div className="space-y-2">
              {[
                { key: 'vision', label: '👁️ Vision (image understanding)' },
                { key: 'reasoning', label: '🧠 Reasoning (extended thinking)' },
                { key: 'functionCalling', label: '🔧 Function Calling' },
                { key: 'streaming', label: '🌊 Streaming' },
              ].map(({ key, label }) => (
                <label key={key} className="checkbox-wrapper">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={(form.features as any)[key]}
                    onChange={(e) =>
                      set({
                        features: {
                          ...form.features,
                          [key]: e.target.checked,
                        },
                      })
                    }
                  />
                  <span className="checkbox-label">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Rate Limiting */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Rate Limiting (optional)</h3>
        <div className="space-y-3">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Requests</label>
              <input
                className="input"
                type="number"
                placeholder="100"
                value={form.rateLimitRequests}
                onChange={(e) => set({ rateLimitRequests: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Per (seconds)</label>
              <input
                className="input"
                type="number"
                placeholder="60"
                value={form.rateLimitWindow}
                onChange={(e) => set({ rateLimitWindow: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Agent Installation — only installed agents whose config format
          can actually store model providers */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Install Into Agents</h3>
        <div className="border rounded overflow-auto" style={{ maxHeight: 160 }}>
          {installableAgents.map((agent) => {
            const supported = agent.supports.modelProviders;
            return (
              <Tooltip
                key={agent.id}
                content={
                  supported
                    ? undefined
                    : `${agent.name}'s config format cannot store model providers`
                }
                disabled={supported}
              >
                <label
                  className={`flex items-center gap-2 px-2 py-1 hover:bg-bg-hover ${
                    supported ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={form.targetAgentIds.includes(agent.id)}
                    disabled={!supported}
                    onChange={(e) =>
                      set({
                        targetAgentIds: e.target.checked
                          ? [...form.targetAgentIds, agent.id]
                          : form.targetAgentIds.filter((id) => id !== agent.id),
                      })
                    }
                  />
                  <span className="flex-1 text-sm">{agent.name}</span>
                </label>
              </Tooltip>
            );
          })}
          {installableAgents.length === 0 && (
            <p className="px-3 py-4 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
              No installed agents can store model providers — install one first.
            </p>
          )}
        </div>
        {errors.targetAgentIds && (
          <p className="form-help text-error mt-2">{errors.targetAgentIds}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4">
        <button type="button" className="btn-secondary flex-1" onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={submitting}>
          <Plus size={16} />
          Add Custom Provider
        </button>
      </div>
    </form>
  );
}
