import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import manifest from './runtime-manifest.json' with {type:'json'};

export type EducationWorker='reading'|'learning'|'question'|'math';
/** Only packaged resources are executable; no renderer/model/environment supplied path. */
export async function frozenEducationCommand(resourcesPath:string,worker:EducationWorker,signal?:AbortSignal){
 if(!['reading','learning','question','math'].includes(worker)||process.platform!=='win32')throw new Error('unavailable');
 const root=path.resolve(resourcesPath,'education-runtime');
 if((await fs.promises.realpath(root)).toLowerCase()!==root.toLowerCase())throw new Error('unavailable');
 for(const item of manifest.files){
  signal?.throwIfAborted();
  const target=path.resolve(root,item.path),relative=path.relative(root,target);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('unavailable');
  const stat=await fs.promises.lstat(target);
  if(!stat.isFile()||stat.isSymbolicLink()||(await fs.promises.realpath(target)).toLowerCase()!==target.toLowerCase()||stat.size!==item.size||createHash('sha256').update(await fs.promises.readFile(target,{signal})).digest('hex')!==item.sha256)throw new Error('unavailable');
 }
 return {command:path.join(root,manifest.executable),args:['--worker',worker,'--parent-pid',String(process.pid)]};
}
