/**
 * OS keychain wrapper — thin, typed facade over `@napi-rs/keyring`.
 *
 * Phase 1 (Secrets) foundation: lets the app store provider API keys in the
 * OS credential store (macOS Keychain, Windows Credential Manager, Linux
 * libsecret/KWallet) instead of plaintext in registry.json.
 *
 * Design rules (see docs/design/phase1-secrets-design.md):
 * - This module NEVER lets a native keychain exception escape to the caller.
 *   Every operation degrades to a typed result: `null` (get), `false`
 *   (isKeychainAvailable / delete), or a `KeychainError` (set). A locked
 *   keychain, a missing native binding on an unsupported platform/arch, or a
 *   headless/CI environment must all degrade gracefully — the tool must not
 *   crash or hang because the keychain is optional at this stage.
 * - The keychain is OPTIONAL. `isKeychainAvailable()` is the capability probe
 *   callers (registry, GUI, CLI, tests) must check first.
 *
 * This module is intentionally isolated: it does not touch registry read/
 * write logic or adapters. Wiring it into the materialization flow is a
 * separate, later task (Phase 1 microtask M048/M049).
 */

import { AsyncEntry } from '@napi-rs/keyring';

/** Fixed credential store namespace for this app (the keyring "service"). */
export const KEYCHAIN_SERVICE = 'ai-agent-config';

/**
 * A keychain entry reference: the fixed app namespace plus the account
 * (e.g. `provider:<providerId>`) that identifies one stored credential.
 *
 * @internal Exported for the planned M048/M049 wiring; not yet consumed
 * outside this module and its tests — remove if that wiring doesn't land.
 */
export interface KeychainEntry {
  /** Fixed namespace for this app. */
  service: string;
  /** The account (reference) stored in registry.json, e.g. `provider:openai-main`. */
  account: string;
}

/**
 * Typed failure for keychain operations. Distinguishes "no entry" from
 * "the keychain itself could not be reached" so callers can react
 * appropriately. The underlying native error is attached as `cause`.
 */
export class KeychainError extends Error {
  /** `no-entry` = entry does not exist; `unavailable` = keychain not reachable. */
  readonly kind: 'no-entry' | 'unavailable';
  readonly cause?: unknown;

  constructor(kind: 'no-entry' | 'unavailable', message: string, cause?: unknown) {
    super(message);
    this.name = 'KeychainError';
    this.kind = kind;
    this.cause = cause;
  }
}

/**
 * Best-effort detection of whether the OS keychain is reachable in this
 * environment. Returns `false` (never throws) when the keychain is
 * unavailable — e.g. headless CI, a locked keychain, an unsupported
 * platform/arch, or a missing native binding.
 *
 * Detection is non-destructive: it reads a sentinel account that is never
 * written, so a "no entry" outcome proves the keychain responded and is
 * available (the entry simply doesn't exist).
 */
export async function isKeychainAvailable(): Promise<boolean> {
  try {
    const sentinel = new AsyncEntry(KEYCHAIN_SERVICE, '__ai-agent-config-availability__');
    // Any outcome (value, no-entry, or error) means the keychain responded.
    // We only care that it did NOT fail to reach the store.
    await sentinel.getPassword();
    return true;
  } catch (err) {
    // A "no entry" error means the keychain answered — it's available.
    if (isNoEntryError(err)) return true;
    // Anything else (locked, no secret service, missing binding, etc.)
    // means the keychain is not usable in this environment.
    return false;
  }
}

/** Store a secret for the given account under the app's fixed namespace. */
export async function setSecret(account: string, value: string): Promise<void> {
  const entry = new AsyncEntry(KEYCHAIN_SERVICE, account);
  try {
    await entry.setPassword(value);
  } catch (err) {
    if (isNoEntryError(err)) {
      // Defensive: not expected on set — setPassword creates the entry. Kept
      // to preserve the typed contract.
      throw new KeychainError('no-entry', `Keychain set failed for account "${account}"`, err);
    }
    throw new KeychainError(
      'unavailable',
      `Could not write to the OS keychain for account "${account}": ${describe(err)}`,
      err
    );
  }
}

/**
 * Retrieve a secret for the given account.
 *
 * Returns `null` when the entry does not exist OR the keychain is
 * unavailable — callers should first check `isKeychainAvailable()` to
 * distinguish the two if needed (a missing entry on an available keychain
 * is the common "no key stored yet" case).
 */
export async function getSecret(account: string): Promise<string | null> {
  const entry = new AsyncEntry(KEYCHAIN_SERVICE, account);
  try {
    const value = await entry.getPassword();
    return value ?? null;
  } catch (err) {
    if (isNoEntryError(err)) return null;
    // Keychain unreachable / locked / unsupported — degrade to null.
    // (Callers that must distinguish "no entry" from "unavailable" should
    // probe `isKeychainAvailable()` first.)
    return null;
  }
}

/**
 * Delete a secret for the given account.
 *
 * Returns `true` on success (including when the entry was already absent),
 * `false` when the keychain is unavailable. Never throws.
 */
export async function deleteSecret(account: string): Promise<boolean> {
  const entry = new AsyncEntry(KEYCHAIN_SERVICE, account);
  try {
    await entry.deleteCredential();
    return true;
  } catch (err) {
    if (isNoEntryError(err)) {
      // Deleting a non-existent entry is not an error.
      return true;
    }
    return false;
  }
}

/**
 * Build a `KeychainEntry` reference for the given account under the app's
 * fixed namespace.
 *
 * @internal Exported for the planned M048/M049 wiring; not yet consumed
 * outside this module and its tests.
 */
export function makeKeychainEntry(account: string): KeychainEntry {
  return { service: KEYCHAIN_SERVICE, account };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Detect the "no entry" error shape from @napi-rs/keyring. The native
 * binding surfaces it as an error whose message references "NoEntry", or as
 * a null/undefined result. We match on both the error message and any
 * `code`/`name` the binding may attach.
 *
 * NOTE: pinned to @napi-rs/keyring 1.3.0 — the error shape matched here
 * (message/name/code containing "NoEntry"/"no entry") is validated by the
 * regression tests in keychain.test.ts. If the binding version is bumped,
 * re-verify the error shape against the new release.
 */
export function isNoEntryError(err: unknown): boolean {
  if (err == null) return true;
  if (typeof err === 'string') return /no entry|NoEntry|no credential/i.test(err);
  if (typeof err === 'object') {
    const e = err as { name?: string; code?: string; message?: string };
    if (typeof e.code === 'string' && /no.?entry/i.test(e.code)) return true;
    if (typeof e.name === 'string' && /no.?entry/i.test(e.name)) return true;
    if (typeof e.message === 'string' && /no entry|NoEntry|no credential/i.test(e.message)) {
      return true;
    }
  }
  return false;
}

/** Human-readable one-line summary of a native error, for messages. */
function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
