import Check from 'lucide-react/dist/esm/icons/check.js';
import Copy from 'lucide-react/dist/esm/icons/copy.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import { useMemo, useState } from 'react';
import { Tooltip } from '../ui';

/**
 * "Free" model detection — a model counts as free when its id contains
 * "free" (case-insensitive), matching how gateways name them
 * (e.g. "deepseek-v4-flash-free", "glm-5-airx-free").
 */
export const isFreeModel = (id: string): boolean => /free/i.test(id);

interface ModelSelectorProps {
  /** Every model id known so far. Order is preserved. */
  knownModelIds: string[];
  /** Comma-separated selected model ids (the actual field value). */
  value: string;
  onChange: (next: string) => void;
}

/**
 * ModelSelector — an interactive model picker for large model lists (40+).
 *
 * Features:
 * - Checkbox list with per-row copy button
 * - Real-time search/filter input
 * - "Select All" — checks every *visible* (filtered) model
 * - "Deselect All" — unchecks every model
 * - "Select Free Models" — auto-selects models whose id matches /free/i
 * - Scrollable container for long lists
 * - Manual-add input for ids not in the known list
 */
export function ModelSelector({ knownModelIds, value, onChange }: ModelSelectorProps) {
  const [search, setSearch] = useState('');
  const [manualId, setManualId] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selected = useMemo(
    () =>
      new Set(
        value
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
      ),
    [value]
  );

  // The manually-typed value can include ids that never came from a verify —
  // keep those visible too, not just what's in knownModelIds.
  const allIds = useMemo(
    () => Array.from(new Set([...knownModelIds, ...selected])),
    [knownModelIds, selected]
  );

  // Real-time filter: case-insensitive substring match on the search term.
  const visibleIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allIds;
    return allIds.filter((id) => id.toLowerCase().includes(q));
  }, [allIds, search]);

  const setSelection = (next: Set<string>) => {
    // Preserve order: first the known ones (in original order), then new ones
    const ordered = [];
    for (const id of allIds) {
      if (next.has(id)) ordered.push(id);
    }
    // Add any new selections not in allIds (manually added)
    for (const id of next) {
      if (!ordered.includes(id)) ordered.push(id);
    }
    onChange(ordered.join(', '));
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
  };

  const copy = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — the
      // copy button just silently doesn't confirm; nothing else to do.
    }
  };

  const addManual = () => {
    const id = manualId.trim();
    if (!id || selected.has(id)) return;
    setManualId('');
    setSelection(new Set([...selected, id]));
  };

  if (allIds.length === 0) {
    return (
      <div className="flex gap-2">
        <input
          className="input"
          placeholder="e.g., gpt-4o"
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addManual();
            }
          }}
        />
        <button
          type="button"
          className="btn-secondary btn-sm flex-shrink-0"
          onClick={addManual}
          disabled={!manualId.trim()}
        >
          <Plus size={14} />
          Add
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar: search + bulk actions */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <div className="relative flex-1 min-w-[140px]">
          <Search
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none"
          />
          <input
            className="input"
            style={{ paddingLeft: 28 }}
            placeholder="Search models…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-tertiary whitespace-nowrap">
          {selected.size} of {allIds.length} selected
        </span>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => {
            const next = new Set(selected);
            for (const id of visibleIds) next.add(id);
            setSelection(next);
          }}
        >
          Select All
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => setSelection(new Set())}
        >
          Deselect All
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => {
            const next = new Set(selected);
            for (const id of allIds) {
              if (isFreeModel(id)) next.add(id);
            }
            setSelection(next);
          }}
        >
          Select Free Models
        </button>
      </div>

      {/* Scrollable checkbox list */}
      <div className="border rounded" style={{ maxHeight: 240, overflowY: 'auto' }}>
        {visibleIds.length === 0 ? (
          <p className="text-xs text-tertiary px-2 py-3">No models match “{search.trim()}”.</p>
        ) : (
          visibleIds.map((id) => (
            <label
              key={id}
              className="flex items-center gap-2 px-2 py-1.5 hover:bg-bg-hover cursor-pointer"
              style={{ borderBottom: '1px solid var(--border-primary)' }}
            >
              <input
                type="checkbox"
                className="checkbox"
                checked={selected.has(id)}
                onChange={() => toggle(id)}
              />
              <span className="flex-1 font-mono text-xs truncate" title={id}>
                {id}
              </span>
              {isFreeModel(id) && (
                <span className="badge badge-success text-[10px] flex-shrink-0">free</span>
              )}
              <Tooltip content="Copy model id">
                <button
                  type="button"
                  className="btn-ghost btn-icon btn-sm flex-shrink-0"
                  onClick={(e) => {
                    e.preventDefault();
                    void copy(id);
                  }}
                >
                  {copiedId === id ? (
                    <Check size={12} className="text-success" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </Tooltip>
            </label>
          ))
        )}
      </div>

      {/* Manual add */}
      <div className="flex gap-2 mt-2">
        <input
          className="input"
          placeholder="Add a model id manually"
          value={manualId}
          onChange={(e) => setManualId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addManual();
            }
          }}
        />
        <button
          type="button"
          className="btn-secondary btn-sm flex-shrink-0"
          onClick={addManual}
          disabled={!manualId.trim()}
        >
          <Plus size={14} />
          Add
        </button>
      </div>
    </div>
  );
}
