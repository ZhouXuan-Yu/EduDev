export const EDUCATION_QUOTE_SCHEMA='xiaozhi.education.quote.v1';
export const DEEPTUTOR_READING_REVISION='f07029cfcf2c8dfccdb671cdfc343db8334f5741';
export const EDUCATION_SEARCH_SCHEMA='xiaozhi.education.search.v1';
export const EDUCATION_SEARCH_MAX_BYTES=8*1024*1024;
export const EDUCATION_SEARCH_MAX_UNITS=20000;
export type MaterialSearchInput={query:string;resourceId?:string};
export type ReadingSearchResult={hits:{locator:number;snippet:string;offset:number;match:string}[];mode:'exact'|'normalised'|'terms'|null;truncated:boolean};
export function validMaterialSearchInput(value:unknown):value is MaterialSearchInput {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).every(k=>['query','resourceId'].includes(k))&&typeof v.query==='string'&&v.query.trim().length>0&&v.query.length<=128&&!/[\x00-\x1f]/.test(v.query)
  &&(v.resourceId===undefined||typeof v.resourceId==='string'&&/^resource_[a-f0-9-]{36}$/i.test(v.resourceId));
}
export function validReadingSearchResult(v:unknown,units:number):v is ReadingSearchResult {
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const x=v as ReadingSearchResult;
 return Array.isArray(x.hits)&&x.hits.length<=12&&typeof x.truncated==='boolean'
  &&(x.hits.length?['exact','normalised','terms'].includes(x.mode||''):x.mode===null)
  &&new Set(x.hits.map(h=>h.locator)).size===x.hits.length
  &&x.hits.every(h=>Number.isSafeInteger(h.locator)&&h.locator>=0&&h.locator<units&&Number.isSafeInteger(h.offset)&&h.offset>=0&&h.offset<=EDUCATION_SEARCH_MAX_BYTES
   &&typeof h.snippet==='string'&&h.snippet.length<=1000&&typeof h.match==='string'&&h.match.length<=512);
}
export type QuoteInput={resourceId:string;offset:number;version:string;quote:string};
export type QuoteMatch={found:boolean;mode:'exact'|'normalised'|null};
export function validQuoteInput(value:unknown):value is QuoteInput {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).length===4&&Object.keys(v).every(k=>['resourceId','offset','version','quote'].includes(k))
  &&typeof v.resourceId==='string'&&/^resource_[a-f0-9-]{36}$/i.test(v.resourceId)
  &&Number.isSafeInteger(v.offset)&&Number(v.offset)>=0&&Number(v.offset)<=10000000
  &&typeof v.version==='string'&&/^[a-f0-9]{64}$/i.test(v.version)
  &&typeof v.quote==='string'&&v.quote.trim().length>0&&v.quote.length<=2000&&!v.quote.includes('\0');
}
export function validQuoteMatch(value:unknown):value is QuoteMatch {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return typeof v.found==='boolean'&&(v.found?(v.mode==='exact'||v.mode==='normalised'):v.mode===null);
}
