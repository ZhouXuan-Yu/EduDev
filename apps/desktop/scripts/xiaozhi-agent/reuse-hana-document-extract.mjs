import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=process.env.OMNI_EDU_HANA_SOURCE||'D:/WorkProject/开源/openhanako';
const target=path.join(desktop,'src/main/xiaozhi-agent/vendor/hana/lib/document-extract');
const manifestPath=path.join(target,'source-manifest.json');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const names=['index.ts','types.ts','anydoc-loader.ts'];
if(process.argv.includes('--verify')){
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  for(const item of manifest.files){const bytes=fs.readFileSync(path.join(target,item.name));if(hash(bytes)!==item.outputSha256)throw new Error(`Changed vendor file ${item.name}`);}
  console.log(`Verified ${manifest.files.length} Hana document source files`);
}else{
  fs.mkdirSync(target,{recursive:true});
  const files=names.map(name=>{
    const bytes=fs.readFileSync(path.join(source,'lib/document-extract',name));
    const output=Buffer.concat([Buffer.from('// @ts-nocheck\n// Hana 0.449.0 / Apache-2.0; original body preserved. See source-manifest.json.\n'),bytes]);
    fs.writeFileSync(path.join(target,name),output);
    return {name,source:`lib/document-extract/${name}`,sourceSha256:hash(bytes),outputSha256:hash(output),sourceBytes:bytes.length,outputBytes:output.length};
  });
  const license=fs.readFileSync(path.join(source,'LICENSE'));fs.writeFileSync(path.join(target,'LICENSE'),license);
  files.push({name:'LICENSE',source:'LICENSE',sourceSha256:hash(license),outputSha256:hash(license),sourceBytes:license.length,outputBytes:license.length});
  fs.writeFileSync(manifestPath,JSON.stringify({version:1,upstream:'Hana0.449.0',license:'Apache-2.0',adaptation:'Only provenance and ts-nocheck header; no parser logic changes',files},null,2)+'\n');
  console.log(`Copied ${files.length} source/license files`);
}
