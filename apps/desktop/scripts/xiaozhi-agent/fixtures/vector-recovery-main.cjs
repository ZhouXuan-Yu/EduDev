const {utilityProcess} = require('electron');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {observeEmbedding} = require('./vector-embedding-observer.cjs');

observeEmbedding(process.env.OMNI_EDU_VECTOR_EVIDENCE_ROOT);

const fork = utilityProcess.fork.bind(utilityProcess);
const capture = globalThis.providerVectorRecovery = {workers:[], requests:[], mode:'observe'};
let first, replacement;
globalThis.armProviderVectorRebuild = active => {
  if (replacement) throw Error('The previous observed utility reply has not been released');
  first=undefined;
  Object.assign(capture,{active,mode:'rebuild-crash',rebuildRequests:0,crash:undefined,replacement:undefined,
    replacementTarget:undefined,oldDelivered:false});
};
utilityProcess.fork = function (modulePath, args, options) {
  if (path.basename(modulePath) !== 'retrieval-worker.js') return fork(modulePath, args, options);
  const child = fork(modulePath, args, options);
  const worker = {instance:capture.workers.length+1, pid:null, closed:false};
  capture.workers.push(worker);
  child.once('spawn', () => {worker.pid=child.pid;});
  child.once('exit', code => {worker.closed=true;worker.exitCode=code;worker.exitedAt=performance.now();});
  const requests = new Map();
  const post = child.postMessage.bind(child);
  child.postMessage = function (message, ...rest) {
    if(message.kind==='embedding.result')return post(message,...rest);
    const request = {worker:worker.instance, id:message.id, operation:message.op,
      generation:message.spec?.id, ids:message.op==='applyMany' ? message.facts.map(fact=>fact.id) : undefined};
    if(capture.requests.length>=2000) throw Error('Test fixture exceeded the bounded observation limit');
    capture.requests.push(request);
    requests.set(request.id,request);
    if(capture.mode==='rebuild-crash' && request.operation==='applyMany' && request.generation!==capture.active){
      capture.rebuildRequests=(capture.rebuildRequests??0)+1;
      if(capture.rebuildRequests===2) request.hold='crash';
      if(first && worker.instance!==first.worker.instance && !capture.replacementTarget){
        capture.replacementTarget=request.id;
        request.hold='replacement';
      }
    }
    return post(message, ...rest);
  };
  const emit = child.emit.bind(child);
  child.emit = function (type, reply, ...rest) {
    const request = type==='message' ? requests.get(reply?.id) : undefined;
    if (request) {
      requests.delete(request.id);
      request.replied=true;
      request.ok=reply.ok;
      if (request.hold==='crash') {
        first={worker, child, emit, reply, request};
        capture.crash={worker:worker.instance, pid:worker.pid, request:request.id, generation:request.generation, ids:request.ids, ok:reply.ok};
        return true;
      }
      if (request.hold==='replacement') {
        replacement={emit, reply, request};
        capture.replacement={worker:worker.instance, pid:worker.pid, request:request.id, generation:request.generation, ids:request.ids, ok:reply.ok};
        return true;
      }
    }
    return emit(type,reply,...rest);
  };
  return child;
};

globalThis.crashProviderVector = () => {
  if (!first?.worker.pid || first.worker.closed || first.child.pid!==first.worker.pid) throw Error('Missing owned utility process');
  return first.child.kill();
};
globalThis.deliverObsoleteProviderVector = () => {
  if (!first?.worker.closed || !replacement) throw Error('The replacement has not reached the original batch boundary');
  first.emit('message',first.reply);
  capture.oldDelivered=true;
};
globalThis.releaseProviderVectorReplacement = () => {
  if (!replacement) throw Error('No actual replacement reply');
  capture.mode='observe';
  replacement.emit('message',replacement.reply);
  replacement=undefined;
};

import(pathToFileURL(process.env.OMNI_EDU_VECTOR_EVIDENCE_MAIN).href).catch(error=>{
  console.error(error.stack??error);
  process.exitCode=1;
});
