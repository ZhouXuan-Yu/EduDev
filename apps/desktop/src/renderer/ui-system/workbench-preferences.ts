/** UI metadata only; shared across the retained Pi shell and current domain shell. */
export type WorkbenchPreferences = { collapsed: boolean; expanded: Record<string, boolean>; openFolders: Record<string, boolean> };
export const WORKBENCH_PREFERENCES_KEY = 'xiaozhi.ui.workbench.v1';
export const defaultWorkbenchPreferences: WorkbenchPreferences = { collapsed: false, expanded: { teaching: false, students: false }, openFolders: {} };
const LEGACY_KEY = 'xiaozhi.ui.v1';
function legacyPreferences(raw: string | null) {
  try {
    const value = JSON.parse(raw || 'null');
    if (value?.schema === 1 && typeof value.sidebar === 'boolean' && typeof value.aside === 'boolean')
      return { sidebar: value.sidebar, aside: value.aside, files: value.files === true };
  } catch { /* Invalid UI metadata is not authority. */ }
  return { sidebar: true, aside: false, files: false };
}
export function readWorkbenchPreferences(): WorkbenchPreferences {
  let fallback = false;
  try {
    fallback = !legacyPreferences(localStorage.getItem(LEGACY_KEY)).sidebar;
    const saved = JSON.parse(localStorage.getItem(WORKBENCH_PREFERENCES_KEY) || 'null');
    if (saved?.schema !== 1) return { ...defaultWorkbenchPreferences, collapsed: fallback };
    const flags = (value: unknown): Record<string, boolean> => value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')) : {};
    return { collapsed: typeof saved.collapsed === 'boolean' ? saved.collapsed : fallback, expanded: { ...defaultWorkbenchPreferences.expanded, ...flags(saved.expanded) }, openFolders: flags(saved.openFolders) };
  } catch { return { ...defaultWorkbenchPreferences, collapsed: fallback }; }
}

/** New navigation state wins; mirror the old sidebar boolean for retained callers.
 * Commit synchronously before publishing React state. A failed mirror/commit is
 * reported to the caller; restore the mirror if the canonical write fails.
 */
export function writeWorkbenchPreferences(value: WorkbenchPreferences): boolean {
  let previous: string | null = null, mirrored = false;
  try {
    previous = localStorage.getItem(LEGACY_KEY);
    const legacy = legacyPreferences(previous);
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ schema: 1, sidebar: !value.collapsed, aside: legacy.aside, ...(legacy.files ? { files: true } : {}) }));
    mirrored = true;
    localStorage.setItem(WORKBENCH_PREFERENCES_KEY, JSON.stringify({ schema: 1, ...value }));
    return true;
  } catch {
    if (mirrored) {
      try { if (previous === null) localStorage.removeItem(LEGACY_KEY); else localStorage.setItem(LEGACY_KEY, previous); } catch { /* Storage remains unavailable; never claim success. */ }
    }
    return false;
  }
}
