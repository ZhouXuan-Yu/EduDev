import fs from 'node:fs';
import path from 'node:path';
import {ARTIFACT_SOURCES_SCHEMA,validArtifactSourcesInput,type ArtifactSourcesResult,type ArtifactSourceItem} from '../../shared/artifact-sources';
import type {XiaozhiPublicSource} from '../../shared/xiaozhi-web';
import {validLocalAnswerSource} from '../../shared/local-answer-source';
import {validQuestionContextSource} from '../../shared/question-context';
import {validMaterialReference} from '../../shared/materials';
import {validStudentContextSource} from '../../shared/student-context';
import {isPaperOfficeDraft} from '../../shared/xiaozhi-office-draft';
import type {PaperView} from '../../shared/paper-blueprint';
import type {createTextChangeState} from './text-change-state';
import type {createOfficeArtifactState} from './office-artifact-state';
import type {createEventJournal} from './events/journal';
import {approvedFile,workspaceHash} from './workspace-authority';
import {fileVersion} from './workspace-files';

function publicSource(raw:unknown):XiaozhiPublicSource {
 const v=raw&&typeof raw==='object'?raw as XiaozhiPublicSource:{} as XiaozhiPublicSource;
 const title=typeof v.title==='string'?v.title.slice(0,500):'旧来源记录不可读取';
 return {title,...(validLocalAnswerSource(v.local)?{local:v.local}:{}),...(validQuestionContextSource(v.question)?{question:v.question}:{}),
  ...(validMaterialReference(v.material)?{material:v.material}:{}),...(validStudentContextSource(v.student)?{student:v.student}:{}),
  ...(typeof v.url==='string'&&/^https?:\/\//i.test(v.url)&&v.url.length<=2048?{url:v.url}:{}),
  ...(v.kind==='read'||v.kind==='search'?{kind:v.kind}:{}),...(typeof v.observedAt==='string'&&v.observedAt.length<=64?{observedAt:v.observedAt}:{})};
}
/** On-demand projection of original source facts and pre-generation read receipts. */
export function createArtifactSources(options:{changes:ReturnType<typeof createTextChangeState>;office:ReturnType<typeof createOfficeArtifactState>;journal:Pick<ReturnType<typeof createEventJournal>,'sourceWindow'>;
 authorize:(id:string)=>Promise<void>;workspace:(id:string)=>Promise<{path:string;version:string}>;paper:(sessionId:string,id:string)=>Promise<PaperView>;
 producer?:(sessionId:string,recordId:string,runId:string,callId:string)=>Promise<string>;current:()=>boolean}) {
 const live=()=>{if(!options.current())throw Error('busy');};
 return {async read(raw:unknown):Promise<ArtifactSourcesResult>{
  if(!validArtifactSourcesInput(raw))return {ok:false,error:'invalid_input'};
  try {
   live();await options.authorize(raw.sessionId);live();let runId='',callId='',recordId='',title='',inheritedFrom:string|undefined,origin:string|undefined;
   const bound:ArtifactSourceItem[]=[];
   if(raw.artifactId.startsWith('xichange_')) {
    let row=await options.changes.get(raw.artifactId);if(!row||row.sessionId!==raw.sessionId||!['applied','reverted'].includes(row.state))throw Error('permission_denied');
    title=path.posix.basename(row.path);const scope=await options.workspace(raw.sessionId);if(workspaceHash(scope.path)!==row.workspaceHash)throw Error('permission_denied');
    // Restores copy the selected version's bytes; their local command has no model read history.
    const seen=new Set<string>();
    while(/^local_restore_xicmd_[a-f0-9-]{36}$/i.test(row.runId)&&/^restore:xichange_[a-f0-9-]{36}$/i.test(row.callId)) {
     if(seen.has(row.id)||seen.size>=256)throw Error('configuration');seen.add(row.id);
     const parent=await options.changes.get(row.callId.slice(8));if(!parent||parent.sessionId!==raw.sessionId||parent.workspaceHash!==row.workspaceHash||parent.afterSha256!==row.afterSha256)throw Error('configuration');
     row=parent;inheritedFrom=row.id;
    }
    runId=row.runId;callId=row.callId;recordId=row.id;
   }else {
    const row=await options.office.byArtifact(raw.sessionId,raw.artifactId);if(!row)throw Error('permission_denied');
    title=row.draft.title;runId=row.runId;callId=row.callId;recordId=row.id;
    if(isPaperOfficeDraft(row.draft)) {
     const source=row.draft.paperSource,paper=await options.paper(raw.sessionId,source.paperId);if(paper.digest!==source.digest)throw Error('configuration');
     origin=`已确认试卷${paper.sourceCurrent?' · 题目来源版本仍一致':' · 题目来源已变化，保留原卷快照'}`;
     bound.push(...paper.selection.items.map(item=>({relation:'paper' as const,source:{title:`第${item.number}题 · 保存时的题目版本`,question:item.source}})));
    }else if('classroomSource' in row.draft) {
     const source=row.draft.classroomSource;origin=`已确认课堂第 ${source.revision} 版 · 打开资料时核对来源版本`;
     bound.push(...(source.context?.materials||[]).map(material=>({relation:'classroom' as const,source:{title:material.title,material:material.source}})));
    }else {
     const scope=await options.workspace(raw.sessionId);if(workspaceHash(scope.path)!==row.workspaceHash)throw Error('permission_denied');
     for(const source of row.sources) {
      let availability:'same'|'changed'|'missing'|'unavailable'='unavailable';
      try {const stat=fs.lstatSync(approvedFile(scope.path,source.path));availability=stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1?(fileVersion(stat)===source.version?'same':'changed'):'unavailable';}
      catch(error){if(['ENOENT','ENOTDIR'].includes((error as NodeJS.ErrnoException).code||''))availability='missing';}
      bound.push({relation:'declared',file:{...source,workspaceVersion:scope.version,availability}});
     }
    }
   }
   if(options.producer)callId=await options.producer(raw.sessionId,recordId,runId,callId);
   live();const offset=raw.offset??0,take=32;
   const reads=await options.journal.sourceWindow(raw.sessionId,runId,callId,Math.max(0,offset-bound.length),Math.max(0,take-Math.max(0,bound.length-offset)));
   live();await options.authorize(raw.sessionId);live();const total=bound.length+reads.total;if(offset>total)throw Error('invalid_input');
   const items=[...bound.slice(offset,offset+take),...reads.sources.map(source=>({relation:'read' as const,source:publicSource(source)}))];
   return {ok:true,value:{schemaVersion:ARTIFACT_SOURCES_SCHEMA,sessionId:raw.sessionId,artifactId:raw.artifactId,title,items,offset,total,nextOffset:offset+items.length<total?offset+items.length:null,
    readHistory:reads.available?'available':'unavailable',...(origin?{origin}:{}),...(inheritedFrom?{inheritedFrom}:{})}};
  }catch(error){const code=error instanceof Error?error.message:'';return {ok:false,error:code==='permission_denied'||code==='busy'||code==='invalid_input'?code:'configuration'};}
 }};
}
