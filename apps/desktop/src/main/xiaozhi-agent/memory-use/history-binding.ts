import {randomUUID} from 'node:crypto';
import type {PendingHistoryReference,HistorySelection,TaskHistoryScope,TaskHistoryRemoval} from '../../../shared/xiaozhi-history-memory';
import type {XiaozhiMemoryUseSelection} from '../../../shared/xiaozhi-memory';
import {validTaskOwner,type TaskView,type TaskOwner} from '../../../shared/xiaozhi-task';
import type {createHistoryMemory} from '../history/memory';
import {createHistoryState} from '../history/state';
import {historyTargetApplies,historyTeachingContext,type HistoryTeachingTarget as Target} from '../history/teaching-target';
import {createReferenceReceipts} from './receipts';
import {memorySelectionKey,validMemoryUseSelection} from '../memory-selection';
import type {Sql} from '../session-state';

export type HistoryPin=HistorySelection & {fingerprint:string};
type BoundHistory={scope:'task'|'turn';ownerId:string;revision:number;selections:HistoryPin[]};
export type RunHistory=BoundHistory;
type Pending={sessionId:string;scopeVersion:number;target:Target;pin:HistoryPin;expires:number};
type TaskBinding={
  schemaVersion:1;sessionId:string;taskId:string;revision:number;requirementsVersion:number;
  target:Target;admittedBy:TaskOwner;selections:HistoryPin[];invalidated?:true;
};
const taskKey=(id:string)=>'xiaozhi.memory-use.task.v1:'+id;
const sameTarget=(a:Target,b:Target)=>a.folderId===b.folderId&&a.term===b.term;

export function requestDeclinesHistory(prompt:string) {
  return /(?:^|[，。；！？,;!?\n])\s*(?:请\s*)?(?:这次|本次|这一轮|本轮|本任务|这项任务)?\s*(?:不要|不用|别|无需|不必|不需要|不使用|不引用|不参考)\s*(?:(?:再|去)?(?:读取|引用|参考|沿用|使用|查阅))?\s*(?:(?:先前|之前|过去|以前|已选|已授权)的?)?(?:历史(?:记忆|引用|来源|记录)?|旧(?:会话|对话))(?=[，。；！？,;!?\s]|$)/u.test(prompt.normalize('NFKC'));
}


export function combinedMemorySelections<T extends XiaozhiMemoryUseSelection>(session:T[],extra:HistoryPin[]):(T|HistoryPin)[] {
  const merged=new Map<string,T|HistoryPin>(session.map(item=>[memorySelectionKey(item),item]));
  for(const pin of extra)merged.set(memorySelectionKey(pin),pin);
  if(merged.size>12)throw Error('memory_scope_changed');
  return [...merged.values()];
}

async function currentPin(sql:Sql,pin:HistoryPin,target:Target) {
  const access=await createHistoryState(sql).get(pin.id);
  if(!access?.allowed||access.status!=='active'||access.generation!==pin.version||access.ref.sourceVersion!==pin.sourceVersion)return false;
  const source=(await historyTeachingContext(sql,access.ref.sessionId).catch(()=>null))?.target;
  return !!source&&historyTargetApplies(source,target);
}

async function readTaskBinding(sql:Sql,task:TaskView):Promise<TaskBinding|null> {
  const [row]=await sql.all('SELECT value_json FROM app_settings WHERE key=?',[taskKey(task.id)]);
  if(!row)return null;
  const binding=JSON.parse(String(row.value_json)) as TaskBinding;
  if(binding.schemaVersion!==1||binding.sessionId!==task.sessionId||binding.taskId!==task.id||
    !Number.isSafeInteger(binding.revision)||binding.revision<1||
    !Number.isSafeInteger(binding.requirementsVersion)||binding.requirementsVersion<1||
    binding.requirementsVersion>task.requirementsVersion||
    !Array.isArray(binding.selections)||binding.selections.length>12||
    !binding.selections.every(pin=>pin?.layer==='history'&&validMemoryUseSelection(pin,true))||
    new Set(binding.selections.map(memorySelectionKey)).size!==binding.selections.length||
    !binding.target||
    binding.target.folderId!==null&&typeof binding.target.folderId!=='string'||
    binding.target.term!==null&&typeof binding.target.term!=='string'||
    binding.invalidated!==undefined&&binding.invalidated!==true||!validTaskOwner(binding.admittedBy)||binding.admittedBy.sessionId!==task.sessionId)throw Error('memory_scope_changed');
  return binding;
}

export function createTaskHistoryUse(sql:Sql,history:Pick<ReturnType<typeof createHistoryMemory>,'candidate'|'selected'>) {
  const pending=new Map<string,Pending>();
  async function stage(sessionId:string,scopeVersion:number,ticket:string):Promise<PendingHistoryReference> {
    const selection=history.candidate(sessionId,scopeVersion,ticket);
    if(!selection)throw Error('command_conflict');
    const {saved,target}=await historyTeachingContext(sql,sessionId);
    if(saved.version!==scopeVersion)throw Error('command_conflict');
    const source=await history.selected(selection);
    const pin={...selection,fingerprint:source.fingerprint};
    if(!await currentPin(sql,pin,target))throw Error('permission_denied');
    combinedMemorySelections(saved.selections,[pin]);
    const now=Date.now();
    for(const [key,entry] of pending)if(entry.expires<=now)pending.delete(key);
    if(pending.size>=192)pending.delete(pending.keys().next().value!);
    const token=randomUUID();
    pending.set(token,{sessionId,scopeVersion,target,pin,expires:now+1_800_000});
    return {token,sourceId:pin.id,scopeVersion,title:source.title+' · '+source.label};
  }

  async function prepare(sessionId:string,tokens:readonly string[]) {
    const {saved,target}=await historyTeachingContext(sql,sessionId);
    const pins:HistoryPin[]=[];
    for(const token of tokens){
      const entry=pending.get(token);
      if(!entry||entry.sessionId!==sessionId||entry.scopeVersion!==saved.version||!sameTarget(entry.target,target)||entry.expires<=Date.now())throw Error('memory_scope_changed');
      const source=await history.selected(entry.pin).catch(()=>null);
      if(source?.fingerprint!==entry.pin.fingerprint||!await currentPin(sql,entry.pin,target))throw Error('memory_scope_changed');
      pins.push(entry.pin);
    }
    const selections=[...new Map(pins.map(pin=>[pin.id,pin])).values()];
    combinedMemorySelections(saved.selections,selections);
    return {scopeVersion:saved.version,target,selections};
  }

  type Prepared=Awaited<ReturnType<typeof prepare>>;
  async function confirm(work:Sql,sessionId:string,proof:Prepared) {
    const {saved,target}=await historyTeachingContext(work,sessionId);
    if(saved.version!==proof.scopeVersion||!sameTarget(target,proof.target))throw Error('memory_scope_changed');
    for(const pin of proof.selections)if(!await currentPin(work,pin,target))throw Error('memory_scope_changed');
    return saved;
  }

  async function attachTask(work:Sql,task:TaskView,owner:TaskOwner,proof:Prepared) {
    if(task.state!=='active'||task.sessionId!==owner.sessionId||task.binding?.runId!==owner.runId||
      task.binding.generation!==owner.generation)throw Error('memory_scope_changed');
    const saved=await confirm(work,owner.sessionId,proof);
    const prior=await readTaskBinding(work,task);
    const existing:HistoryPin[]=[];
    if(prior&&!prior.invalidated&&sameTarget(prior.target,proof.target)){
      for(const pin of prior.selections)if(await currentPin(work,pin,proof.target))existing.push(pin);
    }
    const selections=combinedMemorySelections(existing,proof.selections);
    combinedMemorySelections(saved.selections,selections);
    const binding:TaskBinding={schemaVersion:1,sessionId:owner.sessionId,taskId:task.id,
      revision:(prior?.revision??0)+1,requirementsVersion:task.requirementsVersion,target:proof.target,admittedBy:owner,selections};
    // The caller owns the real Task checkpoint transaction, including journal publication.
    await work.run(`INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`,
    [taskKey(task.id),JSON.stringify(binding),new Date().toISOString()]);
  }

  async function forTask(task:TaskView,includeInvalidated=false):Promise<RunHistory|undefined> {
    if(task.state==='ended'||task.state==='completed')return;
    const binding=await readTaskBinding(sql,task);
    if(!binding||binding.invalidated)return;
    const {target}=await historyTeachingContext(sql,task.sessionId);
    if(!sameTarget(binding.target,target))return;
    const selections:HistoryPin[]=[];
    for(const pin of binding.selections)if(includeInvalidated||await currentPin(sql,pin,target))selections.push(pin);
    if(!selections.length)return;
    return {scope:'task',ownerId:task.id,revision:binding.revision,selections};
  }

  async function forRun(task:TaskView,owner:TaskOwner,includeInvalidated=false) {
    if(task.state!=='active'||task.sessionId!==owner.sessionId||task.binding?.runId!==owner.runId||
      task.binding.generation!==owner.generation)return;
    return forTask(task,includeInvalidated);
  }

  async function view(task:TaskView):Promise<TaskHistoryScope|undefined> {
    const binding=await forTask(task);
    if(!binding)return;
    const delivered=await createReferenceReceipts(sql).latestReferenceDeliveries(task.sessionId);
    const items:TaskHistoryScope['items']=[];
    for(const pin of binding.selections){
      const source=await history.selected(pin).catch(()=>null);
      if(source?.fingerprint===pin.fingerprint)items.push({sourceId:pin.id,label:source.title+' · '+source.label,
        ...(delivered.some(row=>row.reason==='task'&&row.id===pin.id&&row.version===pin.version&&row.fingerprint===pin.fingerprint)
          ?{delivered:true as const}:{})});
    }
    const after=await forTask(task);
    if(!after||after.revision!==binding.revision||!items.length)return;
    return {taskId:task.id,revision:binding.revision,items:items.filter(item=>after.selections.some(pin=>pin.id===item.sourceId))};
  }

  async function remove(task:TaskView,input:TaskHistoryRemoval) {
    if(!sql.transaction||task.id!==input.taskId||task.sessionId!==input.sessionId||task.state==='completed'||task.state==='ended')return false;
    return sql.transaction(async work=>{
      const binding=await readTaskBinding(work,task);
      if(!binding||binding.invalidated||binding.revision!==input.revision||!binding.selections.some(pin=>pin.id===input.sourceId))return false;
      const selections=binding.selections.filter(pin=>pin.id!==input.sourceId);
      await work.run('UPDATE app_settings SET value_json=?,updated_at=? WHERE key=?',
        [JSON.stringify({...binding,revision:binding.revision+1,selections}),new Date().toISOString(),taskKey(task.id)]);
      return true;
    });
  }

  async function turn(ownerId:string,sessionId:string,proof:Prepared):Promise<RunHistory> {
    const saved=await confirm(sql,sessionId,proof);
    combinedMemorySelections(saved.selections,proof.selections);
    return {scope:'turn',ownerId,revision:1,selections:proof.selections};
  }

  function discard(sessionId:string,token:string) {
    if(pending.get(token)?.sessionId!==sessionId)return false;
    return pending.delete(token);
  }

  async function eligibleTurn(history:RunHistory,sessionId:string) {
    const {target}=await historyTeachingContext(sql,sessionId);
    const selections:HistoryPin[]=[];
    for(const pin of history.selections)if(await currentPin(sql,pin,target))selections.push(pin);
    return selections.length?{...history,selections}:undefined;
  }

  return {stage,prepare,attachTask,forRun,forTask,view,remove,turn,eligibleTurn,discard,consume:(tokens:readonly string[])=>{for(const token of tokens)pending.delete(token);}};
}
