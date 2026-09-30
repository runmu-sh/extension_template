#!/usr/bin/env node
/**
 * Build an extension the way μClient bundles its own: esbuild, ESM, es2022, with `vue`, `@muclient/sdk`
 * and `@muclient/ui` left external (the host's import map supplies them at runtime), everything else
 * bundled into the file named by `exports`. Then check the `muclient` manifest with the host's rules.
 *
 *   node scripts/build.mjs                  build this extension: src/index.ts → dist/index.js
 *   node scripts/build.mjs --check          check package.json only
 *   node scripts/build.mjs --sourcemap      inline source map
 *   node scripts/build.mjs --examples       build every folder in examples/ as well
 *   node scripts/build.mjs examples/gmcp-room   build one folder
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest } from './manifest.mjs';

export const EXTERNAL = ['vue', '@muclient/sdk', '@muclient/ui'];
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const folders = args.filter((a) => !a.startsWith('--')).map((a) => resolve(ROOT, a));

if (!folders.length) folders.push(ROOT);
if (flags.has('--examples')) {
  const ex = join(ROOT, 'examples');
  for (const d of readdirSync(ex, { withFileTypes: true })) {
    if (d.isDirectory() && existsSync(join(ex, d.name, 'package.json'))) folders.push(join(ex, d.name));
  }
}

export async function buildOne(folder, { check = false, sourcemap = false } = {}) {
  const pkg = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
  const m = validateManifest(pkg); // throws with the host's message
  if (!check) {
    const { build } = await import('esbuild');
    const t0 = Date.now();
    const r = await build({
      entryPoints: [join(folder, m.source)], bundle: true, format: 'esm', target: 'es2022', write: false,
      external: EXTERNAL, legalComments: 'none', sourcemap: sourcemap ? 'inline' : false,
      logLevel: 'warning', absWorkingDir: folder,
    });
    const out = join(folder, m.entry);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, r.outputFiles[0].contents);
    console.log(`${m.id}: built ${m.entry} (${r.outputFiles[0].contents.length} bytes, ${Date.now() - t0} ms)`);
  }
  for (const [p, h] of Object.entries(m.wasm ?? {})) {
    if (!existsSync(join(folder, p))) console.warn(`${m.id}: ${p} is listed in muclient.wasm but not built yet`);
    else if (!h) console.warn(`${m.id}: ${p} has no sha256 in muclient.wasm`);
  }
  console.log(`${m.id}: manifest ok (${m.name} ${m.version}, api ${m.api})`);
  return m;
}

let failed = false;
for (const folder of folders) {
  try {
    await buildOne(folder, { check: flags.has('--check'), sourcemap: flags.has('--sourcemap') });
  } catch (e) {
    failed = true;
    console.error(`${folder}: ${e.message ?? e}`);
  }
}
if (failed) process.exit(1);
