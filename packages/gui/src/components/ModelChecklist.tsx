import { useState } from 'react';
import { Copy, Check, Plus } from 'lucide-react';

interface ModelChecklistProps {
  /** Every model id known so far — from a live verify and/or the value
   * already saved with this provider. Order is preserved. */
  knownModelIds: string[];
  /** Comma-separated selected model ids (the actual field value). */
  value: string;
  onChange: (next: string) => void;
}

/**
 * Cherry-pick which of the known model ids are actually registered with
 * this provider — a checkbox per model (with select all / deselect all),
 * a copy-to-clipboard button per model, and a small input to add a model
 * id manually when it isn't in the known list yet (e.g. no verify has run).
 */
export function ModelChecklist({
  knownModelIds,
  value,
  onChange,
}: ModelChecklistProps) {
  const [manualId, setManualId] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const selected = new Set(
    value
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
  );
  // The manually-typed value can include ids that never came from a verify
  // (hand-entered, or from a provider that's never been verified) — keep
  // those visible too, not just what's in knownModelIds.
  const allIds = Array.from(new Set([...knownModelIds, ...selected]));

  const setSelection = (next: Set<string>) => {
    onChange(allIds.filter((id) => next.has(id)).join(', '));
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
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs text-tertiary">
          {selected.size} of {allIds.length} selected
        </span>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => setSelection(new Set(allIds))}
        >
          Select all
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => setSelection(new Set())}
        >
          Deselect all
        </button>
      </div>
      <div
        className="border rounded"
        style={{ maxHeight: 200, overflowY: 'auto' }}
      >
        {allIds.map((id) => (
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
            <button
              type="button"
              className="btn-ghost btn-icon btn-sm flex-shrink-0"
              title="Copy model id"
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
          </label>
        ))}
      </div>
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
