import { useLayoutEffect, useState } from 'react';

export type NavigationGroupId = 'ask' | 'materials' | 'teaching' | 'students';
type ExpandedGroups = Record<NavigationGroupId, boolean>;
const defaults: ExpandedGroups = { ask: true, materials: true, teaching: true, students: true };
export const NAVIGATION_PREFERENCES_KEY = 'xiaozhi.ui.navigation.v1';

/** UI preference only; never grants access or changes the current route. */
export function readNavigationGroups(): ExpandedGroups {
  const expanded = { ...defaults };
  try {
    const value = JSON.parse(localStorage.getItem(NAVIGATION_PREFERENCES_KEY) || 'null');
    if (value?.schema === 1 && value.expanded && typeof value.expanded === 'object') {
      for (const id of Object.keys(defaults) as NavigationGroupId[]) {
        if (typeof value.expanded[id] === 'boolean') expanded[id] = value.expanded[id];
      }
    }
  } catch { /* Storage failure must not block navigation. */ }
  return expanded;
}

export function useNavigationGroups(view: string, activeGroup?: NavigationGroupId) {
  const [expanded, setExpanded] = useState(() => {
    const saved = readNavigationGroups();
    if (activeGroup) saved[activeGroup] = true;
    return saved;
  });
  // Route changes (including history) reveal the destination, not every toggle.
  useLayoutEffect(() => {
    if (activeGroup) setExpanded((current) => current[activeGroup] ? current : { ...current, [activeGroup]: true });
  }, [view, activeGroup]);
  useLayoutEffect(() => {
    try {
      localStorage.setItem(NAVIGATION_PREFERENCES_KEY, JSON.stringify({ schema: 1, expanded }));
    } catch { /* Local preference only; in-memory state stays usable. */ }
  }, [expanded]);
  const toggle = (id: NavigationGroupId) => setExpanded((current) => ({ ...current, [id]: !current[id] }));
  return { expanded, toggle };
}
