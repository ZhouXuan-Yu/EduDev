import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url),hash=text=>createHash('sha256').update(text).digest('hex');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'edudev-reply-export-'));
const data=path.join(root,'data'),destination=path.join(root,'exports');fs.mkdirSync(data);fs.mkdirSync(destination);
const suffix='</｜｜DSML｜｜ parameter>\n</｜｜DSML｜｜ invoke>\n</｜｜DSML｜｜ calls>';
let handler,selection,dialogCount,exportCount,row,artifacts,onDialog;
const contents={mainFrame:{}};const window={isDestroyed:()=>false,webContents:contents};
const event={sender:contents,senderFrame:contents.mainFrame};
const electron={dialog:{showOpenDialog:async()=>{dialogCount++;await onDialog?.();return selection;}}};
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const mod={exports:{}};cache.set(file,mod);
  const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',output)(id=>id==='electron'?electron:id.startsWith('.')?load(path.resolve(path.dirname(file),id+'.ts')):require(id),mod,mod.exports);return mod.exports;
}
const {registerReplyExport}=load('src/main/xiaozhi-agent/reply-export.ts');
const ids={sessionId:'aisession_'+randomUUID(),runId:'run_'+randomUUID(),itemId:'answer'};
const payload=text=>({version:1,...ids,requestId:'reply_'+randomUUID(),contentHash:hash(text),title:'合成教学内容'});
const store={getAiConversationSession:async()=>({session:{},messages:[row]}),getDocumentArtifact:async id=>artifacts.get(id),exportDocumentArtifact:async input=>{
  exportCount++;const filePath=path.join(input.destinationRoot,input.artifactId+'.md');fs.writeFileSync(filePath,input.contentMd);const artifact={id:input.artifactId,title:input.title,status:'exported',sessionId:input.sessionId,messageId:input.messageId,contentMd:input.contentMd,filePath,contentHash:hash(input.contentMd)};artifacts.set(input.artifactId,artifact);return artifact;
}};
function reset(text){row={id:'stored-message',role:'assistant',metadata:{agentRunId:ids.runId,piVersion:'xiaozhi.pi.education.v1',publicItems:[{id:'answer',kind:'message',role:'assistant',phase:'final_answer',phaseSource:'explicit',text}]}};selection={canceled:false,filePaths:[destination]};dialogCount=0;exportCount=0;artifacts=new Map();onDialog=undefined;
  registerReplyExport({ipcMain:{handle:(_name,fn)=>handler=fn},store,window:()=>window,dataRoot:data});}
let checks=0;const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
try{
  await check('legacy DSML stored body exports with the actual visible hash; raw record stays immutable',async()=>{
    reset('教学正文。'+suffix);const original=JSON.stringify(row);const input=payload('教学正文。');const result=await handler(event,input);
    assert.equal(result.ok,true,result.error);assert.equal(dialogCount,1);assert.equal(exportCount,1);assert.equal(result.artifact.contentMd,'教学正文。');assert.equal(fs.readFileSync(result.artifact.filePath,'utf8'),'教学正文。');assert.equal(JSON.stringify(row),original);
    const repeated=await handler(event,input);assert.equal(repeated.ok,true);assert.equal(dialogCount,1);assert.equal(exportCount,1,'same request must not write twice');
    fs.appendFileSync(result.artifact.filePath,'外部变更');assert.deepEqual(await handler(event,input),{ok:false,error:'changed'});
  });
  await check('both provider/native closing orders use the same stored public derivation',async()=>{
    for(const text of ['正文'+suffix+'</xiaozhi_answer>','正文</xiaozhi_answer>'+suffix]){reset(text);const original=JSON.stringify(row);assert.equal((await handler(event,payload('正文'))).ok,true);assert.equal(JSON.stringify(row),original);}
  });
  await check('fenced/inline/indented literal tags and math retain their exact hash/export bytes',async()=>{
    for(const text of ['公式 x < y，`'+suffix+'`','正文\n\n    const example = '+suffix.split('\n')[0],'```text\n```not-a-close\n'+suffix]){reset(text);const result=await handler(event,payload(text));assert.equal(result.ok,true);assert.equal(fs.readFileSync(result.artifact.filePath,'utf8'),text);}
  });
  await check('renderer hash cannot substitute forged text or the unfiltered legacy record',async()=>{
    reset('真实正文'+suffix);for(const text of ['伪造正文','真实正文'+suffix])assert.deepEqual(await handler(event,payload(text)),{ok:false,error:'changed'});assert.equal(dialogCount,0);assert.equal(exportCount,0);
  });
  await check('post-directory source re-read still rejects changed persisted prose',async()=>{
    reset('原文'+suffix);onDialog=async()=>{row.metadata.publicItems[0].text='已变化的原文'+suffix;};assert.deepEqual(await handler(event,payload('原文')),{ok:false,error:'changed'});assert.equal(dialogCount,1);assert.equal(exportCount,0);
  });
  await check('directory authorization still rejects application data root',async()=>{
    reset('正文'+suffix);selection.filePaths=[data];assert.deepEqual(await handler(event,payload('正文')),{ok:false,error:'permission_denied'});assert.equal(exportCount,0);
  });
  await check('native folder cancellation and foreign frame retain original guards',async()=>{
    reset('正文'+suffix);selection={canceled:true,filePaths:[]};assert.deepEqual(await handler(event,payload('正文')),{ok:false,error:'cancelled'});assert.equal(exportCount,0);
    assert.deepEqual(await handler({...event,senderFrame:{}},payload('正文')),{ok:false,error:'permission_denied'});assert.equal(dialogCount,1);
  });
  console.log(JSON.stringify({success:true,checks,modelCalls:0,electron:false,boundary:'Actual export IPC handler with mocked dialog/store transport; real directory authority and local file readback. Actual UI pending.'}));
}finally{
  for(const dir of [destination,data]){for(const entry of fs.readdirSync(dir))fs.unlinkSync(path.join(dir,entry));fs.rmdirSync(dir);}fs.rmdirSync(root);
}
