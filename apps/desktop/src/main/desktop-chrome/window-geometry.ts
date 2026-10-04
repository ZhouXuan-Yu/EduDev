import { app, screen, type BrowserWindow, type Rectangle } from 'electron';
import { readFileSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { attachDesktopWindowSizePersistence, resolveDesktopWindowSize, type DesktopWindowSize } from './zcode-window-size';

type WindowGeometry = DesktopWindowSize & { version: 1; x: number; y: number };
const geometryEnabled = () => process.env.OMNI_EDU_WINDOW_GEOMETRY !== '0';
const geometryPath = () => join(app.getPath('userData'), 'desktop-window.v1.json');

/** UI metadata only. Unknown versions/fields cannot restore task/file authority. */
export function parseWindowGeometry(value: unknown): WindowGeometry | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const entry = value as Record<string, unknown>;
  if (Object.keys(entry).sort().join(',') !== 'height,maximized,version,width,x,y' || entry.version !== 1 || typeof entry.maximized !== 'boolean') return;
  for (const key of ['x', 'y', 'width', 'height']) {
    if (!Number.isSafeInteger(entry[key]) || Math.abs(entry[key] as number) > 1000000) return;
  }
  if ((entry.width as number) < 1100 || (entry.height as number) < 720) return;
  return entry as WindowGeometry;
}

export function resolveWindowGeometry(saved: WindowGeometry | undefined, area: Rectangle) {
  const size = resolveDesktopWindowSize(saved, area);
  // Minimum host size stays unchanged. On an undersized screen keep the titlebar reachable.
  const x = Math.min(Math.max(saved?.x ?? area.x + Math.floor((area.width - size.width) / 2), area.x), area.x + Math.max(0, area.width - size.width));
  const y = Math.min(Math.max(saved?.y ?? area.y + Math.floor((area.height - size.height) / 2), area.y), area.y + Math.max(0, area.height - size.height));
  return { ...size, x, y };
}

export function restoreWindowGeometry() {
  if (!geometryEnabled()) return { width: 1360, height: 900, maximized: false };
  let saved: WindowGeometry | undefined;
  try {
    if (statSync(geometryPath()).size <= 4096) saved = parseWindowGeometry(JSON.parse(readFileSync(geometryPath(), 'utf8')));
  } catch { /* Missing/corrupt UI preferences must not block a desktop session. */ }
  const area = saved ? screen.getDisplayMatching(saved).workArea : screen.getPrimaryDisplay().workArea;
  return resolveWindowGeometry(saved, area);
}

export function installWindowGeometry(window: BrowserWindow, maximized: boolean, bounds: Partial<Rectangle>) {
  // Windows constructor/non-client setup may enlarge height under fractional DPI.
  // Reapply saved normal bounds after installing the native frame to avoid restart drift.
  if (geometryEnabled()) {
    window.setBounds(bounds);
    // Fractional DPI can round an exact work-area dimension outward by one DIP.
    // Correct only measured overflow, preserving exact saved bounds away from screen edges.
    for (let correction = 1; correction <= 2; correction++) {
      const actual = window.getBounds(), area = screen.getDisplayMatching(actual).workArea;
      const width = actual.width > area.width && area.width > 1100 ? area.width - correction : actual.width;
      const height = actual.height > area.height && area.height > 720 ? area.height - correction : actual.height;
      const x = actual.x < area.x ? area.x : actual.x + width > area.x + area.width
        ? area.x + Math.max(0, area.width - width - correction) : actual.x;
      const y = actual.y < area.y ? area.y : actual.y + height > area.y + area.height
        ? area.y + Math.max(0, area.height - height - correction) : actual.y;
      const adjusted: Partial<Rectangle> = {};
      if (width !== actual.width) adjusted.width = width;
      if (height !== actual.height) adjusted.height = height;
      if (x !== actual.x) adjusted.x = x;
      if (y !== actual.y) adjusted.y = y;
      if (!Object.keys(adjusted).length) break;
      window.setBounds(adjusted);
    }
  }
  if (maximized) window.maximize();
  if (!geometryEnabled()) return;
  let previous = '';
  const save = () => {
    if (window.isDestroyed()) return;
    const bounds = window.getNormalBounds();
    const entry = parseWindowGeometry({ version: 1, ...bounds, maximized: window.isMaximized() });
    if (!entry) return;
    const serialized = JSON.stringify(entry);
    if (serialized === previous) return;
    try {
      // Tiny synchronous atomic write: a final close cannot race an async write or lock.
      const target = geometryPath();
      writeFileSync(`${target}.tmp`, serialized, { mode: 0o600 });
      renameSync(`${target}.tmp`, target);
      previous = serialized;
    } catch { /* No private paths or fatal failure for an optional UI preference. */ }
  };
  attachDesktopWindowSizePersistence(window, async () => save());
  // Original ZCode handles resize/maximize; host adds position and last pre-close resize.
  window.on('moved', save);
  window.on('close', save);
}
