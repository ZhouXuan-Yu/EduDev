import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const target=path.join(desktop,'src/main/education/vendor/deeptutor-question');
const revision='f07029cfcf2c8dfccdb671cdfc343db8334f5741';
const upstream=process.env.DEEPTUTOR_SOURCE_ROOT||'D:/WorkProject/DeepTutor';
const verify=process.argv.includes('--verify');
if(!verify)fs.mkdirSync(target,{recursive:true});
const entries=[['deeptutor/agents/question/pipeline.py','pipeline.py'],['LICENSE','LICENSE']].map(([source,destination])=>{
 const bytes=execFileSync('git',['-C',upstream,'show',`${revision}:${source}`],{maxBuffer:1024*1024});
 if(verify){if(!fs.readFileSync(path.join(target,destination)).equals(bytes))throw new Error('Source differs: '+destination);}else fs.writeFileSync(path.join(target,destination),bytes);
 return {source,destination,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
});
const manifest={schemaVersion:1,repository:'https://github.com/HKUDS/DeepTutor',revision,version:'1.6.13',license:'Apache-2.0',files:entries,
 projection:{enum:'QuestionType',constants:['_CHOICE_KEYS','_FILL_IN_BLANK_TOKEN','_CONCEPT_ANSWERS'],methods:['_parse_quiz_payload','_normalize_quiz_payload','_collect_quiz_issues']},
 dependencies:'Python 3.11+ stdlib only; original module imports never execute. No AgentLoop/Store/LLM/Pydantic.',
 adaptations:'Unmodified Git blobs. Worker extracts exact AST enum/constants and three original method bodies with original decorators into a projected class; template is host-owned SimpleNamespace. Strict JSON parser injection rejects duplicate keys/nonfinite values; EduDev bounds and schema outside original bodies.'};
const file=path.join(target,'source-manifest.json');
if(verify){if(JSON.stringify(JSON.parse(fs.readFileSync(file)))!==JSON.stringify(manifest))throw new Error('Manifest differs');}else fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({verified:verify,revision,files:entries.length,bytes:entries.reduce((n,e)=>n+e.bytes,0)}));
