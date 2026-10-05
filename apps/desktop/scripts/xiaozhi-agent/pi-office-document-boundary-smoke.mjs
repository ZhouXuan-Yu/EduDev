import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createAssistantMessageEventStream} from '@earendil-works/pi-ai';
const {createOfficeDocumentTools,sanitizeOfficeDocumentText}=await import('../../src/main/xiaozhi-agent/office-document-tools.ts');
const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-office-boundary-')),workspace=path.join(output,'workspace'),stateRoot=path.join(output,'state');fs.mkdirSync(workspace);fs.mkdirSync(stateRoot);
const sessionId=`aisession_${randomUUID()}`;let current=true,invocations=0,resolves=0,agent;
const tools=createOfficeDocumentTools({sessionId,runId:'run',isCurrent:()=>{invocations++;return current;},resolve:async()=>{resolves++;throw new Error('private root');},sanitize:async v=>v});
const checks=[],report={success:false,checks,boundaries:['Strict main tool guards, privacy delegation and real SDK native identity/cached call; no actual parser or provider request','Actual parsing and real DeepSeek verified separately in Electron UI']};
const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log(`PASS ${name}`);};
globalThis.fetch=async()=>{throw new Error('Network disabled in native boundary suite');};
async function prime(){agent.session.agent.streamFn=model=>{const stream=createAssistantMessageEventStream(),message={role:'assistant',api:model.api,provider:model.provider,model:model.id,content:[{type:'text',text:'合成基线'}],stopReason:'stop',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}};stream.push({type:'done',reason:'stop',message});stream.end();return stream;};assert((await agent.prompt('合成原生持久基线')).ok);}
try{
 await check('Known names are locally replaced longest-first and existing privacy boundary is explicitly reused',async()=>{
   let count=0;const store={sanitizeProblemText:async text=>{count++;return{sanitizedText:text.replace('CONTACT','[既有脱敏]')};},listStudents:async()=>[{realName:'合成张甲同学',displayName:'合成张甲'},{realName:'合成张甲'}]};
   assert.equal(await sanitizeOfficeDocumentText(store,'合成张甲同学 和 合成张甲 CONTACT'),'[学生姓名] 和 [学生姓名] [既有脱敏]');assert.equal(count,1);
 });
 await check('Invalid path/format/ranges/extra fields return safe errors before any filesystem resolution',async()=>{
   for(const input of [{path:'../资料.docx'},{path:'D:/secret.docx'},{path:'file.txt'},{path:'资料.docx',startLine:0},{path:'资料.docx',lineCount:101},{path:'资料.docx',command:'execute'},{path:'资料.docx',sessionId:'other'}]){
     const result=await tools[0].execute(randomUUID(),input,new AbortController().signal);assert(result.isError);assert(!JSON.stringify(result).includes('private root'));}
   assert.equal(resolves,0);
 });
 await check('Revoked run and aborted signal return cancelled/denied with no body or path',async()=>{
   current=false;const revoked=await tools[0].execute('revoked',{path:'资料.docx'},new AbortController().signal);assert(revoked.isError);assert.equal(revoked.details.error.code,'permission_denied');
   const abort=new AbortController();abort.abort();const cancelled=await tools[0].execute('cancel',{path:'资料.docx'},abort.signal);assert(cancelled.isError);assert.equal(cancelled.details.error.code,'cancelled');assert.equal(resolves,0);current=true;
 });
 const options={stateRoot,workspace,apiKey:'synthetic-no-provider',model:'deepseek-chat',approveCopy:async()=>false};
 await check('Real native old session gains additive Office marker without changing old header/snapshot/prefix',async()=>{
   agent=await createPiXiaozhiSession(options);await prime();const manager=agent.session.sessionManager,file=manager.getSessionFile(),before=fs.readFileSync(file),snapshot=manager.getBranch().find(e=>e.customType==='xiaozhi.education.snapshot.v1');
   await agent.dispose();agent=await createPiXiaozhiSession({...options,sessionFile:file,officeDocumentTools:tools});
   assert.deepEqual(agent.session.sessionManager.getBranch().find(e=>e.customType==='xiaozhi.education.snapshot.v1'),snapshot);assert(fs.readFileSync(file).subarray(0,before.length).equals(before));assert(agent.session.getActiveToolNames().includes('office_read_document'));
   const identity=agent.session.sessionManager.getEntries().filter(e=>e.customType==='xiaozhi.education.office-document.v1');assert.equal(identity.length,1);assert.equal(identity[0].data.parser,'hana-anydoc-0.1.2');
   await agent.dispose();agent=undefined;await assert.rejects(createPiXiaozhiSession({...options,sessionFile:file}),/configuration/);
 });
 await check('Unknown native capability versions fail closed, without rewriting creation identity',async()=>{
   const root=path.join(output,'unknown');fs.mkdirSync(root);agent=await createPiXiaozhiSession({...options,stateRoot:root,officeDocumentTools:tools});await prime();agent.session.sessionManager.appendCustomEntry('xiaozhi.education.office-document.v2',{});const file=agent.session.sessionManager.getSessionFile();await agent.dispose();agent=undefined;
   await assert.rejects(createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file,officeDocumentTools:tools}),/configuration/);
 });
 const {createHanaRunToolScope}=await import('../../src/main/xiaozhi-agent/hana-tool-scope.ts');
 await check('Original Hana execution-once runs real document guard only once for duplicate call ID',async()=>{
   const wrapped=createHanaRunToolScope(tools)[0],before=invocations;
   const a=await wrapped.execute('same',{path:'file.txt'},new AbortController().signal),b=await wrapped.execute('same',{path:'file.txt'},new AbortController().signal);
   assert.deepEqual(a,b);assert.equal(invocations-before,1);const conflict=await wrapped.execute('same',{path:'another.txt'},new AbortController().signal);assert(conflict.isError);assert.equal(invocations-before,1);
 });

 const {createMaterialTools}=await import('../../src/main/assets/material-tools.ts');
 const resourceId='resource_12345678-1234-1234-1234-123456789abc';let materialReads=0,materialCurrent=true;
 const materialStore={sanitizeProblemText:async text=>({sanitizedText:text.replace('CONTACT','[既有脱敏]')}),listStudents:async()=>[{realName:'合成张甲同学'}],materials:{list:async input=>{materialReads++;return {resources:[{id:resourceId,originalFileName:'合成张甲同学教案.docx',parseStatus:'ready',chunkCount:2}],total:1,offset:input.offset,hasMore:false};},body:async input=>{materialReads++;return {resource:{originalFileName:'合成张甲同学教案.docx',parseEngine:'local-text-v1',contentHash:'saved-version'},chunks:[{chunkIndex:input.offset,contentMd:'合成张甲同学 CONTACT 真实正文',containsPersonalData:false}],total:2};}}};
 const materialTools=createMaterialTools(materialStore,()=>materialCurrent);
 await check('Saved-material tools reject path, arbitrary scope, extra fields and invalid offsets before repository access',async()=>{
  for(const [tool,input] of [[0,{query:'资料',offset:-1}],[0,{query:'资料',offset:0,path:'secret'}],[0,{query:'资料',offset:0,schemaVersion:'other'}],[1,{resourceId:'../../secret',offset:0}],[1,{resourceId,offset:0,sessionId:'other'}],[1,{resourceId,offset:0.5}]])assert((await materialTools[tool].execute(randomUUID(),input,new AbortController().signal)).isError);
  assert.equal(materialReads,0);
 });
 await check('Stopped or revoked saved-material reads cannot access catalogue or body',async()=>{
  materialCurrent=false;assert((await materialTools[0].execute('revoked-material',{query:'教案',offset:0},new AbortController().signal)).isError);materialCurrent=true;
  const abort=new AbortController();abort.abort();assert((await materialTools[1].execute('cancelled-material',{resourceId,offset:0},abort.signal)).isError);assert.equal(materialReads,0);
 });
 await check('Saved-material title and body reuse education redaction, expose real continuation and never claim teacher confirmation or pages',async()=>{
  const list=JSON.parse((await materialTools[0].execute('list-material',{query:'教案',offset:0},new AbortController().signal)).content[0].text);assert.equal(list.materials[0].resourceId,resourceId);assert(!JSON.stringify(list).includes('合成张甲同学'));
  const body=JSON.parse((await materialTools[1].execute('read-material',{resourceId,offset:0},new AbortController().signal)).content[0].text);assert.equal(body.nextOffset,1);assert.equal(body.source.version,'saved-version');assert.equal(body.source.originalPageLocated,false);assert.equal(body.teacherConfirmed,false);assert(!JSON.stringify(body).includes('合成张甲同学'));assert(!body.text.includes('CONTACT'));assert(body.text.includes('真实正文'));
 });
 await check('Failed or personal saved-material body never masquerades as readable raw text',async()=>{
  const original=materialStore.materials.body;materialStore.materials.body=async()=>({resource:{originalFileName:'教案.docx',parseEngine:'hana-anydoc-0.1.2:parse_failed'},chunks:[],total:0});assert((await materialTools[1].execute('failed-material',{resourceId,offset:0},new AbortController().signal)).isError);
  materialStore.materials.body=async input=>({...await original(input),chunks:[{chunkIndex:0,contentMd:'PRIVATE_STUDENT_CONTACT',containsPersonalData:true}]});const result=await materialTools[1].execute('private-material',{resourceId,offset:0},new AbortController().signal);assert(!JSON.stringify(result).includes('PRIVATE_STUDENT_CONTACT'));materialStore.materials.body=original;
 });
 await check('Real native prior session adds two material tools without rewriting historical prefix or original creation identity',async()=>{
  await agent?.dispose();const root=path.join(output,'material-addition');fs.mkdirSync(root);agent=await createPiXiaozhiSession({...options,stateRoot:root});await prime();const file=agent.session.sessionManager.getSessionFile(),prefix=fs.readFileSync(file),snapshot=agent.session.sessionManager.getBranch().find(e=>e.customType==='xiaozhi.education.snapshot.v1');await agent.dispose();
  agent=await createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file,materialTools});assert.deepEqual(agent.session.sessionManager.getBranch().find(e=>e.customType==='xiaozhi.education.snapshot.v1'),snapshot);assert(fs.readFileSync(file).subarray(0,prefix.length).equals(prefix));assert(agent.session.getActiveToolNames().includes('office_read_material'));assert.equal(agent.session.sessionManager.getEntries().filter(e=>e.customType==='xiaozhi.education.material-read.v1').length,1);await agent.dispose();agent=undefined;
  await assert.rejects(createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file}),/configuration/);
 });
 await check('Unknown saved-material native capability or substituted tool names fail closed',async()=>{
  const root=path.join(output,'material-unknown');fs.mkdirSync(root);await assert.rejects(createPiXiaozhiSession({...options,stateRoot:root,materialTools:[...materialTools,{...materialTools[0],name:'read_anything'}]}),/configuration/);
  agent=await createPiXiaozhiSession({...options,stateRoot:root,materialTools});await prime();agent.session.sessionManager.appendCustomEntry('xiaozhi.education.material-read.v2',{});const file=agent.session.sessionManager.getSessionFile();await agent.dispose();agent=undefined;await assert.rejects(createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file,materialTools}),/configuration/);
 });
 report.success=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}
finally{await agent?.dispose();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,error:report.error,report:path.relative(process.cwd(),path.join(output,'report.json'))}));}
