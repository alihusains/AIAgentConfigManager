/**
 * ThemeToggle — light / dark switch.
 *
 * The first click pins the current system preference explicitly; afterwards
 * the choice is persisted to localStorage and re-applied before first paint
 * (see index.html inline script) so there is never a flash of the wrong theme.
 *
 * Theme state lives at module scope (not just component state) so the global
 * "t" keyboard shortcut in App.tsx can toggle it without rendering its own
 * button; subscribed ThemeToggle instances re-render via themeListeners.
 */
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const THEME_KEY = 'aacm-theme';

function effectiveTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let currentTheme: 'light' | 'dark' = effectiveTheme();
const themeListeners = new Set<() => void>();

export function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  try {
    localStorage.setItem(THEME_KEY, currentTheme);
  } catch {
    /* private mode — theme still applies for this session */
  }
  themeListeners.forEach((notify) => notify());
}

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
    <button
      className="btn-ghost btn-icon btn-sm"
      title={theme === 'dark' ? 'Switch to light theme (t)' : 'Switch to dark theme (t)'}
      aria-label="Toggle theme"
      onClick={toggleTheme}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
