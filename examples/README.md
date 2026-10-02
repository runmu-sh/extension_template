# Examples

Each folder is a complete extension: its own `package.json` manifest and a `src/index.ts`. They share
the root's `node_modules` and scripts.

```sh
npm run build:examples                   # build all of them
npm run dev examples/gmcp-room           # hot-reload one into μClient
npm test                                 # test/index.test.mjs runs each one in the headless host
```

| Folder | Shows |
|---|---|
| `vue-panel/` | A panel as a Vue component with render functions; `mu.panels.vue`; a per-session count in `mu.storage.session(sid)` with `store.watch`; `mu.sessions.on('state', fn, { sid })`. |
| `gmcp-room/` | `contributes.gmcp` (the host declares `Room 1`); `mu.gmcp.on('Room.Info')` skipping `meta.replay`; `mu.gmcp.watch` for the current room; `mu.storage.world` and its `watch`; `mu.ui.confirm` before a command clears the data. |
| `line-trigger/` | Phased `mu.lines.stage`: `highlight` with theme tokens and an `ext-<id>-` row class, `route` to gag; `contributes.linePhases`; `mu.settings.define` and `.watch` driving it; per-session counts in `mu.sessions.each`; `mu.widgets.show`; `mu.lua.on` for `ext.emit` from backend Lua; `ctx.subscriptions` for a timer. |

To turn one into your extension, copy the folder to the repo root over `src/` and `package.json`, or
copy the pieces you want into `src/index.ts`.
