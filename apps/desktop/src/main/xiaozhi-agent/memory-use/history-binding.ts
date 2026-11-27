import {randomUUID} from 'node:crypto';
import type {PendingHistoryReference,HistorySelection,TaskHistoryScope,TaskHistoryRemoval} from '../../../shared/xiaozhi-history-memory';
import type {XiaozhiMemoryUseSelection} from '../../../shared/xiaozhi-memory';
import {validTaskOwner,type TaskView,type TaskOwner} from '../../../shared/xiaozhi-task';
import type {createHistoryMemory} from '../history/memory';
import {createHistoryState} from '../history/state';
import {eligibleHistorySessions,historyTargetApplies,historyTeachingContext,type HistoryTeachingTarget as Target} from '../history/teaching-target';
import type {PrivateMemoryScope} from '../memory-scope-state';
import {createReferenceReceipts} from './receipts';
import {memorySelectionKey,validMemoryUseSelection} from '../memory-selection';
import type {Sql} from '../session-state';

export type HistoryPin=HistorySelection & {fingerprint:string};
type BoundHistory={scope:'task'|'turn';ownerId:string;revision:number;selections:HistoryPin[];excludeSessionHistory?:true};
export type RunHistory=BoundHistory;
type Pending={sessionId:string;scopeVersion:number;target:Target;pin:HistoryPin;expires:number};
type PermissionBasis={kind:'confirmed_picker'|'session_reference';scopeVersion:number};
type TaskBinding={
  schemaVersion:1;sessionId:string;taskId:string;revision:number;requirementsVersion:number;
  target:Target;admittedBy:TaskOwner;selections:HistoryPin[];invalidated?:true;excludeSessionHistory?:true;permissionBasis?:PermissionBasis;
};
const taskKey=(id:string)=>'xiaozhi.memory-use.task.v1:'+id;
const sameTarget=(a:Target,b:Target)=>a.folderId===b.folderId&&a.term===b.term;

export function historyOmissionScope(prompt:string) {
  const match=/(?:^|[，。；！？,;!?\n])\s*(?:请\s*)?(本任务|这项任务|当前任务|本次任务|这次|本次|这一轮|本轮)?\s*(?:不要|不用|别|无需|不必|不需要|不使用|不引用|不参考)\s*(?:(?:再|去)?(?:读取|引用|参考|沿用|使用|查阅))?\s*(?:(?:先前|之前|过去|以前|已选|已授权)的?)?(?:历史(?:记忆|引用|来源|记录)?|旧(?:会话|对话))(?=[，。；！？,;!?\s]|$)/u.exec(prompt.normalize('NFKC'));
  if(!match)return;
  return ['本任务','这项任务','当前任务','本次任务'].includes(match[1])?'task':'turn';
}


export function historyUseRequest(prompt:string) {
  const text=prompt.normalize('NFKC');
  const named=[...text.matchAll(/(?:^|[，。；！？,;!?\n])\s*(?:请\s*)?(逐字\s*)?(参考|引用|沿用|使用)\s*历史(?:记录|资料|对话|来源)?\s*[:：]?\s*《([^《》\n]{1,80})》/gu)]
    .map(match=>({title:match[3].trim(),literal:Boolean(match[1]&&match[2]==='引用')})).filter(item=>item.title);
  const vague=/(?:^|[，。；！？,;!?\n])\s*(?:请\s*)?(?:照|按|参考|沿用|使用|接着)\s*(?:上次|上回|之前|过去)的?(?:那份|那个|那一份|那一条)/u.test(text);
  if(!named.length&&!vague)return;
  const quotedTitles=[...text.matchAll(/《([^《》\n]{1,80})》/gu)];
  if(named.length===1&&quotedTitles.length===1&&!vague){
    const [{title,literal}]=named;
    return {kind:'named' as const,title,query:title,...(literal?{literal:true as const}:{})};
  }
  return {kind:'confirm' as const,query:text.trim().slice(0,1800)};
}

async function verifiedLiteralReply(sql:Sql,sessionId:string,runId:string,sourceText:string) {
  const literal=sourceText.trim();
  if(!literal || Buffer.byteLength(literal)>2048)return false;
  const replies=await sql.all(`SELECT substr(content,1,200001) AS content FROM ai_conversation_messages
    WHERE session_id=? AND role='assistant' AND CASE WHEN json_valid(metadata_json)
      THEN (metadata_json->>'$.agentRunId')=? AND (metadata_json->>'$.ok')=1 ELSE 0 END
    ORDER BY rowid DESC LIMIT 2`,[sessionId,runId]);
  const result=replies[0]?.content;
  return replies.length===1&&typeof result==='string'&&result.length<=200000&&result.includes(literal);
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
    binding.invalidated!==undefined&&binding.invalidated!==true||
    binding.excludeSessionHistory!==undefined&&binding.excludeSessionHistory!==true||
    binding.permissionBasis!==undefined&&(!binding.permissionBasis||
      !['confirmed_picker','session_reference'].includes(binding.permissionBasis.kind)||
      !Number.isSafeInteger(binding.permissionBasis.scopeVersion)||binding.permissionBasis.scopeVersion<0)||
    !validTaskOwner(binding.admittedBy)||binding.admittedBy.sessionId!==task.sessionId)throw Error('memory_scope_changed');
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

  type Prepared=Awaited<ReturnType<typeof prepare>> & {namedTitle?:string};

  async function namedSessionPin(work:Sql,title:string,saved:PrivateMemoryScope,target:Target) {
    if(!saved.enabled||!saved.selections.some(pin=>pin.layer==='history'))return;
    const rows=await work.all(`SELECT a.source_id,a.session_id,a.generation,a.source_version FROM memory_source_access a
      JOIN ai_conversation_sessions s ON s.id=a.session_id
      WHERE a.memory_state='active' AND a.index_allowed=1 AND a.discover_allowed=1 AND s.title=?
        AND COALESCE(s.archived_at,'')='' AND COALESCE(s.student_id,'')=''
        AND (s.folder_id IS NULL OR s.folder_id=?) ORDER BY a.source_id LIMIT 25`,[title,target.folderId]);
    if(!rows.length||rows.length===25)return;
    const applicable=await eligibleHistorySessions(work,rows.map(row=>String(row.session_id)),target);
    const candidates=rows.filter(row=>applicable.has(String(row.session_id)));
    if(candidates.length!==1)return;
    const [found]=candidates;
    return saved.selections.find((pin):pin is HistoryPin=>pin.layer==='history'&&pin.id===found.source_id&&
      pin.version===found.generation&&pin.sourceVersion===found.source_version);
  }

  async function prepareNamed(sessionId:string,title:string):Promise<Prepared|undefined> {
    const {saved,target}=await historyTeachingContext(sql,sessionId);
    const pin=await namedSessionPin(sql,title,saved,target);
    if(!pin)return;
    const source=await history.selected(pin).catch(()=>null);
    if(source?.fingerprint!==pin.fingerprint)return;
    return {scopeVersion:saved.version,target,selections:[pin],namedTitle:title};
  }

  async function confirm(work:Sql,sessionId:string,proof:Prepared) {
    const {saved,target}=await historyTeachingContext(work,sessionId);
    if(saved.version!==proof.scopeVersion||!sameTarget(target,proof.target))throw Error('memory_scope_changed');
    if(proof.namedTitle){
      const named=await namedSessionPin(work,proof.namedTitle,saved,target);
      if(!named||JSON.stringify(named)!==JSON.stringify(proof.selections[0]))throw Error('memory_scope_changed');
    }
    for(const pin of proof.selections)if(!await currentPin(work,pin,target))throw Error('memory_scope_changed');
    return saved;
  }

  function ownsTask(task:TaskView,owner:TaskOwner) {
    return task.state==='active'&&task.sessionId===owner.sessionId&&task.binding?.runId===owner.runId&&
      task.binding.generation===owner.generation;
  }

  async function writeBinding(work:Sql,task:TaskView,owner:TaskOwner,prior:TaskBinding|null,target:Target,
    selections:HistoryPin[],excludeSessionHistory?:true,permissionBasis?:PermissionBasis) {
    const binding:TaskBinding={schemaVersion:1,sessionId:owner.sessionId,taskId:task.id,
      revision:(prior?.revision??0)+1,requirementsVersion:task.requirementsVersion,target,admittedBy:owner,selections,
      ...(excludeSessionHistory?{excludeSessionHistory}:{}),...(permissionBasis?{permissionBasis}:{}),
    };
    if(prior?.admittedBy.runId===owner.runId){
      // A run has one admission. Never replace a teacher's subsequent removal with its old proof.
      const unchanged=prior.admittedBy.generation===owner.generation && !prior.invalidated &&
        prior.requirementsVersion===task.requirementsVersion && sameTarget(prior.target,target) &&
        prior.excludeSessionHistory===excludeSessionHistory && prior.permissionBasis?.kind===permissionBasis?.kind &&
        prior.permissionBasis?.scopeVersion===permissionBasis?.scopeVersion && prior.selections.length===selections.length &&
        selections.every(pin=>prior.selections.some(item=>item.id===pin.id && item.version===pin.version &&
          item.sourceVersion===pin.sourceVersion && item.fingerprint===pin.fingerprint));
      if(!unchanged)throw Error('memory_scope_changed');
      return;
    }
    // Writes here share the Task checkpoint transaction, including journal publication.
    await work.run(`INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)
      ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at`,
    [taskKey(task.id),JSON.stringify(binding),new Date().toISOString()]);
  }

  async function attachTask(work:Sql,task:TaskView,owner:TaskOwner,proof:Prepared) {
    if(!ownsTask(task,owner))throw Error('memory_scope_changed');
    const saved=await confirm(work,owner.sessionId,proof);
    const prior=await readTaskBinding(work,task);
    const existing:HistoryPin[]=[];
    if(prior&&!prior.invalidated&&sameTarget(prior.target,proof.target)){
      for(const pin of prior.selections)if(await currentPin(work,pin,proof.target))existing.push(pin);
    }
    const selections=combinedMemorySelections(existing,proof.selections);
    combinedMemorySelections(saved.selections,selections);
    await writeBinding(work,task,owner,prior,proof.target,selections,prior?.excludeSessionHistory,{
      kind:proof.namedTitle?'session_reference':'confirmed_picker',scopeVersion:proof.scopeVersion,
    });
  }

  async function excludeForTask(work:Sql,task:TaskView,owner:TaskOwner) {
    if(!ownsTask(task,owner))throw Error('memory_scope_changed');
    const {target}=await historyTeachingContext(work,owner.sessionId);
    const prior=await readTaskBinding(work,task);
    await writeBinding(work,task,owner,prior,target,[],true);
  }

  async function forTask(task:TaskView,includeInvalidated=false):Promise<RunHistory|undefined> {
    if(task.state==='ended'||task.state==='completed')return;
    const binding=await readTaskBinding(sql,task);
    if(!binding)return;
    const {target}=await historyTeachingContext(sql,task.sessionId);
    const selections:HistoryPin[]=[];
    if(!binding.invalidated&&sameTarget(binding.target,target)){
      for(const pin of binding.selections)if(includeInvalidated||await currentPin(sql,pin,target))selections.push(pin);
    }
    if(!selections.length&&!binding.excludeSessionHistory)return;
    return {scope:'task',ownerId:task.id,revision:binding.revision,selections,
      ...(binding.excludeSessionHistory?{excludeSessionHistory:true}:{})};
  }

  async function forRun(task:TaskView,owner:TaskOwner,includeInvalidated=false) {
    if(!ownsTask(task,owner))return;
    return forTask(task,includeInvalidated);
  }

  async function view(task:TaskView,lastOwnedRunId?:string):Promise<TaskHistoryScope|undefined> {
    const binding=await forTask(task);
    if(!binding)return;
    const receipts=createReferenceReceipts(sql);
    const runId=task.binding?.runId??lastOwnedRunId;
    const [delivered,readbacks,runs]=runId ? await Promise.all([
      receipts.referenceDeliveriesForRun(task.sessionId,runId),
      receipts.referenceReadbacksForRun(task.sessionId,runId),
      sql.all("SELECT status,prompt FROM ai_agent_runs WHERE id=? AND session_id=? AND sub_intent='pi_education'",[runId,task.sessionId]),
    ]) : [[],[],[]];
    const latestRun=runs[0];
    const request=latestRun?.status==='succeeded'&&typeof latestRun.prompt==='string'
      ? historyUseRequest(latestRun.prompt) : undefined;
    const exactQuoteTitle=binding.selections.length===1&&request?.kind==='named'&&request.literal
      &&runId===task.origin.runId&&task.requirementsVersion===1
      ? request.title : undefined;
    const items:TaskHistoryScope['items']=[];
    for(const pin of binding.selections){
      const source=await history.selected(pin).catch(()=>null);
      if(source?.fingerprint!==pin.fingerprint)continue;
      const matches=(row:typeof delivered[number]|typeof readbacks[number])=>
        row.reason==='task'&&row.id===pin.id&&row.version===pin.version&&row.fingerprint===pin.fingerprint;
      const sent=delivered.find(matches), read=readbacks.find(matches);
      const isVerified=runId&&sent&&read&&sent.scopeVersion===read.scopeVersion&&exactQuoteTitle===source.title
        &&await verifiedLiteralReply(sql,task.sessionId,runId,source.text);
      const useStage=isVerified?'verified':sent?'delivered':read?'source_read':'selected';
      items.push({sourceId:pin.id,label:source.title+' · '+source.label,useStage});
    }
    const after=await forTask(task);
    if(!after||after.revision!==binding.revision||!items.length&&!after.excludeSessionHistory)return;
    return {taskId:task.id,revision:binding.revision,items:items.filter(item=>after.selections.some(pin=>pin.id===item.sourceId)),
      ...(runs[0]?.status==='failed'?{runOutcome:'failed' as const}:{}),
      ...(after.excludeSessionHistory?{excludeSessionHistory:true}:{})};
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

  return {stage,prepare,prepareNamed,attachTask,excludeForTask,forRun,forTask,view,remove,turn,eligibleTurn,discard,consume:(tokens:readonly string[])=>{for(const token of tokens)pending.delete(token);}};
}
