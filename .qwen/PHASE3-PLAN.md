# Phase 3 Plan — Performance & Polish

**Objective:** Optimize for production readiness — measurable performance improvements, full QA pass, verified claims.

**Estimated Duration:** 90–120 minutes  
**Parallel Tasks:** 4 agents (P3-T1 through P3-T4)

---

## Why Phase 3 (Rationale)

**Phase 1 (Secrets)** — ✅ Delivered keychain wiring, key redaction, threat model  
**Phase 2 (Drift & Permissions)** — ✅ Delivered drift detection, permissions audit, theme, logo  

**Next layer:** The product is feature-complete but needs performance measurement and polish:
- No performance metrics exist (startup time, detection cost, memory, bundle health)
- Full end-to-end QA never ran (every view, every interaction)
- Claims in README/roadmap haven't been re-verified against current code
- Known gaps: `Activity` tab backing data, edge cases in various views

---

## Phase 3 Deliverables (4 Parallel Tasks)

### P3-T1: CLI & Core Performance Audit (Parallel)

**Goal:** Measure and optimize startup time, adapter detection cost, materialization speed.

**Scope:**
- Measure CLI startup: `node packages/cli/dist/index.js health` timing (target: < 500ms)
- Measure adapter detection: sequential vs parallel across 24 adapters (target: < 2s)
- Profile `gui-server.ts` memory usage under load (cache bloat?)
- Check for eager imports blocking startup (e.g., heavy deps loaded at module level)
- Identify bottlenecks and optimize top 3 (parallelization, lazy loading, caching)

**Deliverables:**
- Performance baseline report (before/after timings)
- Optimizations applied (with justification)
- New performance unit tests (ensure regressions don't happen)

**Success Criteria:**
- Startup time measured and < 1s target
- Adapter detection parallelized (if beneficial)
- Memory profile stable under sustained load
- All existing tests still pass

---

### P3-T2: GUI Performance & Bundle Audit (Parallel)

**Goal:** Ensure GUI remains lightweight, responsive, and scalable.

**Scope:**
- Verify bundle size components (current: 103.47 KB JS + 10.14 KB CSS)
- Check for dead code or unused dependencies
- Measure React component render performance (memoization, unnecessary re-renders)
- Validate CSS-in-JS efficiency (token injection doesn't bloat at runtime)
- Profiling: lighthouse + devtools performance trace

**Deliverables:**
- Bundle size breakdown (JS/CSS/assets per component)
- Dead code or redundant imports flagged
- React performance audit (re-render counts, profiling)
- Recommendations for future optimizations (without breaking functionality)

**Success Criteria:**
- Bundle size stays ≤ 110 KB gzipped JS
- No unused dependencies detected
- No obvious performance regressions (React DevTools profiler clean)
- Report includes action items for Phase 4

---

### P3-T3: End-to-End QA Pass (Parallel)

**Goal:** Click through every view, every interaction; document any broken states or edge cases.

**Scope:**
- Start dashboard, verify all navigation paths
- Test each view (Overview, Agents, Providers, MCP, Skills, Tools, Environment, Permissions, Settings)
- Exercise all interactions: add/edit/delete providers, install agents, toggle theme, search
- Edge cases: empty states, error states, long lists, special characters in names
- Responsive design: 320px (mobile), 768px (tablet), 1920px (desktop)
- Keyboard navigation: Tab/Shift+Tab, Enter, Escape, ⌘K
- Accessibility: screen reader compatibility (spot check), focus indicators, contrast

**Deliverables:**
- QA report with findings (bugs, UX issues, edge case gaps)
- Severity levels (Critical/High/Medium/Low)
- Recommendations for fixes

**Success Criteria:**
- All critical issues fixed before Phase 3 complete
- High/Medium issues logged for Phase 4
- Full QA report with evidence (screenshots/logs where applicable)

---

### P3-T4: Claims Verification & Documentation (Parallel)

**Goal:** Re-verify every claim in README.md and productroadmap.md against current code; update docs as needed.

**Scope:**
- README claims: 24 adapters, provider registry, MCP curation, live verification, UI themes, CLI tools tab
- Roadmap claims: Phase 1 (✅), Phase 2 (✅), Phase 3 exit criteria
- CHECKPOINT.md claims: build green, test counts, bundle size
- Count actual adapters (`packages/core/src/adapters/`)
- Verify exit criteria are truly met
- Update `docs/IMPLEMENTATION.md` if it exists (or create it as a dev guide for future maintainers)

**Deliverables:**
- Claims audit spreadsheet (claim → verified / needs update / false)
- README.md and productroadmap.md refreshed
- CHECKPOINT.md updated with Phase 2 final state
- New `docs/IMPLEMENTATION.md` (architecture tour for next dev)

**Success Criteria:**
- All claims traceable to code or commit
- No fabricated numbers or "estimated" claims
- Documentation matches reality
- New devs can onboard from IMPLEMENTATION.md alone

---

## Execution Plan

### Parallel Spawn (T1–T4 concurrent)

```bash
# Pseudo-code (real: use Agent tool with 4 concurrent subagents)
agent1 = spawn("P3-T1: CLI performance audit")
agent2 = spawn("P3-T2: GUI bundle & React performance audit")
agent3 = spawn("P3-T3: End-to-end QA pass")
agent4 = spawn("P3-T4: Claims verification & documentation")

wait_for_all([agent1, agent2, agent3, agent4])
```

### Integration (After all 4 report)

1. Prioritize critical QA findings (P3-T3) → fix immediately
2. Apply performance optimizations (P3-T1, P3-T2) → test green
3. Commit: `P3-T1` (perf), `P3-T2` (bundle), `P3-T3` (QA fixes), `P3-T4` (docs)
4. Final `pnpm build && pnpm test` verification
5. Update PHASE3-COMPLETION.md with results

---

## Success Metrics (Phase 3 Exit)

| Metric | Target | Status |
|--------|--------|--------|
| CLI startup time | < 1s | TBD |
| Adapter detection | < 2s | TBD |
| Bundle (gzipped) | ≤ 110 KB | ✅ 103.47 KB (P2) |
| QA Critical bugs | 0 | TBD |
| QA High/Medium | Logged for Phase 4 | TBD |
| Claims verified | 100% traceable | TBD |
| Build & tests | Green | TBD |

---

## Known Issues to Address in QA (P3-T3)

From CHECKPOINT.md:

1. **Activity tab backing** — verify if it has real data or shows honest empty state
2. **Model-rename edge case** — opencode-style.ts line ~348 (intentionally not changed; needs careful review)
3. **Edge cases in various views** — long lists, special characters, empty states

---

## If Time Permits (Phase 3+)

- Presets & templates (common MCP/skill stacks)
- Registry export/import polish (git-friendly format)
- Team sharing preparation (registry format audit)

---

## Next Checkpoint

When all 4 agents report:
- P3-T1: Performance baseline + optimizations
- P3-T2: Bundle audit + dead code report
- P3-T3: QA findings + severity matrix
- P3-T4: Verified claims doc + IMPLEMENTATION.md

Integrate findings, commit, and declare **Phase 3 Complete**.

---

**Ready to spawn Phase 3 agents? Y/N**

