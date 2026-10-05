import {randomUUID} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {createWorkspaceFiles,validFileRequest,type WorkspaceLease} from './workspace-files';
import {isOfficeDocument} from '../../shared/xiaozhi-documents';
import {XIAOZHI_FILES_SCHEMA,XIAOZHI_FILE_ERRORS,type XiaozhiFileError} from '../../shared/xiaozhi-files';
type PrivacyStore={sanitizeProblemText:(text:string)=>Promise<{sanitizedText:string}>;listStudents:(query:string)=>Promise<{displayName?:string;realName?:string}[]>};
/** Reuse the existing education patterns plus known local names; no name list leaves main. */
export async function sanitizeOfficeDocumentText(store:PrivacyStore,text:string):Promise<string>{
  return (await createOfficeDocumentSanitizer(store))(text);
}
/** A bounded local search can reuse one name inventory; no names enter worker/model. */
export async function createOfficeDocumentSanitizer(store:PrivacyStore):Promise<(text:string)=>Promise<string>>{
  const names=[...new Set((await store.listStudents('')).flatMap(student=>[student.realName,student.displayName]).filter((name):name is string=>!!name&&name.trim().length>=2))].sort((a,b)=>b.length-a.length);
  return async text=>{let value=(await store.sanitizeProblemText(text)).sanitizedText;for(const name of names)value=value.split(name).join('[学生姓名]');return value;};
}
type Options={sessionId:string;runId:string;isCurrent:()=>boolean;resolve:(id:string)=>Promise<WorkspaceLease>;sanitize:(text:string)=>Promise<string>};
/** One actual readonly tool, sharing the local preview/authority/parser boundary. */
export function createOfficeDocumentTools(options:Options):ToolDefinition[]{
  const current=(signal?:AbortSignal)=>{signal?.throwIfAborted();if(!options.isCurrent())throw new Error('permission_denied');};
  const files=createWorkspaceFiles(async id=>{current();const lease=await options.resolve(id);current();return lease;});
  return [{name:'office_read_document',label:'读取办公文档',description:'读取教师已授权目录的DOCX/PDF/XLSX/PPTX必要正文。明确文件相对路径可直接读取，需要确定名称时先列目录；可分批startLine/lineCount。结果仅提取正文行位置，不是原文件页码；请用真实来源标题及提取行范围引用。扫描PDF需本地OCR，失败不得虚构正文。',
    parameters:{type:'object',additionalProperties:false,properties:{path:{type:'string',maxLength:500},startLine:{type:'integer',minimum:1},lineCount:{type:'integer',minimum:1,maximum:100}},required:['path']} as ToolDefinition['parameters'],
    execute:async(_callId,args,signal)=>{
      const failed=(code:XiaozhiFileError)=>({content:[{type:'text' as const,text:XIAOZHI_FILE_ERRORS[code]}],isError:true,details:{success:false,error:{code,message:XIAOZHI_FILE_ERRORS[code],retryable:['busy','timeout','changed','unavailable'].includes(code)}}});
      try{
        current(signal);
        if(!args||typeof args!=='object'||Array.isArray(args))return failed('invalid_input');
        const raw=args as Record<string,unknown>,start=raw.startLine??1,count=raw.lineCount??60;
        if(Object.keys(raw).some(key=>!['path','startLine','lineCount'].includes(key))||typeof raw.path!=='string'||!isOfficeDocument(raw.path)
          ||!Number.isSafeInteger(start)||Number(start)<1||!Number.isSafeInteger(count)||Number(count)<1||Number(count)>100)return failed('invalid_input');
        const base={schemaVersion:XIAOZHI_FILES_SCHEMA,sessionId:options.sessionId,requestId:`xifile_${randomUUID()}`,path:raw.path};
        if(!validFileRequest(base))return failed('invalid_input');
        const initial=await files.stat(base,signal||new AbortController().signal);current(signal);
        if(!initial.ok)return failed(initial.error);
        const entry=initial.data;
        const read=await files.preview({...base,requestId:`xifile_${randomUUID()}`,workspaceVersion:initial.workspaceVersion,version:entry.version},signal||new AbortController().signal);current(signal);
        if(!read.ok)return failed(read.error);
        if(read.data.format!=='office'||!read.data.document||typeof read.data.text!=='string')return failed('unsupported');
        const clean=await options.sanitize(read.data.text);current(signal);
        const lines=clean.split('\n');if(Number(start)>lines.length)return failed('invalid_input');
        const wanted=lines.slice(Number(start)-1,Number(start)-1+Number(count));
        let text='',used=0,partialLine=false;
        for(const line of wanted){const remaining=16000-text.length-(used?1:0);if(remaining<=0)break;const part=line.slice(0,remaining);text+=(used?'\n':'')+part;used++;if(part.length<line.length){partialLine=true;break;}}
        const end=Number(start)+used-1,title=(await options.sanitize(read.data.path)).slice(0,200);current(signal);
        const payload={success:true,text,format:read.data.document.format,sanitized:true,totalLines:lines.length,truncated:partialLine||end<lines.length,
          source:{title,version:read.data.version,locator:{kind:'extracted_lines',start:Number(start),end,partialLine},originalPageLocated:false},
          citation:`${title} · 提取正文第${start}–${end}行（原页码未定位）`};
        const final=await files.stat({...base,requestId:`xifile_${randomUUID()}`},signal||new AbortController().signal);current(signal);
        if(!final.ok)return failed(final.error);
        if(final.workspaceVersion!==initial.workspaceVersion||final.data.version!==entry.version)return failed('changed');
        // Safe model excerpt; public projection only reads the explicit title list.
        return {content:[{type:'text' as const,text:JSON.stringify(payload)}],details:{success:true,data:{sources:[{title:payload.citation}]}}};
      }catch(error){return failed(signal?.aborted?'cancelled':(error as Error).message==='permission_denied'?'permission_denied':'read_failed');}
    }
  }];
}
