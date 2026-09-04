import { memo, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { api } from '../api';
import { useStore } from '../store';
import { Badge, Button, Card, SectionHeader, Tooltip } from '../ui';
import {
  Copy,
  PlayCircle,
  RefreshCw,
  Terminal,
  Package,
  Wrench,
  Zap,
  Code,
  Container,
  AlertCircle,
  CheckCircle2,
  Loader,
} from 'lucide-react';

/**
 * CLIView — unified system CLI management dashboard.
 *
 * The command catalog is served by the backend (GET /api/cli/commands): the
 * GUI sends only a command ID to execute and the server expands it to its
 * trusted literal. No command strings travel from the client, so every
 * command shown here is executable — the old "command not in allow-list"
 * failure mode cannot happen.
 *
 * Categories render as TABS (Development, Package Managers, AI Agent
 * Management, …) so no scrolling through long stacked lists.
 */

interface CliManagerCommand {
  id: string;
  command: string;
  label: string;
  description: string;
  category: string;
  timeoutMs?: number;
}

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
  development: { label: 'Development', icon: <Code size={15} /> },
  'package-manager': { label: 'Package Managers', icon: <Package size={15} /> },
  'ai-agent': { label: 'AI Agent Management', icon: <Zap size={15} /> },
  docker: { label: 'Docker & Containers', icon: <Container size={15} /> },
  utility: { label: 'Utilities', icon: <Wrench size={15} /> },
  system: { label: 'System Monitoring', icon: <Terminal size={15} /> },
};

interface ExecutionState {
  jobId: string | null;
  status: 'idle' | 'running' | 'success' | 'failed';
  output: string;
  error?: string;
}

interface CommandCardProps {
  command: CliManagerCommand;
  execution: ExecutionState;
  onExecute: (cmd: CliManagerCommand) => void;
  onCopy: (text: string) => void;
}

const CommandCard = memo(function CommandCard({
  command,
  execution,
  onExecute,
  onCopy,
}: CommandCardProps) {
  const isRunning = execution.status === 'running';
  const statusIcon =
    execution.status === 'success' ? (
      <CheckCircle2 size={16} className="text-success" />
    ) : execution.status === 'failed' ? (
      <AlertCircle size={16} className="text-error" />
    ) : execution.status === 'running' ? (
      <Loader size={16} className="text-accent-primary animate-spin" />
    ) : (
      <Terminal size={16} className="text-tertiary" />
    );

  return (
    <div className="card p-4 hover:bg-bg-hover transition-colors h-fit">
      <div className="flex items-start gap-3 mb-2">
        <div className="mt-0.5">{statusIcon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-semibold text-sm">{command.label}</span>
            {isRunning && <Badge variant="warning">running</Badge>}
            {execution.status === 'success' && <Badge variant="success">success</Badge>}
            {execution.status === 'failed' && <Badge variant="error">failed</Badge>}
          </div>
          <p className="text-xs text-secondary mb-2">{command.description}</p>
          <Tooltip content={command.command}>
            <code className="text-xs bg-bg-tertiary px-2 py-1 rounded font-mono break-all">
              {command.command.length > 60 ? `${command.command.substring(0, 60)}…` : command.command}
            </code>
          </Tooltip>
        </div>
      </div>

      {execution.error && (
        <div className="mt-2 text-xs text-error bg-bg-tertiary p-2 rounded">{execution.error}</div>
      )}

      {execution.output && (
        <div className="mt-2 bg-bg-tertiary rounded p-2 max-h-48 overflow-y-auto">
          <pre className="text-xs font-mono text-secondary whitespace-pre-wrap break-words">
            {execution.output}
          </pre>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <Button
          size="sm"
          variant={isRunning ? 'secondary' : 'primary'}
          icon={isRunning ? undefined : <PlayCircle size={12} />}
          loading={isRunning}
          disabled={isRunning}
          onClick={() => onExecute(command)}
          title={`Execute: ${command.label}`}
        >
          {isRunning ? 'Running…' : 'Execute'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Copy size={12} />}
          onClick={() => onCopy(command.command)}
          title="Copy command to clipboard"
        />
      </div>
    </div>
  );
});

export function CLIView() {
  // Catalog comes from the server — the GUI holds no command literals.
  const [commands, setCommands] = useState<CliManagerCommand[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const [executions, setExecutions] = useState<Record<string, ExecutionState>>({});
  const addToast = useStore((s) => s.addToast);
  const pollingIntervals = useRef<Map<string, NodeJS.Timeout>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await api.getCliCommands();
      if (cancelled) return;
      if (res.ok && res.data) {
        setCommands(res.data.commands as CliManagerCommand[]);
        const cats = [
          ...new Set((res.data.commands as CliManagerCommand[]).map((c) => c.category)),
        ];
        setActiveTab(cats[0] ?? null);
      } else {
        setLoadError(res.error || 'Could not load the command catalog');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset per-command execution state when the catalog arrives.
  useEffect(() => {
    if (!commands) return;
    setExecutions(Object.fromEntries(commands.map((c) => [c.id, { jobId: null, status: 'idle', output: '' }])));
  }, [commands]);

  // Clean up polling intervals on unmount
  useEffect(() => {
    const intervals = pollingIntervals.current;
    return () => {
      for (const interval of intervals.values()) clearInterval(interval);
    };
  }, []);

  const executeCLI = useCallback(
    async (cmd: CliManagerCommand) => {
      setExecutions((prev) => ({
        ...prev,
        [cmd.id]: { jobId: null, status: 'running', output: '' },
      }));

      try {
        // Send the canned command ID only — the server expands the literal.
        const res = await api.executeCli(cmd.id);
        if (!res.ok || !res.data) {
          setExecutions((prev) => ({
            ...prev,
            [cmd.id]: {
              jobId: null,
              status: 'failed',
              output: '',
              error: res.error || 'Failed to execute command',
            },
          }));
          return;
        }

        const jobId = res.data.jobId;
        setExecutions((prev) => ({
          ...prev,
          [cmd.id]: { jobId, status: 'running', output: '' },
        }));

        // Start polling for job output
        let cancelled = false;
        const pollInterval = setInterval(async () => {
          if (cancelled) {
            clearInterval(pollInterval);
            pollingIntervals.current.delete(cmd.id);
            return;
          }

          const jobRes = await api.getAgentJob(jobId);
          if (!jobRes.ok || !jobRes.data) {
            clearInterval(pollInterval);
            pollingIntervals.current.delete(cmd.id);
            setExecutions((prev) => ({
              ...prev,
              [cmd.id]: {
                jobId,
                status: 'failed',
                output: '',
                error: jobRes.error || 'Job polling failed',
              },
            }));
            return;
          }

          const job = jobRes.data;
          setExecutions((prev) => ({
            ...prev,
            [cmd.id]: {
              jobId,
              status:
                job.status === 'running'
                  ? 'running'
                  : job.status === 'success'
                    ? 'success'
                    : 'failed',
              output: job.output,
              error: job.error,
            },
          }));

          if (job.status !== 'running') {
            clearInterval(pollInterval);
            pollingIntervals.current.delete(cmd.id);
            addToast({
              type: job.status === 'success' ? 'success' : 'error',
              title: `${cmd.label} ${job.status === 'success' ? 'completed' : 'failed'}`,
              message:
                job.status === 'success'
                  ? `${cmd.label} executed successfully`
                  : job.error || `${cmd.label} failed`,
            });
          }
        }, 1500);

        pollingIntervals.current.set(cmd.id, pollInterval);
      } catch (error) {
        setExecutions((prev) => ({
          ...prev,
          [cmd.id]: {
            jobId: null,
            status: 'failed',
            output: '',
            error: String(error),
          },
        }));
      }
    },
    [addToast]
  );

  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text).then(() => {
        addToast({
          type: 'success',
          title: 'Copied',
          message: 'Command copied to clipboard',
        });
      });
    },
    [addToast]
  );

  const categories = useMemo(() => {
    if (!commands) return [];
    return [...new Set(commands.map((c) => c.category))];
  }, [commands]);

  const tabCommands = useMemo(
    () => (commands && activeTab ? commands.filter((c) => c.category === activeTab) : []),
    [commands, activeTab]
  );

  const runningCount = useMemo(
    () => Object.values(executions).filter((e) => e.status === 'running').length,
    [executions]
  );

  return (
    <div className="page-container">
      <SectionHeader
        title="CLI Manager"
        description="Run canned system commands with live output. Commands execute server-side as tracked jobs."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-sm text-tertiary">
              {runningCount > 0 && `${runningCount} running`}
            </span>
            <Button
              variant="secondary"
              icon={<RefreshCw size={14} />}
              onClick={() =>
                setExecutions((prev) =>
                  Object.fromEntries(
                    Object.entries(prev).map(([id, _]) => [
                      id,
                      { jobId: null, status: 'idle' as const, output: '' },
                    ])
                  )
                )
              }
              title="Clear all outputs"
            >
              Clear
            </Button>
          </div>
        }
      />

      {loadError && (
        <div className="card mb-4">
          <p className="text-sm text-error">{loadError}</p>
        </div>
      )}

      {!commands && !loadError ? (
        <Card>
          <p className="text-sm text-tertiary">Loading commands…</p>
        </Card>
      ) : (
        commands && (
          <>
            {/* Category tabs */}
            <div className="flex items-center gap-1.5 flex-wrap mb-5" role="tablist">
              {categories.map((cat) => {
                const meta = CATEGORY_META[cat] ?? { label: cat, icon: <Terminal size={15} /> };
                const isActive = activeTab === cat;
                const count = commands.filter((c) => c.category === cat).length;
                return (
                  <button
                    key={cat}
                    role="tab"
                    aria-selected={isActive}
                    className={`btn btn-sm ${isActive ? 'btn-accent' : 'btn-ghost'}`}
                    onClick={() => setActiveTab(cat)}
                  >
                    {meta.icon}
                    {meta.label}
                    <span className="text-tertiary font-normal">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* Active category's command grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
              {tabCommands.map((cmd) => (
                <CommandCard
                  key={cmd.id}
                  command={cmd}
                  execution={
                    executions[cmd.id] ?? { jobId: null, status: 'idle' as const, output: '' }
                  }
                  onExecute={executeCLI}
                  onCopy={copyToClipboard}
                />
              ))}
            </div>

            {/* Info Banner */}
            <Card className="mt-6 bg-bg-tertiary border-l-4" style={{ borderColor: 'var(--accent-info)' }}>
              <div className="flex gap-3">
                <Terminal size={18} className="text-accent-info flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Command Execution</p>
                  <p className="text-xs text-secondary mt-1">
                    Commands run in isolated child processes with a 5-minute timeout. Output is
                    streamed live to the dashboard. The maximum output size is 16KB per command.
                  </p>
                </div>
              </div>
            </Card>
          </>
        )
      )}
    </div>
  );
}
