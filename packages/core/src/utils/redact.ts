/**
 * Key redaction utilities — mask sensitive values for display purposes.
 *
 * Used to prevent accidental leakage of API keys, tokens, and secrets in:
 * - CLI output (user-facing tables, logs)
 * - GUI (verification curl commands, network responses)
 * - Toast messages and error messages
 *
 * The masking strategy shows first 3 characters and last 4 characters of a key,
 * joined by '…' for readability: `sk-a3…9z12`
 *
 * This is NOT encryption or hashing — it provides visual security to prevent
 * accidental screenshot/log sharing, but should never be relied on for true
 * security. The full key is never persisted in logs or history.
 */

/**
 * Mask a secret value for display purposes (e.g. curl commands, error messages).
 *
 * Returns:
 *   - '<no-key>'       when the input is falsy
 *   - '•••••••'        when the input is <= 8 characters
 *   - 'sk-a3…9z12'     when the input is > 8 characters (first 3 + last 4)
 *
 * @param value The secret value to mask
 * @param minLength Show at least this many characters (default 3 + 4 = 7 visible)
 */
export function maskKey(value?: string | null, minLength: number = 0): string {
  if (!value) return '<no-key>';
  const len = value.length;
  if (len <= 8 + minLength) return '•••••••';
  // Show first 3, last 4: "sk-a3…9z12" (total: 3 + 1 + 4 = 8 visible)
  return `${value.slice(0, 3)}…${value.slice(-4)}`;
}

/**
 * Mask a secret value but preserve the prefix type for debugging.
 * Example: "sk-abc123def456" becomes "sk-…456"
 *
 * Useful when you want to preserve type information (e.g., "sk-" for OpenAI,
 * "pk-" for other systems) while hiding the bulk of the key.
 *
 * @param value The secret value to mask
 * @param prefixChars Number of prefix characters to preserve (including delimiter)
 */
export function maskKeyWithPrefix(value?: string | null, prefixChars: number = 4): string {
  if (!value) return '<no-key>';
  if (value.length <= prefixChars + 4) return '•••••••';
  // Keep prefix, show ellipsis, show last 4
  return `${value.slice(0, prefixChars)}…${value.slice(-4)}`;
}

/**
 * Check if a string looks like a secret (API key, token, etc).
 * Used to automatically mask environment variables and config values.
 *
 * Heuristic: contains "key", "token", "secret", "password", "auth" in the name.
 */
export function looksLikeSecret(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('key') ||
    lower.includes('token') ||
    lower.includes('secret') ||
    lower.includes('password') ||
    lower.includes('auth') ||
    lower.includes('credential') ||
    lower.includes('api_key') ||
    lower.includes('apikey')
  );
}
