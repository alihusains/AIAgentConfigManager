# GUI Design Audit — Generic/Template Patterns

**Scope:** `packages/gui/src` (index.css 2,437 lines, 9 `ui/` primitives, 20 components)
**Stack:** React 19 + Vite + Zustand + lucide-react; hand-rolled Tailwind-style utility CSS + BEM component classes; Google Fonts (Space Grotesk / IBM Plex Sans / JetBrains Mono); `data-theme` light/dark.
**Method:** redesign-skill anti-template checklist, categories A–H. Audit only — no fixes.

Severity: 🔴 high (reads as AI-template immediately) · 🟡 medium · 🟢 low

---

## A. Typography

- 🔴 **A1 — Page titles are 20px, same weight as card titles.** Every view header (`Dashboard.tsx` "Overview", `ProvidersView`, `MCPView`, `AgentsView`, `SkillsView`, `ToolsView`, `SettingsView`) uses `text-xl font-bold` (20px). Card titles are 14px semibold. There is no display-size tier anywhere — the landing page's biggest text is 20px. No hierarchy, no presence.
- 🔴 **A2 — Dashboard stat values render at 16px.** `ui/StatCard.tsx` renders the value as `text-lg font-bold` (16px) — the same size as body text. The hero numbers of the Overview page are typographically invisible. (An orphaned `.stat-card-value` at `index.css:2025` is 30px display-font — the better design exists but is dead code, see G3.)
- 🟡 **A3 — All-caps micro-labels everywhere.** `.sidebar-label`, `.adr-stat-label`, `.skill-detail-label`, `.stat-card-label` (orphaned) all use uppercase + letter-spacing. The "uppercase subheading" template tic.
- 🟡 **A4 — `tabular-nums` only on `.table td/th`.** Stat values, RamMeter percentages, provider/model counts all jitter as numbers change.
- 🟢 **A5 — No negative tracking on display sizes.** Global body tracking is `-0.011em`; Space Grotesk at heading sizes wants tighter tracking. Minor.

## B. Color & Surfaces

- 🔴 **B1 — Four+ accent hues, no single accent.** `--accent-primary: #0f766e` (teal) **and** `--accent-secondary: #4f46e5` (indigo — the canonical AI purple/blue, used by `.badge-responses` `index.css:1877` and `.protocol-bar-fill.is-responses` `index.css:2157`) **and** `--anthropic-accent: #b3542e` **and** a stat rainbow (`--stat-*`: blue #2563eb / green #16a34a / violet #7c3aed / amber #d97706). The skill says pick one accent.
- 🔴 **B2 — Safe gray-on-white, pure-white cards.** Light theme: `--bg-primary: #ffffff`, `--bg-secondary: #f8fafc`, and the entire border/text scale is Tailwind's default slate palette (`#f1f5f9 #e2e8f0 #cbd5e1 #0f172a #475569 #94a3b8`). White cards on near-white, separated only by 1px borders; all shadows are pure black at 4–10% opacity. No tinted shadows, no texture, no grain, no depth.
- 🔴 **B3 — Two divergent dark themes (token inconsistency).** `@media (prefers-color-scheme: dark)` (`index.css:63–89`, slate-based `#0f172a`) and `[data-theme='dark']` (`index.css:101–127`, custom `#0e1116`) define the same tokens with different values. `ThemeToggle.tsx` only sets `data-theme`; a first-run user gets the media-query theme. Dark mode literally looks different depending on how it's triggered.
- 🟡 **B4 — Hardcoded hex in components.** `ProvidersView.tsx:24–29` `PROVIDER_TYPES` (#D4A843, #41A6D7, #FF9900, #4285F4) applied via inline styles. `ToolsView.tsx` uses `var(--success, #16a34a)` / `var(--warning, #d97706)` — those tokens don't exist (real ones are `--accent-success`/`--accent-warning`), so the fallback hex always wins and never adapts to dark mode.
- 🟢 **B5 — No favicon or meta.** `index.html` ships the default vite.svg favicon, no description/og tags.

## C. Layout

- 🔴 **C1 — Uniform card grids.** Dashboard "By category" = `grid-cols-2 md:grid-cols-3 xl:grid-cols-5` of identical `CategoryCard`s; "Recently updated" = two identical cards; `SkillsView` = uniform 1/2/3-column card grid; `AgentsView` = uniform fixed-height rows. Everything equal-height/equal-width — no featured item, no emphasis, no asymmetry.
- 🔴 **C2 — Flat single-plane layout.** No overlap, no negative margins, no layering, no element breaking its container. Sidebar + topbar + stat row + card grid = the default AI-dashboard composition.
- 🟡 **C3 — No max-width rhythm; inconsistent page containers.** All views use `p-4` (16px) and stretch edge-to-edge on wide screens. `.page-container` (max-width 1240px, 28/32 gutters) exists in CSS but is only used by `AgentDetailView.tsx:169,183`. Every other view ignores it → inconsistent rhythm across views.
- 🟡 **C4 — Uniform 8px radius.** `--radius-md: 8px` on cards, buttons, inputs; badges are 999px pills. Inner elements share the container radius; no radius hierarchy.
- 🟡 **C5 — Dashboard stat row is equal-width flex.** `flex gap-4 flex-wrap` + `flex-1 min-w-[160px]` (`Dashboard.tsx`) → uniform equal-width cards.

## D. Interactivity & States

- 🟡 **D1 — Generic spinner for all loading.** `.spinner` border-circle everywhere (`AgentsView`, `ToolsView`, `Dashboard`). No skeleton loaders.
- 🟡 **D2 — Identical empty states.** Every empty state is the same centered icon + title + message + button (`ui/EmptyState.tsx`). Functional but uniform.
- 🟡 **D3 — `window.confirm()` for deletes.** `MCPView.handleDelete` and `ProvidersView.handleDelete` use native confirm dialogs (same family as `window.alert`, which the skill bans).
- 🟡 **D4 — Sun/moon theme toggle.** `ThemeToggle.tsx` is the exact icon-button pattern the skill calls out.
- 🟡 **D5 — No entrance/stagger motion.** Everything mounts instantly; only `animate-spin`/`animate-pulse` exist. No scroll reveals, no staggered card entry.
- 🟢 **D6 — Good:** global `:focus-visible` (`index.css:184`), `prefers-reduced-motion` respected (`index.css:2063`), hover/active states on buttons/cards.

## E. Components

- 🔴 **E1 — Generic card look.** `.card` = white bg + 1px border + 16px padding + 8px radius. The default card.
- 🟡 **E2 — Pill badges everywhere.** `.badge` uses `border-radius: 999px`; pills in tables, headers, status.
- 🟡 **E3 — Modals for everything.** Add/edit provider, MCP server, custom agent, skill detail, file editor, update dialog — all `.modal-overlay` + `.modal`. No slide-over panels, no inline editing.
- 🔴 **E4 — Two divergent StatCard designs.** `ui/StatCard.tsx` (in use, plain 16px) vs `.stat-card*` CSS (`index.css:1944–2050, 2371` — a Double-Bezel design with left accent bar, 30px display numerals, hover lift). The better one is dead code; the worse one ships. Design divergence + wasted work.
- 🟡 **E5 — Primary + ghost button pair in every header.** Consistent but formulaic.

## F. Iconography

- 🔴 **F1 — lucide-react exclusively.** The default AI icon set, named in the skill. Every icon is a 24px stroke glyph from the same family.
- 🟢 **F2 — AgentIconTile uses brand SVGs** (good) but uniform 8px-radius tiles.

## G. Code Quality

- 🟡 **G1 — Inline styles mixed with class system.** `ProvidersView` (color-mix bg/color), `ToolsView` (var fallbacks), `AgentsView` (spinner width/height), `MCPView` modal body (`maxHeight: '65vh'`), `AgentDetailView`.
- 🟡 **G2 — Hand-rolled utility CSS duplicates Tailwind** (~200 utility classes in `index.css`). This is the stack, so work with it — but the duplication is a maintenance tax and a source of drift.
- 🔴 **G3 — ~120 lines of orphaned CSS.** `.stat-card*`, `.stat-grid`, `.stat-color-*` (`index.css:1944–2050, 2371`) are referenced by no component (only `.stat-card-hover` is used, as a hover utility on `ui/StatCard`). Dead code that diverges from the live design.
- 🟡 **G4 — `window.confirm` usage** (see D3).
- 🟢 **G5 — Missing favicon/meta** (see B5).

## H. Strategic Omissions

- 🟡 **H1 — No skip-to-content link.**
- 🟡 **H2 — No command palette / keyboard shortcuts** (e.g., Cmd+K) — the skill suggests one for power-user feel.
- 🟢 **H3 — No error boundary / 404 view** (desktop app, low priority).

---

## Top offenders (fix these first)

1. **B1/B2** — Collapse to a single accent; kill the indigo `--accent-secondary`; replace pure-white/slate with a tinted, layered surface system.
2. **A1/A2 + E4** — Introduce a real display-size tier for page titles and stat values; adopt the orphaned `.stat-card` design (or a better one) and delete the divergence.
3. **C1/C2** — Break the uniform card grid: feature/emphasize items, add asymmetry and overlap.
4. **B3** — Reconcile the two dark themes into one token set.
5. **G3** — Delete or adopt the ~120 lines of orphaned stat-card CSS.
6. **F1** — Move off lucide-react as the sole icon source.
