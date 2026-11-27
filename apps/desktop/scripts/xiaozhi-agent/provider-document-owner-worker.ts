import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {utilityProcess} from 'electron';
import {extractLocalDocument} from '../../src/main/xiaozhi-agent/document-host';
import {reserveLocalWorker} from '../../src/main/xiaozhi-agent/local-utility-host';
import {hostResourceDiagnostics} from '../../src/main/host-resources/desktop';
import {DOCUMENT_SCHEMA,type DocumentExtraction,type DocumentRequest} from '../../src/shared/xiaozhi-documents';

const output=process.argv[2];
const workerPath=fs.realpathSync(process.env.OMNI_EDU_PROVIDER_DOCUMENT_BUILD!);
const input=fs.readFileSync(fs.realpathSync(process.env.OMNI_EDU_PROVIDER_DOCUMENT_INPUT!));
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
type Owner={pid?:number;killRequests:number;exited?:number;reply?:DocumentExtraction;
  release?:()=>boolean;deliver?:()=>void;counts?:{stdout:number;stderr:number;messages:number}};
const report={success:false,checks:[] as string[],cycles:[] as {
  cancelled:Owner;recovered?:Owner;heldLease?:number;recoveredLease?:number
}[],
  input:sha(input),worker:sha(fs.readFileSync(workerPath)),error:undefined as string|undefined};
const actualFork=utilityProcess.fork.bind(utilityProcess);
let armed=false, last:Owner|undefined;
const leaseEvents=()=>hostResourceDiagnostics().events.filter(event=>event.owner==='local-utility'&&event.phase==='document-worker.js');

async function until<T>(read:()=>T|undefined, label:string) {
  const deadline=performance.now()+10_000;
  do{const found=read();if(found!==undefined)return found;await delay(20);}while(performance.now()<deadline);
  throw Error('Timed out: '+label);
}
function exited(pid:number) {
  try{process.kill(pid,0);return false;}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')return true;throw error;}
}
const request=():DocumentRequest=>({schemaVersion:DOCUMENT_SCHEMA,requestId:'xifile_'+randomUUID(),filename:'approved-paper.docx',bytes:input});
utilityProcess.fork=(modulePath,args,options)=>{
  if(path.basename(modulePath)!=='document-worker.js')return actualFork(modulePath,args,options);
  const child=actualFork(workerPath,args,options);
  const kill=child.kill.bind(child),emit=child.emit.bind(child);
  const owner:Owner={killRequests:0},hold=armed;
  last=owner;
  owner.release=kill;
  child.once('spawn',()=>{owner.pid=child.pid;});
  child.once('exit',code=>{
    setImmediate(()=>{
      owner.exited=code;
      owner.counts={stdout:child.stdout?.listenerCount('data')??0,stderr:child.stderr?.listenerCount('data')??0,
        messages:child.listenerCount('message')};
      delete owner.release;
      delete owner.deliver;
    });
  });
  if(hold){
    child.kill=()=>{owner.killRequests++;return true;};
    child.emit=(name,...values)=>{
      if(name!=='message')return emit(name,...values);
      owner.reply=values[0];
      owner.deliver=()=>{emit(name,...values);};
      return true;
    };
  }
  return child;
};
try{
  for(let ordinal=1;ordinal<=10;ordinal++){
    const spare=Array.from({length:7},()=>reserveLocalWorker());
    assert(spare.every(Boolean),'Seven spare slots must return to baseline');
    try{
      armed=true;
      const previous=last;
      const cancel=new AbortController(),pending=extractLocalDocument(request(),cancel.signal);
      const owner=await until(()=>last!==previous?last:undefined,'real document owner after host admission');
      const heldLease=leaseEvents().findLast(event=>event.state==='started')?.lease;
      assert(heldLease);
      const caseEvidence:typeof report.cycles[number]={cancelled:owner,heldLease};
      report.cycles.push(caseEvidence);
      const reply=await until(()=>owner.reply,'actual owned DOCX parser reply');
      assert(reply.ok&&reply.markdown.includes('PHYSICS-RECOVERY-719')&&owner.pid&&!exited(owner.pid));
      cancel.abort();
      const interrupted=await pending;
      assert(!interrupted.ok&&interrupted.error==='cancelled');
      assert.equal(owner.killRequests,1);
      const blocked=await extractLocalDocument(request(),new AbortController().signal);
      assert(!blocked.ok&&blocked.error==='busy'&&!exited(owner.pid));
      assert(last===owner);
      assert(!leaseEvents().some(event=>event.lease===heldLease&&event.state==='actual_settled'));
      owner.deliver?.();
      assert(!exited(owner.pid));
      assert(owner.release?.(),'Wait for the owned worker after the actual kill request');
      const counts=await until(()=>owner.counts,'actual exit and owned listener cleanup');
      assert(exited(owner.pid));
      assert.deepEqual(counts,{stdout:0,stderr:0,messages:0});
      assert.equal(leaseEvents().filter(event=>event.lease===heldLease&&event.state==='actual_settled').length,1);
      armed=false;
      const recovered=await extractLocalDocument(request(),new AbortController().signal);
      const fresh=last!;
      caseEvidence.recovered=fresh;
      const recoveredLease=leaseEvents().findLast(event=>event.state==='started')?.lease;
      assert(recoveredLease&&recoveredLease!==heldLease);
      caseEvidence.recoveredLease=recoveredLease;
      assert(recovered.ok&&recovered.markdown===reply.markdown&&recovered.requestId!==reply.requestId&&fresh!==owner);
      const freshCounts=await until(()=>fresh.counts,'actual successful parser exit');
      assert(fresh.pid&&exited(fresh.pid));
      assert.deepEqual(freshCounts,{stdout:0,stderr:0,messages:0});
      assert.equal(leaseEvents().filter(event=>event.lease===recoveredLease&&event.state==='actual_settled').length,1);
      assert.equal(sha(input),report.input);
    }finally{
      for(const release of spare)release?.();
    }
  }
  report.checks.push('Ten real document workers hold capacity until physical exit and clean owned listeners after late results');
  report.success=true;
}catch(error){
  report.error=String((error as Error).stack??error);
  last!?.release?.();
  process.exitCode=1;
}finally{
  utilityProcess.fork=actualFork;
  fs.writeFileSync(path.join(output,'REPORT.json'),JSON.stringify(report,null,2),{flag:'wx'});
}
