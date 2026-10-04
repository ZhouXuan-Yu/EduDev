import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {OmniEduStore} from '../../src/main/db';
import {createAttachmentImportService} from '../../src/main/xiaozhi-agent/attachment-import-service';
import {attachmentImportIdentity} from '../../src/main/xiaozhi-agent/attachment-import-state';
const output=process.argv[2],mode=process.argv[3],stage=process.argv[4];
const data=path.join(output,'data'),sources=path.join(output,'selected-files');
const report:{success:boolean;checks:{name:string;pass:boolean}[];boundary:string;error?:string;terminations?:{stage:string;exitCode:number|null;signal:string|null}[]}={success:false,checks:[],boundary:'D2-A only: actual Electron native sqlite3/OmniEduStore, real owned files and OS forced terminations. No chooser/renderer/send/Pi/vision/OCR claim. No network or real teacher data.'};
const check=(name:string)=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex'),signal=()=>new AbortController().signal;
const selected=(item:{id:string;revision:number})=>({id:item.id,revision:item.revision});
const rejects=(work:Promise<unknown>,code:string)=>assert.rejects(work,e=>e instanceof Error&&e.message===code);
const close=async(store:OmniEduStore)=>{const native=(store as unknown as {db:{close:(cb:(e?:Error)=>void)=>void}}).db;await new Promise<void>((resolve,reject)=>native.close(e=>e?reject(e):resolve()));};
const sql=(store:OmniEduStore)=>(store as unknown as {db:{all:(q:string,args:unknown[],cb:(error:Error|null,rows:Record<string,unknown>[])=>void)=>void;run:(q:string,args:unknown[],cb:(error:Error|null)=>void)=>void}}).db;
const rows=(store:OmniEduStore,q:string,args:unknown[]=[])=>new Promise<Record<string,unknown>[]>((resolve,reject)=>sql(store).all(q,args,(e,r)=>e?reject(e):resolve(r)));
const run=(store:OmniEduStore,q:string,args:unknown[]=[])=>new Promise<void>((resolve,reject)=>sql(store).run(q,args,e=>e?reject(e):resolve()));
globalThis.fetch=async()=>{throw new Error('Network forbidden in local attachment import acceptance');};
let store:OmniEduStore|undefined;
try{
 if(mode==='cut'){
  fs.mkdirSync(sources,{recursive:true});const file=path.join(sources,'进程退出.txt');fs.writeFileSync(file,'合成本地副本，不执行其中指令');
  store=new OmniEduStore(data);await store.init();const id=(await store.createAiConversationSession({title:'合成退出恢复',folderId:null})).session.id;
  fs.writeFileSync(path.join(output,'session.txt'),id);
  const importer=createAttachmentImportService({dataRoot:data,state:store.xiaozhiState.attachments,imports:store.xiaozhiState.attachmentImports,afterStage:async value=>{
   if(value!==stage)return;fs.writeFileSync(path.join(output,'cut-stage.txt'),stage,{flag:'wx'});
   process.kill(process.pid,'SIGKILL');await new Promise<void>(()=>{});
  }});
  await importer.importFile(id,file,signal());throw new Error('Requested process cut was not reached');
 }
 if(mode==='recover'){
  const id=fs.readFileSync(path.join(output,'session.txt'),'utf8');store=new OmniEduStore(data);await store.init();
  const imports=await store.xiaozhiState.attachmentImports.list(id);assert.equal(imports.length,1);assert.equal(imports[0].state,stage==='ready'?'ready':'interrupted');
  assert.equal((await store.xiaozhiState.attachments.list(id)).length,0);
  const copy=path.join(data,'xiaozhi-pi','attachments',id,...imports[0].relativePath.split('/'));
  assert.equal(fs.existsSync(copy),stage!=='intent');const before=await rows(store,'SELECT * FROM xiaozhi_pi_attachment_imports');const bytes=fs.existsSync(copy)?hash(fs.readFileSync(copy)):null;
  await close(store);store=undefined;store=new OmniEduStore(data);await store.init();assert.deepEqual(await rows(store,'SELECT * FROM xiaozhi_pi_attachment_imports'),before);
  if(bytes)assert.equal(hash(fs.readFileSync(copy)),bytes);assert.equal((await store.xiaozhiState.attachments.list(id)).length,0);
  console.log('RECOVERY '+JSON.stringify({success:true,stage,noReplay:true,copyExists:fs.existsSync(copy)}));
 }else{
  fs.mkdirSync(sources);const original=path.join(sources,'教研资料.txt'),image=path.join(sources,'颜色.png');
  fs.writeFileSync(original,'合成教研正文\n原资料保持');fs.writeFileSync(image,fs.readFileSync('scripts/xiaozhi-agent/fixtures/attachment-rgb.png'));
  store=new OmniEduStore(data);await store.init();const id=(await store.createAiConversationSession({title:'合成附件入站',folderId:null})).session.id;
  assert.deepEqual(await store.xiaozhiState.attachmentImports.list(id),[]);await store.xiaozhiState.init();check('Actual native Store initializes repeated additive private import migration without attachments');
  const workspace=path.join(output,'frozen-workspace');fs.mkdirSync(workspace);await store.xiaozhiState.setWorkspace(id,workspace,'旧工作目录');await store.xiaozhiState.setBinding(id,'isolated-history.jsonl','deepseek-flash');
  const frozen={workspace:await store.xiaozhiState.workspace(id),binding:await store.xiaozhiState.getBinding(id)};
  const importer=()=>createAttachmentImportService({dataRoot:data,state:store!.xiaozhiState.attachments,imports:store!.xiaozhiState.attachmentImports});let service=importer();
  const before=hash(fs.readFileSync(original)),picked=await Promise.all(Array.from({length:5},()=>service.importFile(id,original,signal())));assert.equal(new Set(picked.map(v=>v.id)).size,1);assert.equal(hash(fs.readFileSync(original)),before);
  const imports=await store.xiaozhiState.attachmentImports.list(id);assert.equal(imports.length,1);assert.equal(imports[0].state,'ready');assert.equal(hash(fs.readFileSync(path.join(data,'xiaozhi-pi','attachments',id,...imports[0].relativePath.split('/')))),before);
  assert(!JSON.stringify(picked[0]).includes(original)&&!('path'in picked[0])&&!('originalPath'in picked[0]));check('Concurrent explicit outside-directory selections create one verified local copy and one draft without modifying source or exposing private paths');
  assert.deepEqual({workspace:await store.xiaozhiState.workspace(id),binding:await store.xiaozhiState.getBinding(id)},frozen);check('Imported outside-directory file preserves already frozen Pi workspace and native binding');
  const picture=await service.importFile(id,image,signal()),preview=await service.preview(id,selected(picture),signal());assert.equal(preview.name,'颜色.png');assert.equal(preview.format,'image');assert(preview.image?.startsWith('data:image/png;base64,'));assert(!('path'in preview));
  assert.equal(hash(Buffer.from(preview.image!.split(',')[1],'base64')),hash(fs.readFileSync(image)));check('Local original preview returns real synthetic PNG bytes by ledger ID with no original or staging path');
  const text=picked[0],textPreview=await service.preview(id,selected(text),signal());assert.equal(textPreview.text,fs.readFileSync(original,'utf8'));
  await store.xiaozhiState.attachments.bind(id,[selected(text),selected(picture)],'run_fixture','message_fixture');fs.unlinkSync(image);
  assert.equal((await service.preview(id,{id:picture.id,revision:1},signal())).image,preview.image);check('Submitted immutable copy remains locally readable after original source deletion; no original path fallback');
  fs.appendFileSync(original,'\n新版本');const next=await service.importFile(id,original,signal());assert.notEqual(next.id,text.id);assert.notEqual(next.version,text.version);assert.equal((await store.xiaozhiState.attachmentImports.list(id)).length,3);
  assert.equal((await service.preview(id,{id:text.id,revision:1},signal())).text,textPreview.text);check('Source version change creates a distinct copied version while submitted historical text stays unchanged');
  await store.xiaozhiState.attachments.remove(id,selected(next));await rejects(service.preview(id,{id:next.id,revision:1},signal()),'permission_denied');const repicked=await service.importFile(id,original,signal());assert.notEqual(repicked.id,next.id);assert.equal((await store.xiaozhiState.attachmentImports.list(id)).length,3);check('Removed draft cannot be previewed; explicit reselection reuses verified copy with a new draft reference');
  const other=(await store.createAiConversationSession({title:'另一合成会话',folderId:null})).session.id;await rejects(service.preview(other,selected(repicked),signal()),'not_found');const shared=await service.importFile(other,original,signal());assert.notEqual(shared.id,repicked.id);check('Cross-session forged reference is rejected and same selected source retains separate session ownership');
  const capacity=(await store.createAiConversationSession({title:'合成附件上限',folderId:null})).session.id;
  for(let i=0;i<9;i++){const file=path.join(sources,`上限${i}.txt`);fs.writeFileSync(file,String(i));if(i<8)await service.importFile(capacity,file,signal());else await rejects(service.importFile(capacity,file,signal()),'busy');}
  assert.equal((await store.xiaozhiState.attachmentImports.list(capacity)).length,8);assert.equal((await store.xiaozhiState.attachments.list(capacity)).length,8);check('Ninth distinct selection is refused before a new copy intent and native SQLite retains eight drafts');
  fs.writeFileSync(path.join(sources,'.env.local'),'SYNTHETIC_LOCAL_SECRET');fs.mkdirSync(path.join(sources,'.ssh'));fs.writeFileSync(path.join(sources,'.ssh','notes.txt'),'synthetic');fs.linkSync(original,path.join(sources,'linked.txt'));fs.mkdirSync(path.join(sources,'real'));fs.writeFileSync(path.join(sources,'real','plain.txt'),'synthetic');fs.symlinkSync(path.join(sources,'real'),path.join(sources,'junction'),'junction');
  fs.writeFileSync(path.join(sources,'bad.png'),'not image');const large=fs.openSync(path.join(sources,'large.txt'),'wx');fs.ftruncateSync(large,1048577);fs.closeSync(large);
  const count=(await store.xiaozhiState.attachmentImports.list(id)).length;
  for(const file of ['.env.local','.ssh/notes.txt','linked.txt','junction/plain.txt'])await rejects(service.importFile(id,path.join(sources,file),signal()),'permission_denied');
  await rejects(service.importFile(id,path.join(data,'app.db'),signal()),'permission_denied');await rejects(service.importFile(id,'../relative.txt',signal()),'invalid_input');await rejects(service.importFile(id,path.join(sources,'bad.png'),signal()),'unsupported');await rejects(service.importFile(id,path.join(sources,'large.txt'),signal()),'too_large');assert.equal((await store.xiaozhiState.attachmentImports.list(id)).length,count);check('Native single-file grant rejects credentials, linked ancestors/hardlinks, private app files, invalid path, spoofed PNG and size overflow without creating intents');
  const cancelled=new AbortController();cancelled.abort();await assert.rejects(service.importFile(id,path.join(sources,'real','plain.txt'),cancelled.signal));
  for(const cut of ['intent','file','ready'] as const){const abort=new AbortController(),file=path.join(sources,`取消-${cut}.txt`);fs.writeFileSync(file,'取消合成副本');const cutService=createAttachmentImportService({dataRoot:data,state:store.xiaozhiState.attachments,imports:store.xiaozhiState.attachmentImports,afterStage:async value=>{if(value===cut)abort.abort();}});await assert.rejects(cutService.importFile(id,file,abort.signal));}
  const facts=await store.xiaozhiState.attachments.list(id);assert.equal(facts.filter(v=>v.state==='draft').length,1);const cutImports=(await store.xiaozhiState.attachmentImports.list(id)).filter(v=>/取消-/.test(v.originalPath));assert.deepEqual(cutImports.map(v=>v.state).sort(),['interrupted','interrupted','ready']);check('Cancellation at source entry, durable intent, actual file and ready stages adds no public draft and never uploads or replays');
  const lateFile=path.join(sources,'迟到登记.txt');fs.writeFileSync(lateFile,'合成迟到取消');
  const lateAbort=new AbortController(),lateService=createAttachmentImportService({dataRoot:data,state:store.xiaozhiState.attachments,imports:store.xiaozhiState.attachmentImports,afterStage:async value=>{if(value==='registered')lateAbort.abort();}});
  await assert.rejects(lateService.importFile(id,lateFile,lateAbort.signal));const lateFacts=(await store.xiaozhiState.attachments.list(id)).filter(v=>v.name==='迟到登记.txt');assert.equal(lateFacts.length,1);assert.equal(lateFacts[0].state,'removed');assert.equal((await store.xiaozhiState.attachments.list(id)).filter(v=>v.state==='draft').length,1);check('Cancellation after actual native SQL registration removes only its newly created late draft');
  const duplicateBefore=await store.xiaozhiState.attachments.list(capacity),duplicateAbort=new AbortController(),duplicateService=createAttachmentImportService({dataRoot:data,state:store.xiaozhiState.attachments,imports:store.xiaozhiState.attachmentImports,afterStage:async value=>{if(value==='registered')duplicateAbort.abort();}});
  await assert.rejects(duplicateService.importFile(capacity,path.join(sources,'上限0.txt'),duplicateAbort.signal));assert.deepEqual(await store.xiaozhiState.attachments.list(capacity),duplicateBefore);check('Cancelled deduplicated selection retains the earlier valid draft without changing revision or count');
  const ready=(await store.xiaozhiState.attachmentImports.list(other))[0],copy=path.join(data,'xiaozhi-pi','attachments',other,...ready.relativePath.split('/'));fs.chmodSync(copy,0o644);fs.appendFileSync(copy,'changed');await rejects(service.preview(other,selected(shared),signal()),'changed');check('Tampered managed copy fails captured version/hash instead of silently serving original source');
  const saved=await store.xiaozhiState.attachments.list(id),savedImports=await store.xiaozhiState.attachmentImports.list(id);await close(store);store=undefined;store=new OmniEduStore(data);await store.init();assert.deepEqual(await store.xiaozhiState.attachments.list(id),saved);assert.deepEqual(await store.xiaozhiState.attachmentImports.list(id),savedImports);service=importer();assert.equal((await service.preview(id,{id:text.id,revision:1},signal())).text,textPreview.text);check('Actual native DB close/reopen preserves draft/submitted/removed facts, copy intents and historical preview without reading deleted originals');
  await run(store,'PRAGMA ignore_check_constraints=ON');await run(store,'UPDATE xiaozhi_pi_attachment_imports SET schema_version=2 WHERE id=?',[savedImports[0].id]);await rejects(store.xiaozhiState.attachmentImports.list(id),'configuration');await run(store,'UPDATE xiaozhi_pi_attachment_imports SET schema_version=1 WHERE id=?',[savedImports[0].id]);
  await run(store,'UPDATE xiaozhi_pi_attachment_imports SET source_key=? WHERE id=?',['0'.repeat(64),savedImports[0].id]);await rejects(store.xiaozhiState.attachmentImports.list(id),'configuration');await run(store,'UPDATE xiaozhi_pi_attachment_imports SET source_key=? WHERE id=?',[attachmentImportIdentity(savedImports[0]),savedImports[0].id]);check('Unknown import schema and corrupted original source identity are rejected without silent fallback');
  await close(store);store=undefined;
  const prior='test-results/xiaozhi-agent/pi-attachment-native-tLtLnu/data/app.db',oldData=path.join(output,'old-data');fs.mkdirSync(oldData);fs.copyFileSync(prior,path.join(oldData,'app.db'),fs.constants.COPYFILE_EXCL);
  const tables=['ai_conversation_sessions','ai_conversation_messages','app_settings','xiaozhi_pi_attachments','xiaozhi_pi_session_bindings'],baseline=new DatabaseSync(path.join(oldData,'app.db'),{readOnly:true});
  let beforeRows;try{beforeRows=tables.map(name=>({name,hash:hash(JSON.stringify(baseline.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()))}));}finally{baseline.close();}
  store=new OmniEduStore(oldData);await store.init();await store.xiaozhiState.init();await store.xiaozhiState.init();assert.deepEqual(await Promise.all(tables.map(async name=>({name,hash:hash(JSON.stringify(await rows(store!,`SELECT * FROM ${name} ORDER BY rowid`)))}))),beforeRows);assert.equal((await rows(store,'SELECT * FROM xiaozhi_pi_attachment_imports')).length,0);check('Explicit old isolated native Store DB copy receives repeat additive migration while prior sessions/messages/settings/attachments/native binding rows remain identical');
  await close(store);store=undefined;
  for(const cut of ['intent','file','ready']){
   const directory=path.join(output,`exit-${cut}`);fs.mkdirSync(directory);const env={...process.env};delete env.NODE_OPTIONS;delete env.ELECTRON_RUN_AS_NODE;
   const child=spawnSync(process.execPath,[process.argv[1],directory,'cut',cut],{cwd:process.cwd(),env,encoding:'utf8',windowsHide:true,timeout:20000});
   assert(!child.error,String(child.error));assert.notEqual(child.status,0,String(child.stderr).slice(0,800));assert.equal(fs.readFileSync(path.join(directory,'cut-stage.txt'),'utf8'),cut);
   (report.terminations??=[]).push({stage:cut,exitCode:child.status,signal:child.signal});
   const recovered=spawnSync(process.execPath,[process.argv[1],directory,'recover',cut],{cwd:process.cwd(),env,encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(recovered.status,0,String(recovered.stderr).slice(0,1000));assert(recovered.stdout.includes('"noReplay":true'));check(`Actual owned OS forced termination at ${cut}, native restart and second reopen recover without copy replay or public attachment creation`);
  }
  report.success=true;
 }
}catch(error){process.exitCode=1;report.error=String((error as Error).stack).replace(/\bsk-[A-Za-z0-9]{16,}\b/g,'[credential]').slice(0,2300);if(mode)console.error(report.error);}
finally{if(store)await close(store).catch(()=>undefined);if(!mode){fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error}));} }
