import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {app} from 'electron';

const desktop=path.resolve(import.meta.dirname,'../..');
const fixture=fs.realpathSync(process.argv[2]);
const proof=JSON.parse(fs.readFileSync(path.join(fixture,'report.json'),'utf8'));
assert(proof.ok&&proof.checks.some(check=>check.includes('twelve distinct')));
const root=fs.mkdtempSync(path.join(process.env.OMNI_EDU_ACCEPTANCE_ROOT,'memory-local-selection-'));
const data=path.join(root,'data');
const profile=path.join(root,'profile');
app.setPath('userData',profile);
app.setPath('sessionData',profile);
async function measure() {
  await app.whenReady();
  const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const original=path.join(fixture,'data','app.db'),before=hash(original);
  fs.cpSync(path.dirname(original),data,{recursive:true,errorOnExist:true,force:false});
  const report={root,inputSha256:before,platform:os.release(),cpu:os.cpus()[0].model,samplesMs:[],ok:false};
  const bundle=fs.mkdtempSync(path.join(desktop,'.tmp-memory-latency-'));
  try {
    const file=path.join(bundle,'host.mjs');
    await build({stdin:{resolveDir:desktop,contents:[
      "export {OmniEduStore} from './src/main/db';",
      "export {createTaskState} from './src/main/xiaozhi-agent/tasks/task-state';",
      "export {createPiMemoryScope} from './src/main/xiaozhi-agent/memory-scope';",
      "export {createHistoryMemory} from './src/main/xiaozhi-agent/history/memory';",
      "export {createTaskHistoryUse} from './src/main/xiaozhi-agent/memory-use/history-binding';",
      "export {createPersonalMemoryUse} from './src/main/education/personal-memory/use';",
      "export {assembleRequestMemory} from './src/main/xiaozhi-agent/memory-use/selection';"
    ].join('\n')},outfile:file,format:'esm',platform:'node',packages:'external',bundle:true,logLevel:'silent'});
    const host=await import(pathToFileURL(file).href);
    const store=new host.OmniEduStore(data);
    try {
      await store.init();
      const sql=store.xiaozhiState.sql;
      const history=host.createHistoryMemory(store);
      const sanitize=async text=>(await store.sanitizeProblemText(text)).sanitizedText;
      const personal=host.createPersonalMemoryUse(sql,sanitize);
      const scope=host.createPiMemoryScope(store,{modelAccess:'available',history,personal});
      const tasks=host.createTaskState(sql,{sanitize}),bindings=host.createTaskHistoryUse(sql,history);
      const rows=await sql.all("SELECT value_json FROM app_settings WHERE key GLOB 'xiaozhi.memory-use.task.v1:*' AND json_array_length(value_json,'$.selections')=4");
      assert.equal(rows.length,1);
      const {taskId,sessionId,selections}=JSON.parse(rows[0].value_json);
      const task=await tasks.get(taskId);
      const policy={omitHistory:false,loadHistory:()=>bindings.forTask(task)};
      const query='温度计实验课堂清单';
      const pins=new Set(selections.map(pin=>pin.id));
      report.sessionId=sessionId;report.taskId=taskId;
      for(let i=0;i<50;i++){
        const started=performance.now();
        const authority=await scope.authority(sessionId,policy);
        assert(authority.valid&&authority.history);
        const {historyPlan}=await host.assembleRequestMemory(32000,
          remaining=>scope.historyProjection(sessionId,authority.fingerprint,query,remaining,undefined,policy),
          remaining=>authority.personal?scope.personalReferences(sessionId,authority.fingerprint,'latency-'+i,query,remaining,undefined,policy):undefined);
        report.samplesMs.push(performance.now()-started);
        assert(historyPlan.readbacks.length>0&&historyPlan.readbacks.every(item=>pins.has(item.id)));
      }
      report.p95Ms=[...report.samplesMs].sort((a,b)=>a-b)[Math.ceil(report.samplesMs.length*.95)-1];
      assert(report.p95Ms<=250,'Local assembly P95 exceeds 250 ms');
      report.ok=true;
    } finally {await store.close();}
  } catch(error){report.error=String(error.stack);process.exitCode=1;}
  finally{
    fs.rmSync(path.join(bundle,'host.mjs'),{force:true});
    fs.rmdirSync(bundle);
    assert.equal(hash(original),before);
    fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({root,ok:report.ok,samples:report.samplesMs.length,p95Ms:report.p95Ms,error:report.error}));
    app.exit(report.ok?0:1);
  }
}
measure().catch(error=>{console.error(error);app.exit(1);});
