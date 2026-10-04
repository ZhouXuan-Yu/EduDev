import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import type { OfficeReadingBookmark } from './OfficeReadingPosition';

/** Ephemeral input state only; the session-keyed provider survives layout reparenting. */
function useDraftState() {
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [failedPrompt, setFailedPrompt] = useState<string>();
  const [stopFailed, setStopFailed] = useState(false);
  const sendLock = useRef(false), stopLock = useRef(false);
  const [queueMode, setQueueMode] = useState<'steer' | 'followUp'>('steer');
  const [skillName, setSkillName] = useState('');
  const [showSkill, setShowSkill] = useState(false);
  const [controlDrafts, setControlDrafts] = useState<Record<string, OfficeControlDraft>>({});
  const controlLocks = useRef(new Map<string, { current: boolean }>());
  const readingBookmark = useRef<OfficeReadingBookmark | undefined>(undefined);
  return { draft, setDraft, submitting, setSubmitting, stopping, setStopping, failedPrompt, setFailedPrompt,
    stopFailed, setStopFailed, sendLock, stopLock, queueMode, setQueueMode, skillName, setSkillName, showSkill, setShowSkill,
    controlDrafts, setControlDrafts, controlLocks, readingBookmark };
}
const DraftContext = createContext<ReturnType<typeof useDraftState> | null>(null);

export function OfficeComposerState({ children }: { children: ReactNode }) {
  const state = useDraftState();
  return <DraftContext.Provider value={state}>{children}</DraftContext.Provider>;
}

export function useOfficeComposerState() {
  // Original standalone consumers retain their local state without a provider.
  const local = useDraftState();
  return useContext(DraftContext) ?? local;
}

interface OfficeControlDraft {
  answer: string; text: string; mode: 'steer' | 'followUp'; revision: number;
  editing: boolean; busy: boolean; error: string;
}
/** UI drafts and mutual exclusion survive layout changes; main still validates every action. */
export function useOfficeControlState(id: string, initial: Partial<OfficeControlDraft> = {}) {
  const context = useContext(DraftContext);
  const seed: OfficeControlDraft = { answer: '', text: '', mode: 'steer', revision: 0, editing: false, busy: false, error: '', ...initial };
  const [local, setLocal] = useState(seed), localLock = useRef(false);
  if (context && !context.controlLocks.current.has(id)) {
    const locks = context.controlLocks.current;
    if (locks.size >= 64) { const oldest = [...locks].find(([key, value]) => key !== id && !value.current); if (oldest) locks.delete(oldest[0]); }
    locks.set(id, { current: false });
  }
  const draft = context?.controlDrafts[id] ?? local;
  function update(patch: Partial<OfficeControlDraft>) {
    if (!context) { setLocal(previous => ({ ...previous, ...patch })); return; }
    context.setControlDrafts(previous => {
      const next = { ...previous, [id]: { ...(previous[id] ?? seed), ...patch } };
      if (Object.keys(next).length > 64) { const oldest = Object.keys(next).find(key => key !== id && !next[key].busy); if (oldest) delete next[oldest]; }
      return next;
    });
  }
  return { draft, update, lock: context?.controlLocks.current.get(id) ?? localLock };
}
