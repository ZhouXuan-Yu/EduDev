import {useEffect, useReducer, useRef, useState} from 'react';
import {TERMINAL_INPUT_FRAME_BYTES, type TerminalInputAck, type TerminalJobView} from '../../../../shared/xiaozhi-terminal-jobs';
import {TERMINAL_OUTPUT_LIMIT} from '../../../../shared/xiaozhi-terminal';
import {bounded, commandRef, mergeJob, splitInput, terminalFeedback, terminalMessage, type TerminalFrame, type TerminalFeedbackAction} from './terminalState';

type Owner = {sessionId: string; jobId: string; active: boolean};
type InputCommand = {owner: Owner; commandId: string; sequence?: number; uncertain: boolean; timer?: ReturnType<typeof setTimeout>};
type InputChunk = {kind: 'write'; chars: string} | {kind: 'eof'};
type Control = 'closeInput' | 'close' | 'takeControl';
export function useTerminalSession(sessionId: string, jobId = '', initial?: TerminalJobView) {
  const key = sessionId + '/' + jobId;
  const [received, setReceived] = useState<{key: string; job: TerminalJobView}>();
  const [output, setOutput] = useState(''), [frames, setFrames] = useState<TerminalFrame[]>([]);
  const [loading, setLoading] = useState(Boolean(jobId));
  const [feedback, dispatchFeedback] = useReducer(terminalFeedback, {});
  const error = feedback.control?.message || feedback.input?.message || feedback.resize?.message || feedback.read?.message || '';
  function fail(area: Exclude<TerminalFeedbackAction, {type: 'reset'}>['area'], code: string, operation?: string | symbol) {
    dispatchFeedback({type: 'set', area, message: terminalMessage(code), owner: operation});
  }
  function clear(area: Exclude<TerminalFeedbackAction, {type: 'reset'}>['area'], operation?: string | symbol) {
    dispatchFeedback({type: 'clear', area, owner: operation});
  }
  const [writing, setWriting] = useState(false), [uncertain, setUncertain] = useState<{commandId: string; sequence?: number}>();
  const [controlPending, setControlPending] = useState(false), [resetNotice, setResetNotice] = useState(false);
  const [inputNotice, setInputNotice] = useState('');
  const [closing, setClosing] = useState(false);
  const section = useRef<HTMLDivElement>(null), selected = useRef(key); selected.current = key;
  const owner = useRef<Owner>({sessionId, jobId, active: false});
  const latest = useRef<TerminalJobView | undefined>(undefined), reading = useRef<symbol | undefined>(undefined), control = useRef<symbol | undefined>(undefined);
  const cursor = useRef(0), delivery = useRef(0), shown = useRef(''), visible = useRef(true);
  const queue = useRef<InputChunk[]>([]), pending = useRef<InputCommand | undefined>(undefined);
  const inputTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), resizeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dimensions = useRef<{cols: number; rows: number} | undefined>(undefined);
  const job = received?.key === key ? received.job : undefined;
  function current(candidate: Owner) {return candidate.active && owner.current === candidate && selected.current === candidate.sessionId + '/' + candidate.jobId;}
  function acceptJob(incoming: TerminalJobView, candidate: Owner) {
    if (!current(candidate) || incoming.sessionId !== candidate.sessionId || incoming.jobId !== candidate.jobId) return false;
    const previous = latest.current;
    if (previous && previous.taskId !== incoming.taskId) return false;
    const merged = mergeJob(previous, incoming);
    if (previous && (merged.controllerRevision !== previous.controllerRevision || merged.leaseRevision !== previous.leaseRevision)) {
      if (queue.current.length) {queue.current = []; setInputNotice('终端控制状态已变更，尚未发送的输入已停止。');}
      if (pending.current) unknown(pending.current, pending.current.sequence);
    }
    latest.current = merged; setReceived({key: selected.current, job: merged}); return true;
  }
  function scheduleInput(candidate: Owner) {
    if (!current(candidate) || inputTimer.current) return;
    inputTimer.current = setTimeout(() => {inputTimer.current = undefined; void drain(candidate);}, 40);
  }
  function confirmed(command: InputCommand) {
    if (!current(command.owner) || pending.current !== command) return;
    clearTimeout(command.timer); pending.current = undefined; setUncertain(undefined); setWriting(false); clear('input', command.commandId); scheduleInput(command.owner);
    if (dimensions.current) resize(dimensions.current.cols, dimensions.current.rows);
  }
  function unknown(command: InputCommand, sequence?: number) {
    if (!current(command.owner) || pending.current !== command) return;
    command.uncertain = true; command.sequence = sequence;
    setWriting(false); setUncertain({commandId: command.commandId, sequence}); fail('input', 'unknown_ack', command.commandId);
  }
  function reconcile(candidate: Owner, incoming: TerminalJobView, ack?: TerminalInputAck) {
    const command = pending.current;
    if (!command?.uncertain || command.owner !== candidate || !current(candidate)) return;
    const exact = ack?.jobId === candidate.jobId && ack.commandId === command.commandId && Number.isSafeInteger(ack.sequence) && ack.sequence > 0;
    if (exact && ack.state === 'unknown') {unknown(command, ack.sequence); return;}
    const knownSequence = command.sequence !== undefined && incoming.acknowledgedInputSequence >= command.sequence
      && incoming.notice !== 'unknown_ack' && incoming.controls.write;
    if (exact && ack.state === 'acknowledged' || knownSequence) confirmed(command);
  }
  async function refresh() {
    const candidate = owner.current;
    if (!candidate.jobId || !current(candidate) || reading.current) return;
    const token = Symbol('terminal-read'); reading.current = token;
    let more = false;
    const commandId = pending.current?.commandId;
    try {
      const work = Promise.resolve(window.omniEdu?.readXiaozhiTerminal({sessionId: candidate.sessionId, jobId: candidate.jobId,
        sinceSequence: cursor.current, ...(commandId ? {commandId} : {})}));
      const result = await bounded(work.finally(() => {if (reading.current === token) reading.current = undefined;}));
      if (!current(candidate)) return;
      if (!result?.ok) {fail('read', result?.error || 'unavailable', token); return;}
      const read = result.data;
      if (read.sessionId !== candidate.sessionId || !acceptJob(read.job, candidate)) {fail('read', 'permission_denied', token); return;}
      reconcile(candidate, read.job, read.ack);
      if (read.reset || read.sequence > cursor.current) {
        if (read.reset && cursor.current > 0) setResetNotice(true);
        shown.current = (read.reset ? read.output : shown.current + read.output).slice(-TERMINAL_OUTPUT_LIMIT);
        if (/^[\uDC00-\uDFFF]/.test(shown.current)) shown.current = shown.current.slice(1);
        cursor.current = read.sequence; setOutput(shown.current);
        if (read.output || read.reset) {
          const frame = {deliveryId: ++delivery.current, reset: read.reset, text: read.output};
          setFrames(previous => [...previous, frame].slice(-64));
        }
      }
      clear('read'); more = read.hasMore || read.job.outputSequence > cursor.current;
    } catch {if (current(candidate)) fail('read', 'unavailable', token);}
    finally {
      if (current(candidate)) setLoading(false);
      if (more && current(candidate) && visible.current) setTimeout(() => void refresh(), 0);
    }
  }
  async function drain(candidate: Owner) {
    if (!current(candidate) || pending.current || control.current || !queue.current.length) return;
    const active = latest.current;
    const chunk = queue.current[0];
    if (!active || !(chunk.kind === 'eof' ? active.controls.eof : active.controls.write)) {queue.current = []; fail('input', 'changed'); return;}
    queue.current.shift(); const ref = commandRef(active);
    const command: InputCommand = {owner: candidate, commandId: ref.commandId, uncertain: false}; pending.current = command; setWriting(true);
    command.timer = setTimeout(() => unknown(command), 10000);
    try {
      const result = chunk.kind === 'eof' ? await window.omniEdu?.sendEofXiaozhiTerminal(ref)
        : await window.omniEdu?.writeXiaozhiTerminal({...ref, chars: chunk.chars});
      if (!current(candidate) || pending.current !== command) return;
      if (!result?.ok) {
        if (result?.error === 'unknown_ack') {unknown(command); return;}
        queue.current = []; pending.current = undefined; setWriting(false); fail('input', result?.error || 'unavailable', command.commandId); return;
      }
      if (!acceptJob(result.data.job, candidate)) {unknown(command); return;}
      const ack = result.data.ack;
      if (ack.jobId !== candidate.jobId || ack.commandId !== command.commandId || !Number.isSafeInteger(ack.sequence) || ack.sequence < 1) {unknown(command); return;}
      if (ack.state === 'unknown') unknown(command, ack.sequence);
      else confirmed(command);
    } catch {unknown(command);}
    finally {clearTimeout(command.timer);}
  }
  function enqueue(chars: string) {
    const candidate = owner.current, active = latest.current;
    if (!current(candidate) || !active?.controls.write || pending.current?.uncertain || !chars) return false;
    const maximum = Math.min(active.inputMaxBytes, TERMINAL_INPUT_FRAME_BYTES);
    try {
      const bytes = queue.current.reduce((sum, chunk) => sum + (chunk.kind === 'write' ? new TextEncoder().encode(chunk.chars).length : 1), 0)
        + new TextEncoder().encode(chars).length;
      if (bytes > maximum * 4) {fail('input', 'input_backpressure'); return false;}
      const tail = queue.current[queue.current.length - 1];
      const chunks = splitInput((tail?.kind === 'write' ? tail.chars : '') + chars, maximum);
      if (tail?.kind === 'write') queue.current.pop();
      queue.current.push(...chunks.map(text => ({kind: 'write' as const, chars: text}))); setInputNotice(''); clear('input'); scheduleInput(candidate); return true;
    } catch {fail('input', 'input_limit'); return false;}
  }
  function eof() {
    const candidate = owner.current;
    if (!current(candidate) || !latest.current?.controls.eof || pending.current?.uncertain) return;
    if (queue.current.length >= 4) {fail('input', 'input_backpressure'); return;}
    queue.current.push({kind: 'eof'}); setInputNotice(''); clear('input'); scheduleInput(candidate);
  }
  async function act(action: Control) {
    const candidate = owner.current, active = latest.current;
    if (!current(candidate) || !active || !active.controls[action]) return;
    if (control.current && action !== 'close') {fail('control', 'busy'); return;}
    if (action === 'close') queue.current = [];
    const token = Symbol('terminal-control'); control.current = token; setControlPending(true); setClosing(action === 'close'); clear('control');
    try {
      const ref = commandRef(active), api = window.omniEdu;
      const work = action === 'closeInput' ? api?.closeInputXiaozhiTerminal(ref) : action === 'close' ? api?.closeXiaozhiTerminal(ref) : api?.takeControlXiaozhiTerminal(ref);
      const result = await bounded(work);
      if (!current(candidate) || control.current !== token) return;
      if (!result?.ok) {fail('control', result?.error || 'unavailable', token); return;}
      if (!acceptJob(result.data, candidate)) fail('control', 'permission_denied', token);
    } catch {if (current(candidate) && control.current === token) fail('control', 'unavailable', token);}
    finally {if (control.current === token) {control.current = undefined; if (current(candidate)) {setControlPending(false); setClosing(false); scheduleInput(candidate);
      if (dimensions.current) resize(dimensions.current.cols, dimensions.current.rows);}}}
  }
  function resize(cols: number, rows: number) {
    const candidate = owner.current;
    if (!current(candidate) || !Number.isSafeInteger(cols) || !Number.isSafeInteger(rows) || cols < 1 || rows < 1 || cols > 1000 || rows > 1000) return;
    dimensions.current = {cols, rows}; clearTimeout(resizeTimer.current);
    resizeTimer.current = setTimeout(() => {
      const active = latest.current;
      if (!current(candidate) || !active?.controls.resize || pending.current || control.current) return;
      if (dimensions.current?.cols === cols && dimensions.current.rows === rows) dimensions.current = undefined;
      const token = Symbol('terminal-resize'); control.current = token;
      void bounded(Promise.resolve().then(() => window.omniEdu?.resizeXiaozhiTerminal({...commandRef(active), cols, rows}))).then(result => {
        if (!current(candidate) || control.current !== token) return;
        if (!result?.ok) fail('resize', result?.error || 'unavailable', token);
        else {acceptJob(result.data, candidate); clear('resize');}
      }).catch(() => {if (current(candidate) && control.current === token) fail('resize', 'unavailable', token);})
        .finally(() => {if (control.current === token) {control.current = undefined; scheduleInput(candidate);
          if (dimensions.current) resize(dimensions.current.cols, dimensions.current.rows);}});
    }, 80);
  }
  useEffect(() => {
    const candidate: Owner = {sessionId, jobId, active: true}; owner.current = candidate;
    latest.current = undefined; cursor.current = 0; delivery.current = 0; shown.current = ''; queue.current = []; pending.current = undefined;
    reading.current = undefined; control.current = undefined; dimensions.current = undefined;
    setReceived(undefined); setOutput(''); setFrames([]); dispatchFeedback({type: 'reset'}); setInputNotice(''); setUncertain(undefined); setWriting(false); setControlPending(false); setClosing(false); setResetNotice(false); setLoading(Boolean(jobId));
    if (initial && initial.jobId === jobId && initial.sessionId === sessionId) acceptJob(initial, candidate);
    if (!jobId || !sessionId) {setLoading(false); return () => {candidate.active = false;};}
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inView = typeof IntersectionObserver === 'undefined';
    let polling = false;
    async function poll() {
      if (!current(candidate) || polling || !inView || document.visibilityState !== 'visible') return;
      polling = true;
      try {await refresh();} finally {polling = false; if (current(candidate)) timer = setTimeout(() => void poll(), 1200);}
    }
    function visibilityChanged() {clearTimeout(timer); visible.current = inView && document.visibilityState === 'visible'; if (visible.current) void poll();}
    const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > 0); visibilityChanged();
    });
    if (section.current) observer?.observe(section.current);
    const unsubscribe = window.omniEdu?.onXiaozhiTerminal(event => {
      if (event.sessionId === sessionId && event.job.jobId === jobId && acceptJob(event.job, candidate) && visible.current) void refresh();
    });
    document.addEventListener('visibilitychange', visibilityChanged); if (inView) void poll();
    return () => {candidate.active = false; queue.current = []; clearTimeout(timer); clearTimeout(pending.current?.timer); clearTimeout(inputTimer.current); inputTimer.current = undefined;
      clearTimeout(resizeTimer.current); observer?.disconnect(); unsubscribe?.(); document.removeEventListener('visibilitychange', visibilityChanged);};
  }, [sessionId, jobId]);
  useEffect(() => {if (initial) acceptJob(initial, owner.current);}, [initial]);
  return {job, section, output, frames, loading, error, writing, uncertain, controlPending, closing, resetNotice, inputNotice, refresh, enqueue, eof, resize, act};
}
