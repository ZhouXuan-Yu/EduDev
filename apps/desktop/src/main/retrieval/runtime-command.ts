import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import manifest from './runtime-manifest.json' with {type:'json'};
export function retrievalRuntimeRoots(options:{packaged:boolean;resourcesPath:string;moduleDir:string;repoRoot?:string}){
 if(options.packaged)return {embedding:path.join(options.resourcesPath,'retrieval-runtime'),reranker:path.join(options.resourcesPath,'reranker-runtime')};
 if(options.repoRoot&&!path.isAbsolute(options.repoRoot))throw Error('embedding_unavailable');
 const desktop=options.repoRoot?path.join(options.repoRoot,'apps','desktop'):path.resolve(options.moduleDir,'../..');
 return {embedding:path.join(desktop,'.local-retrieval','dist','omni-edu-retrieval'),reranker:path.join(desktop,'.local-reranker','dist','omni-edu-reranker')};
}
export async function verifyRetrievalRuntime(root:string){
 try{
  if(!path.isAbsolute(root)||(await fs.realpath(root)).toLowerCase()!==root.toLowerCase())throw Error('embedding_unavailable');
  for(const item of manifest.files){const file=path.resolve(root,item.path),relative=path.relative(root,file),stat=await fs.lstat(file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||!stat.isFile()||stat.isSymbolicLink()||stat.size!==item.size||(await fs.realpath(file)).toLowerCase()!==file.toLowerCase())throw Error('embedding_unavailable');
    const digest=createHash('sha256');for await(const bytes of createReadStream(file,{highWaterMark:256*1024}))digest.update(bytes);
    if(digest.digest('hex')!==item.sha256)throw Error('embedding_unavailable');
  }
  return path.join(root,manifest.executable);
 }catch(error){
  if(['ENOENT','ENOTDIR','EACCES','EPERM'].includes((error as NodeJS.ErrnoException).code||''))throw Error('embedding_unavailable');
  throw error;
 }
}
