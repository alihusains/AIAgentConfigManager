#!/usr/bin/env node
/**
 * Package bin entry (`agm`).
 *
 * When the vendored core exists next to the compiled output (standalone npm
 * install), register the ESM loader hooks that re-route `@ai-agent-config/core`
 * and its runtime deps to `vendor/core/` — then hand off to the real CLI in
 * index.js. Inside the monorepo the vendor tree does not exist, so nothing is
 * registered and the workspace symlink resolves as usual.
 */
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const vendoredCore = path.resolve(here, '../vendor/core/package');

if (fs.existsSync(path.join(vendoredCore, 'dist', 'index.js'))) {
  // Node's module-object APIs (register / registerHooks) are not exposed as
  // ESM globals, so reach them through createRequire. The off-thread
  // register() works on the full Node >= 20.0 floor; registerHooks() (Node
  // >= 20.6) is only used when the runtime explicitly opts in via
  // AGM_USE_REGISTER_HOOKS=1, since it is stricter about hook return values
  // and not required for the vendored-core re-routing to work.
  const mod = createRequire(import.meta.url)('module') as {
    register?: (specifier: string, parentURL: string) => void;
    registerHooks?: (hooks: unknown) => void;
  };
  if (process.env.AGM_USE_REGISTER_HOOKS === '1' && typeof mod.registerHooks === 'function') {
    const hooks = await import('./core-shim-hooks.js');
    mod.registerHooks(hooks);
  } else if (typeof mod.register === 'function') {
    mod.register('./core-shim-hooks.js', pathToFileURL(`${here}/`).href);
  }
}

await import('./index.js');
