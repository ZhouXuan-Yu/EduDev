import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {buildSync} from 'esbuild';
import {_electron} from 'playwright';

// Call only after visually inspecting selected-pdf-page1.png in this authorized root.
// A new receipt refuses reruns. No credentials, raw page text or model responses enter Git.
const [authorizedRoot]=process.argv.slice(2);
assert(authorizedRoot&&path.isAbsolute(authorizedRoot));
const desktop=process.cwd(),sample=path.join(authorizedRoot,'selected-pdf-page1.png');
assert(fs.existsSync(sample));
const ledger=path.join(authorizedRoot,'real-page-prompt-ledger.json');
assert(!fs.existsSync(ledger),'Inspect the previous durable receipt before spending again');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'omni-real-page-prompt-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
fs.mkdirSync(profile);
const sourceState=JSON.parse(fs.readFileSync(path.join(authorizedRoot,'profile','Local State'),'utf8'));
assert(sourceState.os_crypt?.encrypted_key);
fs.writeFileSync(path.join(profile,'Local State'),JSON.stringify({os_crypt:sourceState.os_crypt}));
const db=new DatabaseSync(path.join(authorizedRoot,'data','app.db'),{readOnly:true});
let sealed;
try{sealed=JSON.parse(db.prepare("SELECT value_json FROM app_settings WHERE key='xiaozhi.provider.v1'").get().value_json).sealedKey;}finally{db.close();}
assert(sealed);
const bundle=path.join(desktop,'test-results','kb-real-page-provider.cjs');
buildSync({stdin:{contents:"export {completeMaterialAi} from './src/main/assets/material-ai-provider'; export {parseAiPageResponse,pageTranscriptionAgrees} from './src/shared/material-ai-page';",resolveDir:desktop,loader:'ts'},bundle:true,platform:'node',format:'cjs',packages:'external',outfile:bundle,logLevel:'silent'});
const sampleSha=createHash('sha256').update(fs.readFileSync(sample)).digest('hex');
const report={output,sampleSha,checks:[],scope:'Two actual DeepSeek calls through the production page prompt and parser, only the previously inspected page-1 image, deliberately garbled OCR input; no question publication or natural accuracy/scale acceptance'};
let app;
try{
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_XIAOZHI_PI:'1'};
 for(const k of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[k];
 app=await _electron.launch({args:[path.join(desktop,'out/main/index.js'),'--user-data-dir='+profile],cwd:output,env,timeout:60000});
 report.result=await app.evaluate(async({safeStorage,net},{bundle,sample,sampleSha,sealed,ledger,output})=>{
  const fs=process.getBuiltinModule('fs'),crypto=process.getBuiltinModule('crypto');
  const {completeMaterialAi,parseAiPageResponse,pageTranscriptionAgrees}=process.getBuiltinModule('module').createRequire(bundle)(bundle);
  const apiKey=safeStorage.decryptString(Buffer.from(sealed,'base64'));
  for(const owner of [globalThis,net]){
   const original=owner.fetch.bind(owner);
   owner.fetch=async(url,options)=>{
    if(String(url)!=='https://api.deepseek.com/chat/completions')throw Error('Unapproved endpoint');
    const body=JSON.parse(options.body),images=body.messages[1].content.filter(c=>c.type==='image_url');
    if(body.model!=='deepseek-flash'||images.length!==1||!body.messages[0].content.includes('xiaozhi.material-ai-page-response.v1'))throw Error('Unapproved request');
    const imageSha=crypto.createHash('sha256').update(Buffer.from(images[0].image_url.url.split(',')[1],'base64')).digest('hex');
    if(imageSha!==sampleSha)throw Error('Uninspected image');
    const calls=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];
    if(calls.length>=2)throw Error('Two-call test ceiling exhausted');
    const entry={call:calls.length+1,imageSha,at:new Date().toISOString()};calls.push(entry);fs.writeFileSync(ledger,JSON.stringify(calls));
    const response=await original(url,options);entry.status=response.status;fs.writeFileSync(ledger,JSON.stringify(calls));
    fs.writeFileSync(output+'/response-'+entry.call+'.json',(await response.clone().text()).slice(0,262144));
    return response;
   };
  }
  const input={model:'deepseek-flash',apiKey,text:'OCR识别结果：#??? □□□ 1. 人类... B?? 2. 潭中... ??? 3. 智能家居... 1.5?? 4. 排球 2.8?0.5?',page:true,imageCoverage:true,image:{mime:'image/png',data:fs.readFileSync(sample).toString('base64')}};
  const first=parseAiPageResponse(await completeMaterialAi(input,new AbortController().signal));
  const final=parseAiPageResponse(await completeMaterialAi({...input,previous:first},new AbortController().signal));
  fs.writeFileSync(output+'/first.json',JSON.stringify(first,null,2));fs.writeFileSync(output+'/final.json',JSON.stringify(final,null,2));
  return {transcriptionAgrees:pageTranscriptionAgrees(first,final),firstTextBytes:Buffer.byteLength(first.pageText),finalTextBytes:Buffer.byteLength(final.pageText),pageIssues:final.pageIssues,outcome:final.outcome,questions:final.questions.map(q=>({number:q.number,requiresImage:q.requiresImage,issues:q.issues,answerOrigin:q.answerOrigin,analysisOrigin:q.analysisOrigin})),digitsPreserved:['1.5','2.8','0.5'].map(v=>({value:v,present:final.pageText.includes(v)}))};
 },{bundle,sample,sampleSha,sealed,ledger,output});
 assert.equal(report.result.questions.length,4);
 assert(report.result.finalTextBytes>1000);
 assert(report.result.digitsPreserved.every(x=>x.present));
 report.checks.push('Both real production responses pass the strict page schema; four original question numbers and the inspected numeric conditions remain present');
 report.success=true;
}catch(error){report.success=false;report.error=String(error.stack||error);process.exitCode=1;}
finally{
 await app?.close();report.calls=fs.existsSync(ledger)?JSON.parse(fs.readFileSync(ledger,'utf8')):[];
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
