import { useRef, useState } from 'react';
import { useStore } from '../store';
import { api } from '../api';
import { Download, Upload, Database, Info, AlertTriangle } from 'lucide-react';

export function SettingsView() {
  const { registry, agents, platform, addToast } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const providers = registry?.providers || [];
  const mcpServers = registry?.mcpServers || [];
  const customAgents = registry?.customAgents || [];

  const handleExport = () => {
    if (!registry) return;
    const blob = new Blob([JSON.stringify(registry, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registry-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Exported', message: 'Registry exported as JSON' });
  };

  const handleImportFile = async (file: File) => {
    if (!confirm(
      'Importing replaces the ENTIRE registry and re-materializes every agent config from it.\n\n' +
      'Continue?',
    )) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await api.importRegistry(parsed);
      if (!res.ok) {
        addToast({ type: 'error', title: 'Import Failed', message: res.error || 'Invalid registry file' });
      } else {
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
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <h2 className="text-xl font-bold">Settings</h2>
        <p className="text-secondary text-sm mt-1">
          The registry is the single source of truth — everything else is generated from it.
        </p>
      </div>

      {/* Registry */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-2">
            <Database size={18} />
            Registry
          </h3>
        </div>
        <div className="mb-4">
          <p className="text-tertiary text-xs">Location</p>
          <p className="font-mono text-sm break-all mt-1">{registry?.path}</p>
          <p className="text-tertiary text-xs mt-2 mb-1">Contents</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="badge badge-primary">{providers.length} providers</span>
            <span className="badge badge-primary">{mcpServers.length} MCP servers</span>
            <span className="badge badge-neutral">{customAgents.length} custom agents</span>
            {registry?.updatedAt && (
              <span className="text-xs text-tertiary">
                updated {new Date(registry.updatedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="btn-secondary" onClick={handleExport}>
            <Download size={16} />
            Export Registry
          </button>
          <label className="btn-secondary cursor-pointer">
            <Upload size={16} />
            Import Registry
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="absolute opacity-0 pointer-events-none"
              style={{ display: 'none' }}
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
              }}
            />
          </label>
          {importing && <span className="text-sm text-tertiary">Importing…</span>}
        </div>
        <div className="mt-4 flex items-start gap-2 border-t pt-3">
          <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
          <p className="text-xs text-secondary">
            Import replaces the registry and rewrites every managed section of each
            agent's config file. Agent-local providers, permissions and custom settings
            are preserved (registry entries are upserted, never duplicated).
          </p>
        </div>
      </div>

      {/* About */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title flex items-center gap-2">
            <Info size={18} />
            About
          </h3>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-secondary">Version</span>
            <span className="font-mono">0.1.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Platform</span>
            <span className="font-mono">{platform || 'unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Server</span>
            <span className="font-mono break-all">{window.location.origin}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Interfaces</span>
            <span className="font-mono">CLI + localhost API + this GUI</span>
          </div>
          <div className="flex justify-between">
            <span className="text-secondary">Detected agents</span>
            <span className="font-mono">{agents.length}</span>
          </div>
          <div className="pt-4 border-t flex justify-between">
            <span className="text-secondary">Built with</span>
            <span className="font-mono">React + Vite, served by ai-config CLI</span>
          </div>
        </div>
      </div>
    </div>
  );
}