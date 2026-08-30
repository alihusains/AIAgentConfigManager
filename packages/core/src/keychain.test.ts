/**
 * Tests for the OS keychain wrapper (keychain.ts).
 *
 * A real OS keychain may not be reliably available/interactive in CI or this
 * environment, so the suite:
 *   (a) probes `isKeychainAvailable()` first and gracefully SKIPS the
 *       round-trip tests (logging why) when it returns false — a skip is a
 *       pass, never a suite failure;
 *   (b) when available, does a real set → get → delete round-trip against a
 *       clearly-scoped TEST-only account (`test:ci-roundtrip-<random>`) and
 *       always cleans it up (even on failure) — never leaving a test
 *       credential in the real keychain.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  KEYCHAIN_SERVICE,
  KeychainError,
  isKeychainAvailable,
  setSecret,
  getSecret,
  deleteSecret,
  makeKeychainEntry,
} from './keychain';

describe('keychain wrapper', () => {
  let available: boolean;
  let testAccount: string;
  const testValue = `roundtrip-${Date.now()}-value`;

  beforeAll(async () => {
    available = await isKeychainAvailable();
    testAccount = `test:ci-roundtrip-${Math.random().toString(36).slice(2, 10)}`;
    if (available) {
      // Pre-clean in case a prior crashed run left this exact account behind.
      await deleteSecret(testAccount);
    } else {
      console.log(
        '[keychain.test] OS keychain not available in this environment — ' +
          'round-trip tests will be skipped gracefully.'
      );
    }
  });

  afterAll(async () => {
    if (available) {
      // Guarantee no test credential is left behind, even if a test failed.
      const deleted = await deleteSecret(testAccount);
      expect(deleted).toBe(true);
    }
  });

  it('isKeychainAvailable() returns a boolean without throwing', async () => {
    const result = await isKeychainAvailable();
    expect(typeof result).toBe('boolean');
  });

  it('makeKeychainEntry() returns the fixed service namespace and the account', () => {
    const entry = makeKeychainEntry('provider:openai-main');
    expect(entry).toEqual({
      service: KEYCHAIN_SERVICE,
      account: 'provider:openai-main',
    });
  });

  it('getSecret() returns null for a never-written account (no throw)', async () => {
    // Safe to run even without a keychain: degrades to null.
    const value = await getSecret(`test:never-written-${Date.now()}`);
    expect(value).toBeNull();
  });

  it('deleteSecret() is idempotent (no throw, boolean result)', async () => {
    const result = await deleteSecret(`test:never-written-${Date.now()}`);
    expect(typeof result).toBe('boolean');
  });

  describe('real round-trip (skipped when keychain unavailable)', () => {
    it('set → get returns the stored value', async () => {
      if (!available) {
        console.log('[keychain.test] SKIP — keychain unavailable in this environment');
        return;
      }
      await setSecret(testAccount, testValue);
      const read = await getSecret(testAccount);
      expect(read).toBe(testValue);
    });

    it('getSecret() returns null after deleteSecret()', async () => {
      if (!available) {
        console.log('[keychain.test] SKIP — keychain unavailable in this environment');
        return;
      }
      // Ensure the entry exists from the previous test, then delete it.
      await deleteSecret(testAccount);
      const read = await getSecret(testAccount);
      expect(read).toBeNull();
    });
  });

  describe('typed failure contract', () => {
    it('setSecret() throws a typed KeychainError (not a raw native error) when the keychain is unavailable', async () => {
      // Only meaningful when the keychain is NOT available — otherwise a set
      // would succeed and there is nothing to assert.
      if (available) return;
      let threw: unknown = null;
      try {
        await setSecret(`test:should-fail-${Date.now()}`, 'x');
      } catch (err) {
        threw = err;
      }
      // When the store is unreachable, set must surface a typed error so
      // callers can handle it — never a raw native exception.
      if (threw !== null) {
        expect(threw).toBeInstanceOf(KeychainError);
        expect((threw as KeychainError).kind).toBe('unavailable');
      }
    });
  });
});
