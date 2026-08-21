# Freebuff — Config / MCP Footprint Research

**Date:** 2026-08-20
**Task:** M007 (agent-coverage-research-batch-1)
**Method:** primary sources — the npm package `freebuff` (v0.0.153, latest tag; readme + metadata via `npm view`) and the source repository it points at, [CodebuffAI/codebuff](https://github.com/CodebuffAI/codebuff) (cloned and read directly). The `freebuff` npm package is a thin launcher around the Codebuff platform; the actual CLI source lives in `cli/src/` of that monorepo.
**Catalog entry under test:** `packages/core/src/agent-catalog.json` → `freebuff` ("No API key, account, or config file needed." — **this claim is wrong, see Q1).

---

## TL;DR

The catalog's "no config file" claim is **false**. Freebuff writes a full user config tree to `~/.config/manicode/` (settings, credentials, history, recent projects, per-project state — dir name is a Codebuff/Manicode relic), and it **does support MCP servers** via the standard `mcpServers` JSON format, read from `.agents/mcp.json` files (project and `~/.agents/mcp.json`). Model selection is user-configurable and persisted to `settings.json`.

**Finding: this is NOT a detect-only agent.** There is legitimate adapter work here, and it is unusually cheap: the MCP config uses exactly the standard `mcpServers` shape (stdio: `command`/`args`/`env`; remote: `type: 'http'|'sse'`, `url`, `headers`) that the existing generic adapter's `mcpShape: 'keyed'` already speaks, and it lives in a **separate file** — the same shape as the pi and junie adapters. The main caveats are (a) the file is project- or home-scoped (`.agents/mcp.json`), not a single global file, and (b) the user-settings file sits under an oddly-named dir (`manicode`) with a non-obvious schema.

---

## Q1 — Does Freebuff genuinely have zero on-disk config?

**No. It has a real on-disk config tree.** The CLI resolves its config directory in `cli/src/utils/config-dir.ts`:

```ts
export const getConfigDir = (): string => {
  return path.join(os.homedir(), '.config', 'manicode' + (env.NEXT_PUBLIC_CB_ENVIRONMENT !== 'prod' ? `-${...}` : ''))
}
```

So in production the user config dir is **`~/.config/manicode/`** (the "manicode" name is a leftover from the Codebuff platform's earlier identity — see `common/src/util/project-ignore.ts` which references `.manicodeignore`, and `common/src/util/db-health-alerts.ts` which measures the `manicode_app` production app). The files written into it (each from its own module):

| File | Written by | Contents |
| ------ | ----------- | ---------- |
| `settings.json` | `cli/src/utils/settings.ts` (`getSettingsPath`, `loadSettings`) | user settings — **auto-created on first run** with `{ mode: 'DEFAULT', adsEnabled: true }` |
| `credentials.json` | `cli/src/utils/auth.ts` (`getCredentialsPath`) | optional login: `{ default: { name, email, authToken, fingerprintId, … } }` — there *is* an account system (login/logout flows exist in `cli/src/__tests__/e2e/`), but it is optional; the tagline "no account needed" holds only in the sense that the free tier works without logging in |
| `message-history.json` | `cli/src/utils/message-history.ts` | chat history |
| `recent-projects.json` | `cli/src/utils/recent-projects.ts` | recent projects |
| `anonymous-id` | `cli/src/utils/anonymous-id.ts` | persistent analytics id |
| `owner` file | `cli/src/utils/freebuff-instance-owner.ts` | instance ownership |
| `projects/<project>/` | `cli/src/project-files.ts` | per-project state |

The `Settings` interface (`cli/src/utils/settings.ts`) is:

```ts
interface Settings {
  mode?: AgentMode            // 'DEFAULT' | 'LITE' (mode selection, migrated from old 'FREE')
  adsEnabled?: boolean        // default true — the product is text-ad-funded
  freebuffModel?: string      // last model picked in the picker (see Q3)
  alwaysUseALaCarte?: boolean // deprecated
  fallbackToALaCarte?: boolean// deprecated
  hasSubmittedFirstPrompt?: boolean
}
```

**Verdict:** "No API key, account, or config file needed" is marketing shorthand for "no API key must be supplied" — but the CLI creates and reads `~/.config/manicode/settings.json` (plus credentials/history/state files) regardless. Detection via config dir would work even without the binary.

## Q2 — Does Freebuff support MCP servers?

**Yes.** Support comes from the Codebuff SDK and is wired into the CLI's agent registry:

- The loader `sdk/src/agents/load-mcp-config.ts` (`loadMCPConfig` / `loadMCPConfigSync`) reads **`mcp.json`** files from, in order (later entries take precedence, so project overrides home):
  1. `{cwd}/.agents/mcp.json`
  2. `{cwd}/../.agents/mcp.json`
  3. `{homedir}/.agents/mcp.json`
- The CLI calls it at startup in `cli/src/utils/local-agent-registry.ts`: "Load MCP config from mcp.json files in .agents directories … Merge MCP servers from mcp.json into base agents — This allows users to configure MCP tools that are available to the main agent" (user config overrides built-in servers).
- The file format is the **standard `mcpServers` record**, explicitly documented in the source as "Matches the standard MCP config format used by Claude Code, Cursor, etc." Schema (`common/src/types/mcp.ts`):
  - stdio: `{ type: 'stdio' (default), command: string, args: string[] (default []), env: Record<string,string> (default {}) }`
  - remote: `{ type: 'http' | 'sse', url: string, params: Record<string,string>, headers: Record<string,string> }`
  - `env` values of the form `$VAR` are resolved from the process environment at load time.

**Verdict:** MCP is a first-class, file-configured feature. The config is JSON, separate-file, standard-shape — the easiest possible case for the existing `GenericAdapter` (`mcpShape: 'keyed'`).

## Q3 — Can the user select/configure the underlying model, and where?

**Yes, in two ways:**

1. **Interactive picker, persisted.** The README (npm `freebuff` readme, "Why Freebuff?" and FAQ) describes a model picker in the CLI; the last choice is persisted in `~/.config/manicode/settings.json` under **`freebuffModel`** — `settings.ts` documents the field as "Last model the user picked in the freebuff model selector. Restored on next freebuff launch … Persisted as the canonical model id," with validation against the current picker catalog (`isFreebuffModelId`).
2. **Mode selection** (`mode: 'DEFAULT' | 'LITE'`) in the same settings file, plus a server-side `fallbackToALaCarte` preference (the local `alwaysUseALaCarte`/`fallbackToALaCarte` keys are marked `@deprecated` in `settings.ts`).

The available models are a **curated server-side catalog** (per the npm readme FAQ "What models do you use?"): full mode offers DeepSeek V4 Pro (default), DeepSeek V4 Flash 07/31, GPT-5.6 Luna, MiMo 2.5, with temporary per-model limits; limited mode (non-supported regions / VPN) is MiMo 2.5 with session caps. There is **no BYOK / custom-provider surface** in the CLI source — no API-key or base-URL settings exist anywhere in `settings.ts`/`auth.ts`; the "free" model is always a Freebuff-served one. So the adapter can expose model *preference*, not model *providers*.

## Q4 — Is there legitimate adapter work, or is detect-only the correct answer?

**There is legitimate adapter work. Detect-only would be the wrong call.** Concretely:

- **MCP management: yes, and cheap.** A `GenericAdapter`-style registration pointing `mcpConfigPaths` at `.agents/mcp.json` (project) and `~/.agents/mcp.json` (user) with `mcpShape: 'keyed'` would work without any new machinery — the schema is the same `mcpServers` shape pi/junie/gemini use, and it's a separate file so the main-config merge logic is not even needed. One wrinkle: the primary location is *project-scoped* (`.agents/` in cwd or cwd's parent), so the adapter's path resolution should handle both scopes; the home location is the only global one.
- **Detection: binary + config.** Binary `freebuff` (npm `bin` → `index.js`), plus config-based detection via `~/.config/manicode/` (works even if the binary is uninstalled).
- **Settings read: possible, low value.** `~/.config/manicode/settings.json` is plain JSON with a small known schema (`mode`, `adsEnabled`, `freebuffModel`, …) — readable for display, but model writing would just be re-picking from the server catalog, and provider configuration is impossible (no BYOK).
- **What an adapter should NOT promise:** model *provider* configuration, API keys, or auth management — none of those exist in the product.

**Bottom line:** register freebuff as an MCP-capable agent (keyed `mcpServers`, separate `.agents/mcp.json` files, project + home scope), with binary/config detection; skip provider settings. This is materially less work than a new adapter but more than detect-only.

---

## Sources

- npm package `freebuff` v0.0.153 (latest): metadata (`bin: { freebuff: index.js }`, repository `git+https://github.com/CodebuffAI/freebuff-private.git`, homepage `https://freebuff.com`) and README (model picker/FAQ, "Built on the Codebuff platform") — via `npm view freebuff`.
- Website: <https://freebuff.com/cli> (install, "No accounts to create, no keys to paste", "supported by text ads").
- Repository: <https://github.com/CodebuffAI/codebuff> (public monorepo; `freebuff` CLI source under `cli/`):
  - `cli/src/utils/config-dir.ts` — `~/.config/manicode` config dir
  - `cli/src/utils/settings.ts` — `settings.json` path, `Settings` interface, `freebuffModel` persistence
  - `cli/src/utils/auth.ts` — `credentials.json`
  - `cli/src/utils/message-history.ts`, `recent-projects.ts`, `anonymous-id.ts`, `freebuff-instance-owner.ts`, `project-files.ts` — other state files
  - `cli/src/utils/local-agent-registry.ts` — MCP loading/merge into agents
  - `sdk/src/agents/load-mcp-config.ts` — `mcp.json` search paths (`{cwd}/.agents`, `{cwd}/../.agents`, `~/.agents`), format docs, `$VAR` env resolution
  - `common/src/types/mcp.ts` — `mcpConfigSchema` (stdio: `command`/`args`/`env`; remote: `type: http|sse`, `url`, `params`, `headers`)
- Note: the npm `repository` field points at the *private* `CodebuffAI/freebuff-private`; the public `CodebuffAI/codebuff` repo (linked from the npm README's "Links" section) contains the CLI source and was used as the primary source.
