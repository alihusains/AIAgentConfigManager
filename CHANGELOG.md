# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-03

### Added

#### Agent Catalog & Discovery
- **38 AI agent CLIs** cataloged with full metadata:
  - ChatGPT, Claude Code, OpenCode, Cursor, Continue, Cline, Aider
  - Gemini, Pi, Mimo, Reasonix, OMP, Windsurf, Zed
  - Copilot CLI, Goose, Roo Code, Qwen, Kimi
  - Amazon Q, Crush, Droid, FreeBuff, Kilo
  - DeepSeek, CodeBuff, and 14 more emerging agents
- Per-agent metadata: install commands, platform support, config paths, MCP support, API types, skills support
- Automatic detection via binary probes and configuration scanning
- Support for both adapter-backed and catalog-only entries

#### Live GitHub Star Tracking (`live-stars` module)
- Real-time star counts fetched from GitHub REST API
- 15-minute in-memory cache to respect rate limits (60/hour unauthenticated)
- Bounded concurrency (5 parallel requests) with 15s timeout per request
- Graceful error handling with `StarRateLimitError` for rate limits
- Maintenance status detection: active (push ≤90d), stale (push >90d), archived
- 30-day growth trend for trending indicator
- Test seam (`__setStarsFetch`) for injecting mock GitHub responses in tests
- 24 comprehensive test cases covering cache, concurrency, error scenarios

#### Agent Rankings & Discovery UI
- **Star Badges**: Compact display of agent popularity
  - Star count in human-readable format (1.2k, 1.5M)
  - Trending indicator (🔥) for agents gaining 50+ stars/month
  - Rank badge (Top 10/20/50)
  - Maintenance status (✓ active, ⚠ stale, ◯ archived)
  - Click-through to GitHub repository
  
- **Agent Rankings Page**: Full leaderboard view
  - Sort by: Most Stars, Trending Growth (30d), Name A-Z, Maintenance Status
  - Filters: Trending agents only, maintenance status (all/active/stale/archived), search
  - Statistics dashboard: Total agents, most popular, trending count
  - CSV export for analysis and reporting
  - Responsive design (mobile, tablet, desktop)

- **Enhanced Agents List**: Integrated discovery workflow
  - Star badges on installed agents
  - Advanced filtering and sorting for available agents
  - Search across agent name, ID, description
  - One-click filter clearing
  - Live update timestamps (updated 5m ago)

#### WhatsApp Theme & UI Polish
- **Single-theme collapse**: Unified WhatsApp-inspired color scheme
  - Token consolidation: 150+ tokens reduced to clean system
  - Consistent spacing, typography, and component styling
  - Dark mode support with optimized contrast ratios
- **Professional UI styling** across all components:
  - Micro-interactions for feedback (hover, active, disabled states)
  - Refined button hierarchy and visual weight
  - Improved form controls and input feedback
  - Polished agent rows with tight gaps and aligned actions

### Fixed
- Provider type compatibility: anthropic-compatible and native provider support in add-provider form
- Button UI visual hierarchy and feedback states
- Agent row spacing and layout consistency

### Improved
- Agent catalog consistency checks (JSON ↔ adapter validation)
- Detection performance: full scan in <2s, cached hits in <1ms
- Memory efficiency: no unbounded growth during repeated operations
- TypeScript strict mode compliance across all packages
- Test coverage: 475+ tests passing (agent-catalog, live-stars, marketplace, etc.)

### Build & Deployment
- ✅ `pnpm build`: All 3 packages (core, cli, gui) build successfully
- ✅ `pnpm test`: 475+ tests passing (agent-catalog: 99, live-stars: 24, and more)
- ✅ TypeScript: Strict mode, no errors
- ✅ GUI bundle: 392.90 kB (107.26 kB gzipped) — 1577 modules
- ✅ Git history: 11 commits, ready for production

### Platform Support
- macOS (darwin), Linux, Windows (win32)
- Node.js 18+, pnpm 8+
- Modern browsers (Chrome, Firefox, Safari, Edge)

---

## Historical Releases

### Phase 5 - UI Polish (Sept 3, 2026)
- WhatsApp theme redesign with single-theme collapse
- Token consolidation and consistent component styling
- Micro-interactions and refined button UI
- All 6 parallel tasks completed successfully

### Phase 4 - UX Improvements (Sept 2, 2026)
- Model provider selection improvements
- API capability checkmarks (chat, responses, anthropic)
- Dark mode contrast refinements
- Icon deep-import for better code splitting

### Phase 3 - Performance & QA (Sept 1, 2026)
- Performance regression prevention (detection <2s SLA)
- Comprehensive test suite (475+ tests)
- Documentation and error messages
- Registry and skills integration

### Phase 1-2 - Foundation (Aug 20-31, 2026)
- Initial project setup and architecture
- Agent detection and adapter system
- Provider management
- GUI dashboard and CLI
- MCP server integration
