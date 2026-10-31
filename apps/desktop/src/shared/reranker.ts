export const RERANK_SCHEMA='xiaozhi.rerank.v1' as const;
export const RERANK_LIMIT=20;
/** Native messages stay small; one retrieval compares a wider bounded pool atomically. */
export const RERANK_CANDIDATE_LIMIT=100;
export const RERANK_BUDGET_MS=5000;
export const RERANK_ID='bge-reranker-base.q8.pair512.window2.v1';
export const RERANK_MODEL='dd98f3e67837d23210a6b7550c08cced4f61845b940ac45be3565840a10f3244';
export const RERANK_TOKENIZER='48564c5c7d3fa64d85d95e65414a542385f88b0f128fd8d4163fd7a57f2be05c';
export type RerankInput={id:string;text:string;complete:boolean};
export type RerankResult={scores:{id:string;score:number;complete:boolean}[];elapsedMs:number};
export type RerankCoverage={available:boolean;complete:boolean;model:string;candidates:number;processed:number;elapsedMs:number;reason:string};
