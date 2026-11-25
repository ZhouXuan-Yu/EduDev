import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {addEffect,addTask,expectedTasks,prefix,saveTask,sessionFor,withSql} from './db-foundation-r1-task-fixture.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const p95=values=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.95)-1];
const table='xiaozhi_task_summary_rows';
const hot=sessionFor(0);
const limit=25;
const queries=[{filter:'all'},{filter:'completed'},{filter:'all',sessionId:hot}].map(scope=>({schemaVersion:1,kind:'tasks',limit,...scope}));

if(!isMainThread){
  const {data,target}=workerData;
  parentPort.on('message',sample=>{
    const started=performance.now();
    if(started>sample.deadline){parentPort.postMessage({...sample,started,error:'write deadline expired before start'});return;}
    let acquired,committed;
    try {
      const witness=withSql(data,true,db=>{
        db.exec('BEGIN IMMEDIATE');
        acquired=performance.now();
        try {
          let value;
          const at=new Date().toISOString();
          if(sample.kind==='task'){
            const document=JSON.parse(db.prepare('SELECT value_json FROM app_settings WHERE key=?').get(prefix+target.id).value_json);
            document.view.revision++;
            document.view.updatedAt=at;
            saveTask(db,document,true);
            value=document.view.revision;
          }else if(sample.kind==='approval'){
            const id='r2_load_approval_'+sample.index;
            const payload={schemaVersion:1,callId:id,source:'source.txt',target:'target.txt',sourceSha256:sha('fixture'),
              workspaceHash:sha('fixture-root'),state:'pending'};
            db.prepare(`INSERT INTO ai_confirmation_items(id,run_id,session_id,action_type,status,title,payload_json,created_at,updated_at)
              VALUES(?,?,?,'pi_office_copy','pending','合成持续写入',?,?,?)`).run(id,target.lastRunId,hot,JSON.stringify(payload),at,at);
            value=db.prepare("SELECT COUNT(*) AS n FROM ai_confirmation_items WHERE run_id=? AND action_type='pi_office_copy' AND status='pending'").get(target.lastRunId).n;
          }else{
            addEffect(db,{view:target},'_load_'+sample.index);
            value=db.prepare("SELECT COUNT(*) AS n FROM xiaozhi_effects_v1 WHERE task_id=? AND state='unknown'").get(target.id).n;
          }
          db.exec('COMMIT');
          committed=performance.now();
          return value;
        }catch(error){db.exec('ROLLBACK');throw error;}
      });
      parentPort.postMessage({...sample,started,acquired,committed,witness});
    }catch(error){parentPort.postMessage({...sample,started,acquired,failedAt:performance.now(),error:String(error)});}
  });
}else await execute();

async function execute(){
  const desktop=resolve(import.meta.dirname,'../..'),main=testMain(desktop);
  const evidence=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT || join(desktop,'test-results'));
  mkdirSync(join(evidence,'fixtures'),{recursive:true});
  const root=mkdtempSync(join(evidence,'fixtures','R2-performance-'));
  const data=join(root,'data'),profile=join(root,'profile');
  const mode=process.argv[2];
  assert(['idle','sustained'].includes(mode));
  const report={mode,root,build:sha(readFileSync(main)),test:sha(readFileSync(import.meta.filename)),checks:{}};
  let app,worker;
  try{
    const fixture=process.env.OMNI_EDU_R2_PERF_FIXTURE_DB && realpathSync(process.env.OMNI_EDU_R2_PERF_FIXTURE_DB);
    if(fixture){
      const fixtures=realpathSync(join(evidence,'fixtures'));
      assert(fixture.startsWith(fixtures+'\\') || fixture.startsWith(fixtures+'/'),'Use a closed owned fixture');
      for(const suffix of ['-wal','-shm','-journal'])assert(!existsSync(fixture+suffix),'Source fixture must be closed');
      mkdirSync(data,{recursive:true});
      copyFileSync(fixture,join(data,'app.db'));
      report.clonedFixture={file:fixture,sha256:sha(readFileSync(fixture))};
    }
    const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),
      OMNI_EDU_XIAOZHI_PI:'1',DEEPSEEK_API_KEY:'',GLM_API_KEY:''};
    for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
    app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
    const child=app.process();
    report.process={pid:child.pid,startedAt:new Date().toISOString(),exit:null,stderrTail:''};
    child.once('exit',(code,signal)=>{report.process.exit={code,signal,time:new Date().toISOString()};});
    child.stderr?.on('data',chunk=>{report.process.stderrTail=(report.process.stderrTail+String(chunk)).slice(-8000);});
    const page=await app.firstWindow();
    await assertIsolatedPiMain(app,main,profile);
    await app.evaluate((_,requirePath)=>{
      const sqlite=process.getBuiltinModule('module').createRequire(requirePath)('sqlite3');
      const db=sqlite.Database.prototype;
      const raw={all:db.all,run:db.run,exec:db.exec};
      const log=globalThis.r2Performance={events:[],summary:{},transactions:[],loop:[],mode:'startup',lastAuthority:performance.now(),runtime:{os:process.getBuiltinModule('os').release(),
        electron:process.versions.electron,node:process.versions.node,sqlite:sqlite.VERSION,binding:sqlite.VERSION_NUMBER}};
      const connectionIds=new WeakMap();
      let nextConnectionId=0;
      for(const name of ['all','run','exec'])db[name]=function(sql,...args){
        const operation=name==='exec' && /^(BEGIN IMMEDIATE|COMMIT|ROLLBACK);?$/iu.exec(sql.trim())?.[1];
        if(operation && log.mode==='sustained' && typeof args.at(-1)==='function'){
          if(!connectionIds.has(this))connectionIds.set(this,++nextConnectionId);
          const event={connection:connectionIds.get(this),operation,issued:performance.now()};
          log.transactions.push(event);
          const callback=args.at(-1);
          args[args.length-1]=function(error,...values){
            event.completed=performance.now();
            if(error)event.error=error.code||String(error);
            return callback.call(this,error,...values);
          };
        }
        if(/xiaozhi_task_summary_|xiaozhi_effects_v1|ai_confirmation_items|xiaozhi\.task\.v1/u.test(sql) ||
          name==='all'&&args[0]?.some?.(key=>typeof key==='string'&&key.startsWith('xiaozhi.task.v1:'))){
          const statement=sql.replace(/\s+/gu,' ').trim();
          if(/FROM (app_settings|xiaozhi_effects_v1|ai_confirmation_items)/iu.test(statement))log.lastAuthority=performance.now();
          const counts=log.summary[log.mode]??={};
          counts[statement]=(counts[statement]||0)+1;
          if(log.mode==='idle' || log.mode==='sustained' && statement.includes('r.row_json'))
            log.events.push({at:performance.now(),phase:log.mode,kind:name,sql:statement});
        }
        return raw[name].call(this,sql,...args);
      };
      let prior=performance.now();
      log.timer=setInterval(()=>{const now=performance.now();log.loop.push({at:now,phase:log.mode,delay:Math.max(0,now-prior-50)});prior=now;},50);
      log.stop=()=>{clearInterval(log.timer);for(const name of ['all','run','exec'])db[name]=raw[name];};
    },join(desktop,'package.json'));
    const seededAt=performance.now();
    let target=fixture?expectedTasks(data).find(task=>task.sessionId===hot):undefined;
    if(!fixture)withSql(data,true,db=>{
      db.exec('BEGIN IMMEDIATE');
      try {
        for(let index=0;index<10000;index++){
          // Reserve exactly a tenth of the facts for the hot session. Scatter the rest.
          const hotTask=index%10===0;
          const modulus=hotTask?1:100+index%29;
          const destination=hotTask?0:1+index%(modulus-1);
          const document=addTask(db,index,modulus,destination);
          if(hotTask)target=document.view;
        }
        assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
        db.exec('COMMIT');
      }catch(error){db.exec('ROLLBACK');throw error;}
    });
    const snapshot=()=>withSql(data,false,db=>db.prepare(`SELECT phase,projected_rows,
      EXISTS(SELECT 1 FROM xiaozhi_task_summary_dirty) OR EXISTS(SELECT 1 FROM xiaozhi_task_summary_dirty_sessions) AS dirty
      FROM xiaozhi_task_summary_control`).get());
    const ready=()=>{const value=snapshot();return value.phase==='ready' && !value.dirty && value.projected_rows===10000;};
    const setupDeadline=performance.now()+240000;
    while(!ready() && performance.now()<setupDeadline)await wait(100);
    assert(ready(),'Initial 10k projection must finish before sample windows');
    assert(target?.id);
    report.setup={elapsedMs:performance.now()-seededAt,recordCount:10000,hotCount:withSql(data,false,db=>db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE session_id=?`).get(hot).n),target:target.id};
    assert.equal(report.setup.hotCount,1000);
    await page.getByTestId('office-prompt-input').waitFor();
    const settleStart=performance.now();
    const settleDeadline=settleStart+20000;
    let quiet=0;
    // A ready index can precede the renderer's initial session and Approval reads.
    // Retain those reads under startup and measure the idle window only after they finish.
    do {
      await wait(100);
      quiet=await app.evaluate(()=>performance.now()-globalThis.r2Performance.lastAuthority);
    } while((quiet<2000 || performance.now()-settleStart<3000) && performance.now()<settleDeadline);
    assert(quiet>=2000,'Startup authority reads did not settle before the observation window');
    report.setup.quietBeforeWindowMs=quiet;
    const startPhase=()=>app.evaluate((_,phase)=>{
      const state=globalThis.r2Performance;state.mode=phase;
      return performance.now();
    },mode);
    const stopTrace=()=>app.evaluate(()=>{
      const state=globalThis.r2Performance;state.stop();
      return {end:performance.now(),events:state.events,statements:state.summary,transactions:state.transactions,loop:state.loop,runtime:state.runtime};
    });
    if(mode==='idle'){
      const start=await startPhase();
      await wait(120000);
      const trace=await stopTrace();
      const events=trace.events.filter(item=>item.phase==='idle');
      report.trace={start,...trace};
      const stats={durationMs:trace.end-start,readsOfAuthority:events.filter(e=>/FROM (app_settings|xiaozhi_effects_v1|ai_confirmation_items)/iu.test(e.sql)).length,
        writes:events.filter(e=>e.kind!=='all').length,countScans:events.filter(e=>/COUNT\(/iu.test(e.sql)).length,
        jsonValidation:events.filter(e=>/json_(valid|extract)/iu.test(e.sql)).length,control:events.filter(e=>e.kind==='all'&&e.sql.includes('xiaozhi_task_summary_control')).map(e=>e.at)};
      report.stats=stats;
      report.checks['AC-R2-12.01']=stats.readsOfAuthority===0 && stats.writes===0;
      report.checks['AC-R2-12.02']=stats.countScans===0 && stats.jsonValidation===0 && stats.control.every((stamp,i)=>i<2||stamp-stats.control[i-2]>=1000);
      report.checks['AC-R2-12.03']=stats.durationMs>=120000 && report.setup.quietBeforeWindowMs>=2000 &&
        (Boolean(report.clonedFixture) || Object.keys(trace.statements.startup||{}).length>0);
    }else{
      worker=new Worker(new URL(import.meta.url),{workerData:{data,target}});
      const outstanding=new Map(),writeResults=[];
      worker.on('message',result=>{
        writeResults.push(result);
        outstanding.get(result.index)?.(result);
        outstanding.delete(result.index);
      });
      const startElectron=await startPhase(),start=performance.now()+100;
      const lastAllowed=start+330000;
      const observations=[];
      const observe=()=>withSql(data,false,db=>{
        const row=db.prepare(`SELECT row_json FROM ${table} WHERE task_id=?`).get(target.id);
        const value=JSON.parse(row.row_json);
        observations.push({at:performance.now(),task:value.revision,approval:value.pendingApprovalCount,effect:value.unknownEffectCount});
      });
      observe();
      const observationTimer=setInterval(observe,50);
      function scheduled(index,period,action){
        const planned=start+index*period,deadline=planned+15000;
        return new Promise(resolve=>setTimeout(()=>{
          const issued=performance.now();
          if(issued>deadline){resolve({index,planned,issued,deadline,error:'dispatch deadline expired'});return;}
          const expire=setTimeout(()=>resolve({index,planned,issued,deadline,error:'completion deadline expired'}),Math.max(0,deadline-issued));
          void action({index,planned,issued,deadline}).then(resolve,error=>resolve({index,planned,issued,deadline,error:String(error)})).finally(()=>clearTimeout(expire));
        },Math.max(0,planned-performance.now())));
      }
      const writes=Array.from({length:600},(_,index)=>scheduled(index,500,sample=>new Promise(resolve=>{
        outstanding.set(index,resolve);
        worker.postMessage({...sample,kind:['task','approval','effect'][index%3]});
      })));
      const calls=Array.from({length:300},(_,index)=>scheduled(index,1000,async sample=>{
        const scenario=index%3;
        const result=await page.evaluate(query=>window.omniEdu.getXiaozhiWorkbenchSummary(query),queries[scenario]);
        const ended=performance.now();
        const value=result.value;
        return {...sample,scenario,ended,elapsedMs:ended-sample.issued,ok:result.ok,
          partial:value?.partial??null,total:value?.total??null,counts:value?.counts??null,
          validShape:value && value.scanned<=26 && (value.partial?value.total===null&&value.matched===null&&value.counts===null&&value.nextCursor===null
            :typeof value.total==='number' && !!value.counts && value.total===Object.values(value.counts).reduce((sum,count)=>sum+count,0)),
          error:result.error};
      }));
      const [writeAttempts,queryAttempts]=await Promise.all([Promise.all(writes),Promise.all(calls)]);
      await wait(Math.max(0,start+300000-performance.now()));
      const lastCommit=Math.max(...writeResults.map(item=>item.committed||0));
      const deadline=Math.min(lastAllowed,lastCommit+10000);
      while((!ready()||outstanding.size) && performance.now()<deadline)await wait(25);
      const drained=ready() && outstanding.size===0;
      const drainedAt=performance.now();
      observe();clearInterval(observationTimer);
      const trace=await stopTrace();
      report.workload={start,startElectron,deadline:lastAllowed,writeAttempts,writeResults,queryAttempts,observations,drainedAt,lastCommit,...trace};
      const actual=withSql(data,false,db=>db.prepare(`SELECT task_id AS id,state,revision,session_id AS sessionId,updated_at AS updatedAt FROM ${table}
        ORDER BY updated_at DESC,task_id`).all().map(row=>({...row})));
      const expected=expectedTasks(data).map(({id,state,revision,sessionId,updatedAt})=>({id,state,revision,sessionId,updatedAt}));
      const finalPages=await Promise.all(queries.map(query=>page.evaluate(query=>window.omniEdu.getXiaozhiWorkbenchSummary(query),query)));
      const countsAgree=finalPages.every((result,index)=>{
        const scope=expected.filter(task=>!queries[index].sessionId||task.sessionId===queries[index].sessionId);
        return result.ok && !result.value.partial && result.value.total===scope.length &&
          Object.entries(result.value.counts).every(([state,n])=>n===scope.filter(task=>task.state===state).length);
      });
      const visible=writeResults.filter(write=>write.committed!==undefined).map(write=>{
        const found=observations.find(row=>row.at>=write.committed && row[write.kind]>=write.witness);
        return {index:write.index,kind:write.kind,witness:write.witness,commit:write.committed,visibleAt:found?.at??null,delay:found?found.at-write.committed:null};
      });
      const queryStats=queries.map((_,scenario)=>{
        const all=queryAttempts.filter(item=>item.index%3===scenario);
        return {count:all.length,partial:all.filter(item=>item.partial).length,p95:p95(all.map(item=>item.elapsedMs??Infinity)),
          failures:all.filter(item=>!item.ok||!item.validShape||item.ended>item.deadline).length};
      });
      const loop=trace.loop.filter(item=>item.phase===mode).map(item=>item.delay);
      report.stats={queryStats,loop:{count:loop.length,p95:p95(loop),max:Math.max(...loop)},
        writeFailures:writeAttempts.filter(item=>item.error||item.committed>item.deadline).length,
        visibleP95:p95(visible.map(item=>item.delay??Infinity)),drainMs:Math.max(0,drainedAt-lastCommit),drained};
      report.visibility=visible;
      report.authority={expected:sha(JSON.stringify(expected)),actual:sha(JSON.stringify(actual)),rows:actual.length,countsAgree};
      report.checks['AC-R2-13.01']=queryStats.every(s=>s.count===100 && s.failures===0 && s.p95<=500);
      report.checks['AC-R2-13.02']=loop.length>0 && report.stats.loop.p95<=100 && report.stats.loop.max<=500 && report.stats.writeFailures===0 && writeResults.length===600;
      report.checks['AC-R2-13.03']=visible.length===600 && visible.every(item=>item.delay!==null) && report.stats.visibleP95<=2000;
      report.checks['AC-R2-13.04']=drained && drainedAt<=lastAllowed && report.stats.drainMs<=10000 && countsAgree && report.authority.expected===report.authority.actual;
      report.checks['AC-R2-13.05']=queries.every(input=>!('cursor' in input));
    }
    report.ok=Object.values(report.checks).every(Boolean);
  }catch(error){report.ok=false;report.error=error.stack;}
  finally{
    await worker?.terminate();
    await app?.close().catch(()=>{});
    writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({root,ok:report.ok,checks:report.checks,stats:report.stats,error:report.error},null,2));
    if(!report.ok)process.exitCode=1;
  }
}
