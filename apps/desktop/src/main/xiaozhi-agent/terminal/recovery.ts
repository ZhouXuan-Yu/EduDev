import path from 'node:path';
import type {createTerminalJobState} from './job-state';
import type {PermissionRuntimeManager} from '../permissions/windows/runtime';
import type {PermissionStore} from '../permissions/store';
import {assertOwnedProjection} from '../permissions/windows/projection';
import {runNativeSandbox} from '../permissions/windows/launcher';
import type {TerminalJobRecord} from './job-types';
import {setTimeout as delay} from 'node:timers/promises';

function exited(pid?: number) {
  if(!pid)return false;
  if(!Number.isSafeInteger(pid)||pid<1)throw Error('job_corrupt');
  try{process.kill(pid,0);return false;}
  catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return true;throw error;}
}

/** Cleanup-only maintenance never launches the guest or commits the retained projection. */
export async function recoverTerminalResources(options: {
  jobs: ReturnType<typeof createTerminalJobState>;
  runtime: PermissionRuntimeManager;
  store: PermissionStore;
  notify: (record: TerminalJobRecord) => void;
  signal:AbortSignal;
}) {
  if(process.platform!=='win32')return;
  for(const record of await options.jobs.recoverable()) {
    const doc=record.document;
    try{
      options.signal.throwIfAborted();
      if(!doc.pid||!doc.helperPid)continue;
      const until=Date.now()+5000;
      while((!exited(doc.pid)||!exited(doc.helperPid))&&Date.now()<until)await delay(50,undefined,{signal:options.signal});
      if(!exited(doc.pid)||!exited(doc.helperPid))continue;
      assertOwnedProjection(doc.projection.root);
      const runtime=await options.runtime.readVersion(doc.runtime.version);
      if(path.resolve(runtime.directory)!==path.resolve(doc.runtime.directory)||runtime.manifest.helperSha256!==doc.runtime.helperHash)throw Error('source_changed');
      const processScope=doc.request.scopes.find(scope=>scope.kind==='process');
      if(!processScope||processScope.workspace!==doc.projection.originalRoot)throw Error('source_changed');
      const recovered=await runNativeSandbox({manifest:runtime.manifest,directory:runtime.directory,
        cleanupOnly:true,signal:AbortSignal.any([options.signal,AbortSignal.timeout(10000)]),start:{schemaVersion:1,type:'start',executionId:doc.projection.executionId,
          owner:doc.origin,grantHash:doc.decision.permissionSnapshotHash,executable:processScope.executable,executableHash:processScope.executableHash,
          projectionRoot:doc.projection.root,cwd:doc.projection.root,command:'',env:{},timeoutMs:5000,maxOutputBytes:1024,maxProcesses:1}});
      const cleanup=recovered.result.cleanup;
      if(cleanup.jobActiveProcesses!==0||!cleanup.profileRemoved||cleanup.remainingOwnedAces!==0)throw Error('cleanup_failed');
      await options.store.audit(doc.sessionId,'terminal_job_recovered',doc.jobId,{owner:doc.origin,executionId:doc.projection.executionId,
        runtimeVersion:runtime.version,helperHash:runtime.manifest.helperSha256,cleanup,guestDispatched:false,projectionRetained:true});
      options.notify(await options.jobs.recovered(doc.jobId,doc.revision));
    }catch{
      if(options.signal.aborted)return;
      await options.store.audit(doc.sessionId,'terminal_job_cleanup_required',doc.jobId,{owner:doc.origin,
        executionId:doc.projection.executionId,projectionRetained:true}).catch(()=>undefined);
    }
  }
}
