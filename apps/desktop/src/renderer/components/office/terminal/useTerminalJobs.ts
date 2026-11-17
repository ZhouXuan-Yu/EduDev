import {useEffect, useRef, useState} from 'react';
import type {TerminalJobView} from '../../../../shared/xiaozhi-terminal-jobs';
import {bounded, mergeJob, terminalMessage} from './terminalState';

export function useTerminalJobs(sessionId: string) {
  const [received, setReceived] = useState<{sessionId: string; jobs: TerminalJobView[]}>();
  const [loading, setLoading] = useState(Boolean(sessionId)), [error, setError] = useState('');
  const selected = useRef(sessionId); selected.current = sessionId;
  const lifecycle = useRef({sessionId, active: false, revision: 0});
  const reading = useRef<symbol | undefined>(undefined);
  function current(owner: typeof lifecycle.current) {return owner.active && lifecycle.current === owner && selected.current === owner.sessionId;}
  async function refresh() {
    const owner = lifecycle.current;
    if (!owner.sessionId || !current(owner) || reading.current) return;
    const token = Symbol('terminal-list'), revision = ++owner.revision; reading.current = token; setLoading(true);
    try {
      const result = await bounded(Promise.resolve(window.omniEdu?.listXiaozhiTerminals(owner.sessionId))
        .finally(() => {if (reading.current === token) reading.current = undefined;}));
      if (!current(owner) || owner.revision !== revision) return;
      if (!result?.ok) {setError(terminalMessage(result?.error || 'unavailable')); return;}
      if (result.data.sessionId !== owner.sessionId || result.data.jobs.some(job => job.sessionId !== owner.sessionId)) {
        setError(terminalMessage('permission_denied')); return;
      }
      setReceived(previous => ({sessionId: owner.sessionId, jobs: result.data.jobs.map(job => {
        const saved = previous?.sessionId === owner.sessionId ? previous.jobs.find(item => item.jobId === job.jobId) : undefined;
        const merged = mergeJob(saved, job);
        return {...merged, terminal: {...merged.terminal, output: ''}};
      })})); setError('');
    } catch {if (current(owner) && owner.revision === revision) setError(terminalMessage('unavailable'));}
    finally {if (current(owner)) setLoading(false);}
  }
  useEffect(() => {
    const owner = {sessionId, active: true, revision: 0}; lifecycle.current = owner; reading.current = undefined;
    setReceived(undefined); setError(''); setLoading(Boolean(sessionId));
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polling = false;
    async function poll() {
      if (!current(owner) || polling || document.visibilityState !== 'visible') return;
      polling = true;
      try {await refresh();} finally {polling = false; if (current(owner)) timer = setTimeout(() => void poll(), 1500);}
    }
    function visible() {clearTimeout(timer); if (document.visibilityState === 'visible') void poll();}
    const unsubscribe = window.omniEdu?.onXiaozhiTerminal(event => {
      if (!current(owner) || event.sessionId !== sessionId || event.job.sessionId !== sessionId) return;
      owner.revision++; setLoading(false);
      setReceived(previous => {
        const jobs = previous?.sessionId === sessionId ? previous.jobs : [];
        const incoming = mergeJob(jobs.find(job => job.jobId === event.job.jobId), event.job);
        return {sessionId, jobs: [{...incoming, terminal: {...incoming.terminal, output: ''}}, ...jobs.filter(job => job.jobId !== incoming.jobId)]};
      });
    });
    document.addEventListener('visibilitychange', visible); void poll();
    return () => {owner.active = false; clearTimeout(timer); unsubscribe?.(); document.removeEventListener('visibilitychange', visible);};
  }, [sessionId]);
  return {jobs: received?.sessionId === sessionId ? received.jobs : [], loading, error, refresh};
}
