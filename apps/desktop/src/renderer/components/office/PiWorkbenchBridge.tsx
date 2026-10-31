import { useEffect, useRef } from 'react';
import { useWorkbenchState, type WorkbenchData } from '../../ui-system/WorkbenchState';

/** Publish navigation metadata only; never expose snapshots, file authority or model events. */
export function PiWorkbenchBridge({ data }: { data: WorkbenchData }) {
  const { publish } = useWorkbenchState();
  const latest = useRef(data);
  latest.current = data;
  useEffect(() => {
    publish({
      folders: data.folders, sessions: data.sessions, activeSessionId: data.activeSessionId,
      blocked: data.blocked, history: data.history,
      onNewSession: (folderId, title) => latest.current.onNewSession(folderId, title),
      onOpenSession: id => latest.current.onOpenSession(id),
      onCreateFolder: name => latest.current.onCreateFolder(name),
    });
  }, [publish, data.folders, data.sessions, data.activeSessionId, data.blocked]);
  useEffect(() => () => publish(undefined), [publish]);
  return null;
}
