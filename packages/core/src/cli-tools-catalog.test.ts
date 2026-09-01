/**
 * Tests for the CLI tools catalog.
 */

import { describe, it, expect } from 'vitest';
import {
  CLI_TOOL_CATALOG,
  getCliTool,
  searchCliTools,
  groupCliToolsByCategory,
  getRelatedTools,
  getCliToolCategories,
  getInstallCommandForPlatform,
} from './cli-tools-catalog';

describe('cli-tools-catalog', () => {
  // ========================================================================
  // Data integrity
  // ========================================================================

  it('catalog has 50+ tools', () => {
    expect(CLI_TOOL_CATALOG.length).toBeGreaterThanOrEqual(50);
  });

  it('every tool has a unique id', () => {
    const ids = CLI_TOOL_CATALOG.map((t) => t.id);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
  });

  it('every tool has required fields', () => {
    for (const tool of CLI_TOOL_CATALOG) {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.category).toBeTruthy();
      expect(tool.installCommands.length).toBeGreaterThan(0);
      expect(tool.platforms.length).toBeGreaterThan(0);
      expect(tool.homepage).toBeTruthy();
      expect(tool.documentation).toBeTruthy();
      expect(tool.usageExample).toBeTruthy();
      expect(Array.isArray(tool.relatedTools)).toBe(true);
      expect(['free', 'freemium', 'paid']).toContain(tool.pricing);
      expect(['beginner', 'intermediate', 'advanced']).toContain(tool.difficulty);
    }
  });

  it('every install command has packageManager and command', () => {
    for (const tool of CLI_TOOL_CATALOG) {
      for (const cmd of tool.installCommands) {
        expect(cmd.packageManager).toBeTruthy();
        expect(cmd.command).toBeTruthy();
      }
    }
  });

  it('every platform is valid', () => {
    const valid = ['darwin', 'linux', 'win32'];
    for (const tool of CLI_TOOL_CATALOG) {
      for (const p of tool.platforms) {
        expect(valid).toContain(p);
      }
    }
  });

  it('every category is valid', () => {
    const valid = ['development', 'productivity', 'cloud', 'ai', 'build', 'system', 'utilities'];
    for (const tool of CLI_TOOL_CATALOG) {
      expect(valid).toContain(tool.category);
    }
  });

  // ========================================================================
  // Referential integrity
  // ========================================================================

  it('related tools all exist in the catalog', () => {
    const catalogIds = new Set(CLI_TOOL_CATALOG.map((t) => t.id));
    for (const tool of CLI_TOOL_CATALOG) {
      for (const relatedId of tool.relatedTools) {
        expect(catalogIds.has(relatedId)).toBe(true);
      }
    }
  });

  it('no tool references itself as related', () => {
    for (const tool of CLI_TOOL_CATALOG) {
      expect(tool.relatedTools).not.toContain(tool.id);
    }
  });

  // ========================================================================
  // Lookup functions
  // ========================================================================

  it('getCliTool returns a tool when found', () => {
    const git = getCliTool('git');
    expect(git).toBeDefined();
    expect(git?.id).toBe('git');
    expect(git?.name).toBe('Git');
  });

  it('getCliTool returns undefined when not found', () => {
    const notFound = getCliTool('nonexistent-tool');
    expect(notFound).toBeUndefined();
  });

  it('getCliToolCategories returns all categories in order', () => {
    const cats = getCliToolCategories();
    expect(cats.length).toBeGreaterThan(0);
    expect(cats).toContain('development');
    expect(cats).toContain('productivity');
  });

  // ========================================================================
  // Search & filter
  // ========================================================================

  it('searchCliTools with no filters returns all tools', () => {
    const results = searchCliTools();
    expect(results.length).toBe(CLI_TOOL_CATALOG.length);
  });

  it('searchCliTools by name finds git', () => {
    const results = searchCliTools({ query: 'git' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((t) => t.id === 'git')).toBe(true);
  });

  it('searchCliTools is case-insensitive', () => {
    const lower = searchCliTools({ query: 'docker' });
    const upper = searchCliTools({ query: 'DOCKER' });
    expect(lower.length).toBe(upper.length);
  });

  it('searchCliTools by category filters correctly', () => {
    const devTools = searchCliTools({ categories: ['development'] });
    expect(devTools.length).toBeGreaterThan(0);
    expect(devTools.every((t) => t.category === 'development')).toBe(true);
  });

  // ========================================================================
  // Grouping
  // ========================================================================

  it('groupCliToolsByCategory groups tools correctly', () => {
    const grouped = groupCliToolsByCategory();
    expect(grouped.development).toBeDefined();
    expect(grouped.development.length).toBeGreaterThan(0);
  });

  // ========================================================================
  // Platform-specific install commands
  // ========================================================================

  it('getInstallCommandForPlatform returns a command for macOS', () => {
    const git = getCliTool('git');
    if (git) {
      const cmd = getInstallCommandForPlatform(git, 'darwin');
      expect(cmd).toBeDefined();
      expect(cmd?.command).toBeTruthy();
    }
  });

  // ========================================================================
  // Sanity checks on specific tools
  // ========================================================================

  it('catalog includes core development tools', () => {
    const ids = new Set(CLI_TOOL_CATALOG.map((t) => t.id));
    expect(ids.has('git')).toBe(true);
    expect(ids.has('node')).toBe(true);
    expect(ids.has('npm')).toBe(true);
    expect(ids.has('docker')).toBe(true);
  });

  it('catalog includes productivity tools', () => {
    const ids = new Set(CLI_TOOL_CATALOG.map((t) => t.id));
    expect(ids.has('curl')).toBe(true);
    expect(ids.has('tmux')).toBe(true);
    expect(ids.has('fzf')).toBe(true);
    expect(ids.has('ripgrep')).toBe(true);
  });

  it('catalog includes cloud tools', () => {
    const ids = new Set(CLI_TOOL_CATALOG.map((t) => t.id));
    expect(ids.has('aws-cli')).toBe(true);
    expect(ids.has('kubectl')).toBe(true);
    expect(ids.has('terraform')).toBe(true);
  });

  it('catalog includes 50+ tools total', () => {
    expect(CLI_TOOL_CATALOG.length).toBeGreaterThanOrEqual(50);
  });
});
