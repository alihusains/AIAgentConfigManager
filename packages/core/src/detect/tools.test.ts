/**
 * Tests for CLI/environment tool detection (detectCliTools).
 */
import { describe, it, expect } from 'vitest';
import { detectCliTools, checkToolUpdates, CLI_TOOLS, type CliToolDef, type CliToolStatus } from '../index';

describe('detectCliTools', () => {
  it('returns one status per tool with the static metadata intact', async () => {
    const tools = await detectCliTools();
    expect(tools).toHaveLength(CLI_TOOLS.length);
    for (const t of tools) {
      expect(t.name).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.group).toBeTruthy();
      expect(typeof t.installed).toBe('boolean');
      if (t.installed) {
        expect(t.path).toBeTruthy();
        expect(['path', 'shell-env', 'known-location']).toContain(t.foundBy);
      } else {
        expect(t.path).toBeUndefined();
      }
    }
  });

  it('detects a known-present binary (sh) as installed', async () => {
    const def: CliToolDef = {
      name: 'sh',
      label: 'sh',
      description: 'shell',
      group: 'test',
      versionArgs: ['--version'],
    };
    const [tool] = await detectCliTools([def]);
    expect(tool.installed).toBe(true);
    expect(tool.path!).toContain('sh');
  });

  it('reports a nonexistent binary as missing', async () => {
    const def: CliToolDef = {
      name: 'definitely-not-a-real-tool-9c1f',
      label: 'Nope',
      description: 'missing tool',
      group: 'test',
    };
    const [tool] = await detectCliTools([def]);
    expect(tool.installed).toBe(false);
    expect(tool.path).toBeUndefined();
    expect(tool.version).toBeUndefined();
  });

  it('captures a version string for an installed CLI', async () => {
    const def: CliToolDef = {
      name: 'node',
      label: 'Node.js',
      description: 'runtime',
      group: 'test',
      versionArgs: ['--version'],
    };
    const [tool] = await detectCliTools([def]);
    if (tool.installed) {
      // node is present in the CI/dev environment this runs in.
      expect(tool.version).toMatch(/v?\d/);
    }
  });
});

describe('checkToolUpdates', () => {
  const mk = (name: string, version: string): CliToolStatus => ({
    name,
    label: name,
    description: name,
    group: 'test',
    installed: true,
    version,
    path: `/bin/${name}`,
    foundBy: 'path',
  });

  it('flags an update when a newer npm-published version exists', async () => {
    const npmLatest = async (pkg: string) => (pkg === 'npm' ? '10.2.0' : '0');
    const [res] = await checkToolUpdates([mk('npm', '9.14.4')], { npmLatest });
    expect(res.name).toBe('npm');
    expect(res.currentVersion).toBe('9.14.4');
    expect(res.latestVersion).toBe('10.2.0');
    expect(res.updateAvailable).toBe(true);
    expect(res.method).toBe('npm');
    expect(res.command).toBe('npm install -g npm@latest');
  });

  it('reports up to date when installed version equals latest', async () => {
    const npmLatest = async () => '1.22.22';
    const [res] = await checkToolUpdates([mk('yarn', '1.22.22')], { npmLatest });
    expect(res.updateAvailable).toBe(false);
    expect(res.latestVersion).toBe('1.22.22');
    expect(res.method).toBe('npm');
  });

  it('labels pnpm as npm-checkable with an add -g command', async () => {
    const npmLatest = async () => '9.12.0';
    const [res] = await checkToolUpdates([mk('pnpm', '8.15.9')], { npmLatest });
    expect(res.updateAvailable).toBe(true);
    expect(res.command).toBe('pnpm add -g pnpm@latest');
  });

  it('returns method unsupported for tools without a registrable npm package', async () => {
    const [git, node] = await checkToolUpdates([mk('git', '2.39.0'), mk('node', '20.11.0')], {
      npmLatest: async () => '',
    });
    expect(git.method).toBe('unsupported');
    expect(git.updateAvailable).toBe(false);
    expect(git.command).toBeUndefined();
    expect(git.reason).toMatch(/not supported/i);
    expect(node.method).toBe('unsupported');
  });

  it('does not fail when the registry lookup errors', async () => {
    const npmLatest = async () => {
      throw new Error('registry unreachable');
    };
    const [res] = await checkToolUpdates([mk('npm', '9.14.4')], { npmLatest });
    expect(res.name).toBe('npm');
    expect(res.updateAvailable).toBe(false);
    expect(res.latestVersion).toBeUndefined();
    expect(res.method).toBe('npm');
    expect(res.reason).toMatch(/could not determine/i);
  });

  it('skips tools that are not installed', async () => {
    const notInstalled: CliToolStatus = {
      name: 'npm',
      label: 'npm',
      description: 'npm',
      group: 'test',
      installed: false,
    };
    const results = await checkToolUpdates([notInstalled, mk('yarn', '1.22.22')], {
      npmLatest: async () => '1.22.22',
    });
    expect(results.map((r) => r.name)).toEqual(['yarn']);
  });
});
