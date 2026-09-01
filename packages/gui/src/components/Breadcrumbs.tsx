import Home from 'lucide-react/dist/esm/icons/home.js';
import { useStore, type View } from '../store';
import { AgentIconTile } from './AgentIcon';

const VIEW_LABELS: Record<View, string> = {
  overview: 'Overview',
  providers: 'Model Providers',
  'provider-detail': 'Model Providers',
  mcp: 'MCP Servers',
  agents: 'Agents',
  'agent-detail': 'Agents',
  'env-vars': 'Environment',
  tools: 'CLI Tools',
  skills: 'Skills',
  settings: 'Settings',
};

/**
 * Breadcrumb trail showing where the user is in the app:
 *   AI Config / <view>            (e.g. AI Config / MCP Servers)
 *   AI Config / Agents / <agent>  (agent detail page)
 *
 * Leading crumbs are links; the trailing crumb is the current page
 * (aria-current="page"). The active view + selected agent are also mirrored
 * into the URL hash by App, so the trail is visible in the address bar too.
 */
export function Breadcrumbs() {
  const { activeView, selectedAgentId, agents, registry, setActiveView } = useStore();

  const agent =
    (selectedAgentId && agents.find((a) => a.id === selectedAgentId)) ||
    (selectedAgentId && registry?.customAgents.find((c) => c.id === selectedAgentId)) ||
    null;
  const agentName = agent ? (agent as { name?: string }).name || selectedAgentId : selectedAgentId;
  const agentIcon = agent
    ? (agent as { detection?: { icon?: string }; icon?: string }).icon
    : undefined;

  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumbs-list">
        <li className="breadcrumbs-item">
          {activeView === 'overview' ? (
            <span className="breadcrumbs-current" aria-current="page">
              <Home size={14} className="breadcrumbs-icon" />
              AI Config
            </span>
          ) : (
            <button
              type="button"
              className="breadcrumbs-link"
              onClick={() => setActiveView('overview')}
            >
              <Home size={14} className="breadcrumbs-icon" />
              AI Config
            </button>
          )}
        </li>

        {activeView === 'agent-detail' && (
          <li className="breadcrumbs-item">
            <button
              type="button"
              className="breadcrumbs-link"
              onClick={() => setActiveView('agents')}
            >
              Agents
            </button>
          </li>
        )}

        {activeView === 'agent-detail' ? (
          <li className="breadcrumbs-item">
            <span className="breadcrumbs-current breadcrumbs-current-agent" aria-current="page">
              <AgentIconTile icon={agentIcon} id={selectedAgentId || ''} size={22} />
              {agentName}
            </span>
          </li>
        ) : (
          activeView !== 'overview' && (
            <li className="breadcrumbs-item">
              <span className="breadcrumbs-current" aria-current="page">
                {VIEW_LABELS[activeView] || 'Overview'}
              </span>
            </li>
          )
        )}
      </ol>
    </nav>
  );
}
