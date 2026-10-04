import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash,randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const {createXiaozhiProductionHost}=await import('../../src/main/xiaozhi-agent/production-host.ts');
const {createXiaozhiSessionState}=await import('../../src/main/xiaozhi-agent/session-state.ts');
const {createTextChangeService}=await import('../../src/main/xiaozhi-agent/text-change-service.ts');
const fixture=path.resolve('test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data/app.db'),output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-text-host-'));
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=sha(fixture),dataRoot=path.join(output,'data'),workspace=path.join(output,'workspace');fs.mkdirSync(dataRoot);fs.mkdirSync(workspace);fs.copyFileSync(fixture,path.join(dataRoot,'app.db'));
const db=new DatabaseSync(path.join(dataRoot,'app.db')),state=createXiaozhiSessionState({all:async(s,v=[])=>db.prepare(s).all(...v),run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes)});await state.init();
const id=db.prepare('SELECT id FROM ai_conversation_sessions LIMIT 1').get().id;await state.setWorkspace(id,workspace,'owned');
let archived=false,readBarrier,reads=0;
const store={xiaozhiState:state,sanitizeProblemText:async text=>({sanitizedText:text}),getDeepSeekRuntimeSettings:async()=>({provider:'deepseek',apiKey:'synthetic-no-provider',model:'deepseek-flash'}),getAiConversationSession:async()=>{reads++;if(readBarrier)await readBarrier();return{session:{archivedAt:archived?'owned':''},messages:[]};}};
const host=createXiaozhiProductionHost({store,dataRoot,emit:()=>assert.fail('Idle host tests must not launch a model run')});await host.skillCatalog();
const service=createTextChangeService({state:state.changes,dataRoot,workspace:async()=>workspace,isCurrent:()=>true});
const decision=(row,action)=>({schemaVersion:'xiaozhi.change.v1',sessionId:id,changeId:row.id,revision:row.revision,action});
async function applied(name){const row=await service.propose(id,'fixture-run',randomUUID(),{operation:'create',path:name,content:'合成已确认文件'});await service.decision(decision(row,'approve'));return service.apply(id,row.id);}
const checks=[],report={success:false,checks,boundary:'Actual production host locks, archived authority, SQLite and file effects; controlled async barriers. No provider/UI claim.'};let release;
const check=name=>{checks.push({name,pass:true});console.log('PASS '+name);};
globalThis.fetch=async()=>{throw new Error('No network permitted in host-lock suite');};
try{
 const row=await applied('撤销.txt');let entered;const entering=new Promise(r=>entered=r),job=host.withLocalSettingsJob(async()=>{entered();await new Promise(r=>release=r);});await entering;
 assert.equal((await host.decideTextChange(decision(row,'undo'))).error,'busy');assert(fs.existsSync(path.join(workspace,row.path)));release();await job;check('Another global local job refuses undo before any file effect');
 const undo=await host.decideTextChange(decision(row,'undo'));assert(undo.ok&&undo.value.state==='reverted');assert(!fs.existsSync(path.join(workspace,row.path)));check('Idle host executes explicit undo and releases its global owner');
 const second=await applied('归档.txt');archived=true;assert.equal((await host.reviewTextChange({sessionId:id,changeId:second.id})).error,'permission_denied');assert.equal((await host.decideTextChange(decision(second,'undo'))).error,'permission_denied');assert(fs.existsSync(path.join(workspace,second.path)));archived=false;check('Archived session cannot disclose review or undo a file');
 let enteredUndo;const undoEntering=new Promise(r=>enteredUndo=r);readBarrier=()=>{enteredUndo();return new Promise(r=>release=r);};const work=host.decideTextChange(decision(second,'undo'));await undoEntering;
 assert.equal((await host.start({sessionId:id,commandId:`xicmd_${randomUUID()}`,prompt:'owned'})).error,'busy');assert.equal((await host.selectWorkspace(id,async()=>assert.fail())).error,'busy');assert.equal((await host.decideTextChange(decision(second,'verify'))).error,'busy');check('Undo reserves the existing global owner before asynchronous authority reads');
 let closed=false;const closing=host.close().then(()=>closed=true);await new Promise(r=>setTimeout(r,20));assert.equal(closed,false);readBarrier=undefined;release();const failed=await work;assert.equal(failed.error,'permission_denied');await closing;assert(fs.existsSync(path.join(workspace,second.path)));assert.equal((await state.changes.get(second.id)).state,'applied');check('Close waits and refuses late file work after a pending authority read');
 assert.equal(sha(fixture),before);check('Original isolated fixture source remains byte-identical');report.success=true;
}catch(error){report.error=String(error.stack).slice(0,2500);process.exitCode=1;}
finally{readBarrier=undefined;release?.();await host.close();db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,error:report.error,report:path.relative(process.cwd(),path.join(output,'report.json'))}));}
