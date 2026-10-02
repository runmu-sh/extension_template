/**
 * Example: a panel as a Vue component.
 *
 * `vue` is external in the build. At runtime the host's import map hands the extension μClient's own
 * Vue, so there is one Vue on the page and no second copy to ship. There is no SFC compiler in the
 * toolchain, so components are written with `defineComponent` and `h()` render functions.
 * `mu.panels.vue(Component)` turns the component into a `mount` function; the host passes the props
 * `sid`, `worldId` and `params`. For dialogs and menus use the host's (`mu.ui.confirm`, `mu.menus`) or the
 * components of `@muclient/ui` (external too; types in `@muclient/sdk/ui`) rather than building your own.
 *
 * The hello count is per session, so it lives in `mu.storage.session(sid)`: shared by every client attached to
 * that session (another tab, another device), gone when the session ends, and never mixed up between two open
 * sessions the way one module-level counter would be. `store.watch` re-renders when any of those clients
 * changes it.
 */
import { defineExtension, type Mu } from '@muclient/sdk';
import { defineComponent, h, onBeforeUnmount, ref } from 'vue';

const ID = 'example-vue-panel';

function createPanel(mu: Mu) {
  const c = mu.ui.css;

  return defineComponent({
    name: 'HelloVuePanel',
    props: {
      sid: { type: String, default: null },
      worldId: { type: String, default: null },
      params: { type: Object, default: () => ({}) },
    },
    setup(props) {
      const store = props.sid ? mu.storage.session(props.sid) : null;
      const count = ref(store?.get<number>('count', 0) ?? 0);
      const tick = ref(0); // the session's link state is read in render; bump to re-render on a change
      const stops = [
        store?.watch<number>('count', (v) => { count.value = v ?? 0; }),
        props.sid ? mu.sessions.on('state', () => { tick.value++; }, { sid: props.sid }) : undefined,
      ];
      onBeforeUnmount(() => stops.forEach((s) => s?.()));

      const say = () => {
        if (!props.sid || !store) return;
        const n = count.value + 1;
        store.set('count', n);
        void mu.sessions.send(`say Hello from Vue, take ${n}`, props.sid);
      };

      return () => {
        void tick.value;
        const s = props.sid ? mu.sessions.list().find((x) => x.id === props.sid) : null;
        return h('div', { style: 'display:flex;flex-direction:column;gap:8px;padding:8px 10px;height:100%;font-size:var(--t-body, .8rem)' }, [
          h('div', { class: c.secHead }, 'Hello from Vue'),
          h('div', { class: c.glow }, s ? `${s.worldName} · ${s.state}` : 'No session'),
          h('p', { class: c.empty }, `Said hello ${count.value} time${count.value === 1 ? '' : 's'} in this session.`),
          h('div', { style: 'margin-top:auto' }, [
            h('button', { class: c.btn, type: 'button', disabled: !props.sid, onClick: say }, 'say hello'),
          ]),
        ]);
      };
    },
  });
}

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;
    mu.panels.register({
      id: ID,
      title: 'Vue panel',
      defaultPosition: 'right-bottom',
      mount: mu.panels.vue(createPanel(mu)),
    });
    mu.commands.register({ id: `${ID}.open`, title: 'Vue panel: open', run: () => mu.panels.open(ID) });
  },
});
