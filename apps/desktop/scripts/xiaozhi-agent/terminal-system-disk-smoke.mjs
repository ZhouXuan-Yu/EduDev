import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const {createControlledTerminalBackend}=await import('../../src/main/xiaozhi-agent/terminal/controlled-backend.ts');
const {createTerminalTool}=await import('../../src/main/xiaozhi-agent/tools/terminal.ts');
const {checkCompiledPermissionRuntime}=await import('../../src/main/xiaozhi-agent/permissions/windows/runtime-health.ts');
const {permissionTemporaryRoot}=await import('../../src/main/xiaozhi-agent/permissions/windows/temporary.ts');
const {createToolExecutionBoundary}=await import('../../src/main/xiaozhi-agent/tools/execution-bound.ts');
const {SessionExecutionRegistry}=await import('../../src/main/xiaozhi-agent/vendor/hana/lib/session-execution-registry.ts');
const {TOOL_EXECUTION_MESSAGES,validToolAttempt}=await import('../../src/shared/xiaozhi-tool-attempt.ts');
const {terminalMessage}=await import('../../src/renderer/components/office/terminal/terminalState.ts');
const {terminalJobView}=await import('../../src/main/xiaozhi-agent/terminal/presentation.ts');
const {inspectPermissionPlatform,builtinSandboxManifest}=await import('../../src/main/xiaozhi-agent/permissions/windows/launcher.ts');
const output=fs.mkdtempSync(path.join(path.resolve(process.env.OMNI_EDU_TEST_OUTPUT||os.tmpdir()),'terminal-system-disk-'));
const report={success:false,output,checks:[],scope:'Original native HRESULT mapper compiled in an E-only test executable; health/backend/boundary/renderer message contracts with injected native outcomes. No user command replay, real PTY acceptance or installed-build claim.'};
const check=async(name,action)=>{await action();report.checks.push({name,pass:true});console.log('PASS '+name);};
const owner={sessionId:'aisession_'+randomUUID(),taskId:'synthetic-disk-full',runId:'synthetic-disk-full',generation:1};
const failed=error=>({schemaVersion:1,type:'result',executionId:'xiexec_'+randomUUID(),state:'failed',exitCode:null,truncated:false,durationMs:1,error,cleanup:{jobActiveProcesses:0,profileRemoved:true,remainingOwnedAces:0,ptyClosed:true}});
try {
  await check('Only the confirmed AppContainer disk-full HRESULT maps to the stable native code',async()=>{
    const platform=await inspectPermissionPlatform(),compiler=platform.runtimes.find(r=>r.kind==='framework_csc');assert.equal(compiler.trust,'verified');
    const source=path.resolve('src/main/xiaozhi-agent/permissions/windows');
    const names=['NativeSandbox.cs','PlatformInfo.cs','SessionOptions.cs','SessionInput.cs','SessionPackage.cs','JobLimits.cs','ConPtyNative.cs','ConPtySession.cs','PtyRunner.cs','TrustedRuntimes.cs'];
    for(const name of names)fs.copyFileSync(path.join(source,name),path.join(output,name));
    const probe='namespace Xiaozhi.PermissionRuntime { internal static class ProfileMappingProbe { public static void Main() { System.Console.WriteLine(Runner.ProfileFailure(unchecked((int)0x80070070))); System.Console.WriteLine(Runner.ProfileFailure(unchecked((int)0x80070005))); System.Console.WriteLine(Runner.ProfileFailure(unchecked((int)0x80070057))); } } }';
    fs.writeFileSync(path.join(output,'ProfileMappingProbe.cs'),probe);
    const args=['/nologo','/noconfig','/target:exe','/platform:x64','/optimize+','/checked+','/warn:4','/r:System.dll','/r:System.Core.dll','/main:Xiaozhi.PermissionRuntime.ProfileMappingProbe','/out:profile-map.exe',...names,'ProfileMappingProbe.cs'];
    const compiled=spawnSync(compiler.path,args,{cwd:output,env:{...process.env,TEMP:output,TMP:output},encoding:'utf8',windowsHide:true,timeout:30000});
    assert.equal(compiled.status,0,compiled.stdout+compiled.stderr);
    const executable=path.join(output,'profile-map.exe'),tested=spawnSync(executable,[],{cwd:output,env:{...process.env,TEMP:output,TMP:output},encoding:'utf8',windowsHide:true,timeout:10000});
    assert.equal(tested.status,0,tested.stderr);assert.deepEqual(tested.stdout.trim().split(/\r?\n/),['system_disk_full','launch_failed','launch_failed']);
    report.native={sourceSha256:createHash('sha256').update(fs.readFileSync(path.join(source,'NativeSandbox.cs'))).digest('hex'),testExecutableSha256:createHash('sha256').update(fs.readFileSync(executable)).digest('hex'),compilerSha256:compiler.sha256,output:tested.stdout};
  });
  await check('Disk-full health is audited and stops after one fixed probe without activating a runtime',async()=>{
    let calls=0;const audits=[],roots=[];
    const authority={request:{owner},signal:new AbortController().signal,decision:{permissionSnapshotHash:'a'.repeat(64)},assert:async()=>{}};
    await assert.rejects(checkCompiledPermissionRuntime({authority,store:{audit:async(_s,_k,_v,data)=>audits.push(data)},version:'synthetic',manifest:builtinSandboxManifest,directory:output,runtime:{path:'synthetic',sha256:'a'.repeat(64)}},async({start})=>{calls++;roots.push(start.projectionRoot);return{started:false,result:{...failed('system_disk_full'),executionId:start.executionId},helperHash:'b'.repeat(64),outputBytes:0};}),/system_disk_full/);
    assert.equal(calls,1);assert.equal(audits.length,1);assert.equal(audits[0].result.error,'system_disk_full');assert.equal(audits[0].started,false);assert.equal(audits[0].ready,false);assert(roots.every(root=>!fs.existsSync(root)));
  });
  await check('PTY startup preserves its known failure with zero input ACK or guest output and no relaunch',async()=>{
    let launches=0,writes=0,bytes=0;
    const backend=createControlledTerminalBackend({controller:new AbortController(),onData:()=>{bytes++;},launch:async callbacks=>{launches++;callbacks.onSession({writeSequenced:async()=>{writes++;return{sequence:1};},resize:async()=>{},close:()=>{}});return{started:false,result:failed('system_disk_full'),helperHash:'b'.repeat(64),outputBytes:0};}});
    await assert.rejects(backend.ready,/system_disk_full/);await assert.rejects(backend.write({sequence:1,bytes:Buffer.from('synthetic')}));const closed=await backend.closed;
    assert.equal(closed.result.error,'system_disk_full');assert.equal(launches,1);assert.equal(writes,0);assert.equal(bytes,0);assert.equal(closed.started,false);
  });
  await check('The original tool boundary publishes the disk code once and keeps uncertain effects conservative',async()=>{
    const attempts=[];let calls=0;
    const boundary=createToolExecutionBoundary({sessionId:owner.sessionId,workspaceKey:output,registry:new SessionExecutionRegistry(),epoch:()=>owner.runId,current:()=>true,waiting:()=>false,onWaiting:()=>()=>{},beforeDelivery:async()=>{},attempt:async a=>attempts.push(a)});
    const result=await boundary.execute({name:'exec_command',label:'合成',description:'合成',parameters:{type:'object',properties:{cmd:{type:'string'}},required:['cmd'],additionalProperties:false},execute:async()=>{calls++;throw Error('system_disk_full');}},'disk_probe',{cmd:'synthetic'},new AbortController().signal,undefined,{});
    assert.equal(calls,1);assert.equal(result.isError,true);const terminal=attempts.at(-1);assert.equal(terminal.code,'system_disk_full');assert.equal(terminal.effect,'unknown');assert.equal(validToolAttempt(terminal),true);assert.equal(attempts.some(a=>a.state==='retrying'),false);assert(result.content.some(c=>c.type==='text'&&c.text.includes('系统盘空间不足')));
  });
  await check('The actual foreground SDK tool preserves runtime-preparation disk errors and public wording',async()=>{
    let calls=0;
    const tool=createTerminalTool({workspace:output,secret:'synthetic-disk-test',sanitize:async text=>text,beforeExecute:()=>{},operations:{exec:async()=>{calls++;throw Error('system_disk_full');}}});
    const result=await tool.execute('foreground-disk',{cmd:'synthetic'},new AbortController().signal,undefined,{cwd:output});
    assert.equal(calls,1);assert.equal(result.isError,true);assert.equal(result.details.error.code,'system_disk_full');assert.equal(result.details.terminal.output,TOOL_EXECUTION_MESSAGES.system_disk_full);
  });
  await check('Existing teacher terminal and tool feedback explains system space and explicit retry',async()=>{
    assert.match(terminalMessage('system_disk_full'),/Windows 系统盘空间不足/);assert.match(terminalMessage('system_disk_full'),/请手动重试/);assert.equal(terminalMessage('system_disk_full'),TOOL_EXECUTION_MESSAGES.system_disk_full);assert(!/[A-Z]:[\\/]/.test(terminalMessage('system_disk_full')));
    const job=terminalJobView({document:{jobId:'term_'+randomUUID(),sessionId:owner.sessionId,taskId:owner.taskId,revision:1,controllerRevision:1,leaseRevision:1,controller:{kind:'teacher'},state:'failed',inputClosed:true,expiresAt:new Date(Date.now()+10000).toISOString(),notice:'system_disk_full',command:'synthetic',cwd:output,tty:true,background:true,createdAt:new Date().toISOString(),cleanup:'complete'},output:'',outputSequence:0,inputSequence:0,acknowledgedInputSequence:0,truncated:false},{live:false,authorized:true});
    assert.equal(job.notice,'system_disk_full');assert.equal(job.controls.write,false);assert.equal(job.acknowledgedInputSequence,0);assert.equal(job.outputSequence,0);
  });
  report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:report.checks.length,output,error:report.error}));}
