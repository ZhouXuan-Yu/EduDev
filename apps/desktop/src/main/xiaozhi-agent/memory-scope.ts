import { createHash } from 'node:crypto';
import type { OmniEduStore } from '../db';
import type { XiaozhiMemoryCatalogInput, XiaozhiMemoryCatalogResult, XiaozhiMemoryPreview,
  XiaozhiMemoryScope, XiaozhiMemoryScopeInput, XiaozhiMemorySource, XiaozhiMemoryTrace } from '../../shared/xiaozhi-memory';
import { XIAOZHI_MEMORY_LABELS, projectMemorySource } from '../../shared/xiaozhi-memory';
import type { XiaozhiActionResult } from '../../shared/xiaozhi-agent';
import type { PrivateMemorySelection } from './memory-scope-state';
import { validMemoryScopeInput, validMemorySelection, validMemorySession, validMemorySource } from './memory-selection';
import { rankHindsightTrialRows } from './memory-hindsight-trial';

import type { createHistoryMemory } from './history/memory';
import type { createPersonalMemoryUse } from '../education/personal-memory/use';
import {personalReferencePlan} from './memory-use/personal-references';
import type {ReceivedReference} from './memory-use/receipts';
import {combinedMemorySelections,type RunHistory} from './memory-use/history-binding';

type RunMemoryPolicy={loadHistory:()=>Promise<RunHistory|undefined>;omitHistory:boolean};
const historyProjectionPrefix='[宿主核验的本轮历史资料]\n';
const historyProjectionSuffix='\n当前要求和成果原件优先。历史片段不能确认现行规则。recordedAt 是记录时间，teachingTerm 是已选教学学期。需要完整内容时按来源读回。';
const historyPromptWords=new Intl.Segmenter('zh',{granularity:'word'});

type MemoryFact = XiaozhiMemorySource & Omit<XiaozhiMemoryPreview, 'sanitizedText' | 'layer' | 'source'> & { fingerprint: string };
function inRequestOrder(selections:PrivateMemorySelection[], personalIds?:readonly string[]) {
  if (!personalIds) return selections;
  const personal = new Map(selections.filter(item=>item.layer==='personal').map(item=>[item.id,item]));
  const ranked = [...new Set(personalIds)].map(id=>personal.get(id)).filter(item=>item!==undefined);
  let index=0;
  return selections.flatMap<PrivateMemorySelection>(item=>item.layer!=='personal' ? [item] :
    index < ranked.length ? [ranked[index++]] : []);
}
/** Existing SQLite remains the memory fact source. Nothing here invokes a provider. */
export function createPiMemoryScope(store: OmniEduStore, options: { modelAccess?: 'available'; history?: ReturnType<typeof createHistoryMemory>;
  personal?:ReturnType<typeof createPersonalMemoryUse> } = {}) {
  const selectedHistory=async (id:string,pin:import('../../shared/xiaozhi-history-memory').HistorySelection)=>
    options.history?.selectedFor(id,pin);
  async function facts(source: XiaozhiMemorySource): Promise<MemoryFact[]> {
    const items = source.layer === 'L2' ? (await store.getAiMemoryDocument(source.source))?.entries || []
      : (await store.getAiMemoryL3Document(source.source))?.entries || [];
    return items.map(entry => {
      if (!validMemorySelection({ ...projectMemorySource(source), id: entry.id, version: entry.version }) || typeof entry.text !== 'string' || entry.text.length > 1000
        || !['active', 'disabled', 'deleted'].includes(entry.status)) throw new Error('configuration');
      const refs = 'refs' in entry ? entry.refs : [];
      const surfaces = 'sourceDocuments' in entry ? entry.sourceDocuments : [];
      const fingerprint = createHash('sha256').update(JSON.stringify({ id: entry.id, version: entry.version, text: entry.text,
        status: entry.status, refs, surfaces, documentId: entry.documentId })).digest('hex');
      return { ...projectMemorySource(source), id: entry.id, version: entry.version, text: entry.text, status: entry.status,
        section: 'section' in entry ? entry.section.slice(0, 160) : XIAOZHI_MEMORY_LABELS[source.source],
        provenance: source.layer === 'L3' ? 'surface_only' : refs.length ? 'event_refs' : 'none',
        refs: refs.slice(0, 24).map(ref => ({ kind: ref.kind, id: ref.id.slice(0, 160), label: ref.label.slice(0, 160) })),
        sourceDocuments: surfaces.slice(0, 7), referenceCount: refs.length, fingerprint };
    });
  }
  async function availableSession(id: string, allowArchived = false) {
    if (!validMemorySession(id)) throw new Error('invalid_input');
    if ((await store.getAiConversationSession(id)).session.archivedAt && !allowArchived) throw new Error('permission_denied');
  }
  async function scope(id: string): Promise<XiaozhiMemoryScope> {
    if (!validMemorySession(id)) throw Error('invalid_input');
    const {session} = await store.getAiConversationSession(id);
    const saved = await store.xiaozhiState.memoryScope(id);
    const cache = new Map<string, MemoryFact[] | null>();
    const selections: XiaozhiMemoryScope['selections'] = [];
    for (const item of saved.selections) {
      if (item.layer==='personal') {
        const current=await options.personal?.(id,item).catch(()=>null);
        const {fingerprint,...selection}=item;
        selections.push({...selection,label:current?.label ?? '教师确认的记忆',state:current?.fingerprint===fingerprint?'ready':'changed'});
        continue;
      }
      if (item.layer==='history') {
        const current = await selectedHistory(id,item).catch(()=>null);
        const {fingerprint,...selection}=item;
        selections.push({...selection,label:current?.label??'历史来源',state:current?.fingerprint===fingerprint?'ready':'changed'});
        continue;
      }
      const key = `${item.layer}:${item.source}`;
      if (!cache.has(key)) { try { cache.set(key, await facts(item)); } catch { cache.set(key, null); } }
      const list = cache.get(key), current = list?.find(entry => entry.id === item.id);
      const state = !list ? 'unavailable' : !current || current.status === 'deleted' ? 'missing'
        : current.status !== 'active' ? 'disabled' : current.version !== item.version || current.fingerprint !== item.fingerprint ? 'changed' : 'ready';
      const { fingerprint: _private, ...selection } = item;
      selections.push({ ...selection, state, label: XIAOZHI_MEMORY_LABELS[item.source] });
    }
    const receipts=saved.enabled && selections.some(item=>item.layer==='personal' && item.state==='ready')
      ? await store.xiaozhiState.latestReferenceDeliveries(id) : [];
    const receivedReferences=receipts.flatMap(row=>{
      const pin=saved.selections.find(item=>item.layer==='personal' && item.id===row.id && item.version===row.version);
      if (!pin || pin.fingerprint!==row.fingerprint || saved.version!==row.scopeVersion ||
          !selections.some(item=>item.layer==='personal' && item.id===row.id && item.state==='ready')) return [];
      return [{id:pin.id,version:pin.version,estimatedTokens:Number(row.estimatedTokens),reason:String(row.reason)}];
    });
    return { ...(receivedReferences.length?{receivedReferences}:{}), ...(session.folderId && !session.studentId && !session.archivedAt ? {currentFolderId:session.folderId} : {}),
      ...(saved.teachingTarget ? {teachingTarget:saved.teachingTarget} : {}), version: saved.version, enabled: saved.enabled, modelAccess: options.modelAccess || 'unavailable', selections };
  }
  async function scopeForRun(id:string,policy?:RunMemoryPolicy) {
    const saved=await store.xiaozhiState.memoryScope(id);
    if(policy?.omitHistory)return {...saved,selections:saved.selections.filter(pin=>pin.layer!=='history'),omitHistory:true};
    const extra=await policy?.loadHistory();
    if(!extra)return saved;
    return {...saved,enabled:true,
      selections:combinedMemorySelections(saved.enabled?saved.selections:[],extra.selections),
      historyOwner:{scope:extra.scope,id:extra.ownerId,revision:extra.revision}};
  }

  async function authority(id: string,policy?:RunMemoryPolicy) {
    await availableSession(id);
    const saved = await scopeForRun(id,policy);
    const current: Array<{ id: string; fingerprint: string | null; state: string }> = [];
    const cache = new Map<string, MemoryFact[] | null>();
    if (saved.enabled) for (const item of saved.selections) {
      if (item.layer==='personal') {
        const source=await options.personal?.(id,item).catch(()=>null);
        current.push({id:item.id,fingerprint:source?.fingerprint??null,state:source?.fingerprint===item.fingerprint?'ready':'personal_unavailable'});
        continue;
      }
      if (item.layer==='history') {
        const source = await selectedHistory(id,item).catch(()=>null);
        current.push({id:item.id,fingerprint:source?.fingerprint??null,state:source?.fingerprint===item.fingerprint?'ready':'history_unavailable'});
        continue;
      }
      const sourceKey = `${item.layer}:${item.source}`;
      if (!cache.has(sourceKey)) { try { cache.set(sourceKey, await facts(item)); } catch { cache.set(sourceKey, null); } }
      const list = cache.get(sourceKey), fact = list?.find(entry => entry.id === item.id);
      current.push({ id: item.id, fingerprint: fact?.fingerprint || null, state: !list ? 'unavailable' : !fact || fact.status === 'deleted' ? 'missing'
        : fact.status !== 'active' ? 'disabled' : fact.version !== item.version || fact.fingerprint !== item.fingerprint ? 'changed' : 'ready' });
    }
    if (JSON.stringify(saved) !== JSON.stringify(await scopeForRun(id,policy))) throw new Error('memory_scope_changed');
    return { fingerprint: createHash('sha256').update(JSON.stringify({ saved, current })).digest('hex'),
      enabled: saved.enabled, valid: current.every(item => ['ready','history_unavailable','personal_unavailable'].includes(item.state)), version: saved.version,
      history: saved.enabled&&saved.selections.some(item=>item.layer==='history'&&current.some(row=>row.id===item.id&&row.state==='ready')),
      personal:saved.enabled&&saved.selections.some(item=>item.layer==='personal'&&current.some(row=>row.id===item.id&&
        row.fingerprint===item.fingerprint&&row.state==='ready')) };
  }
  return {
    scope, authority,
    async personalReferences(id:string, expectedAuthority:string, requestId:string, query:string, availableTokens:number, signal?:AbortSignal, policy?:RunMemoryPolicy) {
      signal?.throwIfAborted();
      const saved = await scopeForRun(id,policy);
      const initial = await authority(id,policy);
      if (!initial.valid || initial.fingerprint!==expectedAuthority || initial.version!==saved.version) throw Error('memory_scope_changed');
      const plan = await personalReferencePlan(saved,options.personal,id,expectedAuthority,requestId,query,availableTokens,signal);
      const final = await authority(id,policy);
      signal?.throwIfAborted();
      if (!final.valid || final.fingerprint!==expectedAuthority) throw Error('memory_scope_changed');
      return plan;
    },
    async historyProjection(id:string,expectedAuthority:string,query:string,availableTokens:number,signal?:AbortSignal,policy?:RunMemoryPolicy) {
      if(policy?.omitHistory)return;
      const extra=await policy?.loadHistory();
      const budget=Math.min(1400,Math.floor(availableTokens/20))
        -Buffer.byteLength(historyProjectionPrefix+historyProjectionSuffix);
      if(!extra||budget<160)return;
      const initial=await authority(id,policy);
      if(!initial.valid||initial.fingerprint!==expectedAuthority)throw Error('memory_scope_changed');
      const terms=[...new Set(Array.from(historyPromptWords.segment(query.normalize('NFKC').toLowerCase().slice(0,4096)))
        .filter(item=>item.isWordLike&&item.segment.length>=2).map(item=>item.segment))].slice(0,48);
      const candidates=[];
      for(const pin of extra.selections){
        signal?.throwIfAborted();
        const source=await selectedHistory(id,pin).catch(()=>null);
        if(!source||source.fingerprint!==pin.fingerprint)continue;
        const excerpt=Array.from(source.text).slice(0,200).join('');
        const normalized=source.text.normalize('NFKC').toLowerCase();
        const score=terms.reduce((sum,term)=>sum+(normalized.includes(term)?term.length:0),0);
        candidates.push({pin,score,row:{sourceId:pin.id,version:pin.version,sourceVersion:pin.sourceVersion,
          excerpt,excerptOnly:excerpt.length<source.text.length,temporal:source.temporal}});
      }
      candidates.sort((a,b)=>b.score-a.score||a.pin.id.localeCompare(b.pin.id,'en'));
      const output:typeof candidates=[];
      for(const item of candidates){
        if(output.length===2)break;
        if(Buffer.byteLength(JSON.stringify([...output,item].map(candidate=>candidate.row)))<=budget)output.push(item);
      }
      const final=await authority(id,policy);
      signal?.throwIfAborted();
      if(!final.valid||final.fingerprint!==expectedAuthority)throw Error('memory_scope_changed');
      if(!output.length)return;
      const receipts:ReceivedReference[]=output.map(({pin,row})=>({id:pin.id,version:pin.version,fingerprint:pin.fingerprint,
        reason:extra.scope,estimatedTokens:Buffer.byteLength(JSON.stringify(row))}));
      return {projection:historyProjectionPrefix+JSON.stringify(output.map(item=>item.row))+historyProjectionSuffix,receipts};
    },
    async readHistoryPage(id:string,expectedAuthority:string,request:import('./memory-tools').HistoryPageRequest,signal?:AbortSignal,policy?:RunMemoryPolicy) {
      signal?.throwIfAborted();
      const initial=await authority(id,policy);
      if(!initial.valid||initial.fingerprint!==expectedAuthority)throw Error('memory_scope_changed');
      const saved=await scopeForRun(id,policy);
      const pin=saved.enabled?saved.selections.find(item=>item.layer==='history'&&
        item.id===request.sourceId&&item.sourceVersion===request.sourceVersion):undefined;
      if(!pin||pin.layer!=='history'||!options.history)throw Error('permission_denied');
      const source=await options.history.selectedFor(id,pin);
      if(source.fingerprint!==pin.fingerprint)throw Error('memory_scope_changed');
      const characters=Array.from(source.text);
      if(request.offset<0||request.offset>=characters.length)throw Error('invalid_input');
      const end=Math.min(characters.length,request.offset+900);
      const final=await authority(id,policy);
      signal?.throwIfAborted();
      if(!final.valid||final.fingerprint!==expectedAuthority)throw Error('memory_scope_changed');
      return {sourceId:pin.id,sourceVersion:pin.sourceVersion,version:pin.version,offset:request.offset,
        nextOffset:end<characters.length?end:null,text:characters.slice(request.offset,end).join(''),temporal:source.temporal};
    },
    /** Main-only model payload. Never expose this method or authority hash through preload. */
    async readSelected(id: string, expectedAuthority: string, signal?: AbortSignal, personalIds?:readonly string[], policy?:RunMemoryPolicy) {
      signal?.throwIfAborted();
      const initial = await authority(id,policy);
      if (initial.fingerprint !== expectedAuthority || !initial.valid) throw new Error('memory_scope_changed');
      const saved = await scopeForRun(id,policy);
      const payload: Array<{ reference: string; layer: 'L2' | 'L3' | 'history' | 'personal'; source: string; version: number; text: string;
        provenance: XiaozhiMemoryPreview['provenance'] | 'teacher_history' | 'teacher_confirmed'; sourceDocuments: string[];
        refs: Array<{ kind: 'run' | 'event'; label: string }>;
        history?: {sourceId:string; sourceVersion:string; truncated:boolean; temporal:{teachingTerm:string|null;recordedAt:string|null}};
        personal?:{sourceId:string; sourceVersion:string; scope:string; term:string; occurredAt:string|null} }> = [];
      if (saved.enabled) for (const item of inRequestOrder(saved.selections,personalIds)) {
        signal?.throwIfAborted();
        if (item.layer==='personal') {
          const source=await options.personal?.(id,item).catch(()=>null);
          if (!source || source.fingerprint!==item.fingerprint) continue;
          payload.push({reference:`记忆${payload.length+1}`,layer:'personal',source:source.label,version:item.version,
            text:source.text,provenance:'teacher_confirmed',sourceDocuments:[],refs:[],
            personal:{sourceId:item.id,sourceVersion:item.sourceVersion,scope:source.scope,term:source.term,occurredAt:source.occurredAt}});
          continue;
        }
        if (item.layer==='history') {
          const source = await selectedHistory(id,item).catch(()=>null);
          if (!source || source.fingerprint!==item.fingerprint) continue;
          payload.push({reference:`记忆${payload.length+1}`,layer:'history',source:source.label,version:item.version,
            text:source.text.slice(0,1600),provenance:'teacher_history',sourceDocuments:[],refs:[],
            history:{sourceId:item.id,sourceVersion:item.sourceVersion,truncated:source.text.length>1600,temporal:source.temporal}});
          continue;
        }
        const fact = (await facts(item)).find(entry => entry.id === item.id);
        if (!fact || fact.status !== 'active' || fact.version !== item.version || fact.fingerprint !== item.fingerprint) throw new Error('memory_scope_changed');
        const text = (await store.sanitizeProblemText(fact.text)).sanitizedText;
        const refs = [];
        for (const ref of fact.refs) refs.push({ kind: ref.kind, label: (await store.sanitizeProblemText(ref.label)).sanitizedText });
        payload.push({ reference: `记忆${payload.length + 1}`, layer: fact.layer, source: XIAOZHI_MEMORY_LABELS[fact.source],
          version: fact.version, text, provenance: fact.provenance, sourceDocuments: fact.sourceDocuments.map(source => XIAOZHI_MEMORY_LABELS[source]), refs });
      }
      const ranked = await rankHindsightTrialRows(payload, signal);
      const final = await authority(id,policy);
      signal?.throwIfAborted();
      if (final.fingerprint !== expectedAuthority || !final.valid) throw new Error('memory_scope_changed');
      return ranked;
    },
    async catalog(input: XiaozhiMemoryCatalogInput): Promise<XiaozhiMemoryCatalogResult> {
      if (!validMemorySource(input) || Object.keys(input).length !== 4 || Object.keys(input).some(key => !['sessionId', 'layer', 'source', 'offset'].includes(key))
        || !validMemorySession(input.sessionId) || !Number.isSafeInteger(input.offset) || input.offset < 0 || input.offset > 100000) return { ok: false, error: 'invalid_input' };
      try {
        await availableSession(input.sessionId);
        const list = await facts(input), entries: XiaozhiMemoryPreview[] = [];
        for (const { fingerprint: _private, ...item } of list.slice(input.offset, input.offset + 50)) {
          const sanitizedText = (await store.sanitizeProblemText(item.text)).sanitizedText;
          entries.push({ ...item, ...projectMemorySource(item), sanitizedText });
        }
        return { ok: true, catalog: { ...projectMemorySource(input), offset: input.offset,
          total: list.length, hasMore: input.offset + entries.length < list.length, entries } };
      } catch (error) { return { ok: false, error: error instanceof Error && error.message === 'permission_denied' ? 'permission_denied' : 'configuration' }; }
    },
    async trace(id: string): Promise<XiaozhiMemoryTrace | null> {
      await availableSession(id);
      const row = (await store.xiaozhiState.runs(id)).at(-1);
      if (!row) return null; // Never fall back to another conversation's latest run.
      const result = await store.getAiMemoryTrace(String(row.id), 30);
      return { runId: String(row.id), status: result.status, events: result.events.map(event => ({
        sequence: event.sequence, status: event.status, label: event.label, tool: event.toolName,
      })) };
    },
    async save(input: XiaozhiMemoryScopeInput): Promise<XiaozhiActionResult> {
      if (!validMemoryScopeInput(input)) return { ok: false, error: 'invalid_input' };
      try {
        await availableSession(input.sessionId);
        const selections: PrivateMemorySelection[] = [], cache = new Map<string, MemoryFact[]>();
        for (const item of input.selections) {
          if (item.layer==='personal') {
            const source=await options.personal?.(input.sessionId,item).catch(()=>null);
            if (!source) return {ok:false,error:'permission_denied'};
            selections.push({...item,fingerprint:source.fingerprint});
            continue;
          }
          if (item.layer==='history') {
            const source=await selectedHistory(input.sessionId,item).catch(()=>null);
            if (!source) return {ok:false,error:'permission_denied'};
            selections.push({...item,fingerprint:source.fingerprint});
            continue;
          }
          const key = `${item.layer}:${item.source}`;
          if (!cache.has(key)) cache.set(key, await facts(item));
          const current = cache.get(key)!.find(entry => entry.id === item.id);
          if (!current || current.status !== 'active') return { ok: false, error: 'permission_denied' };
          if (current.version !== item.version) return { ok: false, error: 'command_conflict' };
          selections.push({ ...item, fingerprint: current.fingerprint });
        }
        return await store.xiaozhiState.saveMemoryScope(input.sessionId, input.version, { enabled: input.enabled, selections },input.teachingTarget)
          ? { ok: true } : { ok: false, error: 'command_conflict' };
      } catch (error) { return { ok: false, error: error instanceof Error && error.message === 'permission_denied' ? 'permission_denied' : 'configuration' }; }
    },
  };
}
