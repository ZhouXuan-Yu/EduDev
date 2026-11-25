import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {cpus,platform,release} from 'node:os';
import {join,resolve} from 'node:path';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {withSql} from './db-foundation-r1-task-fixture.mjs';

const desktop=resolve(import.meta.dirname,'../..'),main=testMain(desktop);
const output=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||join(desktop,'test-results','xiaozhi-db-r3'));
for(const name of ['fixtures','evidence'])mkdirSync(join(output,name),{recursive:true});
const root=mkdtempSync(join(output,'fixtures','R3-history-performance-'));
const data=join(root,'data'),profile=join(root,'profile');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const contractFile=process.env.OMNI_EDU_R3_ACCEPTANCE_CONTRACT;
const contract=readFileSync(contractFile);
const ac=JSON.parse(contract.toString('utf8')).acceptance.find(item=>item.id==='AC-28');
const budget=Number(ac?.then.match(/P95[≤<=]+(\d+)ms/u)?.[1]);
assert(Number.isFinite(budget)&&budget>0);
const report={success:false,mainSha256:digest(readFileSync(main)),contractSha256:digest(contract),root,budgetMs:budget,
  environment:{platform:platform(),release:release(),cpu:cpus()[0].model,logicalCpus:cpus().length},samples:[]};
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',
  DEEPSEEK_API_KEY:'r3-perf-catalogue-key',GLM_API_KEY:'',DEEPSEEK_MODEL:'deepseek-flash'};
for(const name of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[name];
let app;
try{
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  await app.evaluate(({net},packageFile)=>{
    const sqlite=process.getBuiltinModule('module').createRequire(packageFile)('sqlite3');
    const fixture=globalThis.r3HistoryTrace={samples:[],loop:[],enabled:false,versions:process.versions,sqlite:sqlite.VERSION};
    const all=sqlite.Database.prototype.all;
    sqlite.Database.prototype.all=function(statement,...args){
      if(fixture.enabled&&/FROM xiaozhi_config_changes_v1 c WHERE/u.test(statement)&&typeof args.at(-1)==='function'){
        const callback=args.at(-1);
        const limit=args[0].at(-1),issued=performance.now();
        args[args.length-1]=function(error,rows){
          fixture.samples.push({statement,limit,count:rows?.length,sqlMs:performance.now()-issued,error:error?.code});
          return callback.call(this,error,rows);
        };
      }
      return all.call(this,statement,...args);
    };
    net.fetch=async input=>{
      if(!String(typeof input==='string'?input:input.url).endsWith('/models'))throw Error('Performance fixture only permits the catalogue');
      return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,
        input_modalities:['text'],effort:{supported_levels:['low','high','max'],default_level:'high'}}]}));
    };
  },join(desktop,'package.json'));
  const page=await app.firstWindow();
  await assertIsolatedPiMain(app,main,profile);
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  const settings=await page.evaluate(()=>window.omniEdu.getXiaozhiSettings({refresh:true}));
  assert.equal(settings.ok,true);assert.equal(settings.value.catalogueError,undefined);
  const seedMs=performance.now();
  for(let i=0;i<1000;i++){
    const result=await page.evaluate(input=>window.omniEdu.commitXiaozhiConfig(input),
      {operationId:randomUUID(),field:'global_thinking',expectedVersion:i,value:i%2===0?'low':'high'});
    assert(result.ok&&result.value.outcome==='committed'&&result.value.version===i+1,JSON.stringify(result));
  }
  report.seed={count:1000,elapsedMs:performance.now()-seedMs,
    dbRows:withSql(data,false,db=>db.prepare('SELECT count(*) AS n FROM xiaozhi_config_changes_v1').get().n)};
  assert.equal(report.seed.dbRows,1000);
  await app.evaluate(()=>{
    const trace=globalThis.r3HistoryTrace;
    trace.enabled=true;
    let last=performance.now();trace.timer=setInterval(()=>{const now=performance.now();trace.loop.push(Math.max(0,now-last-25));last=now;},25);
  });
  let cursor;
  for(let i=0;i<50;i++){
    const result=await page.evaluate(async cursor=>{
      const start=performance.now();
      const result=await window.omniEdu.getXiaozhiConfigHistory({field:'global_thinking',cursor});
      return {result,elapsedMs:performance.now()-start};
    },cursor);
    assert(result.result.ok);
    const value=result.result.value;
    assert.equal(value.items.length,20);
    assert.equal(value.items[0].version,1000-i*20);
    assert.equal(value.items.at(-1).version,981-i*20);
    cursor=value.cursor??undefined;
    report.samples.push({iteration:i,elapsedMs:result.elapsedMs,first:value.items[0].version,last:value.items.at(-1).version});
  }
  assert.equal(cursor,undefined);
  const trace=await app.evaluate(()=>{
    const {samples,loop,timer,versions,sqlite}=globalThis.r3HistoryTrace;clearInterval(timer);return {samples,loop,versions,sqlite};
  });
  assert.equal(trace.samples.length,50);
  assert(trace.samples.every(item=>item.limit===21&&item.count>=20&&item.count<=21&&!item.error));
  const statement=trace.samples[0].statement;
  const plan=withSql(data,false,db=>db.prepare('EXPLAIN QUERY PLAN '+statement).all('global_thinking','',1001,21).map(row=>row.detail));
  assert(plan.some(item=>item.includes('USING INDEX xiaozhi_config_changes_scope_v1')));
  assert(!plan.some(item=>/SCAN c\b|USE TEMP B-TREE/u.test(item)));
  report.plan=plan;report.trace=trace;
  const sorted=report.samples.map(item=>item.elapsedMs).sort((a,b)=>a-b);
  report.history={p95:sorted[Math.ceil(sorted.length*0.95)-1],max:Math.max(...sorted),sampleCount:sorted.length};
  assert(report.history.p95<=budget,JSON.stringify(report.history));
  report.success=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  await app?.close().catch(()=>{});
  writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2));
  writeFileSync(join(output,'evidence','AC-28-history-observations.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,history:report.history,fixture:root,error:report.error}));
}
