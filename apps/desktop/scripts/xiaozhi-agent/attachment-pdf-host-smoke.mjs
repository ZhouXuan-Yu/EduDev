import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {registerHooks} from 'node:module';
import {EventEmitter} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

// Only the AnyDoc Electron utility transport is doubled to force unavailable.
// The PDF host, compiled manifest verification, actual local exe, filesystem,
// SQLite attachment/import states, tool guards and excerpt delivery are real.
let anyDocCalls=0;
globalThis.attachmentPdfHostMetadata=[];
globalThis.attachmentPdfUtility={fork(){
 const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();let exited=false;
 child.kill=()=>{if(!exited){exited=true;queueMicrotask(()=>child.emit('exit',0));}return true;};
 child.postMessage=request=>{anyDocCalls++;queueMicrotask(()=>child.emit('message',{ok:false,schemaVersion:request.schemaVersion,requestId:request.requestId,error:'unavailable'}));};
 return child;
}};
registerHooks({
 resolve(specifier,context,next){
  if(specifier==='electron')return {url:'data:text/javascript,export const app={isPackaged:false};export const utilityProcess=globalThis.attachmentPdfUtility;',shortCircuit:true};
  if(specifier==='./pdf-file-host'&&context.parentURL?.endsWith('/attachment-pdf-text.ts')){
   const actual=pathToFileURL(path.resolve('src/main/xiaozhi-agent/pdf-file-host.ts')).href;
   const source=`import {parsePdfFile as real} from ${JSON.stringify(actual)};export const parsePdfFile=(input,skip,signal,receive)=>real(input,skip,signal,async(event,executionSignal)=>{globalThis.attachmentPdfHostMetadata.push({kind:event.kind,page:event.page,status:event.kind==='page'?event.result.status:undefined,method:event.kind==='page'?event.result.method:undefined,error:event.kind==='page'?event.result.error:undefined});return receive(event,executionSignal);});`;
   return {url:'data:text/javascript,'+encodeURIComponent(source),shortCircuit:true};
  }
  return next(specifier,context);
 },
 load(url,context,next){
  if(url.endsWith('/ocr-runtime-manifest.json'))return {format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8'),shortCircuit:true};
  return next(url,context);
 },
});
globalThis.fetch=async()=>{throw Error('network forbidden in attachment PDF host acceptance');};
const {createAttachmentState}=await import('../../src/main/xiaozhi-agent/attachment-state.ts');
const {createAttachmentImportState}=await import('../../src/main/xiaozhi-agent/attachment-import-state.ts');
const {createAttachmentImportService}=await import('../../src/main/xiaozhi-agent/attachment-import-service.ts');
const {createAttachmentReadTools}=await import('../../src/main/xiaozhi-agent/attachment-read-tools.ts');
const {sanitizeOfficeDocumentText}=await import('../../src/main/xiaozhi-agent/office-document-tools.ts');
const {readAttachmentPdfText}=await import('../../src/main/xiaozhi-agent/attachment-pdf-text.ts');
const fixture=path.resolve(process.env.UI_PAIRED_PDF||'D:/WorkProject/小智智能体借鉴项目/_ui-review-runtime/20261101/buoyancy-review.pdf');
assert(fs.existsSync(fixture),'real paired synthetic PDF must exist');
fs.mkdirSync(path.resolve('test-results/xiaozhi-agent'),{recursive:true});
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/attachment-pdf-host-'));
const data=path.join(output,'data'),sources=path.join(output,'sources');fs.mkdirSync(data);fs.mkdirSync(sources);
const prepared=spawnSync(process.env.PYTHON||'python',['scripts/xiaozhi-agent/attachment-pdf-fixtures.py',sources,fixture],{encoding:'utf8',timeout:30000,windowsHide:true});
assert.equal(prepared.status,0,prepared.stderr);
fs.copyFileSync(fixture,path.join(sources,'buoyancy-review.pdf'));
const database=new DatabaseSync(path.join(data,'test.sqlite'));
database.exec('PRAGMA foreign_keys=ON;CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY)');
const sql={run:async(query,values=[])=>database.prepare(query).run(...values),
 change:async(query,values=[])=>Number(database.prepare(query).run(...values).changes),
 all:async(query,values=[])=>database.prepare(query).all(...values)};
const state=createAttachmentState(sql),imports=createAttachmentImportState(sql);await state.migrate();await imports.migrate();
let current=true,allow=true,pdfCalls=0,overrideError,afterPdf,beforeSanitize;
const receipts=new Map(),signal=()=>new AbortController().signal;
const importer=createAttachmentImportService({dataRoot:data,state,imports,isCurrent:()=>current});
const session='aisession_'+randomUUID();database.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(session);
const reader={...importer,preview:async(...args)=>{if(overrideError)throw Error(overrideError);return importer.preview(...args);},
 readPdfText:async(...args)=>{pdfCalls++;const result=await importer.readPdfText(...args);await afterPdf?.();return result;}};
const privacy={listStudents:async()=>[{realName:'Synthetic Student'}],
 sanitizeProblemText:async text=>({sanitizedText:text.replace(/18012345678/g,'[联系电话]')})};
const toolOptions={sessionId:session,state,importer:reader,isCurrent:()=>current,
 authorize:async row=>allow&&row.runId===receipts.get(row.id)?.runId&&row.messageId===receipts.get(row.id)?.messageId,
 sanitize:async text=>{await beforeSanitize?.();return sanitizeOfficeDocumentText(privacy,text);}};
const tools=createAttachmentReadTools(toolOptions);
async function selected(name,submit=true){
 const row=await importer.importFile(session,path.join(sources,name),signal());
 if(!submit)return row;
 const runId='run_'+randomUUID(),messageId='message_'+randomUUID();
 const [bound]=await state.bind(session,[{id:row.id,revision:row.revision}],runId,messageId);
 receipts.set(row.id,{runId,messageId});return bound;
}
const selection=row=>({id:row.id,revision:row.revision});
const execute=(row,extra={},scoped=signal(),set=tools)=>set.find(tool=>tool.name==='office_read_attachment').execute(randomUUID(),{...selection(row),...extra},scoped);
const payload=result=>JSON.parse(result.content[0].text);
const code=result=>result.details?.error?.code;
const noBody=result=>{assert(result.isError);assert(!JSON.stringify(result).includes('"success":true'));};
const report={success:false,checks:[],sourcePdfSha256:createHash('sha256').update(fs.readFileSync(fixture)).digest('hex'),
 boundary:'Actual PDF host + locked local exe + SQLite/files/tool delivery. Only AnyDoc utility transport intentionally fails. No UI/provider/teacher acceptance claim.',anyDocCalls:0,pdfCalls:0};
const check=async(name,run)=>{await run();report.checks.push({name,pass:true});console.log('PASS '+name);};
try{
 const row=await selected('buoyancy-review.pdf');
 await check('forced AnyDoc unavailable still reads the exact paired PDF 3N/2N, never invents 1N or AnyDoc parser identity',async()=>{
  const before=anyDocCalls,result=await execute(row);assert(!result.isError,code(result));const body=payload(result);
  assert(anyDocCalls>before);assert(body.text.includes('3N')&&body.text.includes('2N'));assert(!body.text.includes('1N'));
  assert.equal(body.format,'office');assert(!('document' in body));assert(!JSON.stringify(body).includes('hana-anydoc'));
  assert.equal(body.source.locator.kind,'extracted_lines');assert.equal(body.source.originalPageLocated,false);assert(body.citation.includes('原页码未定位'));
  assert(!JSON.stringify(result).includes(data));assert(!JSON.stringify(result).includes(sources));
 });
 await check('original deletion preserves authorized immutable-copy reading',async()=>{
  fs.unlinkSync(path.join(sources,'buoyancy-review.pdf'));const result=await execute(row);assert(!result.isError,code(result));assert(payload(result).text.includes('3N'));
 });
 await check('draft, foreign session and stale revision cannot reach PDF fallback',async()=>{
  const draft=await selected('encrypted.pdf',false),before=pdfCalls;
  await assert.rejects(importer.readPdfText(session,selection(draft),signal()),{message:'permission_denied'});
  noBody(await execute(draft));assert.equal(code(await execute(row,{revision:0})),'changed');
  const foreign='aisession_'+randomUUID();database.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(foreign);
  await assert.rejects(importer.readPdfText(foreign,selection(row),signal()),{message:'not_found'});
  const foreignTools=createAttachmentReadTools({...toolOptions,sessionId:foreign,authorize:async()=>true});noBody(await execute(row,{},signal(),foreignTools));
  assert.equal(pdfCalls,before);await state.remove(session,selection(draft));
 });
 await check('non-ready private import receipt refuses both direct PDF read and tool fallback',async()=>{
  const record=(await imports.list(session)).find(item=>item.relativePath===row.path),before=pdfCalls;
  database.prepare("UPDATE xiaozhi_pi_attachment_imports SET state='interrupted' WHERE id=?").run(record.id);
  try{await assert.rejects(importer.readPdfText(session,selection(row),signal()),{message:'permission_denied'});const result=await execute(row);assert.equal(code(result),'permission_denied');assert.equal(pdfCalls,before);}
  finally{database.prepare("UPDATE xiaozhi_pi_attachment_imports SET state='ready' WHERE id=?").run(record.id);}
 });
 await check('revoked message/run authorization refuses before parse',async()=>{
  const before=pdfCalls;allow=false;try{assert.equal(code(await execute(row)),'permission_denied');assert.equal(pdfCalls,before);}finally{allow=true;}
 });
 await check('guard, cancellation, timeout, busy, size and unclassified failures never trigger fallback',async()=>{
  for(const error of ['permission_denied','changed','cancelled','timeout','busy','too_large','read_failed','unsupported']){
   overrideError=error;const before=pdfCalls;const result=await execute(row);assert.equal(code(result),error);assert.equal(pdfCalls,before);
  }overrideError=undefined;
 });
 await check('each explicit parsing failure dispatches at most one fallback without retry or fake text',async()=>{
  let calls=0;const refusing=createAttachmentReadTools({...toolOptions,importer:{...reader,
   preview:async()=>{throw Error(overrideError);},readPdfText:async()=>{calls++;throw Error('needs_ocr');}}});
  for(const error of ['unavailable','parse_failed','empty','text_unreadable','needs_ocr']){
   overrideError=error;const before=calls;assert.equal(code(await execute(row,{},signal(),refusing)),'needs_ocr');assert.equal(calls,before+1);
  }overrideError=undefined;
 });
 await check('actual native text remains sanitized, line-paged and capped at 100 lines / 16000 characters',async()=>{
  const long=await selected('native-long.pdf');const result=await execute(long,{lineCount:100});assert(!result.isError,code(result));const body=payload(result);
  assert(body.text.length<=16000);assert(body.text.includes('[学生姓名]'));assert(!body.text.includes('Synthetic Student'));assert(!body.text.includes('18012345678'));assert(body.truncated);
  assert(body.source.locator.end<=100);assert.equal(code(await execute(long,{lineCount:101})),'invalid_input');
  const page=payload(await execute(long,{startLine:2,lineCount:1}));assert.equal(page.source.locator.start,2);assert.equal(page.source.locator.end,2);assert(!page.text.includes('Line 0:'));
 });
 await check('corrupt and encrypted PDF fail with no extracted body',async()=>{
  for(const name of ['corrupt.pdf','encrypted.pdf']){const bad=await selected(name);const result=await execute(bad);noBody(result);assert(['parse_failed','unsupported'].includes(code(result)),code(result));}
 });
 await check('scan-only and mixed native/OCR PDFs reject the entire document as needs_ocr',async()=>{
  for(const name of ['scan.pdf','mixed.pdf']){const scan=await selected(name);const result=await execute(scan);noBody(result);assert.equal(code(result),'needs_ocr',name);assert(!JSON.stringify(result).includes('3N'));}
 });
 await check('50MiB input limit rejects a real oversized file before local extraction',async()=>{
  const large=path.join(sources,'large.pdf'),handle=fs.openSync(large,'w');fs.writeSync(handle,'%PDF-1.7\n');fs.ftruncateSync(handle,50*1024*1024+1);fs.closeSync(handle);
  await assert.rejects(importer.importFile(session,large,signal()),{message:'too_large'});
  await assert.rejects(readAttachmentPdfText({localPath:large,contentHash:'a'.repeat(64)},signal()),{message:'too_large'});
 });
 await check('captured-copy tampering and junction substitution are rejected before fallback',async()=>{
  fs.copyFileSync(fixture,path.join(sources,'tamper.pdf'));const victim=await selected('tamper.pdf'),copy=path.join(data,'xiaozhi-pi','attachments',session,victim.path);
  fs.chmodSync(copy,0o644);fs.appendFileSync(copy,'changed');const before=pdfCalls;assert.equal(code(await execute(victim)),'changed');assert.equal(pdfCalls,before);
  const folder=path.dirname(path.join(data,'xiaozhi-pi','attachments',session,row.path)),saved=folder+'-saved';
  fs.renameSync(folder,saved);fs.symlinkSync(sources,folder,process.platform==='win32'?'junction':'dir');
  try{assert.equal(code(await execute(row)),'permission_denied');assert.equal(pdfCalls,before);}
  finally{assert(fs.lstatSync(folder).isSymbolicLink());fs.rmdirSync(folder);fs.renameSync(saved,folder);}
 });
 await check('revocation or run-binding change after real PDF extraction prevents late delivery',async()=>{
  afterPdf=async()=>{allow=false;};try{const result=await execute(row);noBody(result);assert.equal(code(result),'permission_denied');}finally{allow=true;afterPdf=undefined;}
  afterPdf=async()=>{database.prepare('UPDATE xiaozhi_pi_attachments SET run_id=? WHERE id=?').run('different_run',row.id);};
  try{const result=await execute(row);noBody(result);assert.equal(code(result),'changed');}
  finally{afterPdf=undefined;database.prepare('UPDATE xiaozhi_pi_attachments SET run_id=? WHERE id=?').run(row.runId,row.id);}
 });
 await check('revision or ready-receipt loss after real PDF extraction prevents late delivery',async()=>{
  afterPdf=async()=>{database.prepare('UPDATE xiaozhi_pi_attachments SET revision=revision+1 WHERE id=?').run(row.id);};
  try{const result=await execute(row);noBody(result);assert.equal(code(result),'changed');}
  finally{afterPdf=undefined;database.prepare('UPDATE xiaozhi_pi_attachments SET revision=? WHERE id=?').run(row.revision,row.id);}
  const record=(await imports.list(session)).find(item=>item.relativePath===row.path);
  afterPdf=async()=>{database.prepare("UPDATE xiaozhi_pi_attachment_imports SET state='interrupted' WHERE id=?").run(record.id);};
  try{const result=await execute(row);noBody(result);assert.equal(code(result),'permission_denied');}
  finally{afterPdf=undefined;database.prepare("UPDATE xiaozhi_pi_attachment_imports SET state='ready' WHERE id=?").run(record.id);}
 });
 await check('bytes changed after successful extraction are discarded before final model delivery',async()=>{
  fs.copyFileSync(fixture,path.join(sources,'late-change.pdf'));const victim=await selected('late-change.pdf');
  const copy=path.join(data,'xiaozhi-pi','attachments',session,victim.path);
  afterPdf=async()=>{fs.chmodSync(copy,0o644);fs.appendFileSync(copy,'late change');};
  try{const result=await execute(victim);noBody(result);assert.equal(code(result),'changed');}
  finally{afterPdf=undefined;}
 });
 await check('cancel during the real host or after extraction cannot deliver a late body',async()=>{
  const early=new AbortController(),pending=execute(row,{},early.signal);const timer=setTimeout(()=>early.abort(),15);
  try{const result=await pending;noBody(result);assert.equal(code(result),'cancelled');}finally{clearTimeout(timer);}
  const late=new AbortController();beforeSanitize=async()=>{late.abort();};
  try{const result=await execute(row,{},late.signal);noBody(result);assert.equal(code(result),'cancelled');}finally{beforeSanitize=undefined;}
 });
 await check('non-PDF text and unconfirmed/teacher-approved image OCR keep their original paths',async()=>{
  fs.writeFileSync(path.join(sources,'unchanged.txt'),'Existing text attachment route');const text=await selected('unchanged.txt'),before=pdfCalls;
  const result=await execute(text);assert(!result.isError);assert.equal(payload(result).text,'Existing text attachment route');
  const failedText=createAttachmentReadTools({...toolOptions,importer:{...reader,preview:async()=>{throw Error('unavailable');}}});assert.equal(code(await execute(text,{},signal(),failedText)),'unavailable');
  fs.copyFileSync('scripts/xiaozhi-agent/fixtures/attachment-rgb.png',path.join(sources,'image.png'));const image=await selected('image.png');assert.equal(code(await execute(image)),'needs_ocr');
  const approved=createAttachmentReadTools({...toolOptions,ocr:{get:async()=>({status:'approved',revision:1,corrected:'教师已校正的合成图像文字'})}});
  const imageResult=await execute(image,{},signal(),approved);assert(!imageResult.isError);assert.equal(payload(imageResult).teacherCorrected,true);assert.equal(pdfCalls,before);
 });
 await check('all reads and failures preserve the original submitted attachment facts',async()=>{
  assert.deepEqual(await state.get(session,row.id),row);
 });
 report.success=true;
}catch(error){report.failure=error instanceof Error?error.message:'host_test_failed';process.exitCode=1;console.error('FAIL '+report.failure);}
finally{report.anyDocCalls=anyDocCalls;report.pdfCalls=pdfCalls;report.pdfHostMetadata=globalThis.attachmentPdfHostMetadata;database.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,failure:report.failure}));}
