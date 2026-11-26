import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain} from '../acceptance/build-root.mjs';

const [build, acceptance, mode] = process.argv.slice(2);
assert([build,acceptance].every(item=>item&&path.isAbsolute(item)), 'Pass the real desktop build and isolated acceptance root');
assert(!mode||mode==='--owner-cycles','Unknown fixture argument');
const main = fs.realpathSync(path.join(build,'main/index.js'));
const vectorWorker = fs.realpathSync(path.join(build,'main/retrieval-worker.js'));
const root = fs.mkdtempSync(path.join(fs.realpathSync(acceptance),'provider-vector-recovery-'));
const desktop = path.resolve(build,'../..'), profile=path.join(root,'profile'), data=path.join(root,'data'), sources=path.join(root,'sources');
fs.mkdirSync(sources);
const file = name=>path.join(root,name);
const checksum = value=>createHash('sha256').update(value).digest('hex');
const hash = item=>checksum(fs.readFileSync(item));
const report = {success:false, checks:[], paidCalls:0, root, mainHash:hash(main), workerHash:hash(vectorWorker),cycles:[]};
const query = '给定两条互相垂直的边长，怎么算三角形剩下一条边？';
const timeoutQuery = query+'请说明计算思路。';
const expectedSource = '几何习题.md', fixtureCount = 25;
fs.writeFileSync(path.join(sources,expectedSource),'# 勾股定理\n已知直角三角形的两直角边为3厘米和4厘米，求斜边长。\n勾股定理给出斜边为5厘米。');
for(let n=1;n<fixtureCount;n++) fs.writeFileSync(path.join(sources,`植物资料-${n}.md`),
  `# 植物与生态 ${n}\n叶绿体借助阳光将水和二氧化碳转化为有机物。探究植物蒸腾和生态环境。`);
let app,page;

async function until(label, read, timeout=45000) {
  const deadline=performance.now()+timeout;
  do {const current=await read();if(current)return current;await delay(100);}while(performance.now()<deadline);
  throw Error('Timed out waiting for '+label);
}
function sql(work) {
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return work(db);}finally{db.close();}
}
const generation = id=>sql(db=>db.prepare('SELECT * FROM retrieval_generations WHERE id=?').get(id));
const sourceFacts = ()=>sql(db=>checksum(JSON.stringify(['teacher_resources','resource_chunks','question_bank_items']
  .map(table=>db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()))));
const status = ()=>page.evaluate(()=>window.omniEdu.getRetrievalStatus());
const trace = async()=>JSON.parse(await app.evaluate(()=>JSON.stringify(globalThis.providerVectorRecovery)));
function native() {
  const location=file('embedding-trace.jsonl');
  if(!fs.existsSync(location))return [];
  const text=fs.readFileSync(location,'utf8');
  return text.slice(0,text.lastIndexOf('\n')+1).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
}
function gone(pid) {
  try{process.kill(pid,0);return false;}catch(error){if(error.code==='ESRCH')return true;throw error;}
}
const search = (mode='hybrid', text=query)=>page.evaluate(({mode,text})=>window.omniEdu.searchMaterialText({
  schemaVersion:'xiaozhi.material-search.v1',query:text,offset:0,mode}),{mode,text});
function comparison(result) {
  return {coverage:result.semantic, hits:result.hits.slice(0,10).map(hit=>({title:hit.title, method:hit.method, source:hit.source}))};
}
function compareSource(result, baseline, expectedGeneration) {
  assert.equal(result.semantic.generation,expectedGeneration);
  assert.equal(result.semantic.available,true);
  assert.equal(result.semantic.complete,true);
  assert.equal(result.hits[0]?.title,expectedSource);
  assert.notEqual(result.hits[0].method,'keyword');
  assert.equal(result.hits[0].source.resourceId,baseline.hits[0].source.resourceId);
  assert.equal(result.hits[0].source.chunkId,baseline.hits[0].source.chunkId);
}

try {
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(key)));
  Object.assign(env,{OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'), OMNI_EDU_DATA_ROOT:data, OMNI_EDU_SKIP_DOTENV:'1',
    OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_VECTOR_EVIDENCE_ROOT:root,OMNI_EDU_VECTOR_EVIDENCE_MAIN:main,
    TEMP:root,TMP:root});
  const boot=path.resolve(import.meta.dirname,'fixtures/vector-recovery-main.cjs');
  app=await electron.launch({args:[boot,'--user-data-dir='+profile],cwd:root,env,timeout:60000});
  await assertIsolatedPiMain(app,main,profile);
  page=await app.firstWindow();
  await page.locator('[data-testid="nav-knowledge"]:visible').click();
  await app.evaluate(({dialog},folder)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[folder]});},sources);
  await page.getByTestId('materials-import-folder').click();
  const ready=await until('actual active generation and clean corpus',async()=>{
    const current=await status();
    return current.generation&&!current.building&&!current.pending&&!current.error&&current.indexed>=fixtureCount&&current;
  },160000);
  const first=await search(), before=sourceFacts(), active=ready.generation;
  const timeoutBaseline=await search('hybrid',timeoutQuery);
  const literal=await search('keyword');
  assert.equal(literal.hits.length,0);
  assert(first.hits[0]?.source.resourceId&&first.hits[0]?.source.chunkId);
  compareSource(first,first,active);
  compareSource(timeoutBaseline,first,active);
  assert.equal((await search('keyword',timeoutQuery)).hits.length,0);
  report.baseline={active:generation(active), facts:before, search:comparison(first), timeoutSearch:comparison(timeoutBaseline), lexicalHits:literal.hits.length};
  report.checks.push('An owned real active index finds the original geometry source by meaning, with no matching keyword result');

  const queue=page.getByTestId('materials-queue-toggle');
  if(await queue.getAttribute('aria-expanded')!=='true')await queue.click();
  const controls=page.getByTestId('materials-diagnostics').getByRole('button',{name:'题库归档与检索状态'});
  if(await controls.getAttribute('aria-expanded')!=='true')await controls.click();
  async function verifyVectorOwner(active) {
    await app.evaluate((_,active)=>globalThis.armProviderVectorRebuild(active),active);
    await page.getByTestId('retrieval-rebuild').click();
    const crash=await until('the utility process produces a real second-batch reply',async()=> (await trace()).crash,65000);
    assert(crash.ok&&crash.pid&&!gone(crash.pid));
    assert.notEqual(crash.generation,active);
    const checkpoint=generation(crash.generation);
    assert(checkpoint.material_cursor&&checkpoint.material_cursor!=='~'&&!checkpoint.backfill_done);
    assert.equal((await status()).generation,active);
    await app.evaluate(()=>globalThis.crashProviderVector());
    const retired=await until('old utility exits at the original failed batch',async()=>{
      const worker=(await trace()).workers.find(item=>item.instance===crash.worker);
      return worker?.closed&&gone(worker.pid)&&worker;
    });
    const stable=await until('a restarted owner can still query the published index',async()=>{
      const current=await search();
      return current.semantic.available&&current;
    },35000);
    compareSource(stable,first,active);
    assert.equal(sourceFacts(),before);
    const replacement=await until('the new utility returns the outstanding backfill batch',async()=> (await trace()).replacement,65000);
    assert(replacement.ok&&replacement.pid!==crash.pid&&replacement.worker!==crash.worker);
    assert.equal(replacement.generation,crash.generation);
    assert.deepEqual(replacement.ids,crash.ids);
    assert.equal(generation(crash.generation).material_cursor,checkpoint.material_cursor);
    await app.evaluate(()=>globalThis.deliverObsoleteProviderVector());
    assert((await trace()).oldDelivered);
    assert.equal(generation(crash.generation).material_cursor,checkpoint.material_cursor);
    assert.equal((await status()).generation,active);
    await app.evaluate(()=>globalThis.releaseProviderVectorReplacement());
    const rebuilt=await until('the same target generation is actually published',async()=>{
      const current=await status();
      return current.generation===crash.generation&&!current.building&&!current.pending&&!current.error&&current;
    },140000);
    const after=await search();
    compareSource(after,first,rebuilt.generation);
    const finished=generation(rebuilt.generation);
    assert(finished.backfill_done&&finished.material_cursor==='~'&&finished.question_cursor==='~');
    assert.equal(finished.applied_seq,sql(db=>db.prepare('SELECT MAX(seq) n FROM retrieval_changes').get().n));
    assert.equal(finished.indexed,ready.indexed);
    assert.equal(sourceFacts(),before);
    return {crash,retired,checkpoint,replacement,finished,beforePublish:comparison(stable),afterPublish:comparison(after)};
  }

  async function verifyEmbeddingOwner(generationId,indexed) {
    const firstTraceIndex=native().length;
    const evidence=()=>native().slice(firstTraceIndex);
    fs.writeFileSync(file('hold-next-query'),'hold',{flag:'wx'});
    // This query was measured before the original utility exited. Its vector is
    // absent from the replacement utility's in-memory query cache.
    const pending=search('hybrid',timeoutQuery);
    void pending.catch(()=>undefined);
    const delayed=await until('the actual ONNX result is received but held on its original stdout',()=>evidence().find(event=>event.event==='native_reply_held'));
    assert(delayed.pid&&!gone(delayed.pid));
    const stopped=await until('the full production embedding timeout asks the old child to stop',()=>evidence().find(event=>event.event==='kill_requested'&&event.request===delayed.request));
    const dispatched=evidence().find(event=>event.event==='query_dispatched'&&event.request===delayed.request);
    assert(stopped.at-dispatched.at>=29000);
    const fallback=await pending;
    assert.equal(fallback.semantic.generation,generationId);
    assert.equal(fallback.semantic.available,false);
    assert.equal(fallback.semantic.complete,false);
    assert.equal(fallback.semantic.reason,'embedding_unavailable');
    assert.equal(fallback.hits.length,0);
    assert(!gone(delayed.pid));
    const keywordFallback=await search('keyword','勾股定理');
    assert(keywordFallback.hits.some(hit=>hit.title===expectedSource));
    fs.writeFileSync(file('deliver-late-embedding'),'send',{flag:'wx'});
    const late=await until('a real obsolete native embedding reply enters the old pipe',()=>evidence().find(event=>event.event==='late_native_reply_delivered'));
    assert(late.bytes>0&&late.pid===delayed.pid);
    const attempts=native().filter(event=>event.event==='spawn').length;
    const requests=(await trace()).requests.filter(request=>request.operation==='query').length;
    let settled=false;
    const queryAgain=search('hybrid',timeoutQuery).then(result=>{settled=true;return result;});
    void queryAgain.catch(()=>undefined);
    await until('a new foreground query reaches the actual retrieval worker',async()=> (await trace()).requests.filter(request=>request.operation==='query').length>requests);
    assert(!settled&& !gone(delayed.pid));
    assert.equal(native().filter(event=>event.event==='spawn').length,attempts);
    fs.writeFileSync(file('release-old-embedding'),'release',{flag:'wx'});
    const resumed=await queryAgain;
    compareSource(resumed,timeoutBaseline,generationId);
    const nativeTrace=evidence();
    const closed= nativeTrace.find(event=>event.event==='close'&&event.pid===delayed.pid&&event.at>=stopped.at);
    const newChild=nativeTrace.find(event=>event.event==='spawn'&&event.pid!==delayed.pid&&event.at>=stopped.at);
    assert(closed&&newChild&&gone(delayed.pid)&&closed.at<=newChild.at);
    assert.equal(sourceFacts(),before);
    assert.equal(generation(generationId).indexed,indexed);
    for(const flag of ['owned-query-marker','deliver-late-embedding','release-old-embedding'])fs.unlinkSync(file(flag));
    return {dispatched,delayed,stopped,late,closed,newChild,degraded:comparison(fallback),resumed:comparison(resumed)};
  }

  let generationId=active;
  for(let ordinal=1;ordinal<=(mode?10:1);ordinal++){
    const cycle={ordinal};
    report.cycles.push(cycle);
    cycle.vector=await verifyVectorOwner(generationId);
    generationId=cycle.vector.crash.generation;
    cycle.embedding=await verifyEmbeddingOwner(generationId,cycle.vector.finished.indexed);
    assert(!report.cycles.slice(0,-1).some(prior=>prior.vector.crash.request===cycle.vector.crash.request||
      prior.vector.crash.worker===cycle.vector.crash.worker||prior.embedding.delayed.request===cycle.embedding.delayed.request));
    const workers=(await trace()).workers;
    assert.deepEqual(workers.filter(worker=>!worker.closed).map(worker=>worker.instance),[cycle.vector.replacement.worker]);
  }
  report.vector=report.cycles[0].vector;
  report.embedding=report.cycles[0].embedding;
  report.checks.push('A real utility exit and its obsolete reply cannot move the original cursor or publish the new index before the same batch is rerun');
  report.checks.push('A real embedding timeout exposes degraded search and a fresh native process resumes the same correct source only after old close');
  report.success=true;
}catch(error){
  report.error=String(error.stack??error);
  process.exitCode=1;
  if(app)report.lastState=await status().catch(()=>undefined);
}finally{
  if(app){
    report.trace=await trace().catch(()=>undefined);
    await app.close().catch(()=>undefined);
  }
  report.native=native();
  fs.writeFileSync(file('report.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({success:report.success,root,checks:report.checks,error:report.error}));
}
