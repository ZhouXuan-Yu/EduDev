/** Presentation only. This record never grants model, memory or file authority. */
export type WorkspacePreferences = { sidebar: boolean; aside: boolean; files: boolean };
export const WORKSPACE_PREFERENCES_KEY = 'xiaozhi.ui.v1';
export function readWorkspacePreferences(): WorkspacePreferences {
  try {
    const value = JSON.parse(localStorage.getItem(WORKSPACE_PREFERENCES_KEY) || 'null');
    if (value?.schema === 1 && typeof value.sidebar === 'boolean' && typeof value.aside === 'boolean')
      return { sidebar: value.sidebar, aside: value.aside, files: value.files === true };
  } catch { /* Invalid or inaccessible preferences must not block the workspace. */ }
  return { sidebar: true, aside: true, files: false };
}
export function writeWorkspacePreferences(value: WorkspacePreferences): boolean {
  try {
    localStorage.setItem(WORKSPACE_PREFERENCES_KEY, JSON.stringify({ schema: 1, sidebar: value.sidebar, aside: value.aside, ...(value.files ? { files: true } : {}) }));
    return true;
  } catch { return false; }
}
