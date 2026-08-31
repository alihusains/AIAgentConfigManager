import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyRound, Eye, EyeOff, Plus, Edit, Trash2, Search, RefreshCw, Lock } from 'lucide-react';
import type { EnvVarEntry } from '@ai-agent-config/core';
import { api } from '../api';
import { useStore } from '../store';
import { Badge, Button, EmptyState, Field, Modal, SectionHeader, Skeleton } from '../ui';

/**
 * EnvVarsView — the Environment page (M049).
 *
 * Lists the machine's environment variables via M048's backend
 * (GET /api/env — sensitive-looking values arrive already redacted), grouped
 * by source, with per-row reveal, search, and add/edit/remove for the
 * entries the backend marks `editable`. Read-only entries explain WHY they
 * are read-only (the backend's `note`) instead of showing a bare disabled
 * control. Mutations go through POST/DELETE /api/env — the same surgical
 * profile-file edits the core performs.
 */

const SOURCE_LABELS: Record<EnvVarEntry['source'], string> = {
  'shell-profile': 'Shell profile',
  process: 'Process (this tool)',
  'windows-user': 'Windows user',
  'windows-system': 'Windows system',
};

const SOURCE_ORDER: EnvVarEntry['source'][] = [
  'shell-profile',
  'process',
  'windows-user',
  'windows-system',
];

/** `${name}:${action}` — identifies which row button is busy. */
type BusyKey = string;

/**
 * A variable that exists only in this process (set by a parent shell, an IDE,
 * launchd — no shell profile file backs it) is read-only in `listEnvVars()`
 * but CAN be "adopted" into a shell profile: `setEnvVar` appends the export
 * line to the default profile file, after which the variable is
 * shell-profile-backed and editable. Genuinely non-writable sources (e.g.
 * Windows `HKEY_LOCAL_MACHINE`) do NOT get this override — this tool cannot
 * safely write them without admin elevation it does not have.
 */
function isProcessOnlyAdoptable(entry: EnvVarEntry): boolean {
  return entry.editable === false && entry.source === 'process';
}

/** The caveat shown at the moment of the adopt action (never buried). */
const ADOPT_CAVEAT =
  'This variable is currently set by a running process. Adding it to your shell profile will apply to new terminal sessions only — it will not change this or any already-running process.';

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

interface EnvVarRowProps {
  entry: EnvVarEntry;
  revealedValue: string | null;
  busy: BusyKey | null;
  onReveal: (entry: EnvVarEntry) => void;
  onEdit: (entry: EnvVarEntry) => void;
  onRemove: (entry: EnvVarEntry) => void;
  onAdopt: (entry: EnvVarEntry) => void;
}

const EnvVarRow = memo(function EnvVarRow({
  entry,
  revealedValue,
  busy,
  onReveal,
  onEdit,
  onRemove,
  onAdopt,
}: EnvVarRowProps) {
  const isRevealed = revealedValue !== null;
  const busyFor = (action: string): boolean => busy === `${entry.name}:${action}`;

  return (
    <tr>
      <td>
        <div className="env-row-identity">
          <code className="env-var-name">{entry.name}</code>
          {entry.sourceFile && (
            <p className="env-meta" title={entry.sourceFile}>
              {entry.sourceFile}
            </p>
          )}
        </div>
      </td>
      <td>
        <div className="flex items-center gap-1.5 min-w-0">
          <code className="env-var-value">{isRevealed ? revealedValue : entry.value}</code>
          {entry.looksSensitive && (
            <button
              type="button"
              className="btn-ghost btn-icon btn-sm env-reveal-btn"
              title={isRevealed ? 'Hide value' : 'Reveal value'}
              aria-label={isRevealed ? `Hide ${entry.name} value` : `Reveal ${entry.name} value`}
              disabled={busy != null}
              onClick={() => onReveal(entry)}
            >
              {busyFor('reveal') ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : isRevealed ? (
                <EyeOff size={14} />
              ) : (
                <Eye size={14} />
              )}
            </button>
          )}
        </div>
      </td>
      <td>
        {entry.editable ? (
          <Badge variant="success">editable</Badge>
        ) : (
          <Badge variant="neutral" title={entry.note}>
            <Lock size={10} /> read-only
          </Badge>
        )}
      </td>
      <td>
        <div className="env-row-actions flex items-center gap-1">
          {entry.editable ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<Edit size={14} />}
                title={`Edit ${entry.name}`}
                aria-label={`Edit ${entry.name}`}
                disabled={busy != null}
                onClick={() => onEdit(entry)}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<Trash2 size={14} />}
                className="text-error"
                title={`Remove ${entry.name}`}
                aria-label={`Remove ${entry.name}`}
                disabled={busy != null}
                onClick={() => onRemove(entry)}
              />
            </>
          ) : (
            <div className="flex items-center gap-1">
              <span className="env-readonly-reason" title={entry.note}>
                {entry.note || 'Read-only'}
              </span>
              {isProcessOnlyAdoptable(entry) && (
                <Button
                  variant="ghost"
                  size="sm"
                  title={
                    `Add ${entry.name} to your shell profile` +
                    '\n\n' +
                    ADOPT_CAVEAT +
                    '\n\nIt will apply to new terminal sessions only — already-running processes keep the current value.'
                  }
                  aria-label={`Add ${entry.name} to shell profile`}
                  disabled={busy != null}
                  onClick={() => onAdopt(entry)}
                >
                  Edit anyway
                </Button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
});

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function EnvVarsView() {
  const addToast = useStore((s) => s.addToast);

  const [vars, setVars] = useState<EnvVarEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<BusyKey | null>(null);

  // Revealed (unredacted) values, per variable name — only fetched on the
  // explicit eye-icon action, never on list load.
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  // Add/edit modal state. `editing` is the entry being edited, or null
  // while the modal is in "add" mode. `adopting` marks the "adopt a
  // process-only var into the shell profile" path — same modal, plus the
  // unmissable caveat about already-running processes.
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EnvVarEntry | null>(null);
  const [adopting, setAdopting] = useState(false);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus the name field when the modal opens.
  useEffect(() => {
    if (modalOpen) nameInputRef.current?.focus();
  }, [modalOpen]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getEnvVars();
      if (res.ok && res.data) {
        setVars(res.data.vars);
      } else {
        setError(res.error ?? 'Failed to load environment variables');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReveal = useCallback(
    async (entry: EnvVarEntry) => {
      // Toggle off: drop the cached value so the masked one shows again.
      if (revealed[entry.name] !== undefined) {
        setRevealed((r) => {
          const next = { ...r };
          delete next[entry.name];
          return next;
        });
        return;
      }
      setBusy(`${entry.name}:reveal`);
      try {
        const res = await api.revealEnvVar(entry.name);
        if (!res.ok || res.data == null) {
          throw new Error(res.error ?? `Could not reveal ${entry.name}`);
        }
        setRevealed((r) => ({ ...r, [entry.name]: (res.data as { value: string }).value }));
      } catch (e) {
        addToast({
          type: 'error',
          title: 'Reveal failed',
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusy(null);
      }
    },
    [revealed, addToast]
  );

  const openAdd = useCallback(() => {
    setEditing(null);
    setAdopting(false);
    setName('');
    setValue('');
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((entry: EnvVarEntry) => {
    setEditing(entry);
    setAdopting(false);
    setName(entry.name);
    // Never prefill the redacted value — the edit form starts the value
    // blank on purpose: saving would otherwise write the mask back.
    setValue('');
    setModalOpen(true);
  }, []);

  // "Adopt into profile": a process-only var gets a new export line in the
  // default shell profile via the SAME setEnvVar path as any other edit —
  // no separate write logic. The caveat is shown in the modal itself.
  const openAdopt = useCallback((entry: EnvVarEntry) => {
    setEditing(entry);
    setAdopting(true);
    setName(entry.name);
    setValue('');
    setModalOpen(true);
  }, []);

  const handleRemove = useCallback(
    async (entry: EnvVarEntry) => {
      if (
        !confirm(
          `Remove "${entry.name}" from ${
            entry.sourceFile ? entry.sourceFile : 'your user environment'
          }?\n\nOpen a new shell to pick up the change.`
        )
      ) {
        return;
      }
      setBusy(`${entry.name}:remove`);
      try {
        const res = await api.removeEnvVar(entry.name);
        if (!res.ok) throw new Error(res.error ?? 'Remove failed');
        addToast({
          type: 'success',
          title: 'Environment variable removed',
          message: `"${entry.name}" removed. ${res.data?.warning ?? ''}`,
        });
        await load();
      } catch (e) {
        addToast({
          type: 'error',
          title: 'Remove failed',
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusy(null);
      }
    },
    [addToast, load]
  );

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmedName)) return;
    setSaving(true);
    try {
      const res = await api.setEnvVar(trimmedName, value);
      if (!res.ok) throw new Error(res.error ?? 'Save failed');
      addToast({
        type: 'success',
        title: adopting
          ? 'Variable added to shell profile'
          : editing
            ? 'Environment variable updated'
            : 'Environment variable added',
        message: `${trimmedName} saved. ${res.data?.warning ?? ''}`,
      });
      setModalOpen(false);
      await load();
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Save failed',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }, [name, value, editing, adopting, addToast, load]);

  // Search: case-insensitive substring match on name or value. Filtering
  // happens in memory over an already-small list — cheap even at 100+ vars.
  const filtered = useMemo(() => {
    if (!vars) return null;
    const q = query.trim().toLowerCase();
    if (!q) return vars;
    return vars.filter(
      (v) => v.name.toLowerCase().includes(q) || v.value.toLowerCase().includes(q)
    );
  }, [vars, query]);

  const groups = useMemo(() => {
    if (!filtered) return null;
    // Entries arrive in raw process-env / profile insertion order — sort
    // each source group alphabetically (case-insensitive) by name.
    const bySource = new Map<EnvVarEntry['source'], EnvVarEntry[]>();
    for (const source of SOURCE_ORDER) {
      const items = filtered
        .filter((v) => v.source === source)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      if (items.length > 0) bySource.set(source, items);
    }
    return bySource;
  }, [filtered]);

  const editableCount = useMemo(() => vars?.filter((v) => v.editable).length ?? 0, [vars]);

  return (
    <div className="p-4">
      <SectionHeader
        title="Environment Variables"
        description="This machine's environment — process + shell profiles (macOS/Linux) or user/system registry (Windows). Secret-looking values are masked until you reveal them."
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} />}
              loading={loading}
              onClick={() => void load()}
            >
              Refresh
            </Button>
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openAdd}>
              Add Variable
            </Button>
          </>
        }
      />

      {error != null && (
        <div className="error-banner mb-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {loading && vars == null ? (
        <div className="card">
          <div className="p-4 space-y-3">
            <Skeleton width="240px" height={28} />
            <Skeleton className="w-full" height={20} />
            <Skeleton className="w-full" height={20} />
            <Skeleton className="w-3/4" height={20} />
          </div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="env-vars-search-wrap mb-4">
            <div className="input input-with-icon env-vars-search">
              <Search size={14} className="env-vars-search-icon" />
              <input
                className="input env-vars-search-input"
                placeholder="Filter by name or value…"
                aria-label="Filter environment variables"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {groups != null && groups.size === 0 ? (
            <div className="card">
              <EmptyState
                icon={<KeyRound size={28} />}
                title="No matching variables"
                message={`No environment variable matches "${query}".`}
                action={
                  <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                    Clear filter
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="card">
              <div className="table-container env-vars-scroll">
                <table className="table env-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Value</th>
                      <th style={{ width: '110px' }}>Access</th>
                      <th style={{ minWidth: '200px' }}>{query ? 'Notes / Actions' : 'Actions'}</th>
                    </tr>
                  </thead>
                  {groups != null &&
                    Array.from(groups.entries()).map(([source, items]) => (
                      <tbody key={source}>
                        <tr className="env-group-row">
                          <td colSpan={4}>
                            <span className="env-group-label">
                              {SOURCE_LABELS[source]}
                              <span className="env-group-count">{items.length}</span>
                            </span>
                          </td>
                        </tr>
                        {items.map((entry) => (
                          <EnvVarRow
                            key={`${entry.source}:${entry.name}`}
                            entry={entry}
                            revealedValue={revealed[entry.name] ?? null}
                            busy={busy}
                            onReveal={(e) => void handleReveal(e)}
                            onEdit={openEdit}
                            onRemove={(e) => void handleRemove(e)}
                            onAdopt={openAdopt}
                          />
                        ))}
                      </tbody>
                    ))}
                </table>
              </div>
              <p className="env-vars-footer">
                {vars?.length ?? 0} variable(s) · {editableCount} editable here · process variables
                are read-only — set them in a shell profile to make them editable.
              </p>
            </div>
          )}
        </>
      )}

      {/* Add / edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={
          adopting
            ? `Add to shell profile — ${editing?.name ?? ''}`
            : editing
              ? `Edit — ${editing.name}`
              : 'Add Environment Variable'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={saving}
              disabled={!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name.trim()) || value === ''}
              onClick={() => void handleSave()}
            >
              {adopting ? 'Add to profile' : editing ? 'Save Changes' : 'Add Variable'}
            </Button>
          </>
        }
      >
        {adopting && (
          <div className="warning-box mb-4" role="alert">
            <p className="text-sm">{ADOPT_CAVEAT}</p>
          </div>
        )}
        <Field
          label="Name"
          htmlFor="env-var-name"
          help={!editing ? 'Letters, digits, underscores; must not start with a digit.' : undefined}
        >
          <input
            id="env-var-name"
            ref={nameInputRef}
            className="input font-mono"
            placeholder="e.g. MY_API_KEY"
            value={name}
            disabled={!!editing}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label="Value"
          htmlFor="env-var-value"
          help={
            editing
              ? 'The masked value is not prefilled on purpose — type the value you want to save.'
              : 'Stored in your shell profile file (or HKCU on Windows), never anywhere else.'
          }
        >
          <input
            id="env-var-value"
            className="input font-mono"
            placeholder="e.g. sk-…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  );
}
