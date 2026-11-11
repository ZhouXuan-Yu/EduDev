import '../office-agent/register-source.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const {verifyRetrievalRuntime,retrievalRuntimeRoots}=await import('../../src/main/retrieval/runtime-command.ts');
const root=await fs.mkdtemp(path.join(tmpdir(),'omni-edu-retrieval-runtime-'));
const checks=[];
const check=async(name,action)=>{await action();checks.push(name);console.log('PASS '+name);};
try{
 await check('Missing component directory reports embedding_unavailable',async()=>{
  await assert.rejects(verifyRetrievalRuntime(path.join(root,'missing')),error=>error.message==='embedding_unavailable');
 });
 await check('Incomplete component directory reports embedding_unavailable',async()=>{
  await assert.rejects(verifyRetrievalRuntime(root),error=>error.message==='embedding_unavailable');
 });
 await check('Altered component bytes are refused before execution',async()=>{
  const manifest=JSON.parse(await fs.readFile(new URL('../../src/main/retrieval/runtime-manifest.json',import.meta.url),'utf8'));
  const first=path.join(root,manifest.files[0].path);
  await fs.mkdir(path.dirname(first),{recursive:true});await fs.writeFile(first,'invalid native component');
  await assert.rejects(verifyRetrievalRuntime(root),error=>error.message==='embedding_unavailable');
 });
 await check('Relative and linked component roots are refused',async()=>{
  await assert.rejects(verifyRetrievalRuntime('relative-runtime'),error=>error.message==='embedding_unavailable');
  const link=root+'-linked';await fs.symlink(root,link,'junction');
  try{await assert.rejects(verifyRetrievalRuntime(link),error=>error.message==='embedding_unavailable');}finally{await fs.unlink(link);}
 });
 await check('Packaged resources keep their authority even with a development repository override',async()=>{
  const roots=retrievalRuntimeRoots({packaged:true,resourcesPath:root,moduleDir:path.join(root,'out','main'),repoRoot:'untrusted-relative-override'});
  assert.equal(roots.embedding,path.join(root,'retrieval-runtime'));
  assert.equal(roots.reranker,path.join(root,'reranker-runtime'));
 });
 await check('Ordinary and relocated development builds resolve the same explicit local assets',async()=>{
  const repo=path.join(root,'repo'),desktop=path.join(repo,'apps','desktop');
  const normal=retrievalRuntimeRoots({packaged:false,resourcesPath:root,moduleDir:path.join(desktop,'out','main')});
  const relocated=retrievalRuntimeRoots({packaged:false,resourcesPath:root,moduleDir:path.join(root,'frozen','out','main'),repoRoot:repo});
  assert.deepEqual(relocated,normal);
  assert.equal(normal.embedding,path.join(desktop,'.local-retrieval','dist','omni-edu-retrieval'));
  assert.throws(()=>retrievalRuntimeRoots({packaged:false,resourcesPath:root,moduleDir:root,repoRoot:'relative'}),/embedding_unavailable/);
 });
 console.log(JSON.stringify({passed:checks.length,checks,root,scope:'Real filesystem and pinned production manifest. No fake component execution or positive native inference claim.'}));
}finally{/* Evidence directories remain available for inspection. */}
