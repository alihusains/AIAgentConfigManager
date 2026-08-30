/**
 * ESM loader hooks for standalone installs (active only when the vendored core
 * exists next to the compiled output — i.e. inside a packed tarball).
 *
 * `bundle-entry.ts` registers this file as a module customization hook via
 * `module.register()`. The hooks run on the loader thread, so they must be
 * side-effect-free and self-contained.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const vendor = path.resolve(here, '../vendor/core/package');
const vendorNm = path.resolve(here, '../vendor/core/node_modules');
const coreEntry = pathToFileURL(path.join(vendor, 'dist', 'index.js')).href;

export async function resolve(
  specifier: string,
  context: unknown,
  nextResolve: (specifier: string, context: unknown) => Promise<{ url: string }>
): Promise<{ url: string; shortCircuit: true } | { url: string }> {
  if (
    fs.existsSync(path.join(vendor, 'dist', 'index.js')) &&
    specifier.startsWith('@ai-agent-config/core')
  ) {
    if (
      specifier === '@ai-agent-config/core' ||
      specifier === '@ai-agent-config/core/dist/index.js'
    ) {
      return { url: coreEntry, shortCircuit: true };
    }
    if (specifier === '@ai-agent-config/core/package.json') {
      return {
        url: pathToFileURL(path.join(vendor, 'package.json')).href,
        shortCircuit: true,
      };
    }
    const sub = specifier.slice('@ai-agent-config/core/'.length);
    return { url: pathToFileURL(path.join(vendor, 'dist', sub)).href, shortCircuit: true };
  }
  if (
    fs.existsSync(vendorNm) &&
    !specifier.startsWith('.') &&
    !specifier.startsWith('node:') &&
    !specifier.startsWith('file:')
  ) {
    const hit = resolveVendoredDep(specifier, vendorNm);
    if (hit) return { url: hit, shortCircuit: true };
  }
  const resolved = await nextResolve(specifier, context);
  const url = (resolved as { url?: string }).url;
  return url ? { url } : { url: specifier };
}

export async function load(
  url: string,
  context: Record<string, unknown>,
  nextLoad: (url: string, context: Record<string, unknown>) => Promise<unknown>
): Promise<unknown> {
  // The vendored core ships as CJS ("use strict" compiled output). Loading it
  // as CJS lets Node use the CommonJS wrapper, which resolves its own
  // require() calls from the vendored node_modules without extra hooks.
  if (url.startsWith(pathToFileURL(path.join(vendor, 'dist')).href)) {
    return nextLoad(url, { ...context, format: 'commonjs' });
  }
  return nextLoad(url, context);
}

function resolveVendoredDep(spec: string, nmDir: string): string | null {
  const parts = spec.split('/');
  const isScoped = spec.startsWith('@');
  const root = isScoped ? `${parts[0]}/${parts[1]}` : parts[0];
  const sub = isScoped ? parts.slice(2) : parts.slice(1);
  const dir = path.join(nmDir, root);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  if (sub.length === 0) {
    let pkg: { main?: unknown };
    try {
      pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    } catch {
      return null;
    }
    const main = typeof pkg.main === 'string' ? pkg.main : 'index.js';
    const entry = path.join(dir, main);
    return fs.existsSync(entry) ? pathToFileURL(entry).href : null;
  }
  const entry = path.join(dir, ...sub);
  if (!fs.existsSync(entry)) return null;
  return pathToFileURL(entry.endsWith('.js') ? entry : `${entry}.js`).href;
}
