#!/usr/bin/env node
/**
 * `npm run dev [folder] [-- --port 5200]`: start the μClient extension dev server on this extension,
 * or on one of the examples (`npm run dev examples/gmcp-room`).
 *
 * The server is `scripts/dev-server.mjs`, a copy of `@muclient/dev` from the μClient repo
 * (clients/extensions/dev/serve.mjs). It rebuilds `src/` on every save and pushes a hot reload to
 * μClient over Server-Sent Events. Set MUCLIENT_DEV to a path to use another copy.
 *
 * In μClient: Extensions → Developer → "load from dev server" with http://localhost:5199/, or open
 * μClient with ?ext-dev=http://localhost:5199/.
 */
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The first bare argument is the folder; `--port N` / `--host H` take their value with them.
const args = process.argv.slice(2);
let folder = '.';
const rest = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--port' || a === '-p' || a === '--host') { rest.push(a, args[++i]); continue; }
  if (a.startsWith('-')) { rest.push(a); continue; }
  if (folder === '.') folder = a; else rest.push(a);
}
const serve = process.env.MUCLIENT_DEV || join(ROOT, 'scripts', 'dev-server.mjs');

const child = spawn(process.execPath, [serve, resolve(ROOT, folder), ...rest], { stdio: 'inherit' });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => child.kill(s));
child.on('exit', (code) => process.exit(code ?? 0));
