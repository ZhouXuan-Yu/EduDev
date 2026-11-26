import type { BrowserWindow, BrowserWindowConstructorOptions, Rectangle } from 'electron';

export interface SettingsWindowOptions {
  create: (options: BrowserWindowConstructorOptions) => BrowserWindow;
  load: (window: BrowserWindow) => Promise<void>;
  preload: string;
  trustedUrl: string;
  main: () => BrowserWindow | undefined;
  workArea: () => Rectangle;
  onDim: (dimmed: boolean) => void;
  timeoutMs?: number;
}

/** Window lifecycle only. No configuration store, Pi lifecycle or domain actions. */
export class SettingsWindowController {
  private options: SettingsWindowOptions;
  private current?: BrowserWindow;
  private pending?: Promise<BrowserWindow>;
  private quitting = false;
  private ready = false;
  private dimmed = false;

  constructor(options: SettingsWindowOptions) { this.options = options; }
  get window() { return this.current; }

  private dim(value: boolean) {
    if (this.dimmed === value) return;
    this.dimmed = value;
    this.options.onDim(value);
  }

  open(): Promise<BrowserWindow> {
    if (this.quitting) return Promise.reject(new Error('settings_quitting'));
    if (this.pending) return this.pending;
    if (this.current && !this.current.isDestroyed()) {
      this.reveal(this.current);
      return Promise.resolve(this.current);
    }
    const area = this.options.workArea();
    const width = Math.min(960, area.width), height = Math.min(660, area.height);
    let window: BrowserWindow;
    try {
      window = this.options.create({
        x: Math.round(area.x + (area.width - width) / 2),
        y: Math.round(area.y + (area.height - height) / 2), width, height,
        minWidth: Math.min(760, area.width), minHeight: Math.min(540, area.height),
        title: '小智设置', show: false, modal: false, alwaysOnTop: false,
        backgroundColor: '#ffffff',
        webPreferences: { preload: this.options.preload, sandbox: true, contextIsolation: true, nodeIntegration: false },
      });
    } catch { return Promise.reject(new Error('settings_create_failed')); }
    this.current = window;
    this.ready = false;
    const main = this.options.main();
    const onMainFocus = () => this.dim(false);
    const onMainClosed = () => { if (!window.isDestroyed()) window.destroy(); };
    main?.on('focus', onMainFocus);
    main?.once('closed', onMainClosed);
    const offMain = () => { main?.removeListener('focus', onMainFocus); main?.removeListener('closed', onMainClosed); };
    window.on('focus', () => this.dim(this.current === window && !main?.isFocused()));
    window.on('blur', () => this.dim(false));
    window.on('hide', () => this.dim(false));
    window.on('minimize', () => this.dim(false));
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('will-frame-navigate', event => event.preventDefault());
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.on('render-process-gone', () => { if (!window.isDestroyed()) window.destroy(); });
    window.webContents.on('did-navigate', (_event, url) => {
      if (url !== this.options.trustedUrl && !window.isDestroyed()) window.destroy();
    });
    window.webContents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (isMainFrame && url !== this.options.trustedUrl && !window.isDestroyed()) window.destroy();
    });
    this.pending = new Promise<BrowserWindow>((resolve, reject) => {
      let settled = false, loaded = false, painted = false;
      const timer = setTimeout(() => fail(new Error('settings_load_timeout')), this.options.timeoutMs ?? 15000);
      const fail = (error: Error) => {
        if (settled) return;
        settled = true; clearTimeout(timer); this.pending = undefined;
        if (this.current === window) { this.current = undefined; this.ready = false; }
        this.dim(false); offMain();
        if (!window.isDestroyed()) window.destroy();
        reject(error);
      };
      const finish = () => {
        if (settled || !loaded || !painted) return;
        if (window.isDestroyed() || window.webContents.getURL() !== this.options.trustedUrl) { fail(new Error('settings_document_invalid')); return; }
        settled = true; clearTimeout(timer); this.pending = undefined; this.ready = true;
        this.reveal(window); resolve(window);
      };
      window.once('ready-to-show', () => { painted = true; finish(); });
      window.webContents.once('did-finish-load', () => { loaded = true; finish(); });
      window.webContents.once('did-fail-load', () => fail(new Error('settings_load_failed')));
      window.once('closed', () => {
        offMain(); this.dim(false);
        if (this.current === window) { this.current = undefined; this.ready = false; }
        if (!settled) fail(new Error('settings_closed'));
      });
      Promise.resolve().then(() => this.options.load(window)).catch(() => fail(new Error('settings_load_failed')));
    });
    return this.pending;
  }

  private reveal(window: BrowserWindow) {
    if (window.isMinimized()) window.restore();
    this.fit(); window.show(); window.focus();
  }

  fit() {
    const window = this.current;
    if (!window || window.isDestroyed()) return;
    const area = this.options.workArea(), bounds = window.getBounds();
    const width = Math.min(bounds.width, area.width), height = Math.min(bounds.height, area.height);
    window.setMinimumSize(Math.min(760, area.width), Math.min(540, area.height));
    window.setBounds({width, height, x: Math.max(area.x, Math.min(bounds.x, area.x + area.width - width)), y: Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))});
  }

  trusted(event: Pick<Electron.IpcMainInvokeEvent, 'sender' | 'senderFrame'>): boolean {
    const window = this.current;
    return !!window && this.ready && !window.isDestroyed()
      && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame
      && event.senderFrame?.url === this.options.trustedUrl && event.sender.getURL() === this.options.trustedUrl;
  }

  dispose() {
    this.quitting = true; this.dim(false);
    if (this.current && !this.current.isDestroyed()) this.current.destroy();
  }
}
