/**
 * ThemeToggle — light / dark switch.
 *
 * data-theme is ALWAYS resolved (index.html sets it before first paint;
 * this module keeps it in sync). A stored choice is pinned: the OS
 * listener below only updates the attribute while no choice is stored.
 * The choice persists to localStorage and a module-level listener set
 * re-renders subscribed ThemeToggle instances — the global "t" shortcut
 * in App.tsx reuses the same toggleTheme without its own button.
 *
 * Single-source-of-truth contract: CSS keys dark mode solely on
 * html[data-theme="dark"]; there is no prefers-color-scheme CSS copy,
 * so this attribute is the one and only theme switch.
 */
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Tooltip } from '../ui';

const THEME_KEY = 'aacm-theme';

function storedTheme(): 'light' | 'dark' | null {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null; // private mode — OS-follow for this session
  }
}

function effectiveTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let currentTheme: 'light' | 'dark' = effectiveTheme();
const themeListeners = new Set<() => void>();

function applyTheme(theme: 'light' | 'dark') {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  themeListeners.forEach((notify) => notify());
}

export function toggleTheme() {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  try {
    localStorage.setItem(THEME_KEY, currentTheme);
  } catch {
    /* private mode — theme still applies for this session */
  }
}

// OS-follow: while the user has not pinned a choice, OS theme changes
// update the attribute live (and pre-paint script + this listener keep
// it resolved on reload). Registered once at module load.
window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener?.('change', (e) => {
    if (storedTheme() != null) return; // pinned — user choice wins
    applyTheme(e.matches ? 'dark' : 'light');
  });

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(currentTheme);

  useEffect(() => {
    const notify = () => setTheme(currentTheme);
    themeListeners.add(notify);
    return () => {
      themeListeners.delete(notify);
    };
  }, []);

  return (
    <Tooltip content={`${theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} (t)`}>
      <button
        className="btn-ghost btn-icon btn-sm"
        aria-label="Toggle theme"
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </Tooltip>
  );
}
