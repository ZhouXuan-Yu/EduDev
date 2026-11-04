/** Source integration only: real OmniEduStore/native sqlite3, compiler, Office
 * ledger/triggers and recovery helper. No Electron/model/UI acceptance.
 * Controlled seams: idle lease state, authority and async failure barriers.
 * Source checks always delegate to the actual repository/material reader.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const desktop=fileURLToPath(new URL('../..',import.meta.url));
const output=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'c2-office-recovery-'));
const report={success:false,output,checks:[],electronLaunches:0,modelCalls:0,seams:['Controlled idle lease and authority, no replacement source result','Native SQL observers delegate unchanged; optional barriers after real fact UPDATE','Actual production host lease wiring checked as source contract, not live host/UI acceptance']};
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const sha=b=>createHash('sha256').update(b).digest('hex');
const watchdog=setTimeout(()=>{report.fatal='90 second deadline';persist();process.exit(1);},90000);
const check=async(name,fn)=>{try{await fn();report.checks.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){report.checks.push({name,status:'FAIL',stack:String(e.stack)});console.log('FAIL '+name+' '+e.message);}persist();};
globalThis.fetch=async()=>{throw Error('Network forbidden');};
let store,coordinator,service,paper,session,sourceFile,sourceText,workspace,dataRoot,phase='',inside=false,sqlEvents=[],sourceReads=[],afterFact=async()=>{},lease=true,running=false,closing=false,authorized=true,authorityChecks=0,publishes=0,generations=0,postCommitArmed=false;
const assertLease=()=>{if(!lease||running||closing)throw Error('busy');};
const authority=async()=>{authorityChecks++;assertLease();if(!authorized)throw Error('permission_denied');return workspace;};
let m;
try{
 const built=await build({stdin:{resolveDir:desktop,contents:`
  export {OmniEduStore} from './src/main/db';
  export {createOfficePaperRecovery} from './src/main/xiaozhi-agent/office-paper-recovery';
  export {createOfficeArtifactService} from './src/main/xiaozhi-agent/office-artifact-service';
  export {createOfficeArtifactCoordinator} from './src/main/xiaozhi-agent/office-artifact-coordinator';
  export {compilePaperOffice,assertPaperOffice} from './src/main/education/paper-export';
  export {questionVersion} from './src/main/education/question-context-provider';
  export {createPaperTemplateService} from './src/main/education/paper-template-service';
  export {extractTemplateSource} from './src/main/education/paper-template-source';
  export {generateOfficeDocument} from './src/main/xiaozhi-agent/office-generator';
 `},bundle:true,write:false,packages:'external',platform:'node',format:'esm',plugins:[{name:'deny-electron',setup(b){
  b.onResolve({filter:/^electron$/},()=>({path:'electron',namespace:'denied'}));
  b.onLoad({filter:/.*/,namespace:'denied'},()=>({contents:"const denied=new Proxy(function(){throw Error('Electron forbidden')},{get(){throw Error('Electron forbidden')}});export const app=denied,utilityProcess=denied,nativeImage=denied,safeStorage=denied,dialog=denied,BrowserWindow=denied,session=denied,ipcMain=denied,shell=denied,screen=denied;"}));
  b.onResolve({filter:/^[A-Za-z@]/},a=>({path:import.meta.resolve(a.path),external:true}));
 }}]});
 const bundle=path.join(output,'source.mjs');fs.writeFileSync(bundle,built.outputFiles[0].text);report.bundleSha256=sha(built.outputFiles[0].text);m=await import(pathToFileURL(bundle).href);
 dataRoot=path.join(output,'data');workspace=path.join(output,'workspace');fs.mkdirSync(workspace);
 let connection=0;
 const connect=async()=>{
  store=new m.OmniEduStore(dataRoot);const open=store.openDatabase.bind(store);
  store.openDatabase=async file=>{const db=await open(file),id=++connection,nativeRun=db.run,nativeAll=db.all,nativeExec=db.exec;
   db.exec=function(q,callback){return nativeExec.call(this,q,function(error){
    if(!error&&postCommitArmed&&/^COMMIT;/.test(q)){postCommitArmed=false;closing=true;report.postCommitLeaseLoss='After native writer COMMIT callback, before work.close begins';}
    callback.call(this,error);
   });};
   db.run=function(q,...args){const callback=args.pop();return nativeRun.call(this,q,...args,async function(error){
    if(inside)sqlEvents.push({phase,connection:id,kind:'run',sql:q});
    if(!error&&phase==='post-commit'&&inside&&/^UPDATE xiaozhi_pi_office_drafts SET state=/.test(q))postCommitArmed=true;
    if(!error&&inside&&/^UPDATE xiaozhi_pi_office_drafts SET state=/.test(q))try{await afterFact();}catch(e){callback.call(this,e);return;}
    callback.call(this,error);
   });};
   db.all=function(q,...args){if(inside)sqlEvents.push({phase,connection:id,kind:'all',sql:q});return nativeAll.call(this,q,...args);};return db;
  };
  await store.init();
  const original=store.paperTemplateTransaction.bind(store);store.paperTemplateTransaction=async action=>original(async(sql,materials)=>{inside=true;try{return await action(sql,materials);}finally{inside=false;}});
  const read=store.papers.reviewInTransaction.bind(store.papers);store.papers.reviewInTransaction=async(sql,...args)=>{const result=await read(sql,...args);if(inside)sourceReads.push({phase,sourceCurrent:result.sourceCurrent,digest:result.digest});return result;};
 };
 await connect();
 session=(await store.createAiConversationSession({title:'C2 isolated recovery'})).session.id;
 const q=await store.createQuestionBankItem({subject:'数学',grade:'初二',knowledgePoint:'加法',questionType:'解答题',difficulty:'medium',stem:'计算1+1。',answer:'2',analysis:'整数加法。',sourceTitle:'测试自建题',tags:[]});
 const V2='xiaozhi.paper-basket.v2',request=()=>randomUUID();
 const blueprint={title:'恢复测试卷',subject:'数学',grade:'初二',durationMinutes:30,totalPoints:5,mode:'source_only',sections:[{id:'a',label:'解答题',questionType:'解答题',count:1,points:5}]};
 let basket=await store.paperBasketsV2.create({schemaVersion:V2,sessionId:session,requestId:request(),blueprint});
 basket=await store.paperBasketsV2.mutate({schemaVersion:V2,sessionId:session,basketId:basket.id,requestId:request(),expectedRevision:basket.revision,operation:{type:'add',questionId:q.id,sectionId:'a',expectedSourceVersion:m.questionVersion(q)}});
 sourceFile=path.join(dataRoot,'teacher_resources','reference.txt');sourceText='试卷名称：恢复测试卷\n学科：数学\n年级：初二\n时长：30分钟\n总分：5分\n一、解答题 共1题 每题5分';fs.writeFileSync(sourceFile,sourceText);
 const version=sha(fs.readFileSync(sourceFile)),rid='resource_'+request(),stamp=new Date().toISOString();
 // Fresh owned fixture resource; production extractor and source checks read it.
 await store.run(`INSERT INTO teacher_resources(id,title,resource_type,original_file_name,local_path,file_size,content_hash,parse_status,parse_engine,created_at,updated_at) VALUES(?,?,'document',?,?,?,?,'ready','text.v1',?,?)`,[rid,'测试参考','reference.txt',sourceFile,fs.statSync(sourceFile).size,version,stamp,stamp]);
 await store.run('INSERT INTO resource_chunks(id,resource_id,chunk_index,content_md,contains_personal_data,created_at) VALUES(?,?,0,?,0,?)',['chunk_'+request(),rid,sourceText,stamp]);
 const templates=m.createPaperTemplateService({materials:store.materials,transaction:a=>store.paperTemplateTransaction(a)}),signal=()=>new AbortController().signal;
 const raw=await store.paperTemplateTransaction((sql,materials)=>m.extractTemplateSource(sql,materials,rid,version,signal()));
 const layout={paper:'A4',orientation:'portrait',columns:'1',top:'1134',right:'1134',bottom:'1134',left:'1134',columnGap:'567'};
 const saved=await templates.save({schemaVersion:'xiaozhi.paper-reference.v1',sessionId:session,basketId:basket.id,basketRevision:basket.revision,requestId:'save_'+request(),resourceId:rid,version,expectedCandidateDigest:raw.digest,expectedHeadVersion:0,name:'恢复版式',kind:'layout',patches:Object.entries(layout).map(([key,teacherValue])=>({path:'layout.'+key,teacherValue,confirmed:true}))},signal());
 await templates.apply({sessionId:session,basketId:basket.id,expectedRevision:basket.revision,requestId:'apply_'+request(),kind:'layout',layout:saved.template},signal());
 basket=await store.paperBasketsV2.read({schemaVersion:V2,sessionId:session,basketId:basket.id});
 const confirmed=await store.paperBasketsV2.confirm({schemaVersion:V2,sessionId:session,basketId:basket.id,expectedRevision:basket.revision,requestId:request()});paper=confirmed.paper;assert.equal(paper.snapshotSchema,'xiaozhi.paper-basket-snapshot.c2.v1');
 const draft=m.compilePaperOffice(paper,'student'),bytes=await m.generateOfficeDocument('docx',draft,{dataRoot});
 const rows={};
 // Exercise real proposal/approval/install and cut only after installed bytes.
 const creator=m.createOfficeArtifactService({state:store.xiaozhiState.officeArtifacts,dataRoot,workspace:async()=>workspace,paperWorkspace:async()=>workspace,isCurrent:()=>true,
  validatePaperDraft:async(id,d)=>m.assertPaperOffice(await store.papers.review(id,d.paperSource.paperId),d),
  commitPaperDraft:async(id,d,install)=>store.papers.withConfirmedSource(id,d.paperSource.paperId,d.paperSource.digest,p=>{m.assertPaperOffice(p,d);install();},{c2:true}),
  generate:async()=>{generations++;return bytes;},resolvePaperImages:async()=>new Map(),afterStage:async stage=>{if(stage==='file')throw Error('test-cut-after-installed');}});
 const input=(row,action='verify')=>({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:session,draftId:row.id,revision:row.revision,action});
 for(const name of ['idle','busy','hash','authority','revision','rollback-authority','rollback-lease','rollback-hash','post-commit','source','rollback-source']){
  const row=await creator.propose(session,'historical-run',request(),{path:name+'.docx',format:'docx',draft,sources:[]});await creator.decide(input(row,'approve'));
  await assert.rejects(()=>creator.apply(session,row.id),/test-cut-after-installed/);rows[name]=await store.xiaozhiState.officeArtifacts.get(row.id);assert.equal(rows[name].state,'uncertain');
 }
 const workspaceBefore=Object.fromEntries(Object.values(rows).map(r=>[r.path,sha(fs.readFileSync(path.join(workspace,r.path)))]));
 await store.close();await connect(); // No historical active run survives reopening.
 const setupService=()=>{
  service=m.createOfficeArtifactService({state:store.xiaozhiState.officeArtifacts,dataRoot,workspace:authority,paperWorkspace:authority,isCurrent:()=>false,
   validatePaperDraft:async(id,d)=>m.assertPaperOffice(await store.papers.review(id,d.paperSource.paperId),d),commitPaperDraft:async()=>{throw Error('Recovery must not install');},recoverPaperDraft:m.createOfficePaperRecovery(store)});
  coordinator=m.createOfficeArtifactCoordinator({state:store.xiaozhiState.officeArtifacts,service,isCurrent:()=>false,sanitize:async t=>t,emit:()=>{publishes++;}});
 };setupService();
 const unchanged=async row=>{assert.equal((await store.xiaozhiState.officeArtifacts.get(row.id)).state,'uncertain');assert.equal((await store.all('SELECT count(*) AS n FROM document_artifacts WHERE id=?',[row.artifactId]))[0].n,0);assert.equal((await store.all('SELECT count(*) AS n FROM document_artifact_paper_sources WHERE draft_id=?',[row.id]))[0].n,0);assert.equal(sha(fs.readFileSync(path.join(workspace,row.path))),workspaceBefore[row.path]);};
 const verify=async(name,expected,stateResult=expected==='saved')=>{phase=name;const result=await coordinator.decide(input(rows[name]),assertLease);assert.equal(result.ok,stateResult,JSON.stringify(result));if(stateResult)assert.equal(result.value.state,expected);else assert.equal(result.error,expected);return result;};
 await check('host internal lease wiring; no IPC lease field',async()=>{
  const host=fs.readFileSync(path.join(desktop,'src/main/xiaozhi-agent/production-host.ts'),'utf8');assert.match(host,/recoverPaperDraft:createOfficePaperRecovery\(store\)/);assert.match(host,/withLocalSettingsJob\(async assertCurrent=>\{assertCurrent\(\);return officeArtifacts\.decide\(input,assertCurrent\);\}\)/);
  assert(!fs.readFileSync(path.join(desktop,'src/shared/xiaozhi-office-artifacts.ts'),'utf8').includes('recoveryLease'));
 });
 await check('C2 direct verify without idle lease fails closed even with valid bytes',async()=>{await assert.rejects(()=>service.decide(input(rows.idle)),/permission_denied/);await unchanged(rows.idle);});
 await check('idle recovery lease never grants active export installation',async()=>{await assert.rejects(()=>service.apply(session,rows.busy.id),/permission_denied/);await unchanged(rows.busy);});
 await check('cold idle: exact source and fact/lineage use same native writer; parent untouched',async()=>{
  const parentTransition=store.xiaozhiState.officeArtifacts.transition;store.xiaozhiState.officeArtifacts.transition=()=>{throw Error('Outer ledger writer touched');};
  try{sqlEvents=[];sourceReads=[];const before=authorityChecks;await verify('idle','saved');assert(authorityChecks-before>=4);
   assert.equal(sourceReads.filter(r=>r.phase==='idle').length,2);assert(sourceReads.every(r=>r.sourceCurrent));
   const ids=new Set(sqlEvents.filter(e=>e.phase==='idle').map(e=>e.connection));assert.equal(ids.size,1,'Source SELECT and fact UPDATE must share one native connection');
   assert(sqlEvents.some(e=>e.sql.startsWith('UPDATE xiaozhi_pi_office_drafts SET state=')));
   const fact=(await store.all('SELECT * FROM document_artifacts WHERE id=?',[rows.idle.artifactId]))[0],lineage=(await store.all('SELECT * FROM document_artifact_paper_sources WHERE draft_id=?',[rows.idle.id]))[0];assert.equal(fact.content_hash,workspaceBefore[rows.idle.path]);assert.equal(lineage.paper_id,paper.id);assert.equal(lineage.paper_digest,paper.digest);
  }finally{store.xiaozhiState.officeArtifacts.transition=parentTransition;}
 });
 await check('running conflict rejects idle recovery without publishing',async()=>{running=true;try{await verify('busy','busy');}finally{running=false;}await unchanged(rows.busy);});
 await check('expired lease rejects recovery',async()=>{lease=false;try{await verify('busy','busy');}finally{lease=true;}await unchanged(rows.busy);});
 await check('authority revoked rejects recovery without file effects',async()=>{authorized=false;try{await verify('authority','permission_denied');}finally{authorized=true;}await unchanged(rows.authority);});
 await check('hash mismatch records conflict and preserves changed file',async()=>{fs.writeFileSync(path.join(workspace,rows.hash.path),'external owned edit');await verify('hash','conflict',true);assert.equal(fs.readFileSync(path.join(workspace,rows.hash.path),'utf8'),'external owned edit');assert.equal((await store.all('SELECT count(*) AS n FROM document_artifacts WHERE id=?',[rows.hash.artifactId]))[0].n,0);});
 await check('stale revision cannot publish',async()=>{const result=await coordinator.decide({...input(rows.revision),revision:rows.revision.revision-1},assertLease);assert.equal(result.error,'conflict');await unchanged(rows.revision);});
 await check('authority loss after actual fact UPDATE rolls back fact and lineage',async()=>{afterFact=async()=>{authorized=false;};try{await verify('rollback-authority','permission_denied');}finally{afterFact=async()=>{};authorized=true;}await unchanged(rows['rollback-authority']);});
 await check('closing after actual fact UPDATE rolls back fact and lineage',async()=>{afterFact=async()=>{closing=true;};try{await verify('rollback-lease','busy');}finally{afterFact=async()=>{};closing=false;}await unchanged(rows['rollback-lease']);});
 await check('output bytes changed after fact UPDATE roll back saved without rewriting file',async()=>{
  const row=rows['rollback-hash'],file=path.join(workspace,row.path);afterFact=async()=>{fs.writeFileSync(file,'late external edit');};try{await verify('rollback-hash','conflict');}finally{afterFact=async()=>{};}
  assert.equal((await store.xiaozhiState.officeArtifacts.get(row.id)).state,'uncertain');assert.equal((await store.all('SELECT count(*) AS n FROM document_artifacts WHERE id=?',[row.artifactId]))[0].n,0);assert.equal((await store.all('SELECT count(*) AS n FROM document_artifact_paper_sources WHERE draft_id=?',[row.id]))[0].n,0);assert.equal(fs.readFileSync(file,'utf8'),'late external edit');
 });
 await check('shutdown after COMMIT before connection close returns durable saved once; no publish or file replay',async()=>{
  const row=rows['post-commit'],emitted=publishes,generated=generations;try{await verify('post-commit','saved');assert(closing,'Native COMMIT barrier must have invalidated the lease');}finally{closing=false;phase='after-post-commit';}
  const saved=await store.xiaozhiState.officeArtifacts.get(row.id);assert.equal(saved.state,'saved');assert.equal(saved.revision,row.revision+1);
  for(const [table,column,value]of [['document_artifacts','id',row.artifactId],['document_artifact_paper_sources','draft_id',row.id]])assert.equal((await store.all(`SELECT count(*) AS n FROM ${table} WHERE ${column}=?`,[value]))[0].n,1);
  assert.equal(publishes,emitted);assert.equal(generations,generated);assert.equal(sha(fs.readFileSync(path.join(workspace,row.path))),workspaceBefore[row.path]);
  const duplicate=await coordinator.decide(input(row),assertLease);assert.equal(duplicate.error,'conflict');assert.equal((await store.xiaozhiState.officeArtifacts.get(row.id)).revision,saved.revision);
 });
 await check('actual source bytes changed before verify reject; original stamp unchanged',async()=>{fs.writeFileSync(sourceFile,sourceText+'\nchanged');try{await verify('source','conflict');await unchanged(rows.source);}finally{fs.writeFileSync(sourceFile,sourceText);}assert.equal((await store.papers.review(session,paper.id)).sourceCurrent,true);});
 await check('source bytes changed after actual fact UPDATE reject and atomically roll back',async()=>{afterFact=async()=>{fs.writeFileSync(sourceFile,sourceText+'\nlate-change');};try{await verify('rollback-source','conflict');}finally{afterFact=async()=>{};}await unchanged(rows['rollback-source']);assert(sourceReads.some(r=>r.phase==='rollback-source'&&!r.sourceCurrent));});
 report.sourceReads=sourceReads;report.lastTransactionSql=sqlEvents;report.fixture={session,paperId:paper.id,sourceFile,sourceVersion:version,workspace};report.success=report.checks.every(c=>c.status==='PASS');if(!report.success)process.exitCode=1;
}catch(error){report.fatal=String(error.stack);process.exitCode=1;console.error(error);}
finally{try{await store?.close();}catch(e){report.closeError=String(e);process.exitCode=1;}clearTimeout(watchdog);persist();console.log(JSON.stringify({success:report.success,pass:report.checks.filter(c=>c.status==='PASS').length,fail:report.checks.filter(c=>c.status==='FAIL').length,output}));}
