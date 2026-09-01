/**
 * Path safety for custom-agent config paths.
 *
 * Custom agents carry an ABSOLUTE path the user (or an imported registry)
 * claims their config file lives at. Before anything writes to that path we
 * must be confident it is a real local path — importing a registry from
 * another machine can carry Windows-style paths (`C:\Users\...`) into a
 * macOS/Linux checkout, and unvalidated writes would then create literal
 * `C:\Users\...` files in the current working directory.
 */

const WINDOWS_DRIVE_RE = /^[A-Za-z]:[\\/]/;

/**
 * True when the path is a plausible absolute path for the current platform:
 * - POSIX (darwin/linux): absolute POSIX path, or a Windows drive path
 *   (`C:\...` / `C:/...`) on Windows.
 * - Windows: Windows drive path, or an absolute POSIX path (WSL-style,
 *   rare but legal).
 *
 * Relative paths, `~`-prefixed paths, and foreign-OS drive paths are all
 * rejected — the config manager never writes outside what the user typed.
 */
export function isSafeConfigPath(p: string, platform?: string): boolean {
  if (typeof p !== 'string' || p.length === 0) return false;
  const isWindows = (platform ?? process.platform) === 'win32';
  const isWinDrive = WINDOWS_DRIVE_RE.test(p);
  const isPosixAbs = p.startsWith('/');
  if (isWindows) return isWinDrive || isPosixAbs;
  return isPosixAbs; // POSIX host: drive paths are foreign
}
