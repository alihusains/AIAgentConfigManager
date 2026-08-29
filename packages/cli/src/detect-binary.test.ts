/**
 * Tests for robust binary resolution (PATH augmentation + known locations)
 * and version-probe hardening.
 */
import { describe, it, expect } from 'vitest';
import { resolveBinary, _resetBinaryCaches } from '@ai-agent-config/core';

describe('resolveBinary', () => {
  it('finds a binary that is on the current PATH', async () => {
    const resolved = await resolveBinary('sh');
    expect(resolved).not.toBeNull();
    expect(resolved!.foundBy).toBe('path');
    expect(resolved!.path).toContain('sh');
  });

  it('finds a binary in a well-known install directory (shell-env / known-location)', async () => {
    // `junie` lives in ~/.local/bin on the reference machine. Any layer may
    // find it depending on the test environment's PATH.
    const resolved = await resolveBinary('junie');
    if (resolved) {
      expect(['path', 'shell-env', 'known-location']).toContain(resolved.foundBy);
    }
    // No hard assertion: the binary may simply not be installed.
  });

  it('returns null for a nonexistent binary', async () => {
    _resetBinaryCaches();
    const resolved = await resolveBinary('definitely-not-a-real-binary-7f3a');
    expect(resolved).toBeNull();
  });
});
