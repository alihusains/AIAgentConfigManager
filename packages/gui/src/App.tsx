import { useEffect } from 'react';
import { useStore, type View } from './store';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ProvidersView } from './components/ProvidersView';
import { ProviderDetailView } from './components/ProviderDetailView';
import { MCPView } from './components/MCPView';
import { AgentsView } from './components/AgentsView';
import { AgentDetailView } from './components/AgentDetailView';
import { ToolsView } from './components/ToolsView';
import { SkillsView } from './components/SkillsView';
import { EnvVarsView } from './components/EnvVarsView';
import { SettingsView } from './components/SettingsView';
import { RamMeter } from './components/RamMeter';
import { ToastContainer } from './components/Toast';
import { ThemeToggle, toggleTheme } from './components/ThemeToggle';
import { Breadcrumbs } from './components/Breadcrumbs';
import { CommandPalette } from './components/CommandPalette';
import { Menu, X, RefreshCw, AlertTriangle, Search } from 'lucide-react';

const VALID_VIEWS: View[] = [
  'overview',
  'providers',
  'provider-detail',
  'mcp',
  'agents',
  'agent-detail',
  'skills',
  'tools',
  'env-vars',
  'settings',
];

/** Parse the hash into a view + optional id (e.g. #/agents/claude-code, #/providers/anthropic/models). */
function parseHash(): {
  view: View;
  agentId?: string;
  providerId?: string;
  providerTab?: string;
} | null {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/');
  const viewPart = parts[0];
  const idPart = parts[1];
  const tabPart = parts[2];
  if (viewPart === 'agents' && idPart) {
    return { view: 'agent-detail', agentId: decodeURIComponent(idPart) };
  }
  if (viewPart === 'providers' && idPart) {
    return {
      view: 'provider-detail',
      providerId: decodeURIComponent(idPart),
      providerTab: tabPart ? decodeURIComponent(tabPart) : undefined,
    };
  }
  if ((VALID_VIEWS as string[]).includes(viewPart)) {
    return { view: viewPart as View };
  }
  return null;
}

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    (el as HTMLElement).isContentEditable
  );
}

function App() {
  const {
    activeView,
    selectedAgentId,
    selectedProviderId,
    sidebarOpen,
    loading,
    error,
    authError,
    refreshAll,
    toggleSidebar,
    setActiveView,
    openAgent,
    openProvider,
  } = useStore();

  // Initial load: pull the registry + detected agents from the server
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // URL <-> view sync: the active view (and selected agent/provider) are mirrored into
  // the hash so the address bar doubles as a breadcrumb, and a bookmarked or
  // shared URL — plus browser back/forward — restores the exact screen.
  useEffect(() => {
    const parsed = parseHash();
    if (!parsed) return;
    if (parsed.view === 'agent-detail' && parsed.agentId) {
      if (parsed.agentId !== selectedAgentId) openAgent(parsed.agentId);
    } else if (parsed.view === 'provider-detail' && parsed.providerId) {
      if (parsed.providerId !== selectedProviderId) openProvider(parsed.providerId);
    } else if (parsed.view !== activeView) {
      setActiveView(parsed.view);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const desired =
      activeView === 'agent-detail' && selectedAgentId
        ? `#/agents/${encodeURIComponent(selectedAgentId)}`
        : activeView === 'provider-detail' && selectedProviderId
          ? `#/providers/${encodeURIComponent(selectedProviderId)}`
          : `#/${activeView}`;
    if (window.location.hash !== desired) {
      window.history.replaceState(null, '', desired);
    }
  }, [activeView, selectedAgentId, selectedProviderId]);

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseHash();
      if (!parsed) return;
      const s = useStore.getState();
      if (parsed.view === 'agent-detail' && parsed.agentId) {
        if (parsed.agentId !== s.selectedAgentId) s.openAgent(parsed.agentId);
      } else if (parsed.view === 'provider-detail' && parsed.providerId) {
        if (parsed.providerId !== s.selectedProviderId) s.openProvider(parsed.providerId);
      } else if (parsed.view !== s.activeView) {
        s.setActiveView(parsed.view);
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Global keyboard shortcuts: Shift+R refresh, t theme toggle (ignored while typing)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(document.activeElement)) return;
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        refreshAll();
      } else if (!e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.key === 't') {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [refreshAll]);

  const renderView = () => {
    switch (activeView) {
      case 'providers':
        return <ProvidersView />;
      case 'provider-detail':
        return <ProviderDetailView providerId={selectedProviderId} />;
      case 'mcp':
        return <MCPView />;
      case 'agents':
        return <AgentsView />;
      case 'agent-detail':
        return <AgentDetailView agentId={selectedAgentId} />;
      case 'skills':
        return <SkillsView />;
      case 'env-vars':
        return <EnvVarsView />;
      case 'tools':
        return <ToolsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-full bg-bg-canvas">
      {/* Skip-to-content link (audit H1): first focusable element, bypasses the
          sidebar + header to reach the main content. */}
      <a href="#main" className="skip-link">
        Skip to content
      </a>

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
      <main id="main" className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10 bg-bg-canvas/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="btn-ghost btn-icon flex-shrink-0"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-3">
            {error && <span className="text-xs text-error truncate max-w-lg">{error}</span>}
            <button
              className="btn-secondary btn-sm"
              title="Search (Cmd-K)"
              onClick={() => {
                // Dispatch a synthetic Cmd-K to open the palette
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
              }}
            >
              <Search size={14} />
              <span className="hidden sm:inline">Search</span>
              <kbd className="font-mono text-xs opacity-60 ml-1">⌘K</kbd>
            </button>
            <RamMeter />
            <button
              className="btn-secondary btn-sm"
              title="Refresh (Shift+R)"
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
                  per-session token. Reopen the dashboard from the terminal — it opens{' '}
                  <span className="font-mono">http://127.0.0.1:4321</span> with the token already
                  set up. Old tabs cannot authenticate.
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
      <CommandPalette />
    </div>
  );
}

export default App;
