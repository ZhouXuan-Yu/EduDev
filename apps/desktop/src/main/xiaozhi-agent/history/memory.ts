import {randomUUID} from 'node:crypto';
import type { OmniEduStore } from '../../db';
import type { HistoryAccessAction, HistoryDiscovery, HistoryIndexStatus, HistoryPreview, HistorySource, HistorySourceRef, HistorySelection } from '../../../shared/xiaozhi-history-memory';
import { teacherRequestSources } from '../request-sources';
import { validMemorySession } from '../memory-selection';
import { createHistoryState, historyHash, historyId, type Access } from './state';
import { createHistoryIndexWorker } from './index-worker';
import { configuredHistoryIndex } from './hindsight';

const sourceVersion = /^[a-f0-9]{64}$/;
const recordId = /^[a-z0-9_-]{1,180}$/i;
export function validHistoryRef(value: unknown): value is HistorySourceRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const ref = value as HistorySourceRef;
  return Object.keys(ref).length===4 && (ref.kind==='history_request'||ref.kind==='history_control')
    && validMemorySession(ref.sessionId) && typeof ref.recordId==='string' && recordId.test(ref.recordId)
    && typeof ref.sourceVersion==='string' && sourceVersion.test(ref.sourceVersion);
}
const marker = (input: string) => input.normalize('NFKC').toLowerCase();
const segmenter = new Intl.Segmenter('zh', {granularity:'word'});
function terms(input: string) {
  return [...new Set(Array.from(segmenter.segment(marker(input)), token=>token.isWordLike?token.segment:'').filter(Boolean))];
}
function relevance(query: string, tokens: string[], text: string) {
  const normalized = marker(text);
  return (normalized.includes(marker(query)) ? 12 : 0)
    + tokens.reduce((score, token) => score + (normalized.includes(token) ? Math.min(6,token.length) : 0),0);
}

export function createHistoryMemory(store: OmniEduStore, dataRoot?: string) {
  const sql=store.xiaozhiState.sql;
  const access = createHistoryState(sql);
  const engine = dataRoot ? configuredHistoryIndex(dataRoot) : undefined;
  const tickets = new Map<string,{sessionId:string;scopeVersion:number;selection:HistorySelection;expires:number}>();
  function issue(sessionId:string,scopeVersion:number,source:HistorySource) {
    for (const [key,value] of tickets) if (value.expires<=Date.now()) tickets.delete(key);
    if(tickets.size>=192)tickets.delete(tickets.keys().next().value!);
    const ticket=randomUUID();
    tickets.set(ticket,{sessionId,scopeVersion,expires:Date.now()+300000,
      selection:{layer:'history',source:'history',id:source.sourceId,version:source.generation,sourceVersion:source.ref.sourceVersion}});
    return {...source,ticket};
  }
  async function session(id: string, includeControls = true) {
    if (!validMemorySession(id)) throw Error('invalid_input');
    const detail = await store.getAiConversationSession(id).catch(()=>null);
    if (!detail || detail.session.archivedAt || detail.session.studentId) throw Error('source_unavailable');
    const controls = includeControls ? await store.xiaozhiState.controls(id) : [];
    return {title:detail.session.title,sources:teacherRequestSources(detail.messages,controls).filter(item=>recordId.test(item.sourceId))};
  }
  async function original(ref: HistorySourceRef) {
    if (!validHistoryRef(ref)) throw Error('invalid_input');
    const {title,sources} = await session(ref.sessionId,ref.kind==='history_control');
    const row = sources.find(item=>item.sourceId===ref.recordId && (item.kind==='request')===(ref.kind==='history_request'));
    if (!row) throw Error('source_unavailable');
    if (row.sourceVersion!==ref.sourceVersion) throw Error('source_changed');
    return {ref,title: title.slice(0,80),label:row.kind==='request'?'教师原话':row.kind==='answer'?'教师补答':'已生效的追加要求',text:row.text};
  }
  async function project(ref: HistorySourceRef, label: string, title: string, known?: Access|null): Promise<HistorySource> {
    const id = historyId(ref);
    const saved = known === undefined ? await access.get(id) : known;
    return {sourceId:id,ref,label,sessionTitle:title,accessRevision:saved?.revision??0,generation:saved?.generation??0,
      state:saved?.status??'active',allowed:!!saved?.allowed && saved.ref.sourceVersion===ref.sourceVersion,
      cleanup:saved?await access.cleanup(id):'none'};
  }
  async function readAllowed(saved: Access) {
    if (!saved.allowed||saved.status!=='active') throw Error('permission_denied');
    const source = await original(saved.ref);
    const text = (await store.sanitizeProblemText(source.text)).sanitizedText;
    const current = await access.get(saved.sourceId);
    if (current?.generation!==saved.generation || current.ref.sourceVersion!==saved.ref.sourceVersion || !current.allowed || current.status!=='active')
      throw Error('source_changed');
    return {...source,text,fingerprint:historyHash(JSON.stringify([saved.generation,saved.ref.sourceVersion,text]))};
  }
  const worker = engine && createHistoryIndexWorker(sql,engine,access,readAllowed);
  worker?.wake();
  return {
    access, readAllowed,
    close:()=>worker?.close(),
    async status():Promise<HistoryIndexStatus> {
      const index=await access.indexState();
      const [counts]=await sql.all(`SELECT (SELECT COUNT(*) FROM memory_index_catalog WHERE status='ready' AND index_generation=?) ready,
        COUNT(CASE WHEN state IN ('running','pending','retry') THEN 1 END) pending,
        COUNT(CASE WHEN state='failed' THEN 1 END) failed FROM memory_index_jobs`,[index.active]);
      return {configured:!!worker,...index,ready:Number(counts.ready),pending:Number(counts.pending),failed:Number(counts.failed)};
    },
    async rebuild() {
      if(!worker)throw Error('configuration');
      const state=await access.rebuild();
      worker.wake();
      return state;
    },
    candidate(sessionId:string,scopeVersion:number,ticket:string) {
      if (!validMemorySession(sessionId)||!Number.isSafeInteger(scopeVersion)||typeof ticket!=='string'||ticket.length!==36) return;
      const own=tickets.get(ticket);
      if(own?.sessionId===sessionId&&own.scopeVersion===scopeVersion&&own.expires>Date.now())return own.selection;
    },
    async sessions() {
      const current = await store.listAiConversationWorkspace();
      return current.sessions.filter(item=>!item.studentId).slice(0,100).map(item=>({id:item.id,title:item.title}));
    },
    async list(sessionId: string, offset: number) {
      if (!Number.isSafeInteger(offset)||offset<0||offset>100000) throw Error('invalid_input');
      const {title,sources}=await session(sessionId);
      const ordered = sources.slice().sort((a,b)=>(b.sequence??0)-(a.sequence??0)||(b.appliedOrder??0)-(a.appliedOrder??0));
      const items = await Promise.all(ordered.slice(offset,offset+25).map(item=>project(
        {kind:item.kind==='request'?'history_request':'history_control',sessionId,recordId:item.sourceId,sourceVersion:item.sourceVersion},
        item.kind==='request'?'教师原话':item.kind==='answer'?'教师补答':'已生效的追加要求',title)));
      return {items,nextOffset:offset+25<ordered.length?offset+25:null};
    },
    async change(ref: HistorySourceRef, revision: number, action: HistoryAccessAction) {
      if (!validHistoryRef(ref)||!Number.isSafeInteger(revision)||revision<0||
          !['allow','revoke','disable','restore','forget'].includes(action)) throw Error('invalid_input');
      const source = action==='allow'||action==='restore' ? await original(ref) : null;
      const saved = await access.change(ref,revision,action);
      worker?.wake();
      return project(saved.ref,source?.label??'历史来源',source?.title??'',saved);
    },
    async discover(sessionId: string, query: string, signal?: AbortSignal): Promise<HistoryDiscovery> {
      if (typeof query!=='string'||!query.trim()||query.length>1800||!validMemorySession(sessionId)) throw Error('invalid_input');
      const started = performance.now();
      const scope=await store.xiaozhiState.memoryScope(sessionId);
      const selected = new Set(scope.selections.filter(item=>item.layer==='history').map(item=>item.id));
      const active = (await access.permitted()).filter(item=>!selected.has(item.sourceId));
      if (!active.length) return {mode:'local',candidates:[],reason:'empty_scope',elapsedMs:Math.round(performance.now()-started)};
      const target = await store.getAiConversationSession(sessionId);
      if (target.session.archivedAt||target.session.studentId) throw Error('permission_denied');
      const cleaned = (await store.sanitizeProblemText(query)).sanitizedText;
      if (!cleaned.trim()) return {mode:'local',candidates:[],elapsedMs:Math.round(performance.now()-started)};
      if (engine) {
        try {
          const index=await access.indexState();
          const indexed = await sql.all(`SELECT c.document_id,c.source_id,c.source_version,c.generation FROM memory_index_catalog c
            JOIN memory_source_access a ON a.source_id=c.source_id AND a.source_version=c.source_version AND a.generation=c.generation
            WHERE c.status='ready' AND c.index_generation=? AND a.index_allowed=1 AND a.discover_allowed=1 AND a.memory_state='active' LIMIT 500`,[index.active]);
          const byId = new Map(active.map(item=>[item.sourceId,item]));
          const byDocument = new Map(indexed.flatMap(row=>{
            const owner=byId.get(String(row.source_id));
            return owner && owner.ref.sourceVersion===row.source_version && owner.generation===row.generation ? [[String(row.document_id),owner] as const] : [];
          }));
          if (byDocument.size) {
            const deadline=AbortSignal.timeout(1500);
            const ids = await engine.search(cleaned,[...byDocument.keys()],signal?AbortSignal.any([deadline,signal]):deadline);
            const candidates:HistorySource[]=[];
            for (const id of ids) {
              signal?.throwIfAborted();
              const saved=byDocument.get(id);
              if(!saved)continue;
              const row=await readAllowed(saved).catch(()=>null);
              if(row)candidates.push(await project(row.ref,row.label,row.title,saved));
            }
            return {mode:'hindsight',candidates:candidates.map(row=>issue(sessionId,scope.version,row)),elapsedMs:Math.round(performance.now()-started)};
          }
        } catch { signal?.throwIfAborted(); }
      }
      const tokens=terms(cleaned).slice(0,60);
      const score: Array<{source:HistorySource;score:number}> = [];
      for (const saved of active) {
        signal?.throwIfAborted();
        try {
          const row = await readAllowed(saved);
          const weight = relevance(cleaned,tokens,row.text);
          if (weight>0) score.push({source:await project(row.ref,row.label,row.title,saved),score:weight});
        } catch (error) {
          if (!(error instanceof Error)||!['source_unavailable','source_changed','permission_denied'].includes(error.message)) throw error;
        }
      }
      const candidates:HistorySource[] = [];
      for (const result of score.sort((a,b)=>b.score-a.score).slice(0,12)) {
        const latest = await access.get(result.source.sourceId);
        if (latest?.allowed && latest.status==='active' && latest.generation===result.source.generation) candidates.push(result.source);
      }
      return {mode:'local',candidates:candidates.map(row=>issue(sessionId,scope.version,row)),
        ...(engine?{reason:'service_unavailable' as const}:{}),elapsedMs:Math.round(performance.now()-started)};
    },
    async preview(ref: HistorySourceRef, offset: number, permittedOnly: boolean): Promise<HistoryPreview> {
      if (!validHistoryRef(ref)||!Number.isSafeInteger(offset)||offset<0||offset>100000) throw Error('invalid_input');
      const saved = await access.get(historyId(ref));
      if (permittedOnly && (!saved||!saved.allowed||saved.status!=='active')) throw Error('permission_denied');
      if (permittedOnly && saved!.ref.sourceVersion!==ref.sourceVersion) throw Error('source_changed');
      const source = permittedOnly ? await readAllowed(saved!) : await original(ref);
      const text = 'fingerprint' in source ? source.text : (await store.sanitizeProblemText(source.text)).sanitizedText;
      if (offset>text.length) throw Error('invalid_input');
      const end = Math.min(text.length,offset+1200);
      return {source:await project(ref,source.label,source.title,saved),text:text.slice(offset,end),offset,nextOffset:end<text.length?end:null};
    },
    async selected(selection: HistorySelection) {
      const saved = await access.get(selection.id);
      if (!saved || saved.generation!==selection.version || saved.ref.sourceVersion!==selection.sourceVersion) throw Error('source_changed');
      return readAllowed(saved);
    },
  };
}
