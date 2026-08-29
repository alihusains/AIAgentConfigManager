import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Plus, RefreshCw, FolderOpen, Bot, X, Link2 } from 'lucide-react';
import type { SkillDef, SkillCapableAgent, SkillsSnapshot } from '@ai-agent-config/core';
import { api } from '../api';
import { useStore } from '../store';
import { AgentIconTile } from './AgentIcon';
import { Badge, Button, Card, EmptyState, Field, Modal, SectionHeader, StatCard } from '../ui';

/**
 * SkillsView — the skill management platform.
 *
 * A shared local skill library (folders with SKILL.md) that can be assigned to
 * skill-capable agents (Claude Code, OpenAI Codex, OpenCode, AionUi). Assigning
 * copies the skill folder into the agent's skills directory; removing deletes
 * only the copy. One fetch per mount + manual refresh — no polling.
 */

/** `${skillId}->${agentId}:${action}` — identifies which button is busy. */
type BusyKey = string;

const busyKey = (skillId: string, agentId: string, action: 'assign' | 'unassign' | 'copy') =>
  `${skillId}->${agentId}:${action}`;

/* ------------------------------------------------------------------ */
/* Skill card                                                          */
/* ------------------------------------------------------------------ */

interface SkillCardProps {
  skill: SkillDef;
  agents: SkillCapableAgent[];
  assignedAgentIds: string[];
  busy: BusyKey | null;
  onAssign: (skillId: string, agentId: string) => void;
  onUnassign: (skillId: string, agentId: string) => void;
  onCopy: (skillId: string, sourceAgentId: string, targetAgentId: string) => void;
}

const SkillCard = memo(function SkillCard({
  skill,
  agents,
  assignedAgentIds,
  busy,
  onAssign,
  onUnassign,
  onCopy,
}: SkillCardProps) {
  const assigned = useMemo(() => new Set(assignedAgentIds), [assignedAgentIds]);
  const unassignedAgents = agents.filter((a) => !assigned.has(a.agentId));
  // Which agent's copy-offer menu is open (null = closed).
  const [copySourceId, setCopySourceId] = useState<string | null>(null);

  return (
    <Card
      title={
        <span className="flex items-center gap-2 min-w-0">
          <span className="truncate">{skill.name}</span>
          {skill.version != null && (
            <Badge variant="neutral" className="flex-shrink-0">
              v{skill.version}
            </Badge>
          )}
        </span>
      }
      actions={<span className="text-xs text-tertiary">{skill.fileCount} files</span>}
    >
      <p className="text-sm text-secondary mb-4 skill-card-desc">
        {skill.description ?? 'No description.'}
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {assignedAgentIds.length === 0 && (
          <span className="text-xs text-tertiary">Not assigned to any agent yet.</span>
        )}
        {agents
          .filter((a) => assigned.has(a.agentId))
          .map((agent) => {
            const key = busyKey(skill.id, agent.agentId, 'unassign');
            const copyOpen = copySourceId === agent.agentId;
            const copyTargets = agents
              .filter((a) => a.agentId !== agent.agentId && !assigned.has(a.agentId))
              .concat(agents.filter((a) => a.agentId !== agent.agentId && assigned.has(a.agentId)));
            return (
              <span key={agent.agentId} className="badge badge-success badge-chip flex items-center gap-1">
                <span className="badge-chip-remove-wrap">
                  <button
                    type="button"
                    className="badge-chip-remove"
                    title={`Remove ${skill.name} from ${agent.name}`}
                    disabled={busy != null}
                    aria-label={`Remove ${skill.name} from ${agent.name}`}
                    onClick={() => onUnassign(skill.id, agent.agentId)}
                  >
                    {busy === key ? <RefreshCw size={12} className="animate-spin" /> : <X size={12} />}
                  </button>
                  <button
                    type="button"
                    className="badge-chip-copy"
                    title={`Copy ${skill.name} to another agent`}
                    aria-label={`Copy ${skill.name} to another agent`}
                    disabled={busy != null || agents.length < 2}
                    aria-expanded={copyOpen}
                    onClick={() => setCopySourceId(copyOpen ? null : agent.agentId)}
                  >
                    <Link2 size={12} />
                  </button>
                </span>
                {agent.name}
                {copyOpen && (
                  <span className="copy-menu" role="menu" aria-label={`Copy to`}> 
                    {copyTargets.length === 0 && (
                      <span className="copy-menu-empty">No other agents</span>
                    )}
                    {copyTargets.map((target) => {
                      const ckey = busyKey(skill.id, target.agentId, 'copy');
                      return (
                        <button
                          key={target.agentId}
                          type="button"
                          role="menuitem"
                          className="copy-menu-item"
                          disabled={busy != null}
                          onClick={() => {
                            setCopySourceId(null);
                            onCopy(skill.id, agent.agentId, target.agentId);
                          }}
                        >
                          <AgentIconTile id={target.agentId} size={20} iconSize={10} />
                          <span className="truncate">{target.name}</span>
                          {busy === ckey && <RefreshCw size={12} className="animate-spin" />}
                        </button>
                      );
                    })}
                  </span>
                )}
              </span>
            );
          })}
      </div>

      {unassignedAgents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-xs text-tertiary">Assign to:</span>
          {unassignedAgents.map((agent) => {
            const key = busyKey(skill.id, agent.agentId, 'assign');
            return (
              <Button
                key={agent.agentId}
                variant="ghost"
                size="sm"
                icon={<Link2 size={12} />}
                loading={busy === key}
                disabled={busy != null}
                onClick={() => onAssign(skill.id, agent.agentId)}
              >
                {agent.name}
              </Button>
            );
          })}
        </div>
      )}
    </Card>
  );
});

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function SkillsView() {
  const addToast = useStore((s) => s.addToast);

  const [snapshot, setSnapshot] = useState<SkillsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyKey | null>(null);

  // New-skill modal state.
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getSkills();
      if (res.ok && res.data) {
        setSnapshot(res.data);
      } else {
        setError(res.error ?? 'Failed to load skills');
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

  const handleAssign = useCallback(
    async (skillId: string, agentId: string) => {
      setBusy(busyKey(skillId, agentId, 'assign'));
      try {
        const res = await api.assignSkill(skillId, agentId);
        if (!res.ok) throw new Error(res.error ?? 'Assign failed');
        addToast({ type: 'success', title: 'Skill assigned', message: `${skillId} → ${agentId}` });
        await load();
      } catch (e) {
        addToast({
          type: 'error',
          title: 'Assign failed',
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusy(null);
      }
    },
    [addToast, load]
  );

  const handleUnassign = useCallback(
    async (skillId: string, agentId: string) => {
      setBusy(busyKey(skillId, agentId, 'unassign'));
      try {
        const res = await api.unassignSkill(skillId, agentId);
        if (!res.ok) throw new Error(res.error ?? 'Remove failed');
        addToast({ type: 'success', title: 'Skill removed', message: `${skillId} removed from ${agentId}` });
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

  const handleCopy = useCallback(
    async (skillId: string, sourceAgentId: string, targetAgentId: string) => {
      setBusy(busyKey(skillId, targetAgentId, 'copy'));
      try {
        const res = await api.copySkillToAgent(skillId, sourceAgentId, targetAgentId);
        if (!res.ok) throw new Error(res.error ?? 'Copy failed');
        addToast({
          type: 'success',
          title: 'Skill copied',
          message: `Copied "${skillId}" to ${targetAgentId}`,
        });
        await load();
      } catch (e) {
        addToast({
          type: 'error',
          title: 'Copy failed',
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusy(null);
      }
    },
    [addToast, load]
  );

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await api.createSkill({
        name: name.trim(),
        description: description.trim() || undefined,
        body: body.trim() || undefined,
      });
      if (!res.ok || !res.data) throw new Error(res.error ?? 'Create failed');
      addToast({ type: 'success', title: 'Skill created', message: res.data.skill.name });
      setModalOpen(false);
      setName('');
      setDescription('');
      setBody('');
      await load();
    } catch (e) {
      addToast({
        type: 'error',
        title: 'Create failed',
        message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setCreating(false);
    }
  }, [name, description, body, addToast, load]);

  const totalAssignments = useMemo(() => {
    if (!snapshot) return 0;
    return Object.values(snapshot.assignments).reduce((sum, ids) => sum + ids.length, 0);
  }, [snapshot]);

  return (
    <div>
      <SectionHeader
        title="Skills"
        description="A shared skill library you can assign to skill-capable agents."
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
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setModalOpen(true)}
            >
              New Skill
            </Button>
          </>
        }
      />

      {error != null && (
        <div className="error-banner mb-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* KPI row */}
      <div className="flex gap-4 flex-wrap mb-6">
        <StatCard
          title="Skills in library"
          value={snapshot ? snapshot.skills.length : '—'}
          icon={<Sparkles size={18} />}
          color="var(--accent-primary)"
        />
        <StatCard
          title="Skill-capable agents"
          value={snapshot ? snapshot.agents.length : '—'}
          icon={<Bot size={18} />}
          color="var(--accent-primary)"
        />
        <StatCard
          title="Active assignments"
          value={snapshot ? totalAssignments : '—'}
          icon={<Link2 size={18} />}
          color="var(--accent-primary)"
        />
      </div>

      {/* Empty library */}
      {snapshot != null && snapshot.skills.length === 0 && !loading && (
        <Card className="mb-6">
          <EmptyState
            icon={<Sparkles size={28} />}
            title="No skills in the library yet"
            message={
              <>
                Skills are folders with a <code className="font-mono">SKILL.md</code> file. Create
                one here, or drop skill folders into{' '}
                <code className="font-mono">{snapshot.libraryDir}</code>.
              </>
            }
            action={
              <Button
                variant="primary"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setModalOpen(true)}
              >
                Create your first skill
              </Button>
            }
          />
        </Card>
      )}

      {/* Skill cards */}
      {snapshot != null && snapshot.skills.length > 0 && (
        <div
          className="grid gap-4 mb-6"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))' }}
        >
          {snapshot.skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              agents={snapshot.agents}
              assignedAgentIds={snapshot.assignments[skill.id] ?? []}
              busy={busy}
              onAssign={handleAssign}
              onUnassign={handleUnassign}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}

      {/* Capable agents */}
      {snapshot != null && snapshot.agents.length > 0 && (
        <Card title="Skill-capable agents" className="mb-6">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Skills directory</th>
                  <th>Installed skills</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.agents.map((agent) => (
                  <tr key={agent.agentId}>
                    <td>
                      <span className="flex items-center gap-3">
                        <AgentIconTile id={agent.agentId} size={28} iconSize={14} />
                        <span className="font-medium">{agent.name}</span>
                      </span>
                    </td>
                    <td>
                      <code className="font-mono text-xs">{agent.skillsDir}</code>
                    </td>
                    <td>
                      <span className="flex items-center gap-2">
                        <Badge variant={agent.installed ? 'success' : 'neutral'}>
                          {agent.skillIds.length} skill{agent.skillIds.length === 1 ? '' : 's'}
                        </Badge>
                        {!agent.installed && (
                          <span className="text-xs text-tertiary">directory not created yet</span>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Library location footer */}
      {snapshot != null && (
        <p className="text-xs text-tertiary flex items-center gap-2">
          <FolderOpen size={12} />
          Skill library: <code className="font-mono">{snapshot.libraryDir}</code>
        </p>
      )}

      {/* New skill modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New skill"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={creating}
              disabled={!name.trim()}
              onClick={() => void handleCreate()}
            >
              Create skill
            </Button>
          </>
        }
      >
        <Field label="Name" htmlFor="skill-name">
          <input
            id="skill-name"
            className="input"
            value={name}
            placeholder="e.g. Deploy Helper"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field
          label="Description"
          htmlFor="skill-desc"
          help="Shown to agents when they decide whether to use the skill."
        >
          <input
            id="skill-desc"
            className="input"
            value={description}
            placeholder="What this skill does and when to use it"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field
          label="Instructions (optional)"
          htmlFor="skill-body"
          help="Markdown body of SKILL.md. A starter template is used when left empty."
        >
          <textarea
            id="skill-body"
            className="input font-mono"
            rows={8}
            value={body}
            placeholder={'# Deploy Helper\n\n## Instructions\n\n1. ...'}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>
      </Modal>
    </div>
  );
}
