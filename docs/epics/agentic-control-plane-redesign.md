# Epic: Agentic Control Plane redesign (E1-E7)

**Status:** Canonical spec. This is the single source of truth for stories E1-E7; the earlier `.scratch/redesign/epic.md` copy is retired and points here.
**Priority note for implementers:** Bug fixes (provider delete cascade) outrank E3, which stays gated on that fix. E1-E2 and E4-E6 run now per the founder's instruction; E1 is foundational and E2/E3/E4/E6 consume its tokens. Do not define your own tokens.
**Screenshot caution:** The user attached image-1.png and image-2.png with their message. Those screenshots document the provider-delete BUG state (success toast while the agent chip remains). They are bug evidence, NOT design references. Do not treat them as target designs.

---

## Part 1: The user's original brief, verbatim

Everything between the markers below is the user's exact text. Implement these exact hex values, font names, and timing numbers. Do not substitute approximations.

<!-- BEGIN VERBATIM USER BRIEF -->

You are a world-class product designer and frontend engineer specializing in modern AI infrastructure, agent platforms, developer tools, and enterprise SaaS.

You are redesigning an existing application called:

AI Config
"registry-first manager"

The current interface is shown in the attached screenshot.

CRITICAL:
The existing UI technically contains useful information, but visually it feels outdated, cluttered, generic, and overly "admin dashboard". Completely rethink the visual system and information hierarchy.

Do NOT make minor cosmetic improvements.

Perform a serious product-level redesign.

The end result should feel like a premium 2026 AI infrastructure / agent orchestration product.

Visual references in terms of product quality and design language:

- Linear
- Vercel
- Raycast
- Cursor
- modern observability platforms
- modern AI agent consoles
- contemporary developer infrastructure products
- high-end enterprise SaaS

Do NOT copy any of these products directly.

Instead, combine their strongest design principles into a distinctive AI Config design language.

==================================================
1. DESIGN DIRECTION
==================================================

The product should feel like:

"Control plane for AI agents, models, tools and infrastructure."

Think:

AI Control Plane
Agent Operations Center
Model Registry
Runtime Configuration
Provider Management
Infrastructure Orchestration

The visual language should communicate:

- intelligence
- precision
- trust
- developer tooling
- orchestration
- observability
- technical sophistication
- calmness
- speed

Avoid:

- generic SaaS dashboards
- old enterprise admin panels
- excessive rounded cards
- excessive pill badges
- excessive borders
- excessive shadows
- neon cyberpunk
- glowing sci-fi effects
- overly colorful dashboards
- giant empty cards
- "AI startup landing page" aesthetics

The interface should be sophisticated rather than flashy.

==================================================
2. CORE VISUAL CONCEPT
==================================================

Introduce a visual concept called:

"Agentic Control Plane"

The system should feel like the user is operating a live network of:

Providers
Models
Agents
MCP Servers
Skills
CLI tools
Runtime configurations

The UI should subtly communicate relationships between these systems.

Use:

- restrained accent colors
- intelligent status indicators
- subtle network/orchestration motifs
- connection states
- deployment states
- health states
- compact metadata
- clear hierarchy
- excellent typography
- purposeful whitespace

DO NOT add decorative AI graphics just for the sake of being "AI".

Everything should support the operational workflow.

==================================================
3. COLOR SYSTEM
==================================================

Create a proper design token system.

There must be two complete themes:

DARK MODE
LIGHT MODE

Users must be able to switch between them instantly.

--------------------------------
DARK THEME
--------------------------------

Use a sophisticated near-black / graphite foundation.

Suggested palette direction:

Background:
#0B0D0F

Primary surface:
#111418

Secondary surface:
#161A1F

Elevated surface:
#1B2026

Border:
#252B32

Primary text:
#F5F7FA

Secondary text:
#9BA4AE

Muted text:
#69727D

Primary accent:
#5EE6C0

Secondary accent:
#7C8CFF

Success:
#48D597

Warning:
#F5C76A

Error:
#FF6B7A

Info:
#6CB7FF

IMPORTANT:

Do not make turquoise dominate the entire interface.

Accent colors should be sparse and meaningful.

Use accent colors primarily for:

- active navigation
- important actions
- connection states
- health indicators
- selected states
- interactive focus
- subtle highlights

--------------------------------
LIGHT THEME
--------------------------------

Create an equally polished light theme.

Background:
#F7F8FA

Primary surface:
#FFFFFF

Secondary surface:
#F1F3F5

Elevated surface:
#FFFFFF

Border:
#E3E7EB

Primary text:
#171A1F

Secondary text:
#5E6670

Muted text:
#8A929C

Primary accent:
#159F84

Secondary accent:
#5C6EF2

Success:
#16845F

Warning:
#A66B00

Error:
#D64559

Info:
#3D73C9

The light theme must NOT simply be the dark theme with white backgrounds.

Design it intentionally.

==================================================
4. TYPOGRAPHY
==================================================

Use a modern developer-product typography hierarchy.

Recommended:

Inter
or
Geist
or
IBM Plex Sans

For technical identifiers, model IDs, provider IDs, CLI commands and code-like metadata:

Use a subtle monospace font.

Possible:

JetBrains Mono
IBM Plex Mono

Typography hierarchy must be clear.

Example:

Page title:
28-32px
600 weight

Section title:
18-20px
600

Body:
14-15px

Metadata:
12-13px

Do not make everything the same font weight.

==================================================
5. GLOBAL LAYOUT
==================================================

Completely rethink the layout.

Use a clean application shell:

LEFT:
Navigation sidebar

CENTER:
Primary workspace

TOP:
Compact global header

Avoid the current oversized empty areas and visually heavy framing.

Suggested structure:

┌───────────────────────────────────────────────────────────────┐
│ AI Config                         Runtime     Search   User   │
├───────────────┬───────────────────────────────────────────────┤
│               │                                               │
│ Overview      │                                               │
│ Providers     │              Main Workspace                   │
│ Models        │                                               │
│ Agents        │                                               │
│ MCP Servers   │                                               │
│ Skills        │                                               │
│ CLI Tools     │                                               │
│               │                                               │
│               │                                               │
│ Detected      │                                               │
│ Agents        │                                               │
│               │                                               │
│ Settings      │                                               │
└───────────────┴───────────────────────────────────────────────┘

Sidebar should be visually quiet.

Use active navigation with:

- subtle background
- small accent indicator
- stronger text
- optional icon

Do not use giant colorful navigation pills.

==================================================
6. SIDEBAR REDESIGN
==================================================

The current sidebar feels like a legacy application.

Redesign it.

Top:

AI Config
Registry-first manager

Make the product identity understated.

Navigation groups:

REGISTRY

Overview
Providers
Models
Agents
MCP Servers
Skills
CLI Tools

DETECTED

Detected Agents

SYSTEM

Settings

Show counts using small neutral counters.

Example:

Providers       20
MCP Servers      7

Counters should not look like giant pills.

Use compact typography and subtle backgrounds.

Detected agent items should feel like installed runtime integrations.

Example:

Claude Code                     ●
Codex                           ●
OpenCode                        ●
Gemini CLI                      ●

Use tiny status dots.

==================================================
7. TOP HEADER
==================================================

Replace the current header with a much cleaner command-center header.

Left:

Breadcrumb

Registry
/
Providers

Center or right:

Global search

Shortcut:
⌘ K

Runtime health indicator

Example:

● Healthy
87.4 MB

Then:

Theme toggle
Settings
User/profile

Do not use large chunky buttons.

Buttons should be compact and elegant.

==================================================
8. PROVIDERS PAGE
==================================================

The current provider table is the biggest visual problem.

Do not simply restyle the existing table.

Redesign the information architecture.

Page header:

Providers

"Manage model providers and distribute provider definitions across your agents."

Right:

+ Add Provider

Below the header introduce a compact contextual toolbar.

Example:

Search providers
Filter
Status
Type
Sort

Then the provider list.

==================================================
9. PROVIDER LIST DESIGN
==================================================

Use a modern dense table/list hybrid.

Each provider should have:

Provider identity
Provider type
API capability
Models
Installed agents
Health/status
Actions

But do not make every attribute look like a pill.

Example row:

┌────────────────────────────────────────────────────────────┐
│ ◉  ic.com                                                 │
│    ic.com                                                  │
│                                                            │
│    OpenAI Compatible    3 APIs    4 models    2 agents     │
│                                                            │
│    ● Connected                              Enabled   ...   │
└────────────────────────────────────────────────────────────┘

Use hierarchy instead of boxes.

Provider name should be dominant.

Provider ID should be secondary.

Model names should be readable.

APIs should be represented as compact labels or text.

Installed agents should appear as compact avatar/icon groups.

For example:

[MM] [Pi] [+2]

Hovering reveals the full list.

==================================================
10. DO NOT OVERUSE PILLS
==================================================

This is extremely important.

The current UI uses pills for almost everything.

Remove roughly 70-80% of the pills.

Use pills only for:

- status
- compact categorical state
- important capability indicators

Do not create pills for every model, API, agent or piece of metadata.

Use:

text
icons
dividers
small labels
avatars
subtle separators

instead.

==================================================
11. PROVIDER ROW INTERACTION
==================================================

Make the provider list interactive.

Hover:

- slightly elevate surface
- reveal row actions
- subtle background change

Click:

Open provider detail.

Actions:

View
Edit
Delete

Do not make three large square outlined buttons appear permanently on every row.

Use a single "..." menu.

On hover or selection, contextual controls can appear.

==================================================
12. PROVIDER DETAIL EXPERIENCE
==================================================

Clicking a provider should open a high-quality detail page.

Header:

Provider icon
Provider name
Status
Provider type

Example:

ic.com

● Connected

OpenAI Compatible

Actions:

Edit
Test Connection
Disable

Then tabs:

Overview
Models
Agents
API Configuration
Activity

Overview should show:

Connection health
Available models
Installed agents
API capabilities
Last verified
Configuration state

Create an experience closer to modern infrastructure tools than CRUD admin software.

==================================================
13. MODEL VISUALIZATION
==================================================

Models should feel like first-class infrastructure entities.

Example:

Qwen3.6-27B-FP8

Provider:
icm llm router

Capabilities:

Chat
Reasoning
Tool use
Vision

Context:

128K

Status:

Available

Use compact capability indicators.

Do not wrap everything in giant badges.

==================================================
14. AGENTIC VISUAL LANGUAGE
==================================================

Introduce subtle agentic concepts.

For example:

Provider
   ↓
Models
   ↓
Agents
   ↓
Tools / Skills

This can appear in:

- detail pages
- relationship sections
- overview dashboards
- configuration panels

Use subtle connector lines, nodes or relationship indicators.

Do NOT turn the entire application into a node graph.

The agentic feeling should be embedded into the UX.

==================================================
15. STATUS SYSTEM
==================================================

Create a standardized status system.

Healthy:
● Connected

Warning:
● Attention

Error:
● Failed

Disabled:
○ Disabled

Unknown:
● Not verified

Use color + text.

Never communicate state using color alone.

==================================================
16. OVERVIEW PAGE
==================================================

Redesign Overview as a true AI infrastructure control center.

Top-level metrics:

Providers
Models
Agents
MCP Servers
Skills
CLI Tools

Then:

System Health

Provider health
Agent connectivity
MCP health
Configuration drift

Then:

Recent Activity

Examples:

Provider added
Model updated
Agent connected
Configuration synchronized
Connection failed

Then:

Agent Runtime

Claude Code
Codex
OpenCode
Gemini CLI

Show:

Online
Last active
Provider count
Model count

The overview should feel alive without becoming a dashboard full of meaningless charts.

==================================================
17. COMMAND PALETTE
==================================================

Add a polished command palette.

Shortcut:

⌘ K

Actions:

Search providers
Search models
Open agent
Add provider
Test connection
Open settings
Switch theme

The command palette should feel like Raycast / Linear quality.

==================================================
18. SEARCH EXPERIENCE
==================================================

Global search must search:

Providers
Models
Agents
MCP servers
Skills
CLI tools

Search results should be grouped.

Example:

PROVIDERS

ic.com
IC Markets
TokenRouter

MODELS

Qwen3.6-27B-FP8
DeepSeek...

AGENTS

Claude Code
OpenCode

==================================================
19. LIGHT AND DARK MODE
==================================================

Both themes must feel first-class.

Do not simply invert colors.

Dark mode:

Calm
technical
deep
premium
developer-focused

Light mode:

precise
clean
professional
high contrast
enterprise-friendly

Maintain identical visual hierarchy across themes.

Transitions between themes should be subtle.

==================================================
20. ICONOGRAPHY
==================================================

Use one consistent icon library.

Lucide is preferred.

Do not mix random icon styles.

Icons should be:

- simple
- geometric
- thin
- technical

Provider logos can use recognizable provider marks where appropriate.

==================================================
21. BUTTONS
==================================================

Redesign all buttons.

Primary:

Filled accent button.

Example:

+ Add Provider

Secondary:

subtle surface button

Example:

Test Connection

Tertiary:

text button

Example:

View

Destructive:

Delete

Avoid the current style of large bordered square icon buttons.

==================================================
22. CARDS
==================================================

Use cards selectively.

Do NOT put every piece of content into a card.

Use surfaces for:

- important configuration blocks
- health summaries
- detail sections
- meaningful groups

Prefer open layouts and whitespace.

==================================================
23. SPACING
==================================================

Establish an 8px spacing system.

Primary spacing:

8
12
16
20
24
32
40

Rows should have enough breathing room.

Do not make the table feel vertically cramped.

==================================================
24. BORDER RADIUS
==================================================

Use restrained radius.

Buttons:
8px

Inputs:
8px

Cards:
10-12px

Avoid excessive rounded UI.

No "everything is a pill" design.

==================================================
25. MOTION
==================================================

Add subtle motion.

Examples:

- row hover
- panel transitions
- theme switching
- command palette opening
- status changes
- loading states
- expandable metadata

Animation should feel fast and intentional.

No excessive bouncing or glowing.

Use approximately:

150-220ms

ease-out

==================================================
26. EMPTY STATES
==================================================

Create polished empty states.

Example:

No providers configured

Connect your first model provider to begin distributing models across your agents.

[ + Add Provider ]

Use minimal illustrations or subtle technical motifs.

==================================================
27. LOADING STATES
==================================================

Use skeleton loading.

Do not use generic spinners everywhere.

Skeletons should preserve layout.

==================================================
28. RESPONSIVE DESIGN
==================================================

The interface must work on:

Desktop
Laptop
Tablet
Mobile

At smaller widths:

Collapse sidebar.

Transform dense provider tables into stacked provider rows.

Preserve all important functionality.

==================================================
29. ACCESSIBILITY
==================================================

Meet WCAG AA where practical.

Ensure:

- keyboard navigation
- visible focus states
- sufficient contrast
- semantic controls
- accessible labels
- no color-only status indicators

==================================================
30. TECHNICAL IMPLEMENTATION
==================================================

Do not create a static visual mockup.

Modify the actual application UI.

Preserve existing functionality and data flows.

Do not break:

- provider creation
- provider editing
- provider deletion
- provider status
- agent installation
- model management
- API configuration
- filtering
- search
- settings

Separate design from business logic.

Create reusable components:

AppShell
Sidebar
Topbar
PageHeader
Toolbar
ProviderList
ProviderRow
StatusIndicator
AgentBadge
CapabilityIndicator
CommandPalette
DetailPanel
EmptyState
Skeleton
Modal
ContextMenu

Use a centralized design token system.

Do not hardcode random colors throughout components.

==================================================
31. IMPORTANT: DATA DENSITY
==================================================

This is an infrastructure product.

Do not make the UI excessively spacious like a consumer application.

Users need to scan many providers/models quickly.

Target:

high information density
+
excellent hierarchy
+
clean whitespace

The objective is:

"information-rich without feeling cluttered."

==================================================
32. IMPORTANT: REMOVE THE CURRENT VISUAL PROBLEMS
==================================================

Explicitly fix these issues visible in the current design:

1. Too many rounded pills
2. Too many heavy borders
3. Excessive teal
4. Weak visual hierarchy
5. Provider information feels cramped
6. Models are difficult to scan
7. Action buttons dominate the row
8. Sidebar feels dated
9. Header contains too many competing controls
10. Table feels like generic CRUD software
11. Installed agents are visually noisy
12. Status indicators are inconsistent
13. Text hierarchy is weak
14. Too much information is represented as badges
15. The UI does not visually communicate "AI infrastructure"
16. The product feels static instead of operational
17. Light theme quality is not considered
18. There is no strong relationship between providers, models and agents
19. The interface feels assembled from components rather than intentionally designed

==================================================
33. DESIGN QUALITY BAR
==================================================

Before finishing, inspect the entire application as a senior product designer.

Ask:

Does this look like a product someone would be proud to demo?

Does it look like a modern AI infrastructure control plane?

Does it feel closer to Linear / Vercel / Raycast quality than a traditional admin panel?

Can users scan 20 providers quickly?

Can users immediately understand provider health?

Can users understand which models belong to which provider?

Can users understand which agents have a provider installed?

Does dark mode look premium?

Does light mode look equally premium?

Does the design feel cohesive?

Does every UI element have a purpose?

If the answer is no, continue refining.

==================================================
34. FINAL VISUAL TARGET
==================================================

The final experience should feel like:

Linear
+
Vercel
+
Raycast
+
AI Agent Control Plane
+
Infrastructure Observability

But with its own identity.

Think:

"Mission Control for AI infrastructure."

Not:

"Dark admin dashboard with cyan buttons."

Do a full visual redesign.

Do not preserve the existing styling merely for familiarity.

Preserve the functionality and information architecture where useful, but completely elevate the visual system, interaction design, hierarchy and UX.

After implementing the redesign:

1. Run the application.
2. Inspect every major screen.
3. Test light mode.
4. Test dark mode.
5. Test responsive layouts.
6. Test provider CRUD.
7. Test search/filter.
8. Test navigation.
9. Test command palette.
10. Fix any visual inconsistencies.
11. Remove accidental duplicated styles.
12. Ensure no placeholder UI remains.

The result should be production-quality, cohesive and polished enough for a professional AI developer platform.

<!-- END VERBATIM USER BRIEF -->

---

## Part 2: Reconciliation with work already landed

Two honest conflicts. Read this before implementing E1.

### 2a. The minimalist theme rebuild vs. this brief

Aion CLI just completed a minimalist theme rebuild: one teal accent, warm layered surfaces, reconciled dark themes. This brief specifies a different direction with different exact hexes.

**Superseded by this brief (styling decisions, replaced by E1):**
- The teal accent choice and its specific value. The brief's accents are `#5EE6C0` / `#7C8CFF` (dark) and `#159F84` / `#5C6EF2` (light).
- The warm surface palette. The brief specifies a cool graphite foundation (`#0B0D0F` / `#111418` / `#161A1F` / `#1B2026`) and its own light surfaces.
- Any component styling built directly on those superseded values.

**Survives regardless (these were bug fixes, not styling — regressing them reopens real bugs):**
- The dark-theme reconciliation: `@media (prefers-color-scheme: dark)` and `html[data-theme='dark']` MUST resolve to identical values. E1 re-expresses this invariant with the new palette; it does not undo it.
- The broken-token fixes: every `var(--token)` referenced anywhere must be defined. No silent fallback to hardcoded hex (the old `--success`/`--warning` phantom-token bug).
- `prefers-reduced-motion` and `:focus-visible` handling.

Practical instruction for E1: keep the *structure* of the reconciled token system (single definition source, both dark-mode entry points mapped to one set), swap the *values* to the brief's palette.

### 2b. Font swap is a real change, not a restyle

The app currently loads Space Grotesk, IBM Plex Sans, and JetBrains Mono from Google Fonts. The brief recommends Inter or Geist for UI, keeping a mono for identifiers.

- **Decision for E1:** adopt **Inter** (variable font) for UI text. It satisfies the brief, has the widest weight/optical coverage, and avoids Geist's Vercel-adjacent licensing/CDN questions. Keep **JetBrains Mono** for identifiers; it is already loaded and the brief explicitly allows it.
- **Drop** Space Grotesk and IBM Plex Sans from the font loading.
- **Bundle note:** Inter variable (latin subset, woff2) is roughly 40-100 KB depending on subsetting; the current three-family Google Fonts load is comparable or larger, so net bundle impact should be neutral-to-positive, but E1 must measure before/after rather than assume. Preload only the critical weight/style; `font-display: swap`; max two families total (Inter + JetBrains Mono), which also brings us in line with the two-family performance rule.

---

## Part 3: Stories E1-E7

Every story carries the same must-not-break contract, named by the user in section 30 of the brief: **provider creation, provider editing, provider deletion, provider status, agent installation, model management, API configuration, filtering, search, settings.** Each story below also lists which of those it touches most and therefore must explicitly verify.

Verification reality: the tree is dirty with parallel work; use per-package commands (`pnpm --filter gui test`, etc.) to verify your own story rather than blocking on a tree-wide green.

### E1: Control Plane design token system (foundational — land first, announce when done)

Scope:
- One centralized token file defining the complete dark and light themes with the brief's exact hexes (Part 1, section 3). Dark: bg `#0B0D0F`, surfaces `#111418`/`#161A1F`/`#1B2026`, border `#252B32`, text `#F5F7FA`/`#9BA4AE`/`#69727D`, accents `#5EE6C0`/`#7C8CFF`, success `#48D597`, warning `#F5C76A`, error `#FF6B7A`, info `#6CB7FF`. Light: bg `#F7F8FA`, surfaces `#FFFFFF`/`#F1F3F5`/`#FFFFFF` (elevated), border `#E3E7EB`, text `#171A1F`/`#5E6670`/`#8A929C`, accents `#159F84`/`#5C6EF2`, success `#16845F`, warning `#A66B00`, error `#D64559`, info `#3D73C9`.
- Accent discipline: accent tokens used only for active navigation, primary actions, connection/health states, selection, focus, subtle highlights. Turquoise must not dominate.
- Typography: Inter (UI) + JetBrains Mono (identifiers, model IDs, paths, CLI commands) per Part 2b. Scale: page title 28-32px/600, section title 18-20px/600, body 14-15px, metadata 12-13px. `tabular-nums` on numeric displays.
- Spacing tokens on the 8px scale: 8/12/16/20/24/32/40.
- Radius tokens: 8px buttons/inputs, 10-12px cards.
- Motion tokens: 150-220ms, ease-out.
- Status token values for the five states in brief section 15 (`● Connected` healthy, `● Attention` warning, `● Failed` error, `○ Disabled`, `● Not verified` unknown). E1 defines the token values only; the shared component that consumes them is E6's.
- Purge hardcoded hex from components (`ProvidersView` PROVIDER_TYPES inline colors, `ToolsView` phantom-token fallbacks); components consume tokens only.

Acceptance criteria:
- Both themes render from one token source; the media-query and `data-theme` dark entry points resolve to identical values (invariant test or snapshot proves it).
- `grep` finds no color hex literals in component files (token file excluded).
- Every referenced `var(--token)` is defined; a check (test or lint rule) enforces it.
- Text and interactive elements meet WCAG AA contrast in both themes.
- Theme switch is instant; `prefers-reduced-motion` and `:focus-visible` still work.
- Font swap measured: before/after transfer size recorded in the PR description.

Must-not-break focus: settings (theme toggle), everything visual downstream.

### E2: Sidebar restructure

Scope:
- Understated identity block: "AI Config" + "Registry-first manager".
- Groups exactly as briefed: REGISTRY (Overview, Providers, Models, Agents, MCP Servers, Skills, CLI Tools), DETECTED (Detected Agents), SYSTEM (Settings).
- Counts as small neutral right-aligned counters (`Providers 20`), compact typography, subtle background. Not pills.
- Active nav: subtle background, small accent indicator, stronger text, optional icon. No giant colorful pills.
- Detected agents as runtime-integration rows with tiny status dots.

Acceptance criteria:
- All sections reachable; counters update live from store state.
- Keyboard navigable with visible focus.
- Active state uses E1 accent tokens only.
- No route or view rendering regressions (navigation to every existing view still works).

Must-not-break focus: navigation into every functional view (providers, models, agents, MCP, skills, CLI tools, settings), search entry point.

### E3: Providers page redesign (GATED: starts only after the provider delete-cascade fix is verified)

Scope:
- Page header: title, subtitle "Manage model providers and distribute provider definitions across your agents.", `+ Add Provider` primary (filled accent) button.
- Contextual toolbar: search, filter (status, type), sort.
- Dense table/list hybrid rows per brief section 9: provider name dominant, provider ID secondary in mono, then compact text labels (`OpenAI Compatible · 3 APIs · 4 models · 2 agents`), then status line + enabled state + `…` menu.
- Kill roughly 70-80% of current pills. Pills remain only for status, compact categorical state, and important capability indicators. Models, APIs, agents, and general metadata become text, labels, separators, or avatars.
- Installed agents as compact avatar/icon groups (`[MM] [Pi] [+2]`), hover reveals the full list. This replaces the chip wall with per-chip x-buttons.
- Row interaction: hover elevates and reveals actions; click opens provider detail (E4); single `…` context menu for View/Edit/Delete replacing the three permanent bordered icon buttons.
- Delete flow: proper confirm dialog component (no `window.confirm`); row state driven by the mutation response, never optimistic. Given the delete-cascade bug this page just exhibited, this story must render backend truth: success only when the backend confirms, errors as errors.
- Empty state per brief section 26; skeleton loading per section 27.

Acceptance criteria:
- 20 providers scannable at 1280px without horizontal scroll.
- Pill census before/after recorded in the PR (target ≥70% reduction on this page).
- Full provider CRUD covered by GUI tests including the delete path; a false-success toast is impossible by construction (assert UI updates only on confirmed response).
- All row actions keyboard-reachable.

Must-not-break focus: provider creation, editing, deletion, status toggle, agent installation from the row, filtering, search.

### E4: Provider detail page with tabs

Scope:
- Route-addressable detail page replacing detail modals. Header: provider icon, name, status (E6 component), type; actions Edit / Test Connection / Disable.
- Tabs exactly as briefed: Overview, Models, Agents, API Configuration, Activity.
- Overview: connection health, available models, installed agents, API capabilities, last verified, configuration state.
- Models: first-class entries (mono ID, provider, compact capability indicators for Chat/Reasoning/Tool use/Vision, context window, availability). No giant badges.
- Agents: install/remove per agent.
- API Configuration: base URL, masked key with explicit reveal, verification results with curl + raw output (existing functionality, restyled).
- Subtle relationship indicator (Provider → Models → Agents → Tools/Skills) per brief section 14; embedded, not a node graph.
- Activity: verification runs, installs/removals, edits. If event data does not yet exist in the store, hide the tab rather than faking entries; note the gap in the PR.

Acceptance criteria:
- Deep link to a provider renders the page directly.
- Everything the old modals could do is reachable from the page; verification flow unchanged functionally.
- No plaintext key rendered without an explicit reveal action.
- Tabs keyboard-navigable.

Must-not-break focus: provider editing, API configuration, verification/test connection, model management, agent installation.

### E5: Command palette (⌘K)

Scope:
- ⌘K (and Ctrl+K) opens a Raycast/Linear-quality palette.
- Searches providers, models, agents, MCP servers, skills, CLI tools; results grouped by entity type with group headers (PROVIDERS / MODELS / AGENTS / …).
- Actions: search providers, search models, open agent, add provider, test connection, open settings, switch theme.
- Header search affordance opens the same palette.
- Keyboard-first: arrows/enter/escape, focus trap while open, focus restore on close. Motion per E1 tokens.

Acceptance criteria:
- Every registry entity type findable; every listed action executes.
- Fully operable without a mouse; ARIA labels on groups and items.
- Opens perceptibly instantly (no data fetch blocking first paint of the palette).

Must-not-break focus: search, settings, provider creation (via palette action), navigation.

### E6: Status system, skeleton loading, motion

Scope:
- One shared StatusIndicator component consuming E1's status tokens: `● Connected` (healthy), `● Attention` (warning), `● Failed` (error), `○ Disabled`, `● Not verified` (unknown). Color plus text always; never color alone. Adopted everywhere status renders (sidebar detected agents, provider rows, detail header, dashboard). E6 does not define color values; it consumes E1's tokens.
- Skeleton loading components preserving layout; replace generic spinners across views.
- Motion pass: row hover, panel transitions, theme switch, palette open, status changes, loading, expandable metadata. 150-220ms ease-out from E1 tokens. No bouncing, no glowing. `prefers-reduced-motion` disables non-essential motion.

Acceptance criteria:
- Zero color-only state communication (audit every status render).
- No `.spinner` usages remain in list/detail views (grep-verifiable).
- All animation durations come from tokens; reduced-motion verified.

Must-not-break focus: provider status display, loading states across all CRUD flows.

### E7: Responsive collapse + WCAG AA verification

Scope:
- Sidebar collapses at tablet/mobile widths; dense provider table transforms into stacked rows at small widths; all functionality preserved on desktop/laptop/tablet/mobile.
- Accessibility verification pass across the redesigned surface: keyboard navigation end to end, visible focus states, AA contrast in both themes, semantic controls, accessible labels, no color-only indicators (E6 makes it true; E7 proves it).
- This story is the epic's quality gate: run the brief's section 34 checklist (run app, inspect every major screen, both themes, responsive, provider CRUD, search/filter, navigation, palette; fix inconsistencies; remove duplicated styles; no placeholder UI).

Acceptance criteria:
- Screens verified at 320 / 768 / 1024 / 1440 widths with no overflow and no lost functionality.
- Automated a11y check plus manual keyboard pass recorded in the PR.
- Both themes AA on every redesigned screen.
- Section 34 checklist executed and its results written into the PR description, including anything waived and why.

Must-not-break focus: the full user-named list, verified end to end: provider creation, editing, deletion, status, agent installation, model management, API configuration, filtering, search, settings.

---

## Sequencing

1. **E1 first, alone.** E2/E3/E4/E6 consume its tokens. Announce when landed.
2. E2 and E6 can start once E1 lands (different owners, low file overlap; E6's StatusIndicator is a dependency of E3/E4 rows and headers, so land the component early even if the adoption sweep continues).
3. E4 next; E3 remains gated on the delete-cascade fix and joins when unblocked. E3's row click targets E4's route, so land E4's route skeleton early or coordinate the two owners.
4. E5 after routes stabilize.
5. E7 last, as the gate.

Coordination rules (from the lead, restated): pull before starting, keep commits scoped to your own files, never commit a teammate's in-flight work, commits stay local. The delete-cascade fix outranks E3.

## Out of scope for this epic

- Overview page redesign (brief section 16): valuable, but split to a follow-up once E1/E2 land, to keep this epic shippable. The Activity/health data infrastructure it wants does not exist yet.
- Secrets handling beyond display masking (that is roadmap Phase 1, `packages/core` work).
- Any `packages/core` or CLI change.
- New activity-event or charting infrastructure.
