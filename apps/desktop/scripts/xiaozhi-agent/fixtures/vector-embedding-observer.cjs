const {pathToFileURL} = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const cp = require('node:child_process');
const {syncBuiltinESMExports} = require('node:module');
const {StringDecoder} = require('node:string_decoder');

const [entry, root] = process.argv.slice(2);
const flag = name => path.join(root, name);
const log = (event, detail) => fs.appendFileSync(flag('embedding-trace.jsonl'), JSON.stringify({event, utility:process.pid, at:Date.now(),...detail})+'\n');
const spawn = cp.spawn;
cp.spawn = function (file,...args) {
  const child = spawn.call(this,file,...args);
  if (path.basename(file)!=='omni-edu-retrieval.exe') return child;
  const pid=child.pid, decoder=new StringDecoder('utf8'), push=child.stdout.push.bind(child.stdout), write=child.stdin.write.bind(child.stdin), kill=child.kill.bind(child);
  let active, pending='', held=[], holding=false, timer;
  log('spawn',{pid});
  child.once('close',(code,signal)=>{clearInterval(timer);log('close',{pid,code,signal});});
  child.stdin.write = function (raw,...rest) {
    let request;
    try {request=JSON.parse(raw.toString());} catch {return write(raw,...rest);}
    if (request.role==='query' && !active && fs.existsSync(flag('hold-next-query'))){
      fs.renameSync(flag('hold-next-query'), flag('owned-query-marker'));
      active=request.requestId;
      holding=true;
      log('query_dispatched',{pid,request:active});
    } else if(request.role==='query' && fs.existsSync(flag('owned-query-marker'))) {
      log('query_dispatched',{pid,request:request.requestId});
    }
    return write(raw,...rest);
  };
  child.stdout.push = function (chunk,...rest) {
    if (!holding || !chunk) return push(chunk,...rest);
    held.push([chunk,rest]);
    pending+=decoder.write(chunk);
    if(Buffer.byteLength(pending)>2097152)throw Error('Test fixture exceeded embedding response quota');
    let end;
    while((end=pending.indexOf('\n'))>=0){
      const message=JSON.parse(pending.slice(0,end));
      pending=pending.slice(end+1);
      if(message.kind==='result'&&message.requestId===active)
        log('native_reply_held',{pid,request:active,windows:message.values.length});
    }
    return true;
  };
  child.kill = function (...rest) {
    if (!active || !holding) return kill(...rest);
    if (!timer) {
      log('kill_requested',{pid,request:active});
      let delivered=false;
      const deadline=Date.now()+20000;
      timer=setInterval(()=>{
        if(!delivered&&fs.existsSync(flag('deliver-late-embedding'))){
          delivered=true;
          for(const [chunk,options] of held)push(chunk,...options);
          log('late_native_reply_delivered',{pid,request:active,bytes:held.reduce((sum,[chunk])=>sum+chunk.length,0)});
          held=[];
        }
        if (Date.now()>=deadline || fs.existsSync(flag('release-old-embedding'))){
          clearInterval(timer);
          holding=false;
          kill(...rest);
        }
      },25);
      timer.unref();
    }
    return true;
  };
  return child;
};
syncBuiltinESMExports();
import(pathToFileURL(entry).href).catch(error=>{console.error(error.stack??error);process.exitCode=1;});
