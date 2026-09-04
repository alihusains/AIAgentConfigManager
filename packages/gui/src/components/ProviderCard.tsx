import { useCallback, useState } from 'react';
import { Edit, Trash2, Eye, Zap, Database } from 'lucide-react';
import { Tooltip } from '../ui';
import { AgentIcon } from './AgentIcon';
import { AgentPicker } from './AgentPicker';
import type { ModelProvider, ProviderApiCapabilities, DetectedAgent } from '@ai-agent-config/core';

const AVATAR_STACK_MAX = 4;

function initialsFor(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

/**
 * Some agent config formats cannot store model providers at all (Pi, Junie,
 * FreeBuff, OMP manage their own model lists). Registry entries still record
 * them, but nothing is ever written to their files — surface that honestly
 * instead of showing them as normal installs.
 */
function agentTakesModels(agents: DetectedAgent[], id: string): boolean {
  return agents.find((a) => a.id === id)?.supports.modelProviders ?? true;
}

interface ProviderCardProps {
  provider: ModelProvider;
  modelCount: number;
  apiCapabilities?: ProviderApiCapabilities;
  agentIds?: string[];
  agents?: DetectedAgent[];
  onToggleAgent?: (agentId: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onDetails: () => void;
}

export function ProviderCard({
  provider,
  modelCount,
  apiCapabilities,
  agentIds,
  agents,
  onToggleAgent,
  onEdit,
  onDelete,
  onDetails,
}: ProviderCardProps) {
  // Lift this card's stacking context while its agent-picker popover is open.
  // The popover lives inside the card, but grid items each create their own
  // stacking context — so without this, the NEXT card in the grid paints over
  // the popover (z-index on the popover alone can't escape the card).
  const [pickerOpen, setPickerOpen] = useState(false);
  const handlePickerOpenChange = useCallback((open: boolean) => setPickerOpen(open), []);

  // Provider type colors — uses design system tokens for consistency
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'openai-compatible':
      case 'anthropic-compatible':
      case 'native':
      case 'bedrock':
      case 'vertex':
      default:
        // Use design system tokens: bg-bg-secondary, border-border-primary
        return 'bg-bg-secondary border-border-primary';
    }
  };

  // Badge colors — uses design system accent tokens
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'openai-compatible':
      case 'anthropic-compatible':
      case 'native':
      case 'bedrock':
      case 'vertex':
      default:
        // Use design system token: bg-accent-primary with reduced opacity
        return 'bg-accent-primary/10 text-accent-primary';
    }
  };

  const typeDisplay: Record<string, string> = {
    'openai-compatible': 'OpenAI Compatible',
    'anthropic-compatible': 'Anthropic Compatible',
    anthropic: 'Anthropic Native',
    native: 'Native API',
    bedrock: 'AWS Bedrock',
    vertex: 'Google Vertex',
  };
  const typeLabel = typeDisplay[provider.type] || provider.type;

  const supportedApis = apiCapabilities?.supported.map((api) => {
    if (api === 'chat') return 'Chat Completions';
    if (api === 'responses') return 'Responses';
    if (api === 'anthropic') return 'Anthropic Messages';
    return api;
  });

  return (
    <div
      className={`
        border rounded-2xl p-5 transition-all duration-200
        hover:shadow-lg hover:border-opacity-60
        ${getTypeColor(provider.type)}
        backdrop-blur-sm
        card
        ${pickerOpen ? 'z-[110]' : ''}
      `}
    >
      {/* Header: Refined typography hierarchy */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[15px] leading-tight text-text-primary truncate">
            {provider.name}
          </h3>
          <p className="text-[12px] text-text-secondary font-mono truncate mt-1">{provider.id}</p>
        </div>
        <div
          className={`
            px-2.5 py-1 rounded-full text-[11px] font-medium flex-shrink-0
            ${getTypeBadgeColor(provider.type)}
            tracking-[0.3px]
          `}
        >
          {typeLabel}
        </div>
      </div>

      {/* Status indicators: Intentional spacing and micro-hierarchy */}
      <div className="flex items-center gap-4 mb-4 text-[12px]">
        {provider.enabled ? (
          <span className="flex items-center gap-1.5 text-accent-primary">
            <span className="w-2 h-2 rounded-full bg-accent-primary" />
            <span className="font-medium">Active</span>
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-text-tertiary">
            <span className="w-2 h-2 rounded-full bg-border-primary" />
            <span>Disabled</span>
          </span>
        )}

        {apiCapabilities?.supported && apiCapabilities.supported.length > 0 && (
          <span className="flex items-center gap-1 text-accent-primary font-medium">
            <Zap size={11} strokeWidth={2.5} />
            Verified
          </span>
        )}
      </div>

      {/* API Support Badges: Restrained, minimal visual noise */}
      {supportedApis && supportedApis.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {supportedApis.map((api) => (
            <span
              key={api}
              className="text-[11px] px-2 py-1 rounded-md bg-bg-tertiary border border-border-primary text-text-secondary font-medium"
            >
              {api}
            </span>
          ))}
        </div>
      )}

      {/* Model count: Subtle secondary information */}
      <div className="mb-4 text-[12px] text-text-tertiary">
        <span className="flex items-center gap-2">
          <Database size={13} strokeWidth={1.5} className="flex-shrink-0" />
          <span className="font-medium">
            {modelCount} model{modelCount !== 1 ? 's' : ''}
          </span>
        </span>
      </div>

      {/* Installed On: per-agent avatar stack with hover-reveal remove, plus
          the AgentPicker "+" for adding/removing agents via checkboxes
          (restored from the legacy table view — this is how providers get
          assigned to / removed from agents). */}
      {agentIds && agents && onToggleAgent && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-1.5">
            <p className="text-[11px] text-text-tertiary uppercase tracking-wide">
              Installed On
            </p>
            <AgentPicker
              kind="provider"
              installedOnly
              targets={agentIds}
              agents={agents}
              onToggle={onToggleAgent}
              onOpenChange={handlePickerOpenChange}
            />
          </div>
          {agentIds.length === 0 ? (
            <span className="text-xs text-text-tertiary">none</span>
          ) : (
            <div className="avatar-stack">
              {agentIds.slice(0, AVATAR_STACK_MAX).map((id) => {
                const agent = agents.find((a) => a.id === id);
                const supported = agentTakesModels(agents, id);
                const name = agent?.name || id;
                return (
                  <Tooltip
                    key={id}
                    content={
                      supported
                        ? name
                        : `${name} — config format cannot store model providers (not written to its files)`
                    }
                  >
                    <span className={`avatar${supported ? '' : ' avatar-dim'}`}>
                      {agent ? (
                        <AgentIcon id={agent.id} size={14} />
                      ) : (
                        <span className="avatar-initials">{initialsFor(name)}</span>
                      )}
                    </span>
                  </Tooltip>
                );
              })}
              {agentIds.length > AVATAR_STACK_MAX && (
                <Tooltip content={`${agentIds.length - AVATAR_STACK_MAX} more agent(s)`}>
                  <span className="avatar avatar-more">+{agentIds.length - AVATAR_STACK_MAX}</span>
                </Tooltip>
              )}
              <div className="avatar-pop">
                {agentIds.map((id) => {
                  const agent = agents.find((a) => a.id === id);
                  const supported = agentTakesModels(agents, id);
                  const name = agent?.name || id;
                  return (
                    <Tooltip
                      key={id}
                      content={
                        supported
                          ? undefined
                          : `${name}'s config format cannot store model providers — nothing was written to its files`
                      }
                      disabled={supported}
                    >
                      <span className={`avatar-pop-row${supported ? '' : ' avatar-dim'}`}>
                        {agent ? (
                          <AgentIcon id={agent.id} size={14} />
                        ) : (
                          <span className="avatar-initials">{initialsFor(name)}</span>
                        )}
                        <span className="avatar-pop-name">{name}</span>
                        <button
                          type="button"
                          className="avatar-pop-remove"
                          aria-label={`Remove from ${name}`}
                          onClick={() => onToggleAgent(id)}
                        >
                          ×
                        </button>
                      </span>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons: Premium micro-interactions */}
      <div className="flex gap-1 pt-4 border-t border-border-primary">
        <Tooltip content="View details">
          <button
            type="button"
            onClick={onDetails}
            className="flex-1 px-2 py-2 text-[12px] rounded-lg font-medium transition-colors duration-150
              text-text-secondary hover:text-text-primary
              hover:bg-bg-tertiary"
            aria-label="View details"
          >
            <Eye size={13} className="inline mr-1" />
            Details
          </button>
        </Tooltip>
        <Tooltip content="Edit provider">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 px-2 py-2 text-[12px] rounded-lg font-medium transition-colors duration-150
              text-text-secondary hover:text-text-primary
              hover:bg-bg-tertiary"
            aria-label="Edit provider"
          >
            <Edit size={13} className="inline mr-1" />
            Edit
          </button>
        </Tooltip>
        <Tooltip content="Delete provider">
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 px-2 py-2 text-[12px] rounded-lg font-medium transition-colors duration-150
              text-accent-error hover:text-accent-error
              hover:bg-accent-error/10"
            aria-label="Delete provider"
          >
            <Trash2 size={13} className="inline mr-1" />
            Delete
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
