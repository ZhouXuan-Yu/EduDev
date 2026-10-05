import {EDUCATION_QUOTE_SCHEMA,EDUCATION_SEARCH_SCHEMA,EDUCATION_SEARCH_MAX_BYTES,EDUCATION_SEARCH_MAX_UNITS,validQuoteMatch,validReadingSearchResult,type QuoteMatch,type ReadingSearchResult} from '../../shared/education-capabilities';
import {runEducationWorker} from './worker-host';

/** Fixed, read-only one-shot worker. No key, model, store or arbitrary path input. */
export async function matchMaterialQuote(text:string,quote:string,signal:AbortSignal):Promise<QuoteMatch>{
 if(text.length>12000||quote.length>2000||!quote.trim())throw new Error('invalid_input');
 return runEducationWorker('reading',{text,quote},EDUCATION_QUOTE_SCHEMA,signal,65536,2048,validQuoteMatch,value=>({found:value.found,mode:value.mode}));
}
export async function searchMaterialUnits(units:string[],query:string,signal:AbortSignal):Promise<ReadingSearchResult>{
 if(units.length>EDUCATION_SEARCH_MAX_UNITS||units.reduce((n,t)=>n+Buffer.byteLength(t,'utf8'),0)>EDUCATION_SEARCH_MAX_BYTES||!query.trim()||query.length>128)throw new Error('invalid_input');
 return runEducationWorker('reading',{units,query},EDUCATION_SEARCH_SCHEMA,signal,32*1024*1024,65536,(v):v is ReadingSearchResult=>validReadingSearchResult(v,units.length),v=>({hits:v.hits,mode:v.mode,truncated:v.truncated}));
}
