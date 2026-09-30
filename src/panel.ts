/**
 * The Hello world panel, in plain DOM.
 *
 * Visuals come from `mu.ui.css` (the class names of μClient's own primitives) and from theme tokens
 * through CSS variables. No literal colours: a panel has to look right in every theme the player picks.
 * For a Vue version of the same panel see `examples/vue-panel/`.
 */
import type { Mu } from '@muclient/sdk';

export function mountPanel(mu: Mu, el: HTMLElement, sid: string | null): () => void {
  const c = mu.ui.css;
  el.style.cssText = 'display:flex;flex-direction:column;gap:8px;padding:8px 10px;overflow:auto;height:100%;font-size:var(--t-body, .8rem)';
  el.innerHTML = `
    <div class="${c.secHead}" data-testid="hello-heading"></div>
    <div class="${c.glow}" data-testid="hello-session"></div>
    <p class="${c.empty}">
      Edit <code>src/panel.ts</code> and save. With <code>npm run dev</code> running, this panel
      updates in place.
    </p>
    <form style="display:flex;gap:6px;margin-top:auto">
      <input class="${c.inp}" name="text" value="Hello, world!" aria-label="text to say" style="flex:1" />
      <button class="${c.tool}" type="submit">say</button>
    </form>`;

  const heading = el.querySelector<HTMLElement>('[data-testid=hello-heading]')!;
  const session = el.querySelector<HTMLElement>('[data-testid=hello-session]')!;
  const form = el.querySelector<HTMLFormElement>('form')!;
  const input = el.querySelector<HTMLInputElement>('input[name=text]')!;

  const draw = () => {
    heading.textContent = `Hello, ${mu.settings.get<string>('name') || 'world'}!`;
    const s = sid ? mu.sessions.list().find((x) => x.id === sid) : null;
    session.textContent = s ? `${s.worldName} · ${s.state}` : 'No session: open a world to send anything.';
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || !sid) return;
    // Goes through the input pipeline as if typed: aliases and separators apply.
    void mu.sessions.send(`say ${text}`, sid);
    mu.ui.toast('Hello world', `Sent: say ${text}`, { kind: 'hello-world' });
  };

  // Redraw when the setting changes. The disposable is tracked by mu, but we also stop it on unmount
  // so a closed panel does not keep drawing into a detached element.
  const stopWatch = mu.settings.watch('name', draw);
  draw();

  return () => { stopWatch(); };
}
