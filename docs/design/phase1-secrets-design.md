# Phase 1 Secrets — Research & Design Proposal (M043)

Status: proposal for lead review — no decisions made, no code changed.
Research date: 2026-08-29 (all library/npm/registry checks performed on this date).
Scope: `productroadmap.md` Phase 1 ("Secrets") — OS-keychain-backed storage, materialization policy, redaction, threat model, phased microtasks.

---

## 0. Executive summary

- Today the same API key value exists in **at least two plaintext locations per provider**: `~/.ai-agent-config/registry.json` (the registry, default umask 644 — security-audit finding 6) and **every agent config file the provider is installed into** (materialized by adapters). Keychain-backed registry storage eliminates the first; the second is bounded by each agent's config format, not by us.
- The realistic outcome of Phase 1 is therefore **reduce + make visible**, not eliminate: a registry that never carries key material, a per-adapter "env-ref capable vs literal-only" capability table, and an honest "where do my keys live" view. This matches the roadmap's own exit criteria ("Every location that still receives a plaintext key (agent limitations) is enumerated and visible to the user").
- Library landscape (verified 2026-08-29): the original `keytar` is dead (last release 2022-02-17, upstream repo archived 2022-12-12). The maintained successor is `@github/keytar` 7.10.6 (GitHub org, pushed 2026-05-26), but it still needs native compilation with prebuilt binaries. A zero-compile alternative, `@napi-rs/keyring` 1.3.0 (Rust/napi-rs, prebuilt per-platform optional deps, updated 2026-04-30), is the strongest "clean `npm install` everywhere" candidate. Decision left to the lead (Section 1).
- The registry schema change is small and backwards-compatible: add an optional `secretRef`/`backend` pair to `provider.config` (Section 2).
- The adapter survey (Section 3, 16 adapters read) shows the picture is **worse than the roadmap assumes**: of the providers-shaped adapters, the ones that write `apiKey` literally *and* whose agents are known to honor `${ENV_VAR}` interpolation are **zero** in the sampled set. The env-ref path is real but its value depends on each agent's actual interpolation behavior, which must be verified per agent before we promise it. The literal-only path — with an honest visibility UI is the safe default.

---

## 1. Cross-platform Node keychain library survey

Requirements the library must meet:

1. macOS Keychain, Linux libsecret/gnome-keyring (KWallet), Windows Credential Manager.
2. **Clean `npm install` on all three platforms** — this is a CLI tool; `node-gyp` compile failures at install time are a first-class risk (a user who can't install the tool can't benefit from it).
3. Actively maintained as of 2026-08-29.
4. MIT/Apache license (project is MIT).

All candidates below were checked against the npm registry and GitHub on 2026-08-29 (via `npm view` metadata and GitHub API).

### 1.1 Candidates

| Candidate | Version | Last release | Maintenance status | Native compile? | License | Platform coverage |
| --- | --- | --- | --- | --- | --- | --- |
| `keytar` (atom/node-keytar) | 7.9.0 | 2022-02-17 | **Dead.** Repo `atom/node-keytar` archived 2022-12-12; 67 open issues, last push 2022-12-12. | Yes — C++ (node-addon-api), prebuilt binaries via legacy `prebuild`/`prebuild-install` with node-gyp fallback. Known gaps: no musl (Alpine) prebuilds (issue #302); missing prebuilds for newer Node ABIs (issue #317 pattern). | MIT | darwin/linux/win32 |
| `@github/keytar` | 7.10.6 | 2026-08-07 (npm publish) | **Actively maintained.** Repo `github/node-keytar` (GitHub org), last push 2026-05-26, only 1 open issue, 17 stars (fresh fork of the archived repo). | Yes — same C++/node-addon-api codebase; `install` script is `node script/install.js | | npm run build` (prebuild download, node-gyp fallback). Prebuilt binaries for "actively supported Node and Electron versions" per README. | MIT | darwin/linux/win32 |
| `@napi-rs/keyring` | 1.3.0 | 2026-04-30 | **Actively maintained.** 15 versions since 2023-02-25; Rust crate `keyring-rs` (hwchen/keyring-rs) + napi-rs bindings; no compile at install. | **No** — pure napi-rs prebuilt binaries shipped as per-platform optionalDependencies (`@napi-rs/keyring-darwin-arm64`, `-darwin-x64`, `-linux-x64-gnu`, `-linux-x64-musl`, `-linux-arm64-gnu/musl`, `-linux-arm-gnueabihf`, `-linux-riscv64-gnu`, `-freebsd-x64`, `-win32-x64-msvc`, `-win32-ia32-msvc`, `-win32-arm64-msvc`). ~35 kB base package + platform binary. | MIT | darwin/linux (gnu+musl)/win32/freebsd |
| `keychain` (drudge/node-keychain) | 1.5.0 | 2023-06-07 | Low activity (two releases in 2023, none since). | No (spawns `security` CLI). | MIT | **macOS only** — disqualified. |
| `keyring` (mmarcon/node-keyring) | 1.1.0 | 2022-06-19 | Dead (last publish 2022). | No (spawns `secret-tool`). | MIT | Linux only — disqualified. |
| `credstore` | 1.1.29 | 2026-08-03 | Active but **not a fit**: dependency list (Capacitor plugins, bluetooth, QR, `@electron/get`) shows it's a mobile/desktop credential-manager app, not a library; license **AGPL-3.0-or-later** — incompatible with MIT project. | n/a | AGPL-3.0-or-later | n/a — disqualified |
| `@neotales/win-cred` / `@neotales/linux-libsecret` | 0.0.0 | 2026-08-28 | Brand-new (yesterday at research time), version 0.0.0, no track record. | Unknown (too new to assess). | MIT | One platform each (Win / Linux) — no macOS. |
| `openclaw-keychain-resolver` | 1.2.0 | 2026-06-01 | Niche (OpenClaw-specific resolver). | No — it **wraps `keytar` ^7.9.0**, so it inherits all of keytar's install risk. | MIT | via keytar |

Also surveyed and rejected: `@vscode/vsce` (ships keytar internally, VSCE-specific), `tauri-plugin-keychain` (Tauri-only), `react-native-keychain` (React Native-only), `@executor-js/plugin-keychain` (executor-plugin architecture, not a general library).

### 1.2 The real decision: `@github/keytar` vs `@napi-rs/keyring`

Both are maintained, MIT, and cover all three OSes. The differences that matter for a CLI:

**Install reliability (the CLI's make-or-break).**

- `@github/keytar`: C++ addon. Prebuilt binaries exist, but the fallback is `node-gyp rebuild`, which requires a working C++ toolchain + Python on the user's machine. Known historical failure modes: missing prebuilds for newer Node ABIs (the upstream repo's issue #317 documents exactly this class of breakage when Node releases a new ABI before prebuilds are cut), no musl/Alpine prebuilds (#302), and pnpm symlink resolution issues (pnpm#9623). For a tool whose Phase 4 goal is "one-line installer, verified provider in under five minutes," a compile failure on a fresh machine is a trust-killer (productroadmap.md line 172: "Shipping a one-line installer for a tool with a known silent-failure bug and plaintext keys would spend trust we cannot buy back").
- `@napi-rs/keyring`: Rust addon built once per platform, published as ordinary optionalDependencies; no toolchain needed on the user's machine, works on Alpine/musl, works under pnpm's isolated layout. Install is effectively guaranteed on any platform the project targets.

**Maturity and API surface.**

- `@github/keytar`: the de-facto standard in the Node ecosystem (used by VS Code extensions, many CLIs); 7.x API (`findPassword`, `setPassword`, `deletePassword`, `findCredentials`) is battle-tested. The fork is young as a fork but the codebase has ~10 years of history.
- `@napi-rs/keyring`: younger project (2023), smaller install base, API modeled on the same concepts (Entry/appName/serviceName/password). Fewer battle scars documented.

**APIs are swappable by design.** Both expose the same conceptual operations (get/set/delete by service+account). The recommendation is to **hide whichever is chosen behind a small internal `SecretStore` interface in `packages/core`** (e.g. `get(service, account): Promise<string | null>`, `set`, `delete`, `available(): Promise<boolean>`), so the library can be swapped without touching registry logic or adapters. The interface also gives us a clean seam for the fallback (Section 2.4) and for tests (in-memory fake store).

**Recommendation framing (not a decision):** `@napi-rs/keyring` if install reliability is the top priority (the author's read: it is, for a CLI); `@github/keytar` if ecosystem familiarity/maturity is weighted higher and we accept a compile-fallback risk that must be tested in CI on all target Node versions. Either way: behind an interface, optional at runtime (Section 2.4).

**Windows note (both libraries):** keytar/keyring on Windows use Credential Manager (DPAPI-backed, per-user). This is equivalent to the macOS Keychain for our purposes — a user-scoped store that requires the user to be logged in. It is *not* equivalent on one point: Credential Manager entries do not always prompt on access (they inherit the DPAPI session key), which is slightly weaker than macOS Keychain's "always-available-in-session" model. No action needed for Phase 1; noted for the threat model (Section 6).

---

## 2. Registry schema proposal

### 2.1 Current state (verified)

`packages/core/src/registry.ts`:

- `RegistryProvider.provider.config.apiKey` is a plain string, stored verbatim in `~/.ai-agent-config/registry.json`.
- `getProviderConfig(entry)` (line ~195) returns `{ ...provider.config, ...entry.overrides }` — the materialization path reads the key from here and hands it to adapters.
- `importRegistry` (packages/core/src/index.ts:725) validates shape and replaces the whole registry; there is no secret-awareness anywhere in the import path.
- Security-audit finding 6: the file is written with default umask (644) — world-readable on multi-user machines.

### 2.2 Proposed shape

Add two **optional** fields to `provider.config` (the same bag materialization reads). No new top-level structure, so existing registries keep working untouched:

```jsonc
// registry.json — provider entry after migration
{
  "provider": {
    "id": "openai-main",
    "name": "OpenAI",
    "type": "openai-chat-completions",
    "enabled": true,
    "priority": 1,
    "config": {
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": null,                          // removed after migration
      "secretRef": "aionrs/provider/openai-main",  // keychain service/account
      "backend": "keychain"                    // "keychain" | "plaintext"
    }
  },
  "agentIds": ["claude-code", "codex"],
  "overrides": {}
}
```

Design rules:

1. **`secretRef` is a stable, human-readable identifier**, not a UUID. Format: `<app>/<scope>/<providerId>` (e.g. `aionrs/provider/openai-main`). It is safe to commit to git — it names the key, not the key.
2. **`backend` is explicit** (`"keychain" | "plaintext"`), not inferred. A registry imported from a teammate carries `secretRef` + `backend: "keychain"` and the importer knows exactly what to do: prompt for the real key (or accept "I don't have this key" → entry stays disabled), and store it locally. Never silently fall back to a placeholder.
3. **Coexistence during migration:** an entry may temporarily have both `apiKey` and `secretRef`. Resolution order in `getProviderConfig`: if `backend === "keychain" && secretRef` → fetch from the store and **inject the resolved value into the returned config object in memory only** (callers like `provider-test.ts` and adapters see `apiKey` exactly as today — zero changes to them); else → use `apiKey` as today. Migration (a later microtask) moves `apiKey` → keychain, deletes the plaintext field, flips `backend`.
4. **`overrides` may also carry a key** (per-agent override of `apiKey`). Same treatment: an override may be `{ apiKey: null, secretRef: "...", backend: "keychain" }`. The in-memory resolution happens after the merge, so overrides work identically.
5. **MCP server env vars** (`registry.mcpServers[].env`) can hold secrets too (e.g. `ANTHROPIC_API_KEY` for an MCP server). Phase 1 scope decision for the lead: include MCP env values in keychain migration or defer. The schema above supports it (`backend`/`secretRef` on the env value's wrapper) but the simplest Phase 1 cut is providers-only, with MCP env values redacted in the "where do my keys live" view and migrated in a later phase.

### 2.3 Interaction with `provider-test.ts` verification

`packages/core/src/provider-test.ts` builds the probe from `config.apiKey` and already masks it in the displayed curl via `maskKey()` (first 3 + last 2 chars, e.g. `sk-a3...9z`). With secret resolution happening in `getProviderConfig` (2.2 rule 3), **verification needs no changes**: it receives the resolved key, makes the live call, and masks it in output. The only addition is a failure mode: if `backend: "keychain"` but the keychain entry is missing (deleted, different machine, lock not unlocked), verification must fail with a clear message ("Key for `openai-main` is stored in the OS keychain but not found — re-enter it in the provider form") rather than a confusing 401.

### 2.4 Interaction with export/import and the fallback

- **Export:** the export (GUI Settings → Export, `SettingsView.tsx` `handleExport`) serializes `registry.json` as-is. With the new schema, an exported registry contains `secretRef` + `backend`, never the key. **Exit criterion satisfied by construction** ("A registry with secret references round-trips through git with zero credential material in the diff" — that's Phase 4, but Phase 1's "a newly added provider key never appears in plaintext in registry.json" holds from day one).
- **Import:** `importRegistry` must (a) reject or flag entries where `backend: "keychain"` and the local keychain entry is missing (per-provider prompt to supply the key, or leave disabled), and (b) continue to accept legacy plaintext entries (and offer to migrate them).
- **No-keychain fallback:** on a machine where the keychain is unavailable (headless Linux without a running secret service, CI, locked keychain), the tool must not hard-fail. Proposed policy: **refuse to *write* new keys to plaintext with a loud, explicit opt-in** (e.g. `--allow-plaintext-storage` flag / a settings toggle), and always show the fallback in the status UI ("keychain unavailable — keys are stored in plaintext in registry.json, mode: warn"). This keeps the tool functional in CI/automation while making the degradation visible, mirroring the dimmed-avatar honesty precedent (Section 4.2).

### 2.5 Keychain entry layout

- **Service:** fixed app string, e.g. `aionrs` (or the final product name once decided — productroadmap.md flags the name decision as open).
- **Account:** the `secretRef` string (unique per provider; one entry per provider, not per agent — the key is a provider credential, agents just consume it).
- **Value:** the raw key, UTF-8.
- Deleting a provider (or its last agent) should delete the keychain entry; the "where do my keys live" view shows keychain entries too, including orphans (entry exists but no registry provider references it) as a cleanup aid.

---

## 3. Per-adapter materialization capability survey

Method: read the actual adapter source under `packages/core/src/adapters/` (16 adapters, covering every shape family: OpenAI-chat-completions, Anthropic-messages, codex TOML, pi JSON, continue, opencode-style shared base, plus detect-only). The question per adapter: **does the agent's config format support an environment-variable reference (e.g. `${OPENAI_API_KEY}`) in the `apiKey` field, or only a literal?**

### 3.1 What the code shows (all verified 2026-08-29)

Every provider-writing adapter builds the materialized config with a **literal** value from `provider.config.apiKey`:

- `claude-code.ts` — writes `env: { ANTHROPIC_API_KEY: apiKey, ... }` into `~/.claude/settings.json`. The key is placed in an **env block inside the agent's own config**, not a file the agent interpolates.
- `codex.ts` — writes TOML `[model_providers.<id>] api_key = "<literal>"` into `~/.codex/config.toml`.
- `opencode-style.ts` (shared base for **opencode, mimo, kilo**) — writes `provider.<id>.api_key` or an `env` entry with the literal.
- `pi.ts` — writes `apiKey` literal into the pi config JSON.
- `continue.ts` — writes `apiKey` literal into Continue's `config.yaml`.
- `gemini.ts`, `junie.ts`, `roo-code.ts`, `windsurf.ts`, `kilo.ts`, `qwen.ts`, `kimi.ts`, `crush.ts` — `modelProviders: false` or env/other mechanisms; they do **not** materialize the key into a file at all (the agent reads `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` from the process environment or its own auth flow). These are the "env-based" family — the key never lands in a file we write, which is actually the *best* case for exposure (but it means the user must set the env var themselves, which the tool currently does not tell them).

### 3.2 Capability table (representative sample, 16 adapters)

| Agent id | Adapter file | Config format | Literal-only or env-ref-capable | Evidence |
| --- | --- | --- | --- | --- |
| claude-code | `claude-code.ts` | JSON `~/.claude/settings.json` | **Literal-only (as we write it)** — we write `env.ANTHROPIC_API_KEY` as a string; Claude Code does not `${}`-interpolate its own settings.json values | `claude-code.ts` env block construction; writes literal `apiKey` |
| codex | `codex.ts` | TOML `~/.codex/config.toml` | **Uncertain** — Codex's TOML `api_key` field is documented to accept `${ENV_VAR}` interpolation in some versions; our adapter writes a literal | `codex.ts` `api_key = "..."` TOML writer |
| opencode | `opencode-style.ts` | JSON `opencode.json` | **Uncertain** — OpenCode docs describe `${VAR}` env interpolation in `opencode.json`; our adapter writes a literal | `opencode-style.ts` shared base `api_key` writer |
| mimo | `opencode-style.ts` | JSON (via shared base) | **Uncertain** (same base) | `opencode-style.ts` `createMimoAdapter` |
| kilo | `opencode-style.ts` | JSON (via shared base) | **Uncertain** (same base) | `opencode-style.ts` `createKiloAdapter` |
| pi | `pi.ts` | JSON pi config | **Literal-only** — no documented `${}` interpolation in pi's provider config | `pi.ts` `apiKey` writer |
| continue | `continue.ts` | YAML `config.yaml` | **Literal-only (as we write it)** — Continue supports env vars in some fields but our adapter writes `apiKey` literal | `continue.ts` `apiKey` writer |
| gemini | `gemini.ts` | `modelProviders: false` | **n/a — env-based** (agent reads `GEMINI_API_KEY` from process env; we write no key) | `gemini.ts` `supports.modelProviders = false` |
| junie | `junie.ts` | `modelProviders: false` | **n/a — env-based** | `junie.ts` |
| roo-code | `roo-code.ts` | `modelProviders: false` | **n/a — env-based** (Roo reads `OPENAI_API_KEY` etc. from env) | `roo-code.ts` |
| windsurf | `windsurf.ts` | `modelProviders: false` | **n/a — env-based** | `windsurf.ts` |
| qwen | `qwen.ts` | `modelProviders: false` | **n/a — env-based** | `qwen.ts` |
| kimi | `kimi.ts` | `modelProviders: false` | **n/a — env-based** | `kimi.ts` |
| crush | `crush.ts` | `modelProviders: false` | **n/a — env-based** | `crush.ts` |
| aider | `aider.ts` | detect-only | **n/a** (no config write) | `aider.ts` detect-only |
| omp | `omp.ts` | detect-only (YAML provider store deferred) | **n/a** (no config write) | `omp.ts` note in agent-catalog.json |

### 3.3 The honest conclusion

- **Zero adapters in the sampled set are confirmed env-ref-capable today.** The "uncertain" rows (codex, opencode-style family) are agents whose *own* docs claim `${ENV_VAR}` interpolation, but **our adapters write literals and we have not verified the interpolation in a live test**. The roadmap's assumption ("write an env-var reference where the agent supports it") is plausible for 2–3 agents but is **not established by the code we have**.
- This is a **verification gap, not a blocker**: the microtask breakdown (Section 7) includes a spike to empirically confirm `${VAR}` interpolation per candidate agent before we ship the env-ref materialization path. Until then, the safe default is literal-only + visibility.
- The env-based family (gemini, roo, windsurf, qwen, kimi, crush, junie) is a separate win: the tool currently **silently relies on the user having set the env var**. Phase 1 should at least surface "this agent reads `X_API_KEY` from your shell environment — set it yourself" in the UI (a one-line change in the provider detail view), which is cheap and honest.

---

## 4. Materialization policy proposal

### 4.1 Agents that support env-var references (pending verification spike)

For an agent confirmed to interpolate `${VAR}` in its config (e.g. hypothetically opencode), the materialized config would be:

```jsonc
// opencode.json written by the tool (hypothetical, post-verification)
{
  "provider": {
    "openai-main": {
      "npm": "@ai-sdk/openai",
      "options": {
        "baseURL": "https://api.openai.com/v1",
        "apiKey": "${AIONRS_OPENAI_MAIN_API_KEY}"   // env ref, not literal
      }
    }
  }
}
```

Where the env var comes from — **this is a real decision, not an assumption**:

- **Option A: user sets it themselves.** The tool shows, in the provider detail view and the "where do my keys live" screen: "Agent `opencode` reads key from env var `AIONRS_OPENAI_MAIN_API_KEY` — add it to your shell profile." No file writes by us beyond the ref. Cleanest, but a higher bar for the user.
- **Option B: tool offers to write to shell profile** (`~/.zshrc`/`~/.bashrc` `export AIONRS_...="<key>"`). **This is a real risk in disguise**: we would be writing the *plaintext key* into a shell profile — a file many users back up, dotfile-sync, or commit. It trades "plaintext in agent config" for "plaintext in dotfiles," which is *worse* (dotfiles are more likely to be synced than agent configs). **Recommendation: do not offer Option B in Phase 1.** If the lead disagrees, it must be an explicit, per-agent, opt-in action with the risk spelled out in the UI.
- **Option C (future, out of Phase 1):** a local credential-helper process / proxy that the agent points at via `baseUrl`. Too large for Phase 1; noted so the schema doesn't close the door.

### 4.2 Agents that only accept literals (the default for now)

The "where do my keys live" view is the core honesty artifact. For each provider, it enumerates:

1. **Registry:** `~/.ai-agent-config/registry.json` — `backend: keychain` (green) or `backend: plaintext` (amber) — post-migration this is always keychain or explicitly-fallen-back.
2. **Keychain entry:** `aionrs / aionrs/provider/openai-main` — present/missing/orphan.
3. **Per-agent materialized files:** for every `agentId` in the entry, the exact file path the adapter wrote and whether it contains the literal key (e.g. `~/.claude/settings.json → env.ANTHROPIC_API_KEY = literal`), or an env ref, or "env-based (no file written; set `X_API_KEY` yourself)".
4. **MCP env values** (if in scope): any `env` entry in an MCP config that matches a known secret pattern.

This mirrors the **dimmed-avatar precedent** already in `ProvidersView.tsx` (`agentTakesModels` → `avatar-dim` for agents whose format can't store providers): agents that force a plaintext literal get an amber "plaintext" badge in the avatar stack, and the detail popover explains *why* ("OpenCode's config format only accepts a literal key string"). The user sees, at a glance, which installs are "clean" (keychain-backed, env-ref, or env-based) and which still leak a literal on disk — and rotation becomes "re-enter the key, re-materialize N files" instead of guesswork.

---

## 5. Redaction proposal

### 5.1 Where raw keys currently reach output (verified by grep, 2026-08-29)

| Location | What happens today | Risk |
| --- | --- | --- |
| `packages/core/src/provider-test.ts` `maskKey()` | **Already masks** the key in the displayed curl (`sk-a3...9z`). | Low — keep, but see format below. |
| `packages/gui/src/components/ProviderVerify.tsx` (line ~204) | Renders `probe.curl` (masked) + raw response body. Curl is masked; **response body is raw** — if the API echoes the key in an error body, it would display. | Low-medium — mask known key patterns in the body display too. |
| `packages/gui/src/components/ProviderDetailView.tsx` `ApiConfigTab` + `ProviderDetailsModal` | **Intentionally** shows the key with a reveal/hide toggle (masked by default: first 8 + last 4). This is by design (security-audit finding 7) so the user can copy the key. | By design — keep, but the copy button copies the *full* key; ensure the clipboard write is the only path to the full value. |
| `packages/cli/src/index.ts` `show-config -f json` (line ~245) | `JSON.stringify(config)` — **prints the full `config.apiKey`** to stdout. | Medium — this is an explicit user action (they asked to see their config) but stdout is easily captured (pipes, `script`, shell history of the command's output in terminals with logging). **Propose: mask by default even in JSON mode; add `--reveal-keys` flag to opt into full values.** |
| `packages/cli/src/index.ts` `provider list` (line ~543) | Table shows `id/name/type/enabled/priority` only — **no key**. | Clean — no change. |
| `packages/gui/src/components/SettingsView.tsx` `handleExport` (line ~56) | Exports the full registry JSON (including `apiKey`) as a download. **Post-migration this becomes safe by construction** (registry carries refs, not keys). Pre-migration it's a plaintext key export. | Medium pre-migration; solved by Section 2. |
| `packages/cli/src/gui-server.ts` | Returns full registry state over HTTP (localhost + per-session token). Security-audit finding 7: by design. Post-migration, responses carry refs, not keys. | Solved by Section 2. |
| GUI `api.ts` / store | The React store holds the full registry in memory (needed for the reveal toggle). In-memory only; never persisted by the GUI. | Low — in-memory is acceptable for a local dashboard. |

### 5.2 Proposed masking format

Standardize on **first 3 + last 4** (longer than today's `sk-a3...9z`, shorter than the GUI's 8+4, enough to identify which key it is): `sk-a...ab12`. For keys shorter than 8 chars: `••••••••`. One helper in `packages/core` (`maskSecret(value): string`), used by CLI, GUI, and provider-test alike — today the CLI and GUI each have their own masking logic, which is a drift risk.

### 5.3 Reveal affordance

- **GUI:** keep the existing Eye/EyeOff toggle (already good UX). Add: revealing is a deliberate click, auto-hides after 30s (optional, lead's call), and the copy button copies the full key only (never the masked form).
- **CLI:** `--reveal-keys` flag on `show-config`; without it, JSON output shows `"apiKey": "sk-a...ab12"`. No interactive "press y" prompt in JSON mode (would break piping); the flag is the explicit opt-in.
- **Verification output:** curl always masked (already is); add the same `maskSecret` to the raw response body display in `ProviderVerify.tsx` (replace any occurrence of the real key string with the masked form before rendering).

---

## 6. Threat model

**Assets:** the API keys (provider credentials), the registry file, the GUI server session.

**Trusted:** the local logged-in user, the Node process, the OS keychain/credential manager.
**Untrusted:** other local users on a multi-user machine; malware running as the same user (we do not defend against this — if an attacker has code execution as the user, they can call the keychain too); network observers (the GUI server is localhost-only + token).

**Threats and what changes:**

1. **Another local user reads `registry.json`.**
   - *Today:* possible — file is 644 (security-audit finding 6). All keys leak.
   - *After keychain:* the registry carries only `secretRef` (harmless). The keychain entry is per-user and encrypted; other users cannot read it without the user's keychain unlock. **Blast radius: eliminated** (plus a 1-line `chmod 600` on the registry as belt-and-suspenders).

2. **The registry file is stolen/backed-up/dotfile-synced (laptop lost, Time Machine volume read, `~` synced to a cloud drive).**
   - *Today:* all keys leak in the backup.
   - *After keychain:* the backup carries refs only. The keys stay on the original machine's keychain (macOS Keychain is covered by FileVault disk encryption; a stolen *encrypted* backup without the user's login can't read the keychain). **Blast radius: reduced to "attacker also has the user's OS login."**

3. **The GUI server is probed.**
   - The per-session token protects against *other processes on the machine* and *network access to the port* (localhost binding + random token per launch). It does **not** protect against a user who has the token (by design — that's the dashboard user). *After keychain:* even a token-holder sees refs in the registry response; the full key is only fetched server-side for verification probes and the explicit reveal action (which the GUI already gates on a click). **Blast radius: reduced** — a leaked token no longer leaks keys directly from a registry GET.

4. **Agent config files on disk (the one keychain can't fix).**
   - *Today and after:* every literal-materializing agent still has the plaintext key in its own config file (`~/.claude/settings.json`, `~/.codex/config.toml`, etc.). These files are in the user's home dir (600/644 depending on the agent's own defaults). **Keychain-backing does not change this blast radius** — that's the "reduce + make visible" ceiling. The "where do my keys live" view (Section 4.2) is the mitigation: the user can see every file and rotate deliberately.

5. **Compromised machine (malware as the same user).**
   - *Today:* reads `registry.json` → all keys.
   - *After keychain:* reads the keychain (possible, same user) → all keys. **No change.** Keychain-backing is not a defense against same-user code execution; it is a defense against *file-level* exposure (other users, backups, sync, file reads). The threat model must state this plainly so we don't oversell it.

6. **Key rotation.**
   - *Today:* user must find every file by hand.
   - *After keychain:* re-enter the key once (keychain entry updated), re-materialize N agent files. The "where do my keys live" view makes this a checklist, not a guess.

**Standing rule reaffirmed (productroadmap.md line 157):** no release widens plaintext credential exposure. The fallback mode (2.4) must be *explicit and visible*, never silent.

---

## 7. Phased implementation proposal (microtasks)

Style: matches existing `tasks/pi-tasks/*.md` (Identity / Why / Target state / Read first / Allowed scope / Verification). Each is independently shippable. **None of these are implemented by M043.**

### Phase 1a — Foundation (no behavior change to users yet)

- **M044 — Add `SecretStore` interface + in-memory fake** (`packages/core/src/secrets.ts`). Define `get/set/delete/available` + a `MemorySecretStore` for tests. No keychain dependency yet. *Scope: 1 new file + types.*
- **M045 — Registry schema: add `secretRef`/`backend` fields** (optional, `registry.ts` types + `getProviderConfig` resolution order per Section 2.2 rule 3). Legacy entries behave exactly as today. *Scope: `registry.ts` + types + unit tests.*
- **M046 — Standardize `maskSecret()` in core** (first 3 + last 4); use it in `provider-test.ts`, CLI `show-config`, GUI `ProviderVerify.tsx`. *Scope: 3–4 files, pure refactor of existing masking.*

### Phase 1b — Keychain integration

- **M047 — Spike: empirically verify `${ENV_VAR}` interpolation** in codex + opencode (the "uncertain" rows in Section 3.2). Deliverable: a short note in this doc's follow-up section or a new `docs/design/` note with pass/fail per agent. *Scope: no code, manual testing + doc.*
- **M048 — Wire `@napi-rs/keyring` (or `@github/keytar` — lead's call) behind `SecretStore`** as `KeychainSecretStore`, with `available()` detection and graceful fallback per Section 2.4. *Scope: `secrets.ts`, `packages/core` index, dependency add (the one dependency Phase 1 is allowed).*
- **M049 — Migration: move `apiKey` → keychain on first write** (flip `backend`, delete plaintext field, `chmod 600` the registry). Idempotent, reversible via re-import. *Scope: `registry.ts` save path + CLI/GUI settings screen "migrate keys to keychain" button.*
- **M050 — Import/export secret-awareness** (Section 2.4): import prompts for missing keychain entries; export is safe by construction (verify with a test that an exported registry contains no `apiKey` value). *Scope: `importRegistry` + `SettingsView.tsx` + tests.*

### Phase 1c — Visibility & redaction (the "make it visible" half)

- **M051 — "Where do my keys live" view** (Section 4.2): per-provider, per-agent table of registry backend, keychain entry presence, and materialized file paths with literal/env-ref/env-based classification. New GUI component + a `manager` method that computes the map from adapters' `getConfigPath()`. *Scope: 1 new GUI component + 1 core method + tests.*
- **M052 — CLI redaction:** `show-config -f json` masks by default, `--reveal-keys` opts in (Section 5.3). *Scope: `cli/src/index.ts`.*
- **M053 — Verification output redaction:** mask the key pattern in `ProviderVerify.tsx` raw response body display. *Scope: 1 file.*
- **M054 — Env-based agent notice:** for `modelProviders: false` agents, show "reads `X_API_KEY` from your shell environment" in the provider detail view (Section 3.3). *Scope: `ProviderDetailView.tsx` + a per-agent `envVarHint` field in the catalog (or adapter).*

### Phase 1d — Env-ref materialization (only if M047 spike passes)

- **M055 — Per-agent env-ref materialization policy** (Section 4.1): for verified env-ref-capable agents, write `${AIONRS_<PROVIDER>_API_KEY}` instead of the literal; show the env var the user must set. **Option B (shell-profile writing) is explicitly out of scope** unless the lead reverses the recommendation in Section 4.1. *Scope: affected adapters + "where do my keys live" integration.*

### Exit-criteria mapping (productroadmap.md Phase 1)

| Exit criterion | Satisfied by |
| --- | --- |
| A newly added provider key never appears in plaintext in `registry.json` | M045 + M048 + M049 |
| Every location that still receives a plaintext key is enumerated and visible | M051 (+ M054 for env-based) |
| Verification output shows no unredacted key by default | M046 + M053 |
| Documented threat model for the registry and the GUI server, kept in the repo | This doc, Section 6 (promoted to a standalone `docs/design/threat-model.md` at the lead's discretion) |

**Suggested sequencing:** 1a → 1b (M047 spike early, it gates 1d) → 1c can run in parallel with 1b → 1d last and optional. 1c is shippable *before* keychain integration lands and already improves honesty/redaction — a useful early win.

---

## Appendix A — Evidence index

- Library/npm checks (2026-08-29): `npm view keytar` (7.9.0, 2022-02-17), `npm view @github/keytar` (7.10.6, 2026-08-07), GitHub API `github/node-keytar` (pushed 2026-05-26, 1 open issue), `atom/node-keytar` (archived 2022-12-12, 67 open issues), `npm view @napi-rs/keyring` (1.3.0, 2026-04-30, 13 platform optionalDeps), `npm view keychain` (1.5.0, macOS-only), `npm view credstore` (1.1.29, AGPL, Capacitor deps).
- Adapter code: `packages/core/src/adapters/{claude-code,codex,opencode-style,pi,continue,gemini,junie,roo-code,windsurf,qwen,kimi,crush,aider,omp,kilo}.ts`.
- Key-exposure greps: `packages/cli/src/index.ts:245` (show-config JSON), `:543` (provider list table), `packages/gui/src/components/SettingsView.tsx:56` (export), `packages/gui/src/components/ProviderVerify.tsx:204` (curl+body), `packages/gui/src/components/ProviderDetailView.tsx` (reveal toggle), `packages/core/src/provider-test.ts` (`maskKey`).
- Prior findings: `docs/audits/security-audit-adapter-io.md` findings 6 (644 umask) and 7 (GUI key display by design); `productroadmap.md` Phase 1 (lines 94–117), line 157 (standing rule), line 172 (distribution timing).
