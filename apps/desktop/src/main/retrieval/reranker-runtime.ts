import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import manifest from './reranker-runtime-manifest.json' with {type:'json'};
export async function verifyRerankerRuntime(root:string){
  if(!path.isAbsolute(root)||(await fs.realpath(root)).toLowerCase()!==root.toLowerCase())throw Error('reranker_unavailable');
  for(const item of manifest.files){const file=path.resolve(root,item.path),relative=path.relative(root,file),stat=await fs.lstat(file);
    if(relative.startsWith('..')||path.isAbsolute(relative)||!stat.isFile()||stat.isSymbolicLink()||stat.size!==item.size||(await fs.realpath(file)).toLowerCase()!==file.toLowerCase())throw Error('reranker_unavailable');
    const digest=createHash('sha256');for await(const bytes of createReadStream(file,{highWaterMark:256*1024}))digest.update(bytes);
    if(digest.digest('hex')!==item.sha256)throw Error('reranker_unavailable');
  }
  return path.join(root,manifest.executable);
}
