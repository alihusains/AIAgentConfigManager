import type { Config } from 'tailwindcss';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Map to CSS variables for seamless integration
        background: 'var(--bg-primary)',
        foreground: 'var(--text-primary)',
        card: 'var(--bg-secondary)',
        'card-foreground': 'var(--text-primary)',
        primary: {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-primary-hover)',
          text: 'var(--accent-primary-text)',
        },
        secondary: 'var(--text-secondary)',
        muted: 'var(--text-tertiary)',
        'muted-foreground': 'var(--text-tertiary)',
        destructive: 'var(--accent-error)',
        'destructive-foreground': 'var(--accent-error-text)',
        border: 'var(--border-primary)',
        accent: 'var(--accent-primary)',
        success: {
          DEFAULT: 'var(--accent-success)',
          text: 'var(--accent-success-text)',
        },
        warning: {
          DEFAULT: 'var(--accent-warning)',
          text: 'var(--accent-warning-text)',
        },
        info: {
          DEFAULT: 'var(--accent-info)',
          text: 'var(--accent-info-text)',
        },
      },
      spacing: {
        1: 'var(--space-1)',
        2: 'var(--space-2)',
        3: 'var(--space-3)',
        4: 'var(--space-4)',
        5: 'var(--space-5)',
        6: 'var(--space-6)',
        7: 'var(--space-7)',
        8: 'var(--space-8)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        full: 'var(--radius-full)',
      },
      fontSize: {
        xs: 'var(--text-size-xs)',
        sm: 'var(--text-size-sm)',
        base: 'var(--text-size-base)',
        md: 'var(--text-size-md)',
        lg: 'var(--text-size-lg)',
        xl: 'var(--text-size-xl)',
        '2xl': 'var(--text-size-2xl)',
        '3xl': 'var(--text-size-3xl)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
        display: 'var(--font-display)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        elevated: 'var(--shadow-elevated)',
      },
      screens: {
        xs: '320px',
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1536px',
      },
    },
  },
  plugins: [],
} satisfies Config;
