import { memo, useCallback, useRef, useState, type ChangeEvent } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { Download, Upload, Database, Info, AlertTriangle, Clock, HardDrive } from 'lucide-react';
import { SectionHeader, Card, Badge, Button } from '../ui';

/**
 * Settings — registry backup/restore plus environment facts.
 *
 * Rebuilt on the shared `ui/` primitives (SectionHeader, Card, Badge, Button)
 * with a clearer hierarchy: one page heading, a Registry panel (location,
 * contents, actions, caution note) and an Environment panel of key/value
 * facts. Handlers are memoized; the value rows are a memoized leaf component
 * so the view stays cheap to re-render.
 */

/* -------------------------------------------------------------------------- */
/* Key/value row (About / Environment)                                        */
/* -------------------------------------------------------------------------- */

const InfoRow = memo(function InfoRow({
  label,
  value,
  divider = false,
}: {
  label: string;
  value: React.ReactNode;
  divider?: boolean;
}) {
  return (
    <div
      className={
        divider
          ? 'flex items-center justify-between gap-4 pt-3 mt-1 border-t'
          : 'flex items-center justify-between gap-4'
      }
    >
      <span className="text-secondary text-sm">{label}</span>
      <span className="font-mono text-sm text-right break-all min-w-0">{value}</span>
    </div>
  );
});

/* -------------------------------------------------------------------------- */
/* Settings view                                                              */
/* -------------------------------------------------------------------------- */

export function SettingsView() {
  const { registry, agents, platform, addToast } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const providers = registry?.providers || [];
  const mcpServers = registry?.mcpServers || [];
  const customAgents = registry?.customAgents || [];

  const handleExport = useCallback(async () => {
    // QA finding M2: export the server's authoritative registry, not the GUI's
    // in-memory copy (which can be stale after a failed refresh). The local
    // copy is only a fallback when the server cannot be reached.
    const res = await api.exportRegistry();
    const payload = res.ok && res.data ? res.data : registry;
    if (!payload) return;
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registry-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({
      type: res.ok ? 'success' : 'warning',
      title: 'Exported',
      message: res.ok
        ? 'Registry exported from the server as JSON'
        : 'Server unreachable — exported the last known registry state',
    });
  }, [registry, addToast]);

  const handleImportFile = useCallback(
    async (file: File) => {
      if (
        !confirm(
          'Importing replaces the ENTIRE registry and re-materializes every agent config from it.\n\n' +
            'Continue?'
        )
      ) {
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
      setImporting(true);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const res = await api.importRegistry(parsed);
        if (!res.ok) {
          addToast({
            type: 'error',
            title: 'Import Failed',
            message: res.error || 'Invalid registry file',
          });
        } else {
          // Same convention as the store's run(): one warning toast per
          // warning, then the success toast (M061 portability warnings).
          for (const warning of res.data?.warnings || []) {
            addToast({ type: 'warning', title: 'Warning', message: warning });
          }
          addToast({
            type: 'success',
            title: 'Registry Imported',
            message: 'Registry replaced and agent configs re-materialized',
          });
          await useStore.getState().refreshAll();
        }
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Import Failed',
          message: err instanceof Error ? err.message : 'Not a valid JSON file',
        });
      } finally {
        setImporting(false);
        if (fileRef.current) fileRef.current.value = '';
      }
    },
    [addToast]
  );

  const onFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleImportFile(file);
    },
    [handleImportFile]
  );

  const openFilePicker = useCallback(() => fileRef.current?.click(), []);

  return (
    <div className="p-4 settings-view">
      <SectionHeader
        title="Settings"
        description="The registry is the single source of truth; every agent config is generated from it."
      />

      {/* Registry */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Database size={18} />
            Registry
          </span>
        }
        actions={
          registry?.updatedAt ? (
            <span className="flex items-center gap-1.5 text-xs text-tertiary">
              <Clock size={13} />
              updated {new Date(registry.updatedAt).toLocaleString()}
            </span>
          ) : undefined
        }
        className="mb-6"
      >
        {/* Location */}
        <div className="mb-4">
          <p className="text-tertiary text-xs mb-1">Location</p>
          <div className="settings-path flex items-center gap-2">
            <HardDrive size={14} className="flex-shrink-0" />
            <code className="font-mono text-sm break-all">{registry?.path ?? 'unknown'}</code>
          </div>
        </div>

        {/* Contents */}
        <div className="mb-4">
          <p className="text-tertiary text-xs mb-1.5">Contents</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="primary">{providers.length} providers</Badge>
            <Badge variant="primary">{mcpServers.length} MCP servers</Badge>
            <Badge variant="neutral">{customAgents.length} custom agents</Badge>
            <Badge variant="neutral">{agents.length} detected agents</Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" icon={<Download size={16} />} onClick={handleExport}>
            Export Registry
          </Button>
          <Button
            variant="secondary"
            icon={<Upload size={16} />}
            onClick={openFilePicker}
            loading={importing}
          >
            {importing ? 'Importing…' : 'Import Registry'}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
        </div>

        {/* Caution note */}
        <div className="settings-note mt-4 flex items-start gap-2 border-t pt-3">
          <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-secondary">
            Import replaces the registry and rewrites every managed section of each agent's config
            file. Agent-local providers, permissions and custom settings are preserved (registry
            entries are upserted, never duplicated).
          </p>
        </div>
      </Card>

      {/* Environment / About */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Info size={18} />
            Environment
          </span>
        }
      >
        <div className="space-y-2">
          <InfoRow label="Version" value="0.1.0" />
          <InfoRow label="Platform" value={platform || 'unknown'} />
          <InfoRow label="Server" value={window.location.origin} />
          <InfoRow label="Interfaces" value="CLI + localhost API + this GUI" />
          <InfoRow label="Detected agents" value={agents.length} />
          <InfoRow label="Built with" value="React + Vite, served by ai-config CLI" divider />
        </div>
      </Card>
    </div>
  );
}
