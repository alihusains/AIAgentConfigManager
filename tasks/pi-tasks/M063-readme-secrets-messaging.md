# M063 — README: message the keychain work against the real GitGuardian secrets-sprawl numbers

## Identity

- Task ID: M063
- Parent workstream: Messaging (research-identified, zero build cost)
- Owner: Pi
- Lead: Claude (PiTaskDispatch)
- Repository: /Users/a.sorathiya/Documents/Ali/AIAgentConfigManager
- Base revision: current main (HEAD at dispatch time)
- Branch: pi/M063-readme-secrets-messaging
- Worktree: /Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M063-readme-secrets-messaging
- Type: docs
- Priority: P2
- Dependencies: none

## How to work this task

Work ONLY inside:

`/Users/a.sorathiya/Documents/Ali/pi-worktrees/task-M063-readme-secrets-messaging`

Work ONLY within these repository paths:

- `README.md`

Commit your changes with git before finishing (git add + git commit) — do not leave the diff uncommitted.

## Why this task exists

Deep research this session found real, cited evidence that directly validates the Phase 1 (Secrets) work already shipped: GitGuardian found 24,008 unique secrets leaked in MCP config files on public GitHub, with AI-assisted commits leaking secrets at ~2x the baseline rate (source: GitGuardian "AI and secrets in git history" blog, 2025-26; 28.6M new secrets total, +34% YoY). The README does not currently connect the shipped keychain feature to this evidence.

## Target state

Add a concise section (or extend the existing feature description) in `README.md` that:
1. States the real, cited GitGuardian numbers (24,008 unique secrets in MCP configs on public GitHub; ~2x leak rate in AI-assisted commits) as the reason this project treats secrets as a first-class concern — cite the source honestly (a blog post finding, not a peer-reviewed study; do not overstate its authority).
2. Describes what's actually shipped today (OS-keychain-backed provider keys, opt-in for new providers, redacted-by-default environment variable management) accurately — do not claim more than what's built (no claiming automatic migration of existing keys, since that's not built yet).
3. Keep it tight — a short paragraph or a small callout box, not a new marketing section. This is a technical README, not a landing page.

## Read first

- `README.md` (full file, current structure and existing security-related claims)
- `docs/design/phase1-secrets-design.md` (what's actually built, for accuracy)

## Allowed scope

- `README.md`

## Forbidden scope

- Any other file
- Any code change

## Exact requirements

1. Real, cited GitGuardian numbers included, honestly sourced.
2. Only currently-shipped capability described, nothing aspirational stated as done.
3. Tight, technical tone consistent with the rest of the README.

## Verification

Also verify:

- `git status --short` shows only `README.md`
- Every number/claim in your addition traces to a real source you can name

## Final report

STATUS: DONE | PARTIAL | BLOCKED | FAILED

FILES_CHANGED:
- <file>

VERIFICATION:
- <result>

KNOWN_ISSUES:
- <none or issue>

FOLLOW_UP:
- <none or required action>
