import {aiBatchId} from './material-ai';
import {materialId} from './materials';
export const AI_TEXT_SOURCE='xiaozhi.material-ai-text-source.v1' as const;
/** A reference to a rebuildable AI page document, never an original OCR-body receipt. */
export type AiTextSource={schemaVersion:typeof AI_TEXT_SOURCE;resourceId:string;version:string;offset:0;chunkId:string;bodyVersion:string;batchId:string;ordinal:number;page:number;finalSha:string};
export const AI_TEXT_SOURCE_PARAMETERS={type:'object',additionalProperties:false,properties:{schemaVersion:{type:'string',enum:[AI_TEXT_SOURCE]},resourceId:{type:'string',maxLength:45},version:{type:'string',pattern:'^[a-f0-9]{64}$'},offset:{type:'integer',minimum:0,maximum:0},chunkId:{type:'string',maxLength:42},bodyVersion:{type:'string',pattern:'^[a-f0-9]{64}$'},batchId:{type:'string',maxLength:44},ordinal:{type:'integer',minimum:1,maximum:100},page:{type:'integer',minimum:1,maximum:10000},finalSha:{type:'string',pattern:'^[a-f0-9]{64}$'}},required:['schemaVersion','resourceId','version','offset','chunkId','bodyVersion','batchId','ordinal','page','finalSha']};
export function validAiTextSource(v:unknown):v is AiTextSource{
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return false;
 const keys=['schemaVersion','resourceId','version','offset','chunkId','bodyVersion','batchId','ordinal','page','finalSha'];
 if(Reflect.ownKeys(v).length!==keys.length||!keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&'value'in d;}))return false;
 const s=v as AiTextSource,sha=(x:unknown)=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
 return s.schemaVersion===AI_TEXT_SOURCE&&materialId(s.resourceId)&&sha(s.version)&&s.offset===0&&/^chunk_[a-f0-9-]{36}$/i.test(s.chunkId)&&sha(s.bodyVersion)&&aiBatchId(s.batchId)&&Number.isSafeInteger(s.ordinal)&&s.ordinal>=1&&s.ordinal<=100&&Number.isSafeInteger(s.page)&&s.page>=1&&s.page<=10000&&sha(s.finalSha);
}
