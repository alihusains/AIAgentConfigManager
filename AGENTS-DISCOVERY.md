# AI Agent Discovery Guide

A comprehensive guide to discovering, evaluating, and managing 38+ AI coding agent CLIs with live GitHub star tracking.

## Overview

This project maintains a curated catalog of **38 AI coding agents** and provides **live star rankings** to help you discover the most popular and actively maintained agents.

**Quick Links:**
- 📊 [Live Star Rankings](#live-star-rankings) — Sort agents by popularity, trending growth, and maintenance status
- 🔍 [Agent Discovery](#agent-discovery) — Find agents by category, capability, and platform
- 🚀 [Quick Start](#quick-start) — Get started in 5 minutes

---

## Live Star Rankings

The dashboard displays real-time GitHub star counts for every agent, updated hourly.

### Key Metrics

| Metric | Description |
|--------|------------|
| **Stars** | GitHub star count — reflects community interest |
| **Trending 🔥** | Growing 50+ stars per month — actively gaining adoption |
| **Maintenance Status** | Active (push ≤90d), Stale (push >90d), Archived |
| **Rank** | Top 10/20/50 badges — community consensus |
| **Growth (30d)** | Stars gained in last month — momentum indicator |

### Using the Rankings

1. **Navigate to Rankings**: Click "Agent Rankings" in the sidebar
2. **Sort by**:
   - **Most Stars** (default) — longest-running, most established agents
   - **Trending Growth** — emerging agents gaining adoption
   - **Name A-Z** — alphabetical search
   - **Maintenance Status** — filter by active/stale/archived

3. **Filter**:
   - **Trending agents only** — see what's gaining momentum
   - **Maintenance status** — exclude archived or stale agents
   - **Search** — find agents by name, ID

4. **Export**: Download rankings as CSV for analysis

---

## Agent Discovery

### Catalog Structure

All 38 agents are organized by:

- **Status**: Stable, Beta, Emerging
- **Platform**: macOS, Linux, Windows
- **API Type**: Chat, Responses, Anthropic-compatible
- **Installation**: Automated setup available for 30+ agents
- **MCP Support**: Extensibility via Model Context Protocol

### Recommended Agents by Use Case

#### **For Beginners**
- **Claude Code** — Easiest setup, best docs, smallest learning curve
- **Cursor** — AI-native IDE, seamless workflow
- **OpenCode** — Open-source, no lock-in

#### **For Power Users**
- **Cline** — Most customizable, advanced MCP support
- **Continue** — Deep IDE integration (VS Code, JetBrains)
- **Aider** — CLI-first, git integration

#### **For Server/Headless**
- **Qwen** — Open LLM, offline capable
- **Amazon Q** — AWS ecosystem integration
- **Pi** — Lightweight, single-file

#### **For Trending/Emerging**
- **Crush** — New Rust-based implementation
- **Droid** — Mobile-first agent (Android)
- **Roo Code** — Agentic multi-turn conversations

---

## Adding New Agents

To propose a new agent for the catalog:

### 1. Verify the Agent

- [ ] CLI is publicly available (npm, brew, apt, pip, or manual download)
- [ ] GitHub repo exists and is active (last push ≤90 days)
- [ ] Install command works on at least one platform (macOS, Linux, or Windows)
- [ ] Configuration is documented (JSON, YAML, TOML, or ENV)

### 2. Gather Information

```json
{
  "id": "my-agent",
  "name": "My Agent CLI",
  "description": "Brief description (one sentence)",
  "status": "stable",
  "source": "https://github.com/owner/repo",
  "github": "https://github.com/owner/repo",
  "install": "npm install -g my-agent-cli",
  "uninstall": "npm uninstall -g my-agent-cli",
  "binaries": ["my-agent"],
  "apiTypes": ["chat"],
  "settingsPaths": {
    "darwin": ["~/.config/my-agent/config.json"],
    "linux": ["~/.config/my-agent/config.json"],
    "win32": ["%APPDATA%\\my-agent\\config.json"]
  },
  "icon": "Bot"
}
```

### 3. Test Locally

- [ ] Binary detected on PATH
- [ ] Config file scanned successfully
- [ ] Version probe works
- [ ] Install/uninstall commands are safe (whitelist validation)

### 4. Submit

Open a GitHub issue with:
- Agent name and repo URL
- Install command(s)
- Config file location(s)
- MCP server support (if any)
- Why you think it should be included

---

## Catalog Entries

### All 38 Agents

| # | Agent | Stars | Status | Install |
|---|-------|-------|--------|---------|
| 1 | Claude Code | 🔥 High | Stable | macOS/Linux |
| 2 | Cursor | 🔥 High | Stable | Cross-platform |
| 3 | Continue | 🔥 High | Stable | VS Code, JetBrains |
| 4 | Cline | ⭐⭐⭐⭐ | Stable | npm |
| 5 | OpenCode | ⭐⭐⭐⭐ | Stable | npm |
| ... | ... | ... | ... | ... |
| 38 | Emerging Agent | ⭐ | Beta | TBD |

*(For full list, see agent-catalog.json or the Rankings page)*

---

## Live Star API

Programmatic access to star data:

### JavaScript/TypeScript

```typescript
import { fetchStarRankings, parseGitHubRepo } from '@ai-agent-config/core';

// Fetch fresh star data
const rankings = await fetchStarRankings(catalogEntries, { force: true });

// Sort by stars
rankings.rankings.sort((a, b) => b.stars - a.stars);

// Get trending agents
const trending = rankings.rankings.filter(r => r.growth30d >= 50);

// Display results
for (const agent of trending) {
  console.log(`${agent.agentId}: ${agent.stars}⭐ (+${agent.growth30d} this month)`);
}
```

### CLI

```bash
# Fetch star rankings (uses cached data by default)
ai-config agents list --sort=stars

# Force refresh from GitHub
ai-config agents list --sort=stars --refresh

# Export as JSON
ai-config agents export-rankings > rankings.json

# Export as CSV
ai-config agents export-rankings --format=csv > rankings.csv
```

---

## Technical Details

### Cache & Rate Limits

- **In-memory cache**: 15 minutes (fresh data without re-hitting GitHub)
- **GitHub limit**: 60 requests/hour for unauthenticated access
- **Concurrency**: 5 parallel fetches (stays well under the limit)
- **Timeout**: 15 seconds per request
- **Fallback**: If GitHub is unavailable, stale cache is used (no errors)

### Maintenance Status

Determined from the GitHub `pushed_at` timestamp:

- **Active** — Last push ≤ 90 days ago (actively maintained)
- **Stale** — Last push > 90 days ago (not actively maintained)
- **Archived** — Repository is marked as archived (read-only)

### Growth Calculation

- **30-day growth**: Estimated from cached star count comparison (first sample must be 30+ days old)
- **Trending**: Agents with 50+ stars gained in the last 30 days
- **Per-day rate**: Estimated as (current_stars - cached_stars) / (days_since_cached)

---

## Troubleshooting

### "Rate limit exceeded"

You've hit GitHub's 60 requests/hour limit. Solutions:

1. Wait 1 hour for the limit to reset
2. Set `GITHUB_TOKEN` env var to raise limit to 5000/hour
3. Use cached data (don't force-refresh)

### "Repository not found (404)"

The GitHub URL in the catalog entry is incorrect or the repo was deleted. Open an issue to report it.

### "No data available for this agent"

The agent doesn't have a GitHub repository URL in the catalog. Some agents (like AWS-hosted ones) may not be on GitHub.

---

## Resources

- **GitHub**: [AIAgentConfigManager](https://github.com/alihusains/AIAgentConfigManager)
- **Awesome List**: [awesome-cli-coding-agents](https://github.com/alihusains/awesome-cli-coding-agents)
- **Catalog Source**: `packages/core/src/agent-catalog.json`
- **Star Module**: `packages/core/src/live-stars.ts`
- **Tests**: `packages/core/src/live-stars.test.ts`

---

## Related Projects

- **Awesome CLI Agents** — Community-curated list of 100+ AI agents
- **Agent Config Manager** — This project — unified config management
- **Market Research** — [AI Agent Landscape Q3 2026](research/star-rankings-preview.html)

---

*Last updated: 2026-09-03*
*Catalog version: 16 (38 agents)*
*Star data refreshed hourly*
