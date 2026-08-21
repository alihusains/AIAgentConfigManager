import { useEffect } from 'react';
import { useStore } from './store';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ProvidersView } from './components/ProvidersView';
import { MCPView } from './components/MCPView';
import { AgentsView } from './components/AgentsView';
import { SettingsView } from './components/SettingsView';
import { ToastContainer } from './components/Toast';
import { ThemeToggle } from './components/ThemeToggle';
import { Menu, X, RefreshCw, AlertTriangle } from 'lucide-react';

const VIEW_TITLES: Record<string, string> = {
  overview: 'Overview',
  providers: 'Model Providers',
  mcp: 'MCP Servers',
  agents: 'Agents',
  settings: 'Settings',
};

function App() {
  const { activeView, sidebarOpen, loading, error, authError, refreshAll, toggleSidebar, setActiveView } =
    useStore();

  // Initial load: pull the registry + detected agents from the server
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const renderView = () => {
    switch (activeView) {
      case 'providers':
        return <ProvidersView />;
      case 'mcp':
        return <MCPView />;
      case 'agents':
        return <AgentsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-full bg-bg-primary">
      {/* Mobile sidebar toggle */}
      <button
        className="btn-secondary btn-icon fixed top-4 left-4 z-50 lg:hidden"
        style={{ display: sidebarOpen ? 'none' : undefined }}
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="btn-ghost btn-icon flex-shrink-0"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <h1 className="text-lg font-semibold truncate">
              {VIEW_TITLES[activeView] || 'Overview'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-error truncate max-w-lg">{error}</span>}
            <button
              className="btn-secondary btn-sm"
              onClick={() => refreshAll()}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <ThemeToggle />
            <button className="btn-ghost btn-sm" onClick={() => setActiveView('settings')}>
              Settings
            </button>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto">{renderView()}</div>

        {/* Auth banner: shown when the server rejects this browser's token */}
        {authError && (
          <div className="border-t" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="px-4 py-3 flex items-start gap-3 flex-wrap">
              <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Dashboard access token missing or expired</p>
                <p className="text-xs text-secondary mt-1">
                  Each launch of <span className="font-mono">ai-config gui</span> uses a fresh
                  per-session token. Reopen the dashboard from the terminal — it prints a{' '}
                  <span className="font-mono">http://127.0.0.1:…/?t=…</span> URL — or paste that
                  URL into this browser. Old bookmarks and tabs cannot authenticate.
                </p>
              </div>
              <button className="btn-secondary btn-sm" onClick={() => refreshAll()}>
                <RefreshCw size={14} />
                Try Again
              </button>
            </div>
          </div>
        )}
      </main>

      <ToastContainer />
    </div>
  );
}

export default App;