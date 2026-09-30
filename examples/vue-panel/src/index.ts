/**
 * Example: a panel as a Vue component.
 *
 * `vue` is external in the build. At runtime the host's import map hands the extension μClient's own
 * Vue, so there is one Vue on the page and no second copy to ship. There is no SFC compiler in the
 * toolchain, so components are written with `defineComponent` and `h()` render functions.
 * `mu.panels.vue(Component)` turns the component into a `mount` function; the host passes the props
 * `sid`, `worldId` and `params`.
 */
import { defineExtension, type Mu } from '@muclient/sdk';
import { defineComponent, h, onBeforeUnmount, ref } from 'vue';

const ID = 'example-vue-panel';

function createPanel(mu: Mu) {
  const c = mu.ui.css;
  // Module-level state survives a remount of the component; it does not survive a hot reload of the
  // whole extension (use snapshot/restore for that, as in the root extension).
  const count = ref(0);

  return defineComponent({
    name: 'HelloVuePanel',
    props: {
      sid: { type: String, default: null },
      worldId: { type: String, default: null },
      params: { type: Object, default: () => ({}) },
    },
    setup(props) {
      const tick = ref(0);
      const stop = mu.sessions.on('switch', () => { tick.value++; });
      onBeforeUnmount(stop);

      const say = () => {
        if (!props.sid) return;
        count.value++;
        void mu.sessions.send(`say Hello from Vue, take ${count.value}`, props.sid);
      };

      return () => {
        void tick.value;
        const s = props.sid ? mu.sessions.list().find((x) => x.id === props.sid) : null;
        return h('div', { style: 'display:flex;flex-direction:column;gap:8px;padding:8px 10px;height:100%;font-size:var(--t-body, .8rem)' }, [
          h('div', { class: c.secHead }, 'Hello from Vue'),
          h('div', { class: c.glow }, s ? `${s.worldName} · ${s.state}` : 'No session'),
          h('p', { class: c.empty }, `Said hello ${count.value} time${count.value === 1 ? '' : 's'}.`),
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
