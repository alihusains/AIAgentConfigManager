# E3 Verification — Providers Page Redesign

**Date:** 2026-08-30
**Verified against:** `docs/epics/agentic-control-plane-redesign.md` §E3
**Implementation:** `packages/gui/src/components/ProvidersView.tsx` (1344 lines)

## Requirement-by-Requirement Findings

### 1. Pill/badge usage reduced ~70–80% — **PARTIAL**

**Evidence:**

- The "Installed On" column — the old chip wall (one pill per agent with x-buttons) — is fully
  replaced by `AgentAvatarStack` (line 58–135): overlapping avatar circles capped at 4 + a "+N"
  count, hover/focus reveals the full removable list. The code comment explicitly cites E3
  ("E3: pills → avatars").
- Row metadata (APIs, models) is now plain text (`"OpenAI Compatible · 3 APIs · 4 models"` style
  text cells, lines 318–350), not pills.
- **Remaining pills on the page (census, `className="badge"` in ProvidersView.tsx):**
  - Line 287: `keychain` lock badge (allowed — "important capability indicator" per brief)
  - Line 300: provider type badge (allowed — "compact categorical state" per brief)
  - Lines 836/838: inside `AddProviderModal` (model-support indicators)
  - Lines 1165/1259: inside the legacy `ProviderDetailsModal` (type badge, model-name chips)
- The legacy `ProviderDetailsModal` (still rendered from the row's Eye icon) retains a model-name
  chip wall (line 1259). E4's `ProviderDetailView` (route-addressable, `App.tsx:159`) is the
  intended replacement; the modal is the residual surface.

**Verdict:** The main table — where the chip wall lived — is clean. Residual pills are all in
categories the brief explicitly allows (status, categorical, capability), except the modal's model
chips. No before/after pill census was recorded in a PR (acceptance criterion unmet).

### 2. Agent avatar groups instead of chip walls — **PASS**

**Evidence:** `AgentAvatarStack` (line 58): overlapping 24px circles, `AVATAR_STACK_MAX = 4`
- "+N" (line 47), hover popover with per-agent remove buttons (lines 104–131), dimmed state for
agents whose config format cannot store providers (lines 61–64, 88). CSS: `.avatar-stack` /
`.avatar` in `index.css` (line 2846+). This is exactly the briefed `[MM] [Pi] [+2]` pattern.

### 3. Provider row hierarchy (primary / secondary / tertiary) — **PASS**

**Evidence:**

- **Primary identity:** provider name (`.provider-name`, line 284) + type icon tile.
- **Secondary metadata:** provider ID in mono (`font-mono text-xs text-tertiary`, line 295),
  type badge, compact text labels for APIs/models.
- **Tertiary actions:** `.row-actions` hidden by default, revealed on row hover/focus
  (`index.css:2833` — `opacity: 0` → `1` on `tr:hover` / `tr:focus-within`). Keyboard reachable
  via `:focus-within`.

### 4. HARD: Row state follows the mutation response (no false success toasts) — **PASS**

**Evidence:**

- All provider mutations route through the store's `run()` helper (`store/index.ts:116–135`):
  toasts success **only** when `result.ok === true`, toasts the backend's error string otherwise,
  and refreshes server state only after a confirmed response. No optimistic state anywhere —
  `deleteProvider` (store line 221) is `confirm → api call → run()`.
- The false-success bug class (warnings-without-error returning HTTP 200) was fixed server-side
  in M068 (`9303f5c` regression suite: `packages/cli/src/gui-server-delete.test.ts`).
- **Newly added GUI regression tests** (`smoke.test.tsx`, ProvidersView describe block):
  - `E3: a failed delete shows an error, never a success toast` — asserts `Operation Failed` +
    the backend error string render and `Provider Deleted` does NOT.
  - `E3: a confirmed delete refreshes and toasts success exactly once` — asserts a single success
    toast and no error toast.
  Both pass (verified via `pnpm --filter @ai-agent-config/gui test`).

## Secondary scope items (for completeness)

| Item | Status | Evidence |
| ------ | -------- | ---------- |
| Page header + `+ Add Provider` primary button | ✅ | lines 226–241 |
| Contextual toolbar (search/filter/sort) | ❌ | No search/filter/sort controls in the table (grep-verified). The only "filter" is the modal's free-models toggle. |
| `…` single context menu replacing 3 permanent icon buttons | ❌ | Row still renders three distinct icon buttons (Lock/Eye/Edit/Trash2, lines 371–415), though they are hover-revealed |
| Proper confirm dialog (no `window.confirm`) | ❌ | `handleDelete` uses `confirm(...)` (line 208). This is a known app-wide pattern (7 views use it), not E3-specific |
| Row click opens provider detail (E4) | ⚠️ | E4's `ProviderDetailView` route exists (`App.tsx:159`) and is tested, but the row's Eye icon opens the legacy `ProviderDetailsModal`, not the E4 route |
| Empty state / skeleton loading | ✅ (empty) / ❌ (skeleton) | Empty state present (lines 243–255); no skeleton in the providers table |

## Overall Verdict: **E3 INCOMPLETE (core redesign landed; secondary items missing)**

**What landed (the load-bearing parts):** avatar groups, row hierarchy, hover-revealed actions,
mutation-response-driven state (hard requirement — now regression-tested), empty state, and the
pill census on the main table.

**What's missing (secondary scope):**

1. Contextual toolbar: search / filter / sort on the providers table.
2. `…` context menu (currently 3–4 separate hover icon buttons).
3. Custom confirm dialog (currently `window.confirm`).
4. Row click → E4 route (currently opens legacy modal).
5. Skeleton loading state for the table.
6. Pill census before/after recorded in a PR (acceptance criterion).

**Items fixed this verification pass:** none needed in `ProvidersView.tsx` — the hard
requirement was already satisfied; two GUI regression tests were added to lock it in.

**Test note:** 3 `SkillsView` M073 tests are failing in the shared tree from a concurrent
workstream (not E3-related); all ProvidersView tests pass.
