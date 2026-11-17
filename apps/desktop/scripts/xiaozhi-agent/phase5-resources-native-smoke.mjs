import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {resourceWorkload} from './phase5-resources-workload.mjs';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-phase5-resources-'));
const output=path.join(root,'evidence');fs.mkdirSync(output);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceFiles=['scripts/xiaozhi-agent/phase5-resources-native-smoke.mjs','scripts/xiaozhi-agent/phase5-resources-workload.mjs',
  'src/main/xiaozhi-agent/permissions/windows/JobLimits.cs','src/main/xiaozhi-agent/permissions/windows/SessionOptions.cs',
  'src/main/xiaozhi-agent/permissions/windows/NativeSandbox.cs','src/main/xiaozhi-agent/permissions/windows/launcher.ts'];
const report={success:false,root,output,paidCalls:0,os:{release:os.release(),arch:os.arch(),logicalProcessors:os.cpus().length,availableParallelism:os.availableParallelism()},
  sources:sourceFiles.map(filename=>({path:filename,sha256:hash(fs.readFileSync(filename))})),checks:[],runs:[]};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
await build({stdin:{contents:`export {createPermissionStore} from './src/main/xiaozhi-agent/permissions/store.ts';
export {createPermissionService} from './src/main/xiaozhi-agent/permissions/service.ts';
export {createPermissionRuntimeManager} from './src/main/xiaozhi-agent/permissions/windows/runtime.ts';
export {runNativeSandbox,inspectPermissionPlatform} from './src/main/xiaozhi-agent/permissions/windows/launcher.ts';
export {prepareExecutionProjection,removeOwnedProjection} from './src/main/xiaozhi-agent/permissions/windows/projection.ts';
export {filesystemScope} from './src/main/xiaozhi-agent/permissions/resources.ts';
export {permissionHash} from './src/main/xiaozhi-agent/permissions/validation.ts';`,resolveDir:process.cwd(),loader:'ts'},
  outfile:path.join(output,'resources.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',target:'node24',
  plugins:[{name:'installed-dependencies',setup(builder){builder.onResolve({filter:/^(?:@[^/]+\/[^/]+|[a-zA-Z][\w-]*)(?:\/.*)?$/},
    args=>({path:import.meta.resolve(args.path),external:true}));}}]});
const api=await import(pathToFileURL(path.join(output,'resources.mjs')).href);
const db=new DatabaseSync(path.join(root,'authority.sqlite'));
db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
db.exec('CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT)');
const sql={all:async(query,values=[])=>db.prepare(query).all(...values),run:async(query,values=[])=>{db.prepare(query).run(...values);},
  change:async(query,values=[])=>Number(db.prepare(query).run(...values).changes)};
sql.transaction=async action=>{db.exec('BEGIN IMMEDIATE');try{const result=await action(sql);db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
const store=api.createPermissionStore(sql);await store.migrate();
const owner={sessionId:'aisession_'+randomUUID(),taskId:'xitask_'+hash(root),runId:'run_resources_fixture',generation:1};
const workspace=path.join(root,'workspace');fs.mkdirSync(workspace);
const packageRoot=path.join(root,'package');fs.mkdirSync(packageRoot);
const manager=api.createPermissionRuntimeManager({root:path.join(root,'runtime'),store});
const permissions=api.createPermissionService({store,dataRoot:path.join(root,'data'),owner:()=>owner,archived:async()=>false,workspace:async()=>({path:workspace})});
const controller=new AbortController();let runtime;let executable;let executableHash;
async function check(id,name,action){const started=performance.now();try{await action();report.checks.push({id,name,pass:true,durationMs:performance.now()-started});console.log('PASS '+id+' '+name);}
  catch(error){report.checks.push({id,name,pass:false,durationMs:performance.now()-started,error:error.stack});console.error('FAIL '+id+' '+error.stack);}save();}
function clean(receipt){assert.equal(receipt.cleanup.jobActiveProcesses,0);assert.equal(receipt.cleanup.profileRemoved,true);assert.equal(receipt.cleanup.remainingOwnedAces,0);}
const base={memoryBytes:536870912,cpuRate:10000,userTimeMs:0,maxInputBytes:1048576};
async function run(mode,{limits={},args=[],invalid,timeoutMs=30000}={}){
  const session={schemaVersion:1,mode:'stdio',arguments:[mode,...args].map(value=>'"'+String(value)+'"').join(' '),environment:{},...base,...limits};
  if(invalid)invalid(session);
  const request={schemaVersion:2,owner,requirementsVersion:1,callId:'resource_'+mode+'_'+randomUUID(),action:'owned_resource_probe',
    inputDigest:api.permissionHash({mode,session}),purpose:'合成资源预算验证',scopes:[api.filesystemScope(workspace,['read']),
      {kind:'process',backend:'appcontainer',executable,executableHash,workspace},
      {kind:'dependency',source:'https://example.invalid',package:'owned-resource-fixture',version:'1.0.0',sha256:executableHash,environment:packageRoot,installScripts:false}],
    files:[],provider:null,classification:'redacted',expiresAt:new Date(Date.now()+120000).toISOString()};
  const record={mode,limits:session,frames:[],stderr:'',started:false};report.runs.push(record);save();
  return permissions.engine.run(request,controller.signal,async authority=>{
    const permission={request,...authority};const projection=await api.prepareExecutionProjection(workspace,'',permission);
    record.projectionRoot=projection.root;let result;
    try{
      const packageProjection=path.join(projection.root,'.runtime/package');fs.mkdirSync(packageProjection,{recursive:true});
      const target=path.join(packageProjection,'ResourceProbe.exe');fs.copyFileSync(executable,target,fs.constants.COPYFILE_EXCL);
      assert.equal(hash(fs.readFileSync(target)),executableHash);let pending='';
      const outcome=await api.runNativeSandbox({manifest:runtime.manifest,directory:runtime.directory,signal:authority.signal,
        start:{schemaVersion:1,type:'start',executionId:projection.executionId,owner,grantHash:authority.decision.permissionSnapshotHash,
          executable:target,executableHash,projectionRoot:projection.root,cwd:projection.cwd,command:'',env:{XIAOZHI_WORKSPACE:projection.root},
          timeoutMs,maxOutputBytes:1048576,maxProcesses:4,session},
        onStarted:(pid,helperPid)=>{record.started=true;record.pid=pid;record.helperPid=helperPid;},onResult:value=>{result=value;record.result=value;save();},
        onBytes:(stream,bytes)=>{if(stream==='stderr'){record.stderr+=bytes.toString('utf8');return;}pending+=bytes.toString('utf8');let newline=pending.indexOf('\n');
          while(newline>=0){const line=pending.slice(0,newline).trim();pending=pending.slice(newline+1);if(line)record.frames.push(JSON.parse(line));newline=pending.indexOf('\n');}}});
      record.result=outcome.result;record.helperHash=outcome.helperHash;record.outputBytes=outcome.outputBytes;
      assert.equal(pending.trim(),'');clean(outcome.result);save();return record;
    }catch(error){record.error=error.stack;save();throw error;}
    finally{if(result){clean(result);api.removeOwnedProjection(projection.root);}save();}
  });
}
function query(frame,memoryBytes,cpuRate,userTimeMs=0){assert(frame,'missing guest Win32 query');
  assert.equal(frame.inJob,true);assert.equal(frame.extendedQueryOk,true);assert.equal(frame.cpuQueryOk,true);assert.equal(frame.accountingQueryOk,true);
  assert.equal(frame.jobMemoryLimit,memoryBytes);assert.equal(frame.cpuRate,cpuRate);assert.equal(frame.cpuFlags,5);
  assert.equal(frame.limitFlags&0x200,0x200);assert.equal(frame.maxProcesses,4);assert.equal(frame.jobUserTimeLimit100ns,userTimeMs*10000);}
try{
  await check('R01','Original runtime prepares; owned fixture builds; host nesting/topology recorded',async()=>{
    const recipe=manager.recipe();await store.issue(owner.sessionId,[recipe],{kind:'teacher',reference:'owned-resource-runtime'});
    const request={schemaVersion:2,owner,requirementsVersion:1,callId:'resource_runtime',action:'environment_repair',inputDigest:api.permissionHash(recipe),
      purpose:'合成资源运行时',scopes:[recipe],files:[],provider:null,classification:'redacted',expiresAt:new Date(Date.now()+300000).toISOString()};
    runtime=(await permissions.engine.run(request,controller.signal,authority=>manager.prepare({request,...authority},recipe.sha256))).runtime;
    report.helperHash=runtime.manifest.helperSha256;report.runtimeVersion=runtime.version;
    const platform=await api.inspectPermissionPlatform();const compiler=platform.runtimes.find(item=>item.kind==='framework_csc');assert.equal(compiler.trust,'verified');
    const source=path.join(root,'ResourceProbe.cs');fs.writeFileSync(source,resourceWorkload);executable=path.join(packageRoot,'ResourceProbe.exe');
    const compiled=spawnSync(compiler.path,['/nologo','/target:exe','/platform:x64','/optimize+','/checked+','/r:System.Web.Extensions.dll','/out:'+executable,source],{encoding:'utf8',windowsHide:true,timeout:30000});
    report.compilation={status:compiled.status,stdout:compiled.stdout,stderr:compiled.stderr,compilerHash:compiler.sha256,sourceHash:hash(resourceWorkload)};assert.equal(compiled.status,0,compiled.stdout+compiled.stderr);
    executableHash=hash(fs.readFileSync(executable));report.fixtureHash=executableHash;
    // This mode only reads current Job metadata. All resource workloads below use original Permission+AppContainer.
    const host=spawnSync(executable,['inspect-host'],{encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(host.status,0,host.stderr);report.hostParentJob=JSON.parse(host.stdout.trim());
    await store.issue(owner.sessionId,[api.filesystemScope(workspace,['read']),{kind:'process',backend:'appcontainer',executable,executableHash,workspace},
      {kind:'dependency',source:'https://example.invalid',package:'owned-resource-fixture',version:'1.0.0',sha256:executableHash,environment:packageRoot,installScripts:false}],
      {kind:'teacher',reference:'owned-resource-fixture'});
  });
  if(!runtime||!executableHash)throw Error('resource_preparation_failed');
  await check('R02','Below-cap committed and touched memory has actual queried Job limits',async()=>{
    const record=await run('query',{limits:{memoryBytes:134217728,cpuRate:5000}});assert.equal(record.result.state,'completed');assert.equal(record.result.exitCode,0);
    const completed=record.frames.find(frame=>frame.kind==='normal_complete');query(completed,134217728,5000);assert.equal(completed.committedTouchedBytes,16777216);assert(completed.peakJobMemory>=completed.committedTouchedBytes);
  });
  await check('R03','Caught VirtualAlloc failure produces actual Job memory-limit classification',async()=>{
    const record=await run('memory-parent',{limits:{memoryBytes:134217728}});query(record.frames[0],134217728,10000);
    assert.equal(record.result.error,'memory_limit');assert.equal(record.result.state,'failed');
    const caught=record.frames.find(frame=>frame.kind==='allocation_failure_caught');assert(caught,'guest must catch the OS allocation rejection before supervised termination');
    assert([8,14,1455].includes(caught.win32Error));assert(caught.peakJobMemory>=134217728*0.7);assert(caught.committedTouchedBytes>=67108864);
  });
  await check('R04','Parent and two descendants aggregate committed memory reaches Job cap',async()=>{
    const record=await run('memory-tree',{limits:{memoryBytes:201326592}});query(record.frames[0],201326592,10000);
    assert.equal(record.result.error,'memory_limit');assert.equal(record.result.state,'failed');
    assert(record.frames.some(frame=>frame.jobActiveProcesses>=3),'three actual Job processes required');
    assert(new Set(record.frames.map(frame=>frame.pid)).size>=3,'parent and both descendants must report');
    assert(Math.max(...record.frames.map(frame=>frame.peakJobMemory))>=201326592*0.7);
    for(const frame of record.frames)assert(frame.processPrivateBytes<201326592,'each process must remain below aggregate Job cap');
    assert(record.frames.some(frame=>frame.kind==='allocation_failure_caught'));
  });
  let highRate;
  await check('R05','Unthrottled reference records eight-second CPU and wall interval',async()=>{
    const record=await run('cpu-rate',{args:[8000]});assert.equal(record.result.state,'completed');assert.equal(record.result.exitCode,0);
    const start=record.frames.find(frame=>frame.kind==='cpu_interval_start'),end=record.frames.find(frame=>frame.kind==='cpu_interval_end');query(end,536870912,10000);
    highRate={wallMs:end.wallMs-start.wallMs,userMs:end.processUserMs-start.processUserMs,kernelMs:end.processKernelMs-start.processKernelMs};
    highRate.cpuPerWall=(highRate.userMs+highRate.kernelMs)/highRate.wallMs;record.cpuMeasurement=highRate;assert(highRate.wallMs>=7900);assert(highRate.cpuPerWall>=0.5);
  });
  await check('R06','CPU hard-cap query matches and actual scheduling throughput is throttled',async()=>{
    assert(highRate,'reference CPU interval missing');const cpuRate=Math.max(1,Math.floor(10000/(os.cpus().length*8)));
    const record=await run('cpu-rate',{args:[8000],limits:{cpuRate}});assert.equal(record.result.state,'completed');assert.equal(record.result.exitCode,0);
    const start=record.frames.find(frame=>frame.kind==='cpu_interval_start'),end=record.frames.find(frame=>frame.kind==='cpu_interval_end');query(end,536870912,cpuRate);
    const measurement={wallMs:end.wallMs-start.wallMs,userMs:end.processUserMs-start.processUserMs,kernelMs:end.processKernelMs-start.processKernelMs,
      cpuRate,logicalProcessors:os.cpus().length,expectedLogicalCpu:os.cpus().length*cpuRate/10000,toleranceLogicalCpu:[0.025,0.35],maximumBaselineRatio:0.6};
    measurement.cpuPerWall=(measurement.userMs+measurement.kernelMs)/measurement.wallMs;measurement.baselineRatio=measurement.cpuPerWall/highRate.cpuPerWall;
    record.cpuMeasurement=measurement;assert(measurement.wallMs>=7900);assert(measurement.cpuPerWall>=0.025&&measurement.cpuPerWall<=0.35);assert(measurement.baselineRatio<=0.6);
  });
  await check('R07','One-second cumulative user-time terminates an actual pure-user process',async()=>{
    const record=await run('cpu-total',{limits:{userTimeMs:1000}});query(record.frames[0],536870912,10000,1000);
    assert.equal(record.result.error,'cpu_limit');assert.equal(record.result.state,'failed');assert(!record.frames.some(frame=>frame.kind==='unexpected_cpu_complete'));
  });
  await check('R08','One-second cumulative user-time covers parent and both child loops',async()=>{
    const record=await run('cpu-tree',{limits:{userTimeMs:1000}});query(record.frames[0],536870912,10000,1000);
    assert.equal(record.result.error,'cpu_limit');assert.equal(record.result.state,'failed');assert(record.frames.some(frame=>frame.jobActiveProcesses>=3));
    assert(new Set(record.frames.map(frame=>frame.pid)).size>=3);
  });
  await check('R09','Invalid and missing budgets reject before starting any guest',async()=>{
    const invalidCases=[['memory_below_minimum',session=>{session.memoryBytes=16777215;}],['memory_overflow',session=>{session.memoryBytes=2147483648;}],
      ['cpu_zero',session=>{session.cpuRate=0;}],['cpu_overflow',session=>{session.cpuRate=10001;}],['user_negative',session=>{session.userTimeMs=-1;}],
      ['user_overflow',session=>{session.userTimeMs=86400001;}],['missing_memory',session=>{delete session.memoryBytes;}],['wrong_unit_type',session=>{session.memoryBytes='128MiB';}]];
    for(const [name,invalid]of invalidCases){const record=await run('query',{invalid});record.invalidCase=name;assert.equal(record.started,false);assert.equal(record.result.state,'failed');assert.equal(record.result.error,'invalid_protocol');assert.equal(record.frames.length,0);}
  });
  await check('R10','Every actual normal and failure terminal has exact Job profile ACE cleanup',async()=>{
    assert(report.runs.length>=15);for(const record of report.runs){assert(record.result,'missing terminal '+record.mode);clean(record.result);assert.equal(fs.existsSync(record.projectionRoot),false);}
    assert.equal(permissions.engine.activeCount(),0);
  });
  report.success=report.checks.every(check=>check.pass);if(!report.success)process.exitCode=1;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{db.close();save();console.log(JSON.stringify({success:report.success,passed:report.checks.filter(check=>check.pass).length,failed:report.checks.filter(check=>!check.pass).length,root,output}));}
