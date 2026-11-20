import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const {permissionSystemDiskFreeBytes}=await import('../../src/main/xiaozhi-agent/permissions/windows/runtime-health.ts');
const {createPermissionRuntimeManager}=await import('../../src/main/xiaozhi-agent/permissions/windows/runtime.ts');
const {builtinSandboxManifest,inspectPermissionPlatform}=await import('../../src/main/xiaozhi-agent/permissions/windows/launcher.ts');
const output=fs.mkdtempSync(path.join(path.resolve(process.env.OMNI_EDU_TEST_OUTPUT||os.tmpdir()),'terminal-disk-prepare-'));
const report={success:false,output,checks:[],scope:'Source-only preparation tests with process-local statfs injection. Read-only trusted platform inspection; no helper compilation, AppContainer launch, user command, production build or global environment change.'};
const originalStatfs=fs.promises.statfs;
const check=async(name,action)=>{await action();report.checks.push({name,pass:true});console.log('PASS '+name);};
const owner={sessionId:'aisession_'+randomUUID(),taskId:'synthetic-prepare',runId:'synthetic-prepare',generation:1};
function fixture(name){
  const audits=[],root=path.join(output,name);
  const store={runtimeReceipts:async()=>[],audit:async(_session,kind,_version,data)=>{audits.push({kind,data});if(kind!=='permission_runtime_system_disk_full')throw Error('fixture_ordinary_prepare_error');},auditOnce:async()=>{throw Error('fixture_ordinary_prepare_error');}};
  const manager=createPermissionRuntimeManager({root,store});
  const authority={request:{owner,scopes:[manager.recipe()]},decision:{grantRefs:[],permissionSnapshotHash:'a'.repeat(64)},signal:new AbortController().signal,assert:async()=>{}};
  return {manager,authority,audits,root};
}
try {
  await check('Only a valid Windows system-volume root and exact available bytes are used',async()=>{
    const calls=[];
    fs.promises.statfs=async(root,options)=>{calls.push({root,options});return{bavail:0n,bsize:4096n};};
    assert.equal(await permissionSystemDiskFreeBytes('Z:\\Windows'),0n);
    assert.deepEqual(calls,[{root:'Z:\\',options:{bigint:true}}]);
    for(const directory of ['Windows','\\\\server\\Windows','/tmp/windows'])assert.equal(await permissionSystemDiskFreeBytes(directory),null);
    assert.equal(calls.length,1);
    fs.promises.statfs=async()=>({bavail:1n,bsize:1n});assert.equal(await permissionSystemDiskFreeBytes('Z:\\Windows'),1n);
    fs.promises.statfs=async()=>({bavail:9007199254740993n,bsize:4096n});assert.equal(await permissionSystemDiskFreeBytes('Z:\\Windows'),9007199254740993n*4096n);
    for(const stats of [{bavail:-1n,bsize:4096n},{bavail:0n,bsize:0n},{bavail:0,bsize:4096}]){
      fs.promises.statfs=async()=>stats;assert.equal(await permissionSystemDiskFreeBytes('Z:\\Windows'),null);
    }
    fs.promises.statfs=async()=>{throw Error('fixture_probe_unavailable');};assert.equal(await permissionSystemDiskFreeBytes('Z:\\Windows'),null);
  });
  await check('Denied authority or scope is rejected before probing system capacity',async()=>{
    let probes=0;fs.promises.statfs=async()=>{probes++;return{bavail:0n,bsize:4096n};};
    const a=fixture('denied-current');a.authority.assert=async()=>{throw Error('fixture_stale_owner');};
    await assert.rejects(a.manager.prepare(a.authority,builtinSandboxManifest.sourceSha256),/fixture_stale_owner/);
    const b=fixture('denied-scope');b.authority.request.scopes=[];
    await assert.rejects(b.manager.prepare(b.authority,builtinSandboxManifest.sourceSha256),/permission_denied/);
    const c=fixture('denied-source');await assert.rejects(c.manager.prepare(c.authority,'0'.repeat(64)),/permission_denied/);
    assert.equal(probes,0);assert.equal(a.audits.length+b.audits.length+c.audits.length,0);
  });
  const platform=await inspectPermissionPlatform();
  const trustedRoot=path.win32.parse(platform.windowsDirectory).root;
  await check('Authorized exact zero fails before building, health, persistence or helper reuse',async()=>{
    const calls=[];fs.promises.statfs=async(root,options)=>{calls.push({root,options});return{bavail:0n,bsize:4096n};};
    const f=fixture('zero');
    await assert.rejects(f.manager.prepare(f.authority,builtinSandboxManifest.sourceSha256),/^Error: system_disk_full$/);
    assert.deepEqual(calls,[{root:trustedRoot,options:{bigint:true}}]);
    assert.deepEqual(f.audits,[{kind:'permission_runtime_system_disk_full',data:{owner,error:'system_disk_full',availableBytes:'0'}}]);
    assert.equal(fs.existsSync(f.root),false);
    report.zero={probes:calls.length,auditKind:f.audits[0].kind,managedRootCreated:false};
  });
  await check('Positive capacity including one byte does not replace ordinary preparation errors',async()=>{
    fs.promises.statfs=async()=>({bavail:1n,bsize:1n});const f=fixture('one-byte');
    await assert.rejects(f.manager.prepare(f.authority,builtinSandboxManifest.sourceSha256),/^Error: fixture_ordinary_prepare_error$/);
    assert.equal(f.audits.some(a=>a.kind==='permission_runtime_system_disk_full'),false);
  });
  await check('Unknown capacity preserves ordinary preparation diagnostics without disk classification',async()=>{
    fs.promises.statfs=async()=>{throw Error('fixture_probe_unavailable');};const f=fixture('unknown');
    await assert.rejects(f.manager.prepare(f.authority,builtinSandboxManifest.sourceSha256),/^Error: fixture_ordinary_prepare_error$/);
    assert.equal(f.audits.some(a=>a.kind==='permission_runtime_system_disk_full'),false);
  });
  await check('Authority is checked again after the asynchronous capacity probe',async()=>{
    const f=fixture('late-stale');let checks=0;f.authority.assert=async()=>{if(++checks>1)throw Error('fixture_stale_owner');};
    fs.promises.statfs=async()=>({bavail:0n,bsize:4096n});
    await assert.rejects(f.manager.prepare(f.authority,builtinSandboxManifest.sourceSha256),/fixture_stale_owner/);
    assert.equal(f.audits.length,0);assert.equal(fs.existsSync(f.root),false);
  });
  report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{fs.promises.statfs=originalStatfs;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:report.checks.length,output,error:report.error}));}
