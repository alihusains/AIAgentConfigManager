/**
 * ThemeToggle — light / dark switch.
 *
 * The first click pins the current system preference explicitly; afterwards
 * the choice is persisted to localStorage and re-applied before first paint
 * (see index.html inline script) so there is never a flash of the wrong theme.
 */
import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const THEME_KEY = 'aacm-theme';

function effectiveTheme(): 'light' | 'dark' {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(effectiveTheme);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* private mode — theme still applies for this session */
    }
  };

  return (
    <button
      className="btn-ghost btn-icon btn-sm"
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label="Toggle theme"
      onClick={toggle}
    >
      {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}