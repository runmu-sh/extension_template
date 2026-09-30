# Examples

Each folder is a complete extension: its own `package.json` manifest and a `src/index.ts`. They share
the root's `node_modules` and scripts.

```sh
npm run build:examples                   # build all of them
npm run dev examples/gmcp-room           # hot-reload one into μClient
```

| Folder | Shows |
|---|---|
| `vue-panel/` | A panel as a Vue component with render functions; `mu.panels.vue`; `mu.sessions.on('switch')`. |
| `gmcp-room/` | `mu.gmcp.supports` and `.on('Room.Info')`; `mu.gmcp.state`; `mu.storage.world` for per-world data; a command that clears it. |
| `line-trigger/` | `mu.lines.stage` to highlight and gag lines; `mu.settings.define` and `.watch` driving it; `mu.ui.style`; `mu.widgets.show`; `mu.lua.on` for `ext.emit` from backend Lua; `ctx.subscriptions` for a timer. |

To turn one into your extension, copy the folder to the repo root over `src/` and `package.json`, or
copy the pieces you want into `src/index.ts`.
