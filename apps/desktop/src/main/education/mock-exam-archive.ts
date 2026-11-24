import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {withFileMutationQueue} from '@earendil-works/pi-coding-agent';
import {mockExamErrors,type MockExamResult} from '../../shared/mock-exam-compilation';
import {MOCK_EXAM_ARCHIVE_MAX_BYTES,validMockExamArchiveRequest,type MockExamArchiveConfirm,type MockExamArchivePreview,type SavedMockExamArchive} from '../../shared/mock-exam-archive';
import {createZipBuffer} from '../file-zip';
import {approvedFile} from '../xiaozhi-agent/workspace-authority';
import {conversationOutput} from '../xiaozhi-agent/conversation-output';
import {removeOwnedFileStage,withOwnedFileStage} from '../xiaozhi-agent/owned-file-stage';
import {assertFileWritesEnabled} from '../xiaozhi-agent/file-write-policy';
import {hashFileSha256} from '../local-file-security';
import type {MaterialRepository} from '../assets/material-repository';
import type {createMockExamState} from './mock-exam-state';
import {mockExamArchiveSummary,planMockExamArchive} from './mock-exam-archive-plan';

const hash=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
function originalFiles(plan:MockExamArchivePreview){
  const files=new Map<string,{path:string;id:string;sha256:string}>();
  for(const {paper,answer} of plan.entries)for(const {path,resourceId,sha256} of [paper,answer]){
    if(!path||!resourceId||!sha256)continue;
    const prior=files.get(path);
    if(prior&&(prior.id!==resourceId||prior.sha256!==sha256))throw Error('configuration');
    files.set(path,{path,id:resourceId,sha256});
  }
  return [...files.values()];
}
const errors:Record<string,string>={...mockExamErrors,not_confirmed:'请先确认模考目录。',
  no_permitted_originals:'没有可以打包的试卷。请核对已收录试卷的本地使用许可。',
  too_large:'原件包超出 64 MB。请按学科、年级或轮次拆分目录后重试。',
  conflict:'目标文件或保存记录发生变化。没有覆盖原文件。',
  file_writes_disabled:'文件生成已暂停。'};

function failure(error:unknown){
  const code=error instanceof Error&&Object.hasOwn(errors,error.message)?error.message:'configuration';
  return {ok:false as const,error:code,message:errors[code]};
}
function artifactId(input:MockExamArchiveConfirm){
  const value=hash(JSON.stringify([input.sessionId,input.catalogId,input.revision,input.digest,input.previewDigest]));
  return 'artifact_'+[value.slice(0,8),value.slice(8,12),value.slice(12,16),value.slice(16,20),value.slice(20,32)].join('-');
}
function filename(plan:MockExamArchivePreview,id:string){
  const title=plan.title.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/gu,'-').trim().slice(0,80);
  return title+'-第'+plan.revision+'版-原件-'+id.slice(-8)+'.zip';
}

export function createMockExamArchive(options:{dataRoot:string;state:ReturnType<typeof createMockExamState>;
  materials:Pick<MaterialRepository,'resource'|'original'|'verifyOriginalVersion'>;stopped:()=>boolean}){
  const {state,materials}=options,ledger=state.archives;
  const current=()=>{if(options.stopped())throw Error('permission_denied');};
  return {
    async preview(input:unknown):Promise<MockExamResult<MockExamArchivePreview>>{
      if(!validMockExamArchiveRequest(input))return failure(Error('invalid_input'));
      try{current();const plan=planMockExamArchive(await state.readConfirmed(input.sessionId,input));current();return {ok:true,value:plan};}
      catch(error){return failure(error);}
    },
    async save(input:unknown):Promise<MockExamResult<SavedMockExamArchive>>{
      if(!validMockExamArchiveRequest(input,true))return failure(Error('invalid_input'));
      try{
        current();assertFileWritesEnabled();
        const checkPlan=(plan:MockExamArchivePreview)=>{
          if(plan.previewDigest!==input.previewDigest)throw Error('version_conflict');
          if(!plan.paperCount)throw Error('no_permitted_originals');
        };
        const plan=planMockExamArchive(await state.readConfirmed(input.sessionId,input));checkPlan(plan);current();
        const id=artifactId(input),root=conversationOutput(options.dataRoot,input.sessionId).path,name=filename(plan,id),target=approvedFile(root,name);
        return await withFileMutationQueue(target,async()=>{
          const signal=AbortSignal.timeout(120_000);
          const fence=()=>{signal.throwIfAborted();current();assertFileWritesEnabled();};
          const publish=async(temporary?:string)=>state.withConfirmed(input.sessionId,input,async(catalog,work)=>{
            fence();checkPlan(planMockExamArchive(catalog));
            if(conversationOutput(options.dataRoot,input.sessionId).path!==root||approvedFile(root,name)!==target)throw Error('permission_denied');
            if(temporary){
              fs.linkSync(temporary,target);
              fs.unlinkSync(temporary);
            }
            await ledger.finish(id,work);
          });
          const row=await ledger.get(id);
          const stage=await ledger.stage(id);
          if(stage){removeOwnedFileStage(target,stage);await ledger.recordStage(id,null);}
          if(row){
            if(row.session_id!==input.sessionId||row.catalog_id!==input.catalogId||row.file_name!==name)throw Error('conflict');
            if(fs.existsSync(target)){
              const stat=await fs.promises.lstat(target);
              if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size!==row.file_size||
                await hashFileSha256(target,signal)!==row.content_hash)throw Error('conflict');
              fence();
              if(row.status==='draft')await publish();
              else if(row.status!=='exported')throw Error('conflict');
              return {ok:true as const,value:{artifactId:id,fileName:name,fileSize:Number(row.file_size),sha256:String(row.content_hash)}};
            }
            if(row.status!=='draft')throw Error('conflict');
          }else if(fs.existsSync(target))throw Error('conflict');

          const summary=mockExamArchiveSummary(plan),files:{name:string;data:Buffer}[]=[
            {name:'清单.json',data:Buffer.from(JSON.stringify(plan,null,2),'utf8')},
            {name:'使用说明.md',data:Buffer.from(summary,'utf8')},
          ];
          const originals=originalFiles(plan);
          let bytes=files.reduce((size,file)=>size+file.data.length,0);
          for(const original of originals){
            fence();
            const resource=await materials.resource(original.id);
            if(resource.contentHash!==original.sha256)throw Error('source_changed');
            if(bytes+resource.fileSize>=MOCK_EXAM_ARCHIVE_MAX_BYTES)throw Error('too_large');
            const data=await materials.original(original.id,original.sha256,signal).catch(error=>{
              if(signal.aborted||error instanceof Error&&error.message==='too_large')throw error;
              throw Error('source_changed');
            });
            bytes+=data.length;
            if(bytes>=MOCK_EXAM_ARCHIVE_MAX_BYTES)throw Error('too_large');
            files.push({name:original.path,data});
          }
          const output=createZipBuffer(files,new Date(2000,0,1));
          if(output.length>MOCK_EXAM_ARCHIVE_MAX_BYTES)throw Error('too_large');
          const sha256=hash(output);fence();
          if(!row)await ledger.reserve({id,sessionId:input.sessionId,catalogId:input.catalogId,title:plan.title+' · 原件包',fileName:name,fileSize:output.length,sha256,summary});
          else if(row.content_hash!==sha256||row.file_size!==output.length)throw Error('conflict');
          await withOwnedFileStage(target,output,stage=>ledger.recordStage(id,stage),async temporary=>{
            for(const original of originals){fence();await materials.verifyOriginalVersion(original.id,original.sha256,signal);}
            await publish(temporary);
          });
          return {ok:true as const,value:{artifactId:id,fileName:name,fileSize:output.length,sha256}};
        });
      }catch(error){return failure(error);}
    },
  };
}
