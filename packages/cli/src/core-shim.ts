/**
 * Core import shim.
 *
 * Inside this monorepo, `@ai-agent-config/core` resolves to the workspace
 * symlink. After a standalone `npm install agentcontrol` there is no
 * workspace — the compiled core ships inside the tarball at
 * `vendor/core/package`, and its runtime dependencies at
 * `vendor/core/node_modules`.
 *
 * Resolution of that vendored copy is handled by the ESM loader hooks in
 * `core-shim-hooks.ts`, registered by `bundle-entry.ts` (the package's `bin`)
 * before this module's core import is evaluated. This file is a plain
 * re-export so index.ts / gui-server.ts compile against the workspace types
 * in the monorepo and resolve to the vendored copy at runtime when installed
 * standalone.
 */

export * from '@ai-agent-config/core';
