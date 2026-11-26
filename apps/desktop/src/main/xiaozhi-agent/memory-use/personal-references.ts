import type {createPersonalMemoryUse} from '../../education/personal-memory/use';
import type {PrivateMemoryScope} from '../memory-scope-state';
import {planMemoryUse} from './selection';

const words = new Intl.Segmenter('zh', {granularity:'word'});
const instruction = '下列是当前问题可核对的个人记忆引用。需要正文时调用 read_education_memory；当前教师要求优先。\n';
const declinesMemory = /(?:不要|不用|别|无需|禁止|不再|不必|不应)[^，。！？\n]{0,14}(?:记忆|历史|偏好|任教自述)/u;
const asksForSelection = /(?:读取|查看|核对|查阅|参考|列出|使用|沿用)[^，。！？\n]{0,12}(?:已选|所选|选择的|选中的)[^，。！？\n]{0,10}(?:记忆|偏好|任教自述)/u;

/** Only host-pinned, adopted records returned by R2 can be projected. */
export async function personalReferencePlan(saved:PrivateMemoryScope, read:ReturnType<typeof createPersonalMemoryUse>|undefined,
  sessionId:string, authority:string, requestId:string, query:string, availableTokens:number, signal?:AbortSignal) {
  const tokens = Math.max(0, Math.min(1024, Math.floor(availableTokens/20)) - Buffer.byteLength(instruction));
  const host = {sessionId,requestId,authority,scopeVersion:saved.version,scope:{teacher:'self',classRef:saved.teachingTarget?.folderId,termRef:saved.teachingTarget?.term},
    enabled:saved.enabled,selections:saved.selections,preferences:[],named:[],availableTokens:tokens*20};
  const facts:Parameters<typeof planMemoryUse>[1][number][] = [];
  const normalized = query.normalize('NFKC').toLowerCase().trim().slice(0,4096);
  if (saved.enabled === true && saved.selections.length <= 12 && normalized && !declinesMemory.test(normalized) && tokens > 0 && read) {
    const lookup = asksForSelection.test(normalized);
    const terms = [...new Set(Array.from(words.segment(normalized))
      .filter(word=>word.isWordLike && word.segment.length >= 2).map(word=>word.segment))];
    for (const pin of saved.selections) {
      if (pin.layer !== 'personal') continue;
      signal?.throwIfAborted();
      const record = await read(sessionId,pin);
      signal?.throwIfAborted();
      if (!record || record.fingerprint !== pin.fingerprint) continue;
      const scope = record.scope === 'class' && saved.teachingTarget && record.scopeId === saved.teachingTarget.folderId
          && record.term === saved.teachingTarget.term ? {classRef:record.scopeId,termRef:record.term}
        : record.scope === 'teacher' && record.term === 'unknown' ? {teacher:'self'} : null;
      if (!scope) continue;
      const text = record.text.normalize('NFKC').toLowerCase();
      const relevance = terms.reduce((score,term)=>score+(text.includes(term)?term.length:0),0);
      facts.push({...pin,state:'active',provenance:'exact',scope,relevant:lookup || relevance>0,relevance});
    }
  }
  const plan = planMemoryUse(host,facts);
  const receipts = plan.items.flatMap(item=>{
    const pin=saved.selections.find(entry=>entry.layer===item.layer && entry.id===item.id && entry.version===item.version);
    if (!pin) return [];
    const {layer,source,id,version,reason}=item;
    return [{id,version,reason,fingerprint:pin.fingerprint,estimatedTokens:Buffer.byteLength(JSON.stringify({layer,source,id,version}))}];
  });
  return {...plan, receipts, projection:plan.items.length ? instruction+plan.projection : ''};
}
