/**
 * Hello world: the smallest useful μClient extension.
 *
 * It registers one dock panel, one palette command that opens it, and one setting. The panel greets
 * you, shows which session it is attached to, and has a button that sends `say Hello, world!` to the
 * game. Everything registered through `mu` is disposed for you when the extension is disabled,
 * removed or hot-reloaded, so there is nothing to clean up in `deactivate`.
 *
 * Read this file top to bottom, then `src/panel.ts`, then the folders in `examples/`.
 */
import { defineExtension, type Mu } from '@muclient/sdk';
import { mountPanel } from './panel';

/** The extension id from package.json `muclient.id`. Panel and command ids are prefixed with it. */
const ID = 'hello-world';

export default defineExtension({
  activate(ctx) {
    const mu: Mu = ctx.mu;

    // A Settings page for this extension (Extensions → Hello world → settings). Values are stored
    // as `ext.hello-world.name`, per world with a fallback to "all worlds".
    mu.settings.define({
      title: 'Hello world',
      items: [
        { key: 'name', label: 'Who to greet', default: 'world', kind: 'text', hint: 'Shown in the panel heading.' },
      ],
    });

    // The panel. `mount` draws into `el` and returns a cleanup function. It is called again for each
    // session tab the panel is open in, and after every hot reload.
    mu.panels.register({
      id: ID,
      title: 'Hello world',
      defaultPosition: 'right-bottom',
      mount: (el, pctx) => mountPanel(mu, el, pctx.sid),
      // Hot reload: keep what was typed in the input while `npm run dev` swaps the build.
      snapshot: (el) => el.querySelector<HTMLInputElement>('input[name=text]')?.value,
      restore: (el, saved) => {
        const input = el.querySelector<HTMLInputElement>('input[name=text]');
        if (input && typeof saved === 'string') input.value = saved;
      },
    });

    // A command palette entry (Ctrl/Cmd-K in μClient) that opens the panel.
    mu.commands.register({
      id: `${ID}.open`,
      title: 'Hello world: open the panel',
      run: () => mu.panels.open(ID),
    });

    mu.log.info('Hello world', ctx.version, 'active');

    // Whatever activate returns is this extension's public API. Another extension can reach it with
    // `await ctx.api('hello-world')`.
    return { greeting: () => `Hello, ${mu.settings.get<string>('name') || 'world'}!` };
  },
});
