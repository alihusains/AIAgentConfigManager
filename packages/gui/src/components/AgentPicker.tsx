import type { DetectedAgent } from '@ai-agent-config/core';
import Bot from 'lucide-react/dist/esm/icons/bot.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Tooltip } from '../ui';
import { AgentIconTile } from './AgentIcon';

export interface AgentPickerProps {
  /** Agent ids currently installed for this provider / server */
  targets: string[];
  /** All agents that can be targets (detected + custom) */
  agents: DetectedAgent[];
  /** Called immediately when a checkbox is toggled (add or remove) */
  onToggle: (agentId: string) => void;
  /**
   * What is being installed. Providers need agents whose config format can
   * store model providers; MCP servers need MCP support.
   */
  kind?: 'provider' | 'mcp';
  /**
   * When true (providers) the popover lists only agents that are actually
   * INSTALLED on this machine AND whose config format can store the entry.
   * Agents that are not installed, or whose format cannot hold the entry,
   * are hidden entirely — there is no point offering a target that would
   * never be written to disk.
   */
  installedOnly?: boolean;
  /**
   * Fired when the popover opens/closes. Cards lift their own stacking
   * context while open so the popover isn't painted over by the next card
   * in the grid (grid items create stacking contexts, so the popover's own
   * z-index can't escape the card it lives in).
   */
  onOpenChange?: (open: boolean) => void;
}

/**
 * "+" button that opens a popover listing the agents available as targets.
 * For providers (`installedOnly`) that means installed agents with model
 * support only; every other agent is hidden from the list.
 */
export function AgentPicker({
  targets,
  agents,
  onToggle,
  kind = 'mcp',
  installedOnly = false,
  onOpenChange,
}: AgentPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Notify the parent when open state changes so it can lift its own stacking
  // context (the popover can't escape the card's stacking context on its own).
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  // Placement is measured on open: the popover is anchored right-aligned, but
  // when the button sits too close to the edge (left or right) or near the
  // bottom of the card grid, a static anchor would push it off-screen. These
  // flags flip the anchor to fit the viewport.
  const [align, setAlign] = useState<'start' | 'end'>('end');
  const [dropUp, setDropUp] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    const btn = ref.current?.querySelector('button');
    const pop = popoverRef.current;
    if (!btn || !pop) return;
    const margin = 8;
    const b = btn.getBoundingClientRect();
    const p = pop.getBoundingClientRect();
    setAlign(b.left + p.width - margin > b.right ? 'end' : 'start');
    setDropUp(b.bottom + p.height + margin > window.innerHeight && b.top - p.height - margin > 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const canTake = (agent: DetectedAgent) =>
    kind === 'provider' ? agent.supports.modelProviders : agent.supports.mcpServers;

  // The popover offers only actionable targets: installed agents whose
  // config format can actually store this entry. Already-targeted agents
  // stay visible even if detection is stale so they can be removed.
  const offered = agents.filter(
    (agent) =>
      canTake(agent) && (targets.includes(agent.id) || !installedOnly || agent.detection.installed)
  );
  const hiddenCount = agents.length - offered.length;

  return (
    <div className="relative" ref={ref}>
      <Tooltip content="Install / remove this entry on agents">
        <button
          type="button"
          className="btn-ghost btn-icon btn-sm"
          onClick={() => setOpen((o) => !o)}
        >
          <Plus size={14} />
        </button>
      </Tooltip>
      {open && (
        <div
          ref={popoverRef}
          className={`popover${align === 'start' ? ' popover-align-start' : ''}${
            dropUp ? ' popover-drop-up' : ''
          }`}
        >
          <div className="flex items-center gap-2 px-1 py-1 mb-1">
            <Bot size={14} className="text-accent" />
            <span className="text-xs font-semibold">Install on agents</span>
          </div>
          {offered.length === 0 && (
            <p className="text-xs text-tertiary px-1 py-2">
              No installed agents can store this entry
            </p>
          )}
          {offered.map((agent) => {
            const checked = targets.includes(agent.id);
            const supported = canTake(agent);
            return (
              <label
                key={agent.id}
                className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-bg-hover ${
                  supported ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                }`}
                title={
                  supported
                    ? undefined
                    : `${agent.name}'s config format cannot store ${
                        kind === 'provider' ? 'model providers' : 'MCP servers'
                      } — nothing would be written to its config file`
                }
              >
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={checked}
                  disabled={!supported && !checked}
                  onChange={() => supported && onToggle(agent.id)}
                />
                <AgentIconTile id={agent.id} size={22} iconSize={15} />
                <span className="flex-1 text-sm truncate">{agent.name}</span>
                {agent.detection.installed ? (
                  agent.detection.version ? (
                    <span className="badge badge-success">{agent.detection.version}</span>
                  ) : (
                    <span className="badge badge-success">installed</span>
                  )
                ) : (
                  <span className="text-xs text-tertiary">path-based</span>
                )}
              </label>
            );
          })}
          {hiddenCount > 0 && (
            <p className="text-xs text-tertiary px-1 pt-1 mt-1 border-t">
              {hiddenCount} agent{hiddenCount === 1 ? '' : 's'} hidden — not installed or their
              config format cannot store this entry.
            </p>
          )}
          <p className="text-xs text-tertiary px-1 pt-1 mt-1 border-t">
            Entries are materialized into each agent's config file.
          </p>
        </div>
      )}
    </div>
  );
}
