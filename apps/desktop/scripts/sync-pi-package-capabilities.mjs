// Compile selected upstream capabilities. Never execute a third-party extension installer.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {build} from 'esbuild';
const desktop=path.resolve(import.meta.dirname,'..'),destination=path.join(desktop,'src/main/xiaozhi-agent/vendor/pi-packages');fs.mkdirSync(destination,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),packages=[['pi-web-access','0.36.0'],['@narumitw/pi-usage','0.62.0'],['pi-goal-x','0.32.3']];
const manifest={schemaVersion:1,packages:[],outputs:[]};
for(const[name,version]of packages){const root=path.join(desktop,'node_modules',name),meta=JSON.parse(fs.readFileSync(path.join(root,'package.json')));if(meta.version!==version||meta.license!=='MIT')throw Error('Unreviewed Pi package version/license: '+name);const license=fs.readFileSync(path.join(root,'LICENSE')),file=name.replace(/[^\w-]/g,'_')+'.LICENSE';fs.writeFileSync(path.join(destination,file),license);manifest.packages.push({name,version,license:meta.license,licenseFile:file,licenseSha256:hash(license)});}
const findSource=path.join(desktop,'node_modules/pi-web-access/content-find.ts');
const jobs=[{name:'web-find',options:{entryPoints:[findSource]}},{name:'usage-query',options:{stdin:{contents:`import {usageAdapters} from './node_modules/@narumitw/pi-usage/src/query.ts';
export async function queryDeepSeekBalance(apiKey, signal, guard) {
 const adapter=usageAdapters().find(item=>item.id==='deepseek');
 if(!adapter)throw Error('DeepSeek adapter unavailable');
 return adapter.query({headers:{Authorization:'Bearer '+apiKey},secrets:[apiKey]},signal,10000,guard);
}`,resolveDir:desktop,sourcefile:'pi-usage-host-entry.js'}}}];
for(const job of jobs){const result=await build({...job.options,bundle:true,write:false,format:'esm',platform:'node',target:'node22',packages:'external',metafile:true,legalComments:'inline',logLevel:'silent'});const output=result.outputFiles[0].contents,file=job.name+'.js';fs.writeFileSync(path.join(destination,file),output);const sources=Object.keys(result.metafile.inputs).filter(file=>file.includes('node_modules/')).map(file=>({path:file.replaceAll('\\','/'),sha256:hash(fs.readFileSync(path.resolve(desktop,file)))}));manifest.outputs.push({file,sha256:hash(output),sources});}
fs.writeFileSync(path.join(destination,'source-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log('Compiled reviewed Pi package capabilities: '+manifest.outputs.map(x=>x.file).join(', '));
