import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {SessionManager,parseSessionEntries} from '@earendil-works/pi-coding-agent';

type Entry = {manager:SessionManager;scope:string;busy:boolean;hash?:string;idleSince:number};
export type NativeSessionLease = {manager:SessionManager;hit:boolean;release:(retain?:boolean)=>void};
/**
 * Hana-style loaded/idle lifecycle for Pi's native history resource only.
 * Credentials, AgentSession, run tools, authority and event callbacks never enter this pool.
 */
export function createNativeSessionResources(options:{
  maxIdle?:number;idleMs?:number;maxBytes?:number;maxRss?:number;
  now?:()=>number;rss?:()=>number;
}={}) {
  const entries=new Map<string,Entry>(),now=options.now||Date.now,rss=options.rss||(()=>process.memoryUsage().rss);
  const maxIdle=options.maxIdle??4,idleMs=options.idleMs??120000,maxBytes=options.maxBytes??16*1024*1024,maxRss=options.maxRss??1024*1024*1024;
  const key=(file:string)=>path.resolve(file).toLowerCase();
  const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
  let timer:ReturnType<typeof setTimeout>|undefined;
  function prune() {
    const pressure=rss()>maxRss;
    for(const [id,entry]of entries)if(!entry.busy&&(pressure||now()-entry.idleSince>=idleMs))entries.delete(id);
    const idle=[...entries].filter(([,entry])=>!entry.busy).sort((a,b)=>b[1].idleSince-a[1].idleSince);
    for(const [id]of idle.slice(maxIdle))entries.delete(id);
    if(timer)clearTimeout(timer);
    const remaining=[...entries.values()].filter(entry=>!entry.busy).map(entry=>Math.max(1,idleMs-(now()-entry.idleSince)));
    timer=remaining.length?setTimeout(prune,Math.min(...remaining)):undefined;
    timer?.unref();
  }
  return {
    acquire(input:{file?:string;sessionDir:string;workspace:string;scope:string}):NativeSessionLease {
      prune();
      const id=input.file?key(input.file):undefined,previous=id?entries.get(id):undefined;
      if(previous?.busy)throw Error('busy');
      let manager:SessionManager|undefined,hit=false;
      if(previous&&previous.scope===input.scope) {
        try {
          const stat=fs.statSync(input.file!);
          if(stat.size<=maxBytes&&digest(fs.readFileSync(input.file!))===previous.hash){manager=previous.manager;hit=true;}
        }catch{/* Changed/missing native history is reopened through the normal Pi path. */}
      }
      if(id)entries.delete(id);
      manager??=input.file?SessionManager.open(input.file,input.sessionDir,input.workspace):SessionManager.create(input.workspace,input.sessionDir);
      const file=manager.getSessionFile();
      if(!file)throw Error('configuration');
      const nativeKey=key(file);
      if(entries.get(nativeKey)?.busy)throw Error('busy');
      const entry:Entry={manager,scope:input.scope,busy:true,idleSince:now()};
      entries.set(nativeKey,entry);
      let released=false;
      return {manager,hit,release(retain=true) {
        if(released)return;
        released=true;
        if(entries.get(nativeKey)!==entry)return;
        try {
          if(!retain||rss()>maxRss||fs.statSync(file).size>maxBytes)throw Error('evict');
          const bytes=fs.readFileSync(file);
          // Do not bless an external append/rewrite that the live manager never observed.
          const preview=SessionManager.inMemory(input.workspace,undefined,parseSessionEntries(bytes.toString('utf8')));
          if(JSON.stringify(preview.getEntries())!==JSON.stringify(manager.getEntries()))throw Error('changed');
          entry.hash=digest(bytes);entry.idleSince=now();entry.busy=false;
        }catch{entries.delete(nativeKey);}
        prune();
      }};
    },
    clearIdle() {for(const [id,entry]of entries)if(!entry.busy)entries.delete(id);prune();},
    stats:()=>({active:[...entries.values()].filter(e=>e.busy).length,idle:[...entries.values()].filter(e=>!e.busy).length}),
  };
}

export const nativeSessionResources=createNativeSessionResources();
