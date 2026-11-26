import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import React from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

// Component fault injection only. No real data, Electron IPC or provider claim.
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost',pretendToBeVisual:true});
for(const k of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLButtonElement','HTMLSelectElement','Element','Node','NodeFilter','Event','CustomEvent','FocusEvent','MouseEvent','PointerEvent','KeyboardEvent','SVGElement','DocumentFragment','getComputedStyle','localStorage','MutationObserver'])Object.defineProperty(globalThis,k,{value:dom.window[k],configurable:true});
globalThis.requestAnimationFrame=dom.window.requestAnimationFrame=fn=>setTimeout(fn,0);
globalThis.cancelAnimationFrame=dom.window.cancelAnimationFrame=clearTimeout;
globalThis.ResizeObserver=dom.window.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
globalThis.matchMedia=dom.window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.CSS={escape:value=>String(value).replaceAll('\"','\\\"')};
dom.window.HTMLElement.prototype.getAnimations=()=>[];
process.env.TZ='Asia/Shanghai';
const {createRoot}=await import('react-dom/client');
const desktop=path.resolve(import.meta.dirname,'..'),baseline=process.argv.includes('--baseline');
const targetFiles=['components/QuestionNotebookWorkspace.tsx','components/TeachingBookWorkspace.tsx','components/product/MaterialStructurePanel.tsx','components/product/MaterialsWorkspace.tsx'];
const server=await createServer({configFile:false,root:desktop,appType:'custom',optimizeDeps:{noDiscovery:true},css:{postcss:{plugins:[]}},server:{middlewareMode:true,hmr:false,ws:false,watch:null},
  plugins:[{name:'unused-preview',resolveId(id){if(id==='virtual:classroom-preview')return id;},load(id){if(id==='virtual:classroom-preview')return 'export const classroomPreviewScript="";export const classroomPreviewCss="";';}},...(baseline?[{name:'read-error-before-evidence',enforce:'pre',load(id){const file=targetFiles.find(f=>id.replaceAll('\\','/').endsWith('/src/renderer/'+f));if(file)return execFileSync('git',['show','bacc2c9:apps/desktop/src/renderer/'+file],{cwd:desktop,encoding:'utf8'});}}]:[])]});
const report={success:false,layer:'component',baseline:false,source:'working tree',checks:[],boundary:'Mounted production components with rejected/deferred read fixtures. Not a domain, provider, Electron or persistence acceptance.'};
let root, updateProps;
const act=async fn=>React.act(async()=>{await fn();await new Promise(r=>setTimeout(r,20));});
const find=id=>document.querySelector(`[data-testid="${id}"]`);
const check=(name,fn)=>{fn();report.checks.push(name);console.log('PASS '+name);};
const reject=async()=>{throw Error('fixture_read_unavailable');};
async function mount(file,name,props,api){
  if(root)await act(()=>root.unmount());
  window.omniEdu=new Proxy(api,{get:(target,key)=>key in target?target[key]:String(key).startsWith('on')?()=>()=>{}:async()=>undefined});
  root=createRoot(document.getElementById('root'));
  const mod=await server.ssrLoadModule('/src/renderer/'+file);updateProps=next=>root.render(React.createElement(mod[name],{...props,...next}));
  await act(()=>root.render(React.createElement(mod[name],props)));
}
const fill=async(el,value)=>act(()=>{const proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new window.Event('input',{bubbles:true}));});
const baseStudent={id:'student-a',displayName:'验收学生甲',status:'active',subjects:['数学']};
try{
 const mod=await server.ssrLoadModule('/src/renderer/interaction/student-record-draft.ts');let draft;
 function DraftHarness({id}){draft=mod.useStudentRecordDraft(id);return React.createElement('input',{'data-testid':'draft-title',value:draft.form.title,onChange:e=>draft.setForm({...draft.form,title:e.target.value})});}
 root=createRoot(document.getElementById('root'));await act(()=>root.render(React.createElement(DraftHarness,{id:'a'})));
 await fill(find('draft-title'),'甲的草稿');const pending=draft.capture();await act(()=>root.render(React.createElement(DraftHarness,{id:'b'})));assert.equal(draft.form.title,'');await fill(find('draft-title'),'乙的草稿');await act(()=>draft.settled(pending,'数学'));assert.equal(draft.form.title,'乙的草稿');
 await act(()=>root.render(React.createElement(DraftHarness,{id:'a'})));assert.equal(draft.form.title,'');check('student-owned save settlement cannot clear another student draft',()=>{});
 await fill(find('draft-title'),'第一版');const earlier=draft.capture();await fill(find('draft-title'),'后写的版本');await act(()=>draft.settled(earlier,'数学'));assert.equal(draft.form.title,'后写的版本');check('late record save preserves the newer revision',()=>{});
 const original='2026-11-26T01:30:42.123Z';await act(()=>draft.edit({id:'record-a',studentId:'a',occurredAt:original,recordType:'class',subject:'数学',title:'原标题',content:'正文',tags:[]}));assert.equal(draft.form.occurredAt,'2026-11-26T09:30');await fill(find('draft-title'),'只改标题');assert.equal(draft.capture().occurredAt,original);assert.equal(draft.capture().editingId,'record-a');check('local datetime is 09:30 and a title-only edit retains exact original timestamp',()=>{});
 let release,updates=0;const rows=['a','b'].map(id=>({id,studentId:baseStudent.id,title:'复盘'+id,subject:'数学',startDate:'2026-11-01',endDate:'2026-11-26',updatedAt:original,sourceRecordIds:[],qualityChecks:[],contentMd:'正文'+id,parentSummary:'摘要'+id}));
 await mount('components/ReviewReportWorkspace.tsx','ReviewReportWorkspace',{activeStudent:baseStudent,records:[],reports:rows,selectedReportId:'a',onReportsChanged:reports=>updateProps({reports}),setStatus:()=>{}},{updateReport:async(id,contentMd,parentSummary)=>{updates++;return await new Promise(resolve=>{release=()=>resolve({...rows.find(r=>r.id===id),contentMd,parentSummary});});}});
 await fill(document.querySelector('[data-testid=review-report-editor], [data-testid=review-report-content]'),'已提交版本');await act(()=>find('review-report-save').click());await fill(document.querySelector('[data-testid=review-report-editor], [data-testid=review-report-content]'),'保存期间的新输入');await act(()=>release());assert.equal(document.querySelector('[data-testid=review-report-editor], [data-testid=review-report-content]').value,'保存期间的新输入');assert(find('review-report-draft'));check('review save receipt keeps edits made while awaiting host',()=>{});
 await act(()=>find('review-report-save').click());await act(()=>find('review-report-history-b').click());await fill(find('review-report-content'),'B未保存输入');await act(()=>release());assert.equal(find('review-report-content').value,'B未保存输入');assert.equal(find('review-report-save').disabled,false);assert.equal(updates,2);await act(()=>find('review-report-history-a').click());assert.equal(document.querySelector('[data-testid=review-report-editor], [data-testid=review-report-content]').value,'保存期间的新输入');check('late save never switches the selected report and retained drafts reopen',()=>{});
 let deleted=0;const notebooks=['a','b'].map(id=>({id,name:'备课本'+id,description:'',status:'active',version:1,recordCount:1,updatedAt:original}));const note={id:'note-a',notebookId:'a',recordType:'solve',title:'原笔记',summary:'',userQuery:'',output:'原正文',version:1};
 await mount('components/TeacherNotebookWorkspace.tsx','TeacherNotebookWorkspace',{setStatus:()=>{}},{listTeacherNotebooks:async()=>notebooks.map(x=>({...x})),addTeacherNotebookRecord:async input=>{notebooks[0].version++;return {...note,...input};},listTeacherNotebookRecords:async id=>id==='a'?[note]:[],deleteTeacherNotebookRecord:async()=>{deleted++;}});
 await act(()=>find('teacher-notebook-item-a').click());await fill(find('teacher-notebook-record-output'),'尚未保存的笔记');await act(()=>find('teacher-notebook-back').click());await act(()=>find('teacher-notebook-item-a').click());assert.equal(find('teacher-notebook-record-output').value,'尚未保存的笔记');
 await act(()=>find('teacher-notebook-item-b').click());assert(find('action-confirmation'));await act(()=>find('action-confirmation-cancel').click());assert.equal(find('teacher-notebook-record-output').value,'尚未保存的笔记');check('same notebook return preserves input; changing notebook requires explicit discard',()=>{});
 await act(()=>find('teacher-notebook-record-delete-note-a').click());await act(()=>find('action-confirmation-cancel').click());assert.equal(deleted,0);await act(()=>find('teacher-notebook-record-delete-note-a').click());await act(()=>find('action-confirmation-accept').click());assert.equal(deleted,1);check('note deletion invokes host only after explicit confirmation',()=>{});
 await fill(find('teacher-notebook-name'),'改名尚未保存');await fill(find('teacher-notebook-record-title'),'新笔记');await fill(find('teacher-notebook-record-output'),'独立保存笔记');await act(()=>find('teacher-notebook-record-save').click());assert.equal(find('teacher-notebook-name').value,'改名尚未保存');check('child-note receipt preserves unfinished notebook metadata',()=>{});
 notebooks[0].name='另一窗口的新名称';await fill(find('teacher-notebook-record-title'),'再次保存笔记');await fill(find('teacher-notebook-record-output'),'触发原目录重新读取');await act(()=>find('teacher-notebook-record-save').click());assert(find('teacher-notebook-metadata-conflict'));let metadataWrites=0;window.omniEdu.updateTeacherNotebook=async()=>{metadataWrites++;};await act(()=>find('teacher-notebook-save').click());assert.equal(metadataWrites,0);assert.equal(find('teacher-notebook-name').value,'改名尚未保存');check('concurrent notebook metadata conflict keeps draft and prevents overwrite',()=>{});
 await act(()=>find('teacher-notebook-discard').click());await act(()=>find('action-confirmation-accept').click());assert(!find('teacher-notebook-metadata-conflict'));window.omniEdu.updateTeacherNotebook=async(id,input)=>{notebooks[0]={...notebooks[0],...input,version:notebooks[0].version+1};return notebooks[0];};await fill(find('teacher-notebook-name'),'放弃后重新命名');await act(()=>find('teacher-notebook-save').click());assert(!find('teacher-notebook-metadata-conflict'));assert.equal(notebooks[0].name,'放弃后重新命名');check('discarding a conflict adopts host baseline and permits a fresh edit',()=>{});
 await act(()=>find('teacher-notebook-refresh').click());await fill(find('teacher-notebook-name'),'刷新后保留的名称');await fill(find('teacher-notebook-record-title'),'刷新后新笔记');await fill(find('teacher-notebook-record-output'),'再次更新子笔记版本');await act(()=>find('teacher-notebook-record-save').click());assert.equal(find('teacher-notebook-name').value,'刷新后保留的名称');check('same-version refresh establishes a new metadata baseline',()=>{});
 const locator=await server.ssrLoadModule('/src/renderer/interaction/locate-record.ts');let offsets=[];await locator.locateRecordPage(async offset=>{offsets.push(offset);return offset===0?Array.from({length:100},(_,i)=>({id:'recent-'+i})):[{id:'older'}];},'older');assert.deepEqual(offsets,[0,100]);check('exact search target is located beyond the first 100 records',()=>{});
 await mount('components/product/TeachingArtifactsWorkspace.tsx','TeachingArtifactsWorkspace',{}, {listDocumentArtifacts:reject});assert(find('artifacts-read-failed'));assert(!document.body.textContent.includes('还没有教学文件'));assert(!document.body.textContent.includes('0 份当前教学文件'));check('teaching file read rejection does not imply empty catalog or zero count',()=>{});
 await mount('components/office/PiModelSettings.tsx','PiModelSettings',{embedded:true,onBack:()=>{}},{getXiaozhiSettings:reject});assert.equal(find('pi-settings-configured').textContent,'配置状态尚未读出');assert(find('pi-settings-retry-read'));check('unknown model configuration is retryable instead of unconfigured',()=>{});
 const searchRows=[{id:'one',studentId:'a',title:'同名周测',recordType:'exam',subject:'数学',content:'甲',tags:[]},{id:'two',studentId:'b',title:'同名周测',recordType:'exam',subject:'数学',content:'乙',tags:[]}];let remembered,chosen;
 await mount('components/GlobalSearchWorkspace.tsx','GlobalSearchWorkspace',{setStatus:()=>{},initialState:{query:'周测',result:{students:[],records:searchRows}},studentNames:{a:'学生甲',b:'学生乙'},onStateChange:value=>remembered=value,onOpenStudent:()=>{},onOpenRecord:value=>{chosen=value;}},{});
 assert(find('global-search-record-two').textContent.includes('学生乙'));await act(()=>find('global-search-record-two').click());assert.equal(chosen.id,'two');assert.equal(remembered.focusedId,'global-search-record-two');check('same-title search results identify owners and retain exact return target',()=>{});
 report.success=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;console.error(report.failure);}
finally{if(root)await act(()=>root.unmount());await server.close();dom.window.close();const evidence=path.resolve(desktop,'../../docs/audit/ux-motion-20261126');fs.writeFileSync(path.join(evidence,'component-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
