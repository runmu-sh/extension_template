/**
 * Example: the line pipeline, settings, per-session state, widgets and the Lua bridge.
 *
 *  - `mu.lines.stage({ phase })` runs on every line in one phase of μClient's line host. A `highlight` stage
 *    styles text with theme tokens (`line.highlight(re, { fg: 'accent' })`, never a literal colour) and adds
 *    row classes; a `route` stage may `gag` a line. Phases that change what the game said (`transform`,
 *    `route`) are declared in package.json `muclient.contributes.linePhases`, and the install prompt says so.
 *    Keep stages fast: one over 8 ms on 20 lines in a row is suspended for the session.
 *  - Backlog and history lines pass through the stages again with `line.replay` set. They are styled the same,
 *    but not counted: the count is for what happens now.
 *  - `mu.settings.define` puts the patterns on a Settings page, so a player can change them without
 *    touching code. `mu.settings.watch` gives the current value at once and recompiles when it changes.
 *  - Per-session state lives in `mu.sessions.each`: setup runs for every session in scope, and what it
 *    returns runs when the session closes or its world disables the extension. A module-level Map keyed by
 *    sid would never be cleared.
 *  - `mu.widgets.show` places a card on the HUD; `mu.lua.on` receives what a backend Lua trigger
 *    sends with `ext.emit('example.alert', { text = '...' })`.
 *
 * Game automation (triggers that send commands) belongs in μClient's Lua, not here: an extension
 * is a UI surface. These stages only decorate.
 */
import { defineExtension, type Mu } from '@muclient/sdk';

const ID = 'example-line-trigger';
const HIT = `ext-${ID}-hit` as const; // an extension's own row classes carry the `ext-<id>-` prefix

function compile(src: string | undefined): RegExp | null {
  if (!src?.trim()) return null;
  try { return new RegExp(src, 'i'); } catch { return null; }
}

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;

    mu.settings.define({
      title: 'Line trigger example',
      items: [
        { key: 'highlight', label: 'Highlight lines matching', default: 'tells you', kind: 'text', hint: 'A regular expression, case-insensitive. Empty turns it off.' },
        { key: 'gag', label: 'Hide lines matching', default: '', kind: 'text', hint: 'Matching lines are not shown. Empty turns it off.' },
        { key: 'count', label: 'Count matches in a HUD card', default: true, kind: 'toggle' },
      ],
    });

    let highlight: RegExp | null = null;
    let gag: RegExp | null = null;
    mu.settings.watch<string>('highlight', (v) => { highlight = compile(v); });
    mu.settings.watch<string>('gag', (v) => { gag = compile(v); });

    // Our own row class, styled from theme variables so it follows the player's theme.
    mu.ui.style(`.${HIT} { border-left: 2px solid var(--accent); padding-left: 4px; }`);

    // sid → matches in this session; each session's entry goes when the session leaves scope.
    const hits = new Map<string, number>();
    mu.sessions.each((s) => {
      hits.set(s.id, 0);
      return () => { hits.delete(s.id); };
    });

    const showCount = (sid: string) => {
      if (mu.settings.get<boolean>('count', { sid }) === false) { mu.widgets.close(`${ID}.count`, sid); return; }
      const n = hits.get(sid) ?? 0;
      mu.widgets.show({
        id: `${ID}.count`, type: 'card', title: 'Matches',
        body: `${n} line${n === 1 ? '' : 's'} matched ${highlight?.source ?? ''}`,
        dismissible: true,
      }, sid);
    };

    mu.lines.stage({
      id: `${ID}.highlight`,
      phase: 'highlight',
      run(line, lc) {
        if (line.kind !== 'output' || !highlight?.test(line.text)) return;
        line.highlight(highlight, { fg: 'accent', bold: true });
        line.rowClass(HIT);
        if (line.replay === true || !hits.has(lc.sid)) return; // backlog and history: styled, not counted
        hits.set(lc.sid, hits.get(lc.sid)! + 1);
        showCount(lc.sid);
      },
    });

    mu.lines.stage({
      id: `${ID}.gag`,
      phase: 'route',
      run(line) {
        if (line.kind === 'output' && gag?.test(line.text)) line.gag();
      },
    });

    // From backend Lua: ext.emit('example.alert', { text = 'Boss is up' })
    mu.lua.on('example.alert', (data, { sid }) => {
      const text = typeof data === 'string' ? data : String((data as { text?: unknown })?.text ?? '');
      if (!text) return;
      mu.widgets.show({
        id: `${ID}.alert`, type: 'card', title: 'Alert from Lua', body: text, dismissible: true,
        buttons: [{ label: 'look', cmd: 'look' }],
      }, sid);
      mu.sessions.echo(`[example] ${text}`, sid);
    });

    // A timer is not registered through mu, so it goes into ctx.subscriptions to be cleared on deactivate.
    const t = setInterval(() => mu.log.info('still watching lines'), 5 * 60_000);
    ctx.subscriptions.push(() => clearInterval(t));

    // The API other extensions (and the tests) can reach: matches so far in a session.
    return { hits: (sid: string) => hits.get(sid) ?? 0 };
  },
});
