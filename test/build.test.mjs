/**
 * Builds the root extension and every example, then checks what μClient will check:
 * the manifest passes the host's rules, and `vue` / `@muclient/*` stay external.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { validateManifest } from '../scripts/manifest.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folders = [ROOT, ...readdirSync(join(ROOT, 'examples'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(ROOT, 'examples', d.name, 'package.json')))
  .map((d) => join(ROOT, 'examples', d.name))];

test('build all', () => {
  const out = execFileSync(process.execPath, ['scripts/build.mjs', '--examples'], { cwd: ROOT, encoding: 'utf8' });
  for (const f of folders) assert.match(out, new RegExp(`${validateManifest(JSON.parse(readFileSync(join(f, 'package.json'), 'utf8'))).id}: manifest ok`));
});

for (const folder of folders) {
  const pkg = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
  test(`${pkg.name}: manifest and bundle`, () => {
    const m = validateManifest(pkg);
    assert.equal(m.entry, 'dist/index.js');
    const js = readFileSync(join(folder, m.entry), 'utf8');
    assert.ok(js.length > 0, 'dist/index.js is empty');
    // Externals: the host's import map resolves these; nothing from them may be bundled.
    for (const ext of ['vue', '@muclient/sdk', '@muclient/ui']) {
      const re = new RegExp(`from\\s*["']${ext.replace('/', '\\/')}["']`);
      if (js.includes(ext)) assert.match(js, re, `${ext} is referenced but not as a bare import`);
    }
    assert.ok(!/defineComponent\s*=\s*function|function\s+defineComponent\s*\(/.test(js), 'Vue was bundled in');
    assert.match(js, /export\s*\{[^}]*as default|export default/, 'no default export');
  });
}

test('typecheck', () => {
  execFileSync('npx', ['tsc', '--noEmit'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
});
