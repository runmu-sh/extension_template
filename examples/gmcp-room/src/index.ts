/**
 * Example: GMCP and storage.
 *
 *  - `mu.gmcp.supports(['Room 1'])` tells the game to send the Room package (Core.Supports.Add on
 *    every connected session; Remove when the extension is disposed).
 *  - `mu.gmcp.on('Room.Info', …)` receives each room. The handler gets the session id, so one
 *    extension serves every open session.
 *  - `mu.storage.world(worldId)` is a key-value store per world that survives reloads, reinstalls and
 *    devices (it is synced with the account). `mu.storage.global` is the same for all worlds.
 *  - `mu.gmcp.state('Room.Info', sid)` is the last value seen, handy when a panel mounts after the
 *    room arrived.
 */
import { defineExtension, type Mu } from '@muclient/sdk';

const ID = 'example-gmcp-room';
const MAX_ROWS = 15;

interface Visits { [roomKey: string]: { name: string; area: string; n: number } }

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;
    const redraws = new Set<() => void>();
    const redraw = () => redraws.forEach((f) => f());

    const worldOf = (sid: string) => mu.sessions.list().find((s) => s.id === sid)?.worldId ?? null;
    const visitsOf = (worldId: string | null): Visits => mu.storage.world(worldId).get<Visits>('visits', {});

    mu.gmcp.supports(['Room 1']);
    mu.gmcp.on('Room.Info', (data, { sid }) => {
      const d = (data ?? {}) as Record<string, unknown>;
      const key = String(d.num ?? d.id ?? d.name ?? '');
      if (!key) return;
      const worldId = worldOf(sid);
      const visits = visitsOf(worldId);
      const prev = visits[key];
      visits[key] = { name: String(d.name ?? key), area: String(d.area ?? ''), n: (prev?.n ?? 0) + 1 };
      mu.storage.world(worldId).set('visits', visits);
      redraw();
    });

    mu.commands.register({
      id: `${ID}.clear`,
      title: 'Room visits: forget this world\'s counts',
      run: () => {
        const sid = mu.sessions.active()?.id;
        mu.storage.world(sid ? worldOf(sid) : null).delete('visits');
        mu.ui.toast('Room visits', 'Counts cleared for this world.', { kind: 'example' });
        redraw();
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

        const draw = () => {
          const s = sid ?? mu.sessions.active()?.id ?? null;
          const room = s ? (mu.gmcp.state('Room.Info', s) as Record<string, unknown> | undefined) : undefined;
          current.textContent = room?.name ? String(room.name) : 'Waiting for Room.Info…';
          const visits = Object.values(visitsOf(s ? worldOf(s) : null)).sort((a, b) => b.n - a.n).slice(0, MAX_ROWS);
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
        redraws.add(draw);
        draw();
        return () => { redraws.delete(draw); };
      },
    });
  },
});
