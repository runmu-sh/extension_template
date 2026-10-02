/**
 * Example: GMCP and storage.
 *
 *  - `"gmcp": ["Room 1"]` in package.json `muclient.contributes` asks the game for the Room package. μClient
 *    declares it (Core.Supports.Add) on every session of a world where the extension is enabled, before
 *    activation too, and withdraws it on disable. Call `mu.gmcp.supports` only for packages that depend on
 *    runtime state.
 *  - `mu.gmcp.on('Room.Info', …)` receives each room. The handler gets an envelope (`meta.sid`, `meta.worldId`,
 *    `meta.replay`), so one extension serves every open session. An extension that activates while a session
 *    is open first gets the last Room.Info again with `replay: true`: that is not a new visit, so it is not
 *    counted.
 *  - `mu.storage.world(worldId)` is a key-value store per world on this device that survives reloads and
 *    reinstalls. `.watch(key, fn)` sees writes from this tab and the extension's other tabs, so the panel
 *    redraws from storage instead of a hand-made listener list.
 *  - `mu.gmcp.watch('Room.Info', fn, { sid })` calls `fn` with the current room at once and on every change:
 *    the panel needs no "last value" lookup when it mounts after the room arrived.
 *  - `mu.ui.confirm` is the host's dialog, used before the command throws the counts away.
 */
import { defineExtension, type Mu } from '@muclient/sdk';

const ID = 'example-gmcp-room';
const MAX_ROWS = 15;

interface Visits { [roomKey: string]: { name: string; area: string; n: number } }

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;

    const worldOf = (sid: string | null) => (sid ? mu.sessions.list().find((s) => s.id === sid)?.worldId ?? null : null);
    const store = (worldId: string | null) => mu.storage.world(worldId);
    const visitsOf = (worldId: string | null): Visits => store(worldId).get<Visits>('visits', {});

    mu.gmcp.on('Room.Info', (d, meta) => {
      if (meta.replay) return; // delivered again on (re)activation: the player did not move
      const key = String(d?.num ?? d?.name ?? '');
      if (!key) return;
      const worldId = meta.worldId ?? worldOf(meta.sid);
      const visits = visitsOf(worldId);
      visits[key] = { name: String(d?.name ?? key), area: String(d?.area ?? ''), n: (visits[key]?.n ?? 0) + 1 };
      store(worldId).set('visits', visits);
    });

    mu.commands.register({
      id: `${ID}.clear`,
      title: 'Room visits: forget this world\'s counts',
      run: async () => {
        const worldId = worldOf(mu.sessions.active()?.id ?? null);
        const ok = await mu.ui.confirm({ title: 'Forget the room counts for this world?', confirm: 'Forget', danger: true });
        if (!ok) return;
        store(worldId).delete('visits');
        mu.ui.toast('Room visits', 'Counts cleared for this world.', { kind: 'example' });
      },
    });

    const c = mu.ui.css;
    mu.panels.register({
      id: ID,
      title: 'Room visits',
      defaultPosition: 'right-top',
      mount(el, { sid }) {
        el.style.cssText = 'display:flex;flex-direction:column;gap:6px;padding:8px 10px;overflow:auto;font-size:var(--t-body, .8rem)';
        el.innerHTML = `
          <div class="${c.secHead}" data-testid="rv-current"></div>
          <table style="border-collapse:collapse;width:100%">
            <thead><tr>
              <th class="${c.label}" style="text-align:left">room</th>
              <th class="${c.label}" style="text-align:right">visits</th>
            </tr></thead>
            <tbody data-testid="rv-rows"></tbody>
          </table>
          <p class="${c.empty}" data-testid="rv-empty"></p>`;
        const current = el.querySelector<HTMLElement>('[data-testid=rv-current]')!;
        const rows = el.querySelector<HTMLElement>('[data-testid=rv-rows]')!;
        const empty = el.querySelector<HTMLElement>('[data-testid=rv-empty]')!;

        const s = sid ?? mu.sessions.active()?.id ?? null;
        const worldId = worldOf(s);
        const drawRows = () => {
          const visits = Object.values(visitsOf(worldId)).sort((a, b) => b.n - a.n).slice(0, MAX_ROWS);
          rows.replaceChildren(...visits.map((v) => {
            const tr = document.createElement('tr');
            const name = document.createElement('td');
            name.textContent = v.area ? `${v.name} (${v.area})` : v.name;
            const n = document.createElement('td');
            n.className = c.count;
            n.style.textAlign = 'right';
            n.textContent = String(v.n);
            tr.append(name, n);
            return tr;
          }));
          empty.textContent = visits.length ? '' : 'No rooms seen yet. Move around.';
          empty.hidden = visits.length > 0;
        };

        current.textContent = 'Waiting for Room.Info…';
        const stopRoom = s
          ? mu.gmcp.watch('Room.Info', (room) => { current.textContent = room?.name ? String(room.name) : 'Waiting for Room.Info…'; }, { sid: s })
          : () => {};
        const stopRows = store(worldId).watch('visits', drawRows);
        drawRows();
        return () => { stopRoom(); stopRows(); };
      },
    });
  },
});
