import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AiConversationWorkspace } from '../../shared/contracts';
import { defaultWorkbenchPreferences, readWorkbenchPreferences, writeWorkbenchPreferences, type WorkbenchPreferences } from './workbench-preferences';

export type WorkbenchData = {
  folders: AiConversationWorkspace['folders'];
  sessions: AiConversationWorkspace['sessions'];
  activeSessionId: string;
  blocked: boolean;
  history: (onSelected: () => void) => ReactNode;
  onNewSession: (folderId?: string | null, title?: string) => Promise<void>;
  onOpenSession: (id: string) => Promise<void>;
  onCreateFolder: (name: string) => Promise<void>;
};
type Publisher = (data?: WorkbenchData) => void;
const DataContext = createContext<WorkbenchData | undefined>(undefined);
const PublisherContext = createContext<Publisher>(() => {});
const PreferencesContext = createContext({ preferences: defaultWorkbenchPreferences, update: (_value: Partial<WorkbenchPreferences>): boolean => false });
export const useWorkbenchPreferences = () => useContext(PreferencesContext);

/** Presentation bridge only. Pi owns business data and callback lifetime. */
export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkbenchData>();
  const publish = useCallback<Publisher>(next => setData(next), []);
  const [preferences, setPreferences] = useState(readWorkbenchPreferences);
  const current = useRef(preferences);
  const update = useCallback((value: Partial<WorkbenchPreferences>) => {
    const next = { ...current.current, ...value };
    if (!writeWorkbenchPreferences(next)) return false;
    current.current = next;
    setPreferences(next);
    return true;
  }, []);
  const ui = useMemo(() => ({ preferences, update }), [preferences, update]);
  return <PublisherContext.Provider value={publish}><DataContext.Provider value={data}><PreferencesContext.Provider value={ui}>{children}</PreferencesContext.Provider></DataContext.Provider></PublisherContext.Provider>;
}
/** Publishers do not subscribe to their own payload. */
export const useWorkbenchPublisher = () => useContext(PublisherContext);
export function useWorkbenchState() {
  const data = useContext(DataContext);
  const publish = useWorkbenchPublisher();
  return useMemo(() => ({ data, publish }), [data, publish]);
}
