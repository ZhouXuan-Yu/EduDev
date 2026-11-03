import {useLayoutEffect, useRef, useState} from 'react';
import {PAPER_REFERENCE_SCHEMA, unknownReferenceField, type PaperReferenceTarget, type PaperReferenceSource, type PaperReferenceCandidate,
  type ReferenceField, type PaperReferenceError} from '../../../shared/paper-reference';
import {useDesktopNavigation} from '../desktop/DesktopFrame';

const errors: Record<PaperReferenceError, string> = {
  invalid_input: '参考卷请求不完整，请重新选择来源。', permission_denied: '当前会话或资料不可用于此题篮，请重新核实。',
  source_changed: '参考资料已变化。原候选与本机修改保留供核对，请取消后选择当前资料重新提取。',
  conflict: '题篮已变化或已归档，请取消核对并重新读取题篮。', unavailable: '资料尚不可读取，请到资料库检查收录状态。',
  too_large: '资料超出本次有界读取范围，请分段检查后再选择。', cancelled: '已取消提取，题篮未改变。',
  parse_failed: '无法可靠读取原文件的页面设置，请到资料库检查文件。', busy: '上次读取正在结束，请稍后再次提取。',
};
type Basket = {id: string; sessionId: string; revision: number};
export function usePaperReference(basket: Basket | undefined) {
  const navigation = useDesktopNavigation();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [listing, setListing] = useState(false);
  const [candidate, setCandidate] = useState<PaperReferenceCandidate>(), [dirty, setDirty] = useState(false);
  const [items, setItems] = useState<PaperReferenceSource[]>([]), [offset, setOffset] = useState(0), [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState(''), [error, setError] = useState(''), [discarding, setDiscarding] = useState(false);
  const [sourceInvalid, setSourceInvalid] = useState(false);
  const epoch = useRef(0), alive = useRef(true), opened = useRef(false), editing = useRef(false);
  const pending = useRef<{target: PaperReferenceTarget; requestId: string} | undefined>(undefined);
  const listStamp = useRef(0), reading = useRef(false);
  const targetRef = useRef(basket); targetRef.current = basket;
  const key = basket ? `${basket.sessionId}:${basket.id}:${basket.revision}` : '';
  const target = (): PaperReferenceTarget | undefined => {
    const b = targetRef.current;
    return b ? {schemaVersion: PAPER_REFERENCE_SCHEMA, sessionId: b.sessionId, basketId: b.id, basketRevision: b.revision} : undefined;
  };
  function stop() {
    epoch.current++; listStamp.current++; reading.current = false;
    const job = pending.current; pending.current = undefined;
    if (job) void window.omniEdu?.cancelPaperReferenceExtraction({...job.target, requestId: job.requestId}).catch(() => {});
  }
  useLayoutEffect(() => {
    alive.current = true;
    const beforeUnload = (event: BeforeUnloadEvent) => {if (opened.current) {event.preventDefault(); event.returnValue = '';}};
    window.addEventListener('beforeunload', beforeUnload);
    return () => {window.removeEventListener('beforeunload', beforeUnload); alive.current = false; opened.current = false; stop();};
  }, []);
  useLayoutEffect(() => {
    stop(); opened.current = false; editing.current = false;
    setOpen(false); setBusy(false); setListing(false); setCandidate(undefined); setDirty(false); setError(''); setDiscarding(false); setSourceInvalid(false);
  }, [key]);
  useLayoutEffect(() => navigation.registerGuard(() => opened.current ? '参考卷候选正在核对，请先取消核对或明确放弃修改后离开。' : undefined), [navigation.registerGuard]);

  async function list(nextQuery: string, nextOffset: number) {
    const input = target(), api = window.omniEdu;
    if (!input || !api || reading.current || editing.current) return;
    const stamp = ++listStamp.current;
    setListing(true); setError('');
    try {
      const result = await api.listPaperReferenceSources({...input, query: nextQuery, offset: nextOffset});
      if (!alive.current || !opened.current || stamp !== listStamp.current) return;
      if (!result.ok) {setError(errors[result.error]); return;}
      setItems(result.value.items); setOffset(result.value.offset); setHasMore(result.value.hasMore); setQuery(nextQuery);
    } catch {if (alive.current && opened.current && stamp === listStamp.current) setError('读取资料列表失败，请重新读取。');}
    finally {if (alive.current && stamp === listStamp.current) setListing(false);}
  }
  function show() {if (!basket || opened.current) return; opened.current = true; setOpen(true); setQuery(''); setItems([]); void list('', 0);}
  function close(force = false) {
    if (editing.current && !force) {setDiscarding(true); return false;}
    stop(); opened.current = false; editing.current = false;
    setOpen(false); setBusy(false); setListing(false); setCandidate(undefined); setDirty(false); setDiscarding(false); setError('');
    return true;
  }
  async function extract(source: PaperReferenceSource, recheck = false) {
    const input = target(), api = window.omniEdu;
    if (!input || !api || reading.current || !opened.current || editing.current && !recheck) return;
    const stamp = ++epoch.current, intent = navigation.intent;
    const requestId = 'reference_' + crypto.randomUUID();
    pending.current = {target: input, requestId}; reading.current = true;
    setBusy(true); setError(''); setDiscarding(false);
    try {
      const result = await api.extractPaperReference({...input, requestId, resourceId: source.resourceId, version: source.version});
      if (!alive.current || !opened.current || stamp !== epoch.current || !navigation.isCurrent(intent)) return;
      if (!result.ok) {setError(errors[result.error]); if (result.error === 'source_changed' || result.error === 'permission_denied') setSourceInvalid(true); return;}
      if (recheck) {
        if (result.value.digest !== candidate?.digest) {setSourceInvalid(true); setError(errors.source_changed);}
        else {setSourceInvalid(false); setError('已重新核实来源；教师修改未被替换。');}
      } else {setCandidate(result.value); setDirty(false); editing.current = false; setSourceInvalid(false);}
    } catch {if (alive.current && stamp === epoch.current && opened.current) setError('读取参考卷失败，已有输入保留，可再次读取或取消。');}
    finally {if (alive.current && stamp === epoch.current) {pending.current = undefined; reading.current = false; setBusy(false);}}
  }
  function edit(path: string, patch: Partial<Pick<ReferenceField, 'teacherValue' | 'confirmed'>>) {
    if (reading.current) return;
    editing.current = true; setDirty(true);
    setCandidate(prior => {
      if (!prior) return prior;
      const next = structuredClone(prior), parts = path.split('.');
      let parent = next as unknown as Record<string, unknown>;
      for (const part of parts.slice(0, -1)) parent = parent[part] as Record<string, unknown>;
      const last = parts[parts.length - 1]; parent[last] = {...parent[last] as ReferenceField, ...patch}; return next;
    });
  }
  function clearCandidate() {
    if (editing.current) {setDiscarding(true); return;}
    setCandidate(undefined); setSourceInvalid(false); setError('');
  }
  function addSection() {
    editing.current = true; setDirty(true);
    setCandidate(prior => prior && prior.sections.length < 20 ? {...prior, sections: [...prior.sections, {
      id: 'teacher_section_' + crypto.randomUUID(), label: unknownReferenceField(), questionType: unknownReferenceField(),
      count: unknownReferenceField(), points: unknownReferenceField(), difficulty: unknownReferenceField(), knowledgePoint: unknownReferenceField()}]} : prior);
  }
  function loadCandidate(value:PaperReferenceCandidate) {
    if(reading.current||editing.current)return false;
    stop();opened.current=true;setOpen(true);setCandidate(structuredClone(value));setDirty(false);setSourceInvalid(false);setError('');return true;
  }
  function markSaved(){editing.current=false;setDirty(false);}
  return {open, busy, listing, candidate, dirty, items, offset, hasMore, query, error, discarding, sourceInvalid,
    show, close, list, extract, edit, addSection, clearCandidate,loadCandidate,markSaved, keep: () => setDiscarding(false)};
}
