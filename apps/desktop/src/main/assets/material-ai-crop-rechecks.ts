import {createHash,randomUUID} from 'node:crypto';
import type {AiLocalOcrView} from '../../shared/material-ai';
import {MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT} from '../../shared/material-ai-page-fragments';
import {readAiPageReceipt} from './material-ai-page-evidence';
import {followingPageStatus} from './material-ai-page-source';
import {readPageFragments,preparePageFragments,pageCropStorage} from './material-ai-page-fragments';
import {planAiPageQuestion,assessAiPage,type AiPagePublishArgs} from './material-ai-page-publish';
import {cropRowHash,failedCrop,recheckedCropRows} from './material-ai-crop-recheck-storage';
import type {PageCropRenderer,PageCrop} from './material-ai-page-crops';
import type {CropInspector} from './material-ai-crop-quality';

type Row=Record<string,unknown>;
type Proof=Awaited<ReturnType<typeof readAiPageReceipt>>;
type Host={root?:()=>string;all:(sql:string,p?:(string|number|null)[])=>Promise<Row[]>;run:(sql:string,p?:(string|number|null)[])=>Promise<void>;
 proof:(batch:string,ordinal:number)=>Promise<Proof>;runtime:()=>{crop?:PageCropRenderer;inspectCrop?:CropInspector}|undefined;
 writer:<T>(action:(target:MaterialCropRechecks)=>Promise<T>,before?:()=>void)=>Promise<T>};
type Target={number:string;questionId:string;questionSha:string;baseSha:string};
type Snapshot={schemaVersion:'xiaozhi.material-ai-crop-recheck.v1';proofSha:string;targets:Target[]};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const proofHash=(proof:Proof)=>hash([proof.unit,proof.config,proof.firstSha,proof.finalSha,proof.imageSha]);
const errorCode=(e:unknown)=>e instanceof Error&&['source_changed','conflict','cancelled','paused','busy','unit_too_large','ocr_failed','unsupported','source_incomplete','unavailable','configuration'].includes(e.message)?e.message:'unavailable';
const fields={stem:'stem',answer:'answer',analysis:'analysis',subject:'subject',grade:'grade',knowledgePoint:'knowledge_point',questionType:'question_type',difficulty:'difficulty'} as const;

/** Local tasks are consumed by MaterialAiRepository.drain, never by a second model/executor. */
export class MaterialCropRechecks{
 constructor(private host:Host){}
 private async rows(batch:string,ordinal:number){return this.host.all('SELECT * FROM material_ai_page_crops WHERE batch_id=? AND ordinal=?',[batch,ordinal]);}
 private async questions(batch:string,ordinal:number){return this.host.all('SELECT q.*,m.number recheck_number FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id WHERE m.batch_id=? AND m.ordinal=? ORDER BY m.number',[batch,ordinal]);}
 private questionHash(row:Row){const {recheck_number:_,...q}=row;return hash(q);}
 private async args(batchId:string,ordinal:number,proof:Proof,crops:PageCrop[]):Promise<AiPagePublishArgs>{
  const source=proof.unit.pageSource!;
  const following=await followingPageStatus(this.host,source,proof.unit.pagePrompt&&'totalPages'in proof.unit.pagePrompt?proof.unit.pagePrompt.totalPages:source.page);
  return{batchId,ordinal,source,sources:proof.unit.sources,originalQuestions:[],firstRaw:JSON.stringify(proof.first),finalRaw:JSON.stringify(proof.final),first:proof.first,final:proof.final,imageSha:proof.imageSha,title:'',model:proof.config.model,pagePrompt:proof.unit.pagePrompt,crops,following};
 }
 private async planArgs(batch:string,ordinal:number,proof:Proof,crops:PageCrop[]){
  const args=await this.args(batch,ordinal,proof,crops);
  // Hash the exact persisted strings, including their original whitespace.
  const row=(await this.host.all('SELECT first_json,final_json FROM material_ai_units WHERE batch_id=? AND ordinal=?',[batch,ordinal]))[0];
  if(!row||typeof row.first_json!=='string'||typeof row.final_json!=='string')throw Error('source_changed');
  return{...args,firstRaw:row.first_json,finalRaw:row.final_json};
 }
 async view(batchId:string):Promise<AiLocalOcrView>{
  const rows=await this.host.all('SELECT c.* FROM material_ai_page_crops c JOIN material_ai_units u ON u.batch_id=c.batch_id AND u.ordinal=c.ordinal WHERE c.batch_id=? AND u.status IN (\'complete\',\'review\') AND c.image_json LIKE \'{"schemaVersion":"xiaozhi.material-ai-fragment-crops.failed.v1",%\'',[batchId]);
  let remaining=0;for(const ordinal of new Set(rows.map(r=>Number(r.ordinal))))remaining+=(await recheckedCropRows(this.host,batchId,ordinal,rows.filter(r=>Number(r.ordinal)===ordinal))).filter(failedCrop).length;
  const counts=(await this.host.all("SELECT SUM(status='pending') pending,SUM(status='running') running FROM material_ai_crop_rechecks WHERE batch_id=?",[batchId]))[0];
  const latest=(await this.host.all('SELECT status,error FROM material_ai_crop_rechecks WHERE batch_id=? ORDER BY rowid DESC LIMIT 1',[batchId]))[0];
  return{remaining,pending:Number(counts?.pending||0),running:Number(counts?.running||0),status:String(latest?.status||'idle'),error:String(latest?.error||'')};
 }
 async schedule(batchId:string){
  const units=await this.host.all("SELECT DISTINCT u.ordinal FROM material_ai_units u JOIN material_ai_page_crops c ON c.batch_id=u.batch_id AND c.ordinal=u.ordinal WHERE u.batch_id=? AND u.status IN ('complete','review') AND c.image_json LIKE '{\"schemaVersion\":\"xiaozhi.material-ai-fragment-crops.failed.v1\",%' ORDER BY u.ordinal",[batchId]);let scheduled=0;
  for(const unit of units){const ordinal=Number(unit.ordinal),base=await this.rows(batchId,ordinal),effective=await recheckedCropRows(this.host,batchId,ordinal,base),failed=effective.filter(failedCrop);if(!failed.length)continue;
   const proof=await this.host.proof(batchId,ordinal);if(proof.unit.pagePrompt?.policy!==MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT)continue;
   const crops=await readPageFragments(this.host,batchId,ordinal,proof.unit.pageSource!,proof.first,(await this.planArgs(batchId,ordinal,proof,[])).firstRaw,proof.imageSha,new AbortController().signal,undefined,proof.unit.pagePrompt,true);
   const questions=await this.questions(batchId,ordinal),args=await this.planArgs(batchId,ordinal,proof,crops),targets:Target[]=[];
   for(const row of failed){const number=String(row.number),q=questions.find(q=>q.recheck_number===number),original=proof.final.questions.find(q=>q.number===number);if(!q||!original)throw Error('source_changed');
    const before=planAiPageQuestion(args,original);
    if(q.archive_json!==JSON.stringify(before.archive)||(q.document_json||'')!==(before.document?JSON.stringify(before.document):'')||Object.entries(fields).some(([k,column])=>q[column]!==original[k as keyof typeof original]))throw Error('conflict');
    targets.push({number,questionId:String(q.id),questionSha:this.questionHash(q),baseSha:cropRowHash(row)});
   }
   const snapshot:Snapshot={schemaVersion:'xiaozhi.material-ai-crop-recheck.v1',proofSha:proofHash(proof),targets};
   const active=(await this.host.all("SELECT id,status,snapshot_json FROM material_ai_crop_rechecks WHERE batch_id=? AND ordinal=? AND status IN ('pending','running','paused')",[batchId,ordinal]))[0];
   if(active){
    if(active.snapshot_json!==JSON.stringify(snapshot)){
     if(active.status!=='paused')throw Error('conflict');
     await this.host.run("UPDATE material_ai_crop_rechecks SET status='interrupted',error='conflict',owner_pid=0,lease='' WHERE id=? AND status='paused'",[String(active.id)]);
    }else{if(active.status==='paused')await this.host.run("UPDATE material_ai_crop_rechecks SET status='pending',error='' WHERE id=? AND status='paused'",[String(active.id)]);scheduled++;continue;}
   }
   await this.host.run('INSERT INTO material_ai_crop_rechecks(id,batch_id,ordinal,status,snapshot_json,created_at) VALUES(?,?,?,?,?,?)',['cropcheck_'+randomUUID(),batchId,ordinal,'pending',JSON.stringify(snapshot),new Date().toISOString()]);scheduled++;
  }
  if(!scheduled)throw Error('unsupported');
 }
 async pause(batch:string){await this.host.run("UPDATE material_ai_crop_rechecks SET status='paused',error='cancelled',owner_pid=0,lease='' WHERE batch_id=? AND status IN ('pending','running')",[batch]);}
 async recoverStartup(){await this.host.run("UPDATE material_ai_crop_rechecks SET status=CASE WHEN status='running' THEN 'interrupted' ELSE 'paused' END,error='cancelled',owner_pid=0,lease='' WHERE status IN ('pending','running')");}
 async next(){return(await this.host.all("SELECT id,batch_id,ordinal,snapshot_json FROM material_ai_crop_rechecks WHERE status='pending' ORDER BY created_at,id LIMIT 1"))[0];}
 private async guard(job:Row,lease:string,snapshot:Snapshot,signal:AbortSignal){
  signal.throwIfAborted();const row=(await this.host.all('SELECT status,lease FROM material_ai_crop_rechecks WHERE id=?',[String(job.id)]))[0];if(row?.status!=='running'||row.lease!==lease)throw Error('paused');
  const proof=await this.host.proof(String(job.batch_id),Number(job.ordinal));if(proofHash(proof)!==snapshot.proofSha)throw Error('source_changed');
  const base=await this.rows(String(job.batch_id),Number(job.ordinal)),questions=await this.questions(String(job.batch_id),Number(job.ordinal));
  for(const target of snapshot.targets){const q=questions.find(q=>q.id===target.questionId),row=base.find(r=>r.number===target.number);if(!q||this.questionHash(q)!==target.questionSha)throw Error('conflict');if(!row||cropRowHash(row)!==target.baseSha)throw Error('source_changed');}
  signal.throwIfAborted();return{proof,base,questions};
 }
 async execute(job:Row,signal:AbortSignal){
  const lease=randomUUID(),batch=String(job.batch_id),ordinal=Number(job.ordinal);let snapshot:Snapshot;
  try{
   if(typeof job.snapshot_json!=='string'||Buffer.byteLength(job.snapshot_json)>8192)throw Error('source_changed');snapshot=JSON.parse(job.snapshot_json);if(snapshot.schemaVersion!=='xiaozhi.material-ai-crop-recheck.v1'||!Array.isArray(snapshot.targets)||!snapshot.targets.length||snapshot.targets.length>20)throw Error('source_changed');
   await this.host.writer(async target=>{signal.throwIfAborted();const row=(await target.host.all('SELECT status,snapshot_json FROM material_ai_crop_rechecks WHERE id=?',[String(job.id)]))[0];if(row?.status!=='pending'||row.snapshot_json!==job.snapshot_json)throw Error('conflict');await target.host.run("UPDATE material_ai_crop_rechecks SET status='running',owner_pid=?,lease=? WHERE id=?",[process.pid,lease,String(job.id)]);},()=>signal.throwIfAborted());
   const runtime=this.host.runtime();if(!runtime?.crop||!runtime.inspectCrop||!this.host.root)throw Error('unsupported');
   const initial=await this.guard(job,lease,snapshot,signal),source=initial.proof.unit.pageSource!,prompt=initial.proof.unit.pagePrompt;
   if(prompt?.policy!==MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT)throw Error('unsupported');
   const args=await this.planArgs(batch,ordinal,initial.proof,[]),crops=await readPageFragments(this.host,batch,ordinal,source,initial.proof.first,args.firstRaw,initial.proof.imageSha,signal,undefined,prompt);
   const successful:PageCrop[]=[];
   for(const target of snapshot.targets){await this.guard(job,lease,snapshot,signal);
    const first={...initial.proof.first,questions:initial.proof.first.questions.filter(q=>q.number===target.number),...('fragments'in initial.proof.first?{fragments:initial.proof.first.fragments.filter(f=>f.number===target.number)}:{})};
    const freshHost={...this.host,all:(sql:string,p?:(string|number|null)[])=>sql.startsWith('SELECT number FROM material_ai_page_crops')?Promise.resolve([]):this.host.all(sql,p)};
    const fresh=await preparePageFragments(freshHost,batch,ordinal,source,first,args.firstRaw,initial.proof.imageSha,runtime.crop,runtime.inspectCrop,signal,prompt);
    if(fresh.length!==1||fresh[0].number!==target.number)throw Error('source_changed');if(!fresh[0].failure)successful.push(fresh[0]);
   }
   await this.host.writer(async target=>{
    const current=await target.guard(job,lease,snapshot,signal),updated=crops.map(c=>successful.find(f=>f.number===c.number)||c),plans=await target.planArgs(batch,ordinal,current.proof,updated);
    for(const crop of successful){const saved=current.questions.find(q=>q.recheck_number===crop.number)!,original=current.proof.final.questions.find(q=>q.number===crop.number)!,plan=planAiPageQuestion(plans,original),stored=pageCropStorage(crop);
     const after={archive_json:JSON.stringify(plan.archive),document_json:plan.document?JSON.stringify(plan.document):''};
     await target.host.run('INSERT INTO material_ai_crop_recheck_results(check_id,batch_id,ordinal,number,base_sha,first_sha,page_image_sha,source_json,image_json,quality_json,before_json,after_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[String(job.id),batch,ordinal,crop.number,snapshot.targets.find(t=>t.number===crop.number)!.baseSha,current.proof.firstSha,current.proof.imageSha,JSON.stringify(source),stored.image,stored.quality,JSON.stringify({questionId:saved.id,archive_json:saved.archive_json,document_json:saved.document_json}),JSON.stringify(after)]);
     await target.host.run('UPDATE question_bank_items SET archive_json=?,document_json=? WHERE id=?',[after.archive_json,after.document_json,String(saved.id)]);
    }
    if(successful.length){
     const members=await target.questions(batch,ordinal),review=assessAiPage(current.proof.first,current.proof.final,source,false,prompt,updated).review||members.some(q=>JSON.parse(String(q.archive_json)).issues.length>0);
     await target.host.run('UPDATE material_ai_units SET status=?,error=? WHERE batch_id=? AND ordinal=?',[review?'review':'complete',review?'page_content_incomplete':'',batch,ordinal]);
    }
    const status=successful.length===snapshot.targets.length?'complete':successful.length?'partial':'failed';
    await target.host.run("UPDATE material_ai_crop_rechecks SET status=?,error=?,owner_pid=0,lease='' WHERE id=?",[status,status==='complete'?'':'ocr_failed',String(job.id)]);
    // All original image and coverage gates still apply after committing an overlay.
    if(successful.length){await readPageFragments(target.host,batch,ordinal,source,current.proof.first,plans.firstRaw,current.proof.imageSha,signal,undefined,prompt);if(proofHash(await target.host.proof(batch,ordinal))!==snapshot.proofSha)throw Error('source_changed');}
   },()=>signal.throwIfAborted());
  }catch(error){await this.host.writer(async target=>{const row=(await target.host.all('SELECT status,lease FROM material_ai_crop_rechecks WHERE id=?',[String(job.id)]))[0];if(row?.status==='running'&&row.lease===lease)await target.host.run("UPDATE material_ai_crop_rechecks SET status=?,error=?,owner_pid=0,lease='' WHERE id=?",[signal.aborted?'interrupted':'failed',signal.aborted?'cancelled':errorCode(error),String(job.id)]);});}
 }
}
