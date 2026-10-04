import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
const {createXiaozhiProductionHost}=await import('../../src/main/xiaozhi-agent/production-host.ts');
const {createXiaozhiSessionState}=await import('../../src/main/xiaozhi-agent/session-state.ts');
const {createOfficeArtifactService}=await import('../../src/main/xiaozhi-agent/office-artifact-service.ts');
const fixture=path.resolve('test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data/app.db'),output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-office-host-'));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=sha(fixture),dataRoot=path.join(output,'data'),workspace=path.join(output,'workspace');fs.mkdirSync(dataRoot);fs.mkdirSync(workspace);fs.copyFileSync(fixture,path.join(dataRoot,'app.db'));
const db=new DatabaseSync(path.join(dataRoot,'app.db')),state=createXiaozhiSessionState({all:async(s,v=[])=>db.prepare(s).all(...v),run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes)});await state.init();
const id=db.prepare('SELECT id FROM ai_conversation_sessions LIMIT 1').get().id;await state.setWorkspace(id,workspace,'owned');let archived=false,readBarrier;
const store={xiaozhiState:state,sanitizeProblemText:async text=>({sanitizedText:text}),getDeepSeekRuntimeSettings:async()=>({provider:'deepseek',apiKey:'synthetic-no-provider',model:'deepseek-flash'}),getAiConversationSession:async()=>{if(readBarrier)await readBarrier();return{session:{archivedAt:archived?'owned':''},messages:[]};}};
const host=createXiaozhiProductionHost({store,dataRoot,emit:()=>assert.fail('No live model in idle host gate')});await host.skillCatalog();
const service=createOfficeArtifactService({state:state.officeArtifacts,dataRoot,workspace:async()=>workspace,isCurrent:()=>true,afterStage:async stage=>{if(stage==='file')throw new Error('owned-cut-after-real-file');}});
const address=row=>({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:id,draftId:row.id});
const decision=row=>({...address(row),revision:row.revision,action:'verify'});
async function uncertain(name){const row=await service.propose(id,'owned-run',randomUUID(),{path:name+'.xlsx',format:'xlsx',sources:[],draft:{schemaVersion:'xiaozhi.office-draft.v1',title:'合成',sections:[{heading:'备课',paragraphs:['本地内容']}]}});await service.decide({...decision(row),action:'approve'});await assert.rejects(service.apply(id,row.id),/owned-cut/);return state.officeArtifacts.get(row.id);}
const report={success:false,checks:[],boundary:'Actual original global host owner, closing/archived authorization, SQLite and real XLSX/FS. Controlled async cut/barriers only; no provider/UI.'};let release;
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};globalThis.fetch=async()=>{throw new Error('Network disabled');};
try{
 const row=await uncertain('核验');assert.equal(row.state,'uncertain');const bytes=fs.readFileSync(path.join(workspace,row.path));let enter;const entered=new Promise(r=>enter=r),job=host.withLocalSettingsJob(async()=>{enter();await new Promise(r=>release=r);});await entered;
 assert.equal((await host.decideOfficeArtifact(decision(row))).error,'busy');assert(fs.readFileSync(path.join(workspace,row.path)).equals(bytes));release();await job;check('A concurrent settings/local job denies verification before any fact or file effect');
 const verified=await host.decideOfficeArtifact(decision(row));assert(verified.ok&&verified.value.state==='saved');assert(fs.readFileSync(path.join(workspace,row.path)).equals(bytes));check('Idle explicit verification registers real existing bytes and releases the original global owner');
 const second=await uncertain('归档');archived=true;assert.equal((await host.reviewOfficeArtifact(address(second))).error,'permission_denied');assert.equal((await host.decideOfficeArtifact(decision(second))).error,'permission_denied');assert.equal((await state.officeArtifacts.get(second.id)).state,'uncertain');archived=false;check('Archived conversation denies local draft disclosure and recovery publication');
 let entering;const enterVerify=new Promise(r=>entering=r);readBarrier=()=>{entering();return new Promise(r=>release=r);};const work=host.decideOfficeArtifact(decision(second));await enterVerify;
 assert.equal((await host.start({sessionId:id,commandId:`xicmd_${randomUUID()}`,prompt:'owned'})).error,'busy');assert.equal((await host.selectWorkspace(id,async()=>assert.fail())).error,'busy');assert.equal((await host.decideOfficeArtifact(decision(second))).error,'busy');check('Verification holds global idle owner during awaited authorization and blocks starts/chooser');
 let closed=false;const closing=host.close().then(()=>closed=true);await new Promise(r=>setTimeout(r,20));assert(!closed);readBarrier=undefined;release();assert.equal((await work).error,'busy');await closing;assert.equal((await state.officeArtifacts.get(second.id)).state,'uncertain');check('Close waits for actual owner then rejects late authority without publishing or replay');
 assert.equal(sha(fixture),before);check('Original isolated legacy source remains byte-identical');report.success=true;
}catch(error){process.exitCode=1;report.error=String(error.stack).slice(0,2400);}
finally{readBarrier=undefined;release?.();await host.close();db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,output}));}
