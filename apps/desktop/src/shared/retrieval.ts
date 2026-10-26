export const RETRIEVAL_SCHEMA='xiaozhi.retrieval.v1' as const;
export const EMBEDDING_ID='bge-small-zh-v1.5.q8.cls-l2.window512-stride64.v1';
export const EMBEDDING_MODEL='15b717c382bcb518ba457b93ea6850ede7f4f1cd8937454aa06972366cd19bcc';
export const EMBEDDING_TOKENIZER='48cea5d44424912a6fd1ea647bf4fe50b55ab8b1e5879c3275f80e339e8fae26';
export const RETRIEVAL_BATCH_OBJECTS=16,RETRIEVAL_BATCH_TEXT=200000,RETRIEVAL_BATCH_BYTES=900*1024;
export type RetrievalKind='material'|'question';
export type IndexMaintenance={schemaVersion:'xiaozhi.index-maintenance.v1';phase:'idle'|'running'|'retry_pending';mode:'flat'|'ivf_flat';error:string;completedAt:string;vectorVersion:number;objectVersion:number;indexedRows:number;partitions:number;probes:number;sampleRecall:number;samples:number};
export const freshIndexMaintenance=():IndexMaintenance=>({schemaVersion:'xiaozhi.index-maintenance.v1',phase:'idle',mode:'flat',error:'',completedAt:'',vectorVersion:0,objectVersion:0,indexedRows:0,partitions:0,probes:0,sampleRecall:0,samples:0});
export function validIndexMaintenance(value:unknown):value is IndexMaintenance{
  const v=value as IndexMaintenance;if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==12||v.schemaVersion!=='xiaozhi.index-maintenance.v1'||!['idle','running','retry_pending'].includes(v.phase)||!['flat','ivf_flat'].includes(v.mode)||typeof v.error!=='string'||v.error.length>64||typeof v.completedAt!=='string'||v.completedAt.length>40)return false;
  return ['vectorVersion','objectVersion','indexedRows','partitions','probes','samples'].every(k=>Number.isSafeInteger(v[k as keyof IndexMaintenance])&&Number(v[k as keyof IndexMaintenance])>=0)&&Number.isFinite(v.sampleRecall)&&v.sampleRecall>=0&&v.sampleRecall<=1&&(v.mode==='flat'||v.partitions>=4&&v.partitions<=512&&v.probes>0&&v.probes<=v.partitions&&v.samples>=8&&v.sampleRecall>=0.98);
}
export type RetrievalStatus={schemaVersion:typeof RETRIEVAL_SCHEMA;available:boolean;generation:string;building:string;paused:boolean;phase:string;pending:number;indexed:number;failed:number;error:string;model:string;maintenance?:IndexMaintenance};
export type RetrievalAction={schemaVersion:typeof RETRIEVAL_SCHEMA;action:'pause'|'resume'|'rebuild'};
export const validRetrievalAction=(v:unknown):v is RetrievalAction=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')==='action,schemaVersion'&&(v as RetrievalAction).schemaVersion===RETRIEVAL_SCHEMA&&['pause','resume','rebuild'].includes((v as RetrievalAction).action);
export const validGeneration=(v:unknown):v is string=>typeof v==='string'&&/^generation_[a-f0-9-]{36}$/.test(v);
export type VectorWindow={start:number;end:number;vector:number[]};
export type RetrievalFact={kind:RetrievalKind;id:string;seq:number;digest:string;resourceId:string;subject:string;grade:string;knowledgePoint:string;questionType:string;difficulty:string;sourceKind:string;text:string;deleted:boolean};
export type VectorCandidate={id:string;seq:number;digest:string;start:number;end:number;distance:number};
export type VectorQuery={generation:string;kind:RetrievalKind;query:string;limit:number;resourceId?:string;subject?:string;grade?:string;knowledgePoint?:string;questionType?:string;difficulty?:string;sourceKind?:string;exact?:boolean};
export type SemanticCoverage={available:boolean;complete:boolean;generation:string;pending:number;failed:number;backfilling:boolean;reason:string;candidateLimit:number;exhausted:boolean;rerank?:import('./reranker').RerankCoverage};
export type GenerationSpec={id:string;modelHash:typeof EMBEDDING_MODEL;tokenizerHash:typeof EMBEDDING_TOKENIZER;dimension:512;identity:typeof EMBEDDING_ID;normalization:'l2';pooling:'cls';distanceMetric:'cosine';factSnapshotSeq:number};
