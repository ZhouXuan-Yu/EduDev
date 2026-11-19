import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

const desktop=path.resolve(import.meta.dirname,'../..');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-phase7-workbench-renderer-'));
const sourcePaths=['PiWorkspaceShell.tsx','PiEducationWorkspace.tsx','PiSettingsWorkspace.tsx','PiPermissionApproval.tsx','PiCapabilityCenter.tsx','workbench/PiRecoveryOverview.tsx','workbench/PiApprovalInbox.tsx','workbench/useWorkbenchSummary.ts','workbench/workbench.module.css'].map(file=>'src/renderer/components/office/'+file);
sourcePaths.push('scripts/xiaozhi-agent/phase7-workbench-renderer-smoke.mjs');
const report={success:false,output,checks:[],calls:[],boundary:'Actual production React/HeroUI components and parent workspace in JSDOM, synthetic typed IPC only. No Electron, SQL, native helper, provider/key, actual budget, build output, layout/keyboard/drag/cold-start product acceptance.'};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return{promise,resolve};};
const ok=value=>({ok:true,value});
const S='aisession_11111111-1111-4111-8111-111111111111',T='aisession_22222222-2222-4222-8222-222222222222';
const task=(sessionId=T,patch={})=>({schema:'xiaozhi.task.v1',id:'xitask_'+'a'.repeat(64),sessionId,revision:3,requirementsVersion:1,planRevision:0,planReason:'合成任务原要求',state:'interrupted',origin:{messageId:'aimsg_fixture',commandId:'xicmd_fixture',runId:'run_fixture'},sources:[{messageId:'aimsg_fixture',runId:'run_fixture',version:'b'.repeat(64)}],criteria:[{id:'no_criteria',version:1,sourceId:'aimsg_fixture',sourceVersion:'b'.repeat(64),text:'核对原要求',kind:'human'}],steps:[],checks:[],binding:null,createdAt:'2026-11-18T00:00:00.000Z',updatedAt:'2026-11-18T00:00:00.000Z',...patch});
const row=(patch={})=>({sessionId:T,sessionTitle:'第二会话',taskId:task().id,revision:3,requirementsVersion:1,state:'interrupted',updatedAt:'2026-11-18T00:00:00.000Z',lastRunId:'run_fixture',isLatestForSession:true,resumeCandidate:true,continuationCandidate:true,blockedReasons:['unknown_effect'],pendingApprovalCount:1,unknownEffectCount:1,planningLevel:2,nativeInspection:'not_checked',...patch});
const page=(kind,items=[],patch={})=>({schemaVersion:1,kind,asOf:'2026-11-18T00:00:00.000Z',items,total:items.length,matched:items.length,counts:{completed:2,ended:1,pending:1},nextCursor:null,partial:false,unavailableCount:0,sourceFailures:[],scanned:items.length,...patch});
const modern=()=>({schemaVersion:2,permissionSnapshotHash:'f'.repeat(64),grantRefs:[],scope:'operation',id:'approval_fixture',revision:7,requestDigest:'c'.repeat(64),state:'pending',createdAt:'2026-11-18T00:00:00Z',updatedAt:'2026-11-18T00:00:00Z',request:{schemaVersion:2,owner:{sessionId:T,runId:'run_fixture',generation:1,taskId:task().id},requirementsVersion:1,callId:'call_fixture',files:[],provider:null,action:'exec_command',purpose:'运行本地合成教学命令',scopes:[{kind:'process',backend:'appcontainer',executable:'fixture.exe',executableHash:'a'.repeat(64),workspace:'C:/fixture'}],classification:'public',expiresAt:'2099-01-01T00:00:00Z',inputDigest:'d'.repeat(64),summary:'合成非敏感摘要'}});
const approvalRow=(kind='permission_v2',state='pending',patch={})=>({ref:kind==='permission_v2'?{kind,sessionId:T,id:'approval_fixture',revision:7}:{kind,sessionId:T,id:'copy_fixture',etag:'e'.repeat(64)},kind,id:kind==='permission_v2'?'approval_fixture':'copy_fixture',revision:kind==='permission_v2'?7:null,etag:kind==='legacy_copy'?'e'.repeat(64):null,sessionId:T,sessionTitle:'第二会话',taskId:null,runId:'run_fixture',state,purpose:'教学资料操作',resources:['合成资源'],classification:'public',expiresAt:null,updatedAt:'2026-11-18T00:00:00Z',canDecide:true,blockedReasons:[],...patch});
const approvalDetail=(value)=>({schemaVersion:1,kind:'approval_detail',asOf:'2026-11-18T00:00:00Z',detail:{kind:value.kind,ref:value.ref,approval:value.kind==='permission_v2'?modern():{id:value.id,runId:value.runId,callId:'call_fixture',state:value.state,source:'合成原文件',target:'合成目标文件'}}});
const capability=(patch={})=>({id:'cap_fixture',capabilityId:'cap_x',providerId:'provider_x',name:'合成教学工具',version:'1.2.3',origin:'candidate',sourceKind:'acquisition',source:'本地未知来源',sourceHash:'a'.repeat(64),schemaHash:null,license:null,installed:'installed',verification:'quarantined',authorization:'task_check_required',availability:'blocked',requiredMissing:['Node runtime'],optionalMissing:['可选导出器'],reasons:['来源需人工核对'],risk:['外部操作'],verifiedAt:null,expiresAt:null,...patch});
let dom,root,React,act,createRoot,C,validTaskView;
const channels=new Set(),NativeMessageChannel=globalThis.MessageChannel;
async function settle(action=()=>{}){await act(async()=>{await action();await delay(8);});}
const element=id=>document.querySelector(`[data-testid="${id}"]`);
async function click(id,index=0){const node=document.querySelectorAll(`[data-testid="${id}"]`)[index];assert(node,'missing '+id);await settle(()=>node.click());}
async function select(id,value){await settle(()=>{element(id).value=value;element(id).dispatchEvent(new Event('change',{bubbles:true}));});}
function bridge(overrides={}){window.omniEdu=new Proxy({...overrides},{get(target,key){if(key in target)return target[key];if(String(key).startsWith('on'))return()=>()=>{};return async()=>undefined;}});}
async function mount(Component,props={},api={}){bridge(api);await settle(()=>{root?.unmount();document.body.innerHTML='<div id="root"></div>';root=createRoot(document.getElementById('root'));root.render(React.createElement(Component,props));});}
async function check(id,name,action){try{await action();report.checks.push({id,name,pass:true});console.log('PASS '+id+' '+name);}catch(error){report.checks.push({id,name,pass:false,error:String(error.stack||error)});console.error('FAIL '+id+' '+error);}}
try{
  const entry=path.join(output,'entry.tsx');
  fs.writeFileSync(entry,`export {default as React,act} from 'react';export {createRoot} from 'react-dom/client';
${['PiRecoveryOverview','PiApprovalInbox'].map(name=>`export {${name}${name==='PiRecoveryOverview'?',restoreWorkbenchTask':''}} from ${JSON.stringify(path.join(desktop,'src/renderer/components/office/workbench/'+name+'.tsx'))};`).join('\n')}
${['PiCapabilityCenter','PiWorkspaceShell','PiEducationWorkspace','PiSettingsWorkspace'].map(name=>`export {${name}} from ${JSON.stringify(path.join(desktop,'src/renderer/components/office/'+name+'.tsx'))};`).join('\n')}
export {DesktopFrame} from ${JSON.stringify(path.join(desktop,'src/renderer/components/desktop/DesktopFrame.tsx'))};
export {validTaskView} from ${JSON.stringify(path.join(desktop,'src/shared/xiaozhi-task.ts'))};`);
  const bundle=path.join(output,'components.cjs');
  await build({entryPoints:[entry],outfile:bundle,bundle:true,platform:'node',format:'cjs',target:'node24',nodePaths:[path.join(desktop,'node_modules')],loader:{'.css':'empty'},jsx:'automatic',logLevel:'silent',plugins:[{name:'unmounted-classroom-virtual-asset',setup(plugin){plugin.onResolve({filter:/^virtual:classroom-preview$/},()=>({path:'classroom-preview',namespace:'fixture-asset'}));plugin.onLoad({filter:/.*/,namespace:'fixture-asset'},()=>({contents:'export const classroomPreviewScript="";export const classroomPreviewCss="";',loader:'js'}));}}]});
  dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/',pretendToBeVisual:true});
  for(const name of ['window','document','Element','Node','Document','DocumentFragment','ShadowRoot','NodeFilter','MutationObserver','Event','MouseEvent','KeyboardEvent','CustomEvent','PointerEvent',...Object.getOwnPropertyNames(dom.window).filter(name=>/^(HTML|SVG).*Element$/.test(name))])if(dom.window[name])globalThis[name]=dom.window[name];
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
  globalThis.localStorage=window.localStorage;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  globalThis.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),16);globalThis.cancelAnimationFrame=clearTimeout;
  globalThis.CSS=dom.window.CSS||{escape:value=>String(value).replace(/[^A-Za-z0-9_-]/g,'\\$&')};
  window.HTMLElement.prototype.scrollIntoView=function(){};
  globalThis.matchMedia=window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
  globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  if(NativeMessageChannel)globalThis.MessageChannel=class extends NativeMessageChannel{constructor(){super();channels.add(this);}};
  C=createRequire(import.meta.url)(bundle);({React,act,createRoot,validTaskView}=C);
  assert(validTaskView(task()),'fixture must use original Task validator');
  const overviewProps={activeSessionId:S,onOpenSession:async()=>true,onRestore:async()=>{},onApprovalChanged:async()=>{}};

  await check('W01','Real Shell opens the overview on demand, closes on Escape and restores its trigger',async()=>{
    let reads=0;const props={title:'合成会话',sidebar:null,aside:null,children:null,onLeave(){},onSkills(){},onSettings(){},workbench:React.createElement(C.PiRecoveryOverview,overviewProps)};
    await mount(C.PiWorkspaceShell,props,{getXiaozhiWorkbenchSummary:async()=>{reads++;return ok(page('tasks'));}});
    assert.equal(reads,0);await click('pi-workbench-open');assert(element('pi-workbench'));assert.equal(reads,1);
    await settle(()=>document.querySelector('[role="dialog"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    assert(!element('pi-workbench'));assert.equal(document.activeElement,element('pi-workbench-open'));
  });
  await check('W02','Task filters/counts use the server universe and null counts remain unknown',async()=>{
    const calls=[];await mount(C.PiRecoveryOverview,overviewProps,{getXiaozhiWorkbenchSummary:async query=>{calls.push(query);return ok(page('tasks',[row()],{total:41,matched:9,counts:{completed:12,ended:4},nextCursor:'page2'}));}});
    assert(element('pi-task-counts').textContent.includes('41'));assert(element('pi-task-counts').textContent.includes('12'));assert(document.body.textContent.includes('结果待核验'));
    await click('pi-task-page-next');assert.equal(calls.at(-1).cursor,'page2');await select('pi-task-filter','completed');assert.equal(calls.at(-1).filter,'completed');assert(!calls.at(-1).cursor);
    await mount(C.PiRecoveryOverview,overviewProps,{getXiaozhiWorkbenchSummary:async()=>ok(page('tasks',[],{total:null,matched:null,counts:null,partial:true,unavailableCount:2,sourceFailures:[{source:'tasks',code:'corrupt',records:2}]}))});
    assert(element('pi-task-counts').textContent.includes('未完整核对'));assert(element('pi-task-partial'));assert(element('pi-task-overview-empty'));
  });
  await check('W03','Actual restore helper selects/hydrates first, rereads exact Task and dispatches one original resume',async()=>{
    const order=[],gate=deferred();let current=true;
    const api={getXiaozhiTask:async input=>{order.push(['get',input]);return ok({task:task(),canAccept:false,canResume:true});},resumeXiaozhiTask:async input=>{order.push(['resume',input]);return{ok:true};},startXiaozhi:async()=>{throw Error('unexpected start');}};
    const promise=C.restoreWorkbenchTask(row(),'remaining',{api,selectSession:async id=>{order.push(['select',id]);return gate.promise;},isCurrent:()=>current,commandId:'xicmd_11111111-1111-4111-8111-111111111111'});
    await delay(3);assert.equal(order.length,1);gate.resolve(true);await promise;assert.deepEqual(order.map(x=>x[0]),['select','get','resume']);assert.equal(order[2][1].taskId,row().taskId);assert.equal(order[2][1].revision,3);assert.equal(order[2][1].requirementsVersion,1);report.calls.push(...order);
  });
  await check('W04','Changed/rejected selection and fresh Task mismatch issue no model/resume call',async()=>{
    let effects=0;const api={getXiaozhiTask:async()=>ok({task:task(T,{revision:4}),canAccept:false,canResume:true}),resumeXiaozhiTask:async()=>{effects++;return{ok:true};},startXiaozhi:async()=>{effects++;return{ok:true};}};
    for(const selected of [false,true])await assert.rejects(C.restoreWorkbenchTask(row(),'remaining',{api,selectSession:async()=>selected,isCurrent:()=>true,commandId:'command_fixture'}));
    const gate=deferred();let current=true;api.getXiaozhiTask=async()=>gate.promise;const pending=C.restoreWorkbenchTask(row(),'remaining',{api,selectSession:async()=>true,isCurrent:()=>current,commandId:'command_fixture'});await delay(2);current=false;gate.resolve(ok({task:task(),canAccept:false,canResume:true}));await assert.rejects(pending);assert.equal(effects,0);
  });
  await check('W05','Legacy no_criteria continuation carries explicit same Task and never falls back from rejected resume',async()=>{
    const calls=[];const api={getXiaozhiTask:async()=>ok({task:task(),canAccept:false,canResume:false}),resumeXiaozhiTask:async()=>{throw Error('not_ready');},startXiaozhi:async input=>{calls.push(input);return{ok:true};}};
    await C.restoreWorkbenchTask(row(),'continue',{api,selectSession:async()=>true,isCurrent:()=>true,commandId:'command_fixture'});assert.deepEqual(calls[0].continueTask,{taskId:task().id,requirementsVersion:1});assert(!('attachments'in calls[0]));
    await assert.rejects(C.restoreWorkbenchTask(row(),'remaining',{api,selectSession:async()=>true,isCurrent:()=>true,commandId:'command_fixture'}));assert.equal(calls.length,1);
  });
  await check('W06','Summary filter epoch ignores an older deferred page after a newer result',async()=>{
    const gate=deferred();await mount(C.PiRecoveryOverview,overviewProps,{getXiaozhiWorkbenchSummary:async query=>query.filter==='unfinished'?gate.promise:ok(page('tasks',[row({sessionTitle:'新筛选'})]))});
    await select('pi-task-filter','ended');assert(document.body.textContent.includes('新筛选'));await settle(()=>gate.resolve(ok(page('tasks',[row({sessionTitle:'旧筛选'})]))));assert(!document.body.textContent.includes('旧筛选'));
  });
  await check('A01','Inbox retrieves exact modern revision only on selection and sends the original CAS decision',async()=>{
    const value=approvalRow(),calls=[];await mount(C.PiApprovalInbox,{activeSessionId:S,onOpenSession:async()=>true,onChanged:async()=>{}},{getXiaozhiWorkbenchSummary:async query=>{calls.push(query);return ok(query.kind==='approval_detail'?approvalDetail(value):page('approvals',[value]));},decideXiaozhiPermission:async input=>{calls.push(input);return ok({...modern(),state:'approved',revision:8});}});
    assert.equal(calls.length,1);await click('pi-approval-inbox-detail');assert.deepEqual(calls[1].ref,value.ref);await click('pi-permission-approve');const decision=calls.find(value=>value.decision);assert.equal(decision.sessionId,T);assert.equal(decision.revision,7);assert.equal(decision.scope,'operation');report.calls.push(...calls);
  });
  await check('A02','Expired/denied modern approvals and CAS errors remain visible and never claim success',async()=>{
    let decisions=0;const value=approvalRow('permission_v2','pending',{canDecide:false});await mount(C.PiApprovalInbox,{activeSessionId:S,onOpenSession:async()=>true,onChanged:async()=>{}},{getXiaozhiWorkbenchSummary:async query=>ok(query.kind==='approval_detail'?approvalDetail(value):page('approvals',[value])),decideXiaozhiPermission:async()=>{decisions++;return{ok:false,error:'changed'};}});await click('pi-approval-inbox-detail');assert(element('pi-permission-approve').disabled);assert.equal(decisions,0);
    value.canDecide=true;await mount(C.PiApprovalInbox,{activeSessionId:S,onOpenSession:async()=>true,onChanged:async()=>{}},{getXiaozhiWorkbenchSummary:async query=>ok(query.kind==='approval_detail'?approvalDetail(value):page('approvals',[value])),decideXiaozhiPermission:async()=>({ok:false,error:'changed'})});await click('pi-approval-inbox-detail');await click('pi-permission-reject');assert(document.body.textContent.includes('授权没有完成'));
    const expired=approvalDetail(value);expired.detail.approval.request.expiresAt='2020-01-01T00:00:00Z';
    await mount(C.PiApprovalInbox,{activeSessionId:S,onOpenSession:async()=>true,onChanged:async()=>{}},{getXiaozhiWorkbenchSummary:async query=>ok(query.kind==='approval_detail'?expired:page('approvals',[value])),decideXiaozhiPermission:async()=>{decisions++;return{ok:true};}});await click('pi-approval-inbox-detail');assert(element('pi-permission-approve').disabled);assert(document.body.textContent.includes('申请已过期'));assert.equal(decisions,0);
  });
  await check('A03','Legacy decisions reread the same etag and stop on changed detail before the original API',async()=>{
    const value=approvalRow('legacy_copy'),calls=[];let details=0;await mount(C.PiApprovalInbox,{activeSessionId:S,onOpenSession:async()=>true,onChanged:async()=>{}},{getXiaozhiWorkbenchSummary:async query=>{calls.push(query);if(query.kind!=='approval_detail')return ok(page('approvals',[value]));details++;return details===1?ok(approvalDetail(value)):{ok:false,error:'changed'};},decideXiaozhi:async input=>{calls.push(input);return{ok:true};}});await click('pi-approval-inbox-detail');await click('pi-copy-approve');assert.equal(details,2);assert(!calls.some(value=>value.decision));assert(document.body.textContent.includes('申请已变化'));
  });
  await check('A04','Legacy pending/rejected/unknown/approved use original decide/verify/resume actions',async()=>{
    const calls=[];for(const [state,control,decision]of [['pending','pi-copy-reject','reject'],['uncertain','pi-copy-verify','verify'],['approved','pi-approval-legacy-resume','resume']]){const value=approvalRow('legacy_copy',state);await mount(C.PiApprovalInbox,{activeSessionId:S,onOpenSession:async()=>true,onChanged:async()=>{}},{getXiaozhiWorkbenchSummary:async query=>ok(query.kind==='approval_detail'?approvalDetail(value):page('approvals',[value])),decideXiaozhi:async input=>{calls.push({...input,action:input.decision});return{ok:true};},resumeXiaozhiLegacyApproval:async input=>{calls.push({...input,action:'resume'});return{ok:true};}});await click('pi-approval-inbox-detail');await click(control);assert.equal(calls.at(-1).action,decision);assert.equal(calls.at(-1).sessionId,T);}report.calls.push(...calls);
  });
  await check('A05','Late detail reads cannot revive an old approval after changing filter',async()=>{
    const gate=deferred(),value=approvalRow();await mount(C.PiApprovalInbox,{activeSessionId:S,onOpenSession:async()=>true,onChanged:async()=>{}},{getXiaozhiWorkbenchSummary:async query=>query.kind==='approval_detail'?gate.promise:ok(page('approvals',[value]))});await click('pi-approval-inbox-detail');await select('pi-approval-filter','rejected');await settle(()=>gate.resolve(ok(approvalDetail(value))));assert(!element('pi-approval-inbox-selected'));
  });
  await check('C01','Capability axes distinguish installed, quarantined, authorization and missing requirements without Task authority',async()=>{
    const calls=[],navigation=[];await mount(C.PiCapabilityCenter,{onNavigate:tab=>navigation.push(tab)},{getXiaozhiWorkbenchSummary:async query=>{calls.push(query);return ok(page('capabilities',[capability()],{context:{state:'none',sessionId:null,taskId:null,requirementsVersion:null},registryRevision:1}));}});
    const text=document.body.textContent;for(const expected of ['已安装','隔离待审核','需任务核对','当前不可用','许可证 未知','缺少必需项','可选项未提供','外部操作'])assert(text.includes(expected),expected);assert(!('taskId'in calls[0]));assert.equal(calls.length,1);
    await settle(()=>{Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(element('pi-capability-search'),'导出');element('pi-capability-search').dispatchEvent(new Event('input',{bubbles:true}));});await click('pi-capability-search-submit');assert.equal(calls.at(-1).query,'导出');const count=calls.length;await click('pi-capability-manage-skills');assert.deepEqual(navigation,['skills']);assert.equal(calls.length,count);
  });
  await check('C02','Capability query binds the legitimate selected Task and stale/partial sources stay explicit',async()=>{
    const calls=[];await mount(C.PiCapabilityCenter,{sessionId:T,task:{id:task().id,requirementsVersion:1},onNavigate(){}},{getXiaozhiWorkbenchSummary:async query=>{calls.push(query);return ok(page('capabilities',[],{total:null,matched:null,counts:null,partial:true,unavailableCount:1,sourceFailures:[{source:'registry',code:'corrupt',records:1}],context:{state:'stale',sessionId:T,taskId:task().id,requirementsVersion:1},registryRevision:null}));}});assert.equal(calls[0].taskId,task().id);assert.equal(calls[0].requirementsVersion,1);assert(element('pi-capability-context').textContent.includes('已变化'));assert(element('pi-capability-partial'));assert(element('pi-capability-empty'));
    // The real Settings navigation has a fixed original-ID list. Exercise its consumer too.
    const settingsCalls=[];
    await mount(C.PiSettingsWorkspace,{onBack(){}},{listAiConversations:async()=>({folders:[],sessions:[{id:T,title:'第二会话'}],archivedFolders:[],archivedSessions:[]}),getDataRoot:async()=>'',getXiaozhiSettings:async()=>({ok:false,error:'unavailable'}),getXiaozhiSnapshot:async()=>({task:task()}),getXiaozhiWorkbenchSummary:async query=>{settingsCalls.push(query);return ok(page('capabilities',[],{context:{state:'current',sessionId:T,taskId:task().id,requirementsVersion:1},registryRevision:1}));}});
    assert.equal(settingsCalls.length,0);await click('pi-settings-tab-capabilities');assert(element('pi-capability-center'));assert.equal(settingsCalls[0].sessionId,T);assert.equal(settingsCalls[0].taskId,task().id);
  });
  await check('W07','Real parent cross-session restore survives Composer remount, holds single flight and preserves the target draft',async()=>{
    const calls=[],gate=deferred();localStorage.clear();localStorage.setItem('xiaozhi.current-session.v1',S);localStorage.setItem('xiaozhi.composer-draft.v1:'+T,JSON.stringify({version:1,text:'第二会话未发送草稿',skill:''}));
    const list={folders:[],archivedFolders:[],archivedSessions:[],sessions:[{id:S,title:'第一会话',folderId:null,messageCount:0},{id:T,title:'第二会话',folderId:null,messageCount:0}]};
    const snapshot=sessionId=>({projection:{schemaVersion:'xiaozhi.office.projection.v1',threadId:sessionId,provider:'deepseek',model:'deepseek-chat',epoch:0,sourceSequence:0,needsHydration:false,hasMoreHistory:false,turns:[]},running:false,approvals:[],changes:[],task:sessionId===T?task():undefined,eventCursors:[]});
    function Parent(){return React.createElement(C.DesktopFrame,null,React.createElement(C.PiEducationWorkspace,{onLeave(){},onSettings(){}}));}
    await mount(Parent,{}, {listAiConversations:async()=>list,getXiaozhiSnapshot:async id=>{calls.push(['snapshot',id]);return snapshot(id);},getXiaozhiSettings:async()=>({ok:false,error:'unavailable'}),listXiaozhiAttachments:async()=>({ok:true,data:[]}),getXiaozhiWorkbenchSummary:async query=>ok(page(query.kind,[row()])),getXiaozhiTask:async input=>{calls.push(['get',input]);return ok({task:task(),canAccept:false,canResume:true});},resumeXiaozhiTask:async input=>{calls.push(['resume',input]);return gate.promise;},listXiaozhiEvents:async()=>({events:[],hasMore:false})});
    await settle(()=>delay(30));await click('pi-workbench-open');await click('pi-task-overview-resume');await settle(()=>delay(30));
    assert(element('pi-workbench'),'panel must stay open across keyed remount');assert.equal(element('office-prompt-input').value,'第二会话未发送草稿');assert.equal(calls.filter(value=>value[0]==='resume').length,1);await click('pi-task-overview-resume');assert.equal(calls.filter(value=>value[0]==='resume').length,1);
    await settle(()=>gate.resolve({ok:true}));assert(element('pi-workbench-action-notice').textContent.includes('同一任务'));assert(calls.findIndex(value=>value[0]==='snapshot'&&value[1]===T)<calls.findIndex(value=>value[0]==='get'));report.calls.push(...calls);
  });
  report.success=report.checks.every(value=>value.pass)&&report.checks.length===14;
}catch(error){report.fatal=String(error.stack||error);console.error(error);}
finally{
  if(root&&act)await act(async()=>root.unmount());dom?.window.close();for(const channel of channels){channel.port1.close();channel.port2.close();}if(NativeMessageChannel)globalThis.MessageChannel=NativeMessageChannel;
  report.sources=Object.fromEntries(sourcePaths.map(file=>[file,createHash('sha256').update(fs.readFileSync(path.join(desktop,file))).digest('hex')]));
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:report.checks.filter(value=>value.pass).length,total:report.checks.length,output}));
}
if(!report.success)process.exitCode=1;
