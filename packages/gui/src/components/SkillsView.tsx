import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Plus,
  RefreshCw,
  FolderOpen,
  Bot,
  X,
  Link2,
  Search,
  Trash2,
  Store,
  ExternalLink,
  Eye,
  Pencil,
  Download,
  Copy,
  Edit3,
  FileText,
  Folder,
  Upload,
} from 'lucide-react';
import type {
  AggregatedSkill,
  SkillDiagnostic,
  SkillDef,
  SkillCapableAgent,
  SkillsSnapshot,
  MarketplaceSkillSummary,
} from '@ai-agent-config/core';
import { api } from '../api';
import { useStore } from '../store';
import { useWindowedList } from '../hooks/useWindowedList';
import { AgentIconTile } from './AgentIcon';
import { CodeEditor } from './CodeEditor';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  SectionHeader,
  Skeleton,
  StatCard,
  Tooltip,
} from '../ui';

/**
 * SkillsView — the skill management platform.
 *
 * A shared local skill library (folders with SKILL.md) plus every skill
 * installed directly on any skill-capable agent (Claude Code, OpenAI Codex,
 * OpenCode, Pi, …). The browsable list is the cross-agent aggregation
 * (`snapshot.allSkills`, M044): every skill id known anywhere, with `foundOn`
 * listing its locations ('library' + agent ids). Library skills keep their
 * assign/unassign chips; agent-installed skills can be copied to any other
 * skill-capable agent from their real current location. One fetch per mount +
 * manual refresh — no polling.
 */

/** `${skillId}->${agentId}:${action}` — identifies which button is busy. */
type BusyKey = string;

const busyKey = (
  skillId: string,
  agentId: string,
  action: 'assign' | 'unassign' | 'copy' | 'delete' | 'view' | 'edit' | 'adopt'
) => `${skillId}->${agentId}:${action}`;

/** Identifies a busy marketplace install button. */
const marketBusyKey = (skillId: string) => `marketplace:${skillId}:install`;

/** Fixed row height for the windowed skill list (see useWindowedList). */
const SKILL_ROW_HEIGHT = 92;

/* ------------------------------------------------------------------ */
/* Windowed list row (one aggregated skill)                            */
/* ------------------------------------------------------------------ */

interface SkillRowProps {
  skill: AggregatedSkill;
  agents: SkillCapableAgent[];
  isLibrarySkill: boolean;
  busy: BusyKey | null;
  onAssign: (skillId: string, agentId: string) => void;
  onUnassign: (skillId: string, agentId: string) => void;
  onCopy: (skillId: string, sourceAgentId: string, targetAgentId: string) => void;
  onDeleteFromLibrary: (skillId: string) => void;
  onAdopt: (skillId: string, source: string) => void;
  onRename: (skillId: string) => void;
  onDuplicate: (skillId: string) => void;
  onView: (skillId: string, location: string) => void;
  onEdit: (skillId: string, location: string) => void;
}

const SkillRow = memo(function SkillRow({
  skill,
  agents,
  isLibrarySkill,
  busy,
  onAssign,
  onUnassign,
  onCopy,
  onDeleteFromLibrary,
  onAdopt,
  onRename,
  onDuplicate,
  onView,
  onEdit,
}: SkillRowProps) {
  const foundOn = useMemo(() => new Set(skill.foundOn), [skill.foundOn]);
  const onAgents = agents.filter((a) => foundOn.has(a.agentId));
  const inLibrary = foundOn.has('library');
  const unassignedAgents = isLibrarySkill ? agents.filter((a) => !foundOn.has(a.agentId)) : [];
  // Which location's copy-offer menu is open (null = closed).
  const [copySourceId, setCopySourceId] = useState<string | null>(null);

  const openCopyMenu = (sourceId: string) =>
    setCopySourceId((prev) => (prev === sourceId ? null : sourceId));

  const copyTargets = (sourceId: string) =>
    agents.filter((a) => a.agentId !== sourceId && !foundOn.has(a.agentId));

  return (
    <div className="skill-row" style={{ height: SKILL_ROW_HEIGHT }}>
      <div className="skill-row-main">
        <div className="skill-row-title">
          <span className="skill-row-name truncate">{skill.name}</span>
          {skill.version != null && (
            <Badge variant="neutral" className="flex-shrink-0">
              v{skill.version}
            </Badge>
          )}
          {isLibrarySkill && (
            <Tooltip content={`Rename ${skill.name} (folder + frontmatter name)`}>
            <button
              type="button"
              className="skill-row-action-btn"
              aria-label={`Rename ${skill.name}`}
              onClick={() => onRename(skill.id)}
            >
              <Edit3 size={14} />
            </button>
            </Tooltip>
          )}
          {isLibrarySkill && (
            <Tooltip content={`Duplicate ${skill.name} into ${skill.id}-copy`}>
            <button
              type="button"
              className="skill-row-action-btn"
              aria-label={`Duplicate ${skill.name}`}
              onClick={() => onDuplicate(skill.id)}
            >
              <Copy size={14} />
            </button>
            </Tooltip>
          )}
          {isLibrarySkill && (
            <Tooltip content={`Download ${skill.name} as .zip`}>
            <a
              className="skill-row-action-btn"
              aria-label={`Export ${skill.name}`}
              href={api.exportSkillUrl(skill.id)}
              download={`${skill.id}.zip`}
            >
              <Download size={14} />
            </a>
          </Tooltip>
          )}
          {(() => {
            const diags = (skill as AggregatedSkill & {
              validation?: { ok: boolean; loadable: boolean; diagnostics: SkillDiagnostic[] };
            }).validation?.diagnostics ?? [];
            const err = diags.find((d) => d.level === 'error');
            const warn = diags[0];
            const diag = err ?? warn;
            if (!diag) return null;
            return (
              <Tooltip content={`${diag.level === 'error' ? 'Invalid' : 'Spec warning'}: ${diag.message}`}>
                <Badge
                  variant={err ? 'error' : 'warning'}
                  className="flex-shrink-0 cursor-help"
                >
                  {err ? 'invalid' : 'spec warning'}
                </Badge>
              </Tooltip>
            );
          })()}
          <span className="skill-row-meta flex-shrink-0">{skill.fileCount} files</span>
          {/* M073: View + Edit actions — available for EVERY skill regardless of library status. */}
          <span className="skill-row-actions flex-shrink-0">
            <Tooltip content={`View ${skill.name} (SKILL.md)`}>
            <button
              type="button"
              className="skill-row-action-btn"
              aria-label={`View ${skill.name}`}
              onClick={() => onView(skill.id, inLibrary ? 'library' : onAgents[0]?.agentId)}
            >
              <Eye size={14} />
            </button>
            </Tooltip>
            <Tooltip content={`Edit ${skill.name} (SKILL.md)`}>
            <button
              type="button"
              className="skill-row-action-btn"
              aria-label={`Edit ${skill.name}`}
              onClick={() => onEdit(skill.id, inLibrary ? 'library' : onAgents[0]?.agentId)}
            >
              <Pencil size={14} />
            </button>
            </Tooltip>
          </span>
        </div>
        <p className="skill-row-desc truncate">{skill.description ?? 'No description.'}</p>
      </div>

      <div className="skill-row-locs flex-wrap gap-2">
        {!inLibrary && (
          <button
            type="button"
            className="badge badge-chip"
            disabled={busy != null}
            title="Copy into the shared library so it can be attached to every agent"
            onClick={() =>
              onAdopt(
                skill.id,
                skill.foundOn.includes('agents-dir')
                  ? 'agents-dir'
                  : skill.foundOn.includes('project-agents-dir')
                    ? 'project-agents-dir'
                    : onAgents[0]?.agentId ?? 'agents-dir'
              )
            }
          >
            <Download size={12} />
            Adopt into library
          </button>
        )}
        {inLibrary && (
          <span className="badge badge-chip">
            <span className="badge-chip-remove-wrap">
              <Tooltip content={`Delete ${skill.name} from the library`}>
              <button
                type="button"
                className="badge-chip-remove"
                aria-label={`Delete ${skill.name} from the library`}
                disabled={busy != null}
                onClick={() => onDeleteFromLibrary(skill.id)}
              >
                {busy === busyKey(skill.id, 'library', 'delete') ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
              </button>
              </Tooltip>
              <Tooltip content="Copy library skill to another agent">
              <button
                type="button"
                className="badge-chip-copy"
                aria-label="Copy library skill to another agent"
                disabled={busy != null || agents.length < 2}
                aria-expanded={copySourceId === 'library'}
                onClick={() => openCopyMenu('library')}
              >
                <Link2 size={12} />
              </button>
              </Tooltip>
            </span>
            Library
            {copySourceId === 'library' && (
              <span className="copy-menu" role="menu" aria-label="Copy library skill to">
                {copyTargets('library').length === 0 && (
                  <span className="copy-menu-empty">No other agents</span>
                )}
                {copyTargets('library').map((target) => {
                  const key = busyKey(skill.id, target.agentId, 'copy');
                  return (
                    <button
                      key={target.agentId}
                      type="button"
                      role="menuitem"
                      className="copy-menu-item"
                      disabled={busy != null}
                      onClick={() => {
                        setCopySourceId(null);
                        onAssign(skill.id, target.agentId);
                      }}
                    >
                      <AgentIconTile id={target.agentId} size={20} iconSize={10} />
                      <span className="truncate">{target.name}</span>
                      {busy === key && <RefreshCw size={12} className="animate-spin" />}
                    </button>
                  );
                })}
              </span>
            )}
          </span>
        )}

        {onAgents.map((agent) => {
          const key = busyKey(skill.id, agent.agentId, isLibrarySkill ? 'unassign' : 'copy');
          const copyOpen = copySourceId === agent.agentId;
          return (
            <span
              key={agent.agentId}
              className={`badge badge-chip flex items-center gap-1 ${
                isLibrarySkill ? 'badge-success' : 'badge-neutral'
              }`}
            >
              <span className="badge-chip-remove-wrap">
                <Tooltip content={`Delete ${skill.name} from ${agent.name}`}>
                <button
                  type="button"
                  className="badge-chip-remove"
                  disabled={busy != null}
                  aria-label={`Delete ${skill.name} from ${agent.name}`}
                  onClick={() => onUnassign(skill.id, agent.agentId)}
                >
                  {busy === key ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <X size={12} />
                  )}
                </button>
                </Tooltip>
                <Tooltip content={`Copy ${skill.name} to another agent`}>
                <button
                  type="button"
                  className="badge-chip-copy"
                  aria-label={`Copy ${skill.name} to another agent`}
                  disabled={busy != null || agents.length < 2}
                  aria-expanded={copyOpen}
                  onClick={() => openCopyMenu(agent.agentId)}
                >
                  <Link2 size={12} />
                </button>
                </Tooltip>
              </span>
              {agent.name}
              {copyOpen && (
                <span className="copy-menu" role="menu" aria-label="Copy to">
                  {copyTargets(agent.agentId).length === 0 && (
                    <span className="copy-menu-empty">No other agents</span>
                  )}
                  {copyTargets(agent.agentId).map((target) => {
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
        <div className="skill-row-assign flex-wrap items-center gap-2">
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
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* Marketplace section (M066 backend: alihusains/enterprise-skills)    */
/* ------------------------------------------------------------------ */

interface MarketplaceRowProps {
  skill: MarketplaceSkillSummary;
  busy: boolean;
  /** True when a local skill with this id already exists in the library. */
  inLibrary: boolean;
  onInstall: (skillId: string, overwrite: boolean) => void;
}

const MarketplaceRow = memo(function MarketplaceRow({
  skill,
  busy,
  inLibrary,
  onInstall,
}: MarketplaceRowProps) {
  return (
    <div className="marketplace-row">
      <div className="marketplace-row-main">
        <div className="marketplace-row-title">
          <span className="marketplace-row-name truncate">{skill.name}</span>
          <a
            className="marketplace-row-link"
            href={skill.htmlUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`View ${skill.name} on GitHub`}
          >
            <ExternalLink size={13} />
            <span className="truncate">GitHub</span>
          </a>
        </div>
        <p className="marketplace-row-desc">{skill.description ?? 'No description.'}</p>
      </div>
      <div className="marketplace-row-actions">
        {inLibrary && (
          <span className="marketplace-row-warning text-xs">
            Already in your library — installing replaces it.
          </span>
        )}
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus size={13} />}
          loading={busy}
          onClick={() => onInstall(skill.id, false)}
        >
          Install
        </Button>
      </div>
    </div>
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
  const [search, setSearch] = useState('');

  // New-skill modal state.
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [body, setBody] = useState('');
  const [license, setLicense] = useState('');
  const [compatibility, setCompatibility] = useState('');
  const [allowedTools, setAllowedTools] = useState('');

  // M073: View/Edit modal state for SKILL.md content.
  const [viewEditSkill, setViewEditSkill] = useState<{ id: string; name: string; location: string } | null>(null);
  // P2: which file is open in the viewer + the folder listing.
  const [viewEditFile, setViewEditFile] = useState<string>('SKILL.md');
  const [skillFiles, setSkillFiles] = useState<{ relPath: string; size: number; isDir: boolean }[] | null>(null);
  const [viewEditContent, setViewEditContent] = useState<string>('');
  const [viewEditLoading, setViewEditLoading] = useState(false);
  const [viewEditSaving, setViewEditSaving] = useState(false);
  const [viewEditError, setViewEditError] = useState<string | null>(null);

  // Marketplace (M066): collapsed AND unfetched by default — the first
  // "Browse marketplace" click is what fires the network request.
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketSkills, setMarketSkills] = useState<MarketplaceSkillSummary[] | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [marketBusyId, setMarketBusyId] = useState<string | null>(null);

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
        addToast({
          type: 'success',
          title: 'Skill removed',
          message: `${skillId} removed from ${agentId}`,
        });
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

  const handleDeleteFromLibrary = useCallback(
    async (skillId: string) => {
      // Confirmation before the destructive action — same pattern as the
      // provider/MCP delete flows (plain confirm, agent-copy notice included).
      if (
        !confirm(
          `Delete skill "${skillId}" from the shared library?\n\nCopies already assigned to agents are not touched.`
        )
      ) {
        return;
      }
      setBusy(busyKey(skillId, 'library', 'delete'));
      try {
        const res = await api.deleteSkill(skillId);
        if (!res.ok) throw new Error(res.error ?? 'Delete failed');
        addToast({
          type: 'success',
          title: 'Skill deleted',
          message: `${skillId} removed from the library`,
        });
        await load();
      } catch (e) {
        addToast({
          type: 'error',
          title: 'Delete failed',
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusy(null);
      }
    },
    [addToast, load]
  );

  const handleAdopt = useCallback(
    async (skillId: string, source: string) => {
      const exists = (snapshot?.skills ?? []).some((s) => s.id === skillId);
      if (exists && !confirm(`"${skillId}" is already in the library. Replace it with the discovered copy?`)) return;
      setBusy(busyKey(skillId, source, 'adopt'));
      try {
        const res = await api.adoptSkill(skillId, source, exists);
        if (!res.ok) throw new Error(res.error ?? 'Adopt failed');
        addToast({ type: 'success', title: 'Skill adopted', message: `${skillId} is now in the library` });
        await load();
      } catch (e) {
        addToast({ type: 'error', title: 'Adopt failed', message: e instanceof Error ? e.message : String(e) });
      } finally {
        setBusy(null);
      }
    },
    [snapshot, addToast, load]
  );

  // M073: Open the view/edit modal for a skill's SKILL.md. `mode` is part
  // of the call-site signature but the modal infers mode from content
  // writability, so it is intentionally unused here.
  const openViewEdit = useCallback(
    async (skillId: string, location: string, _mode: 'view' | 'edit') => {
      const skill = snapshot?.allSkills.find((s) => s.id === skillId);
      if (!skill) return;
      setViewEditSkill({ id: skillId, name: skill.name, location });
      setViewEditContent('');
      setViewEditError(null);
      setViewEditFile('SKILL.md');
      setViewEditLoading(true);
      try {
        const res = await api.getSkillContent(skillId, location);
        if (!res.ok || !res.data) throw new Error(res.error ?? 'Failed to load skill content');
        setViewEditContent(res.data.content);
      } catch (e) {
        setViewEditError(e instanceof Error ? e.message : String(e));
      } finally {
        setViewEditLoading(false);
      }
    },
    [snapshot]
  );

  const handleView = useCallback(
    (skillId: string, location: string) => {
      void openViewEdit(skillId, location, 'view');
    },
    [openViewEdit]
  );

  const handleEdit = useCallback(
    (skillId: string, location: string) => {
      void openViewEdit(skillId, location, 'edit');
    },
    [openViewEdit]
  );

  // P2: save the OPEN file — SKILL.md keeps the legacy endpoint; anything else
  // goes through the per-file API.
  const handleSaveSkillContent = useCallback(async () => {
    if (!viewEditSkill) return;
    setViewEditSaving(true);
    setViewEditError(null);
    try {
      const res =
        viewEditFile === 'SKILL.md'
          ? await api.saveSkillContent(viewEditSkill.id, viewEditSkill.location, viewEditContent)
          : await api.saveSkillFile(
              viewEditSkill.id,
              viewEditSkill.location,
              viewEditFile,
              viewEditContent
            );
      if (!res.ok) throw new Error(res.error ?? 'Save failed');
      addToast({
        type: 'success',
        title: 'File saved',
        message: `${viewEditSkill.name}/${viewEditFile}`,
      });
      setViewEditSkill(null);
      await load();
    } catch (e) {
      setViewEditError(e instanceof Error ? e.message : String(e));
    } finally {
      setViewEditSaving(false);
    }
  }, [viewEditSkill, viewEditFile, viewEditContent, addToast, load]);

  // P2: file switcher inside the open modal — fetch the clicked file's content.
  const handleOpenFile = useCallback(
    async (relPath: string) => {
      if (!viewEditSkill) return;
      setViewEditFile(relPath);
      setViewEditError(null);
      setViewEditLoading(true);
      try {
        if (relPath === 'SKILL.md') {
          const res = await api.getSkillContent(viewEditSkill.id, viewEditSkill.location);
          if (!res.ok || res.data == null) throw new Error(res.error ?? 'Not found');
          setViewEditContent(res.data.content);
        } else {
          const res = await api.readSkillFile(viewEditSkill.id, viewEditSkill.location, relPath);
          if (!res.ok || res.data == null) throw new Error(res.error ?? 'Not found');
          setViewEditContent(res.data.content);
        }
      } catch (e) {
        setViewEditError(e instanceof Error ? e.message : String(e));
      } finally {
        setViewEditLoading(false);
      }
    },
    [viewEditSkill]
  );

  // P2: delete a non-SKILL.md file from the open skill.
  const handleDeleteFile = useCallback(
    async (relPath: string) => {
      if (!viewEditSkill) return;
      if (!confirm(`Delete ${relPath} from ${viewEditSkill.name}?`)) return;
      const res = await api.deleteSkillFile(viewEditSkill.id, viewEditSkill.location, relPath);
      if (!res.ok) {
        addToast({ type: 'error', title: 'Delete failed', message: res.error ?? 'Unknown error' });
        return;
      }
      addToast({ type: 'success', title: 'File deleted', message: relPath });
      await handleOpenFile('SKILL.md');
    },
    [viewEditSkill, handleOpenFile, addToast]
  );

  // P2: load the folder listing when the modal opens; reset the open file.
  useEffect(() => {
    if (!viewEditSkill) {
      setSkillFiles(null);
      setViewEditFile('SKILL.md');
      return;
    }
    let alive = true;
    api
      .listSkillFiles(viewEditSkill.id, viewEditSkill.location)
      .then((res) => {
        if (alive && res.ok && res.data) setSkillFiles(res.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [viewEditSkill]);

  // P2: rename a library skill.
  const handleRename = useCallback(
    async (skillId: string) => {
      const newName = prompt(`Rename "${skillId}" to:`, skillId);
      if (!newName || newName.trim() === skillId) return;
      const res = await api.renameSkill(skillId, newName.trim());
      if (!res.ok || !res.data) {
        addToast({ type: 'error', title: 'Rename failed', message: res.error ?? 'Unknown error' });
        return;
      }
      addToast({ type: 'success', title: 'Skill renamed', message: `${skillId} → ${res.data.newId}` });
      await load();
    },
    [addToast, load]
  );

  // P2: duplicate a library skill.
  const handleDuplicate = useCallback(
    async (skillId: string) => {
      const res = await api.duplicateSkill(skillId);
      if (!res.ok || !res.data) {
        addToast({ type: 'error', title: 'Duplicate failed', message: res.error ?? 'Unknown error' });
        return;
      }
      addToast({ type: 'success', title: 'Skill duplicated', message: res.data.newId });
      await load();
    },
    [addToast, load]
  );

  // P2: import a .zip skill export into the library.
  const handleImportZip = useCallback(
    async (file: File) => {
      const res = await api.importSkillZip(file);
      if (!res.ok || !res.data) {
        // Offer overwrite on conflict; otherwise surface the error.
        if ((res.error ?? '').includes('already exists')) {
          const retry = await api.importSkillZip(file, true);
          if (retry.ok && retry.data) {
            addToast({ type: 'success', title: 'Skill imported (replaced)', message: retry.data.newId });
            await load();
          }
        }
        return;
      }
      addToast({ type: 'success', title: 'Skill imported', message: res.data.newId });
      await load();
    },
    [addToast, load]
  );

  const loadMarketplace = useCallback(async (force: boolean) => {
    setMarketLoading(true);
    setMarketError(null);
    try {
      const res = await api.listMarketplaceSkills(force);
      if (res.ok && res.data) {
        setMarketSkills(res.data.skills);
      } else {
        // Show the server's honest error verbatim (rate limits, network).
        setMarketError(res.error ?? 'Failed to load the marketplace');
      }
    } catch (e) {
      setMarketError(e instanceof Error ? e.message : String(e));
    } finally {
      setMarketLoading(false);
    }
  }, []);

  const handleMarketBrowse = useCallback(() => {
    setMarketOpen(true);
    if (marketSkills == null) void loadMarketplace(false);
  }, [marketSkills, loadMarketplace]);

  const handleMarketInstall = useCallback(
    async (skillId: string, overwrite: boolean) => {
      if (!overwrite) {
        const exists = (snapshot?.skills ?? []).some((s) => s.id === skillId);
        if (
          exists &&
          !confirm(
            `Skill "${skillId}" is already in your library.\n\nReplace it with the marketplace version?`
          )
        ) {
          return;
        }
      }
      setMarketBusyId(marketBusyKey(skillId));
      try {
        const res = await api.installMarketplaceSkill(skillId, overwrite);
        if (!res.ok) throw new Error(res.error ?? 'Install failed');
        addToast({
          type: 'success',
          title: 'Skill installed',
          message: `${skillId} added to the library`,
        });
        await load(); // the installed skill now shows up in the local list
      } catch (e) {
        addToast({
          type: 'error',
          title: 'Install failed',
          message: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setMarketBusyId(null);
      }
    },
    [snapshot, addToast, load]
  );

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await api.createSkill({
        name: name.trim(),
        description: description.trim() || undefined,
        body: body.trim() || undefined,
        license: license.trim() || undefined,
        compatibility: compatibility.trim() || undefined,
        allowedTools: allowedTools.trim()
          ? allowedTools.trim().split(/\s+/).filter(Boolean)
          : undefined,
      });
      if (!res.ok || !res.data) throw new Error(res.error ?? 'Create failed');
      addToast({ type: 'success', title: 'Skill created', message: res.data.skill.name });
      setModalOpen(false);
      setName('');
      setDescription('');
      setBody('');
      setLicense('');
      setCompatibility('');
      setAllowedTools('');
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
  }, [name, description, body, license, compatibility, allowedTools, addToast, load]);

  const totalAssignments = useMemo(() => {
    if (!snapshot) return 0;
    return Object.values(snapshot.assignments).reduce((sum, ids) => sum + ids.length, 0);
  }, [snapshot]);

  // Every skill known anywhere (library + all agents), name-sorted by the
  // server; client-side substring filter on top of the already-fetched list.
  const allSkills: AggregatedSkill[] = snapshot?.allSkills ?? [];
  const librarySkillIds = useMemo(
    () => new Set((snapshot?.skills ?? []).map((s: SkillDef) => s.id)),
    [snapshot]
  );
  const filteredSkills = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSkills;
    return allSkills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q)
    );
  }, [allSkills, search]);

  const { containerRef, onScroll, range } = useWindowedList(
    filteredSkills.length,
    SKILL_ROW_HEIGHT
  );
  const visibleSkills = filteredSkills.slice(range.start, range.end);

  return (
    <div className="page-container">
      <SectionHeader
        title="Skills"
        description="Every skill on this machine — the shared library plus each skill-capable agent's own skills."
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
          title="Skills total (all agents)"
          value={snapshot ? allSkills.length : '—'}
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

      {/* Empty library — keep the existing "create your first skill" affordance */}
      {snapshot != null && snapshot.skills.length === 0 && allSkills.length === 0 && !loading && (
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

      {/* All skills — windowed list with search */}
      {loading ? (
        <Card title="All skills" className="mb-6">
          <div className="space-y-2" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="block" width="100%" height={SKILL_ROW_HEIGHT - 8} />
            ))}
          </div>
        </Card>
      ) : (
        snapshot != null &&
        allSkills.length > 0 && (
          <Card
            title={`All skills (${allSkills.length})`}
            actions={
              <div className="skill-search relative w-64 max-w-full">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none"
                />
                <input
                  className="input pl-8"
                  type="search"
                  placeholder="Filter skills…"
                  aria-label="Filter skills"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            }
          >
            <div
              ref={containerRef}
              onScroll={onScroll}
              className="skill-window"
              style={{ maxHeight: '65vh' }}
            >
              <div className="skill-window-viewport" style={{ height: range.totalHeight }}>
                <div
                  className="skill-window-slice"
                  style={{ transform: `translateY(${range.offsetTop}px)` }}
                >
                  {visibleSkills.map((skill) => (
                    <SkillRow
                      key={skill.id}
                      skill={skill}
                      agents={snapshot.agents}
                      isLibrarySkill={librarySkillIds.has(skill.id)}
                      busy={busy}
                      onAssign={handleAssign}
                      onUnassign={handleUnassign}
                      onCopy={handleCopy}
                      onAdopt={handleAdopt}
              onRename={handleRename}
              onDuplicate={handleDuplicate}
              onDeleteFromLibrary={handleDeleteFromLibrary}
                      onView={handleView}
                      onEdit={handleEdit}
                    />
                  ))}
                </div>
              </div>
            </div>
            {filteredSkills.length === 0 && (
              <p className="text-sm text-tertiary py-4 text-center">
                No skills match “{search.trim()}”.
              </p>
            )}
          </Card>
        )
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

      {/* Marketplace — collapsed and unfetched until the user browses it */}
      <Card
        className="mb-6"
        title={
          <span className="flex items-center gap-2">
            <Store size={16} />
            Marketplace
          </span>
        }
      >
        {marketOpen ? (
          <div>
            <div className="marketplace-toolbar">
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw size={13} />}
                loading={marketLoading}
                onClick={() => void loadMarketplace(true)}
              >
                Refresh
              </Button>
              <span className="text-xs text-tertiary">
                {marketSkills != null &&
                  `${marketSkills.length} skills from alihusains/enterprise-skills`}
              </span>
            </div>
            {marketError != null && (
              <div className="error-banner mb-4">
                <p className="text-sm text-error">{marketError}</p>
              </div>
            )}
            {marketLoading && marketSkills == null && marketError == null ? (
              <div className="space-y-2" aria-busy="true">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton
                    key={`marketplace-skeleton-${i}`}
                    className="block"
                    width="100%"
                    height={64}
                  />
                ))}
              </div>
            ) : marketSkills != null ? (
              marketSkills.length === 0 ? (
                <p className="text-sm text-tertiary py-4 text-center">
                  The marketplace has no skills right now.
                </p>
              ) : (
                <div className="marketplace-list">
                  {marketSkills.map((skill) => (
                    <MarketplaceRow
                      key={skill.id}
                      skill={skill}
                      busy={marketBusyId === skill.id}
                      inLibrary={(snapshot?.skills ?? []).some((s) => s.id === skill.id)}
                      onInstall={(id, overwrite) => void handleMarketInstall(id, overwrite)}
                    />
                  ))}
                </div>
              )
            ) : null}
          </div>
        ) : (
          <div className="marketplace-collapsed">
            <p className="text-sm text-secondary">
              Browse and install skills from the public{' '}
              <a
                className="marketplace-row-link"
                href="https://github.com/alihusains/enterprise-skills"
                target="_blank"
                rel="noreferrer"
              >
                alihusains/enterprise-skills
              </a>{' '}
              repo. Nothing is fetched until you browse.
            </p>
            <label className="btn-secondary btn-sm inline-flex items-center gap-1.5 cursor-pointer">
              <Upload size={14} />
              Import zip
              <input
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportZip(file);
                  e.target.value = '';
                }}
              />
            </label>
            <Button
              variant="primary"
              size="sm"
              icon={<Store size={14} />}
              onClick={handleMarketBrowse}
            >
              Browse marketplace
            </Button>
          </div>
        )}
      </Card>

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="License (optional)"
            htmlFor="skill-license"
            help="agentskills.io spec field — e.g. Apache-2.0."
          >
            <input
              id="skill-license"
              className="input"
              value={license}
              placeholder="Apache-2.0"
              onChange={(e) => setLicense(e.target.value)}
            />
          </Field>
          <Field
            label="Compatibility (optional)"
            htmlFor="skill-compat"
            help="Spec field — environment requirements, max 500 chars."
          >
            <input
              id="skill-compat"
              className="input"
              value={compatibility}
              placeholder="Requires git, docker, jq"
              onChange={(e) => setCompatibility(e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Allowed tools (optional)"
          htmlFor="skill-tools"
          help="Spec (experimental): space-separated pre-approved tools."
        >
          <input
            id="skill-tools"
            className="input font-mono"
            value={allowedTools}
            placeholder="Bash(git:*) Read"
            onChange={(e) => setAllowedTools(e.target.value)}
          />
        </Field>
      </Modal>

      {/* M073: View/Edit skill content modal */}
      <Modal
        open={viewEditSkill != null}
        onClose={() => setViewEditSkill(null)}
        title={viewEditSkill ? `${viewEditSkill.name}${viewEditFile ? ` — ${viewEditFile}` : ''}` : 'Skill'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setViewEditSkill(null)}>
              Close
            </Button>
            {viewEditSkill && viewEditContent && (
              <Button
                variant="primary"
                loading={viewEditSaving}
                disabled={viewEditLoading}
                onClick={() => void handleSaveSkillContent()}
              >
                Save changes
              </Button>
            )}
          </>
        }
      >
        {viewEditError && (
          <div className="error-banner mb-4">
            <p className="text-sm text-error">{viewEditError}</p>
          </div>
        )}
        {viewEditLoading ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="block" width="100%" height={200} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-3">
            {/* P2: file browser sidebar */}
            <div className="border border-border-primary rounded-md overflow-y-auto max-h-[420px] text-sm">
              <div className="px-2 py-1.5 text-xs font-medium text-text-secondary border-b border-border-primary">
                Files
              </div>
              {(skillFiles ?? [{ relPath: 'SKILL.md', size: 0, isDir: false }]).map((f) =>
                f.isDir ? (
                  <div
                    key={f.relPath}
                    className="px-2 py-1 text-text-tertiary flex items-center gap-1.5"
                    title="Folder"
                  >
                    <Folder size={12} /> {f.relPath}
                  </div>
                ) : (
                  <div
                    key={f.relPath}
                    className={`flex items-center justify-between px-2 py-1 group ${
                      viewEditFile === f.relPath ? 'bg-bg-tertiary font-medium' : 'hover:bg-bg-hover'
                    }`}
                  >
                    <button
                      type="button"
                      className="flex-1 text-left flex items-center gap-1.5 min-w-0"
                      onClick={() => void handleOpenFile(f.relPath)}
                    >
                      <FileText size={12} className="flex-shrink-0" />
                      <span className="truncate">{f.relPath}</span>
                      {f.size > 0 && (
                        <span className="text-[10px] text-text-tertiary flex-shrink-0">
                          {f.size > 1024 ? `${Math.round(f.size / 1024)}K` : `${f.size}B`}
                        </span>
                      )}
                    </button>
                    {f.relPath !== 'SKILL.md' && (
                      <button
                        type="button"
                        aria-label={`Delete ${f.relPath}`}
                        className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-error p-0.5"
                        onClick={() => void handleDeleteFile(f.relPath)}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
            <div>
              <CodeEditor
                value={viewEditContent}
                onChange={setViewEditContent}
                placeholder="File content will appear here…"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
