/**
 * Example: the line pipeline, settings, widgets and the Lua bridge.
 *
 *  - `mu.lines.stage` runs on every line after μClient's own parser and classifier (order ≥ 300).
 *    It may change `line.category` / `line.rowCls`, `ctx.gag()` the line, or `ctx.after(text)` to
 *    add a local line below it. Keep it fast: a stage over 50 ms for 20 lines in a row is suspended.
 *  - `mu.settings.define` puts the patterns on a Settings page, so a player can change them without
 *    touching code. `mu.settings.watch` recompiles when they do.
 *  - `mu.widgets.show` places a card on the HUD; `mu.lua.on` receives what a backend Lua trigger
 *    sends with `ext.emit('example.alert', { text = '...' })`.
 *
 * Game automation (triggers that send commands) belongs in μClient's Lua, not here: an extension
 * is a UI surface. This stage only decorates.
 */
import { defineExtension, type Mu } from '@muclient/sdk';

const ID = 'example-line-trigger';

function compile(src: string): RegExp | null {
  if (!src.trim()) return null;
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

    let highlight = compile(mu.settings.get<string>('highlight'));
    let gag = compile(mu.settings.get<string>('gag'));
    mu.settings.watch<string>('highlight', (v) => { highlight = compile(v); });
    mu.settings.watch<string>('gag', (v) => { gag = compile(v); });

    // The `hl-line` row class is one of μClient's own; `mu.ui.style` adds a class of our own too.
    mu.ui.style(`.${ID}-hit { border-left: 2px solid var(--accent); padding-left: 4px; }`);

    const hits = new Map<string, number>(); // sid → matches this session
    const showCount = (sid: string) => {
      if (mu.settings.get<boolean>('count') === false) { mu.widgets.close(`${ID}.count`, sid); return; }
      mu.widgets.show({
        id: `${ID}.count`, type: 'card', title: 'Matches',
        body: `${hits.get(sid) ?? 0} line${hits.get(sid) === 1 ? '' : 's'} matched ${highlight?.source ?? ''}`,
        dismissible: true,
      }, sid);
    };

    mu.lines.stage({
      id: `${ID}.stage`,
      order: 300,
      run(line, lc) {
        if (line.kind !== 'output') return;
        if (gag?.test(line.text)) { lc.gag(); return; }
        if (highlight?.test(line.text)) {
          line.rowCls = `${line.rowCls ?? ''} ${ID}-hit`.trim();
          hits.set(lc.sid, (hits.get(lc.sid) ?? 0) + 1);
          showCount(lc.sid);
        }
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
  },
});
