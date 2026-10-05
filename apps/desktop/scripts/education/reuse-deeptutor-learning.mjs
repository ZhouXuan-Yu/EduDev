import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),target=path.join(desktop,'src/main/education/vendor/deeptutor-learning');
const revision='f07029cfcf2c8dfccdb671cdfc343db8334f5741',upstream=process.env.DEEPTUTOR_SOURCE_ROOT||'D:/WorkProject/DeepTutor',verify=process.argv.includes('--verify');
const files=['mastery.py','scheduler.py','grading.py','models.py','policy.py'].map(name=>['deeptutor/learning/'+name,name]);files.push(['LICENSE','LICENSE']);
if(!verify)fs.mkdirSync(target,{recursive:true});
const entries=files.map(([source,destination])=>{const bytes=execFileSync('git',['-C',upstream,'show',`${revision}:${source}`],{maxBuffer:1024*1024});
 if(verify){if(!fs.readFileSync(path.join(target,destination)).equals(bytes))throw new Error('Source differs: '+destination);}else fs.writeFileSync(path.join(target,destination),bytes);
 return {source,destination,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
const manifest={schemaVersion:1,repository:'https://github.com/HKUDS/DeepTutor',revision,version:'1.6.13',license:'Apache-2.0',files:entries,
 dependencies:'Python 3.11+ stdlib; no added npm/pip dependency. Original models.py depends on Pydantic but is NOT imported.',
 adaptations:'Original mastery/scheduler/grading run unmodified. models.py AST: two original enums and three DTO field sets projected to stdlib dataclasses; model_copy maps to copy.copy/deepcopy. policy.py AST: selected original constants and seven gate/status/due functions. No LearningStore, AgentLoop, API or pending subsystem.',
 modelProjection:['KnowledgeType','ErrorType','LearningEvidence','RepetitionState','ReviewTask'],
 policyProjection:['QUANTITATIVE_GATE','QUALITATIVE_TYPES','_QUALITATIVE_PASS_DISPLAY','gate_threshold','is_assessed_mastered','mastery_source','is_mastered','display_mastery','objective_status','due_reviews']};
const file=path.join(target,'source-manifest.json');if(verify){if(JSON.stringify(JSON.parse(fs.readFileSync(file,'utf8')))!==JSON.stringify(manifest))throw new Error('Manifest differs');}else fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({verified:verify,revision,files:entries.length,bytes:entries.reduce((n,e)=>n+e.bytes,0)}));
