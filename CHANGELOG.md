# Changelog

## 0.2.0

- SDK 1.12: `"@muclient/sdk": "npm:@runmu.sh/sdk@^1.12.0"`, `@runmu.sh/dev` `^0.2.0`, `muclient.api` `^1.12`
  in the root and every example. `scripts/manifest.mjs` is the 1.12 rule set (semver `api`, `contributes`,
  `dependsOn`, `activation`).
- `npm test` runs `test/index.test.mjs` in the headless host (`@runmu.sh/dev/test`), with a sample recording in
  `test/fixtures/session.murec`, as `npm create @runmu.sh/extension` 0.3.0 generates.
- Examples follow the 1.8–1.12 practice: `gmcp-room` relies on `contributes.gmcp`, skips replayed `Room.Info`,
  uses `gmcp.watch`, storage `watch` and `ui.confirm`; `line-trigger` uses phased `highlight` / `route` stages
  with theme tokens, `contributes.linePhases` and per-session counts in `sessions.each`; `vue-panel` keeps its
  count per session in `storage.session`.
- CI runs the manifest check, the build, the typecheck and `npm test`.

## 0.1.0

- First version.
