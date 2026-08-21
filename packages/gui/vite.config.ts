import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The GUI is a pure API client served by the CLI (`ai-config gui`), which also
// authenticates every request with a per-launch token. When iterating on the UI
// with `pnpm dev`, point the /api proxy at a running dashboard:
//
//   1. terminal A:  pnpm ai-config gui --no-open          (note the port, e.g. 3xxxx)
//   2. terminal B:  AI_CONFIG_GUI_API=http://127.0.0.1:3xxxx pnpm dev
//
// The dev page then loads from vite while /api calls reach the CLI. Open
// http://localhost:5173/?t=<token from the CLI's printed URL> once — the token
// is cached in localStorage for the rest of the session.

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    minify: 'esbuild',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.AI_CONFIG_GUI_API || 'http://127.0.0.1:30000',
        changeOrigin: true,
      },
    },
  },
  envPrefix: ['VITE_'],
  // NOTE: the GUI must never import core *code* — only `import type` from
  // '@ai-agent-config/core' (erased at compile time, resolved against the
  // built core package for type-checking).
});