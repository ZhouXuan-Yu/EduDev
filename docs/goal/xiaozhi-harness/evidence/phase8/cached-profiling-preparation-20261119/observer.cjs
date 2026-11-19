const fs=require('node:fs');
const path=require('node:path');
const {AsyncLocalStorage}=require('node:async_hooks');
const {monitorEventLoopDelay}=require('node:perf_hooks');
module.exports=(output,repo)=>{
 const contract=JSON.parse(fs.readFileSync(path.join(output,'fixture-contract.json'),'utf8'));
 const als=new AsyncLocalStorage(); const rows=[];let count=0;const loop=monitorEventLoopDelay({resolution:20});loop.enable();
 const original={lstat:fs.promises.lstat,stat:fs.promises.stat,copyFile:fs.promises.copyFile};
 const identity=file=>{const base=path.basename(String(file));return ['node.exe','server.mjs','package.json'].includes(base)?{fileClass:base,location:String(file).includes('.runtime')?'projection':'installed',bytes:contract.artifact.binding.files.find(f=>f.path===base)?.bytes}:null;};
 const profile={phase:'setup',withOwner:(owner,action)=>als.run({...als.getStore(),owner},action),finish:report=>{profile.report=report;profile.flush();},permission:()=>null,fileMeta:file=>identity(file)||{fileClass:'other'},
 async span(kind,metadata,action){const start=performance.now();let error;try{return await action();}catch(e){error=e?.message||'error';throw e;}finally{const ctx=als.getStore()||{};const permission=profile.permission?.();rows.push({seq:++count,kind,phase:profile.phase,startMs:start,endMs:performance.now(),...ctx,owner:ctx.owner||permission?.request?.owner||null,callId:permission?.request?.callId||null,...metadata,error});}},
 ownerObject(owner,obj){const controlledId=++count;return new Proxy(obj,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);if(typeof value!=='function')return value;return (...args)=>als.run({owner,controlledId,controlledMethod:String(key)},()=>profile.span('controlled.'+String(key),{},()=>value.apply(target,args)));}});},
 sql(sql){return new Proxy(sql,{get(target,key,receiver){const value=Reflect.get(target,key,receiver);if(typeof value!=='function')return value;if(key==='transaction')return action=>value.call(target,work=>action(profile.sql(work)));if(!['all','get','run','change'].includes(String(key)))return value.bind(target);return (...args)=>{const query=String(args[0]);const table=(query.match(/xiaozhi_capability_(?:registry|provider_versions)_v1/)||[])[0]||'other';return profile.span('registry.sql',{method:String(key),table,operation:query.trim().split(/\s/)[0].toUpperCase()},()=>value.apply(target,args));};}});},
 async seedArtifact(store,dataRoot,state){
  const source=contract.artifact.binding.directory;
  const destination=path.join(dataRoot,'managed-tools/capabilities/versions',contract.operation.plan.digest);
  for(const entry of contract.artifact.installedFiles){const src=path.resolve(source,entry.path),dest=path.resolve(destination,entry.path);if(!src.startsWith(source+path.sep)||!dest.startsWith(destination+path.sep))throw Error('fixture_path_escape');const stat=await original.lstat(src);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size!==entry.bytes)throw Error('fixture_source_changed');fs.mkdirSync(path.dirname(dest),{recursive:true});await original.copyFile(src,dest,fs.constants.COPYFILE_EXCL);}
  const artifact=structuredClone(contract.artifact);artifact.binding.directory=destination;artifact.binding.executable.path=path.join(destination,'node.exe');artifact.revision=1;
  // Public immutable package metadata alone is rehydrated. No sessions, Grants, audits or live database are copied.
  await state.saveArtifact(artifact,0);profile.seededDirectory=destination;profile.phase='cold-session';
 },
 async seedOperation(context,candidateId,id,state){if(await state.operation(id))return;const value=structuredClone(contract.operation);value.id=id;value.owner=structuredClone(context.owner);value.candidateId=candidateId;value.revision=1;value.phase='ready';value.error=null;value.plan.directory=profile.seededDirectory;await state.saveOperation(value,0);},
 flush(){if(profile.flushed)return;profile.flushed=true;loop.disable();for(const [name,value]of Object.entries(original))fs.promises[name]=value;
 const groups={};for(const row of rows){if(!row.owner?.runId)continue;const k=[row.owner.runId,row.kind,row.fileClass||row.table||'',row.location||''].join('|');const g=groups[k]||={owner:row.owner,kind:row.kind,fileClass:row.fileClass,table:row.table,location:row.location,count:0,bytes:0,durationMs:0};g.count++;g.bytes+=row.bytes||0;g.durationMs+=row.endMs-row.startMs;}
 fs.writeFileSync(path.join(output,'profile.json'),JSON.stringify({schemaVersion:1,observation:'inclusive spans must not be added together; hash native helper internal SHA remains validated but not separately instrumented',loop:{minMs:loop.min/1e6,maxMs:loop.max/1e6,meanMs:loop.mean/1e6,p99Ms:loop.percentile(99)/1e6},grouped:Object.values(groups),rows},null,2));}
 };
 globalThis.__phase8=profile;
 for(const name of Object.keys(original))fs.promises[name]=async(...args)=>{const meta=identity(args[0]);if(!meta)return original[name](...args);return profile.span('file.'+name,meta,()=>original[name](...args));};
 process.once('exit',()=>profile.flush());
};
