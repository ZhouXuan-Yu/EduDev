import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {paperRendererEnvironment} from './acceptance/paper-instance-renderer-env.mjs';
// This scenario never renders a classroom card; avoid building that unrelated preview bundle.
const env=await paperRendererEnvironment({plugins:[{name:'unused-classroom-preview-for-pi-test',
 resolveId(id){if(id==='virtual:classroom-preview')return '\0unit-classroom-preview';},
 load(id){if(id==='\0unit-classroom-preview')return 'export const classroomPreviewScript="";export const classroomPreviewCss="";';}}]});
const {React,root,run,load,find,press}=env;
let passed=0,nav;
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
try{
 const {PAPER_EXPORT_INTENT_SCHEMA}=await load('shared/paper-export.ts');
 const {DesktopFrame,useDesktopNavigation}=await load('renderer/components/desktop/DesktopFrame.tsx');
 const {PiEducationWorkspace}=await load('renderer/components/office/PiEducationWorkspace.tsx');
 const {readComposerDraft}=await load('renderer/components/office/composer-drafts.ts');
 const ids=['aisession_'+randomUUID(),'aisession_'+randomUUID()];
 const binding={schemaVersion:PAPER_EXPORT_INTENT_SCHEMA,paperId:'xipaper_'+randomUUID(),digest:'a'.repeat(64),format:'docx',audience:'student',template:'paper'};
 const snapshots=new Map(ids.map(id=>[id,{enabled:true,running:false,legacyHistory:false,eventCursors:[],skills:[],
  projection:{threadId:id,model:'unit',turns:[],sourceSequence:0}}]));
 const requests=[];let fail=true,queueCalls=0,reply;
 window.HTMLElement.prototype.scrollIntoView=()=>{};
 window.omniEdu={getDesktopChrome:async()=>({enabled:false}),onDesktopCommand:()=>()=>{},
  listAiConversations:async()=>({folders:[],archivedFolders:[],archivedSessions:[],sessions:ids.map(id=>({id,title:'Mounted unit session',folderId:null,messageCount:0,createdAt:'2026-11-02',updatedAt:'2026-11-02'}))}),
  getXiaozhiSnapshot:async id=>structuredClone(snapshots.get(id)),getXiaozhiSettings:async()=>({ok:false,error:'configuration'}),
  onXiaozhiEvent:()=>()=>{},listXiaozhiAttachments:async()=>({ok:true,data:[]}),
  startXiaozhi:async input=>{requests.push(structuredClone(input));if(reply)return reply;if(fail)throw Error('owned_transport_uncertain');return{ok:true,runId:'unit-accepted'};},
  queueXiaozhi:async()=>{queueCalls++;return{ok:true};},listXiaozhiEvents:async()=>assert.fail('No running model or replay expected')};
 function Consumer(){nav=useDesktopNavigation();return React.createElement(PiEducationWorkspace,{onLeave:()=>{},onSettings:()=>{}});}
 await run(()=>root.render(React.createElement(DesktopFrame,null,React.createElement(Consumer))));await run();
 await run(()=>nav.navigate({view:'ai',sessionId:ids[0],draft:'精确卷导出请求',paperExportIntent:binding}));await run();
 check('actual Pi seed wiring loads the exact bound tuple into the real Composer',()=>{
  assert.equal(find('office-prompt-input').value,'精确卷导出请求');assert.equal(nav.target.draft,undefined);
  assert.deepEqual(readComposerDraft(ids[0]).paperExportIntent,binding);
 });
 await press(document.querySelector('button[aria-label="发送消息"]'));await run();
 check('actual Pi sends the typed binding and keeps original input after an uncertain transport failure',()=>{
  assert.equal(requests.length,1);assert.deepEqual(requests[0].paperExportIntent,binding);
  assert.equal(find('office-prompt-input').value,'精确卷导出请求');
 });
 const retry=[...document.querySelectorAll('button')].filter(b=>b.textContent==='重试发送');assert.equal(retry.length,1);
 await press(retry[0]);await run();
 check('actual Pi retry preserves commandId, prompt and binding exactly, not just the visible text',()=>{
  assert.equal(requests.length,2);assert.deepEqual(requests[1],requests[0]);assert.equal(queueCalls,0);
 });
 await run(()=>nav.navigate({view:'ai',sessionId:ids[1]}));await run();
 check('actual Pi session switch isolates the unsent bound request',()=>{
  assert.equal(find('office-prompt-input').value,'');assert.deepEqual(readComposerDraft(ids[0]).paperExportIntent,binding);
 });
 await run(()=>nav.navigate({view:'ai',sessionId:ids[0]}));await run();
 check('actual Pi return restores the original bound input',()=>{
  assert.equal(find('office-prompt-input').value,'精确卷导出请求');assert(find('paper-export-draft-binding'));
 });
 fail=false;await press(document.querySelector('button[aria-label="发送消息"]'));await run();
 check('accepted actual Pi send clears text and binding together',()=>{
  assert.equal(readComposerDraft(ids[0]).text,'');assert.equal(readComposerDraft(ids[0]).paperExportIntent,undefined);
  assert.deepEqual(requests.at(-1).paperExportIntent,binding);
 });
 await run(()=>nav.navigate({view:'ai',sessionId:ids[0],draft:'失效确认卷原请求',paperExportIntent:binding}));await run();
 reply={ok:false,error:'paper_export_source_changed'};
 await press(document.querySelector('button[aria-label="发送消息"]'));await run();
 check('real mounted Pi displays source recovery guidance and retains the unsent bound tuple',()=>{
  assert(document.body.textContent.includes('这份确认卷已被替代或来源已变化，尚未发起导出。请回到组卷重新核对并准备请求；原输入和文件保留。'));
  assert(!document.body.textContent.includes('这条发送记录与消息内容不一致'));
  assert.equal(find('office-prompt-input').value,'失效确认卷原请求');assert.deepEqual(readComposerDraft(ids[0]).paperExportIntent,binding);
 });
 reply={ok:false,error:'command_conflict'};
 const buttons=[...document.querySelectorAll('button')].filter(b=>b.textContent==='重试发送');assert.equal(buttons.length,1);
 await press(buttons[0]);await run();
 check('real mounted Pi still distinguishes a genuine command hash conflict from source change',()=>{
  assert(document.body.textContent.includes('这条发送记录与消息内容不一致，请重新发送。'));
  assert(!document.body.textContent.includes('这份确认卷已被替代或来源已变化，尚未发起导出。'));
  assert.equal(find('office-prompt-input').value,'失效确认卷原请求');assert.deepEqual(readComposerDraft(ids[0]).paperExportIntent,binding);
 });
 console.log(JSON.stringify({success:true,passed,scope:'Real mounted PiEducationWorkspace/Composer/navigation with controlled typed snapshot and start callbacks; no model/Electron/SQLite run claim'}));
}finally{await env.close();}
