import { AlertTriangle, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { Badge, Tooltip } from '../ui';

/**
 * A single MCP server is "overloaded" when it exposes this many tools.
 * Matches the v0.4 roadmap item: overload warning at >= 30 tools.
 */
export const MCP_TOOL_OVERLOAD_THRESHOLD = 30;

interface ToolCountCellProps {
  /** The MCP server name (registry key). */
  name: string;
}

type ToolState =
  | { status: 'loading' }
  | { status: 'loaded'; count: number; tools: string[] }
  | { status: 'failed'; error: string };

/**
 * Per-row "Tools" cell for the MCP table (MCP exposure dashboard).
 *
 * Lazy-loads the live tool count by connecting to the server (tools/list).
 * Shows a spinner while loading, the count when loaded, and a clear
 * "list failed" indicator with the reason when it could not be listed. When
 * the count reaches the overload threshold, a warning badge is shown next to
 * the count. Reuses the shared Badge/Tooltip primitives — no new styling.
 */
export function ToolCountCell({ name }: ToolCountCellProps) {
  const [state, setState] = useState<ToolState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    api
      .getMcpTools(name)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok || !res.data) {
          setState({ status: 'failed', error: res.error || 'Failed to list tools' });
          return;
        }
        if (res.data.error) {
          setState({ status: 'failed', error: res.data.error });
          return;
        }
        setState({ status: 'loaded', count: res.data.count, tools: res.data.tools });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setState({ status: 'failed', error: msg || 'Failed to list tools' });
      });
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (state.status === 'loading') {
    return (
      <Tooltip content="Listing tools…">
        <span className="mcp-tools-loading flex items-center gap-1.5 text-secondary">
          <Loader2 size={14} className="animate-spin" />
          <span className="mcp-meta">listing…</span>
        </span>
      </Tooltip>
    );
  }

  if (state.status === 'failed') {
    return (
      <Tooltip content={`Tool listing failed: ${state.error}`}>
        <span className="mcp-tools-failed flex items-center gap-1.5 text-error">
          <AlertTriangle size={14} />
          <span className="mcp-meta">list failed</span>
        </span>
      </Tooltip>
    );
  }

  const overloaded = state.count >= MCP_TOOL_OVERLOAD_THRESHOLD;
  return (
    <span className="mcp-tools-cell flex items-center gap-2">
      <span
        className="font-mono text-sm"
        title={state.tools.length > 0 ? state.tools.join('\n') : undefined}
      >
        {state.count}
      </span>
      {overloaded && (
        <Badge
          variant="warning"
          title={`Overloaded: ${state.count} tools (threshold ${MCP_TOOL_OVERLOAD_THRESHOLD})`}
        >
          {state.count}+ tools
        </Badge>
      )}
    </span>
  );
}
