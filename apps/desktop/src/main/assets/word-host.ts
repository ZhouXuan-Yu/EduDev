import {randomUUID} from 'node:crypto';
import {WORD_SCHEMA,validWordResult,type WordResult} from '../../shared/material-word';
import {runLocalUtility} from '../xiaozhi-agent/local-utility-host';
export function extractWord(bytes:Uint8Array,signal:AbortSignal):Promise<WordResult>{
 const requestId='word_'+randomUUID();return runLocalUtility({entry:'word-worker.js',serviceName:'小智Word结构解析',request:{schemaVersion:WORD_SCHEMA,requestId,bytes},timeout:60000,signal,valid:(v):v is WordResult=>validWordResult(v,requestId),fail:error=>({schemaVersion:WORD_SCHEMA,requestId,ok:false,error})});
}
