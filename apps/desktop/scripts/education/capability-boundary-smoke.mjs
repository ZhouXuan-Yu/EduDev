import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';
import {createAssistantMessageEventStream} from '@earendil-works/pi-ai';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
// Boundary suite never performs extraction; Electron file host is not available in Node.
registerHooks({resolve(specifier,context,next){if(specifier==='electron')return {url:'data:text/javascript,export const utilityProcess={};',shortCircuit:true};return next(specifier,context);}});
const {matchMaterialQuote,searchMaterialUnits}=await import('../../src/main/education/reading-host.ts');
const {createEducationSearchTools}=await import('../../src/main/education/search-provider.ts');
const {MaterialRepository}=await import('../../src/main/assets/material-repository.ts');
const {validMaterialSource}=await import('../../src/shared/materials.ts');
const {createEducationCapabilityProvider}=await import('../../src/main/education/capability-provider.ts');
const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
const {createHanaRunToolScope}=await import('../../src/main/xiaozhi-agent/hana-tool-scope.ts');
const {studentContextBoundaries}=await import('./student-context-boundaries.mjs');
const {learningBoundaries}=await import('./learning-boundaries.mjs');
const {learningReviewBoundaries,learningReviewNativeBoundaries}=await import('./learning-review-boundaries.mjs');
const {piPackageBoundaries}=await import('./pi-package-boundaries.mjs');
const {questionContextBoundaries}=await import('./question-context-boundaries.mjs');
const {questionDraftBoundaries}=await import('./question-draft-boundaries.mjs');
const {questionReviewBoundaries}=await import('./question-review-boundaries.mjs');
const {practiceReviewBoundaries}=await import('./practice-review-boundaries.mjs');
const {mistakeOcrBoundaries}=await import('./mistake-ocr-boundaries.mjs');
const output=fs.mkdtempSync(path.resolve('test-results/education-boundary-')),workspace=path.join(output,'workspace'),stateRoot=path.join(output,'state');fs.mkdirSync(workspace);fs.mkdirSync(stateRoot);
const checks=[],report={success:false,checks,scope:'Real original Python worker and native Pi identity; synthetic owned facts, no model request'};let agent;
const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log(`PASS ${name}`);};
const signal=()=>new AbortController().signal;
const resourceId=`resource_${randomUUID()}`,version=createHash('sha256').update('saved synthetic body').digest('hex');let current=true,reads=0,bodyText='直角三角形满足 a²+b²=c²。 The hypotenuse is the longest side.',privateBody=false,actualVersion=version;
const store={sanitizeProblemText:async text=>({sanitizedText:text.replace(/13800138000/g,'[手机号]')}),listStudents:async()=>[{realName:'合成隐私张甲'}],materials:{body:async()=>{reads++;return{resource:{originalFileName:'勾股定理.md',contentHash:actualVersion,parseStatus:'ready'},chunks:[{chunkIndex:0,contentMd:bodyText,containsPersonalData:privateBody}],total:1};},resource:async()=>({contentHash:actualVersion,parseStatus:'ready'})}};
const tools=createEducationCapabilityProvider(store,()=>current).tools;
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,title TEXT,original_file_name TEXT,content_hash TEXT,parse_status TEXT); CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,content_md TEXT,contains_personal_data INTEGER);');
const put=(id,index,text,privacy=0)=>{const chunkId='chunk_'+randomUUID();db.prepare('INSERT INTO resource_chunks VALUES(?,?,?,?,?)').run(chunkId,id,index,text,privacy);return chunkId;};
const resources=[];for(let index=0;index<60;index++){const id='resource_'+randomUUID();resources.push(id);db.prepare('INSERT INTO teacher_resources VALUES(?,?,?,?,?)').run(id,'本地教学','教材.md',version,'ready');put(id,0,'基础资料关键词 alpha');}
const target=resources[59],tail=put(target,99,'alpha beta；尾段证据',0);put(target,100,'合成隐私张甲 13800138000 alpha beta',1);put(target,101,'已脱敏合成隐私张甲 联系13800138000',0);
const repo=new MaterialRepository({root:output,all:async(sql,params=[])=>db.prepare(sql).all(...params),mapResource:row=>({id:row.id,contentHash:row.content_hash,originalFileName:row.original_file_name,parseStatus:row.parse_status,chunkCount:Number(row.chunk_count)}),mapChunk:row=>({id:row.id,resourceId:row.resource_id,chunkIndex:row.chunk_index,contentMd:row.content_md,containsPersonalData:!!row.contains_personal_data})});
const searchStore={...store,materials:repo},searchTools=createEducationSearchTools(searchStore,()=>current),search=async(query,extra={})=>searchTools[0].execute(randomUUID(),{query,...extra},signal());
const execute=async(quote,extra={})=>tools[0].execute(randomUUID(),{resourceId,offset:0,version,quote,...extra},signal());
const payload=result=>JSON.parse(result.content[0].text);
async function prime(){agent.session.agent.streamFn=model=>{const stream=createAssistantMessageEventStream();stream.push({type:'done',reason:'stop',message:{role:'assistant',api:model.api,provider:model.provider,model:model.id,content:[{type:'text',text:'合成基线'}],stopReason:'stop',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}});stream.end();return stream;};assert((await agent.prompt('合成原生基线')).ok);}
globalThis.fetch=async()=>{throw new Error('Network disabled in boundary suite');};
try{
 await check('Vendored originals and bundled assets match fixed manifest; no second runtime source',async()=>{
  const root=path.resolve('src/main/education/vendor/deeptutor-reading'),manifest=JSON.parse(fs.readFileSync(path.join(root,'source-manifest.json')));assert.equal(manifest.revision,'f07029cfcf2c8dfccdb671cdfc343db8334f5741');
  for(const file of manifest.files){const bytes=fs.readFileSync(path.join(root,file.destination));assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);assert(bytes.equals(fs.readFileSync(path.resolve('out/main/vendor/deeptutor-reading',file.destination))));}
  assert(fs.readFileSync('out/main/reading-worker.py').equals(fs.readFileSync('src/main/education/reading-worker.py')));
 });
 await check('Actual unmodified matcher verifies Chinese, mathematical and case-insensitive exact quotes',async()=>{
  for(const [text,quote]of [['勾股关系 a²+b²=c²','a²+b²=c²'],['The HYPOTENUSE is long','the hypotenuse'],['直角三角形面积','直角三角形']])assert.deepEqual(await matchMaterialQuote(text,quote,signal()),{found:true,mode:'exact'});
 });
 await check('Normalised matching preserves upstream whitespace semantics; unrelated text never becomes semantic evidence',async()=>{
  assert.deepEqual(await matchMaterialQuote('the\n hypotenuse— is long','the hypotenuse is long',signal()),{found:true,mode:'normalised'});
  assert.deepEqual(await matchMaterialQuote('面积等于底乘高除以二','斜边为十',signal()),{found:false,mode:null});
  // Chinese removed line breaks are not equivalent to a whitespace-free quote upstream.
  assert.equal((await matchMaterialQuote('直角\n三角形','直角三角形',signal())).found,false);
  await assert.rejects(matchMaterialQuote('some text','。“”',signal()),/invalid_input/);
 });
 await check('Actual worker has bounded inputs, unavailable failure, and mid-flight cancellation without body leakage',async()=>{
  await assert.rejects(matchMaterialQuote('x'.repeat(12001),'x',signal()),/invalid_input/);
  const abort=new AbortController(),pending=matchMaterialQuote('真实正文','正文',abort.signal);abort.abort();await assert.rejects(pending,/cancelled/);
  const before=process.env.OMNI_EDU_PYTHON;process.env.OMNI_EDU_PYTHON=path.join(output,'missing-python.exe');try{await assert.rejects(matchMaterialQuote('真实正文','正文',signal()),/unavailable/);}finally{before===undefined?delete process.env.OMNI_EDU_PYTHON:process.env.OMNI_EDU_PYTHON=before;}
 });
 await check('Pi tool rejects paths, arbitrary scope, fractional offsets and invalid versions before repository access',async()=>{
  for(const extra of [{path:'secret'},{resourceId:'../../secret'},{offset:-1},{offset:.5},{version:'latest'},{studentId:'private'},{quote:'x'.repeat(2001)}])assert((await execute('三角形',extra)).isError);assert.equal(reads,0);
 });
 await check('Cancelled/revoked tool cannot read repository; version change cannot deliver stale evidence',async()=>{
  current=false;assert.equal((await execute('三角形')).details.error.code,'permission_denied');current=true;
  const abort=new AbortController();abort.abort();assert.equal((await tools[0].execute('cancelled',{resourceId,offset:0,version,quote:'三角形'},abort.signal)).details.error.code,'cancelled');assert.equal(reads,0);
  actualVersion='f'.repeat(64);assert.equal((await execute('三角形')).details.error.code,'source_changed');actualVersion=version;
  const original=store.materials.resource;store.materials.resource=async()=>({contentHash:'f'.repeat(64),parseStatus:'ready'});assert.equal((await execute('三角形')).details.error.code,'source_changed');store.materials.resource=original;
  const originalBody=store.materials.body;let count=0;store.materials.body=async()=>{const result=await originalBody();if(++count===2)result.chunks[0].contentMd='重解析后的不同正文';return result;};assert.equal((await execute('三角形')).details.error.code,'source_changed');store.materials.body=originalBody;
 });
 await check('Existing education redaction blocks named/student/private quote evidence',async()=>{
  bodyText='合成隐私张甲 电话13800138000 学习直角三角形';
  for(const q of ['合成隐私张甲','13800138000','[手机号]']){const result=await execute(q);assert(result.isError);assert(!JSON.stringify(result).includes('13800138000'));assert(!JSON.stringify(result).includes('合成隐私张甲'));}
  privateBody=true;assert.equal((await execute('直角三角形')).details.error.code,'private_content');privateBody=false;
 });
 await check('Real tool receipt reports exact/found-false scope honestly, with no pages or teacher confirmation',async()=>{
  const yes=payload(await execute('直角三角形'));assert.equal(yes.found,true);assert.equal(yes.mode,'exact');assert.equal(yes.originalPageLocated,false);assert.equal(yes.teacherConfirmed,false);assert.equal(yes.version,version);assert(!JSON.stringify(yes).includes('合成隐私张甲'));
  const no=payload(await execute('斜边为三十'));assert.equal(no.found,false);assert.equal(no.mode,null);
 });
 await check('Hana execution-once prevents duplicate same-call reading; conflicting repeat is rejected',async()=>{
  const wrapped=createHanaRunToolScope(tools)[0],before=reads,args={resourceId,offset:0,version,quote:'直角三角形'};
  const one=await wrapped.execute('same',args,signal()),two=await wrapped.execute('same',args,signal());assert.deepEqual(one,two);assert.equal(reads-before,2);assert((await wrapped.execute('same',{...args,quote:'other'},signal())).isError);assert.equal(reads-before,2);
 });
 const options={stateRoot,workspace,apiKey:'synthetic-boundary-not-a-key',model:'deepseek-chat',approveCopy:async()=>false};
 await check('Actual native old session adds reading marker, preserves original bytes and rejects missing capability',async()=>{
  agent=await createPiXiaozhiSession(options);await prime();const manager=agent.session.sessionManager,file=manager.getSessionFile(),prefix=fs.readFileSync(file),snapshot=manager.getEntries().find(e=>e.customType==='xiaozhi.education.snapshot.v1');await agent.dispose();
  agent=await createPiXiaozhiSession({...options,sessionFile:file,educationCapabilityTools:tools});assert(fs.readFileSync(file).subarray(0,prefix.length).equals(prefix));assert.deepEqual(agent.session.sessionManager.getEntries().find(e=>e.customType==='xiaozhi.education.snapshot.v1'),snapshot);assert(agent.session.getActiveToolNames().includes('education_verify_material_quote'));assert.equal(agent.session.sessionManager.getEntries().filter(e=>e.customType==='xiaozhi.education.deeptutor-reading.v1').length,1);await agent.dispose();agent=undefined;
  await assert.rejects(createPiXiaozhiSession({...options,sessionFile:file}),/configuration/);
 });
 await check('Unknown native education revision or substituted tools fail closed',async()=>{
  await assert.rejects(createPiXiaozhiSession({...options,educationCapabilityTools:[{...tools[0],name:'read_any_file'}]}),/configuration/);
  agent=await createPiXiaozhiSession({...options,educationCapabilityTools:tools});await prime();agent.session.sessionManager.appendCustomEntry('xiaozhi.education.deeptutor-reading.v2',{});const file=agent.session.sessionManager.getSessionFile();await agent.dispose();agent=undefined;await assert.rejects(createPiXiaozhiSession({...options,sessionFile:file,educationCapabilityTools:tools}),/configuration/);
 });
 await check('Actual SQLite snapshot searches beyond 50 resources and handles sparse chunk indexes using true offsets',async()=>{
  const all=await repo.readingSnapshot();assert.equal(all.units.length,63);assert.equal(new Set(all.units.map(u=>u.resourceId)).size,60);
  const value=payload(await search('alpha beta'));assert.equal(value.mode,'exact');assert.equal(value.hits.length,1);assert.equal(value.hits[0].resourceId,target);assert.equal(value.hits[0].offset,1);assert.equal(value.coverage.searchedChunks,62);assert.equal(value.coverage.excludedPrivateChunks,1);assert.equal(value.coverage.complete,true);assert(validMaterialSource(value.hits[0].source));
  const view=await repo.source(value.hits[0].source);assert.equal(view.body.chunks[0].id,tail);assert.equal(view.body.chunks[0].chunkIndex,99);
  const selected=payload(await search('alpha beta',{resourceId:target}));assert.equal(selected.coverage.scope,'material');assert.equal(selected.coverage.totalChunks,4);
 });
 await check('Original search preserves global exact precedence, normalised matching, terms ranking and honest 12-hit truncation',async()=>{
  const exact=await searchMaterialUnits(['alpha is here','beta here',...Array(60).fill('unrelated'),'alpha beta'],'alpha beta',signal());assert.equal(exact.mode,'exact');assert.equal(exact.hits[0].locator,62);
  assert.equal((await searchMaterialUnits(['alpha\n beta— is long'],'alpha beta is long',signal())).mode,'normalised');
  const terms=await searchMaterialUnits(['alpha alone','beta alone','alpha elsewhere beta'],'alpha beta gamma',signal());assert.equal(terms.mode,'terms');assert.equal(terms.hits[0].locator,2);
  const many=await searchMaterialUnits(Array(20).fill('alpha'),'alpha',signal());assert.equal(many.hits.length,12);assert.equal(many.truncated,true);
  const empty=await searchMaterialUnits(['different'],'opaqueunique',signal());assert.deepEqual(empty,{hits:[],mode:null,truncated:false});
 });
 await check('Full search rejects private queries, masks known names/contacts, and excludes failed bodies from coverage',async()=>{
  for(const query of ['合成隐私张甲','13800138000','[学生姓名]'])assert.equal((await search(query)).details.error.code,'private_content');
  const masked=await search('已脱敏');assert(!JSON.stringify(masked).includes('合成隐私张甲'));assert(!JSON.stringify(masked).includes('13800138000'));
  db.prepare('UPDATE teacher_resources SET parse_status=? WHERE id=?').run('failed',target);assert.equal(payload(await search('alpha beta')).mode,'terms');assert.equal(payload(await search('alpha beta')).coverage.resources,59);db.prepare('UPDATE teacher_resources SET parse_status=? WHERE id=?').run('ready',target);
 });
 await check('Structured teacher source rejects arbitrary fields, stale source versions and modified same-version derivatives',async()=>{
  const source=payload(await search('alpha beta')).hits[0].source;assert(!validMaterialSource({...source,path:'../../secret'}));assert(!validMaterialSource({...source,chunkId:'arbitrary'}));
  await assert.rejects(repo.source({...source,version:'f'.repeat(64)}),/source_changed/);
  db.prepare('UPDATE resource_chunks SET content_md=? WHERE id=?').run('新的正文',tail);await assert.rejects(repo.source(source),/source_changed/);db.prepare('UPDATE resource_chunks SET content_md=? WHERE id=?').run('alpha beta；尾段证据',tail);
 });
 await check('Changed snapshot during worker execution cannot deliver results; revoked/cancelled scopes do not read',async()=>{
  const original=repo.readingSnapshot.bind(repo);let count=0;repo.readingSnapshot=async id=>{const value=await original(id);if(++count===2)value.fingerprint='changed';return value;};assert.equal((await search('alpha beta')).details.error.code,'source_changed');repo.readingSnapshot=original;
  current=false;assert.equal((await search('alpha beta')).details.error.code,'permission_denied');current=true;
  const abort=new AbortController();abort.abort();assert.equal((await searchTools[0].execute('stop',{query:'alpha'},abort.signal)).details.error.code,'cancelled');
  for(const extra of [{path:'secret'},{resourceId:'../secret'},{offset:0},{query:'x'.repeat(129)}])assert.equal((await search('alpha',extra)).details.error.code,'invalid_input');
 });
 await check('Oversized library fails explicitly instead of silently skipping unsearched paragraphs',async()=>{
  const sql=repo.readingSnapshot.bind(repo),all=async()=>{throw new Error('too_large');};repo.readingSnapshot=all;const result=await search('alpha');assert.equal(result.details.error.code,'too_large');assert(!result.details.data);repo.readingSnapshot=sql;
  const large=put(target,102,'x'.repeat(8*1024*1024+1));await assert.rejects(repo.readingSnapshot(),/too_large/);db.prepare('DELETE FROM resource_chunks WHERE id=?').run(large);
  db.exec('BEGIN');for(let index=0;index<20001;index++)put(target,102+index,'a');db.exec('COMMIT');await assert.rejects(repo.readingSnapshot(),/too_large/);db.prepare('DELETE FROM resource_chunks WHERE resource_id=? AND chunk_index>=102').run(target);
  await assert.rejects(searchMaterialUnits(Array(20001).fill('x'),'x',signal()),/invalid_input/);await assert.rejects(searchMaterialUnits(['x'.repeat(8*1024*1024+1)],'x',signal()),/invalid_input/);
  const abort=new AbortController(),pending=searchMaterialUnits(['alpha'],'alpha',abort.signal);abort.abort();await assert.rejects(pending,/cancelled/);await assert.rejects(searchMaterialUnits(['text'],'。“”',signal()),/invalid_input/);
 });
 await check('Old native session adds independent search marker without modifying quote identity or history; missing/unknown search fails',async()=>{
  const root=path.join(output,'search-native');fs.mkdirSync(root);agent=await createPiXiaozhiSession({...options,stateRoot:root,educationCapabilityTools:tools});await prime();const file=agent.session.sessionManager.getSessionFile(),prefix=fs.readFileSync(file),quoteMarker=agent.session.sessionManager.getEntries().find(e=>e.customType==='xiaozhi.education.deeptutor-reading.v1');await agent.dispose();
  agent=await createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file,educationCapabilityTools:tools,educationSearchTools:searchTools});assert(fs.readFileSync(file).subarray(0,prefix.length).equals(prefix));assert.deepEqual(agent.session.sessionManager.getEntries().find(e=>e.customType==='xiaozhi.education.deeptutor-reading.v1'),quoteMarker);assert(agent.session.getActiveToolNames().includes('education_search_materials'));await agent.dispose();agent=undefined;
  await assert.rejects(createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file,educationCapabilityTools:tools}),/configuration/);
  await assert.rejects(createPiXiaozhiSession({...options,stateRoot:root,educationSearchTools:[{...searchTools[0],name:'read_anything'}]}),/configuration/);
  agent=await createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file,educationCapabilityTools:tools,educationSearchTools:searchTools});agent.session.sessionManager.appendCustomEntry('xiaozhi.education.deeptutor-search.v2',{});await agent.dispose();agent=undefined;await assert.rejects(createPiXiaozhiSession({...options,stateRoot:root,sessionFile:file,educationCapabilityTools:tools,educationSearchTools:searchTools}),/configuration/);
 });
 await studentContextBoundaries(check,output,options,async native=>{agent=native;await prime();});agent=undefined;
 await learningBoundaries(check,output,options,async native=>{agent=native;await prime();});agent=undefined;
 await learningReviewBoundaries(check,output);
 await learningReviewNativeBoundaries(check,output,options,async native=>{agent=native;await prime();});agent=undefined;
 await piPackageBoundaries(check,output);
 await questionContextBoundaries(check,output,options,async native=>{agent=native;await prime();});agent=undefined;
 await questionDraftBoundaries(check,output);
 await questionReviewBoundaries(check,output,options,async native=>{agent=native;await prime();});agent=undefined;
 await practiceReviewBoundaries(check,output,options,async native=>{agent=native;await prime();});agent=undefined;
 await mistakeOcrBoundaries(check,output);
 report.success=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}
finally{await agent?.dispose();db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,error:report.error,report:path.join(output,'report.json')}));}
