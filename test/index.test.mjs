/**
 * `npm test`: each extension in a headless μClient host (@runmu.sh/dev/test). No browser, no game: the host runs
 * `activate` against a fake `mu`, the test feeds it GMCP / output (or a .murec recording saved from μClient's
 * protocol inspector: Log → record → save), and asserts on what the extension did: `host.sent`, `host.widgets()`,
 * `host.commands`, `host.panels`, `host.toasts`, its storage and its API.
 *
 * `test/build.test.mjs` checks the built bundles; this file checks behaviour.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = join(ROOT, 'test/fixtures/session.murec');
// $MUCLIENT_DEV_TEST (a path to test.mjs), else the installed @runmu.sh/dev devDependency.
function find() {
  if (process.env.MUCLIENT_DEV_TEST) return process.env.MUCLIENT_DEV_TEST;
  try { return createRequire(join(ROOT, 'package.json')).resolve('@runmu.sh/dev/test'); } catch { /* below */ }
  throw new Error('@runmu.sh/dev/test was not found. Run npm install (it is in the @runmu.sh/dev devDependency).');
}
const { createHost } = await import(pathToFileURL(find()).href);
const example = (name) => join(ROOT, 'examples', name);

test('hello-world: panel, command, setting and API', async () => {
  const host = createHost({ root: ROOT });
  const ext = await host.load('src/index.ts');
  assert.ok(host.panels.has('hello-world'), 'registers its panel');
  assert.ok(host.commands.has('hello-world.open'), 'registers its command');
  assert.equal(host.setting('name'), 'world', 'the setting has its default');
  assert.equal(ext.api.greeting(), 'Hello, world!');
  host.mu.settings.set('name', 'Ada');
  assert.equal(ext.api.greeting(), 'Hello, Ada!');
  assert.deepEqual(host.sends('command'), [], 'sends nothing until the player clicks');
  assert.equal(host.errors.length, 0, 'no handler threw');
  await host.unload();
  assert.deepEqual(host.live(), [], 'everything registered through mu is disposed');
});

test('gmcp-room: counts visits from a recorded session, per world', async () => {
  const host = createHost({ root: example('gmcp-room') });
  await host.load('src/index.ts');
  assert.equal(await host.play(FIXTURE), 4);
  host.gmcp('Room.Info', { num: 1, name: 'A narrow cellar', area: 'Undercroft' }); // back south
  const visits = host.mu.storage.world('w1').get('visits');
  assert.deepEqual(visits, {
    1: { name: 'A narrow cellar', area: 'Undercroft', n: 2 },
    2: { name: 'The well room', area: 'Undercroft', n: 1 },
  });
  assert.deepEqual(host.calls.filter((c) => c.path === 'gmcp.supports'), [], 'Room 1 comes from contributes.gmcp, not a runtime supports');

  await host.commands.get('example-gmcp-room.clear').run(); // the test host's confirm says yes
  assert.equal(host.mu.storage.world('w1').get('visits'), undefined);
  assert.equal(host.toasts.length, 1);
  assert.equal(host.errors.length, 0);
  await host.unload();
  assert.deepEqual(host.live(), []);
});

test('line-trigger: highlights and counts per session, gags, and forgets a closed session', async () => {
  const host = createHost({ root: example('line-trigger'), settings: { gag: '^\\[ooc\\]' } });
  const ext = await host.load('src/index.ts');

  const hit = host.line('Ada tells you, "hello"');
  assert.deepEqual(hit.calls.map((c) => c.path), ['highlight', 'rowClass']);
  assert.deepEqual(hit.calls[1].args, ['ext-example-line-trigger-hit']);
  assert.equal(ext.api.hits('s1'), 1);
  assert.match(host.widget('example-line-trigger.count').body, /^1 line matched/);

  assert.equal(host.line('[ooc] lag again').gagged, true);
  assert.equal(host.line('A rat squeaks.').calls.length, 0);

  host.open({ id: 's2', worldId: 'w2' });
  host.line('s2', 'Bo tells you, "hi"');
  assert.equal(ext.api.hits('s2'), 1);
  assert.equal(ext.api.hits('s1'), 1, 'counts are per session');
  host.close('s2');
  assert.equal(ext.api.hits('s2'), 0, 'a closed session leaves nothing behind');

  assert.equal(host.errors.length, 0);
  await host.unload();
  assert.deepEqual(host.live(), []);
});

test('vue-panel: registers its panel and command', async () => {
  const host = createHost({ root: example('vue-panel') });
  await host.load('src/index.ts');
  assert.ok(host.panels.has('example-vue-panel'));
  assert.ok(host.commands.has('example-vue-panel.open'));
  host.commands.get('example-vue-panel.open').run();
  assert.deepEqual(host.calls.find((c) => c.path === 'panels.open')?.args[0], 'example-vue-panel');
  assert.equal(host.errors.length, 0);
  await host.unload();
  assert.deepEqual(host.live(), []);
});
