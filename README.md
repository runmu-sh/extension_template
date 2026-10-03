# μClient extension template

A starting point for a [μClient](https://runmu.sh) extension. It builds a **Hello world** panel and
comes with three examples that each show one part of the SDK. Use the green **Use this template**
button on GitHub, or clone it, and you have a project that builds, type-checks and hot-reloads into
the client.

```sh
npm create @runmu.sh/extension my-ext    # the scaffolder: asks for an id, a name, Vue or DOM, WASM
# or: git clone https://github.com/runmu-sh/extension_template my-ext
cd my-ext
npm install
npm run dev
```

`npm create @runmu.sh/extension` writes a fresh project with your id and names filled in. This
template is the same thing with three worked examples; the guide is
[runmu.sh/docs/extensions/quickstart](https://runmu.sh/docs/extensions/quickstart).

Then in μClient: **☰ → Extensions → Advanced → Developer → load from dev server**, with `http://localhost:5199/`.
The Hello world panel appears under Views. Edit `src/panel.ts`, save, and the panel updates in place.

## What is in here

| Path | What |
|---|---|
| `package.json` | The `muclient` manifest: id, API range, what the extension contributes. See [The manifest](#the-manifest). |
| `src/index.ts` | `defineExtension({ activate })`: registers the panel, a palette command and a setting. |
| `src/panel.ts` | The panel in plain DOM, styled with `mu.ui.css` classes and theme tokens. |
| `examples/vue-panel/` | The same panel as a Vue component (`mu.panels.vue`), with a per-session count in `mu.storage.session`. |
| `examples/gmcp-room/` | GMCP `Room.Info` (declared in the manifest) → per-world storage → a table of visited rooms; `gmcp.watch`; `ui.confirm`. |
| `examples/line-trigger/` | Phased line stages (`highlight` with theme tokens, `route` to gag), per-session state in `sessions.each`, a HUD widget, and the Lua `ext.emit` bridge. |
| `scripts/build.mjs` | esbuild → `dist/index.js`, then the manifest check. |
| `scripts/dev.mjs` | Starts the dev server (`@runmu.sh/dev`): rebuild on save, serve on localhost, push reloads over SSE. |
| `scripts/manifest.mjs` | The manifest rules μClient applies at install, so the build fails where the install would. |
| `test/index.test.mjs` | `npm test`: each extension in the headless host `@runmu.sh/dev/test`, fed GMCP, lines and a recording. |
| `test/fixtures/session.murec` | A recorded session (μClient's protocol inspector: Log → record → save .murec). |
| `test/build.test.mjs` | Builds everything, checks the manifests and bundles, typechecks. |
| `.github/workflows/ci.yml` | `npm ci`, build, typecheck and `npm test` on every push and pull request. |

## Commands

```sh
npm run dev                       # dev server for src/ on http://localhost:5199/
npm run dev examples/gmcp-room    # dev server for an example (add -- --port 5200 for a second one)
npm run build                     # src/index.ts → dist/index.js + manifest check
npm run build:examples            # the root and every example
npm run typecheck                 # tsc --noEmit against the SDK types
npm run check                     # the manifest only, with μClient's rules
npm test                          # headless host tests, then build all, check manifests and externals, typecheck
```

## Creating a new extension

### 1. Name it

Edit `package.json`:

```jsonc
{
  "name": "ext-my-thing",          // npm-style name; the id below defaults to it without "ext-"
  "version": "0.1.0",
  "description": "One sentence for the marketplace card.",
  "exports": "./dist/index.js",    // the built entry; μClient loads this file
  "muclient": {
    "id": "my-thing",              // [a-z0-9][a-z0-9._-]{0,63}; prefix for panel and command ids
    "api": "^1.14",                // a semver range of the SDK you need; μClient refuses one it cannot satisfy
    "source": "src/index.ts",      // what the dev server and build compile
    "displayName": "My thing",
    "description": "Shown in the install prompt and the Extensions list.",
    "categories": ["interface"],   // up to 3 of: mapping combat communication automation interface themes sound accessibility logging developer games other
    "contributes": {
      "panels": [{ "id": "my-thing", "title": "My thing" }],
      "commands": [{ "id": "my-thing.open", "title": "My thing: open" }],
      "gmcp": ["Room 1"]           // packages μClient asks the game for while you are enabled (before activation too)
    },
    "capabilities": ["read-output", "send-commands"]
  }
}
```

`capabilities` are shown to the player at install. They are checked softly: `sessions.send`, `gmcp.send`
and `actions.run` need `send-commands`, `lines.stage` and `sessions.on('line')` need `read-output`,
`net.fetch` needs `network`, `files.*` needs `files`, `sessions.all()` needs `all-sessions`. An undeclared one
still works, but it warns once in the extension log and the Installed card shows "uses undeclared: …".
Other `contributes` keys the examples use: `linePhases` (stages that change game text, shown at install) and
`storage` (the keys you keep per tier, listed in the uninstall prompt and the backup).

`npm run check` validates the manifest with the same rules μClient uses.

### 2. Write `activate`

```ts
import { defineExtension, type Mu } from '@muclient/sdk';

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;
    mu.panels.register({ id: 'my-thing', title: 'My thing', mount(el) { el.textContent = 'hi'; } });
    mu.commands.register({ id: 'my-thing.open', title: 'My thing: open', run: () => mu.panels.open('my-thing') });
    return { /* your public API, reachable by other extensions via ctx.api('my-thing') */ };
  },
  deactivate() { /* optional */ },
});
```

Every `mu.*.register`, `.on`, `.stage`, `.define`, `.watch`, `.style`, `.show` returns a disposable and
μClient tracks it. When the player disables, removes or hot-reloads your extension, all of it is torn
down. The one thing you have to hand over yourself is anything created outside `mu` (a `setInterval`,
a `WebSocket`): push a cleanup into `ctx.subscriptions`.

### 3. Draw the panel

`mount(el, { sid, worldId, params })` gets an empty element and a session id. Draw with plain DOM,
Vue (`mu.panels.vue(Component)`; see `examples/vue-panel`), or canvas. Return a function that
undoes what you did.

Take class names from `mu.ui.css` (`btn`, `tool`, `chip`, `inp`, `secHead`, `empty`, `framed`,
`badge`, `lamp`, `glow`, `cmd`, `toggle`, `plate`, `count`, `field`, `row`, `label`, and since 1.12
`secClose`, `hlLine`, `onoff`, `placeholder`, `warn`, `dim`, `gold`, `ok`, …) and colours from
theme variables (`var(--accent)`, `var(--t-body)`). Literal colours break the moment a player switches
theme; line styles (`SpanStyle`) take theme tokens only (`{ fg: 'accent' }`). `mu.ui.style(css)` injects a
stylesheet scoped to your extension's lifetime.

Do not build your own dialogs and menus: `await mu.ui.confirm({ title, danger: true })`, `prompt`, `pick` and
`modal` are the host's dialog, and `mu.menus.add` / `mu.menus.context` put rows in the ☰, world, tab and
terminal menus. A Vue panel can use the components of `@muclient/ui` (external, like `vue`).

For hot reload, add `snapshot(el)` and `restore(el, saved)` to the panel spec: `snapshot` runs on the
old build just before it unmounts, `restore` on the new one right after `mount`. Return a JSON-like
value (a draft string, a scroll position).

### 4. Talk to the game

| Want | Call |
|---|---|
| Send a command as if typed | `mu.sessions.send('look', sid)` |
| Print a local line | `mu.sessions.echo('[me] hi', sid)` |
| Every line the game sends | `mu.sessions.on('line', (line, { sid }) => …)` |
| Style, gag or annotate lines | `mu.lines.stage({ id, phase: 'highlight', run(line, ctx) { line.highlight(/x/, { fg: 'gold' }) } })` |
| Send and read the answer, hidden | `await mu.sessions.request('score', { until: /^HP/ })` |
| Ask for a GMCP package | `"contributes": { "gmcp": ["Char 1"] }`; `mu.gmcp.supports` only for runtime needs |
| Receive GMCP | `mu.gmcp.on('Char.Vitals', (data, meta) => …)` |
| A GMCP package's current state | `mu.gmcp.watch('Room.Info', (room, meta) => …, { sid })` |
| Send GMCP / ask and wait | `await mu.gmcp.send('Char.Skills.Get', {}, sid)`, `await mu.gmcp.request(pkg, data, { sid, expect })` |
| Messages from backend Lua (`ext.emit(name, data)`) | `mu.lua.on('myext.event', …)` |
| Feed the built-in Scene / Channels / Media / HUD | `mu.scene.set`, `mu.channels.push`, `mu.media.play`, `mu.widgets.show` |
| Open a web page the game asked for | `mu.panels.openWeb({ url, id, title }, sid)` |

Game automation that sends commands on a trigger belongs in μClient's Lua scripting, which runs on
the backend and keeps working when the browser tab is closed. An extension is the UI side; the two
meet at `ext.emit` / `mu.lua.on`.

**Sessions and replay.** The extension runs while a session of a world that enables it is open, and hears only
those sessions. Keep per-session state in `mu.sessions.each(s => { …; return dispose })` (or in
`mu.storage.session(sid)`), not in a module-level map that is never cleared. Every handler gets an envelope as its
second argument (`meta.sid`, `meta.replay`, `meta.origin`). When the extension activates late or a session
reconnects, μClient delivers the last values again with `replay: true`; effects such as `ui.toast`,
`media.play` and `sessions.send` are skipped while handling one, so there is no need for a hand-written
`sessions.list()` × `gmcp.state` loop at start-up. Skip replayed events in your own logic when they must count
once (see `examples/gmcp-room`).

**Several clients.** The player may have a session open in several tabs and devices, and each runs your
extension. Effects run where the player is (`mu.effects.owner(sid)`); a send that must happen once takes a key:
`mu.sessions.send(text, { sid, key: meta.id + ':reply' })`.

### 5. Remember things

| Tier | Where it lives |
|---|---|
| `mu.storage.world(worldId)` | That world, this device |
| `mu.storage.world(worldId, { sync: true })` | That world, every device of the player (encrypted) |
| `mu.storage.device` (= `global`) | Every world, this device |
| `mu.storage.account` | Every world, every device (encrypted) |
| `mu.storage.session(sid)` | The clients attached to one session, while it lives (memory only) |

Each store has `get`/`set`/`delete`, `keys(prefix)`, `watch(key, fn)` (changes from this and other tabs and
devices) and `collection(name)` for lists that two devices may add to at once. `mu.settings.define(schema)` gives
the player a Settings page and you `mu.settings.get(key)` / `watch(key, fn)`; values resolve world → all worlds →
default, and follow the account unless a setting says `sync: 'device'`. Since 1.14 a `tile: { glyph: '⇶' }` puts the
page on the Settings hub, and a `{ key: 'openKey', kind: 'shortcut', command: 'hello-world.open' }` item binds a key
to one of your commands in the player's key bindings.

### 6. Test headless

`npm test` runs `test/*.test.mjs` with Node's test runner. Each test makes a headless host from
`@runmu.sh/dev/test`, loads an extension's `src/index.ts` (built with esbuild, as the dev server builds it), feeds it
game events and asserts on what the extension did:

```js
const host = createHost({ root });              // session s1 in world w1, connected
const ext = await host.load('src/index.ts');
host.gmcp('Room.Info', { name: 'A cellar' });   // host.mcp(msg, args), host.msdp(var, v), host.line(text)
await host.play('test/fixtures/session.murec'); // a recorded session, in order
host.sent;                                      // commands, GMCP, MCP and MSDP the extension sent
host.widgets('s1'); host.open({ id: 's2', worldId: 'w2' }); host.close('s2');
await host.unload();                            // deactivate + dispose; host.live() is then []
```

To record your own fixture: **Tools → GMCP inspector → Log → record**, play, then **save .murec**. The file
stays on your device; your character's name becomes `{char}` and `Char.Login` and credentials are dropped. You can
also replay it into a `?demo` μClient while you develop: `npm run dev -- --fixture test/fixtures/session.murec`,
then open μClient with `?demo&ext-dev=http://localhost:5199/`.

### 7. Test in the client

`npm run dev` and load `http://localhost:5199/` from **Extensions → Developer**. A dev extension is
never pinned, stays on that device only, and shows a DEV badge. Each save rebuilds and remounts the
open panel. Chrome, Firefox and the desktop app reach localhost from the hosted client; Safari does
not yet.

Failures are contained: a panel that throws shows an error boundary, a hook that throws is logged
under the extension in Extensions → Installed → log. Three crashes in 60 seconds disable the
extension until you re-enable it.

### 8. Ship it

Installing does not build, so `dist/index.js` has to exist wherever you point μClient at:

- **A git tag**: commit `dist/` on the tag (`.gitignore` here excludes it; remove that line or force-add
  it on release), then install with `git+https://github.com/you/my-thing#v0.1.0`.
- **A tarball**: `npm pack` and host the `.tgz`, or attach it to a GitHub release and install with
  `git+https://github.com/you/my-thing#release:v0.1.0/ext-my-thing-0.1.0.tgz`.
- **npm**: `npm publish` and install with `npm:ext-my-thing@^0.1`.
- **The marketplace** at [runmu.sh/marketplace](https://runmu.sh/marketplace): make a publisher token
  under your account, then `curl -H "Authorization: Bearer $MKT_TOKEN" --data-binary @ext-my-thing-0.1.0.tgz https://market.runmu.sh/v1/publish`.
  Versions are immutable; bump the version and the CHANGELOG first.

μClient pins the entry by sha256 and asks the player before a new version runs. Optional: sign
`dist/index.js` with [minisign](https://jedisct1.github.io/minisign/) and ship the `.minisig` next
to it; the install prompt shows the publisher key.

## The SDK

`@muclient/sdk` is installed from npm as an alias of [`@runmu.sh/sdk`](https://www.npmjs.com/package/@runmu.sh/sdk)
(`"@muclient/sdk": "npm:@runmu.sh/sdk@^1.14.0"`): the import keeps the name μClient's import map
resolves, and the build leaves it external. Its `index.d.ts` is the whole contract, with a `@since` on
each member; every member is documented at [runmu.sh/docs/reference/sdk](https://runmu.sh/docs/reference/sdk/). The source is
[`clients/extensions/sdk/index.ts`](https://github.com/runmu-sh/client/blob/main/clients/extensions/sdk/index.ts)
in the client repo. The first-party extensions in
[`clients/extensions/`](https://github.com/runmu-sh/client/tree/main/clients/extensions) are larger
worked examples: `ext-webpages` is thirty lines, `ext-vitals` draws gauges, `ext-scene` is the Scene panel.

To update the types when a new SDK ships, `npm i -D @muclient/sdk@npm:@runmu.sh/sdk@latest` and raise
`muclient.api` if you use the new members. What changed and how to move existing code is in the SDK's
[CHANGELOG](https://github.com/runmu-sh/client/blob/main/clients/extensions/sdk/CHANGELOG.md) and the
[migration guides](https://github.com/runmu-sh/client/tree/main/docs/extensions-sdk/migrations).

## License

MIT. Replace this section, the `license` field and the package name with your own.
