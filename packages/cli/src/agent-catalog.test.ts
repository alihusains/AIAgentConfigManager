/**
 * Tests for catalog-driven detection (binary + settings probing) of agents
 * that have no core adapter (e.g. reasonix, freebuff). Regression coverage for
 * the bug where installed catalog-only agents were offered as
 * "Available to Install".
 */
import { describe, it, expect } from 'vitest';
import { detectCatalogEntry, catalogEntryToDetected, getAgentCatalog } from '@ai-agent-config/core';
import type { AgentCatalogEntry } from '@ai-agent-config/core';

const HOME = (await import('node:os')).homedir();

function fakeEntry(overrides: Partial<AgentCatalogEntry> = {}): AgentCatalogEntry {
  return {
    id: 'test-entry',
    name: 'Test Entry',
    description: 'Synthetic entry for tests',
    status: 'beta',
    addedAt: '2026-08-20',
    binaries: ['definitely-not-a-real-binary-7f3a'],
    ...overrides,
  };
}

describe('detectCatalogEntry', () => {
  it('reports installed when a binary is found on PATH and captures its path', async () => {
    const probe = await detectCatalogEntry(fakeEntry({ binaries: ['sh'] }));
    expect(probe.installed).toBe(true);
    expect(probe.binaryPath).toBeTruthy();
  });

  it('reports not installed when no binary is found', async () => {
    const probe = await detectCatalogEntry(fakeEntry());
    expect(probe.installed).toBe(false);
    expect(probe.binaryPath).toBeUndefined();
  });

  it('detects an existing settings path via settingsPaths (no binary needed)', async () => {
    const probe = await detectCatalogEntry(
      fakeEntry({
        binaries: [],
        settingsPaths: { darwin: ['~'], linux: ['~'], win32: ['~'] },
      })
    );
    expect(probe.settingsExist).toBe(true);
    expect(probe.settingsPaths[0]).toBe(HOME);
  });

  it('reports missing settings when none of the paths exist', async () => {
    const probe = await detectCatalogEntry(
      fakeEntry({
        settingsPaths: {
          darwin: ['~/no-such-dir-xyzabc/settings.json'],
          linux: ['~/no-such-dir-xyzabc/settings.json'],
          win32: ['~/no-such-dir-xyzabc/settings.json'],
        },
      })
    );
    expect(probe.settingsExist).toBe(false);
  });

  it('probes the catalog entries for reasonix and freebuff without throwing', async () => {
    for (const id of ['reasonix', 'freebuff']) {
      const entry = getAgentCatalog().find((e) => e.id === id)!;
      expect(entry.binaries).toContain(id);
      const probe = await detectCatalogEntry(entry);
      expect(typeof probe.installed).toBe('boolean');
    }
    const reasonix = getAgentCatalog().find((e) => e.id === 'reasonix')!;
    expect(reasonix.settingsPaths?.darwin?.length).toBeGreaterThan(0);
  });

  it('reports MCP config path from entry.mcpPaths when the file exists', async () => {
    // Use the home dir as a file that definitely exists (the home dir itself
    // is a directory, but fileExists should still report true for it).
    const probe = await detectCatalogEntry(
      fakeEntry({
        binaries: [],
        mcpPaths: { darwin: ['~'], linux: ['~'], win32: ['~'] },
      })
    );
    expect(probe.mcpPath).toBe(HOME);
    expect(probe.mcpConfigExists).toBe(true);
  });

  it('reports missing MCP config when none of the mcpPaths exist', async () => {
    const probe = await detectCatalogEntry(
      fakeEntry({
        mcpPaths: {
          darwin: ['~/no-such-mcp-xyzabc/mcp.json'],
          linux: ['~/no-such-mcp-xyzabc/mcp.json'],
          win32: ['~/no-such-mcp-xyzabc/mcp.json'],
        },
      })
    );
    expect(probe.mcpConfigExists).toBe(false);
    expect(probe.mcpPath).toContain('no-such-mcp-xyzabc');
  });

  it('passes through new detection fields in catalogEntryToDetected', () => {
    const entry = fakeEntry({
      mcpPaths: { darwin: ['~/.agents/mcp.json'] },
      modelCredentialPaths: { darwin: ['~/.reasonix/.env'] },
    });
    const detected = catalogEntryToDetected(entry, {
      installed: true,
      binaryPath: '/usr/local/bin/reasonix',
      version: 'v1.29.0',
      settingsExist: true,
      settingsPaths: [`${HOME}/.reasonix/config.toml`],
      mcpPath: `${HOME}/.agents/mcp.json`,
      mcpConfigExists: true,
      mcpServerCount: 2,
      modelConfigPath: `${HOME}/.reasonix/config.toml`,
      modelConfigExists: true,
      modelCredentialPath: `${HOME}/.reasonix/.env`,
      modelCredentialExists: true,
    });
    expect(detected.supports.mcpServers).toBe(true);
    expect(detected.detection.mcpPath).toBe(`${HOME}/.agents/mcp.json`);
    expect(detected.detection.mcpServerCount).toBe(2);
    expect(detected.detection.modelConfigPath).toBe(`${HOME}/.reasonix/config.toml`);
    expect(detected.detection.modelCredentialPath).toBe(`${HOME}/.reasonix/.env`);
  });

  it('keeps mcpServers false when entry has no mcpPaths', () => {
    const detected = catalogEntryToDetected(fakeEntry(), {
      installed: false,
      settingsExist: false,
      settingsPaths: [],
    });
    expect(detected.supports.mcpServers).toBe(false);
  });
});

describe('catalogEntryToDetected', () => {
  it('synthesizes a DetectedAgent with no capabilities and mapped config paths', () => {
    const entry = fakeEntry({
      settingsPaths: {
        darwin: ['~/.reasonix/config.json'],
        win32: [],
        linux: ['~/.reasonix/config.toml'],
      },
    });
    const detected = catalogEntryToDetected(entry, {
      installed: true,
      binaryPath: '/usr/local/bin/reasonix',
      version: 'v1.29.0',
      settingsExist: true,
      settingsPaths: [`${HOME}/.reasonix/config.json`],
    });
    expect(detected.supports).toEqual({
      modelProviders: false,
      mcpServers: false,
      permissions: false,
      projectConfig: false,
    });
    expect(detected.configPaths.darwin).toBe('~/.reasonix/config.json');
    expect(detected.configPaths.linux).toBe('~/.reasonix/config.toml');
    expect(detected.detection).toMatchObject({
      installed: true,
      configExists: true,
      version: 'v1.29.0',
      method: 'command',
    });
  });

  it('uses method "assumed" when nothing was found', () => {
    const detected = catalogEntryToDetected(fakeEntry(), {
      installed: false,
      settingsExist: false,
      settingsPaths: [],
    });
    expect(detected.detection.method).toBe('assumed');
    expect(detected.detection.installed).toBe(false);
  });
});
