/** UI metadata only; shared across the retained Pi shell and current domain shell. */
export type WorkbenchPreferences = { collapsed: boolean; expanded: Record<string, boolean>; openFolders: Record<string, boolean> };
export const WORKBENCH_PREFERENCES_KEY = 'xiaozhi.ui.workbench.v1';
export const defaultWorkbenchPreferences: WorkbenchPreferences = { collapsed: false, expanded: { teaching: false, students: false }, openFolders: {} };
export function readWorkbenchPreferences(): WorkbenchPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(WORKBENCH_PREFERENCES_KEY) || 'null');
    if (saved?.schema !== 1) return defaultWorkbenchPreferences;
    const flags = (value: unknown): Record<string, boolean> => value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')) : {};
    return { collapsed: saved.collapsed === true, expanded: { ...defaultWorkbenchPreferences.expanded, ...flags(saved.expanded) }, openFolders: flags(saved.openFolders) };
  } catch { return defaultWorkbenchPreferences; }
}
