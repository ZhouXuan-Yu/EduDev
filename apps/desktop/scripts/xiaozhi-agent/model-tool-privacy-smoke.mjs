import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createModelToolPrivacy} from '../../src/main/xiaozhi-agent/model-tool-privacy.ts';
import {getPiProtectedContext} from '../../src/main/xiaozhi-agent/compaction-context.ts';

let inventories=0,current=true;const clean=async text=>text.replaceAll('SyntheticCampusWillow','[个人信息]').replaceAll('D:\\private\\source.txt','[本地路径]');
const privacy=createModelToolPrivacy({sanitizer:async()=>{inventories++;return clean;},current:()=>current});
const secret='SyntheticCampusWillow D:\\private\\source.txt',safe='[个人信息] [本地路径]',version='d'.repeat(64),details={local:{path:secret},terminal:{output:secret}};
const message=(toolName,value)=>({role:'toolResult',toolName,toolCallId:'actual_call',content:[{type:'text',text:JSON.stringify(value)}],details});
const payload=value=>JSON.parse(value.content[0].text),checks=[];
async function check(name,action){await action();checks.push(name);console.log('PASS '+name);}
await check('Unknown image/large-compute tools bypass sanitizer and retain input identity',async()=>{
 const input=[message('education_compute',{result:'x'.repeat(1048576)})];assert.equal(await privacy.context(input),input);assert.equal(inventories,0);
});
await check('Office body, citation and title use one sanitizer without changing source versions or line locators',async()=>{
 const source={title:secret,version,locator:{kind:'extracted_lines',start:1,end:3,partialLine:false},originalPageLocated:false},input=[message('office_read_document',{success:true,text:secret+'\n2x+3=9',source,citation:secret})],original=JSON.stringify(input);
 const output=await privacy.context(input),value=payload(output[0]);assert.equal(JSON.stringify(input),original);assert.equal(output[0].details,details);assert.equal(value.text,safe+'\n2x+3=9');assert.equal(value.source.title,safe);assert.equal(value.citation,safe);assert.equal(value.source.version,version);assert.deepEqual(value.source.locator,source.locator);assert.equal(inventories,1);
});
await check('Attachment list-to-read selection uses unchanged id/revision and immutable local evidence',async()=>{
 const id='xiat_123',input=[message('office_list_attachments',{success:true,items:[{id,revision:7,name:secret,format:'office',size:20}],total:1}),message('office_read_attachment',{success:true,text:secret,source:{attachmentId:id,version,title:secret,locator:{start:1,end:1}},citation:secret})],original=JSON.stringify(input),output=await privacy.context(input);
 assert.equal(JSON.stringify(input),original);assert.deepEqual(payload(output[0]).items[0],{id,revision:7,name:safe,format:'office',size:20});assert.equal(payload(output[1]).source.attachmentId,id);assert.equal(payload(output[1]).source.version,version);assert.equal(payload(output[1]).text,safe);assert.equal(inventories,2);
});
await check('Foreground and all persistent terminal wrappers preserve job IDs, ACKs, revisions and raw teacher output',async()=>{
 const terminal={output:secret,command:secret,cwd:secret,state:'completed',exitCode:0},job={jobId:'term_unchanged',taskId:'task_unchanged',revision:3,controllerRevision:4,leaseRevision:5,terminal,outputSequence:8,inputSequence:2,cleanup:'complete'},ack={jobId:job.jobId,commandId:'xicmd_unchanged',sequence:2,state:'acknowledged'};
 const input=[message('exec_command',terminal),message('exec_command',job),message('write_stdin',{job,ack}),message('list_terminals',{jobs:[job]}),message('close_terminal',job)],original=JSON.stringify(input),output=await privacy.context(input);
 assert.equal(JSON.stringify(input),original);for(const [index,actual] of output.entries()){assert.equal(actual.details,details);assert(!actual.content[0].text.includes('SyntheticCampusWillow'));if(index>0){const value=payload(actual),next=value.job||value.jobs?.[0]||value;assert.equal(next.jobId,job.jobId);assert.equal(next.revision,3);assert.equal(next.controllerRevision,4);assert.equal(next.leaseRevision,5);assert.equal(next.terminal.output,safe);}}
 assert.deepEqual(payload(output[2]).ack,ack);assert.equal(inventories,3);
});
await check('Old process labels and appended citations are cleaned only in the outbound copy',async()=>{
 const input=[message('read_session_process',{trace:{runId:'run_unchanged',status:'succeeded',events:[{sequence:1,label:secret,tool:'office_read_document',status:'succeeded'}]}}),{...message('office_read_document',{success:false}),content:[{type:'text',text:secret}]}],original=JSON.stringify(input),output=await privacy.context(input);
 assert.equal(JSON.stringify(input),original);assert.equal(payload(output[0]).trace.events[0].label,safe);assert.equal(payload(output[0]).trace.runId,'run_unchanged');assert.equal(output[1].content[0].text,safe);assert.equal(inventories,4);
});
await check('Clean typed results keep exact bytes; cancelled/revoked sanitizer work never returns raw fallback',async()=>{
 const input=[message('office_read_document',{success:true,text:'2x+3=9',source:{title:'lesson.docx',version}})];assert.equal((await privacy.context(input))[0],input[0]);
 current=false;await assert.rejects(privacy.context(input),/permission_denied/);current=true;const abort=new AbortController();abort.abort();await assert.rejects(privacy.context(input,abort.signal));
 const failing=createModelToolPrivacy({sanitizer:async()=>{throw Error('inventory_unavailable');}});await assert.rejects(failing.context(input),/inventory_unavailable/);
});
await check('Recovered local display fields are sanitized while hashes, IDs, states and raw records stay exact',async()=>{
 const approvals=[{source:secret,target:secret,state:'executed',sourceSha256:version}],changes=[{path:secret,operation:'edit',state:'applied'}],artifacts=[{path:secret,format:'docx',state:'saved',artifactId:'artifact_unchanged'}],controls=[{kind:'plan',steps:[{text:secret,status:'pending'}]}],messages=[{metadata:{piVersion:'xiaozhi.pi.education.v1',publicItems:[{kind:'tool',sources:[{title:secret}]}]}}],before=JSON.stringify({approvals,changes,artifacts,controls,messages});
 const store={xiaozhiState:{controls:async()=>controls,approvals:async()=>approvals,changes:{list:async()=>changes},officeArtifacts:{list:async()=>artifacts}},getAiConversationSession:async()=>({session:{},messages}),sanitizeProblemText:async text=>({sanitizedText:text})};
 const result=await getPiProtectedContext(store,'owned',[],undefined,clean);assert(!result.includes('SyntheticCampusWillow'));assert(!result.includes('private'));assert(result.includes(version));assert(result.includes('artifact_unchanged'));assert(result.includes('executed'));assert.equal(JSON.stringify({approvals,changes,artifacts,controls,messages}),before);
});
await check('Already persisted host user indexes project only known display fields and retain raw native message',async()=>{
 const text=['[小智本会话本地记录，非新增授权]','文件审批：'+JSON.stringify({source:secret,target:secret,state:'executed',sourceSha256:version}),'文件修改：'+JSON.stringify({file:secret,operation:'edit',state:'applied'}),'办公产物：'+JSON.stringify({file:secret,state:'saved',artifactId:'artifact_unchanged'}),'教师要求：'+JSON.stringify({sourceId:'source_unchanged',sourceVersion:version,text:secret}),'计划：'+JSON.stringify([{text:secret,status:'pending'}]),'已检索来源标题：'+secret,'','[教师本次请求]','继续核对已有教学来源。'].join('\n');
 const input=[{role:'user',content:[{type:'text',text}]}],before=JSON.stringify(input),output=await privacy.context(input),projected=output[0].content[0].text;assert.equal(JSON.stringify(input),before);assert(!projected.includes('SyntheticCampusWillow'));assert(!projected.includes('private'));assert(projected.includes(version));assert(projected.includes('artifact_unchanged'));assert(projected.includes('source_unchanged'));assert(projected.endsWith('[教师本次请求]\n继续核对已有教学来源。'));
 const ordinary=[{role:'user',content:[{type:'text',text:'ordinary request'}]}];assert.equal(await privacy.context(ordinary),ordinary);
});
console.log(JSON.stringify({success:true,checks:checks.length,inventoryLoads:inventories,boundary:'Model context copy only. Real Host parser/SQLite/native terminal regression is separate.'}));
