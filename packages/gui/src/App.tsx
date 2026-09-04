import { useEffect, useState } from 'react';
import { useStore, type View } from './store';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ProvidersView } from './components/ProvidersView';
import { ProviderDetailView } from './components/ProviderDetailView';
import { MCPView } from './components/MCPView';
import { AgentsView } from './components/AgentsView';
import { AgentDetailView } from './components/AgentDetailView';
import { ToolsView } from './components/ToolsView';
import { CLIView } from './components/CLIView';
import { SkillsView } from './components/SkillsView';
import { EnvVarsView } from './components/EnvVarsView';
import { SettingsView } from './components/SettingsView';
import { RamMeter } from './components/RamMeter';
import { ToastContainer } from './components/Toast';
import { Breadcrumbs } from './components/Breadcrumbs';
import { CommandPalette } from './components/CommandPalette';
import Menu from 'lucide-react/dist/esm/icons/menu.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js';
import Search from 'lucide-react/dist/esm/icons/search.js';

const VALID_VIEWS: View[] = [
  'overview',
  'providers',
  'provider-detail',
  'mcp',
  'agents',
  'agent-detail',
  'skills',
  'tools',
  'cli',
  'env-vars',
  'settings',
];

/** Platform-appropriate shortcut hint (audit D5): ⌘K on Apple, Ctrl-K elsewhere. */
const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

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
  // Audit E3: an error banner dismissal is remembered only until a new
  // error replaces the dismissed one — fresh failures always re-appear.
  const [dismissedError, setDismissedError] = useState<string | null>(null);

  const {
    activeView,
    selectedAgentId,
    selectedProviderId,
    sidebarOpen,
    loading,
    error,
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
      // pushState (was replaceState) so each view is a real history entry:
      // browser Back steps through views instead of leaving the app
      // (audit D1). The hashchange listener below consumes popped states.
      window.history.pushState(null, '', desired);
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

  // Global keyboard shortcuts: Shift+R refresh (ignored while typing)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(document.activeElement)) return;
      if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        refreshAll();
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
      case 'cli':
        return <CLIView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-full app-shell">
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

      {/* Mobile sidebar scrim (audit B2): click-dismissable overlay behind
          the open sidebar; hidden above 1024px via CSS. */}
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-scrim visible"
          aria-label="Close sidebar"
          onClick={toggleSidebar}
          tabIndex={-1}
        />
      )}

      <Sidebar />

      {/* Floating content panel over the dark IC frame */}
      <main id="main" className="main-panel flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="panel-header sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="btn-ghost btn-icon flex-shrink-0"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <button
              className="btn-ghost btn-icon flex-shrink-0"
              onClick={() => setActiveView('overview')}
              aria-label="Home"
              title="Go to Overview"
            >
              <img
                src="/logo-full-40.png"
                alt="AI Config Manager home"
                width={34}
                height={34}
                style={{ maxWidth: '34px', maxHeight: '34px' }}
              />
            </button>
            <Breadcrumbs />
          </div>
          <div className="flex items-center gap-3">
            <button
              className="btn-secondary btn-sm"
              title={`Search (${IS_MAC ? 'Cmd-K' : 'Ctrl-K'})`}
              onClick={() => {
                // Dispatch a synthetic Cmd-K/Ctrl-K to open the palette
                window.dispatchEvent(
                  new KeyboardEvent('keydown', {
                    key: 'k',
                    [IS_MAC ? 'metaKey' : 'ctrlKey']: true,
                  })
                );
              }}
            >
              <Search size={14} />
              <span className="hidden sm:inline">Search</span>
              <kbd className="ml-1">{IS_MAC ? '⌘K' : 'Ctrl-K'}</kbd>
            </button>
            <RamMeter />
            <button
              className="btn-secondary btn-sm"
              title="Refresh (Shift+R)"
              onClick={() => refreshAll()}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        {/* Error banner (audit E3): full width, dismissible; a dismissal
            is forgotten as soon as a new error replaces it. */}
        {error && error !== dismissedError && (
          <div className="border-b" style={{ background: 'var(--bg-canvas)' }}>
            <div className="px-4 py-3 flex items-start gap-3 flex-wrap">
              <AlertCircle size={18} className="text-error flex-shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Connection failed</p>
                <p className="text-xs text-secondary mt-1">{error}</p>
              </div>
              <button
                className="btn-ghost btn-sm"
                onClick={() => setDismissedError(error)}
                aria-label="Dismiss error"
              >
                <X size={14} />
                Dismiss
              </button>
              <button className="btn-secondary btn-sm" onClick={() => refreshAll()}>
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          </div>
        )}

        {/* View Content */}
        <div className="flex-1 overflow-y-auto">{renderView()}</div>
      </main>

      <ToastContainer />
      <CommandPalette />
    </div>
  );
}

export default App;
