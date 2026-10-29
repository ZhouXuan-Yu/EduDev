import {createHash,randomUUID} from 'node:crypto';
import type {QuestionBankItem,QuestionBankItemInput,ResourceChunk} from '../../shared/contracts';
import {MATERIAL_AI_SCHEMA,validAiBatch,validAiAction,validAiSettings,parseAiResponse,type AiAction,type AiBatchInput,type AiBatchView,type AiSettings,type AiSettingsInput,type AiUnitInput,type AiResponse} from '../../shared/material-ai';
import {QUESTION_AI_ARCHIVE_SCHEMA,archiveMissing,type QuestionArchive} from '../../shared/question-archive';
import type {SettingsKeyCodec} from '../xiaozhi-agent/model-settings';
import type {MaterialRepository} from './material-repository';
import {materialSource} from './material-source';
import {extractMaterialQuestions,normalizeMaterialStem} from './material-question-extract';
import {completeMaterialAi,type AiCompletion} from './material-ai-provider';
import type {MaterialWordRepository} from './material-word-repository';
import type {WordProofRuntime} from './word-question-proof-repository';
import type {NativeQuestionRepository} from './native-question-repository';
import type {WordQuestionSource} from '../../shared/material-word-question';
import type {LOCAL_OCR_ENGINE} from '../../shared/xiaozhi-ocr';
import {executeNativeAi,nativeAiTranscription,type NativeAiHost,type NativeAiPreparation} from './material-ai-native';
import {nativeSourceRoleText} from './native-question-content';
import {MATERIAL_AI_IMAGE_RESPONSE,parseAiBatchResponse,imageTextEvidence,type AiBatchResponse} from '../../shared/material-ai-image';
import {validQuestionProjection} from '../../shared/question-projection';

type Row=Record<string,unknown>;
type Value=string|number|null;
type Host={all:(sql:string,p?:Value[])=>Promise<Row[]>;run:(sql:string,p?:Value[])=>Promise<void>;materials:()=>MaterialRepository;
  word?:()=>MaterialWordRepository;native?:()=>NativeQuestionRepository;prepare?:NativeAiPreparation;
  map:(row:Row)=>ResourceChunk;create:(q:QuestionBankItemInput)=>Promise<QuestionBankItem>;
  writer:<T>(action:(target:MaterialAiRepository)=>Promise<T>,beforeCommit?:()=>void)=>Promise<T>};
type Configuration={revision:number;model:AiSettings['model'];sealedKey:string};
export type AiBatchTask={key:string;folderId?:string;revision?:number};
export type AiRuntime={account?:()=>Promise<{revision:number;model:'deepseek-flash';apiKey:string}>;codec:SettingsKeyCodec;clean:(text:string)=>Promise<string>;image:(resourceId:string,version:string,page:number|undefined,signal:AbortSignal)=>Promise<{data:string;mime:string}>;complete?:AiCompletion;word?:WordProofRuntime;ocr?:(bytes:Buffer,signal:AbortSignal)=>Promise<{text:string;engine:typeof LOCAL_OCR_ENGINE}>};
const key='xiaozhi.material-ai.v1';
const hash=(v:string|Buffer)=>createHash('sha256').update(v).digest('hex');
const alive=(pid:number)=>{try{process.kill(pid,0);return true;}catch(error){return (error as NodeJS.ErrnoException).code!=='ESRCH';}};
const safeError=(error:unknown)=>{
  const code=error instanceof Error?error.message:'';
  return ['configuration','storage_unavailable','conflict','source_changed','source_incomplete','unit_too_large','privacy_blocked','unsupported','authentication','rate_limit','provider_rejected','invalid_response','outcome_unknown','budget_exhausted','paused','cancelled','ocr_failed','ocr_unavailable','font_unavailable','font_missing_glyph','disk_full','timeout','busy','index_busy'].includes(code)?code:'unavailable';
};

/** Durable deterministic batch executor. It has no Agent session or tool execution. */
export class MaterialAiRepository{
  private runtime?:AiRuntime;
  private account?:AiRuntime['account'];
  private timer?:ReturnType<typeof setInterval>;
  private pumping?:Promise<void>;
  private active?:{batchId:string;controller:AbortController};
  private closing=false;
  constructor(private host:Host){}
  configure(runtime:AiRuntime){this.runtime=runtime;this.account=runtime.account;}
  private write<T>(action:(target:MaterialAiRepository)=>Promise<T>,beforeCommit?:()=>void){return this.host.writer(target=>{target.account=this.runtime?.account||this.account;return action(target);},beforeCommit);}
  private nativeHost():NativeAiHost{if(!this.host.native||!this.host.word)throw Error('unsupported');return{all:this.host.all,run:this.host.run,create:this.host.create,native:this.host.native,word:this.host.word};}
  async nativeTranscription(q:QuestionBankItem,source:WordQuestionSource,signal:AbortSignal){return nativeAiTranscription(this.nativeHost(),q,source,(c,u)=>this.validateInput(c,u),signal);}
  async migrate(){
    for(const sql of [
      `CREATE TABLE IF NOT EXISTS material_ai_batches(id TEXT PRIMARY KEY,resource_id TEXT NOT NULL,version TEXT NOT NULL,title TEXT NOT NULL,config_json TEXT NOT NULL,status TEXT NOT NULL,calls INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS material_ai_units(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,input_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',first_json TEXT NOT NULL DEFAULT '',final_json TEXT NOT NULL DEFAULT '',image_sha TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '',owner_pid INTEGER NOT NULL DEFAULT 0,lease TEXT NOT NULL DEFAULT '',PRIMARY KEY(batch_id,ordinal))`,
      `CREATE INDEX IF NOT EXISTS material_ai_units_pending ON material_ai_units(status,batch_id,ordinal)`,
      `CREATE TABLE IF NOT EXISTS material_ai_task_keys(task_key TEXT PRIMARY KEY,input_sha TEXT NOT NULL,batch_id TEXT NOT NULL UNIQUE REFERENCES material_ai_batches(id),folder_id TEXT NOT NULL DEFAULT '',folder_revision INTEGER NOT NULL DEFAULT 0)`,
      `CREATE TABLE IF NOT EXISTS material_ai_image_inputs(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,image_sha TEXT NOT NULL,mime TEXT NOT NULL,data_base64 TEXT NOT NULL CHECK(length(data_base64)<=5592408),PRIMARY KEY(batch_id,ordinal),FOREIGN KEY(batch_id,ordinal) REFERENCES material_ai_units(batch_id,ordinal))`,
      `CREATE TABLE IF NOT EXISTS material_ai_members(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,number TEXT NOT NULL,question_id TEXT NOT NULL UNIQUE,PRIMARY KEY(batch_id,ordinal,number))`
    ])await this.host.run(sql);
    if(!(await this.host.all('PRAGMA table_info(material_ai_units)')).some(column=>column.name==='dispatched_at'))await this.host.run('ALTER TABLE material_ai_units ADD COLUMN dispatched_at INTEGER NOT NULL DEFAULT 0');
  }
  private async configuration():Promise<Configuration>{
    if(this.account){const shared=await this.account();return{revision:shared.revision,model:shared.model,sealedKey:shared.apiKey?'shared-deepseek':''};}
    const row=(await this.host.all('SELECT value_json FROM app_settings WHERE key=?',[key]))[0];
    if(!row)return {revision:0,model:'qwen3-vl-plus',sealedKey:''};
    let v;try{v=JSON.parse(String(row.value_json));}catch{throw new Error('configuration');}
    if(!v||!validAiSettings({schemaVersion:MATERIAL_AI_SCHEMA,revision:v.revision,model:v.model})||typeof v.sealedKey!=='string'||v.sealedKey.length>16384||Object.keys(v).sort().join(',')!=='model,revision,sealedKey')throw new Error('configuration');
    return v;
  }
  async settings():Promise<AiSettings>{const c=await this.configuration();return {revision:c.revision,model:c.model,configured:!!c.sealedKey,secureStorage:!!this.runtime?.codec.available()};}
  async saveSettings(input:AiSettingsInput){
    if(this.account)throw Error('unified_settings');
    if(!validAiSettings(input))throw new Error('invalid_input');
    const old=await this.configuration();if(old.revision!==input.revision)throw new Error('conflict');
    if(!this.runtime?.codec.available())throw new Error('storage_unavailable');
    const sealedKey=input.apiKey?this.runtime.codec.seal(input.apiKey):old.sealedKey;
    if(!sealedKey)throw new Error('configuration');
    await this.write(async target=>{
      if((await target.configuration()).revision!==input.revision)throw new Error('conflict');
      await target.host.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at',
        [key,JSON.stringify({revision:old.revision+1,model:input.model,sealedKey}),new Date().toISOString()]);
      await target.host.run("UPDATE material_ai_batches SET status='configuration_changed' WHERE status IN ('running','paused')");
    });
    this.active?.controller.abort();return this.settings();
  }
  private async inputs(input:AiBatchInput):Promise<AiUnitInput[]>{
    const resource=await this.host.materials().resource(input.resourceId);
    if(resource.contentHash!==input.version)throw new Error('source_changed');
    const stamp=await this.host.materials().originalStamp(resource.id,input.version);
    const pdf=/\.pdf$/i.test(resource.originalFileName),image=/\.(?:png|jpg|jpeg|webp)$/i.test(resource.originalFileName);
    if(input.images&&/\.docx$/i.test(resource.originalFileName)){
      const host=this.nativeHost(),window=await this.host.materials().readingWindow(resource.id,0,1);if(window.units.length!==1)throw Error('source_incomplete');
      const units:AiUnitInput[]=[];
      for(let i=0;i<input.count;i++){
        const ordinal=input.start+i,page=await host.word().questions({schemaVersion:'xiaozhi.word-question-source.v1',resourceId:resource.id,version:input.version,offset:ordinal-1,ordinal}),source=page?.source;
        if(!source)throw Error('source_incomplete');
        const text=JSON.stringify(Object.fromEntries(['question','answer','analysis'].map(role=>[role,nativeSourceRoleText(source,role as 'question')])));if(Buffer.byteLength(text)>64000)throw Error('unit_too_large');
        const unit:AiUnitInput={sources:window.units.map(materialSource),text,visualRisk:true,stamp,native:{schemaVersion:'xiaozhi.material-ai-native-input.v1',base:{schemaVersion:'xiaozhi.word-question-proof.v1',resourceId:resource.id,version:input.version,documentSha:source.documentSha,ordinal},sourceDigest:hash(JSON.stringify(source))}};
        await this.validateInput(input,unit);units.push(unit);
      }return units;
    }
    if(input.images&&!pdf&&!image)throw new Error('unsupported');
    if(image&&(input.start!==1||input.count!==1))throw new Error('invalid_input');
    const units:AiUnitInput[]=[];
    for(let i=0;i<input.count;i++){
      let page:number|undefined,offset=input.start+i-1,limit=1,extra='';
      if(pdf){
        page=input.start+i;
        const job=(await this.host.all('SELECT p.status,p.result_json FROM material_pdf_pages p JOIN material_pdf_jobs j ON j.generation=p.generation WHERE j.resource_id=? AND j.version=? AND p.page=?',[resource.id,input.version,page]))[0];
        if(!job||!['complete','blank'].includes(String(job.status)))throw new Error('source_incomplete');
        if(job.status==='blank'){units.push({sources:[],text:'',page,visualRisk:true,stamp});continue;}
        const rows=await this.host.all('SELECT c.*, (SELECT COUNT(*) FROM resource_chunks x WHERE x.resource_id=c.resource_id AND (x.chunk_index<c.chunk_index OR x.chunk_index=c.chunk_index AND x.id<c.id)) AS body_offset FROM resource_chunks c WHERE c.resource_id=? AND c.page_number=? ORDER BY c.chunk_index,c.id LIMIT 17',[resource.id,page]);
        if(!rows.length||rows.length>16)throw new Error('unit_too_large');
        offset=Number(rows[0].body_offset);limit=rows.length;
        const raw=JSON.parse(String(job.result_json));
        extra=JSON.stringify({native:raw.nativeText,ocr:raw.ocrText});
      }
      const window=await this.host.materials().readingWindow(resource.id,offset,limit);
      if(window.units.length!==limit||page&&window.units.some(u=>u.chunk.pageNumber!==page))throw new Error('source_incomplete');
      if(window.units.some(u=>u.chunk.containsPersonalData))throw new Error('privacy_blocked');
      const text=window.units.map(u=>u.chunk.contentMd).join('\n\n')+(extra?'\n逐页识别对照数据：'+extra:'');
      if(Buffer.byteLength(text)>64000)throw new Error('unit_too_large');
      units.push({sources:window.units.map(materialSource),text,...(page?{page}:{}),visualRisk:pdf||image||!/\.(?:txt|md)$/i.test(resource.originalFileName),stamp});
    }
    return units;
  }
  private async taskBatch(input:AiBatchInput,task:AiBatchTask){
    const row=(await this.host.all('SELECT * FROM material_ai_task_keys WHERE task_key=?',[task.key]))[0];if(!row)return;
    if(row.input_sha!==hash(JSON.stringify(input))||row.folder_id!==(task.folderId||'')||Number(row.folder_revision)!==(task.revision||0))throw Error('conflict');return String(row.batch_id);
  }
  private async folderPermit(folderId:string,revision:number,settingsRevision?:number){
    const row=(await this.host.all('SELECT * FROM material_folder_ai WHERE batch_id=?',[folderId]))[0];
    if(!row||row.status!=='running'||Number(row.revision)!==revision)throw Error('paused');
    if(settingsRevision!==undefined&&Number(row.settings_revision)!==settingsRevision)throw Error('configuration');return row;
  }
  async create(input:AiBatchInput,task?:AiBatchTask){
    if(!validAiBatch(input))throw new Error('invalid_input');
    if(task){if(!/^[a-f0-9]{64}$/.test(task.key)||Object.keys(task).some(k=>!['key','folderId','revision'].includes(k))||((task.folderId!==undefined||task.revision!==undefined)&&(!/^batch_[a-f0-9-]{36}$/i.test(task.folderId||'')||!Number.isSafeInteger(task.revision)||Number(task.revision)<1)))throw Error('invalid_input');const prior=await this.taskBatch(input,task);if(prior)return prior;}
    const settings=await this.settings();
    if(!settings.configured||!settings.secureStorage||settings.revision!==input.settingsRevision)throw new Error('configuration');
    const units=await this.inputs(input),resource=await this.host.materials().resource(input.resourceId);
    await this.host.materials().verify(resource.id,input.version,new AbortController().signal);
    const id='aibatch_'+randomUUID();
    return this.write(async target=>{
      if(task){const prior=await target.taskBatch(input,task);if(prior)return prior;
        if(task.folderId){const grant=await target.folderPermit(task.folderId,task.revision!,input.settingsRevision),reserved=(await target.host.all("SELECT COALESCE(SUM(json_extract(b.config_json,'$.maxCalls')),0) n FROM material_ai_task_keys k JOIN material_ai_batches b ON b.id=k.batch_id WHERE k.folder_id=?",[task.folderId]))[0];if(Number(reserved.n)+input.maxCalls>Number(grant.max_calls))throw Error('budget_exhausted');}
      }
      if((await target.configuration()).revision!==input.settingsRevision)throw new Error('conflict');
      for(const unit of units)await target.validateInput(input,unit);
      await target.host.run('INSERT INTO material_ai_batches(id,resource_id,version,title,config_json,status,created_at) VALUES(?,?,?,?,?,?,?)',
        [id,resource.id,input.version,resource.title,JSON.stringify({...input,model:settings.model}),'running',new Date().toISOString()]);
      for(const [i,unit]of units.entries())await target.host.run('INSERT INTO material_ai_units(batch_id,ordinal,input_json,status) VALUES(?,?,?,?)',[id,i+1,JSON.stringify(unit),unit.text?'pending':'no_questions']);
      if(task)await target.host.run('INSERT INTO material_ai_task_keys VALUES(?,?,?,?,?)',[task.key,hash(JSON.stringify(input)),id,task.folderId||'',task.revision||0]);
      return id;
    });
  }
  private async validateInput(config:AiBatchInput,unit:AiUnitInput){
    const resource=await this.host.materials().resource(config.resourceId);
    if(resource.contentHash!==config.version||await this.host.materials().originalStamp(resource.id,config.version)!==unit.stamp)throw new Error('source_changed');
    for(const source of unit.sources)await this.host.materials().source(source);
    if(unit.native){
      if(!unit.sources.length||!config.images)throw Error('source_changed');
      if((await this.host.all('SELECT 1 FROM resource_chunks WHERE resource_id=? AND contains_personal_data=1 LIMIT 1',[config.resourceId])).length)throw Error('privacy_blocked');
      const base=unit.native.base,source=(await this.nativeHost().word().questions({schemaVersion:'xiaozhi.word-question-source.v1',resourceId:base.resourceId,version:base.version,ordinal:base.ordinal,offset:base.ordinal-1}))?.source;
      if(base.resourceId!==config.resourceId||base.version!==config.version||!source||source.documentSha!==base.documentSha||hash(JSON.stringify(source))!==unit.native.sourceDigest)throw Error('source_changed');
      if((await this.host.all('SELECT 1 FROM resource_chunks WHERE resource_id=? AND contains_personal_data=1 LIMIT 1',[config.resourceId])).length)throw Error('privacy_blocked');
    }
  }
  async list(resourceId:string,offset=0):Promise<AiBatchView[]>{
    const rows=await this.host.all("SELECT * FROM material_ai_batches WHERE resource_id=? ORDER BY CASE WHEN status IN ('running','paused','attention') THEN 0 ELSE 1 END,created_at DESC,id DESC LIMIT 10 OFFSET ?",[resourceId,offset]);
    const result:AiBatchView[]=[];
    for(const row of rows){
      const c=JSON.parse(String(row.config_json)),units=await this.host.all('SELECT ordinal,status,error,(SELECT COUNT(*) FROM material_ai_members m WHERE m.batch_id=u.batch_id AND m.ordinal=u.ordinal) questions FROM material_ai_units u WHERE batch_id=? ORDER BY ordinal',[String(row.id)]);
      const n=(...states:string[])=>units.filter(u=>states.includes(String(u.status))).length;
      result.push({id:String(row.id),resourceId:String(row.resource_id),title:String(row.title),model:c.model,start:c.start,count:c.count,images:c.images,status:String(row.status),calls:Number(row.calls),maxCalls:c.maxCalls,
        complete:n('complete','no_questions'),review:n('review'),failed:n('failed'),unknown:n('outcome_unknown'),pending:n('pending','first_saved','dispatched'),questions:units.reduce((sum,u)=>sum+Number(u.questions),0),
        units:units.map(u=>({ordinal:Number(u.ordinal),status:String(u.status),error:String(u.error),questions:Number(u.questions)}))});
    }
    return result;
  }
  async validate(q:QuestionBankItem){
    if(q.archive?.native){await this.nativeTranscription(q,(await this.nativeHost().word().questions({schemaVersion:'xiaozhi.word-question-source.v1',resourceId:q.archive.native.source.resourceId,version:q.archive.native.source.resourceVersion,ordinal:q.archive.native.source.ordinal,offset:q.archive.native.source.ordinal-1}))!.source!,new AbortController().signal);return;}
    const receipt=q.archive?.ai;if(!receipt)return;
    const row=(await this.host.all('SELECT u.*,b.config_json FROM material_ai_members m JOIN material_ai_units u ON u.batch_id=m.batch_id AND u.ordinal=m.ordinal JOIN material_ai_batches b ON b.id=m.batch_id WHERE m.question_id=? AND m.batch_id=? AND m.ordinal=? AND m.number=?',[q.id,receipt.batchId,receipt.ordinal,q.archive!.number]))[0];
    if(!row||!['complete','review'].includes(String(row.status))||hash(String(row.first_json))!==receipt.firstSha||hash(String(row.final_json))!==receipt.finalSha||String(row.image_sha)!==receipt.imageSha)throw new Error('source_changed');
    const unit=JSON.parse(String(row.input_json)) as AiUnitInput;
    if(JSON.stringify(unit.sources)!==JSON.stringify(q.archive!.sources))throw new Error('source_changed');
    if(receipt.policy==='image-text-complete.v1'){
      const config=JSON.parse(String(row.config_json)),first=parseAiBatchResponse(String(row.first_json)),final=parseAiBatchResponse(String(row.final_json));
      const units=[];for(const source of unit.sources)units.push(...(await this.host.materials().readingWindow(config.resourceId,source.offset,1)).units);
      const numbered=extractMaterialQuestions(units,'local-text-v1'),independent=numbered.find(x=>x.archive.number===q.archive!.number);
      const evidence=imageTextEvidence(first,final,q.archive!.number,receipt.imageSha,independent?.fields.stem);
      if(!config.images||!evidence||unit.native||!independent||independent.archive.sourceRisks.some(r=>r!=='visual_unchecked'))throw Error('source_changed');
      if(q.archive!.state==='ai_final'&&(['stem','answer','analysis','subject','grade','knowledgePoint','questionType','difficulty'] as const).some(k=>q[k]!==evidence[k]))throw Error('source_changed');
      const image=await this.storedImage(receipt.batchId,receipt.ordinal);if(!image)throw Error('source_changed');
      if(hash(Buffer.from(image.data,'base64'))!==receipt.imageSha)throw Error('source_changed');
    }
    await this.validateInput(JSON.parse(String(row.config_json)),unit);
  }
  async action(input:AiAction){
    if(!validAiAction(input))throw new Error('invalid_input');
    await this.write(async target=>{
      const row=(await target.host.all('SELECT * FROM material_ai_batches WHERE id=?',[input.batchId]))[0];if(!row)throw new Error('invalid_input');
      const c=JSON.parse(String(row.config_json));
      if(input.action!=='pause'&&(await target.configuration()).revision!==c.settingsRevision)throw new Error('configuration');
      if(input.action==='retry_unknown'){
        if(Number(row.calls)>=c.maxCalls)throw new Error('budget_exhausted');
        await target.host.run("UPDATE material_ai_units SET status=CASE WHEN first_json='' THEN 'pending' ELSE 'first_saved' END,error='',owner_pid=0,lease='' WHERE batch_id=? AND status='outcome_unknown'",[input.batchId]);
      }
      await target.host.run('UPDATE material_ai_batches SET status=? WHERE id=?',[input.action==='pause'?'paused':'running',input.batchId]);
    });
    if(input.action==='pause'&&this.active?.batchId===input.batchId)this.active.controller.abort();
  }
  private async storedImage(batchId:string,ordinal:number){
    const row=(await this.host.all('SELECT * FROM material_ai_image_inputs WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0];if(!row)return;
    const image={data:String(row.data_base64),mime:String(row.mime)};
    if(!['image/png','image/jpeg','image/webp'].includes(image.mime)||image.data.length>5592408)throw Error('source_changed');
    const bytes=Buffer.from(image.data,'base64');
    if(!bytes.length||bytes.length>4*1048576||bytes.toString('base64')!==image.data||hash(bytes)!==row.image_sha)throw Error('source_changed');return image;
  }
  async recover(){
    const units=await this.host.all("SELECT batch_id,ordinal,owner_pid,lease,dispatched_at FROM material_ai_units WHERE status='dispatched'");
    for(const unit of units)if(!alive(Number(unit.owner_pid))||Date.now()-Number(unit.dispatched_at)>180000)await this.host.run("UPDATE material_ai_units SET status='outcome_unknown',error='outcome_unknown',owner_pid=0,lease='' WHERE batch_id=? AND ordinal=? AND status='dispatched' AND owner_pid=? AND lease=? AND dispatched_at=?",[String(unit.batch_id),Number(unit.ordinal),Number(unit.owner_pid),String(unit.lease),Number(unit.dispatched_at)]);
  }
  async recoverStartup(){await this.recover();await this.host.run("UPDATE material_ai_batches SET status='paused' WHERE status='running'");}
  start(){
    if(this.timer)return;this.closing=false;
    const pump=()=>{if(this.pumping||!this.runtime||this.closing)return;this.pumping=this.recover().then(()=>this.drain()).then(()=>undefined).catch(()=>undefined).finally(()=>{this.pumping=undefined;});};
    this.timer=setInterval(pump,1000);this.timer.unref();pump();
  }
  async close(){this.closing=true;if(this.timer)clearInterval(this.timer);this.timer=undefined;this.active?.controller.abort();await this.pumping;}
  private async guard(batchId:string,config:AiBatchInput,unit:AiUnitInput,signal:AbortSignal){
    signal.throwIfAborted();const row=(await this.host.all('SELECT status FROM material_ai_batches WHERE id=?',[batchId]))[0];
    if(row?.status!=='running')throw new Error('paused');
    if((await this.configuration()).revision!==config.settingsRevision)throw new Error('configuration');
    await this.validateInput(config,unit);signal.throwIfAborted();
    const task=(await this.host.all('SELECT folder_id,folder_revision FROM material_ai_task_keys WHERE batch_id=?',[batchId]))[0];
    if(task?.folder_id)await this.folderPermit(String(task.folder_id),Number(task.folder_revision),config.settingsRevision);
  }
  private async dispatch(batchId:string,ordinal:number,config:AiBatchInput,unit:AiUnitInput,expected:string,signal:AbortSignal){
    const lease=randomUUID();
    await this.write(async target=>{
      await target.guard(batchId,config,unit,signal);
      const batch=(await target.host.all('SELECT calls FROM material_ai_batches WHERE id=?',[batchId]))[0];
      const saved=(await target.host.all('SELECT status FROM material_ai_units WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0];
      if(saved?.status!==expected)throw new Error('conflict');
      if(Number(batch.calls)>=config.maxCalls)throw new Error('budget_exhausted');
      await target.host.run('UPDATE material_ai_batches SET calls=calls+1 WHERE id=?',[batchId]);
      await target.host.run("UPDATE material_ai_units SET status='dispatched',owner_pid=?,lease=?,dispatched_at=?,error='' WHERE batch_id=? AND ordinal=?",[process.pid,lease,Date.now(),batchId,ordinal]);
    },()=>signal.throwIfAborted());
    return lease;
  }
  async drain(){
    if(!this.runtime||this.closing)return false;
    const row=(await this.host.all("SELECT u.*,b.config_json,b.resource_id,b.version,b.title FROM material_ai_units u JOIN material_ai_batches b ON b.id=u.batch_id WHERE b.status='running' AND u.status IN ('pending','first_saved') ORDER BY b.created_at,u.ordinal LIMIT 1"))[0];
    if(!row){await this.host.run("UPDATE material_ai_batches SET status=CASE WHEN EXISTS(SELECT 1 FROM material_ai_units u WHERE u.batch_id=material_ai_batches.id AND u.status IN ('failed','outcome_unknown','review')) THEN 'attention' ELSE 'complete' END WHERE status='running' AND NOT EXISTS(SELECT 1 FROM material_ai_units u WHERE u.batch_id=material_ai_batches.id AND u.status IN ('pending','first_saved','dispatched'))");return false;}
    const batchId=String(row.batch_id),ordinal=Number(row.ordinal),config=JSON.parse(String(row.config_json)) as AiBatchInput&{model:AiSettings['model']},unit=JSON.parse(String(row.input_json)) as AiUnitInput;
    const controller=new AbortController(),signal=controller.signal;this.active={batchId,controller};let lease='',transportStarted=false;
    try{
      await this.guard(batchId,config,unit,signal);
      if(unit.native){
        if(!this.host.prepare)throw Error('unsupported');
        await executeNativeAi({host:this.nativeHost(),prepare:this.host.prepare,runtime:this.runtime,row,config,unit,signal,guard:()=>this.guard(batchId,config,unit,signal),dispatch:expected=>this.dispatch(batchId,ordinal,config,unit,expected,signal),lease:value=>{lease=value;transportStarted=false;},transport:()=>{transportStarted=true;},owned:async(h,value)=>{const current=(await h.all('SELECT status,lease FROM material_ai_units WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0];if(current?.status!=='dispatched'||current.lease!==value)throw Error('conflict');},write:action=>this.write(target=>action(target.nativeHost()),()=>signal.throwIfAborted())});return true;
      }
      const c=await this.configuration(),apiKey=this.runtime.account?(await this.runtime.account()).apiKey:this.runtime.codec.open(c.sealedKey);
      const clean=await this.runtime.clean(unit.text);
      if(config.images&&clean!==unit.text)throw new Error('privacy_blocked');
      let image:Awaited<ReturnType<AiRuntime['image']>>|undefined;
      if(config.images){
        image=await this.storedImage(batchId,ordinal)||await this.runtime.image(config.resourceId,config.version,unit.page,signal);
        const bytes=Buffer.from(image.data,'base64');
        if(!['image/png','image/jpeg','image/webp'].includes(image.mime)||!bytes.length||bytes.length>4*1048576||bytes.toString('base64')!==image.data)throw Error('unit_too_large');
        const savedImage=image;
        await this.write(async target=>{
          await target.guard(batchId,config,unit,signal);
          const prior=await target.storedImage(batchId,ordinal);if(prior){if(prior.data!==savedImage.data||prior.mime!==savedImage.mime)throw Error('source_changed');return;}
          await target.host.run('INSERT INTO material_ai_image_inputs VALUES(?,?,?,?,?)',[batchId,ordinal,hash(bytes),savedImage.mime,savedImage.data]);
        },()=>signal.throwIfAborted());
      }
      const imageSha=image?hash(Buffer.from(image.data,'base64')):'';
      const complete=async(args:Parameters<AiCompletion>[0])=>{
        const beforeSend=async()=>{if(await this.runtime!.clean(unit.text)!==clean||args.previous&&await this.runtime!.clean(JSON.stringify(args.previous))!==JSON.stringify(args.previous))throw Error('privacy_blocked');await this.guard(batchId,config,unit,signal);};
        if(this.runtime!.complete){await beforeSend();transportStarted=true;return this.runtime!.complete(args,signal);}
        return completeMaterialAi({...args,beforeSend,onTransport:()=>{transportStarted=true;}},signal);
      };
      if(row.first_json&&row.image_sha!==imageSha)throw new Error('source_changed');
      let firstRaw=String(row.first_json),first:AiBatchResponse|undefined=firstRaw?parseAiBatchResponse(firstRaw):undefined;
      if(!first){
        await this.guard(batchId,config,unit,signal);
        lease=await this.dispatch(batchId,ordinal,config,unit,'pending',signal);
        firstRaw=await complete({model:config.model,apiKey,text:clean,image,imageCoverage:!!image&&process.env.OMNI_EDU_AI_IMAGE_TEXT!=='0'});
        first=parseAiBatchResponse(firstRaw);
        if(first.schemaVersion===MATERIAL_AI_IMAGE_RESPONSE&&!image)throw Error('invalid_response');
        await this.write(async target=>{
          await target.guard(batchId,config,unit,signal);await target.owned(batchId,ordinal,lease);
          await target.host.run("UPDATE material_ai_units SET status='first_saved',first_json=?,image_sha=?,owner_pid=0,lease='' WHERE batch_id=? AND ordinal=?",[firstRaw,imageSha,batchId,ordinal]);
        },()=>signal.throwIfAborted());lease='';
      }
      await this.guard(batchId,config,unit,signal);
      const cleanDraft=structuredClone(first);
      for(const question of cleanDraft.questions)for(const field of ['stem','answer','analysis','subject','grade','knowledgePoint','questionType'] as const)question[field]=await this.runtime.clean(question[field]);
      // Coverage text is also untrusted model output and must be redacted before the second dispatch.
      if(cleanDraft.schemaVersion===MATERIAL_AI_IMAGE_RESPONSE)for(const q of cleanDraft.questions)for(const part of Object.values(q.projection))part.text=await this.runtime.clean(part.text);
      const safeFirst=parseAiBatchResponse(JSON.stringify(cleanDraft));
      await this.guard(batchId,config,unit,signal);
      lease=await this.dispatch(batchId,ordinal,config,unit,'first_saved',signal);
      const finalRaw=await complete({model:config.model,apiKey,text:clean,image,imageCoverage:safeFirst.schemaVersion===MATERIAL_AI_IMAGE_RESPONSE,previous:safeFirst}),final=parseAiBatchResponse(finalRaw);
      if(final.schemaVersion===MATERIAL_AI_IMAGE_RESPONSE&&!image)throw Error('invalid_response');
      const sourceUnits=[];
      for(const source of unit.sources){const snapshot=await this.host.materials().readingWindow(config.resourceId,source.offset,1);sourceUnits.push(...snapshot.units);}
      const numbered=extractMaterialQuestions(sourceUnits,'local-text-v1');
      const omitted=numbered.some(candidate=>!final.questions.some(q=>q.number===candidate.archive.number));
      await this.write(async target=>{
        await target.guard(batchId,config,unit,signal);await target.owned(batchId,ordinal,lease);
        let review=omitted||final.outcome==='needs_review'||first!.outcome!==final.outcome;
        for(const q of final.questions){
          const issues=[...q.issues,...archiveMissing(q)],risks:string[]=[];
          if('projection'in q&&(!validQuestionProjection(q.projection,true)||q.projection.figures.state!=='not_applicable'))issues.push('incomplete_question');
          if(omitted)issues.push('ai_mismatch');
          if(q.requiresImage){issues.push('requires_image');risks.push('visual_unchecked');}
          if(unit.visualRisk&&!image){issues.push('visual_unchecked');if(!risks.includes('visual_unchecked'))risks.push('visual_unchecked');}
          const prior=first!.questions.find(p=>p.number===q.number);
          const normalized=(text:string)=>text.normalize('NFKC').replace(/\s/g,'');
          const independent=numbered.find(candidate=>candidate.archive.number===q.number);
          const visualText=!!image&&!!independent&&!independent.archive.sourceRisks.some(risk=>risk!=='visual_unchecked')&&!!imageTextEvidence(first!,final,q.number,imageSha,independent.fields.stem);
          if((first!.schemaVersion===MATERIAL_AI_IMAGE_RESPONSE||final.schemaVersion===MATERIAL_AI_IMAGE_RESPONSE)&&!visualText)issues.push('ai_mismatch');
          if(!visualText&&(!independent||normalizeMaterialStem(independent.fields.stem)!==normalizeMaterialStem(q.stem)||independent.archive.sourceRisks.some(risk=>risk!=='visual_unchecked')))issues.push('incomplete_question');
          if(!visualText&&!normalizeMaterialStem(unit.text).includes(normalizeMaterialStem(q.stem)))issues.push('uncertain_ocr');
          if(q.answerOrigin==='source'&&!normalized(unit.text).includes(normalized(q.answer)))issues.push('answer_conflict');
          if(q.analysisOrigin==='source'&&!normalized(unit.text).includes(normalized(q.analysis)))issues.push('answer_conflict');
          // Two passes are a consistency check, never independent mathematical verification.
          if(!prior||prior.stem!==q.stem||prior.answer!==q.answer||first!.questions.length!==final.questions.length||first!.outcome!==final.outcome)issues.push('ai_mismatch');
          if(final.outcome==='needs_review')issues.push('ai_review');
          if(/如图|下图|图中|见图|如下表|下表/.test(q.stem)&&!q.requiresImage){issues.push('requires_image');if(!risks.includes('visual_unchecked'))risks.push('visual_unchecked');}
          const unique=[...new Set(issues)];review||=!!unique.length;
          const archive:QuestionArchive={schemaVersion:QUESTION_AI_ARCHIVE_SCHEMA,extractor:'ai-two-pass.v1',state:unique.length?'ai_needs_review':'ai_final',number:q.number,sources:unit.sources,
            issues:unique,sourceRisks:risks,sourceChecked:false,answerOrigin:q.answerOrigin,analysisOrigin:q.analysisOrigin,
            ai:{batchId,ordinal,provider:config.model==='deepseek-flash'?'deepseek':'qwen',model:config.model,firstSha:hash(firstRaw),finalSha:hash(finalRaw),imageSha,policy:visualText?'image-text-complete.v1':'text-complete.v1'}};
          const {projection:_,...fields}=q as typeof q&{projection?:unknown};
          const saved=await target.host.create({...fields,sourceKind:'teacher_resource',sourceTitle:String(row.title),tags:['AI整理',...(visualText?['AI图文复核']:[]),...(q.answerOrigin==='ai_generated'?['AI推导答案']:[])]});
          await target.host.run('UPDATE question_bank_items SET archive_json=? WHERE id=?',[JSON.stringify(archive),saved.id]);
          await target.host.run('INSERT INTO material_ai_members(batch_id,ordinal,number,question_id) VALUES(?,?,?,?)',[batchId,ordinal,q.number,saved.id]);
        }
        await target.host.run("UPDATE material_ai_units SET status=?,final_json=?,error=?,owner_pid=0,lease='' WHERE batch_id=? AND ordinal=?",[review?'review':final.outcome==='no_questions'?'no_questions':'complete',finalRaw,omitted?'ai_omitted_questions':'',batchId,ordinal]);
        // Check after every awaited write, then again at the COMMIT boundary.
        await target.guard(batchId,config,unit,signal);
      },()=>signal.throwIfAborted());lease='';
    }catch(error){
      const code=signal.aborted?'cancelled':safeError(error);
      await this.write(async target=>{
        const current=(await target.host.all('SELECT status,lease FROM material_ai_units WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0];
        if(current?.status==='dispatched'&&current.lease===lease&&!transportStarted){
          const state=(await target.host.all('SELECT first_json FROM material_ai_units WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0];
          await target.host.run("UPDATE material_ai_units SET status=?,error=?,owner_pid=0,lease='' WHERE batch_id=? AND ordinal=?",[['cancelled','paused'].includes(code)?state?.first_json?'first_saved':'pending':'failed',code,batchId,ordinal]);
          await target.host.run('UPDATE material_ai_batches SET calls=MAX(0,calls-1) WHERE id=?',[batchId]);
        }else if(current?.status==='dispatched'&&current.lease===lease){await target.host.run("UPDATE material_ai_units SET status='outcome_unknown',error=?,owner_pid=0,lease='' WHERE batch_id=? AND ordinal=?",[code,batchId,ordinal]);}
        else if(!lease&&!signal.aborted&&code!=='paused'&&['pending','first_saved'].includes(String(current?.status)))await target.host.run("UPDATE material_ai_units SET status='failed',error=? WHERE batch_id=? AND ordinal=?",[code,batchId,ordinal]);
      });
    }finally{if(this.active?.controller===controller)this.active=undefined;}
    return true;
  }
  private async owned(batchId:string,ordinal:number,lease:string){const row=(await this.host.all('SELECT status,lease FROM material_ai_units WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0];if(row?.status!=='dispatched'||row.lease!==lease)throw new Error('conflict');}
}
