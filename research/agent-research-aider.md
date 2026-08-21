# Aider — Config & MCP Footprint Research

**Date:** 2026-07-21
**Task:** M010 — Research: Aider config/MCP footprint (primary sources)
**Method:** primary sources only — official docs (aider.chat) + source code inspection of `Aider-AI/aider` `main` (commit `5dc9490`, 2026-05-22, `__version__ = 0.86.3.dev`), fetched read-only via sparse clone. No aider binary was installed or run.
**Purpose:** confirm or correct the unverified guesses in `docs/agent-cli-inventory.md` §4.4 (config `~/.aider.conf.yml` / `~/.config/aider/aider.conf.yml`; MCP `~/.mcp.json`) and feed a future Aider adapter task.

---

## 1. TL;DR

- **Config:** Aider's config is **YAML**, and the filename is **`.aider.conf.yml`** (dot-prefixed). It is searched in exactly three places — **home directory, git repo root, current directory** — loaded in that order with **later files overriding earlier ones** (so cwd > git root > home). Verified in both the official docs and the source (`main()` in `aider/main.py`). [S1][S2][S3]
- **Guess verdict (config): CORRECTED.** `~/.aider.conf.yml` is right (home dir = `~` on all three platforms; there is no per-platform path variation and no XDG support). `~/.config/aider/aider.conf.yml` is **wrong** — that path does not exist anywhere in the docs or code. The real third location is `.aider.conf.yml` at the **git repo root / current directory**, not an XDG config dir. [S1][S2][S3]
- **MCP verdict: the guess is CONFIRMED FALSE.** Aider has **no native MCP support**: no `mcp` mention in `requirements.txt` (0 matches), no `mcpServers`/`.mcp.json` handling in the codebase, no `--mcp*` option, no MCP page in the docs sitemap, and no MCP entry in the full release `HISTORY.md`. `~/.mcp.json` is another tool's convention (e.g. the `mcp-cli` package / `mcp-remote` ecosystem — **not** Aider). The "MCP-capable" tag on the best-of-Agent-Harnesses catalog line is wrong for aider. [S3][S4]
- **API keys:** env-var-heavy, as expected — but the *primary* storage mechanism is a **`.env` file** (searched at home → git root → cwd → `--env-file`), plus dedicated YAML keys for OpenAI/Anthropic only, plus `--api-key provider=<key>` / `--set-env` CLI switches. [S5][S6][S3]
- **Adapter shape (recommendation, not verified fact):** **detect-only, like the OMP adapter** — YAML main config outside the core's json/jsonc `ConfigFormat`, **no MCP support at all** (`supports.mcpServers = false`), and keys live in `.env` (not in the YAML except two providers), so `supports.modelProviders` is questionable too. Detection is easy: binary `aider` + config existence at `~/.aider.conf.yml` / repo `.aider.conf.yml`.

---

## 2. Question 1 — Config file format and exact paths per platform

**Format:** YAML. "Most of aider's options can be set in an `.aider.conf.yml` file." [S1]

**Search locations (official, verbatim):** "Aider will look for a this file in these locations: Your home directory. The root of your git repo. The current directory. If the files above exist, they will be loaded in that order. Files loaded last will take priority." [S1]

**Source-verified precedence** (`main()` in `aider/main.py`, commit `5dc9490`): the default config file list is built as `[cwd/.aider.conf.yml, git_root/.aider.conf.yml, home/.aider.conf.yml]`, then **reversed** before re-parsing, so effective precedence is **cwd > git root > home** (last loaded wins). `--config <filename>` loads exactly one file and skips the search. The `--config` option help text in the generated sample config says: "Specify the config file (default: search for .aider.conf.yml in git root, cwd or home directory)". [S2][S3]

**Per-platform table.** Aider uses Python's `Path.home()` for the global file, so there is no XDG split — the path is simply the OS home directory:

| Platform | Global config path | Project config path(s) |
|----------|--------------------|------------------------|
| macOS / Linux | `~/.aider.conf.yml` | `./.aider.conf.yml` (cwd) and `<git-root>/.aider.conf.yml` |
| Windows | `%USERPROFILE%\.aider.conf.yml` | same, project-relative |

[verified — `Path.home() / conf_fname` in `main()`][S3]

**Verdict on the two inventory guesses:**

- `~/.aider.conf.yml` — **CONFIRMED** (this is the home-directory location).
- `~/.config/aider/aider.conf.yml` — **CORRECTED / does not exist.** No XDG config dir is consulted; the non-home locations are *dotfiles in the project* (`.aider.conf.yml` in cwd and git root), which the task prompt itself anticipated. [S1][S3]

**Precedence (confirmed):** cwd > git repo root > home; `--config` overrides everything. [S1][S3]

---

## 3. Question 2 — Does Aider read `~/.mcp.json` or any MCP config?

**No. Aider has no native MCP client support.** Evidence (all primary):

1. **Codebase scan** of `Aider-AI/aider` `main` @ `5dc9490` (2026-05-22, v0.86.3.dev): a recursive grep of the `aider/` package for `mcp` (case-insensitive) matches **only binary assets** (mp4/jpg files whose byte streams happen to contain the substring) — zero matches in any `.py` source, zero in `requirements.txt`, zero in `README.md`. [S3][S4]
2. **Docs:** no MCP page exists anywhere in the official docs sitemap (`aider.chat/sitemap.xml` — 0 matches for `mcp`). [S7]
3. **Release history:** the full `HISTORY.md` shipped in the repo contains **zero** mentions of MCP — i.e. it was never added and reverted in a release. [S4]
4. The only "keys in a separate file" mechanism that looks MCP-adjacent is the **OpenRouter OAuth** flow, which persists a key to `~/.aider/oauth-keys.env` (a dotenv file loaded first, before other `.env` files) — unrelated to MCP. [S3]

**Conclusion:** the inventory's `~/.mcp.json` (project) guess is **wrong** — it conflates Aider with the `mcp-cli` / `mcp-remote` npm ecosystem convention (a separate tool that reads `~/.mcp.json` / `.mcp.json`). The "MCP-capable" tag on the best-of-Agent-Harnesses catalog line for aider (cited in `docs/agent-cli-inventory.md` §4.2/§4.4) should be treated as **unconfirmed/incorrect** — no primary source supports it. [S4][S7]

**If MCP is ever needed with Aider** (recommendation, not verified fact): the natural integration path would be running an MCP server *as* an OpenAI-compatible endpoint via `openai-api-base` + `--api-key`/env vars, or an external `mcp-cli`-style proxy — both outside Aider's own config. Not something an adapter should assume today.

---

## 4. Question 3 — Model providers and API keys: env vars vs config file

**Both — layered, env-var-heavy as expected.** Aider "lets you specify API keys in a few ways: On the command line, As environment variables, In a `.env` file, In your `.aider.conf.yml` config file." [S5]

Specifics:

| Mechanism | Scope | Source |
| ----------- | ------- | -------- |
| **`.env` file** (primary recommended store) | All providers. Searched at: home dir → git repo root → cwd → `--env-file <fname>`; later files override. Also `~/.aider/oauth-keys.env` is loaded first (OpenRouter OAuth). | [S6][S3] |
| **Env vars** | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and generically `<PROVIDER>_API_KEY` (e.g. `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`). | [S5][S6] |
| **YAML config file** | **OpenAI and Anthropic only**: `openai-api-key: <key>`, `anthropic-api-key: <key>` (sample config comment: "You can only put OpenAI and Anthropic API keys in the YAML config file. Keys for all APIs can be stored in a .env file"). | [S1][S5] |
| **CLI** | `--openai-api-key` / `--anthropic-api-key` (dedicated); `--api-key provider=<key>` sets `PROVIDER_API_KEY=<key>` for any provider; `--set-env NAME=value` sets arbitrary env vars. In `main()`, YAML/CLI key values are copied into `os.environ` (e.g. `os.environ["OPENAI_API_KEY"] = args.openai_api_key`). | [S5][S3] |

**Model selection:** `--model <name>` / `model:` in YAML / `AIDER_MODEL` in `.env`; provider is encoded in the model name prefix (`openai/…`, `anthropic/…`, `openrouter/…`, …). Model-specific provider settings (context window, cost, edit format, `accepts_settings`) live in `.aider.model.settings.yml` + `.aider.model.metadata.json` — see Q4. [S1][S6]

**Adapter implication (recommendation):** the config manager's "model providers" concept maps awkwardly — keys mostly belong in `.env` (a format the core does not currently parse), with only two providers representable in the YAML. An adapter should not claim `supports.modelProviders` based on the YAML alone.

---

## 5. Question 4 — Other settings relevant to a config manager

- **Model aliases** — `alias: [ "fast:gpt-4o-mini", "smart:o3-mini" ]` in `.aider.conf.yml` (or repeated `--alias alias:model-name`). Aliases are usable as `--model fast` or in-chat `/model fast`. This is the closest thing to a "model alias" feature; it is per-project/global YAML, not a separate file. [S8][S3]
- **`.aider.model.settings.yml`** — "Specify a file with aider model settings for unknown models" (`model-settings-file:` option, default `.aider.model.settings.yml`). Searched home → git root → cwd (same `generate_search_path_list` mechanism as the main config). [S1][S3]
- **`.aider.model.metadata.json`** — "Specify a file with context window and costs for unknown models" (`model-metadata-file:`, default `.aider.model.metadata.json`), same search order, plus the built-in `aider/resources/model-metadata.json`. [S1][S3]
- **`.env`** — see Q3; also carries `AIDER_*`-prefixed forms of *every* option (e.g. `AIDER_MODEL`, `AIDER_API_KEY`) — the `.env` file is effectively a second config surface. [S6]
- **`~/.aider/oauth-keys.env`** — OpenRouter OAuth keys, auto-loaded first. [S3]
- **Not a config-manager concern:** `.aiderignore` (repomap ignore patterns, default in git root), `.aider.tags.yml`/history files, editor config (`--editor` docs) — none of these are agent-manager-relevant. [S1]

---

## 6. Question 5 — Adapter-shape recommendation *(recommendation, not verified fact)*

Options from `docs/agent-cli-inventory.md` §4.6 and the existing adapters:

| Shape | Precedent | Fit for Aider |
| ------- | ----------- | --------------- |
| `OpenCodeStyleAdapter` | `kilo.ts` | **No** — that adapter speaks the OpenCode JSON/JSONC schema with an in-config `mcp` array key. Aider is YAML with no MCP key. |
| `GenericAdapter` | `pi.ts`, `junie.ts`, `gemini.ts` | **Partial** — it handles per-platform `configPaths` + optional separate `mcpPath` and keyed/array MCP shapes, but the core's `ConfigFormat` is json/jsonc; its read/write path would misparse YAML. |
| **Bespoke detect-only (recommended)** | `omp.ts` | **Yes** — Aider is the second YAML agent after OMP, and even more constrained: no MCP support at all, and provider keys mostly in `.env`. |

**Recommended shape: detect-only, modeled on `omp.ts`:**

- `binaries: ['aider']` for PATH detection.
- `configFormat: 'yaml'`; `configPaths` = `~/.aider.conf.yml` (all platforms) plus project files `./.aider.conf.yml` (cwd/git root) surfaced as `projectConfig: true` if the core wants it.
- `supports: { modelProviders: false, mcpServers: false, permissions: false }` — **`mcpServers: false` is a verified fact** (no MCP support), so the materializer will skip it automatically (same mechanism OMP relies on).
- `readConfig`: parse the YAML into `customSettings` (read-only view: `model`, aliases, `openai-api-key`/`anthropic-api-key` presence — **redact values**); optionally surface `.env` key *names* (never values) since that is where most providers' keys actually live.
- `writeConfig`: throw (YAML writing is outside the core's format support, same as OMP).
- Detection via config existence (`~/.aider.conf.yml` or a project `.aider.conf.yml`) is also viable for machines where the binary isn't on PATH — same pattern as the `gemini` adapter's `method: 'config'`.

**Do not** implement any MCP materialization for Aider today; if a future Aider release adds MCP (check `HISTORY.md` first — it has zero MCP entries as of 2026-05-22), re-verify against that release's docs before extending the adapter.

---

## 7. Corrections to `docs/agent-cli-inventory.md` (for a follow-up docs task)

- §4.4 aider row, "Config location": replace `~/.aider.conf.yml / ~/.config/aider/aider.conf.yml` with **`~/.aider.conf.yml` (global); `./.aider.conf.yml` (cwd + git root, project)** — precedence cwd > git root > home.
- §4.4 aider row, "MCP config": replace `~/.mcp.json (project)` with **none — no native MCP support** (verified in code + docs + HISTORY.md).
- §4.2 note "aider (cat. 7, 48.3k★, MCP-capable)": the MCP-capable tag is unsupported by any primary source; drop or mark unconfirmed.

---

## 8. Local footprint on this machine

Not required by the task scope, but for completeness: no `aider` binary on PATH and no `~/.aider*` config files were found on this machine (checked `command -v aider` and `ls ~/.aider*` during research) — so Aider is a pure docs/code-verified target here, detectable only after a user installs it. *(marked: local check, 2026-07-21)*

---

## Sources

- [S1] Aider official docs — "YAML config file": <https://aider.chat/docs/config/aider_conf.html> (search locations, load order, `--config`, full sample `.aider.conf.yml` incl. `model-settings-file`, `model-metadata-file`, `alias`, key-restriction comment)
- [S2] Aider official docs — "Configuration" index: <https://aider.chat/docs/config.html>
- [S3] Aider source, `main` branch @ commit `5dc9490bb35f9729ef2c95d00a19ccd30c26339c` (2026-05-22), `__version__ = 0.86.3.dev`: <https://github.com/Aider-AI/aider> — `aider/main.py` (`main()`: `default_config_files` order + `reverse()`; `generate_search_path_list()`; `load_dotenv_files()` incl. `~/.aider/oauth-keys.env`; `--api-key`/`--set-env` handling; `os.environ` key injection), `aider/args.py` (`--model-settings-file` default `.aider.model.settings.yml`); recursive case-insensitive grep for `mcp` over `aider/` Python sources: 0 matches
- [S4] Aider repo, same commit: `requirements.txt` (0 `mcp` matches), `README.md` (0 `mcp` matches), `aider/website/HISTORY.md` full release history (0 `mcp` matches) — via sparse clone of <https://github.com/Aider-AI/aider>
- [S5] Aider official docs — "API Keys": <https://aider.chat/docs/config/api-keys.html> (four key mechanisms; OpenAI/Anthropic-only YAML keys; `--api-key provider=<key>` → `PROVIDER_API_KEY`)
- [S6] Aider official docs — "Config with .env": <https://aider.chat/docs/config/dotenv.html> (`.env` search order home → git root → cwd → `--env-file`; `AIDER_*` option forms; sample `.env`)
- [S7] Aider docs sitemap: <https://aider.chat/sitemap.xml> (0 URLs containing `mcp`)
- [S8] Aider official docs — "Model Aliases": <https://aider.chat/docs/config/model-aliases.html> (`--alias` / YAML `alias:` list, format `alias:model-name`)

*Contrast (non-source, context only):* the `~/.mcp.json` convention belongs to the `mcp-cli`/`mcp-remote` npm tooling ecosystem, not to Aider — no Aider primary source references it.
