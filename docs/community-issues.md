# Community Issues — Ready-to-Paste

Curated, small, well-scoped improvements anyone can pick up. Each entry is written
to be pasted verbatim into a GitHub issue. **Every MR is reviewed by the maintainer's
AI assistant** — if you'd rather describe the fix and let the tooling implement it,
say so in the issue; that workflow is supported.

Pick an issue → open it → start a PR. That's it.

---

## 1. Edit Provider: "Use all N models" quick-fill

**Type:** enhancement · **Area:** provider verification · **Effort:** small

**Problem:** In the *Add Provider* modal, after verifying a connection, the
"Use all N models" button auto-fills the model list. The *Edit Provider* modal
verifies connections too but lacks that button — models must be typed manually.

**Suggested behavior:** After a successful verification in the Edit modal, show
the same "Use all N models" affordance, writing the verified model ids into the
Edit modal's model fields.

**Where:** `packages/gui/src/components/ProvidersView.tsx` (EditProviderModal →
`ApiVerifier` usage; the `onModels` callback already exists in
`packages/gui/src/components/ProviderVerify.tsx`).

---

## 2. Copy curl command for any verified probe

**Type:** enhancement · **Area:** provider verification · **Effort:** small

**Problem:** Verification results show the curl command + raw response for each
probe (models / chat completions / responses), but it can't be copied in one click.

**Suggested behavior:** A small copy button beside each probe's "curl + raw output"
block (mirroring the copy buttons in the Provider Details modal).

**Where:** `packages/gui/src/components/ProviderVerify.tsx` (ProbeCard).

---

## 3. Anthropic-style verification (x-api-key)

**Type:** enhancement · **Area:** provider verification · **Effort:** medium

**Problem:** The verification engine probes OpenAI-style endpoints (Bearer auth).
Providers of type `anthropic` are skipped in the Add/Edit forms, so their
connectivity is never tested.

**Suggested behavior:** Extend `probeProviderAPIs` (or add a sibling function in
`packages/core/src/provider-test.ts`) to probe `/v1/messages` with the
`x-api-key` + `anthropic-version` headers Anthropic expects, reusing the same
probe-card rendering.

---

## 4. Agent compatibility hints from API verification

**Type:** enhancement · **Area:** dashboard · **Effort:** medium

**Problem:** A Responses-only provider (e.g. ChatGPT accounts) can't serve
chat-completions-style agents (opencode family), but the UI doesn't say so up front.

**Suggested behavior:** When installing a provider into agents, show per-agent
compatibility (based on its adapter family): "expects Chat Completions",
"expects Responses", "Anthropic Messages", "unknown". Data source: the adapter
family already exposed in detection info.

**Where:** `packages/gui/src/components/AgentPicker.tsx` + registry state.

---

## 5. Dashboard: keyboard shortcuts

**Type:** enhancement · **Area:** dashboard · **Effort:** small

**Problem:** Refresh and theme toggle are click-only.

**Suggested behavior:** `Cmd/Ctrl+R` refresh (already a browser default — re-map
`F5`-equivalent carefully or add `Shift+R`) and a `t` hotkey for the theme toggle,
with a tooltip listing shortcuts. Respect `e.preventDefault()` only when the
focus is not in an input/textarea.

---

## 6. Unit tests for the verification engine

**Type:** engineering · **Area:** provider verification · **Effort:** medium

**Problem:** `packages/core/src/provider-test.ts` is only exercised by smoke
tests against live services — no deterministic coverage of edge cases.

**Suggested behavior:** Vitest suite mocking `fetch` (vi.stubGlobal) covering:
200 models parse (OpenAI, LiteLLM `data`, string-array variants), 401 auth
rejection, 404 route absent, bare-host → `/v1` fallback, pasted endpoint
normalization, timeout path, and `maskKey`/`buildCurl` output.

---

## 7. Add TypeScript check to CI

**Type:** engineering · **Area:** repo tooling · **Effort:** small

**Problem:** `pnpm build` type-checks core and cli, but the GUI build (`vite
build`) doesn't fail on TS type errors unless `tsc --noEmit` runs explicitly —
which means a type error can slip through a green build.

**Suggested behavior:** GitHub Actions workflow (or a `lint` script = `tsc
--noEmit` in all three packages) that runs on push/PR and must be green before
merge.

---

## 8. Remember dashboard window state

**Type:** enhancement · **Area:** dashboard · **Effort:** small

**Problem:** Every launch re-opens the dashboard with the default view and split.

**Suggested behavior:** Persist the active view (and any collapsed/expanded
state) in `localStorage`, restored on load.

---

## 9. Export / import the registry from Settings

**Type:** enhancement · **Area:** dashboard · **Effort:** medium

**Problem:** CLI has `backup`/`restore` but the dashboard has no way to snapshot
the registry without the terminal.

**Suggested behavior:** In Settings: "Export registry (JSON)" → downloads the
current `registry.json` to the browser's download folder; "Import registry" →
uploads a file and replaces the registry (with a confirm step) via a new
`POST /api/registry/import`.

---

## 10. Show verification age on the providers table

**Type:** enhancement · **Area:** dashboard · **Effort:** small

**Problem:** The APIs column shows "Chat ✓ / Responses ✗" but not *when* it was
verified — a stale verification looks current.

**Suggested behavior:** Tooltip (title attr) with the full verification timestamp
from `apiCapabilities.verifiedAt`, plus a subtle "n days ago" suffix when older
than 30 days.

---

## 11. Install / uninstall agent CLIs from the dashboard

**Type:** feature · **Area:** dashboard · **Effort:** large · **Status: ✅ implemented (2026-08-20)**

**Problem:** Onboarding a new agent (opencode, codex, claude-code…) forces the user
to leave the dashboard, find the right install command per tool (npm? brew? curl?),
run it in a terminal, and hope detection picks it up cleanly.

**What shipped:**
- **Install / Uninstall** actions on every catalogued agent; the exact command is
  previewed, executed by the GUI server, streamed live into the UI, and detection
  re-runs automatically on completion.
- **Uninstall** is a danger zone: confirm-by-typing the agent id; config files and
  registry entries are left untouched (they re-materialize after reinstall).
- Commands come **only** from the maintained catalog allow-list
  (`packages/core/src/agent-catalog.json`) with a defensive safety gate
  (`isSafeCommand` — blocks sudo / `rm -rf /` / mkfs / dd…), a per-agent
  concurrency guard, and timeouts (10 min install / 5 min uninstall).
- Agents without a confident canned command (Junie, OMP) show a manual note instead
  of an execute button.

**Where:** `packages/core/src/agent-catalog.ts` + `agent-catalog.json`,
`packages/cli/src/gui-server.ts` (jobs), `packages/gui/src/components/AgentsView.tsx`.

---

## 12. Grow the maintained agent catalog (new & upcoming agents)

**Type:** maintenance loop · **Area:** catalog · **Effort:** small per agent

**Problem:** The dashboard can only install agents it knows about. The catalog on
disk will always lag the ecosystem (new CLIs ship monthly), and the user should be
able to say "add this agent" without engineering.

**Progress:**
- **Catalog v2 (2026-08-20)** — every entry now carries `binaries` (PATH probe
  targets), and entries without a core adapter (reasonix, freebuff) can carry
  `settingsPaths` for a config-footprint check. ✅ Catalog-only agents are now
  detected on the machine instead of being offered as "Available to Install"
  (`detectCatalogEntry` + `catalogEntryToDetected` in `agent-catalog.ts`, wired
  into `GET /api/agents/catalog`).
- Still on the backlog: the `catalog:add <id> <install-command>` CLI helper and
  full adapters for reasonix/freebuff (to make them config-writable targets).

**Current catalog (v2, 2026-08-20):** chatgpt/codex, claude-code, opencode, mimo,
kilo, pi, gemini, junie, omp, reasonix, freebuff.

**Suggested behavior:**
- Add missing agents to `packages/core/src/agent-catalog.json` (id must match the
  adapter id when an adapter exists; otherwise give the entry `binaries` — and
  `settingsPaths` if it keeps a config file — so detection still covers it).
- Prefer verified install commands (official docs / npm package page); mark
  unverified entries `status: "upcoming"` with a manual-setup note instead of a
  command.
- Consider a `catalog:add <id> <install-command>` CLI helper that edits the JSON
  with validation (command safety + id format) for quick PRs.