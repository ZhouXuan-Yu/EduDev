import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const {validPaperExportIntent,PAPER_EXPORT_INTENT_SCHEMA,copyPaperExportIntent}=await import('../../src/shared/paper-export.ts');
const {validXiaozhiStart}=await import('../../src/shared/xiaozhi-start.ts');
const {createPaperExportTool}=await import('../../src/main/education/paper-export.ts');
let passed=0;
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
const sessionId='aisession_'+randomUUID(),paperId='xipaper_'+randomUUID();
const binding={schemaVersion:PAPER_EXPORT_INTENT_SCHEMA,paperId,digest:'a'.repeat(64),audience:'student',format:'docx',template:'paper'};
const start={sessionId,commandId:'xicmd_'+randomUUID(),prompt:'教师真实请求',paperExportIntent:binding};
await check('strict versioned hint rejects extra, hidden, symbol and accessor fields without reading getters',()=>{
 assert(validPaperExportIntent(binding));let invoked=0;
 const getter={...binding};Object.defineProperty(getter,'digest',{enumerable:true,get(){invoked++;return binding.digest;}});
 for(const invalid of [null,[],{...binding,schemaVersion:'future'},{...binding,paperId:'bad'},{...binding,digest:'B'.repeat(64)},
  {...binding,audience:'teacher',template:'answer_sheet'},{...binding,path:'secret.docx'},getter,
  Object.defineProperty({...binding},'hidden',{value:1}),{...binding,[Symbol('authority')]:true}])assert(!validPaperExportIntent(invalid));
 assert.equal(invoked,0);
});
await check('start carries the exact binding but refuses attachments, continuation, resume or classroom mixing',()=>{
 assert(validXiaozhiStart(start));assert(validXiaozhiStart({sessionId,commandId:start.commandId,prompt:'legacy'}));
 for(const patch of [{attachments:[]},{continueTask:{taskId:'xitask_'+'1'.repeat(64),requirementsVersion:1}},
  {resumeDeliveryId:'xidelivery_'+randomUUID()},{classroomPlan:{}},{paperExportIntent:{...binding,permission:true}}])assert(!validXiaozhiStart({...start,...patch}));
 let invoked=0;assert(!validXiaozhiStart({...start,get paperExportIntent(){invoked++;return binding;}}));assert.equal(invoked,0);
});
const paper={id:paperId,sessionId,title:'合同单元卷 A',digest:binding.digest,state:'confirmed',complete:true,sourceCurrent:true,exportCurrent:true,
 totalPoints:5,answerVerified:false,blueprint:{grade:'初二',subject:'数学',durationMinutes:30,sections:[{id:'one',label:'解答题'}]},
 selection:{items:[{number:1,sectionId:'one',points:5,question:{stem:'求 1+1。',answer:'2',analysis:'相加。',sourceTitle:'单元题'}}]}};
let reviewed=0,latest=0,writes=0,currentPaper=paper,reviewError,proposal,officeReply,officeAfter;
const papers={review:async(s,id)=>{reviewed++;assert.equal(s,sessionId);assert.equal(id,paperId);if(reviewError)throw Error(reviewError);return structuredClone(currentPaper);},
 latest:async()=>{latest++;return {...structuredClone(paper),id:'xipaper_'+randomUUID(),title:'B latest'};}};
const make=(intent=binding)=>createPaperExportTool({papers,sessionId,runId:'unit-run',paperExportIntent:intent,current:()=>true,
 wait:async fn=>fn(),runOffice:async(_sid,_run,_wait,_call,raw)=>{writes++;proposal=raw;officeAfter?.();return officeReply??{content:[],details:{success:true}};}})[0];
const raw={format:'docx',audience:'student',path:'A.docx'};
await check('bound tool reviews exact A and freezes the captured hint even when caller object mutates',async()=>{
 const input=copyPaperExportIntent(binding),tool=make(input);input.paperId='xipaper_'+randomUUID();
 const result=await tool.execute('unit',raw);assert(!result.isError);assert.equal(latest,0);assert.equal(reviewed,1);
 assert.equal(proposal.draft.paperSource.paperId,paperId);assert.equal(proposal.draft.paperSource.digest,binding.digest);
});
await check('model audience/format/template changes reject before repository or Office execution',async()=>{
 const r=reviewed,w=writes;
 for(const patch of [{format:'pdf',path:'A.pdf'},{audience:'teacher'},{template:'answer_sheet'}])assert((await make().execute('unit',{...raw,...patch})).isError);
 assert.equal(reviewed,r);assert.equal(writes,w);assert.equal(latest,0);
});
await check('stale, wrong digest/session, archived, incomplete and changed source never fall back latest',async()=>{
 const w=writes;
 for(const patch of [{exportCurrent:false},{digest:'b'.repeat(64)},{sessionId:'aisession_'+randomUUID()},
  {state:'rejected'},{complete:false},{sourceCurrent:false}]){
  currentPaper={...paper,...patch};assert((await make().execute('unit',raw)).isError);
 }
 for(const failure of ['permission_denied','not_found','source_changed','configuration']){
  reviewError=failure;assert((await make().execute('unit',raw)).isError);
 }
 reviewError=undefined;currentPaper=paper;assert.equal(writes,w);assert.equal(latest,0);
});
await check('bound stale reads report source-changed recovery instead of a send-record conflict; model spec mismatch remains separate',async()=>{
 const w=writes;currentPaper={...paper,exportCurrent:false};
 const result=await make().execute('stale',raw),message=JSON.parse(result.content[0].text);
 assert(result.isError);assert.equal(message.error,'paper_export_source_changed');assert(message.message.includes('请回到组卷重新核对并准备请求'));
 assert(!message.message.includes('重新发送'));assert.equal(writes,w);assert.equal(latest,0);
 currentPaper=paper;const mismatch=await make().execute('mismatch',{...raw,audience:'teacher'});
 assert(mismatch.isError);assert.notEqual(JSON.parse(mismatch.content[0].text).error,'paper_export_source_changed');assert.equal(writes,w);
});
await check('late Office conflict is classified as stale only after exact read proves that binding changed; unrelated conflicts/rejection stay intact',async()=>{
 officeReply={content:[{type:'text',text:JSON.stringify({success:false,outcome:'conflict',message:'原Office冲突'})}],details:{success:false},isError:true};
 officeAfter=()=>{currentPaper={...paper,exportCurrent:false};};
 const stale=await make().execute('after-office',raw);
 assert(stale.isError);assert.equal(JSON.parse(stale.content[0].text).error,'paper_export_source_changed');assert.equal(proposal.draft.paperSource.paperId,paperId);
 currentPaper=paper;officeAfter=undefined;
 assert.deepEqual(await make().execute('target-conflict',raw),officeReply);
 officeReply={content:[{type:'text',text:JSON.stringify({success:false,outcome:'rejected',message:'原教师拒绝'})}],details:{success:false},isError:true};
 officeAfter=()=>{currentPaper={...paper,exportCurrent:false};};
 assert.deepEqual(await make().execute('teacher-rejected',raw),officeReply);assert.equal(latest,0);
 currentPaper=paper;officeAfter=undefined;officeReply=undefined;
});
await check('invalid binding and missing exact review reader fail closed, while old unbound requests retain latest',async()=>{
 const w=writes;assert((await make({...binding,extra:true}).execute('unit',raw)).isError);
 const missing=createPaperExportTool({papers:{latest:papers.latest},paperExportIntent:binding,sessionId,runId:'unit',current:()=>true,wait:async fn=>fn(),runOffice:async()=>assert.fail()})[0];
 assert((await missing.execute('unit',raw)).isError);assert.equal(writes,w);assert.equal(latest,0);
 assert(!(await make(undefined).execute('unit',raw)).isError);
 // Default argument means bound; explicitly omit the option for legacy compatibility.
 const legacy=createPaperExportTool({papers,sessionId,runId:'unit',current:()=>true,wait:async fn=>fn(),runOffice:async()=>({content:[],details:{success:true}})})[0];
 assert(!(await legacy.execute('legacy',raw)).isError);assert.equal(latest,1);
});
console.log(JSON.stringify({success:true,passed,scope:'Actual shared validators and production tool, controlled repository/Office callbacks; no provider/Electron/file delivery claim'}));
