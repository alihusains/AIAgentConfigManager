# GUI UX Audit — current state (post-v2 redesign)

**Scope:** `packages/gui/src` — UI/UX only (no backend/architecture). 13,700 LOC: 3,848-line token/utility CSS, 9 `ui/` primitives, 20 components.
**Stack:** React 18 + Vite + Zustand + lucide-react; hand-rolled utility CSS + BEM component classes; Inter / Space Grotesk / JetBrains Mono; `data-theme` light/dark.
**Supersedes:** `gui-design-audit.md` (pre-v2 snapshot — its findings were fixed or invalidated by the Agentic Control Plane redesign; kept for history).
**Method:** full read of `index.css`, `App.tsx`, `Sidebar`, `Dashboard`, `Modal`, `Button`, `Toggle`, `Toast`, `ThemeToggle`, `RamMeter`, `CommandPalette`, plus targeted reads of `AgentsView`, `ProvidersView`, and grep verification of every claim below.

Severity: 🔴 P0 (broken for a whole user class) · 🟡 P1 (degrades UX measurably) · 🟢 P2 (polish/debt)
Effort: S (<2h) · M (half day) · L (1–2 days)

---

## F. What's already strong — do not regress

1. **Token architecture** — single source of truth, AA-safe `-text` variants exist, dark-theme invariants documented, elevation tokens layered.
2. **Reduced-motion** — global CSS override + JS hooks (`usePrefersReducedMotion`, `useCountUp` skips, palette animations disabled).
3. **Windowed/virtualized lists** (agents, skills) with memoized fixed-height rows — stays responsive at catalog scale.
4. **CommandPalette** — real focus trap, focus restore, ARIA combobox/listbox + `aria-activedescendant`, sr-only result announcements.
5. **Toasts** — role/alert semantics, aria-live region, typed variants.
6. **Breadcrumbs** — truncation priority (leading crumbs readable, current page truncates first), `min-width: 0` overflow fix.
7. **Skip-to-content link**, `color-scheme` per theme, `overscroll-behavior: contain` on scroll regions.
8. No emoji icons, single icon family (lucide), no `window.confirm/alert`, no hardcoded hex in component code (all via tokens/ptype classes).

---

## A. Accessibility — biggest gap (5.5/10)

- 🔴 **A1 — Modal has no focus management.** `ui/Modal.tsx` (81 lines) has zero focus logic: no trap, no initial focus, no restore. Tab leaks behind the overlay; screen readers wander the page. The correct pattern already exists in-repo (`CommandPalette.tsx` traps + restores). **Effort: M.**
- 🔴 **A2 — Status text uses brand-only hexes, not the AA `-text` tokens — the token file's own rule is violated by its consumers.** `index.css` defines and documents `--accent-*-text` ("brand hex fails AA at small sizes") but the text-bearing rules consume the brand token anyway: `.badge-primary/success/warning/error` (index.css:1238–1253), `.chip` (:778), `.dash-provider-count` (:1189), and the `.text-accent/.text-success/.text-warning/.text-error` utilities (:525–534). Concrete failing instance: top-bar inline error is `text-xs text-error` — 12px `#d1364c` on `#f7f6fb` ≈ 3.8:1 < 4.5:1 (fails AA). 11px badges at 500 weight are the common case. **Fix is a one-line token swap per rule. Effort: S.**
- 🟡 **A3 — Hover-only popover with no keyboard path.** `.mcp-agent-list` opens only on `.mcp-agent-stack-wrap:hover` (index.css:1579) — no `:focus-within` variant (`.avatar-pop` has both at :2906–2909, so the pattern exists). Keyboard and touch users can never see the full "Installed On" list. **Effort: S.**
- 🟡 **A4 — Hover-revealed row actions break on touch.** `.mcp-row-actions` (:1479), `.env-row-actions` (:3824), `.providers-table .row-actions` (:2836) go `opacity: 0 → 1` on `tr:hover`/`:focus-within`. Keyboard is covered; touch has no hover, so the Edit/Delete actions are invisible until an accidental tap. Needs an always-visible-when-narrow or long-press/tap-to-reveal strategy. **Effort: M.**
- 🟡 **A5 — Touch targets far below 44px.** `.switch` is 30×18 (:1312), `.chip button` 14×14 (:781), `.mcp-avatar-remove` 15×15 (:1516), `.badge-chip-remove/-copy` small unset buttons (:2393). None is reliably tappable at 375px. Bonus bug: `all: unset` on the badge-chip buttons also strips the global `:focus-visible` outline. **Effort: M.**
- 🟡 **A6 — No `aria-current="page"` on active nav.** `Sidebar.tsx` marks active state via class only; screen-reader users are not told which view is current. **Effort: S.**
- 🟡 **A7 — Heading hierarchy is inconsistent.** `AgentsView`/`MCPView` use `<h2 class="page-title">` (24px); `ProviderDetailView` uses `<h1 class="text-xl">` (20px — a *smaller* h1 than the h2s elsewhere); `AgentDetailView` uses `<h2 class="text-2xl">`; `Dashboard` has **no page heading at all**. Skip-to-content lands keyboard/SR users in headingless content. Pick one convention (single `<h1 class="page-title">` per view). **Effort: M.**
- 🟡 **A8 — Toast auto-dismiss fixed at 5s.** `Toast.tsx` — no pause-on-hover; error toasts vanish mid-read, no sticky mode for failures. **Effort: S.**
- 🟢 **A9 — `title`-only tooltips (116 usages).** Native tooltips: ~1s delay, invisible on touch, unthemeable, truncate long strings (registry paths in sidebar). Needs a Tooltip primitive. **Effort: M.**
- 🟢 **A10 — Sticky `th` is dead code in most views.** `.table th { position: sticky; top: 0 }` doesn't stick because the vertical scroller is an ancestor view container, not `.table-container` (overflow-x only). The `.env-table` variant works (its scroller is `.env-vars-scroll`). Remove or re-scope. **Effort: S.**

## B. Responsive (6/10)

- 🔴 **B1 — Agents table grid has no mobile fallback.** `.agent-row` (:3098) = `40px + minmax(180px,1.4fr) + minmax(150px,1fr) + minmax(120px,0.9fr) + 96px + 4×14px gaps` ≈ 622px minimum width — and grep confirms **no `@media` override exists** for it (`.avail-row` has one at 720px; `.agent-row` doesn't). At 375px the primary list of the app crushes or overflows. **Effort: M.**
- 🟡 **B2 — No scrim behind the mobile sidebar.** At ≤768px the sidebar becomes a fixed overlay (transform slide), but there is no backdrop: no tap-outside-to-close, page behind stays interactive, focus not contained. **Effort: S.**
- 🟢 **B3 — Breakpoint zoo.** 520/640/720/768/900/1024px all appear (verified counts: 3× 900, 2× 768, 1× each of 520/640/720/1024). Standardize on 2–3 named breakpoints. **Effort: S.**
- 🟢 **B4 — Firefox scrollbars unstyled.** Only `::-webkit-scrollbar` rules exist; no `scrollbar-width: thin; scrollbar-color`. **Effort: S.**

## C. Consistency (6/10)

- 🟡 **C1 — Two page-container conventions.** `.page-container` (max-width 1240, 28/32 gutters) is used **only** by `AgentDetailView`; every other view uses `p-4` (16px) full-bleed. Inconsistent vertical rhythm between sibling views, edge-to-edge stretching on wide monitors. **Effort: S.**
- 🟡 **C2 — Two tab systems.** `.tabs/.tab` (:1593) vs `.tab-list/.tab-btn` (:3658) — different geometry and padding; `ProviderDetailView` uses the second, everything else the first. Merge into one. **Effort: S.**
- 🟡 **C3 — Two stat-card systems.** Dashboard's redesigned `BentoCard` (30px display numerals, per-metric tint, ring) vs the older `ui/StatCard` still used by `SkillsView`/`ToolsView`. The better design exists but only ships on one page. **Effort: M.**
- 🟢 **C4 — Utility/token mismatches.** `.text-lg` = 16px but `--text-size-lg` = 18px; `.text-2xl` = 24px but `--text-size-2xl` = 28px (:494–502 vs :79–86). `.api-badge-row .badge` and `.proto-tick` hardcode `border-radius: 5px` off-token (:2778, :3238). **Effort: S.**
- 🟢 **C5 — Three styling mechanisms.** ~250 lines of hand-rolled Tailwind-style utilities + BEM component classes + 45 inline `style={{}}` objects (magic numbers: `minWidth: 180`, `maxWidth: 240`, `height: 60`). Inline styles bypass the token layer entirely. **Effort: L.**
- 🟢 **C6 — Dark tokens duplicated by hand.** `prefers-color-scheme` and `[data-theme="dark"]` blocks must be kept in exact sync manually (documented invariant, still fragile). A `:root:not([data-theme="light"])` media block alone would remove the copy. **Effort: S.**

## D. Interaction & motion (7/10)

- 🔴 **D1 — Back button dead-ends.** `App.tsx:117` calls `history.replaceState` on every view change. The code comment promises "browser back/forward restores the exact screen", but replace never pushes history entries — five views deep, pressing Back exits the app. The `hashchange` listener already exists; switching to `pushState` (or pushing hash entries) makes the promise true. **Effort: S.**
- 🟡 **D2 — Palette missing views + weak provider deep-links.** `CommandPalette.tsx` Navigate list omits `env-vars`; selecting a provider calls `setActiveView('providers')` (generic list) while agents correctly call `openAgent(id)` — provider search results don't deep-link to `openProvider(id)`. **Effort: S.**
- 🟡 **D3 — RAM meter polls forever.** `RamMeter.tsx` runs a 2s interval regardless of tab visibility (no `document.visibilitychange` pause) and exposes stats only via `title`. **Effort: S.**
- 🟡 **D4 — Skeleton coverage partial.** Only Dashboard, SkillsView, EnvVarsView use `Skeleton`; other views spin or flash content in. **Effort: M.**
- 🟢 **D5 — `⌘K` label shown on all platforms.** The Search button renders `⌘K` unconditionally; Windows/Linux users get Ctrl-K. Platform-detect the kbd hint. **Effort: S.**
- 🟢 **D6 — `transition: all`** on `.btn` (:908) and `.input` (:1000); and `useCountUp` starts 4 simultaneous rAF loops (one per BentoCard) instead of one shared clock. **Effort: S.**

## E. Visual & perceived performance (7/10)

- 🟡 **E1 — Tertiary text is marginal in light mode.** `--text-tertiary #6b687a` carries 11–12px meta at ≈4.0:1 on `--bg-secondary #f0eef7` — borderline for small text. Measure both themes with an automated contrast check; darken or reserve tertiary for ≥14px. **Effort: S.**
- 🟡 **E2 — Fonts loaded from Google CDN.** A localhost tool with a per-session token loads 3 families / 9 weights from `fonts.googleapis.com`: offline → metric-mismatched fallbacks (layout shift), plus an unnecessary third-party request for a local-only dashboard. Self-host subset woff2 (~120KB total). **Effort: M.**
- 🟢 **E3 — Top bar density.** Breadcrumbs + inline error + Search + RAM + Refresh + Theme + Settings (Settings duplicates the sidebar) crowd one row; the error text squeezes everything. Consolidate to icon buttons, drop the duplicated Settings, move error to a banner. **Effort: S.**

---

## Scores & improvement ceiling

| Category | Today | Ceiling | Primary gap drivers |
|---|---|---|---|
| Tokens & theming | 8.5 | 9 | C4 utility drift, C6 dark duplication |
| Color & contrast | 7 | 9 | A2 badge tokens, E1 tertiary text |
| Typography | 7.5 | 9 | C4 mismatches, A7 headings |
| **Accessibility** | **5.5** | **9** | A1 focus trap, A3/A4 hover-only, A5 touch targets |
| Interaction & motion | 7 | 9 | D1 back button, A8 toasts, D2 palette |
| Responsive | 6 | 9 | B1 agents grid, B2 scrim, B3 breakpoints |
| Consistency & layout | 6 | 9 | C1 containers, C2 tabs, C3 stat cards |
| Perceived performance | 7 | 9 | E2 fonts, D4 skeletons, D3 polling |
| **Overall** | **≈ 6.8 / 10** | **≈ 9 / 10** | |

## How much can we improve — three tiers

1. **Quick wins (~1–2 days)** — the S-effort token/one-line fixes: A2, A3, A6, C1, C2, C4, D1, D5, E1 measurement, B4.
   → Overall ≈ **7.6/10**. All known AA text failures resolved; back button works; keyboard can reach every popover; one page rhythm.
2. **Focused pass (~1–2 weeks)** — all P0 + P1: adds A1 (modal focus trap), A4/A5 (touch strategy), A7 (headings), A8 (toast pause), B1 (agents grid), B2 (scrim), C3 (unify stat cards), D2–D4, E2 (self-hosted fonts).
   → Overall ≈ **8.5/10**. Zero known WCAG AA failures; full keyboard operability; touch-usable controls; deterministic typography.
3. **Full polish (~3–4 weeks)** — the structural P2s: A9 (tooltip primitive), C5 (styling consolidation), B3 (breakpoint tokens), A10/C6 (dead code + dark dedup), E3 (top bar).
   → Overall ≈ **9/10** — the practical ceiling without a component-library migration.

**Headline:** the v2 foundation (tokens, motion discipline, virtualization) is genuinely good — the remaining gap is concentrated in *accessibility mechanics* (focus, touch, AA text) and *interaction promises* (back button, deep links), not in visual design. ~60% of the findings are S-effort one-liners.

---

## Fix log — Tier 1 + Tier 2 P0/P1 pass (2026-08-31)

Implemented from this audit. Verification: `tsc --noEmit` clean · 92/92 vitest · vite build clean · biome parity with HEAD baseline (242→245 errors, all three net-new diagnostics pre-existing useButtonType/useSemanticElements in untouched code; zero new from these changes).

| ID | Fix | Files |
|----|-----|-------|
| A1 | Modal focus trap + initial focus + restore-on-close (guarded against autoFocus/ref-directed initial focus; listener keyed on `open` only so inline `onClose` callbacks never re-trigger) | `ui/Modal.tsx` |
| A2 | All text-bearing accent rules now use AA-safe `-text` tokens: `.text-accent/success/warning/error`, `.badge-primary/success/warning/error`, `.chip`, `.dash-provider-count`, `.proto-tick.is-ok/.is-fail` | `index.css` |
| A3 | `.mcp-agent-list` reveals on `:focus-within` (keyboard parity with hover) | `index.css` |
| A4 | Row actions + popovers stay visible under `@media (hover: none)` — `.mcp-row-actions`, `.providers-table .row-actions`, `.env-row-actions`, `.avatar-pop` (also static, not overlaid, on touch) | `index.css` |
| A5 | Touch targets: `.switch` 30×18→44×24 (thumb 14→18, travel 12→22), `.chip button` 14→28px hit area, `.mcp-avatar-remove` 15→24px, `.badge-chip-remove/-copy` +6px padding hit area with restored `:focus-visible` ring (was stripped by `all: unset`) | `index.css` |
| A6 | `aria-current="page"` on every active nav item (registry views, detected agents, settings) | `Sidebar.tsx` |
| A7 | One h1 per view: SectionHeader page-top renders `<h1 class="page-title">` (compact→h3); Providers/MCP/Agents/ProviderDetail/AgentDetail raw h2/small-h1 converted; Dashboard gains heading via its SectionHeader usage pattern | `SectionHeader.tsx`, 5 views |
| A8 | Toast auto-dismiss: 5s success/info, 8s error/warning; pauses on hover/focus, resumes with remaining time | `Toast.tsx` |
| A10 | `.table th` sticky documented (kept for containers that do scroll; env view unaffected) | `index.css` |
| B1 | Removed ~70 lines of dead `.agent-row` CSS (zero TSX references; real list is `.table .agents-table`); path cells get a 640px mobile fallback (min-width floors dropped, paths wrap, font steps down) | `index.css` |
| B2 | Mobile sidebar scrim: click-dismissable overlay behind open sidebar ≤768px, with fade-in; base rule hides it on desktop | `index.css`, `App.tsx` |
| B4 | Firefox scrollbar parity: `scrollbar-width: thin; scrollbar-color` alongside the webkit rules | `index.css` |
| C1 | All 8 view roots use `.page-container` (max-width 1240px, 28/32 gutters) — consistent page rhythm, no edge-to-edge stretch | 8 views |
| C2 | Dead `.tabs/.tab` CSS retired (zero TSX refs); `.tab-list/.tab-btn` is the one system | `index.css` |
| C4 | Type tokens aligned with rendered utility sizes (lg 18→16, 2xl 28→24 — utilities always rendered these); `.api-badge-row .badge` + `.proto-tick` 5px hardcoded radius → `var(--radius-sm)` | `index.css` |
| C6 | Dark theme: single canonical `html[data-theme="dark"]` block — mirrored prefers-color-scheme copy removed; runtime now always resolves `data-theme` (pre-paint script follows OS when unpinned; ThemeToggle adds OS-follow listener + pinned-choice guard) | `index.css`, `index.html`, `ThemeToggle.tsx` |
| D1 | Browser back works: `replaceState` → `pushState` — each view is a history entry; existing hashchange listener consumes pops | `App.tsx` |
| D2 | Command palette: Environment view added to Navigate; provider results deep-link via `openProvider(id)` instead of the generic list | `CommandPalette.tsx` |
| D3 | RamMeter polling pauses on `document.hidden`, resumes on visible (interval + in-flight fetch lifecycle guarded) | `RamMeter.tsx` |
| D5 | Platform-correct kbd hint: ⌘K on Apple, Ctrl-K elsewhere (button title + inline label) | `App.tsx` |
| D6 | `transition: all` → explicit property lists on `.btn` and `.input` | `index.css` |
| E1 | Light-mode tertiary text darkened `#6b687a` → `#5f5c6e` (≈4.6:1 on `--bg-secondary`) | `index.css` |

### Not addressed in this pass (P2 / follow-up)
- **A9** tooltip primitive (116 `title`-only usages) — needs a real Tooltip component, M effort
- **C3** unify StatCard (BentoCard design) across Skills/Tools views — visual redesign, M effort
- **C5** consolidate ~250-line utility layer + 45 inline styles — L effort, should be its own PR
- **E2** self-hosted font subsets (~120KB woff2) — build tooling change, M effort
- **E3** top-bar density (error → banner, drop duplicated Settings) — small visual redesign
- **B3** breakpoint consolidation (520/640/720/768/900/1024 → 2–3 named tokens)

### Collateral fix
- `SkillsView.tsx` pre-existing `TS6133` unused `mode` param (blocked the typecheck) — renamed `_mode` with comment.

### Scores after this pass
| Category | Before | After |
|---|---|---|
| Accessibility | 5.5 | 8.5 |
| Responsive | 6 | 8 |
| Consistency & layout | 6 | 8.5 |
| Interaction & motion | 7 | 8.5 |
| Color & contrast | 7 | 8.5 |
| Tokens & theming | 8.5 | 9 |
| Typography | 7.5 | 8.5 |
| Perceived performance | 7 | 7.5 |
| **Overall** | **≈ 6.8** | **≈ 8.3 / 10** |

---

## Fix log — A9 tooltip primitive (2026-09-01)

The largest remaining accessibility item: 116 `title`-only tooltips that were invisible on touch, delayed ~1s, unthemeable, and truncated long strings (registry paths, drift explanations, model lists).

**Primitive:** `ui/Tooltip.tsx` — wrapper-less (clones its child, merges handlers+ref; no extra DOM node, so flex/grid layouts are untouched):
- Shows on hover (300ms) AND keyboard focus (instant, via `:focus-visible` gating so pointer clicks never flash a tip)
- Touch: 500ms long-press opens; quick tap still clicks; scroll cancels
- Portal tip, `role="tooltip"`, linked via `aria-describedby` while visible
- Position: above trigger, flips below when clipped, clamped horizontally, re-places on resize/scroll
- Esc closes; trigger activation (click) closes — a tip never lingers under a modal
- String content is mirrored back into the native `title` attribute while closed (queryable + AT fallback); cleared while the styled tip is open (no double tooltip)

**Primitives made tooltip-aware** (one change covers every consumer):
- `Button` — `title` prop renders Tooltip around the spread button
- `Badge` — same, for status-pill hints
- `Toggle` — same, for switch hints

**Converted views:** ThemeToggle, RamMeter, ModelChecklist, AgentPicker, Sidebar, Dashboard, AgentDetailView, ProviderDetailView, ProviderVerify, AgentsView (paths, edit/reveal/remove/update/uninstall actions, drift badge, MCP-count, catalog badge, kebab), MCPView (avatar remove, +N overflow, edit/delete), ProvidersView (avatar stack + popover, keychain badge/indicator/migrate, verified-at, models list, details/edit/delete, enabled toggle, modal agent-target labels), SkillsView (view/edit/delete/copy chip buttons), ToolsView (reason spans, description, path), EnvVarsView (sourceFile, reveal button, readonly reason; the adopt button keeps its native title by test contract — its caveat renders in the modal itself).

**Deliberately NOT wrapped** (redundant tooltips avoided):
- MCPView avatar spans — the `.mcp-agent-list` popover (A3 fix) already reveals full names on hover
- ProvidersView popover remove buttons — the agent name is visible right beside them
- Nested tooltips anywhere a child trigger sits inside a toltipped parent

**Tests:** 5 new in `tooltip.test.tsx` (keyboard-focus open + aria link, native-title mirroring, blur hide, long-press vs quick tap, Esc close). Full suite 97/97. Lint: 243 errors vs 245 baseline (touched files biome-formatted; net-negative).

CSS: `.tooltip` block appended to `index.css` (tokens, arrow, `overflow-wrap: anywhere` so paths/model lists wrap instead of truncating — the core native failure).

---

## Fix log — P2 pass: E3, B3, C3, C5 (2026-09-01)

Verification: `tsc --noEmit` clean · 97/97 vitest · vite build clean · biome 245 = pre-P2 baseline (zero new).

### E3 — top-bar density
- The inline truncated error span is gone; persistent errors now render a **dismissible full-width banner** under the header (Dismiss + Retry; a dismissal is forgotten the moment a new error replaces it), mirroring the existing authError banner pattern.
- The top-bar **Settings button is removed** — the sidebar entry (with aria-current) and the ⌘K palette both cover it. Remaining bar: sidebar toggle, breadcrumbs, Search (⌘K), RamMeter, Refresh, ThemeToggle — all distinct affordances.

### B3 — breakpoint consolidation
- Canonical scale documented at the top of `index.css`: **phone ≤640 / mobile ≤768 / tablet ≤900** (1024 stays a single utility escape hatch for `lg:hidden`).
- The lone 520px block merged into 640 (phone). Width breakpoints drop 5→4; every remaining query maps to a named tier.
- Full consolidation to CSS custom-media or a preprocessor is out of scope for hand-written CSS; the documented scale is the guardrail against future ad-hoc widths.

### C3 — KPI unification
- `ui/StatCard` now renders on the **bento tile system** (`.bento-card--static`): same chrome as the Dashboard's tiles — icon+label row, big display-figure value, truncating caption — so Skills and Tools KPI rows match the overview exactly. API unchanged (`title/value/icon/color/trend/onClick`), so no view code changed.
- Removed the now-dead `.stat-card-hover` and `.stat-value` blocks (~30 lines); `color` now flows into the tile via `--bento-tint` (radial wash, icon tint, hover border).

### C5 — utility-layer cleanup (partial, safe slice)
- Dead component-level orphans removed (~120 lines): `.glass-surface`, `.ambient-glow`, `.grain-texture` (all self-labeled "not applied yet"), `.row-clickable`, `.dash-provider-count/-num/-label`, `.bg-bg-primary` (plain; `/95` variant is live), `.skill-card-desc`, `.numeric-display` selector (grouped with the live `.stat-figure`, which was kept and repaired).
- Pruned dead selectors from the tabular-nums group.
- Standard utilities (shadow/rounded/italic/text-lg/xl…) kept deliberately: forward-looking, tiny, and some are conventional naming any contributor may reach for.
- The full 250-line utility-layer redesign remains its own L-effort PR as originally tiered.

Remaining from the audit: E2 (self-hosted font subsets) — build tooling decision, deferred by scope.
