import { useEffect, useRef, useState } from 'react';
import { Plus, Bot } from 'lucide-react';
import type { DetectedAgent } from '@ai-agent-config/core';

export interface AgentPickerProps {
  /** Agent ids currently installed for this provider / server */
  targets: string[];
  /** All agents that can be targets (detected + custom) */
  agents: DetectedAgent[];
  /** Called immediately when a checkbox is toggled (add or remove) */
  onToggle: (agentId: string) => void;
}

/**
 * "+" button that opens a popover listing every agent with a checkbox.
 * Toggling a checkbox installs/removes the registry entry immediately.
 */
export function AgentPicker({ targets, agents, onToggle }: AgentPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn-ghost btn-icon btn-sm"
        title="Install / remove this entry on agents"
        onClick={() => setOpen((o) => !o)}
      >
        <Plus size={14} />
      </button>
      {open && (
        <div className="popover">
          <div className="flex items-center gap-2 px-1 py-1 mb-1">
            <Bot size={14} className="text-accent" />
            <span className="text-xs font-semibold">Install on agents</span>
          </div>
          {agents.length === 0 && (
            <p className="text-xs text-tertiary px-1 py-2">No agents available</p>
          )}
          {agents.map((agent) => {
            const checked = targets.includes(agent.id);
            return (
              <label
                key={agent.id}
                className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded hover:bg-bg-hover"
              >
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={checked}
                  onChange={() => onToggle(agent.id)}
                />
                <span className="flex-1 text-sm truncate">{agent.name}</span>
                {agent.detection.installed ? (
                  <span className="badge badge-success">on</span>
                ) : (
                  <span className="text-xs text-tertiary">path-based</span>
                )}
              </label>
            );
          })}
          <p className="text-xs text-tertiary px-1 pt-1 mt-1 border-t">
            Entries are materialized into each agent's config file.
          </p>
        </div>
      )}
    </div>
  );
}