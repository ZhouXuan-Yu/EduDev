import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifests=[
 ...(process.env.OMNI_EDU_BUNDLE_PAGE_BLOCKS==='1'?[['src/main/xiaozhi-agent/page-blocks-runtime-manifest.json','.local-ocr/blocks-v1-dist/omni-edu-ocr']]:[]),
 ['src/main/xiaozhi-agent/ocr-runtime-manifest.json','.local-ocr/file-v3-dist/omni-edu-ocr'],
 ['src/main/education/runtime-manifest.json','.local-education/dist/omni-edu-education'],
 ['src/main/retrieval/runtime-manifest.json','.local-retrieval/dist/omni-edu-retrieval'],
 ['src/main/retrieval/reranker-runtime-manifest.json','.local-reranker/dist/omni-edu-reranker'],
];
for(const [manifestPath,relative] of manifests){
 const manifest=JSON.parse(fs.readFileSync(path.join(desktop,manifestPath))),root=path.resolve(desktop,relative);
 if(relative.startsWith('.local-reranker')&&JSON.stringify(manifest.model)!==JSON.stringify(JSON.parse(fs.readFileSync(path.join(desktop,'src/main/retrieval/reranker-assets.json')))))throw new Error('Frozen reranker asset lock is stale');
 // An explicitly supplied OCR build asset is copied, never executed or altered in place.
 if(!fs.existsSync(root)&&relative.startsWith('.local-ocr')&&process.env.OMNI_EDU_BUILD_OCR_ROOT){
  const source=path.resolve(process.env.OMNI_EDU_BUILD_OCR_ROOT);
  verify(source,manifest);fs.mkdirSync(path.dirname(root),{recursive:true});fs.cpSync(source,root,{recursive:true,errorOnExist:true,force:false});
 }
 verify(root,manifest);
 for(const input of manifest.buildInputs||[]){if(sha(path.resolve(desktop,'../..',input.path))!==input.sha256)throw new Error('Frozen education runtime is stale: '+input.path);}
 console.log(JSON.stringify({runtime:relative,files:manifest.files.length,bytes:manifest.files.reduce((n,f)=>n+f.size,0)}));
}
function verify(root,manifest){
 if(!fs.existsSync(root)||fs.realpathSync(root).toLowerCase()!==root.toLowerCase())throw new Error('Missing or linked runtime: '+root);
 for(const entry of manifest.files){
  const file=path.resolve(root,entry.path),relative=path.relative(root,file);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Invalid runtime manifest');
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||fs.realpathSync(file).toLowerCase()!==file.toLowerCase()||stat.size!==entry.size||sha(file)!==entry.sha256)throw new Error('Runtime integrity failed: '+entry.path);
 }
}
