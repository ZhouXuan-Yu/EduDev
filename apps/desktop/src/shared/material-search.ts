import type {MaterialReference} from './materials';
export const MATERIAL_SEARCH_SCHEMA='xiaozhi.material-search.v1' as const;
export type MaterialTextQuery={schemaVersion:typeof MATERIAL_SEARCH_SCHEMA;query:string;offset:number;mode?:'hybrid'|'keyword'};
export type MaterialTextHit={title:string;excerpt:string;source:MaterialReference;citation:string;method?:string};
export type MaterialIndexStatus={available:boolean;pending:number;indexed:number;restored?:{pending:number;blocked:number;ready:number;backfilling:boolean}};
export type MaterialTextPage={schemaVersion:typeof MATERIAL_SEARCH_SCHEMA;hits:MaterialTextHit[];offset:number;hasMore:boolean;index:MaterialIndexStatus;semantic?:import('./retrieval').SemanticCoverage};
export function validMaterialTextQuery(v:unknown):v is MaterialTextQuery{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>!('value'in d)))return false;
 const q=v as Record<string,unknown>;
 return Object.keys(q).every(k=>['schemaVersion','query','offset','mode'].includes(k))&&['schemaVersion','query','offset'].every(k=>Object.hasOwn(q,k))&&(q.mode===undefined||['hybrid','keyword'].includes(String(q.mode)))&&q.schemaVersion===MATERIAL_SEARCH_SCHEMA&&typeof q.query==='string'&&q.query.trim().length>0&&q.query.length<=128&&!/[\x00-\x1f]/.test(q.query)&&Number.isSafeInteger(q.offset)&&Number(q.offset)>=0&&Number(q.offset)<=1000000;
}
