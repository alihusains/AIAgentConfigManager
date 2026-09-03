import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// zustand's `persist` middleware accesses localStorage when the store module is
// first imported. Guarantee a working storage even if the environment does not
// provide one at import time, so the harness never fails on persist rehydration.
if (typeof globalThis !== 'undefined' && !globalThis.localStorage) {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key];
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as unknown as Storage;
}

// Mock window.matchMedia for tests (jsdom does not implement it)
// Used by Dashboard.tsx for prefers-reduced-motion detection
if (typeof globalThis !== 'undefined' && typeof globalThis.window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// React Testing Library auto-cleanup is only wired up when globals are on and
// jest-dom hooks are registered; do it explicitly for our non-global vitest.
afterEach(() => {
  cleanup();
});
