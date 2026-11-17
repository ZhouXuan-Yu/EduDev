import {useEffect, useRef, useState} from 'react';
import {ACQUISITION_ERRORS, type AcquisitionApiResult, type AcquisitionMutation, type AcquisitionView} from '../../../shared/xiaozhi-acquisition';

type Lifecycle = {sessionId: string; active: boolean; request: number; action: number};
export const acquisitionMessage = (code: string) => ACQUISITION_ERRORS[code] || ACQUISITION_ERRORS.acquisition_failed;
const message = acquisitionMessage;

async function bounded<T>(work: Promise<T> | undefined): Promise<T | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(work), new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(Error('unavailable')), 10000);
    })]);
  } finally {clearTimeout(timer);}
}

/** Shares session-bound acquisition projections and request ordering across settings surfaces. */
export function usePiAcquisition(sessionId = '') {
  const [received, setReceived] = useState<{sessionId: string; value: AcquisitionView}>();
  const view = received?.sessionId === sessionId ? received.value : undefined;
  const [notice, setNotice] = useState('');
  const [readNotice, setReadNotice] = useState('');
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [pending, setPending] = useState<'search' | 'mutation' | null>(null);
  const [preparingId, setPreparingId] = useState<string>();
  const section = useRef<HTMLDivElement>(null);
  const selectedSession = useRef(sessionId);
  selectedSession.current = sessionId;
  const lifecycle = useRef<Lifecycle>({sessionId, active: false, request: 0, action: 0});
  const reading = useRef<symbol | undefined>(undefined);
  const acting = useRef<symbol | undefined>(undefined);
  const preparing = useRef<symbol | undefined>(undefined);

  function current(owner: Lifecycle, revision?: number) {
    return owner.active && lifecycle.current === owner && selectedSession.current === owner.sessionId
      && (revision === undefined || owner.request === revision);
  }
  async function accept(work: () => Promise<AcquisitionApiResult<AcquisitionView> | undefined> | undefined, owner: Lifecycle, kind: 'read' | 'action' = 'read', waitForActualResult = false) {
    const revision = ++owner.request;
    const reportError = kind === 'read' ? setReadNotice : setNotice;
    try {
      const result = await (waitForActualResult ? work() : bounded(work()));
      if (!current(owner, revision)) return;
      if (!result?.ok) {reportError(message(result?.error || 'unavailable')); return;}
      if (result.value.context && result.value.context.sessionId !== owner.sessionId) {
        reportError(message('permission_denied')); return;
      }
      setReceived({sessionId: owner.sessionId, value: result.value}); setReadNotice('');
      if (kind === 'action') setNotice('');
    } catch {
      if (current(owner, revision)) reportError(message('unavailable'));
    } finally {if (current(owner, revision)) setLoading(false);}
  }
  async function refresh() {
    const owner = lifecycle.current;
    if (!owner.sessionId || !current(owner) || reading.current || acting.current) return;
    const token = Symbol('acquisition-read'); reading.current = token;
    let dispatched = false;
    try {
      await accept(() => {
        const work = window.omniEdu?.getXiaozhiAcquisition(owner.sessionId);
        dispatched = true;
        // A renderer deadline cannot cancel IPC. Keep its single-flight lease until it really settles.
        return Promise.resolve(work).finally(() => {if (reading.current === token) reading.current = undefined;});
      }, owner);
    } finally {if (!dispatched && reading.current === token) reading.current = undefined;}
  }
  useEffect(() => {
    const owner: Lifecycle = {sessionId, active: true, request: 0, action: 0};
    lifecycle.current = owner; reading.current = undefined; acting.current = undefined; preparing.current = undefined;
    setReceived(undefined); setNotice(''); setReadNotice(''); setPending(null); setPreparingId(undefined); setLoading(Boolean(sessionId));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inView = typeof IntersectionObserver === 'undefined';
    let polling = false;
    const visible = () => inView && document.visibilityState === 'visible';
    async function poll() {
      if (!current(owner) || !visible() || polling || !sessionId) return;
      polling = true;
      try {await refresh();}
      finally {
        polling = false;
        if (current(owner) && visible()) timer = setTimeout(() => void poll(), 1200);
      }
    }
    function visibilityChanged() {
      clearTimeout(timer);
      if (visible()) void poll();
    }
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0); visibilityChanged();
    });
    if (section.current) observer?.observe(section.current);
    document.addEventListener('visibilitychange', visibilityChanged);
    if (inView) void poll();
    return () => {
      owner.active = false; owner.request++; clearTimeout(timer); observer?.disconnect();
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [sessionId]);

  async function search(query: string) {
    const owner = lifecycle.current;
    if (!owner.sessionId || !query.trim() || acting.current || !current(owner)) return;
    owner.action++;
    const token = Symbol('acquisition-search'); acting.current = token; setPending('search'); setNotice('');
    try {await accept(() => window.omniEdu?.searchXiaozhiAcquisition({sessionId: owner.sessionId, query: query.trim()}), owner, 'action');}
    finally {if (acting.current === token) {acting.current = undefined; if (current(owner)) setPending(null);}}
  }
  async function mutate(input: AcquisitionMutation) {
    const owner = lifecycle.current;
    if (acting.current || !current(owner) || input.sessionId !== owner.sessionId) return;
    if ((input.action === 'extension_select') && !view?.context) {setNotice(message('task_required')); return;}
    if (input.action === 'prepare' || input.action === 'extension_prepare') {
      if (!view?.context) {setNotice(message('task_required')); return;}
      if (preparing.current) return;
      const action = ++owner.action;
      const token = Symbol('acquisition-prepare'); preparing.current = token;
      owner.request++; setPreparingId(input.action === 'prepare' ? input.candidateId : input.artifactId); setNotice('');
      try {
        // The main API waits for the pipeline. Read polling and safe controls stay available.
        const result = await window.omniEdu?.mutateXiaozhiAcquisition(input);
        // A later search/cancel/revoke owns the visible result, including its pending response.
        if (!current(owner) || owner.action !== action) return;
        if (!result?.ok) {setNotice(message(result?.error || 'unavailable')); return;}
        if (result.value.context && result.value.context.sessionId !== owner.sessionId) {
          setNotice(message('permission_denied')); return;
        }
        owner.request++; setReceived({sessionId: owner.sessionId, value: result.value}); setReadNotice(''); setLoading(false);
      } catch {if (current(owner) && owner.action === action) setNotice(message('unavailable'));}
      finally {
        if (preparing.current === token) {preparing.current = undefined; if (current(owner)) setPreparingId(undefined);}
      }
      return;
    }
    owner.action++;
    const token = Symbol('acquisition-mutation'); acting.current = token; setPending('mutation'); setNotice('');
    // A native picker stays owned until main reports the user's choice and finishes importing.
    try {await accept(() => window.omniEdu?.mutateXiaozhiAcquisition(input), owner, 'action', input.action === 'extension_import');}
    finally {if (acting.current === token) {acting.current = undefined; if (current(owner)) setPending(null);}}
  }

  return {view, section, loading, pending, preparingId, notice: notice || readNotice, refresh, search, mutate};
}
