import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {DocumentArtifactExportResult} from '../../shared/contracts';
import {isPaperOfficeDraft,OFFICE_OUTPUT_MAX_BYTES} from '../../shared/xiaozhi-office-draft';
import {officeHash,officeRelativePath} from '../../shared/xiaozhi-office-artifacts';
import {DOCUMENT_SCHEMA,DOCUMENT_TIMEOUT,validDocumentResult,type DocumentRequest,type DocumentExtraction} from '../../shared/xiaozhi-documents';
import {validSavedArtifactPreviewInput,SAVED_ARTIFACT_PREVIEW_ERRORS,type SavedArtifactPreviewInput,type SavedArtifactPreviewResult,type SavedArtifactPreviewError} from '../../shared/saved-artifact-preview';
import type {PrivateOfficeArtifact} from './office-artifact-state';
import {authorizedWorkspace,approvedFile,workspaceHash} from './workspace-authority';
import {fileVersion} from './workspace-files';

type Options={dataRoot:string;authorize:(id:string)=>Promise<void>;current:(id:string)=>boolean;
  /** Real OfficeArtifactState.byArtifact validates saved paper lineage before returning. */
  byArtifact:(sessionId:string,id:string)=>Promise<PrivateOfficeArtifact|null>;
  artifact:(id:string)=>Promise<DocumentArtifactExportResult|null>;
  /** Must require the EXACT paper-output grant; no ordinary/default workspace fallback. */
  resolve:(sessionId:string,workspaceHash:string)=>Promise<string|null>;
  extract:(request:DocumentRequest,signal:AbortSignal)=>Promise<DocumentExtraction>};
const sha=(bytes:Buffer|string)=>createHash('sha256').update(bytes).digest('hex');
function fail(code:SavedArtifactPreviewError):never{throw Error(code);}
const safeStat=(root:string,relative:string)=>{
  const file=approvedFile(root,relative),stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)fail('permission_denied');
  return {file,stat};
};

/** One exact saved paper file; no directory listing, model, business writes or new grants. */
export function createSavedArtifactPreview(options:Options){
  const jobs=new Map<string,{input:SavedArtifactPreviewInput;abort:AbortController;done:Promise<SavedArtifactPreviewResult>}>();
  let closed=false;
  const key=(input:SavedArtifactPreviewInput)=>[input.sessionId,input.artifactId,input.requestId].join(':');
  async function read(input:SavedArtifactPreviewInput,signal:AbortSignal):Promise<SavedArtifactPreviewResult>{
    const current=()=>{signal.throwIfAborted();if(closed||!options.current(input.sessionId))fail('permission_denied');};
    async function binding(){
      current();await options.authorize(input.sessionId);current();
      const row=await options.byArtifact(input.sessionId,input.artifactId),artifact=await options.artifact(input.artifactId);current();
      if(!row||!artifact||row.sessionId!==input.sessionId||row.artifactId!==input.artifactId||row.state!=='saved'
        ||artifact.id!==input.artifactId||artifact.sessionId!==input.sessionId||artifact.status!=='exported')fail('permission_denied');
      if(!isPaperOfficeDraft(row.draft)||!['docx','pdf'].includes(row.format))fail('unsupported');
      if(!officeRelativePath(row.path)||!officeHash(row.workspaceHash)||!officeHash(row.outputHash)||!row.output
        ||row.output.length<1||row.output.length>OFFICE_OUTPUT_MAX_BYTES||sha(row.output)!==row.outputHash
        ||artifact.type!==row.format||artifact.fileName!==row.path||artifact.contentHash!==row.outputHash
        ||artifact.fileSize!==row.output.length||artifact.filePath!==row.resultPath)fail('changed');
      const raw=await options.resolve(input.sessionId,row.workspaceHash);current();if(!raw)fail('permission_denied');
      const root=authorizedWorkspace(raw,options.dataRoot);if(workspaceHash(root)!==row.workspaceHash)fail('permission_denied');
      const file=approvedFile(root,row.path);if(file!==row.resultPath||file!==artifact.filePath)fail('permission_denied');
      // Immutable scalar snapshot, not aliases to mutable host objects.
      const directory=fs.lstatSync(root);
      if(!directory.isDirectory()||directory.isSymbolicLink()||fs.realpathSync(root)!==root)fail('permission_denied');
      const token=sha(JSON.stringify([root,directory.dev,directory.ino,directory.birthtimeMs,row.id,row.revision,row.workspaceHash,row.path,row.format,row.outputHash,row.draftHash,
        row.runId,row.callId,row.resultPath,artifact.id,artifact.updatedAt,artifact.fileSize,artifact.contentHash]));
      current();return {root,file,row,token};
    }
    const bound=await binding(),before=safeStat(bound.root,bound.row.path),version=fileVersion(before.stat);
    if(before.stat.size!==bound.row.output!.length)fail('changed');
    const handle=await fs.promises.open(before.file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
    try{
      current();let stat=await handle.stat();if(!stat.isFile()||stat.nlink!==1||fileVersion(stat)!==version)fail('changed');
      const buffer=Buffer.alloc(before.stat.size+1);let count=0;
      while(count<buffer.length){current();const result=await handle.read(buffer,count,buffer.length-count,count);if(!result.bytesRead)break;count+=result.bytesRead;}
      current();stat=await handle.stat();
      if(count!==before.stat.size||fileVersion(stat)!==version||stat.nlink!==1||fileVersion(safeStat(bound.root,bound.row.path).stat)!==version)fail('changed');
      const bytes=buffer.subarray(0,count);if(sha(bytes)!==bound.row.outputHash)fail('changed');
      const parsed=await options.extract({schemaVersion:DOCUMENT_SCHEMA,requestId:input.requestId,filename:path.basename(bound.row.path),bytes},signal);
      current();if(!validDocumentResult(parsed,input.requestId))fail('parse_failed');
      const final=await binding();current();
      const post=await handle.stat();if(final.token!==bound.token||post.nlink!==1||fileVersion(post)!==version||fileVersion(safeStat(final.root,final.row.path).stat)!==version)fail('changed');
      if(!parsed.ok)fail(parsed.error);if(parsed.format!==bound.row.format)fail('parse_failed');
      current();return {ok:true,requestId:input.requestId,value:{artifactId:input.artifactId,name:path.basename(bound.row.path),format:parsed.format,
        sha256:bound.row.outputHash!,fileVersion:version,markdown:parsed.markdown,parser:parsed.parser,warnings:parsed.warnings}};
    }finally{await handle.close();}
  }
  return {
    async preview(raw:unknown):Promise<SavedArtifactPreviewResult>{
      if(!validSavedArtifactPreviewInput(raw))return {ok:false,requestId:'',error:'invalid_input'};
      const input={...raw},id=key(input);if(closed||!options.current(input.sessionId))return {ok:false,requestId:input.requestId,error:'permission_denied'};
      if(jobs.has(id)||jobs.size>=4)return {ok:false,requestId:input.requestId,error:'busy'};
      for(const job of jobs.values())if(job.input.sessionId===input.sessionId)job.abort.abort('cancelled');
      const abort=new AbortController(),timer=setTimeout(()=>abort.abort('timeout'),DOCUMENT_TIMEOUT);
      let listener:()=>void=()=>{};
      const cancelled=new Promise<never>((_,reject)=>{listener=()=>reject(Error(abort.signal.reason==='timeout'?'timeout':'cancelled'));abort.signal.addEventListener('abort',listener,{once:true});});
      const failure=(error:unknown):SavedArtifactPreviewResult=>{
        const item=(error instanceof Error?error:Error('read_failed')) as NodeJS.ErrnoException,code=abort.signal.aborted?(abort.signal.reason==='timeout'?'timeout':'cancelled'):
          item.code==='ENOENT'?'not_found':Object.hasOwn(SAVED_ARTIFACT_PREVIEW_ERRORS,item.message)?item.message as SavedArtifactPreviewError:'read_failed';
        return {ok:false,requestId:input.requestId,error:code};
      };
      // A cancelled response is not a finished read/parser: keep its slot until
      // the actual operation settles and closes its owned file handle.
      const done=read(input,abort.signal).catch(failure).finally(()=>{jobs.delete(id);});
      jobs.set(id,{input,abort,done});
      return Promise.race([done,cancelled]).catch(failure).finally(()=>{clearTimeout(timer);abort.signal.removeEventListener('abort',listener);});
    },
    cancel(raw:unknown):{ok:boolean}{if(!validSavedArtifactPreviewInput(raw))return {ok:false};const job=jobs.get(key(raw));if(!job)return {ok:false};job.abort.abort('cancelled');return {ok:true};},
    async close(){closed=true;for(const job of jobs.values())job.abort.abort('cancelled');await Promise.allSettled([...jobs.values()].map(job=>job.done));},
  };
}
