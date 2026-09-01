# Phase 4 Plan — UX Polish & Feature Enhancement

**Objective:** Improve user experience with model selection, API verification, and dark mode support.

**Estimated Duration:** 60–90 minutes  
**Parallel Tasks:** 4 agents (P4-T1 through P4-T4)

---

## Why Phase 4 (Rationale)

**Phase 1 (Secrets)** — ✅ Delivered keychain wiring, key redaction, threat model  
**Phase 2 (Drift & Permissions)** — ✅ Delivered drift detection, permissions audit, theme, logo  
**Phase 3 (Performance)** — ✅ Delivered performance optimization, QA pass, claims verification

**Next layer:** The product is feature-complete and now needs UX polish for common workflows:
- Users with large model lists (42+ models) need better selection UI
- API verification needs to show which capabilities are available
- Dark mode contrast issues with image containers need fixing

---

## Phase 4 Deliverables (4 Parallel Tasks)

### P4-T1: Model Selection UI (Parallel)

**Goal:** Create interactive model selector with search, bulk actions, and free model filtering.

**Scope:**
- Build `<ModelSelector>` component with checkboxes for each model
- Add search/filter input (real-time filtering by model name)
- Implement "Select All" button (check all visible models)
- Implement "Deselect All" button (uncheck all)
- Add "Select Free Models" button (auto-select models containing "free" case-insensitive)
- Integrate into provider add/edit flow
- Test with large model lists (42+ models)

**Deliverables:**
- New ModelSelector component
- Integration into ProvidersView add/edit provider modal
- Unit tests for selection logic and filtering

**Success Criteria:**
- Component renders correctly with 40+ models
- Search filters models in real-time
- Bulk actions work correctly
- Free model detection matches /free/i regex
- All existing tests still pass

---

### P4-T2: API Verification Checkmarks (Parallel)

**Goal:** Show explicit availability status for each API type (Chat Completions, Responses, Anthropic).

**Scope:**
- Modify provider verification display to show per-API-type status
- Show checkmarks (✓) for available APIs
- Show X marks (✗) for unavailable APIs
- Update ProviderVerificationResult type to include per-API availability
- Test with multiple provider types (OpenAI, Anthropic, custom endpoints)

**Deliverables:**
- Updated verification display component
- Per-API availability tracking
- Visual checkmark/X indicator

**Success Criteria:**
- Checkmarks show correctly for available APIs
- X marks show for unavailable APIs
- Display updates based on provider verification results
- Works across all provider types

---

### P4-T3: Dark Mode Container Contrast (Parallel)

**Goal:** Fix image/icon container backgrounds to have better contrast in dark mode.

**Scope:**
- Identify all containers with provider icons/logos
- Add theme-aware background colors
- Light mode: darker/neutral backgrounds
- Dark mode: light gray/white backgrounds
- Apply to providers table, provider cards, and logo areas
- Verify WCAG AA contrast ratios

**Deliverables:**
- Updated CSS for image containers
- Theme-aware background variables
- Contrast verification report

**Success Criteria:**
- All image containers have appropriate contrast in both themes
- WCAG AA contrast ratios maintained (4.5:1 minimum)
- No visual regressions in other areas
- All existing tests still pass

---

### P4-T4: Icon Deep Imports Optimization (Parallel)

**Goal:** Reduce bundle size by using deep imports from lucide-react.

**Scope:**
- Replace `import { IconName } from 'lucide-react'` with `import IconName from 'lucide-react/icons/icon-name'`
- Find all lucide icon imports across GUI package
- Update to deep import format
- Verify bundle size reduction (~8 KB gzipped expected)
- Run Lighthouse to confirm no performance regression

**Deliverables:**
- Updated icon imports across entire GUI
- Bundle size comparison (before/after)
- Lighthouse performance profile

**Success Criteria:**
- Bundle gzipped size reduced by ~6-8 KB
- No import errors
- All icons render correctly
- Lighthouse scores maintained or improved

---

## Execution Plan

### Parallel Spawn (T1–T4 concurrent)

```bash
# Pseudo-code (real: use Agent tool with 4 concurrent subagents)
agent1 = spawn("P4-T1: Model selection UI with search and bulk actions")
agent2 = spawn("P4-T2: API verification checkmarks for each provider type")
agent3 = spawn("P4-T3: Dark mode container contrast fix")
agent4 = spawn("P4-T4: Icon deep imports optimization")

wait_for_all([agent1, agent2, agent3, agent4])
```

### Integration (After all 4 report)

1. Collect results from all agents
2. Verify no conflicts between changes (they affect different areas)
3. Run `pnpm build && pnpm test` final verification
4. Commit: `P4-T1` (model UI), `P4-T2` (API checkmarks), `P4-T3` (contrast), `P4-T4` (icons)
5. Update PHASE4-COMPLETION.md with results

---

## Success Metrics (Phase 4 Exit)

| Metric | Target | Status |
|--------|--------|--------|
| Model selector UI | Fully functional | TBD |
| API verification checkmarks | Visible for all APIs | TBD |
| Dark mode contrast | WCAG AA compliant | TBD |
| Bundle size reduction | -6 to -8 KB gzipped | TBD |
| Build & tests | Green | TBD |

---

## Known Edge Cases to Handle

1. **Large model lists** — ModelSelector should handle 40+ models smoothly (pagination or virtualization if needed)
2. **Free model detection** — Case-insensitive match on "free" substring
3. **Theme switching** — Dark mode changes should apply to containers immediately
4. **Icon fallbacks** — If a deep import doesn't exist, catch and fall back gracefully

---

## Next Checkpoint

When all 4 agents report:
- P4-T1: Model selector component + integration
- P4-T2: API verification checkmarks
- P4-T3: Dark mode contrast fixes
- P4-T4: Icon optimization results

Integrate findings, commit, and declare **Phase 4 Complete**.

---

**Ready to spawn Phase 4 agents? Y/N**
