#!/usr/bin/env node
/**
 * μClient extension dev server (R-EXT-DEV, docs/overhaul/08-extensions.md §7, §8a).
 *
 *   npx @muclient/dev [folder] [--port 5199] [--host 127.0.0.1]
 *   node clients/extensions/dev/serve.mjs clients/extensions/ext-roomnotes
 *
 * - Builds `muclient.source` (default `src/index.ts`) of the package in `folder` (default `.`) with
 *   esbuild into its `exports` entry (e.g. `dist/index.js`), the same way the client bundles its
 *   own packages (build/muExtensions.ts): ESM, es2022, `vue` and `@muclient/*` external, inline
 *   source map. It rebuilds whenever a file under the folder changes (node_modules, dist and dot
 *   directories ignored).
 * - Serves the package folder on localhost only, with `Access-Control-Allow-Origin: *`,
 *   `Access-Control-Allow-Private-Network: true` (Chrome's Private Network Access, §8a) and
 *   `Cache-Control: no-store`. Paths outside the folder are refused.
 * - `GET /__mu/events` is the reload channel (Server-Sent Events). On connect: `event: hello`
 *   `{ n }`. After each good build: `event: reload` `{ n, ms, entry }`. After a failed build:
 *   `event: build-error` `{ n, message }` (the client keeps the running build).
 * - `--port 0` picks a free port. The first line printed is `μClient dev server: <url>`.
 *
 * In μClient: Extensions → Developer → "load from dev server", or open μClient with
 * `?ext-dev=http://localhost:5199/`.
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, statSync, watch, mkdirSync, writeFileSync, createReadStream } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const EXTERNAL = ['vue', '@muclient/sdk', '@muclient/ui'];
const TYPES = {
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.map': 'application/json', '.md': 'text/markdown; charset=utf-8', '.ts': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};
const LOCAL = new Set(['127.0.0.1', 'localhost', '::1']);

function parseArgs(argv) {
  const o = { folder: '.', port: 5199, host: '127.0.0.1', quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' || a === '-p') o.port = Number(argv[++i]);
    else if (a.startsWith('--port=')) o.port = Number(a.slice(7));
    else if (a === '--host') o.host = argv[++i];
    else if (a.startsWith('--host=')) o.host = a.slice(7);
    else if (a === '--quiet' || a === '-q') o.quiet = true;
    else if (a === '--help' || a === '-h') o.help = true;
    else if (!a.startsWith('-')) o.folder = a;
  }
  return o;
}

/** esbuild: the package's own, else the one next to this script, else μClient's (clients/web). */
async function loadEsbuild(folder) {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const from of [join(folder, 'package.json'), join(here, 'package.json'), join(here, '../../web/package.json')]) {
    try { const p = createRequire(from).resolve('esbuild'); return await import(pathToFileURL(p).href); } catch { /* next */ }
  }
  throw new Error('esbuild is not installed. Run `npm i -D esbuild` in the extension folder.');
}

function readPkg(folder) {
  const pj = join(folder, 'package.json');
  if (!existsSync(pj)) throw new Error(`${pj} not found: point the dev server at an extension package folder.`);
  const json = JSON.parse(readFileSync(pj, 'utf8'));
  if (!json.muclient) throw new Error(`${pj} has no "muclient" manifest.`);
  if (typeof json.exports !== 'string') throw new Error(`${pj} needs "exports" naming the built entry (e.g. "./dist/index.js").`);
  return { json, entry: String(json.exports).replace(/^\.\//, ''), source: json.muclient.source ?? 'src/index.ts' };
}

/**
 * Start the dev server. Returns `{ url, port, close(), build() }`. Used by the CLI below and by tests.
 */
export async function startDevServer(opts = {}) {
  const folder = resolve(opts.folder ?? '.');
  const host = opts.host ?? '127.0.0.1';
  if (!LOCAL.has(host)) throw new Error(`--host ${host}: the dev server listens on localhost only (127.0.0.1, ::1 or localhost).`);
  const say = opts.quiet ? () => {} : (...a) => console.log(...a);
  const esbuild = await loadEsbuild(folder);
  let pkg = readPkg(folder);
  const clients = new Set();
  let n = 0, last = null;

  const send = (event, data) => {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients) res.write(msg);
  };

  async function build() {
    const t0 = Date.now();
    pkg = readPkg(folder);
    const out = join(folder, pkg.entry);
    try {
      const r = await esbuild.build({
        entryPoints: [join(folder, pkg.source)], bundle: true, format: 'esm', target: 'es2022', write: false,
        external: EXTERNAL, legalComments: 'none', sourcemap: 'inline', logLevel: 'silent', absWorkingDir: folder,
      });
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, r.outputFiles[0].contents);
      n++;
      last = { ok: true, n, ms: Date.now() - t0 };
      say(`[mu-dev] build ${n} ok (${last.ms} ms) → ${relative(folder, out)}`);
      send('reload', { n, ms: last.ms, entry: pkg.entry });
    } catch (e) {
      const message = (e.errors ?? []).map((x) => `${x.location ? `${x.location.file}:${x.location.line}: ` : ''}${x.text}`).join('\n') || String(e.message ?? e);
      last = { ok: false, n, message };
      say(`[mu-dev] build failed:\n${message}`);
      send('build-error', { n, message });
    }
    return last;
  }

  // Rebuild on change, debounced; changes that land during a build trigger one more.
  let timer = null, building = null, again = false;
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (building) { again = true; return; }
      building = build();
      await building; building = null;
      if (again) { again = false; schedule(); }
    }, 40);
  };
  const outRel = () => pkg.entry.split('/')[0];
  const ignored = (f) => !f || f.split(/[\\/]/).some((s) => s === 'node_modules' || s.startsWith('.')) || f === pkg.entry || f.startsWith(outRel() + sep) || f.startsWith(outRel() + '/');
  let watcher = null;

  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; return res.end(); }
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.statusCode = 400; return res.end('bad path'); }
    if (path === '/__mu/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive' });
      res.write(`retry: 1000\nevent: hello\ndata: ${JSON.stringify({ n, name: pkg.json.name, version: pkg.json.version, ok: last?.ok ?? false })}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 15000);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }
    if (path === '/__mu/status') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ n, last, clients: clients.size })); }
    const file = resolve(folder, '.' + (path.endsWith('/') ? path + 'index.html' : path));
    const rel = relative(folder, file);
    if (rel.startsWith('..') || rel.split(sep).some((s) => s === 'node_modules' || (s.startsWith('.') && s !== '.'))) { res.statusCode = 403; return res.end('forbidden'); }
    let st;
    try { st = statSync(file); } catch { res.statusCode = 404; return res.end('not found'); }
    if (!st.isFile()) { res.statusCode = 404; return res.end('not found'); }
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.setHeader('Content-Length', st.size);
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(opts.port ?? 5199, host, ok); });
  const port = server.address().port;
  const url = `http://${host === '::1' ? '[::1]' : host === '127.0.0.1' ? 'localhost' : host}:${port}/`;
  say(`μClient dev server: ${url}`);
  say(`[mu-dev] serving ${folder}; load it in μClient → Extensions → Developer, or open μClient with ?ext-dev=${url}`);
  await build();
  watcher = watch(folder, { recursive: true }, (_ev, f) => { if (!ignored(String(f ?? ''))) schedule(); });
  return {
    url, port, build,
    async close() {
      watcher?.close(); clearTimeout(timer);
      for (const res of clients) res.end();
      clients.clear();
      await new Promise((r) => server.close(() => r()));
    },
  };
}

// CLI
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const o = parseArgs(process.argv.slice(2));
  if (o.help) {
    console.log('usage: muclient-dev [folder] [--port 5199] [--host 127.0.0.1] [--quiet]');
    process.exit(0);
  }
  startDevServer(o).then((s) => {
    const stop = () => { s.close().finally(() => process.exit(0)); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  }).catch((e) => { console.error(`[mu-dev] ${e.message ?? e}`); process.exit(1); });
}
