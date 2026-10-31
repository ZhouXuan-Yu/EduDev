import fs from 'node:fs';
import path from 'node:path';
import {OFFICE_VERSIONS_SCHEMA,validOfficeVersionInput,type OfficeVersionInput,type OfficeVersionResult,type OfficeVersionView,type OfficeVersionError} from '../../shared/xiaozhi-office-versions';
import {HTML_ARTIFACT_PREFIX,htmlArtifactPreview} from '../../shared/html-artifact';
import {createTextChangeState,changeHash,type PrivateTextChange} from './text-change-state';
import {createTextChangeService} from './text-change-service';
import {textVersionFamilies} from './text-version-family';
import {authorizedWorkspace,approvedFile,workspaceHash} from './workspace-authority';
import {assertFileWritesEnabled} from './file-write-policy';

/** HTML history is a view of the original edit ledger; preview copies are disposable. */
export function createTextVersions(options:{state:ReturnType<typeof createTextChangeState>;dataRoot:string;workspace:(id:string)=>Promise<string>;afterStage?:Parameters<typeof createTextChangeService>[0]['afterStage']}) {
 const {state}=options;
 async function context(sessionId:string,id:string) {
  const selected=await state.get(id);if(!selected||selected.sessionId!==sessionId)throw Error('permission_denied');
  if(!/\.html$/i.test(selected.path)||!selected.after.toString('utf8').startsWith(HTML_ARTIFACT_PREFIX))throw Error('unsupported');
  const root=authorizedWorkspace(await options.workspace(sessionId),options.dataRoot);if(workspaceHash(root)!==selected.workspaceHash)throw Error('permission_denied');
  const records=await state.versionRecords(sessionId),family=textVersionFamilies(records).get(id);if(!family)throw Error('conflict');
  const latest=await state.get(family.currentId||family.versions.at(-1)!.id);if(!latest)throw Error('configuration');
  return {selected,latest,root,records,family};
 }
 function integrity(root:string,row:PrivateTextChange):'same'|'changed'|'missing' {
  try {const file=approvedFile(root,row.path),stat=fs.lstatSync(file);
   if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size!==row.after.length)return 'changed';
   const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));try {
    const bytes=Buffer.alloc(row.after.length+1);let count=0;
    while(count<bytes.length){const read=fs.readSync(fd,bytes,count,bytes.length-count,count);if(!read)break;count+=read;}
    const post=fs.fstatSync(fd),last=fs.lstatSync(approvedFile(root,row.path));
    return count===row.after.length&&changeHash(bytes.subarray(0,count))===row.afterSha256&&post.mtimeMs===stat.mtimeMs&&post.ctimeMs===stat.ctimeMs&&last.ino===post.ino&&last.mtimeMs===post.mtimeMs?'same':'changed';
   }finally{fs.closeSync(fd);}
  } catch(error) {if(['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code||''))return 'missing';throw error;}
 }
 async function view(sessionId:string,id:string):Promise<OfficeVersionView> {
  const c=await context(sessionId,id),status=c.family.currentId?integrity(c.root,c.latest):'missing';
  if(authorizedWorkspace(await options.workspace(sessionId),options.dataRoot)!==c.root)throw Error('permission_denied');
  return {schemaVersion:OFFICE_VERSIONS_SCHEMA,sessionId,selectedArtifactId:id,currentArtifactId:c.latest.id,
   integrity:id===c.latest.id?status:'same',canRestore:!!c.family.currentId&&id!==c.latest.id&&c.selected.afterSha256!==c.latest.afterSha256&&status==='same',
   historyBacking:'text_ledger',htmlPreview:htmlArtifactPreview(c.selected.after.toString('utf8')),
   versions:c.family.versions.map((r,i)=>({artifactId:r.id,path:r.path,title:path.posix.basename(r.path),format:'html',number:i+1,savedAt:r.savedAt,verifiedAt:r.verifiedAt,parentArtifactId:r.parentChangeId,size:r.size,
    change:r.callId.startsWith('restore:')?'从历史版本恢复，另存新文件':r.operation==='create'?'首次保存':'原文件局部修改；先前内容仍保留在修改记录中'}))};
 }
 async function restore(input:Extract<OfficeVersionInput,{action:'restore'}>,assertCurrent:()=>void) {
  assertFileWritesEnabled();assertCurrent();const runId='local_restore_'+input.commandId,callId='restore:'+input.artifactId;
  let existing=await state.call(input.sessionId,runId,callId);assertCurrent();
  const c=await context(input.sessionId,input.artifactId);assertCurrent();
  const service=createTextChangeService({state,dataRoot:options.dataRoot,workspace:async id=>{assertCurrent();return options.workspace(id);},isCurrent:(id,run)=>{try{assertCurrent();return id===input.sessionId&&run===runId;}catch{return false;}},afterStage:options.afterStage});
  // A command has one destination and one selected version, even if reused after another task.
  if(c.records.some(r=>r.runId===runId&&r.callId!==callId))throw Error('conflict');
  if(existing) {
   if(existing.parentChangeId!==input.currentArtifactId||existing.afterSha256!==c.selected.afterSha256)throw Error('conflict');
   if(existing.state==='uncertain')await service.decision({schemaVersion:'xiaozhi.change.v1',sessionId:input.sessionId,changeId:existing.id,revision:existing.revision,action:'verify'});
   existing=await state.get(existing.id);if(existing?.state!=='applied')throw Error('conflict');return view(input.sessionId,existing.id);
  }
  if(c.latest.id!==input.currentArtifactId||!c.family.currentId)throw Error('conflict');
  const status=integrity(c.root,c.latest);if(status!=='same')throw Error(status);
  if(c.selected.afterSha256===c.latest.afterSha256)return view(input.sessionId,c.latest.id);
  if(c.records.some(r=>r.workspaceHash===c.latest.workspaceHash&&r.path===c.latest.path&&['executing','uncertain','reverting','undo_uncertain'].includes(r.state)))throw Error('conflict');
  const first=c.family.versions[0],destination=path.posix.join(path.posix.dirname(first.path),path.posix.basename(first.path,'.html')+`-恢复版${c.family.versions.length+1}.html`);
  let row=await service.propose(input.sessionId,runId,callId,{operation:'create',path:destination,content:c.selected.after.toString('utf8')},undefined,false,c.latest.id);assertCurrent();
  if(row.afterSha256!==c.selected.afterSha256)throw Error('changed');
  row=await service.decision({schemaVersion:'xiaozhi.change.v1',sessionId:input.sessionId,changeId:row.id,revision:row.revision,action:'approve'});assertCurrent();
  if(row.state!=='approved')throw Error('conflict');row=await service.apply(input.sessionId,row.id);assertCurrent();
  if(row.state!=='applied')throw Error('conflict');return view(input.sessionId,row.id);
 }
 return {async execute(raw:unknown,assertCurrent:()=>void,useFile?:(file:string,action:'open'|'locate')=>Promise<void>):Promise<OfficeVersionResult> {
  if(!validOfficeVersionInput(raw))return {ok:false,error:'invalid_input'};
  try {assertCurrent();if(raw.action==='restore')return {ok:true,value:await restore(raw,assertCurrent)};
   const value=await view(raw.sessionId,raw.artifactId);assertCurrent();
   if(raw.action!=='view') {
    const c=await context(raw.sessionId,raw.artifactId);assertCurrent();let file:string;
    if(c.selected.id===c.latest.id) {const status=integrity(c.root,c.selected);if(status!=='same')throw Error(status);file=approvedFile(c.root,c.selected.path);}
    else {
     // Historical same-path edits have no separate original disk file. Materialize exact ledger bytes only on explicit OS use.
     const relative=path.join('derived','html-versions',raw.sessionId,raw.artifactId+'.html');file=approvedFile(options.dataRoot,relative);
     fs.mkdirSync(path.dirname(file),{recursive:true});file=approvedFile(options.dataRoot,relative);
     try{fs.writeFileSync(file,c.selected.after,{flag:'wx',mode:0o600});}catch(error){if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
     const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size!==c.selected.after.length||changeHash(fs.readFileSync(file))!==c.selected.afterSha256)throw Error('changed');
    }
    assertCurrent();if(!useFile)throw Error('open_failed');await useFile(file,raw.action);assertCurrent();
   }
   return {ok:true,value};
  }catch(error) {const code=error instanceof Error?error.message:'';return {ok:false,error:(['invalid_input','permission_denied','busy','changed','missing','conflict','unsupported','file_writes_disabled','open_failed'].includes(code)?code:'configuration') as OfficeVersionError};}
 }};
}
