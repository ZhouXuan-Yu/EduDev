import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const target=path.join(desktop,'src/main/education/vendor/deeptutor-reading');
const revision='f07029cfcf2c8dfccdb671cdfc343db8334f5741';
const upstream=process.env.DEEPTUTOR_SOURCE_ROOT||'D:/WorkProject/DeepTutor';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=[['deeptutor/reading/search.py','search.py'],['deeptutor/reading/models.py','models.py'],['LICENSE','LICENSE']];
const verify=process.argv.includes('--verify');
if(!verify)fs.mkdirSync(target,{recursive:true});
const entries=files.map(([source,destination])=>{
 const bytes=execFileSync('git',['-C',upstream,'show',`${revision}:${source}`],{maxBuffer:1024*1024});
 if(verify){if(!fs.readFileSync(path.join(target,destination)).equals(bytes))throw new Error(`Source differs: ${destination}`);}
 else fs.writeFileSync(path.join(target,destination),bytes);
 return {source,destination,bytes:bytes.length,sha256:hash(bytes)};
});
const manifest={schemaVersion:1,repository:'https://github.com/HKUDS/DeepTutor',revision,version:'1.6.13',license:'Apache-2.0',files:entries,dependencies:'Python stdlib only; no AgentLoop, Store, HTTP or model',adaptations:'None in vendored files. Namespace loading and protocol live in reading-worker.py.'};
const manifestPath=path.join(target,'source-manifest.json');
if(verify){if(JSON.stringify(JSON.parse(fs.readFileSync(manifestPath,'utf8')))!==JSON.stringify(manifest))throw new Error('Manifest differs');}
else fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({verified:verify,revision,files:entries.length,bytes:entries.reduce((n,f)=>n+f.bytes,0)}));
