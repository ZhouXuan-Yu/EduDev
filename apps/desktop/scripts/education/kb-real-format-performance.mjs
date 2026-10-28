import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import {performance} from 'node:perf_hooks';
const [revision,responseFile,outputFile]=process.argv.slice(2);
if(!revision||!path.isAbsolute(responseFile)||!path.isAbsolute(outputFile))throw Error('BASE_REV ABS_PRIVATE_RESPONSE ABS_OUTPUT');
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),sourcePath=path.join(desktop,'src/main/assets/material-ai-provider.ts');
const captured=JSON.parse(fs.readFileSync(responseFile,'utf8')),document=JSON.parse(captured.choices[0].message.content);
delete document.type;captured.choices[0].message.content=JSON.stringify(document);
const wire=JSON.stringify(captured),original=globalThis.fetch;
async function compile(source){
 for(const specifier of ['../../shared/material-ai','../../shared/material-ai-native-response','../xiaozhi-agent/deepseek-fetch'])source=source.replace("'"+specifier+"'","'"+pathToFileURL(path.resolve(path.dirname(sourcePath),specifier+'.ts')).href+"'");
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 return (await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).completeMaterialAi;
}
try{
 globalThis.fetch=async()=>new Response(wire,{status:200});
 const before=await compile(execFileSync('git',['show',revision+':apps/desktop/src/main/assets/material-ai-provider.ts'],{cwd:desktop,encoding:'utf8'})),after=await compile(fs.readFileSync(sourcePath,'utf8'));
 const values={before:[],after:[]};
 for(let sample=0;sample<32;sample++)for(const [name,complete] of sample%2?[['after',after],['before',before]]:[['before',before],['after',after]]){
  const start=performance.now();for(let i=0;i<50;i++)await complete({model:'deepseek-flash',apiKey:'offline-no-key',text:'local parsing benchmark'},new AbortController().signal);
  if(sample>=2)values[name].push((performance.now()-start)/50);
 }
 const stats=Object.fromEntries(Object.entries(values).map(([name,samples])=>{samples.sort((a,b)=>a-b);return[name,{samples:samples.length,medianMs:samples[Math.floor(samples.length/2)],p95Ms:samples[Math.ceil(samples.length*.95)-1]}];}));
 const report={scope:'Offline controlled HTTP body and canonical business JSON, 30 alternating batches of 50 responses after warmup. No network/provider, UI streaming or large-library performance claim.',revision,...stats};
 fs.writeFileSync(outputFile,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{globalThis.fetch=original;}
