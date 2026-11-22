import {randomUUID} from 'node:crypto';
import {validTeachingArtifactReference,type TeachingArtifactReferenceResult} from '../../shared/teaching-artifact-reference';
import {XIAOZHI_ATTACHMENT_ERRORS,type XiaozhiAttachmentError} from '../../shared/xiaozhi-attachments';
import {createAttachmentImportService} from './attachment-import-service';
import type {createXiaozhiSessionState} from './session-state';
import type {ResolvedArtifactFile} from './catalog-artifact-file';

export function createArtifactReferences(options:{state:ReturnType<typeof createXiaozhiSessionState>; dataRoot:string;
  resolve:(sessionId:string,artifactId:string)=>Promise<ResolvedArtifactFile>; closing:()=>boolean}) {
  const jobs=new Map<string,Promise<TeachingArtifactReferenceResult>>();
  const shutdown=new AbortController();
  const importer=createAttachmentImportService({dataRoot:options.dataRoot,state:options.state.attachments,imports:options.state.attachmentImports,
    isCurrent:()=>!options.closing()});
  return {
    async create(input:unknown):Promise<TeachingArtifactReferenceResult> {
      if(!validTeachingArtifactReference(input)) return {ok:false,error:'invalid_input'};
      if(options.closing()) return {ok:false,error:'cancelled'};
      const {sourceSessionId,artifactId,contentHash}=input;
      if(jobs.size>=4||jobs.has(sourceSessionId)) return {ok:false,error:'busy'};
      const signal=AbortSignal.any([shutdown.signal,AbortSignal.timeout(45000)]);
      const work=(async ():Promise<TeachingArtifactReferenceResult>=>{
        try{
          const file=await options.resolve(sourceSessionId,artifactId);
          const sessionId=`aisession_${randomUUID()}`;
          const staged=await importer.stageArtifact(sessionId,file.path,{sourceSessionId,artifactId,contentHash,fileVersion:file.version},signal);
          try{return {ok:true,sessionId:await options.state.artifactReferences.publish(staged,signal)};}
          catch(error){
            // Keep the copy if delivery committed despite an ambiguous acknowledgement.
            const rows=await options.state.attachments.list(sessionId).catch(()=>undefined);
            if(rows?.length===0)await staged.discard().catch(()=>undefined);
            throw error;
          }
        }catch(error){
          const code=error instanceof Error ? error.message : '';
          if(signal.aborted) return {ok:false,error:options.closing()?'cancelled':'timeout'};
          if(error instanceof Error && (error as NodeJS.ErrnoException).code==='ENOENT') return {ok:false,error:'not_found'};
          if(code==='AI 对话不存在') return {ok:false,error:'permission_denied'};
          return {ok:false,error:Object.hasOwn(XIAOZHI_ATTACHMENT_ERRORS,code)?code as XiaozhiAttachmentError:'read_failed'};
        }
      })();
      jobs.set(sourceSessionId,work);
      try{return await work;}finally{jobs.delete(sourceSessionId);}
    },
    async close(){shutdown.abort();await Promise.allSettled(jobs.values());},
  };
}
