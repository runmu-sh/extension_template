/**
 * @muclient/sdk v1 — the stable contract between μClient and an extension (R-EXT-API).
 *
 * At runtime the bare import `@muclient/sdk` resolves through the host's import map to
 * `/shared/sdk.mjs`. This file is the source of truth for the TYPES; the host implements them in
 * `clients/web/src/features/extensions/sdk.ts`. Everything registered through `ctx.mu` is tracked
 * and disposed when the extension is disabled, uninstalled or reloaded — no manual cleanup needed.
 */

export const SDK_VERSION = '1.6.0';

export type Dispose = () => void;

export interface SessionRef { id: string; worldId: string; worldName: string; state: string }

export interface LineView {
  readonly id: number;
  readonly ts: number;
  readonly text: string;
  readonly kind: 'output' | 'echo' | 'system' | 'prompt';
  category: 'speech' | 'pose' | 'combat' | 'comms' | 'look' | 'system';
  rowCls?: string;
}
export interface LineCtx { sid: string; worldId: string; gag(): void; after(text: string): void }

export interface PanelMountCtx {
  /** Session the panel belongs to (null for a global panel with no active session). */
  sid: string | null;
  worldId: string | null;
  params: Record<string, unknown>;
}
export interface PanelSpec {
  id: string;
  title: string;
  /** Render into `el` with any framework or plain DOM; return a cleanup function. */
  mount(el: HTMLElement, ctx: PanelMountCtx): void | Dispose;
  singleton?: boolean;
  perSession?: boolean;
  defaultPosition?: 'left' | 'right-top' | 'right-bottom' | 'float';
  /** Listed in the Views menu (default true). Change it later with `mu.panels.update`. @since 1.1 */
  inViewsMenu?: boolean;
  /**
   * Place in the Views menu, lower first (default 200). Core panels: Terminal 0, Channels 20, Media 30,
   * Feeds 50, Web page 210, then μClient's own at 300+. The Scene extension takes 10. @since 1.4
   */
  order?: number;
  /**
   * Hot reload (08-extensions §7): called on the old build just before its panel unmounts. Return
   * JSON-like state (the input text, a scroll position); `undefined` keeps nothing. @since 1.2
   */
  snapshot?(el: HTMLElement, ctx: PanelMountCtx): unknown;
  /** Hot reload: called on the new build right after `mount`, with what `snapshot` returned. @since 1.2 */
  restore?(el: HTMLElement, state: unknown, ctx: PanelMountCtx): void;
}

/** A patch for the built-in Scene panel (`mu.scene.set`). Omitted fields are left as they are. @since 1.1 */
export interface ScenePatch {
  /** Room title (the Scene header and the HUD location). */
  title?: string;
  area?: string;
  desc?: string;
  /** The italic atmosphere line. */
  atmosphere?: string;
  /** The pose line with the left rule. */
  pose?: string;
  exits?: string[];
  /** Names of the people present. */
  present?: string[];
  items?: Array<{ id?: string; name: string; hostile?: boolean }>;
}

/**
 * What the Scene holds for a session (`mu.scene.get` / `watch`), fed by GMCP `Room.*`, `Char.Items.*`,
 * MSDP and `mu.scene.set`. The same fields as {@link ScenePatch}, all present. @since 1.4
 */
export interface SceneView {
  /** False until a room name, description or exit arrives ("No room yet" in the Scene). */
  known: boolean;
  title: string;
  area: string;
  desc: string;
  atmosphere: string;
  pose: string;
  exits: string[];
  present: string[];
  items: Array<{ id: string; name: string; hostile?: boolean }>;
}

/** A cue for the built-in Media panel (`mu.media.play`), the same shape as GMCP Client.Media.Play. @since 1.1 */
export interface MediaSpec {
  /** File name, resolved against `url` or the session's media base. */
  name: string;
  url?: string;
  type?: 'music' | 'sound';
  /** 0–100, default 50. */
  volume?: number;
  /** Repeat count; -1 loops forever. */
  loops?: number;
  /** Identity for `stop({ key })`; defaults to `name`. */
  key?: string;
}

/** A HUD widget (R-UIC) rendered by the host (`mu.widgets.show`). Gauges stack top-left, the rest as cards on the right. @since 1.1 */
export interface WidgetSpec {
  id: string;
  type: 'card' | 'menu' | 'form' | 'table' | 'gauge';
  title?: string;
  body?: string;
  buttons?: Array<{ label: string; cmd?: string }>;
  options?: Array<{ label: string; cmd?: string }>;
  fields?: Array<{ name: string; label?: string; type?: 'input' | 'select' | 'textarea'; options?: string[]; value?: string; placeholder?: string }>;
  /** form: a command template with {field} placeholders. */
  cmd?: string;
  submit?: string;
  columns?: string[];
  rows?: Array<Array<string | number>>;
  value?: number;
  max?: number;
  /** A token name for the gauge fill. */
  color?: 'accent' | 'accent-bright' | 'ok' | 'gold' | 'alert';
  label?: string;
  dismissible?: boolean;
  /** Who shows it (the host sets it to the extension id when omitted). */
  source?: string;
  order?: number;
}

/** One setting on an extension's Settings page (`mu.settings.define`). @since 1.1 */
export interface SettingSpec<T = string | number | boolean> {
  /** Key within the extension; the stored pref is `ext.<id>.<key>`. */
  key: string;
  label: string;
  default: T;
  kind?: 'toggle' | 'range' | 'select' | 'text';
  options?: Array<{ value: T; label: string }>;
  min?: number; max?: number; step?: number; unit?: string;
  hint?: string;
  /** Group head the row sits under. */
  group?: string;
  /** Default 'both': per world, falling back to all worlds. */
  scope?: 'global' | 'world' | 'both';
}
export interface SettingsSchema { title?: string; items: SettingSpec[] }

export interface CommandSpec { id: string; title: string; keys?: string[]; run(arg?: unknown): void | Promise<void> }

export interface Storage {
  get<T = unknown>(key: string, fallback?: T): T;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  keys(): string[];
}

export interface Mu {
  panels: {
    register(spec: PanelSpec): Dispose;
    open(id: string, params?: Record<string, unknown>): void;
    close(id: string): void;
    /** Change a panel this extension registered: the tab and Views title, and whether it is listed in Views. @since 1.1 */
    update(id: string, patch: { title?: string; inViewsMenu?: boolean }): void;
    /** R-AUTO-PANELS: add the panel to a session's workspace the first time its data arrives (once per world on this device). @since 1.1 */
    autoAdd(id: string, sid: string): void;
    /** Turn a Vue component into a `mount` function (props: sid, worldId, params). Use `vue` from the import map. @since 1.1 */
    vue(component: unknown): PanelSpec['mount'];
    /**
     * Open a web page for a session the way the game does (GMCP `Client.Web.Open`, R-WEB-OPEN): in a
     * Web panel or a new window, per Settings → Access → "Open web pages"; a site that the player marked
     * as refusing to be framed always gets a window. Only http(s) URLs open. `id` names the page (reopening
     * it replaces the page; default the URL), `title` is the tab title. Resolves where it went. Disposed
     * with the extension (the panel closes). @since 1.6
     */
    openWeb(spec: { url: string; id?: string; title?: string }, sid?: string): 'panel' | 'window' | 'blocked';
    /** Close a page this extension opened with `openWeb`. @since 1.6 */
    closeWeb(id: string, sid?: string): void;
  };
  commands: { register(spec: CommandSpec): Dispose; run(id: string, arg?: unknown): void };
  sessions: {
    active(): SessionRef | null;
    list(): SessionRef[];
    /** Send a command as if typed (goes through the input pipeline: separators, aliases). */
    send(text: string, sid?: string): Promise<void>;
    /** Show a local line in the session's terminal (not sent to the game). */
    echo(text: string, sid?: string): void;
    on(ev: 'line', fn: (line: LineView, s: { sid: string }) => void): Dispose;
    on(ev: 'switch', fn: (s: SessionRef | null) => void): Dispose;
  };
  lines: {
    /** A pipeline stage; `order` is clamped to ≥ 300 (after the parser, classifier and quick rules). */
    stage(spec: { id: string; order?: number; run(line: LineView, ctx: LineCtx): void }): Dispose;
  };
  gmcp: {
    /** `pkg` matches exactly, or as a prefix when it ends with '.' or is a bare namespace ('Room'). */
    on(pkg: string, fn: (data: unknown, s: { sid: string; pkg: string }) => void): Dispose;
    /** Last value seen for a package on a session. */
    state(pkg: string, sid?: string): unknown;
    /**
     * Send a GMCP message to the game (default: the active session). Resolves false when the transport
     * cannot send GMCP (the live backend has no GMCP-send RPC yet). @since 1.1
     */
    send(pkg: string, data?: unknown, sid?: string): Promise<boolean>;
    /**
     * Announce packages with `Core.Supports.Add` on every connected session of the active world (and
     * `Core.Supports.Remove` on dispose), e.g. `['Client.Tickets 1']`. @since 1.1
     */
    supports(pkgs: string[]): Dispose;
  };
  /**
   * The session's scene: the room the host tracks from GMCP/MSDP. The Scene panel itself is the
   * first-party extension `scene` (@muclient/ext-scene), which reads it through `get` and `watch`.
   */
  scene: {
    /** Feed the scene (telnet-only games, or a module that knows the room). Dispose clears what it set. @since 1.1 */
    set(patch: ScenePatch, sid?: string): Dispose;
    /** A copy of the scene now (default: the active session; `null` with no session). @since 1.4 */
    get(sid?: string): SceneView | null;
    /** Call `fn` with the scene now and on every change, for one session (default: the active one at call time). Dispose stops it. @since 1.4 */
    watch(fn: (scene: SceneView) => void, sid?: string): Dispose;
  };
  /** Add a message to the built-in Channels panel (mentions and unread follow the channel's settings). Dispose removes it. @since 1.1 */
  channels: { push(channel: string, sender: string, text: string, sid?: string): Dispose };
  /** Play or stop audio through the built-in Media panel. Dispose stops the cue. @since 1.1 */
  media: { play(spec: MediaSpec, sid?: string): Dispose; stop(filter?: { name?: string; key?: string; type?: 'music' | 'sound' }, sid?: string): void };
  /** Place a card, menu, form, table or gauge on the HUD (R-UIC). Showing the same id replaces it. Dispose closes it. @since 1.1 */
  widgets: { show(spec: WidgetSpec, sid?: string): Dispose; close(id: string, sid?: string): void };
  /**
   * Settings: `define` registers the extension's Settings page (reached from Extensions → settings),
   * rendered from the schema like core pages. Values resolve world → all worlds → default. @since 1.1
   */
  settings: {
    define(schema: SettingsSchema): Dispose;
    get<T = unknown>(key: string, worldId?: string | null): T;
    /** Write a value: to `worldId` (default the active world) when the setting's scope allows, else for all worlds. Pass `null` for all worlds. */
    set(key: string, value: unknown, worldId?: string | null): void;
    watch<T = unknown>(key: string, fn: (value: T) => void): Dispose;
    /** Open the extension's Settings page. */
    open(): void;
  };
  /** Data from game automation: a backend Lua `ext.emit(name, data)` (R-EXT-LUA-EMIT). */
  lua: { on(name: string, fn: (data: unknown, s: { sid: string; name: string }) => void): Dispose };
  ui: {
    /** A toast; `kind` is the small label above the title (a module name such as 'tickets'; default 'info'). `kind` @since 1.1 */
    toast(title: string, body?: string, opts?: { kind?: string }): void;
    /**
     * Class names of the style-bible primitives for non-Vue code: btn, tool, chip, inp, sec-head, empty, framed …
     * `tool` and `chip` render as the borderless `cmd` ([ LABEL ]) and `toggle` (■ LABEL) primitives.
     * `cmd` `toggle` `plate` `count` `field` `row` `label` @since 1.5
     */
    css: Record<'btn' | 'primary' | 'tool' | 'chip' | 'inp' | 'secHead' | 'empty' | 'framed' | 'badge' | 'lamp' | 'glow'
      | 'cmd' | 'toggle' | 'plate' | 'count' | 'field' | 'row' | 'label', string>;
    /** Inject a stylesheet for this extension's panels (tokens only, per the style bible). Removed on dispose. @since 1.1 */
    style(css: string): Dispose;
  };
  theme: { cssVar(name: string): string };
  storage: { world(worldId?: string | null): Storage; global: Storage };
  /**
   * WASM helpers (R-EXT-WASM, 08-extensions §6): heavy work in a `.wasm` that the JS entry calls into.
   * WASM never drives the DOM. @since 1.3
   */
  wasm: {
    /**
     * Fetch `path` (relative to the package root, e.g. `'dist/pathfind.wasm'`) from the extension's own
     * base and instantiate it with `imports`. The path must be listed in the manifest's `muclient.wasm`
     * (a list of paths, or an object of path → sha256 hex); its sha256 is pinned at install and checked
     * on every load. Rejects when the path is not listed (dev extensions excepted), the bytes changed
     * since install (the extension then shows "changed" until the update is accepted), the file is not
     * WebAssembly, instantiation fails, the extension is a quick one, or it was deactivated before the
     * load finished.
     */
    load(path: string, imports?: WebAssembly.Imports): Promise<WasmLoaded>;
  };
  log: { info(...a: unknown[]): void; warn(...a: unknown[]): void; error(...a: unknown[]): void };
}

/** What `mu.wasm.load` resolves to. @since 1.3 */
export interface WasmLoaded {
  module: WebAssembly.Module;
  instance: WebAssembly.Instance;
  /** `instance.exports`, for convenience. */
  exports: WebAssembly.Exports;
}

export interface ExtensionContext {
  id: string;
  version: string;
  mu: Mu;
  /** Extra disposables to run on deactivate (things you created outside `mu`, e.g. timers). */
  subscriptions: Dispose[];
  /**
   * The exported API of another extension: the value its `activate` returned. Accepts the package name
   * (`@muclient/ext-tickets`) or the id (`tickets`). Waits while it is still activating; rejects when it
   * is not enabled in this world. @since 1.1
   */
  api<T = unknown>(otherId: string): Promise<T>;
}

export interface ExtensionDef {
  activate(ctx: ExtensionContext): void | unknown | Promise<void | unknown>;
  deactivate?(): void | Promise<void>;
}

/** Identity helper that gives the definition its types. */
export function defineExtension(def: ExtensionDef): ExtensionDef { return def; }
