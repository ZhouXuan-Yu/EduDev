import {createHmac,randomBytes,randomUUID,timingSafeEqual} from 'node:crypto';
import {
  ORDINARY_CONFIG_SCHEMA, validOperationId, validOrdinaryCommit, validOrdinaryQuery, validOrdinaryUndo,
  validOrdinaryValue, type OrdinaryChange, type OrdinaryHistory, type OrdinaryIntent,
  type OrdinaryQuery, type OrdinaryReceipt, type OrdinaryTarget, type OrdinaryUndo,
} from '../../shared/xiaozhi-ordinary-config';
import {validThinkingChoice} from '../../shared/xiaozhi-thinking';
import {createModelSettingsState} from './model-settings-state';
import type {Sql} from './session-state';

const changes='xiaozhi_config_changes_v1';
const heads='xiaozhi_config_heads_v1';
const operations='xiaozhi_config_operations_v1';
const fields="'default_model','global_thinking','session_thinking'";
const pageSize=20;

export const ordinaryConfigSchema=`
CREATE TABLE ${changes}(
  seq INTEGER PRIMARY KEY,
  change_id TEXT NOT NULL UNIQUE,
  field TEXT NOT NULL CHECK(field IN (${fields})),
  scope_id TEXT NOT NULL,
  previous_value TEXT,
  next_value TEXT,
  revision INTEGER NOT NULL CHECK(revision>0),
  changed_at TEXT NOT NULL,
  undo_of TEXT UNIQUE REFERENCES ${changes}(change_id),
  CHECK((field='session_thinking')=(scope_id<>''))
);
CREATE INDEX xiaozhi_config_changes_scope_v1 ON ${changes}(field,scope_id,seq DESC);
CREATE TABLE ${heads}(
  field TEXT NOT NULL CHECK(field IN (${fields})),
  scope_id TEXT NOT NULL,
  change_id TEXT NOT NULL REFERENCES ${changes}(change_id),
  PRIMARY KEY(field,scope_id),
  CHECK((field='session_thinking')=(scope_id<>''))
);
CREATE TABLE ${operations}(
  operation_id TEXT PRIMARY KEY,
  request_json TEXT NOT NULL CHECK(json_valid(request_json) AND length(request_json)<=1024),
  receipt_json TEXT NOT NULL CHECK(json_valid(receipt_json) AND length(receipt_json)<=1024)
);`;

type Preflight={expectedModelVersion?:number;sealedKey?:string;verify?:(work:Sql)=>Promise<void>;assertCurrent?:()=>void};
const isUndo=(input:OrdinaryIntent):input is OrdinaryUndo=>'changeId' in input;
const scope=(target:OrdinaryTarget)=>[target.field,target.sessionId??''];
function payload(input:OrdinaryIntent){
  const target=scope(input);
  return isUndo(input)
    ?JSON.stringify(['undo',...target,input.changeId,input.changeVersion])
    :JSON.stringify(['save',...target,input.expectedVersion,input.value,input.credentialId??null]);
}

function checkedIntent(input:OrdinaryIntent){
  if(!(isUndo(input)?validOrdinaryUndo(input):validOrdinaryCommit(input)))throw Error('invalid_input');
}
async function authorized(work:Sql,target:OrdinaryTarget) {
  if(target.sessionId && !(await work.all(
    'SELECT id FROM ai_conversation_sessions WHERE id=? AND archived_at IS NULL',[target.sessionId],
  )).length)throw Error('permission_denied');
}
async function readField(work:Sql,target:OrdinaryTarget){
  const store=createModelSettingsState(work);
  if(target.field==='default_model'){
    const config=await store.configuration();
    return {value:config.defaultModel,version:config.revision};
  }
  const thinking=await store.thinking(target.sessionId);
  return {value:thinking.choice,version:thinking.version};
}
async function duplicate(work:Sql,input:OrdinaryIntent):Promise<OrdinaryReceipt|undefined>{
  const [row]=await work.all(`SELECT request_json,receipt_json FROM ${operations} WHERE operation_id=?`,[input.operationId]);
  if(!row)return;
  if(row.request_json!==payload(input))throw Error('invalid_input');
  let receipt:OrdinaryReceipt;
  try{receipt=JSON.parse(String(row.receipt_json));}catch{throw Error('configuration');}
  if(receipt.schemaVersion!==ORDINARY_CONFIG_SCHEMA||receipt.operationId!==input.operationId||
    !['committed','no_change'].includes(receipt.outcome)||!Number.isSafeInteger(receipt.version)||receipt.version<0||
    !(receipt.changeId===null||validOperationId(receipt.changeId))||
    !(receipt.savedAt===null||typeof receipt.savedAt==='string'&&Number.isFinite(Date.parse(receipt.savedAt)))||
    receipt.effectiveFrom!=='next_applicable_run')throw Error('configuration');
  return {schemaVersion:ORDINARY_CONFIG_SCHEMA,operationId:receipt.operationId,outcome:receipt.outcome,
    version:receipt.version,changeId:receipt.changeId,savedAt:receipt.savedAt,effectiveFrom:receipt.effectiveFrom};
}
async function tip(work:Sql,target:OrdinaryTarget){
  const [row]=await work.all(`SELECT c.change_id,c.previous_value,c.next_value,c.revision,c.undo_of
    FROM ${heads} h JOIN ${changes} c ON c.change_id=h.change_id AND c.field=h.field AND c.scope_id=h.scope_id
    WHERE h.field=? AND h.scope_id=?`,scope(target));
  return row;
}
async function proposedUndo(work:Sql,input:OrdinaryUndo,current:Awaited<ReturnType<typeof readField>>){
  const target=await tip(work,input);
  if(!target||target.undo_of!==null||target.change_id!==input.changeId||target.revision!==input.changeVersion||
    target.next_value!==current.value)throw Error('stale_change');
  if(!validOrdinaryValue(input.field,target.previous_value))throw Error('configuration');
  return target.previous_value;
}

export function createOrdinaryConfigJournal(sql:Sql) {
  // A cursor is local to one open host and cannot be edited or reused for another field.
  const cursorKey=randomBytes(32);
  function cursor(target:OrdinaryTarget,last:number){
    const encoded=Buffer.from(JSON.stringify([1,...scope(target),last])).toString('base64url');
    return encoded+'.'+createHmac('sha256',cursorKey).update(encoded).digest('base64url');
  }
  function readCursor(query:OrdinaryQuery){
    if(query.cursor===undefined)return Number.MAX_SAFE_INTEGER;
    const [encoded,tag,...rest]=query.cursor.split('.');
    if(!encoded||!tag||rest.length||!/^[A-Za-z0-9_-]{43}$/.test(tag))throw Error('invalid_input');
    const actual=createHmac('sha256',cursorKey).update(encoded).digest();
    const candidate=Buffer.from(tag,'base64url');
    if(candidate.toString('base64url')!==tag||candidate.length!==actual.length||!timingSafeEqual(actual,candidate))throw Error('invalid_input');
    const [version,field,id,seq]=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));
    if(version!==1||field!==query.field||id!==(query.sessionId??'')||!Number.isSafeInteger(seq)||seq<1)throw Error('invalid_input');
    return seq as number;
  }
  return {
    async repeat(input:OrdinaryIntent){
      checkedIntent(input);
      await authorized(sql,input);
      return duplicate(sql,input);
    },
    async preview(input:OrdinaryIntent) {
      checkedIntent(input);
      if(!sql.readTransaction)throw Error('configuration');
      return sql.readTransaction(async work=>{
        await authorized(work,input);
        const receipt=await duplicate(work,input);
        if(receipt)return {receipt};
        const current=await readField(work,input);
        if(!isUndo(input)&&input.expectedVersion!==current.version)throw Error('conflict');
        return {current,next:isUndo(input)?await proposedUndo(work,input,current):input.value};
      });
    },
    async write(input:OrdinaryIntent,preflight:Preflight={}):Promise<OrdinaryReceipt>{
      checkedIntent(input);
      if(!sql.transaction)throw Error('configuration');
      return sql.transaction(async work=>{
        preflight.assertCurrent?.();
        await authorized(work,input);
        const previous=await duplicate(work,input);
        if(previous)return previous;
        const current=await readField(work,input);
        if(!isUndo(input)&&input.expectedVersion!==current.version)throw Error('conflict');
        const next=isUndo(input)?await proposedUndo(work,input,current):input.value;
        if(preflight.expectedModelVersion!==undefined&&current.version!==preflight.expectedModelVersion)throw Error('conflict');
        if(input.field==='default_model'&&next!==null&&
          (next!==current.value||preflight.sealedKey!==undefined)&&preflight.expectedModelVersion!==current.version)throw Error('validation_unavailable');
        await preflight.verify?.(work);
        preflight.assertCurrent?.();
        const changed=current.value!==next;
        const edited=changed||preflight.sealedKey!==undefined;
        const recorded=edited?new Date().toISOString():null;
        const changeId=changed?randomUUID():null;
        const version=current.version+Number(edited);
        if(edited){
          const state=createModelSettingsState(work);
          if(input.field==='default_model'){
            const saved=await state.configuration();
            const sealed=preflight.sealedKey??saved.sealedKey;
            await state.saveConfiguration(current.version,{schema:1,defaultModel:next,...(sealed?{sealedKey:sealed}:{})});
          }else{
            if(!(validThinkingChoice(next)||next===null))throw Error('configuration');
            await state.saveThinking(input.sessionId,current.version,next);
          }
        }
        if(changeId){
          await work.run(`INSERT INTO ${changes}(change_id,field,scope_id,previous_value,next_value,revision,changed_at,undo_of)
            VALUES(?,?,?,?,?,?,?,?)`,[changeId,...scope(input),current.value,next,version,recorded,isUndo(input)?input.changeId:null]);
          await work.run(`INSERT INTO ${heads}(field,scope_id,change_id) VALUES(?,?,?)
            ON CONFLICT(field,scope_id) DO UPDATE SET change_id=excluded.change_id`,[...scope(input),changeId]);
        }
        const receipt:OrdinaryReceipt={schemaVersion:ORDINARY_CONFIG_SCHEMA,operationId:input.operationId,
          outcome:edited?'committed':'no_change',version,changeId,savedAt:recorded,effectiveFrom:'next_applicable_run'};
        await work.run(`INSERT INTO ${operations} VALUES(?,?,?)`,[input.operationId,payload(input),JSON.stringify(receipt)]);
        preflight.assertCurrent?.();
        return receipt;
      });
    },
    async history(query:OrdinaryQuery):Promise<OrdinaryHistory>{
      if(!validOrdinaryQuery(query))throw Error('invalid_input');
      if(!sql.readTransaction)throw Error('configuration');
      const before=readCursor(query);
      return sql.readTransaction(async work=>{
        await authorized(work,query);
        const current=await readField(work,query),head=await tip(work,query);
        const values=await work.all(`SELECT c.seq,c.change_id,c.previous_value,c.next_value,c.revision,c.changed_at,c.undo_of,
          EXISTS(SELECT 1 FROM ${changes} u WHERE u.undo_of=c.change_id) AS undone
          FROM ${changes} c WHERE c.field=? AND c.scope_id=? AND c.seq<? ORDER BY c.seq DESC LIMIT ?`,
          [...scope(query),before,pageSize+1]);
        const items=values.slice(0,pageSize).map((row):OrdinaryChange=>{
          if(!validOperationId(row.change_id)||!validOrdinaryValue(query.field,row.previous_value)||
            !validOrdinaryValue(query.field,row.next_value)||!Number.isSafeInteger(row.revision)||typeof row.changed_at!=='string')throw Error('configuration');
          return {changeId:row.change_id,kind:row.undo_of===null?'save':'undo',previous:row.previous_value,value:row.next_value,
            version:Number(row.revision),savedAt:row.changed_at,undone:row.undone===1};
        });
        const undo=head&&head.undo_of===null&&head.next_value===current.value&&validOperationId(head.change_id)
          ?{changeId:head.change_id,version:Number(head.revision)}:null;
        return {...current,items,undo,cursor:values.length>pageSize?cursor(query,Number(values[pageSize-1].seq)):null};
      });
    },
  };
}
