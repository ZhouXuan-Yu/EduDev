import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';import path from 'node:path';
import type {DiagnosticPreview,DiagnosticReport,DiagnosticResult,DiagnosticSaved} from '../../../shared/xiaozhi-diagnostics';
import {validDiagnosticInput,validDiagnosticExportInput} from '../../../shared/xiaozhi-diagnostics';
export function createDiagnostics(options:{read:(sessionId:string,runId:string)=>Promise<DiagnosticReport|null>;choose:(name:string)=>Promise<string|undefined>;now?:()=>number}){
 const now=options.now||Date.now,cache=new Map<string,{sessionId:string;expires:number;preview:DiagnosticPreview;text:string}>();let saving=false;
 function expire(){for(const [id,row]of cache)if(row.expires<=now())cache.delete(id);}
 return {
  async preview(input:unknown):Promise<DiagnosticResult<DiagnosticPreview>>{
   if(!validDiagnosticInput(input))return{ok:false,error:'invalid_input'};expire();
   try{const report=await options.read(input.sessionId,input.runId);if(!report)return{ok:false,error:'unavailable'};const text=JSON.stringify(report,null,2)+'\n',bytes=Buffer.byteLength(text);if(bytes>128*1024)return{ok:false,error:'unavailable'};
    const preview={previewId:'diagnostic_'+randomUUID(),sha256:createHash('sha256').update(text).digest('hex'),bytes,report};
    if(cache.size>=8)cache.delete(cache.keys().next().value!);cache.set(preview.previewId,{sessionId:input.sessionId,expires:now()+600_000,preview:structuredClone(preview),text});return{ok:true,value:preview};
   }catch{return{ok:false,error:'unavailable'};}
  },
  async save(input:unknown):Promise<DiagnosticResult<DiagnosticSaved>>{
   if(!validDiagnosticExportInput(input))return{ok:false,error:'invalid_input'};expire();const row=cache.get(input.previewId);if(!row||row.sessionId!==input.sessionId)return{ok:false,error:'expired'};if(saving)return{ok:false,error:'busy'};
   saving=true;let temporary:string|undefined;
   try{const target=await options.choose('小智诊断-'+row.preview.report.generatedAt.slice(0,10)+'-'+row.preview.report.runRef.slice(0,8)+'.json');if(!target)return{ok:true,value:{cancelled:true}};
    if(row.expires<=now()||cache.get(input.previewId)!==row)return{ok:false,error:'expired'};
    const file=path.resolve(target),directory=await fs.realpath(path.dirname(file));temporary=path.join(directory,'.xiaozhi-diagnostic-'+randomUUID()+'.tmp');
    const candidate=temporary;temporary=undefined;const handle=await fs.open(candidate,'wx',0o600);temporary=candidate;
    try{await handle.writeFile(row.text);await handle.sync();}finally{await handle.close();}
    await fs.rename(temporary,path.join(directory,path.basename(file)));temporary=undefined;
    return{ok:true,value:{cancelled:false,bytes:row.preview.bytes,sha256:row.preview.sha256}};
   }catch{return{ok:false,error:'write_failed'};}finally{if(temporary)await fs.unlink(temporary).catch(()=>{});saving=false;}
  },
 };
}
