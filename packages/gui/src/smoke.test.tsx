/**
 * Smoke tests for the GUI main views + App routing.
 *
 * These assert behavior and accessible roles/text only — never CSS classes or
 * colors — so a concurrent theme/design-token rebuild does not break them.
 * The API layer (src/api.ts) is mocked; no live gui-server is contacted.
 *
 * Coverage: App hash routing (parseHash/VALID_VIEWS), Sidebar navigation,
 * Dashboard, ProvidersView, AgentsView, SettingsView — render-without-crash
 * plus a few key interactions.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { ProvidersView } from './components/ProvidersView';
import { AgentsView } from './components/AgentsView';
import { SettingsView } from './components/SettingsView';
import { useStore } from './store';

// ---------------------------------------------------------------------------
// API mock — a controllable `api` object returned to anything importing '../api'
// ---------------------------------------------------------------------------
const { apiMock } = vi.hoisted(() => {
  // Every api.* method defaults to a benign ok envelope so unexercised
  // mutations never kill a render-without-crash test.
  const fns: Record<string, ReturnType<typeof vi.fn>> = {
    getState: vi.fn(),
    getAgentCatalog: vi.fn(),
    getSystemStats: vi.fn(),
    getTools: vi.fn(),
    getToolUpdateCheck: vi.fn(),
    runToolUpdate: vi.fn(),
    getSkills: vi.fn(),
    createSkill: vi.fn(),
    assignSkill: vi.fn(),
    unassignSkill: vi.fn(),
    importRegistry: vi.fn(),
    addProvider: vi.fn(),
    updateProvider: vi.fn(),
    verifyProvider: vi.fn(),
    testProvider: vi.fn(),
    addProviderAgents: vi.fn(),
    removeProviderAgent: vi.fn(),
    deleteProvider: vi.fn(),
    addMCP: vi.fn(),
    updateMCP: vi.fn(),
    addMCPAgents: vi.fn(),
    removeMCPAgent: vi.fn(),
    deleteMCP: vi.fn(),
    addCustomAgent: vi.fn(),
    updateCustomAgent: vi.fn(),
    deleteCustomAgent: vi.fn(),
    getAgentConfig: vi.fn(),
    revealAgent: vi.fn(),
    getAgentRawFile: vi.fn(),
    saveAgentRawFile: vi.fn(),
    installAgent: vi.fn(),
    uninstallAgent: vi.fn(),
    getAgentJob: vi.fn(),
    checkAgentUpdate: vi.fn(),
    updateAgent: vi.fn(),
  };
  return { apiMock: fns };
});

vi.mock('./api', () => ({ api: apiMock }));

// ---------------------------------------------------------------------------
// Fixtures (plain objects; typed loosely where the core shape is deep)
// ---------------------------------------------------------------------------
const fakeAgent = {
  id: 'claude-code',
  name: 'Claude Code',
  description: 'Anthropic coding agent',
  configFormat: 'json',
  configPaths: { darwin: '~/.claude/settings.json', win32: 'x', linux: 'x' },
  supports: { modelProviders: true, mcpServers: true, permissions: false, projectConfig: false },
  binaries: ['claude'],
  detection: { installed: true, configExists: true, method: 'command' },
} as never;

const fakeRegistry = {
  path: '/tmp/registry.json',
  providers: [
    {
      provider: {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai-compatible',
        config: { baseUrl: 'https://api.openai.com/v1' },
        enabled: true,
        priority: 0,
      },
      models: [
        {
          id: 'gpt-4o',
          providerId: 'openai',
          name: 'gpt-4o',
          displayName: 'GPT-4o',
          roles: ['chat'],
        },
      ],
      agentIds: ['claude-code'],
    },
  ],
  mcpServers: [
    {
      server: { name: 'codegraph', type: 'stdio', command: 'codegraph', enabled: true },
      agentIds: ['claude-code'],
    },
  ],
  customAgents: [{ id: 'myagent', name: 'My Agent', configPath: '/tmp/my.json' }],
  updatedAt: 0,
} as never;

const fullState = {
  agents: [fakeAgent],
  registry: fakeRegistry,
  platform: 'darwin',
};

const catalog = {
  platform: 'darwin',
  agents: [
    {
      id: 'claude-code',
      name: 'Claude Code',
      description: 'Anthropic coding agent',
      status: 'stable',
      addedAt: '2026-01-01T00:00:00.000Z',
      binaries: ['claude'],
      install: 'npm i -g @anthropic-ai/claude-code',
      installPlatforms: ['darwin', 'linux', 'win32'],
      uninstall: 'npm rm -g @anthropic-ai/claude-code',
      uninstallPlatforms: ['darwin', 'linux', 'win32'],
      known: true,
      installed: true,
    },
  ],
  meta: { version: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
} as never;

const stats = {
  rssBytes: 123,
  heapUsedBytes: 456,
  heapTotalBytes: 789,
  externalBytes: 101,
  uptimeSec: 999,
  processId: 1,
  startedAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  vi.resetAllMocks();
  // Defaults that most views/hooks need on mount.
  apiMock.getState.mockResolvedValue({ ok: true, data: fullState, status: 200 });
  apiMock.getAgentCatalog.mockResolvedValue({ ok: true, data: catalog, status: 200 });
  apiMock.getSystemStats.mockResolvedValue({ ok: true, data: stats, status: 200 });
  // Everything else returns a benign ok envelope.
  for (const [name, fn] of Object.entries(apiMock)) {
    if (name === 'getState' || name === 'getAgentCatalog' || name === 'getSystemStats') continue;
    fn.mockResolvedValue({ ok: true, status: 200, data: {} });
  }

  // Reset the shared store + persist storage between tests.
  useStore.setState({
    agents: [fakeAgent],
    registry: fakeRegistry,
    platform: 'darwin',
    loading: false,
    error: null,
    authError: false,
    activeView: 'overview',
    selectedAgentId: null,
    sidebarOpen: true,
    toasts: [],
  });
  localStorage.clear();
  window.location.hash = '';
  window.history.replaceState(null, '', '/');
});

// ---------------------------------------------------------------------------
// App routing (parseHash / VALID_VIEWS)
// ---------------------------------------------------------------------------
describe('App routing', () => {
  it('renders the Dashboard by default', async () => {
    window.history.replaceState(null, '', '#/invalid-view');
    render(<App />);
    await screen.findByText('Registry — single source of truth');
  });

  it('renders ProvidersView when the hash points at #/providers', async () => {
    window.history.replaceState(null, '', '#/providers');
    render(<App />);
    // ProvidersView heading (note: Dashboard also shows a "Model Providers"
    // stat card, so assert the more specific provider name too).
    await screen.findByRole('heading', { name: 'Model Providers' });
    await screen.findByText('OpenAI');
  });

  it('renders AgentsView when the hash points at #/agents', async () => {
    window.history.replaceState(null, '', '#/agents');
    render(<App />);
    await screen.findByRole('heading', { name: 'Agents' });
  });

  it('renders SettingsView when the hash points at #/settings', async () => {
    window.history.replaceState(null, '', '#/settings');
    render(<App />);
    await screen.findByRole('heading', { name: 'Settings' });
  });

  it('resolves agents/<id> to the agent-detail view (via openAgent)', async () => {
    window.history.replaceState(null, '', '#/agents/claude-code');
    render(<App />);
    await waitFor(() => {
      expect(useStore.getState().activeView).toBe('agent-detail');
      expect(useStore.getState().selectedAgentId).toBe('claude-code');
    });
  });

  it('falls back to the Dashboard for a view not in VALID_VIEWS', async () => {
    window.history.replaceState(null, '', '#/nope');
    render(<App />);
    await screen.findByText('Registry — single source of truth');
    expect(useStore.getState().activeView).toBe('overview');
  });

  it('provides a skip-to-content link targeting the main region', async () => {
    render(<App />);
    await screen.findByText('Registry — single source of truth');
    const skip = screen.getByRole('link', { name: /skip to content/i });
    expect(skip).toHaveAttribute('href', '#main');
    // The main content region is targetable by that anchor.
    expect(document.getElementById('main')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Sidebar navigation
// ---------------------------------------------------------------------------
describe('Sidebar navigation', () => {
  it('lists every nav entry with the expected label', () => {
    render(<Sidebar />);
    for (const label of [
      'Overview',
      'Providers',
      'MCP Servers',
      'Agents',
      'Skills',
      'CLI Tools',
      'Settings',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('groups nav under Registry, Detected Agents, and System headings', () => {
    render(<Sidebar />);
    // "Registry" also labels the footer block, so accept multiple occurrences.
    expect(screen.getAllByText(/^Registry$/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Detected Agents/)).toBeInTheDocument();
    expect(screen.getByText(/^System$/)).toBeInTheDocument();
  });

  it('shows live registry counters aligned with each entry', () => {
    render(<Sidebar />);
    // Fixture registry has 1 provider, 1 MCP server, and 1 custom agent.
    expect(screen.getByRole('button', { name: /Providers\s+1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /MCP Servers\s+1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Agents\s+1/ })).toBeInTheDocument();
  });

  it('navigates to Providers when its nav item is clicked', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole('button', { name: /Providers/ }));
    expect(useStore.getState().activeView).toBe('providers');
  });

  it('navigates to MCP Servers when its nav item is clicked', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole('button', { name: /MCP Servers/ }));
    expect(useStore.getState().activeView).toBe('mcp');
  });

  it('opens an agent detail from the Detected Agents list', async () => {
    const user = userEvent.setup();
    render(<Sidebar />);
    await user.click(screen.getByRole('button', { name: /Claude Code/ }));
    expect(useStore.getState().activeView).toBe('agent-detail');
    expect(useStore.getState().selectedAgentId).toBe('claude-code');
  });
});

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
describe('Dashboard', () => {
  it('renders the stat cards and registry summary without crashing', async () => {
    render(<Dashboard />);
    await screen.findByText('Registry — single source of truth');
    for (const title of ['Model Providers', 'MCP Servers', 'Agents (installed)', 'Custom Agents']) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it('shows the detected agent in the detected-agents section', async () => {
    render(<Dashboard />);
    await screen.findByText('Registry — single source of truth');
    expect(screen.getByText(/Claude Code/i)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ProvidersView
// ---------------------------------------------------------------------------
describe('ProvidersView', () => {
  it('renders seeded providers with an Add Provider action', async () => {
    render(<ProvidersView />);
    await screen.findByRole('heading', { name: 'Model Providers' });
    expect(screen.getByRole('button', { name: /Add Provider/ })).toBeInTheDocument();
    expect(screen.getByText('OpenAI')).toBeInTheDocument();
  });

  it('shows the empty state when no providers are registered', () => {
    useStore.setState({
      registry: {
        path: '/tmp/r.json',
        providers: [],
        mcpServers: [],
        customAgents: [],
        updatedAt: 0,
      } as never,
    });
    render(<ProvidersView />);
    expect(screen.getByText('No Providers Registered')).toBeInTheDocument();
  });

  it('toggles a provider enabled switch without crashing', async () => {
    const user = userEvent.setup();
    render(<ProvidersView />);
    const toggle = await screen.findByRole('switch');
    await user.click(toggle);
    expect(apiMock.updateProvider).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AgentsView
// ---------------------------------------------------------------------------
describe('AgentsView', () => {
  it('renders the installed agent and custom-agent actions', async () => {
    render(<AgentsView />);
    await screen.findByRole('heading', { name: 'Agents' });
    expect(screen.getByText(/Claude Code/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Custom Agent/ })).toBeInTheDocument();
  });

  it('renders the Add Custom Agent action when no custom agents exist', async () => {
    useStore.setState({
      registry: {
        path: '/tmp/r.json',
        providers: [],
        mcpServers: [],
        customAgents: [],
        updatedAt: 0,
      } as never,
    });
    render(<AgentsView />);
    await screen.findByRole('heading', { name: 'Agents' });
    expect(screen.getByRole('button', { name: /Add Custom Agent/ })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// SettingsView
// ---------------------------------------------------------------------------
describe('SettingsView', () => {
  it('renders Registry + Environment cards with export/import actions', async () => {
    render(<SettingsView />);
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.getByRole('button', { name: /Export Registry/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import Registry/ })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// CommandPalette (Cmd-K)
// ---------------------------------------------------------------------------
describe('CommandPalette', () => {
  beforeEach(() => {
    useStore.setState({
      agents: [
        {
          id: 'claude-code',
          name: 'Claude Code',
          description: '',
          configFormat: 'json' as never,
          configPaths: {} as never,
          supports: {} as never,
          binaries: ['claude'],
          detection: { installed: true, configExists: true, method: 'command' as never },
        },
        {
          id: 'codex',
          name: 'Codex',
          description: '',
          configFormat: 'toml' as never,
          configPaths: {} as never,
          supports: {} as never,
          binaries: ['codex'],
          detection: { installed: true, configExists: true, method: 'command' as never },
        },
      ],
      registry: {
        path: '/tmp/r.json',
        providers: [
          {
            provider: {
              id: 'anthropic',
              name: 'Anthropic',
              type: 'anthropic' as never,
              config: {} as never,
              enabled: true,
              priority: 1,
            },
            models: [],
            agentIds: [],
          },
        ],
        mcpServers: [],
        customAgents: [],
        updatedAt: 0,
      },
      activeView: 'overview',
      loading: false,
      error: null,
    });
  });

  it('opens with Cmd-K and shows grouped results', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    // Cmd-K to open
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    });

    // Should show grouped results: Navigate, Providers, Agents, Actions
    expect(screen.getAllByText('Navigate').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Providers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agents').length).toBeGreaterThan(0);
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('filters results by query', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const dialog = await screen.findByRole('dialog', { name: 'Command palette' });

    // Type a query that matches a nav item
    const input = screen.getByRole('combobox');
    await user.type(input, 'settings');

    await waitFor(
      () => {
        // "Settings" nav item should be visible in the palette
        expect(dialog.textContent).toContain('Settings');
      },
      { timeout: 2000 }
    );
    // "Overview" should be filtered out from the palette
    expect(dialog.textContent).not.toContain('Overview');
  });

  it('navigates with arrow keys and selects with Enter', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    const input = await screen.findByRole('combobox');

    // Arrow down to move selection
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // Enter to select
    fireEvent.keyDown(input, { key: 'Enter' });

    // Palette should close
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
    });
  });

  it('closes with Escape', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await screen.findByRole('dialog', { name: 'Command palette' });

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Command palette' })).not.toBeInTheDocument();
    });
  });

  it('announces result count for screen readers', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    await screen.findByRole('dialog', { name: 'Command palette' });

    // aria-live announcement
    const live = screen.getByText(/result/);
    expect(live).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ProviderDetailView (E4)
// ---------------------------------------------------------------------------
describe('ProviderDetailView', () => {
  beforeEach(() => {
    // Override the getState mock to include our test provider
    apiMock.getState.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        agents: [
          { id: 'claude-code', name: 'Claude Code', description: '', configFormat: 'json' as never, configPaths: {} as never, supports: {} as never, binaries: ['claude'], detection: { installed: true, configExists: true, method: 'command' as never } },
          { id: 'codex', name: 'Codex', description: '', configFormat: 'toml' as never, configPaths: {} as never, supports: {} as never, binaries: ['codex'], detection: { installed: true, configExists: true, method: 'command' as never } },
        ],
        registry: {
          path: '/tmp/r.json',
          providers: [
            {
              provider: {
                id: 'anthropic',
                name: 'Anthropic',
                type: 'anthropic' as never,
                config: { baseUrl: 'https://api.anthropic.com', apiKey: 'sk-ant-test123456789' },
                enabled: true,
                priority: 1,
              },
              models: [
                { id: 'claude-sonnet-4-20250514', providerId: 'anthropic', name: 'Claude Sonnet 4', displayName: 'Claude Sonnet 4', roles: ['chat'] as never },
                { id: 'claude-opus-4-20250514', providerId: 'anthropic', name: 'Claude Opus 4', displayName: 'Claude Opus 4', roles: ['chat'] as never },
              ],
              agentIds: ['claude-code'],
            },
          ],
          mcpServers: [],
          customAgents: [],
          updatedAt: 0,
        },
        platform: 'darwin',
      },
    });

    useStore.setState({
      agents: [
        { id: 'claude-code', name: 'Claude Code', description: '', configFormat: 'json' as never, configPaths: {} as never, supports: {} as never, binaries: ['claude'], detection: { installed: true, configExists: true, method: 'command' as never } },
        { id: 'codex', name: 'Codex', description: '', configFormat: 'toml' as never, configPaths: {} as never, supports: {} as never, binaries: ['codex'], detection: { installed: true, configExists: true, method: 'command' as never } },
      ],
      registry: {
        path: '/tmp/r.json',
        providers: [
          {
            provider: {
              id: 'anthropic',
              name: 'Anthropic',
              type: 'anthropic' as never,
              config: { baseUrl: 'https://api.anthropic.com', apiKey: 'sk-ant-test123456789' },
              enabled: true,
              priority: 1,
            },
            models: [
              { id: 'claude-sonnet-4-20250514', providerId: 'anthropic', name: 'Claude Sonnet 4', displayName: 'Claude Sonnet 4', roles: ['chat'] as never },
              { id: 'claude-opus-4-20250514', providerId: 'anthropic', name: 'Claude Opus 4', displayName: 'Claude Opus 4', roles: ['chat'] as never },
            ],
            agentIds: ['claude-code'],
          },
        ],
        mcpServers: [],
        customAgents: [],
        updatedAt: 0,
      },
      activeView: 'provider-detail',
      selectedProviderId: 'anthropic',
      loading: false,
      error: null,
    });
  });

  it('renders the provider detail page with tabs', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    // Provider name is visible
    expect(screen.getByText('Anthropic')).toBeInTheDocument();

    // All four tabs are present
    expect(screen.getByRole('tab', { name: /Overview/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Models/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Agents/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /API Configuration/ })).toBeInTheDocument();
  });

  it('shows Overview tab content by default', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    // Overview content: connection, capabilities, models
    expect(screen.getByText('Connection')).toBeInTheDocument();
    expect(screen.getByText('API Capabilities')).toBeInTheDocument();
    expect(screen.getByText(/Models \(2\)/)).toBeInTheDocument();
  });

  it('switches to Models tab on click', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    const modelsTab = screen.getByRole('tab', { name: /Models/ });
    fireEvent.click(modelsTab);

    await waitFor(() => {
      // Models table should be visible
      expect(screen.getByText('claude-sonnet-4-20250514')).toBeInTheDocument();
    });
  });

  it('navigates tabs with arrow keys', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    // Focus the first tab (Overview)
    const overviewTab = screen.getByRole('tab', { name: /Overview/ });
    overviewTab.focus();

    // Arrow right → Models
    fireEvent.keyDown(overviewTab, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Models/ })).toHaveFocus();
    });

    // Arrow right → Agents
    fireEvent.keyDown(screen.getByRole('tab', { name: /Models/ }), { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Agents/ })).toHaveFocus();
    });
  });

  it('masks API key by default in API Configuration tab', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    // Navigate to API tab
    const apiTab = screen.getByRole('tab', { name: /API Configuration/ });
    fireEvent.click(apiTab);

    await waitFor(() => {
      // Key should be masked (showing ••••••••)
      expect(screen.getByText(/••••••••/)).toBeInTheDocument();
    });

    // Full key should NOT be visible
    expect(screen.queryByText('sk-ant-test123456789')).not.toBeInTheDocument();
  });

  it('reveals API key on explicit action', async () => {
    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    // Navigate to API tab
    const apiTab = screen.getByRole('tab', { name: /API Configuration/ });
    fireEvent.click(apiTab);

    await waitFor(() => {
      expect(screen.getByText(/••••••••/)).toBeInTheDocument();
    });

    // Click reveal button
    const revealBtn = screen.getByTitle('Reveal API key');
    fireEvent.click(revealBtn);

    await waitFor(() => {
      expect(screen.getByText('sk-ant-test123456789')).toBeInTheDocument();
    });
  });

  it('deep-links to a specific tab via hash', async () => {
    // Simulate deep-link to the API tab
    window.location.hash = '#/providers/anthropic/api';

    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    // API Configuration tab should be active
    await waitFor(() => {
      const apiTab = screen.getByRole('tab', { name: /API Configuration/ });
      expect(apiTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('shows not-found state for unknown provider', async () => {
    useStore.setState({
      activeView: 'provider-detail',
      selectedProviderId: 'nonexistent',
    });

    render(<App />);
    await screen.findByRole('link', { name: 'Skip to content' });

    expect(screen.getByText(/Provider not found/)).toBeInTheDocument();
  });
});
