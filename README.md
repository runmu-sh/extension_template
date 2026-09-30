# μClient extension template

A starting point for a [μClient](https://runmu.sh) extension. It builds a **Hello world** panel and
comes with three examples that each show one part of the SDK. Use the green **Use this template**
button on GitHub, or clone it, and you have a project that builds, type-checks and hot-reloads into
the client.

```sh
git clone https://github.com/runmu-sh/extension_template my-ext
cd my-ext
npm install
npm run dev
```

Then in μClient: **Extensions → Developer → load from dev server**, with `http://localhost:5199/`.
The Hello world panel appears under Views. Edit `src/panel.ts`, save, and the panel updates in place.

## What is in here

| Path | What |
|---|---|
| `package.json` | The `muclient` manifest: id, API range, what the extension contributes. See [The manifest](#the-manifest). |
| `src/index.ts` | `defineExtension({ activate })`: registers the panel, a palette command and a setting. |
| `src/panel.ts` | The panel in plain DOM, styled with `mu.ui.css` classes and theme tokens. |
| `examples/vue-panel/` | The same panel as a Vue component (`mu.panels.vue`). |
| `examples/gmcp-room/` | GMCP `Room.Info` → per-world storage → a table of visited rooms. |
| `examples/line-trigger/` | A line pipeline stage, settings that drive it, a HUD widget, and the Lua `ext.emit` bridge. |
| `sdk/` | A copy of the `@muclient/sdk` types (v1.6). Type checking only; the client supplies the real module at runtime. |
| `scripts/build.mjs` | esbuild → `dist/index.js`, then the manifest check. |
| `scripts/dev.mjs`, `scripts/dev-server.mjs` | The dev server: rebuild on save, serve on localhost, push reloads over SSE. |
| `scripts/manifest.mjs` | The manifest rules μClient applies at install, so the build fails where the install would. |
| `test/build.test.mjs` | Builds everything and checks the bundles: `npm test`. |

## Commands

```sh
npm run dev                       # dev server for src/ on http://localhost:5199/
npm run dev examples/gmcp-room    # dev server for an example (add -- --port 5200 for a second one)
npm run build                     # src/index.ts → dist/index.js + manifest check
npm run build:examples            # the root and every example
npm run typecheck                 # tsc --noEmit against sdk/
npm test                          # build all, check manifests and externals, typecheck
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
    "api": "^1.6",                 // the SDK range you need; μClient 1.x refuses anything else
    "source": "src/index.ts",      // what the dev server and build compile
    "displayName": "My thing",
    "description": "Shown in the install prompt and the Extensions list.",
    "categories": ["interface"],   // up to 3 of: mapping combat communication automation interface themes sound accessibility logging developer games other
    "contributes": {
      "panels": [{ "id": "my-thing", "title": "My thing" }],
      "commands": [{ "id": "my-thing.open", "title": "My thing: open" }],
      "gmcp": ["Room 1"]           // packages you ask the game for
    },
    "capabilities": ["read-output", "send-commands"]
  }
}
```

`capabilities` are shown to the player at install and are not enforced: an extension runs fully
trusted once the player says yes. Declare what you do (`read-output`, `send-commands`, `network`,
`open-web`) so a player can spot a theme that wants to send commands.

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
`badge`, `lamp`, `glow`, `cmd`, `toggle`, `plate`, `count`, `field`, `row`, `label`) and colours from
theme variables (`var(--accent)`, `var(--t-body)`). Literal colours break the moment a player switches
theme. `mu.ui.style(css)` injects a stylesheet scoped to your extension's lifetime.

For hot reload, add `snapshot(el)` and `restore(el, saved)` to the panel spec: `snapshot` runs on the
old build just before it unmounts, `restore` on the new one right after `mount`. Return a JSON-like
value (a draft string, a scroll position).

### 4. Talk to the game

| Want | Call |
|---|---|
| Send a command as if typed | `mu.sessions.send('look', sid)` |
| Print a local line | `mu.sessions.echo('[me] hi', sid)` |
| Every line the game sends | `mu.sessions.on('line', (line, { sid }) => …)` |
| Change, gag or annotate lines | `mu.lines.stage({ id, order: 300, run(line, ctx) })` |
| Ask for a GMCP package | `mu.gmcp.supports(['Char 1'])` |
| Receive GMCP | `mu.gmcp.on('Char.Vitals', (data, { sid }) => …)` |
| Last GMCP value seen | `mu.gmcp.state('Room.Info', sid)` |
| Send GMCP | `await mu.gmcp.send('Char.Skills.Get', {}, sid)` |
| Messages from backend Lua (`ext.emit(name, data)`) | `mu.lua.on('myext.event', …)` |
| Feed the built-in Scene / Channels / Media / HUD | `mu.scene.set`, `mu.channels.push`, `mu.media.play`, `mu.widgets.show` |
| Open a web page the game asked for | `mu.panels.openWeb({ url, id, title }, sid)` |

Game automation that sends commands on a trigger belongs in μClient's Lua scripting, which runs on
the backend and keeps working when the browser tab is closed. An extension is the UI side; the two
meet at `ext.emit` / `mu.lua.on`.

### 5. Remember things

`mu.storage.world(worldId)` and `mu.storage.global` are key-value stores that survive reloads,
reinstalls and devices; they sync with the account. `mu.settings.define(schema)` gives the player a
Settings page and you `mu.settings.get(key)` / `watch(key, fn)`; values resolve world → all worlds →
default.

### 6. Test in the client

`npm run dev` and load `http://localhost:5199/` from **Extensions → Developer**. A dev extension is
never pinned, stays on that device only, and shows a DEV badge. Each save rebuilds and remounts the
open panel. Chrome, Firefox and the desktop app reach localhost from the hosted client; Safari does
not yet.

Failures are contained: a panel that throws shows an error boundary, a hook that throws is logged
under the extension in Extensions → Installed → log. Three crashes in 60 seconds disable the
extension until you re-enable it.

### 7. Ship it

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

`sdk/index.ts` is the whole contract, with a `@since` on each member. The full specification, with
the hosting rules, the registry index format and the trust model, is
[`docs/overhaul/08-extensions.md`](https://github.com/runmu-sh/client/blob/main/docs/overhaul/08-extensions.md)
in the client repo. The first-party extensions in
[`clients/extensions/`](https://github.com/runmu-sh/client/tree/main/clients/extensions) are larger
worked examples: `ext-webpages` is thirty lines, `ext-vitals` draws gauges, `ext-scene` is the Scene panel.

To update the types when a new SDK ships, copy `clients/extensions/sdk/index.ts` over `sdk/index.ts`
and raise `muclient.api` if you use the new members.

## License

MIT. Replace this section, the `license` field and the package name with your own.
