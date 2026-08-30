#!/usr/bin/env node
/**
 * Prepack step — make the CLI package standalone-publishable.
 *
 * The monorepo keeps `@ai-agent-config/core` and the built GUI workspace-local.
 * A standalone `npm install agentcontrol` (or `npx agentcontrol`) has no access
 * to this repo's folder layout, so at pack time we vendor both into the package:
 *
 *   vendor/core/       compiled core (dist/**) + its runtime dependencies,
 *                      resolved via `npm pack` from the local workspace copy
 *   vendor/gui-dist/   the built GUI (packages/gui/dist), served by `agm start`
 *
 * `resolveDistDir()` in src/gui-server.ts prefers the bundled
 * `vendor/gui-dist` over the monorepo-relative path, so the same source tree
 * works both inside this repo and after a standalone install.
 *
 * The vendored tree is gitignored and only exists in the packed tarball.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cliDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.resolve(cliDir, '../..');
const vendorDir = path.join(cliDir, 'vendor');

function fail(message) {
  console.error(`prepare-pack: ${message}`);
  process.exit(1);
}

function readPkgJson(file, context) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`cannot read/parse ${context} (${file}): ${error.message}`);
  }
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  // Follow symlinks: pnpm lays node_modules out as a symlink farm, and the
  // vendored copy must be a real, self-contained tree inside the tarball.
  fs.cpSync(from, to, { recursive: true, dereference: true });
}

// Resolve a module the same way Node would from `fromDir`: walk up looking
// for node_modules/<name>. pnpm additionally keeps the real package under
// node_modules/.pnpm/<name>@<version>/node_modules/<name>, so fall back to
// that layout. Returns the directory, or null when not installed.
function resolveModule(name, fromDir) {
  let dir = fromDir;
  for (;;) {
    const candidate = path.join(dir, 'node_modules', ...name.split('/'));
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    // pnpm store layout: .pnpm/<flatname>@<version>/node_modules/<name>
    const pnpmDir = path.join(dir, 'node_modules/.pnpm');
    if (fs.existsSync(pnpmDir)) {
      const flat = name.replace('/', '+');
      const matches = fs
        .readdirSync(pnpmDir)
        .filter((d) => d.startsWith(`${flat}@`) && d.endsWith('/node_modules'));
      if (matches.length > 0) {
        const candidate = path.join(pnpmDir, matches[0], 'node_modules', ...name.split('/'));
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
          return candidate;
        }
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ---------------------------------------------------------------------------
// 1. Vendor compiled core: `npm pack` the local workspace package, then
//    unpack into vendor/core. `npm pack <dir>` packs it exactly as the npm
//    registry would serve it (respecting its package.json defaults/files),
//    so the result is byte-identical to a registry install of the same code.
// ---------------------------------------------------------------------------
const coreDir = path.join(repoRoot, 'packages/core');
const coreDist = path.join(coreDir, 'dist');
if (!fs.existsSync(path.join(coreDist, 'index.js'))) {
  fail('packages/core/dist is missing — run "pnpm build" first.');
}
const corePkg = readPkgJson(path.join(coreDir, 'package.json'), 'packages/core/package.json');

cleanDir(vendorDir);
const coreVendor = path.join(vendorDir, 'core');
fs.mkdirSync(coreVendor, { recursive: true });
execFileSync('npm', ['pack', coreDir, '--pack-destination', coreVendor], { encoding: 'utf8' });

const tgz = fs.readdirSync(coreVendor).find((f) => f.endsWith('.tgz'));
if (!tgz) {
  fail('could not find the core tarball produced by npm pack.');
}
fs.mkdirSync(path.join(coreVendor, 'pkg'), { recursive: true });
execFileSync('tar', ['-xzf', path.join(coreVendor, tgz), '-C', path.join(coreVendor, 'pkg')], {
  stdio: 'ignore',
});
fs.rmSync(path.join(coreVendor, tgz), { force: true });

// The tarball extracts into a single "package/" root.
const extracted = path.join(coreVendor, 'pkg/package');
if (!fs.existsSync(path.join(extracted, 'dist/index.js'))) {
  fail('core tarball did not contain dist/index.js.');
}
fs.renameSync(extracted, path.join(coreVendor, 'package'));
fs.rmSync(path.join(coreVendor, 'pkg'), { recursive: true, force: true });

// ---------------------------------------------------------------------------
// 2. Vendor core's runtime dependencies (js-yaml, toml, zod, @napi-rs/keyring
//    + its per-platform .node binaries).
// ---------------------------------------------------------------------------
const coreDeps = Object.keys(corePkg.dependencies || {});
const vendoredDeps = [];
for (const dep of coreDeps) {
  const resolved = resolveModule(dep, coreDir);
  if (!resolved) {
    fail(`cannot resolve core dependency "${dep}" — is node_modules installed?`);
  }
  const target = path.join(vendorDir, 'core/node_modules', dep);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  copyDir(resolved, target);
  vendoredDeps.push(dep);

  // @napi-rs packages ship per-platform binaries as optionalDependencies
  // (e.g. @napi-rs/keyring-darwin-arm64). pnpm nests the installed ones
  // inside the parent's .pnpm/<name>@<ver>/node_modules/<scope>/, so look
  // there first; vendor only the ones present on this OS.
  const depPkg = readPkgJson(path.join(resolved, 'package.json'), `dependency ${dep}`);
  for (const opt of Object.keys(depPkg.optionalDependencies || {})) {
    let optResolved = resolveModule(opt, coreDir);
    if (!optResolved) {
      const pnpmDir = path.join(repoRoot, 'node_modules/.pnpm');
      const flat = dep.replace('/', '+');
      const base = path.join(pnpmDir, `${flat}@${depPkg.version}`, 'node_modules');
      if (fs.existsSync(base)) {
        const candidate = path.join(base, ...opt.split('/'));
        if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
          optResolved = candidate;
        }
      }
    }
    if (!optResolved) continue; // platform-specific; not installed here
    const optTarget = path.join(vendorDir, 'core/node_modules', opt);
    fs.mkdirSync(path.dirname(optTarget), { recursive: true });
    copyDir(optResolved, optTarget);
    vendoredDeps.push(opt);
  }
}

// ---------------------------------------------------------------------------
// 3. Vendor the built GUI (served by `agm start` / `agm gui`).
// ---------------------------------------------------------------------------
const guiDist = path.join(repoRoot, 'packages/gui/dist');
if (!fs.existsSync(path.join(guiDist, 'index.html'))) {
  fail('packages/gui/dist is missing — run "pnpm build" first.');
}
copyDir(guiDist, path.join(vendorDir, 'gui-dist'));

console.log(
  `prepare-pack: vendored core ${corePkg.version} (${vendoredDeps.join(', ')}) + gui dist`
);
