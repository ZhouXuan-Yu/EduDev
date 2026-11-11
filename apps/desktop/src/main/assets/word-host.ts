import {randomUUID} from 'node:crypto';
import {WORD_SCHEMA,validWordResult,type WordResult} from '../../shared/material-word';
import {runLocalUtility} from '../xiaozhi-agent/local-utility-host';
import {rasterizeLocalMetafiles} from '../xiaozhi-agent/ocr-host';
import {completeWordMetafiles} from './word-metafiles';
export async function extractWord(bytes:Uint8Array,signal:AbortSignal):Promise<WordResult>{
 const requestId='word_'+randomUUID();
 const result=await runLocalUtility<WordResult>({
  entry:'word-worker.js',serviceName:'小智Word结构解析',request:{schemaVersion:WORD_SCHEMA,requestId,bytes},timeout:60000,signal,
  valid:(v):v is WordResult=>validWordResult(v,requestId),fail:error=>({schemaVersion:WORD_SCHEMA,requestId,ok:false,error})
 });
 if(!result.ok)return result;
 try{
  return {...result,payload:await completeWordMetafiles(result.payload,signal,rasterizeLocalMetafiles)};
 }catch(cause){
  const error=cause instanceof Error?cause.message:'';
  if(signal.aborted)return {schemaVersion:WORD_SCHEMA,requestId,ok:false,error:'cancelled'};
  if(error==='too_large'||error==='timeout'||error==='busy'||error==='unavailable')return {schemaVersion:WORD_SCHEMA,requestId,ok:false,error};
  return {schemaVersion:WORD_SCHEMA,requestId,ok:false,error:'parse_failed'};
 }
}
