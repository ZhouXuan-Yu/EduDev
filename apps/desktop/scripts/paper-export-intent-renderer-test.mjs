import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {paperRendererEnvironment} from './acceptance/paper-instance-renderer-env.mjs';
import {deferred} from './acceptance/paper-basket-renderer-fixture.mjs';
const env=await paperRendererEnvironment();
const {React,root,run,load,find,press,fill}=env;
let passed=0,nav,state,prepared=0,native,block=false,session,view,mode='entry',seed;
const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const ownerA='aisession_'+randomUUID(),ownerB='aisession_'+randomUUID();
const paper={id:'xipaper_'+randomUUID(),sessionId:ownerA,digest:'a'.repeat(64),title:'教师当前卷 A',state:'confirmed',exportCurrent:true,sourceCurrent:true};
try{
 const {PAPER_EXPORT_INTENT_SCHEMA}=await load('shared/paper-export.ts');
 const intent={schemaVersion:PAPER_EXPORT_INTENT_SCHEMA,paperId:paper.id,digest:paper.digest,audience:'student',format:'docx',template:'paper'};
 const {DesktopFrame,useDesktopNavigation,useDesktopNavigationGuard}=await load('renderer/components/desktop/DesktopFrame.tsx');
 const {PaperExportEntry}=await load('renderer/components/PaperExportEntry.tsx');
 const {OfficeComposerState,OfficeComposerSeed,useOfficeComposerState}=await load('renderer/components/office/OfficeComposerState.tsx');
 const {OfficeComposer}=await load('renderer/components/office/OfficeComposer.tsx');
 const {readComposerDraft,writeComposerDraft}=await load('renderer/components/office/composer-drafts.ts');
 let choose=async()=>({ok:true}),read=async()=>({ok:true,value:structuredClone(view)}),submits=[],queue=0,send=async()=>{},status,hasAttachments=false;
 window.omniEdu={getDesktopChrome:async()=>({enabled:false}),onDesktopCommand:fn=>{native=fn;return()=>{};},
  getXiaozhiSnapshot:async()=>({paperOutput:{label:'已选测试目录'}}),selectPaperOutput:input=>choose(input),reviewPaper:input=>read(input)};
 function Input(){
  state=useOfficeComposerState();
  const text=mode==='seed'?seed?.text:nav.target.draft,binding=mode==='seed'?seed?.paperExportIntent:nav.target.paperExportIntent;
  return React.createElement(React.Fragment,null,
   React.createElement(OfficeComposerSeed,{text,paperExportIntent:binding,onConsumed:()=>{
    if(mode==='seed'){seed=undefined;return;}
    nav.consumeDraft(session,{text,paperExportIntent:binding});
   }}),
   React.createElement(OfficeComposer,{sessionId:session,model:'unit',models:[],permissionLabel:'逐次确认',status,hasAttachments,
    onSubmit:async(text,presentation,binding)=>{submits.push({text,presentation,binding});await send();},onQueue:async()=>{queue++;},onStop:async()=>{}}));
 }
 function Consumer(){
  nav=useDesktopNavigation();useDesktopNavigationGuard(block,'UNIT dirty owner');
  if(mode==='entry'&&nav.target.view==='paper')return React.createElement(PaperExportEntry,{view,onPrepared:()=>{prepared++;}});
  return React.createElement(OfficeComposerState,{key:session,sessionId:session},React.createElement(Input));
 }
 let mounting=0;
 async function mount(nextMode='entry',id=ownerA){
  await run(()=>root.render(null));mode=nextMode;session=id;view=structuredClone(paper);status=undefined;hasAttachments=false;block=false;
  await run(()=>root.render(React.createElement(DesktopFrame,{key:++mounting},React.createElement(Consumer))));
  if(mode==='entry')await run(()=>nav.navigate({view:'paper'}));
 }
 const sendButton=()=>document.querySelector('button[aria-label="发送消息"]');
 const named=text=>{const list=[...document.querySelectorAll('button')].filter(n=>n.textContent===text);assert.equal(list.length,1,text);return list[0];};
 await mount();await press(find('paper-export-student-docx'));await run();
 check('real export entry -> navigation seed -> Composer creates an atomic unsent binding, never auto-sends',()=>{
  assert.equal(prepared,1);assert.equal(nav.target.view,'ai');assert.equal(nav.target.draft,undefined);assert.equal(nav.target.paperExportIntent,undefined);
  assert.deepEqual(state.paperExportIntent,intent);assert.deepEqual(readComposerDraft(ownerA).paperExportIntent,intent);assert.equal(submits.length,0);
  assert(find('office-prompt-input').value.includes('这份确认试卷'));assert(find('paper-export-draft-binding'));
 });
 await fill(find('office-prompt-input'),'教师修改后的导出请求');
 await run(()=>native('back'));await run(()=>native('forward'));await run();
 check('Back/Forward does not replay consumed seed or detach edited input from its binding',()=>{
  assert.equal(state.draft,'教师修改后的导出请求');assert.deepEqual(state.paperExportIntent,intent);
 });
 const failed=deferred();send=()=>failed.promise;
 await press(sendButton());await run(()=>failed.reject(Error('transport_uncertain')));
 check('failed send preserves current text and exact typed binding',()=>{
  assert.equal(state.draft,'教师修改后的导出请求');assert.deepEqual(state.paperExportIntent,intent);assert.equal(submits.length,1);
 });
 send=async()=>{};await press(named('重试发送'));
 check('explicit retry uses the original text/specification tuple',()=>{
  assert.deepEqual(submits[1],submits[0]);assert.deepEqual(state.paperExportIntent,intent);
 });
 await press(find('paper-export-draft-cancel'));
 check('explicit cancellation clears both export text and binding instead of sending unbound text',()=>{
  assert.equal(state.draft,'');assert.equal(state.paperExportIntent,undefined);assert.equal(readComposerDraft(ownerA).text,'');
 });
 writeComposerDraft(ownerA,{text:'已有教师草稿',skill:''});await mount();const before=prepared;
 await press(find('paper-export-student-docx'));
 check('existing persisted input rejects preparation without navigation or success callback',()=>{
  assert.equal(prepared,before);assert.equal(nav.target.view,'paper');assert(find('paper-output-error'));assert.equal(readComposerDraft(ownerA).text,'已有教师草稿');
 });
 seed={text:'待发送卷 A',paperExportIntent:intent};await mount('seed');await run();
 check('occupied actual Composer retains original input and pending seed without consuming it',()=>{
  assert.equal(state.draft,'已有教师草稿');assert(seed);assert.deepEqual(state.pendingPaperExport.paperExportIntent,intent);assert(find('paper-export-seed-pending'));
 });
 await mount('input');
 check('cold remount retains occupied input and durable pending seed separately',()=>{
  assert.equal(state.draft,'已有教师草稿');assert.deepEqual(state.pendingPaperExport.paperExportIntent,intent);
 });
 await fill(find('office-prompt-input'),'');await press(find('paper-export-seed-use'));
 check('explicit use after original input is handled moves text and binding together',()=>{
  assert.equal(state.draft,'待发送卷 A');assert.deepEqual(state.paperExportIntent,intent);assert.equal(state.pendingPaperExport,undefined);
 });
 await mount('input',ownerB);await fill(find('office-prompt-input'),'B的普通草稿');await mount('input');
 check('session switch/cold restoration never attaches A binding to B text',()=>{
  assert.equal(state.draft,'待发送卷 A');assert.deepEqual(state.paperExportIntent,intent);assert.equal(readComposerDraft(ownerB).paperExportIntent,undefined);
 });
 const submitted=submits.length;
 status='running';await run(()=>root.render(React.createElement(DesktopFrame,{key:mounting},React.createElement(Consumer))));
 await press(find('pi-queue-submit'));
 check('bound steer/followUp is refused while keeping the original input',()=>{
  assert.equal(queue,0);assert.equal(submits.length,submitted);assert(find('paper-export-send-error'));assert.equal(state.draft,'待发送卷 A');
 });
 status=undefined;hasAttachments=true;await run(()=>root.render(React.createElement(DesktopFrame,{key:mounting},React.createElement(Consumer))));
 await press(sendButton());
 check('mixed attachments are refused without clearing or unbinding the draft',()=>{
  assert.equal(submits.length,submitted);assert.deepEqual(state.paperExportIntent,intent);assert(find('paper-export-send-error'));
 });
 await mount('input');
 localStorage.setItem('xiaozhi.composer-draft.v1:'+ownerA,JSON.stringify({version:1,text:'保留损坏绑定的输入',skill:'',paperExportIntent:{invalid:true}}));
 await mount('input');await press(sendButton());
 check('invalid local binding never silently degrades into a legacy unbound send',()=>{
  assert.equal(submits.length,submitted);assert.equal(state.draft,'保留损坏绑定的输入');assert(state.paperExportInvalid);assert(find('paper-export-send-error'));
 });
 localStorage.clear();await mount();
 block=true;await run(()=>root.render(React.createElement(DesktopFrame,{key:mounting},React.createElement(Consumer))));
 await press(find('paper-export-student-docx'));
 check('dirty navigation refusal keeps the paper and never reports preparation success',()=>{assert.equal(nav.target.view,'paper');assert.equal(prepared,before);});
 localStorage.clear();const directory=deferred();
 window.omniEdu.getXiaozhiSnapshot=async()=>({});choose=()=>directory.promise;await mount();
 await press(find('paper-export-student-docx'));await run(()=>nav.navigate({view:'teaching'}));
 await run(()=>directory.resolve({ok:true}));
 check('late directory result cannot pull a newer destination back into AI',()=>{assert.equal(nav.target.view,'teaching');assert.equal(prepared,before);assert.equal(readComposerDraft(ownerA).paperExportIntent,undefined);});
 window.omniEdu.getXiaozhiSnapshot=async()=>({paperOutput:{label:'已选测试目录'}});
 const lateRead=deferred();read=()=>lateRead.promise;await mount();
 await press(find('paper-export-student-docx'));
 await run(()=>{native('back');native('forward');});
 await run(()=>lateRead.resolve({ok:true,value:paper}));
 check('Back/Forward ABA does not admit an old exact-read result into the revisited paper',()=>{
  assert.equal(nav.target.view,'paper');assert.equal(prepared,before);assert.equal(nav.target.draft,undefined);
 });
 const switchedRead=deferred();read=()=>switchedRead.promise;await mount();
 await press(find('paper-export-student-docx'));
 await run(()=>{view={...paper,id:'xipaper_'+randomUUID(),digest:'b'.repeat(64)};root.render(React.createElement(DesktopFrame,{key:mounting},React.createElement(Consumer)));});
 await run(()=>switchedRead.resolve({ok:true,value:paper}));
 check('switching the current view during exact read prevents preparation and releases the busy control',()=>{
  assert.equal(prepared,before);assert.equal(readComposerDraft(ownerA).paperExportIntent,undefined);assert(!find('paper-export-student-docx').disabled);
 });
 await mount('input');let accepted,second;const supplied=structuredClone(intent);
 await run(()=>{accepted=nav.navigate({view:'ai',sessionId:ownerA,draft:'第一待发请求',paperExportIntent:supplied});
  supplied.digest='b'.repeat(64);
  second=nav.navigate({view:'ai',sessionId:ownerA,draft:'第二待发请求',paperExportIntent:{...intent,digest:'b'.repeat(64)}});});
 check('same-batch navigation captures its own binding and never overwrites an unconsumed seed',()=>{
  assert(accepted);assert.equal(second,false);assert.equal(state.draft,'第一待发请求');assert.deepEqual(state.paperExportIntent,intent);
 });
 localStorage.clear();const proto=window.Storage.prototype,setItem=proto.setItem;
 try{
  proto.setItem=()=>{throw Error('owned storage failure');};seed={text:'持久化失败时保留请求',paperExportIntent:intent};
  await mount('seed');await run();
  check('failed local persistence does not acknowledge/consume the seed or strip its in-memory binding',()=>{
   assert(seed);assert(state.storageFailed);assert.equal(state.draft,seed.text);assert.deepEqual(state.paperExportIntent,intent);
  });
 }finally{proto.setItem=setItem;}
 console.log(JSON.stringify({success:true,passed,scope:'Mounted production ExportEntry, DesktopFrame, ComposerState/Seed and unchanged Composer controls; typed callback DTOs only, no Electron/chooser/provider claim'}));
}finally{await env.close();}
