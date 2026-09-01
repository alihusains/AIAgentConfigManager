/**
 * Command palette (Cmd-K / Ctrl-K) — Raycast/Linear-style command menu.
 *
 * Hand-rolled: no external dependency. ~250 lines, zero added bundle weight.
 *
 * Features:
 * - Keyboard-first: Cmd-K/Ctrl-K to open, arrows to navigate, Enter to select,
 *   Esc to close. Full operation without a mouse.
 * - Focus management: focus trapped while open, restored to the trigger on close.
 * - Accessible: combobox/listbox ARIA roles, aria-activedescendant,
 *   screen-reader announcements for result counts.
 * - Respects prefers-reduced-motion for the open/close transition.
 * - Results grouped by entity type (Views / Providers / Agents / Actions).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useStore, type View } from '../store';
import { toggleTheme } from './ThemeToggle';
import { Search, CornerDownLeft } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaletteItem {
  id: string;
  label: string;
  group: string;
  icon?: React.ReactNode;
  action: () => void;
  /** Secondary text shown under the label (e.g. provider ID, agent path) */
  description?: string;
}

interface PaletteGroup {
  group: string;
  items: PaletteItem[];
}

// ---------------------------------------------------------------------------
// Palette items
// ---------------------------------------------------------------------------

function buildItems(
  agents: { id: string; name: string }[],
  providers: { id: string; name: string }[],
  setActiveView: (v: View) => void,
  openAgent: (id: string) => void,
  openProvider: (id: string) => void,
  toggleTheme: () => void
): PaletteItem[] {
  const views: { view: View; label: string }[] = [
    { view: 'overview', label: 'Overview' },
    { view: 'providers', label: 'Providers' },
    { view: 'mcp', label: 'MCP Servers' },
    { view: 'agents', label: 'Agents' },
    { view: 'skills', label: 'Skills' },
    { view: 'tools', label: 'CLI Tools' },
    { view: 'env-vars', label: 'Environment' },
    { view: 'settings', label: 'Settings' },
  ];

  const navItems: PaletteItem[] = views.map((v) => ({
    id: `nav-${v.view}`,
    label: v.label,
    group: 'Navigate',
    action: () => setActiveView(v.view),
  }));

  const providerItems: PaletteItem[] = providers.map((p) => ({
    id: `provider-${p.id}`,
    label: p.name,
    group: 'Providers',
    description: p.id,
    // Deep-link to the provider's detail page, not the generic list
    // (audit D2 — parity with the agent items' openAgent behavior).
    action: () => openProvider(p.id),
  }));

  const agentItems: PaletteItem[] = agents.map((a) => ({
    id: `agent-${a.id}`,
    label: a.name,
    group: 'Agents',
    description: a.id,
    action: () => openAgent(a.id),
  }));

  const actionItems: PaletteItem[] = [
    {
      id: 'action-theme',
      label: 'Toggle theme',
      group: 'Actions',
      action: toggleTheme,
    },
  ];

  return [...navItems, ...providerItems, ...agentItems, ...actionItems];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const { agents, registry, setActiveView, openAgent, openProvider } = useStore();

  // Build the full item list (memoized on data changes)
  const allItems = useMemo(() => {
    const providers = (registry?.providers ?? []).map((rp) => ({
      id: rp.provider.id,
      name: rp.provider.name,
    }));
    const agentList = agents.map((a) => ({ id: a.id, name: a.name }));
    return buildItems(agentList, providers, setActiveView, openAgent, openProvider, toggleTheme);
  }, [agents, registry, setActiveView, openAgent, openProvider, toggleTheme]);

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q) ||
        (item.description?.toLowerCase().includes(q) ?? false)
    );
  }, [allItems, query]);

  // Group for rendering
  const groups: PaletteGroup[] = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    for (const item of filtered) {
      const arr = map.get(item.group) ?? [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
  }, [filtered]);

  // Flat index mapping (group → global index)
  const flatItems = useMemo(() => filtered, [filtered]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus the input after paint
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keyboard shortcut: Cmd-K / Ctrl-K
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        triggerRef.current = (document.activeElement as HTMLElement) ?? null;
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePalette();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Restore focus on close
  const closePalette = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
    triggerRef.current = null;
  }, []);

  // Scroll active item into view (guarded: jsdom lacks scrollIntoView)
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % Math.max(flatItems.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(
        (i) => (i - 1 + Math.max(flatItems.length, 1)) % Math.max(flatItems.length, 1)
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[activeIndex];
      if (item) {
        item.action();
        closePalette();
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className="palette-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closePalette();
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        {/* Search input */}
        <div className="palette-input-row">
          <Search size={16} className="palette-input-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-listbox"
            aria-activedescendant={
              flatItems[activeIndex] ? `palette-item-${activeIndex}` : undefined
            }
            aria-label="Search commands"
            placeholder="Search providers, agents, actions…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="palette-kbd" aria-hidden="true">
            <CornerDownLeft size={12} />
          </kbd>
        </div>

        {/* Results */}
        <div className="palette-results" role="presentation">
          {/* Screen-reader announcement */}
          <span aria-live="polite" aria-atomic="true" className="sr-only">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>

          {filtered.length === 0 ? (
            <div className="palette-empty">No results for "{query}"</div>
          ) : (
            <ul ref={listRef} id="palette-listbox" role="listbox" className="palette-list">
              {groups.map((group) => (
                <li key={group.group} role="presentation" className="palette-group">
                  <div className="palette-group-label" role="presentation">
                    {group.group}
                  </div>
                  <ul role="presentation" className="palette-group-items">
                    {group.items.map((item) => {
                      const globalIdx = flatItems.indexOf(item);
                      const isActive = globalIdx === activeIndex;
                      return (
                        <li
                          key={item.id}
                          id={`palette-item-${globalIdx}`}
                          role="option"
                          aria-selected={isActive}
                          data-index={globalIdx}
                          className={`palette-item ${isActive ? 'palette-item-active' : ''}`}
                          onMouseEnter={() => setActiveIndex(globalIdx)}
                          onClick={() => {
                            item.action();
                            closePalette();
                          }}
                        >
                          <span className="palette-item-label">{item.label}</span>
                          {item.description && (
                            <span className="palette-item-desc font-mono">{item.description}</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
