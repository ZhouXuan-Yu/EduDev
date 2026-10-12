import type {QuestionSearchFilters} from '../../shared/contracts';

type Value=string|number|null;
type Sql={all:(query:string,values?:Value[])=>Promise<Record<string,unknown>[]>;run:(query:string,values?:Value[])=>Promise<unknown>};
export const QUESTION_RETRIEVAL_INDEX='question_retrieval_fts_v1';
export const QUESTION_RETRIEVAL_VERSION='sqlite-trigram-projection.v1';
const fields=['stem','analysis','tags','knowledge_point','source_title','context_text'];
const projectionFields=['statement','formulas','tables','figures','choices','subquestions'];
// Only the six reviewed text sections; never treat unparsed file bytes as retrieved text.
const contextText=(prefix:string)=>`CASE WHEN json_valid(${prefix}document_json) THEN CASE WHEN json_extract(${prefix}document_json,'$.schemaVersion')='xiaozhi.question-document.v2' THEN ${projectionFields.map(f=>`COALESCE(json_extract(${prefix}document_json,'$.context.projection.${f}.text'),'')`).join(" || char(10) || ")} ELSE '' END ELSE '' END`;
const values=(prefix:string)=>['stem','analysis','tags','knowledge_point','source_title'].map(f=>`${prefix}${f}`).concat(contextText(prefix)).join(',');

/** Derived index only. Startup owns sequencing; SAVEPOINT rolls back incomplete creation/rebuild. */
export async function ensureQuestionRetrievalIndex(sql:Sql):Promise<boolean>{
 await sql.run('SAVEPOINT question_retrieval_init');
 try{
  const existing=await sql.all("SELECT name FROM sqlite_master WHERE name IN ('question_retrieval_fts_v1','question_retrieval_ai_v1','question_retrieval_au_v1','question_retrieval_ad_v1')");
  await sql.run(`CREATE VIRTUAL TABLE IF NOT EXISTS ${QUESTION_RETRIEVAL_INDEX} USING fts5(${fields.join(',')},tokenize='trigram',detail='none')`);
  await sql.run(`CREATE TRIGGER IF NOT EXISTS question_retrieval_ai_v1 AFTER INSERT ON question_bank_items BEGIN INSERT INTO ${QUESTION_RETRIEVAL_INDEX}(rowid,${fields.join(',')}) VALUES(new.rowid,${values('new.')}); END`);
  await sql.run(`CREATE TRIGGER IF NOT EXISTS question_retrieval_au_v1 AFTER UPDATE ON question_bank_items BEGIN DELETE FROM ${QUESTION_RETRIEVAL_INDEX} WHERE rowid=old.rowid; INSERT INTO ${QUESTION_RETRIEVAL_INDEX}(rowid,${fields.join(',')}) VALUES(new.rowid,${values('new.')}); END`);
  await sql.run(`CREATE TRIGGER IF NOT EXISTS question_retrieval_ad_v1 AFTER DELETE ON question_bank_items BEGIN DELETE FROM ${QUESTION_RETRIEVAL_INDEX} WHERE rowid=old.rowid; END`);
  if(existing.length!==4){
   await sql.run(`DELETE FROM ${QUESTION_RETRIEVAL_INDEX}`);
   await sql.run(`INSERT INTO ${QUESTION_RETRIEVAL_INDEX}(rowid,${fields.join(',')}) SELECT rowid,${values('')} FROM question_bank_items`);
  }
  await sql.run('RELEASE question_retrieval_init');return true;
 }catch(error){
  await sql.run('ROLLBACK TO question_retrieval_init');await sql.run('RELEASE question_retrieval_init');
  if(/no such module: fts5|no such tokenizer: trigram/i.test(String(error)))return false;
  throw Object.assign(new Error('question_retrieval_init_failed'),{cause:error});
 }
}

export function questionSearchTokens(query:string):string[]{return [...new Set(query.split(/[\s，,、]+/u).filter(Boolean))].slice(0,8);}
export function validatedQuestionFilters(raw:QuestionSearchFilters):QuestionSearchFilters{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('题目筛选参数不正确');
 const allowed=['query','subject','grade','knowledgePoint','questionType','difficulty','sourceKind','limit','offset','categoryId','bookmarked'];
 if(Reflect.ownKeys(raw).some(key=>typeof key!=='string'||!allowed.includes(key)||!('value' in Object.getOwnPropertyDescriptor(raw,key)!)))throw new Error('题目筛选参数不正确');
 const result:QuestionSearchFilters={};
 for(const key of ['query','subject','grade','knowledgePoint','questionType'] as const){const value=raw[key];if(value===undefined)continue;if(typeof value!=='string'||value.length>240||/[\x00-\x1f]/.test(value))throw new Error('题目筛选参数不正确');if(value.trim())result[key]=value.trim();}
 if(raw.difficulty!==undefined){if(!['easy','medium','hard'].includes(raw.difficulty))throw new Error('题目难度筛选不正确');result.difficulty=raw.difficulty;}
 if(raw.sourceKind!==undefined){if(!['local_bank','teacher_resource','generated'].includes(raw.sourceKind))throw new Error('题目来源筛选不正确');result.sourceKind=raw.sourceKind;}
 if(raw.limit!==undefined&&(!Number.isInteger(raw.limit)||raw.limit<1||raw.limit>50))throw new Error('题目分页参数不正确');
 return result;
}

/** One predicate for notebook and Pi. Every metadata filter is ANDed before LIMIT. No semantic claims. */
export function questionRetrievalWhere(raw:QuestionSearchFilters,indexed:boolean){
 const filters=validatedQuestionFilters(raw),clauses:string[]=[],params:Value[]=[];
 for(const [key,column]of [['subject','subject'],['grade','grade'],['questionType','question_type'],['difficulty','difficulty'],['sourceKind','source_kind']]as const){if(filters[key]){clauses.push(`q.${column} = ?`);params.push(filters[key]!);}}
 if(filters.knowledgePoint){clauses.push("q.knowledge_point LIKE ? ESCAPE '\\'");params.push('%'+filters.knowledgePoint.replace(/[\\%_]/g,'\\$&')+'%');}
 const tokens=questionSearchTokens(filters.query??'');
 if(tokens.length){
  const indexedTokens=indexed?tokens.filter(t=>[...t].length>=3&&!/[\\%_]/.test(t)):[];
  const literalTokens=tokens.filter(t=>!indexedTokens.includes(t));
  const parts:string[]=[];
  if(indexedTokens.length){
   parts.push(`q.rowid IN (SELECT rowid FROM ${QUESTION_RETRIEVAL_INDEX} WHERE ${indexedTokens.map(()=>`(${fields.map(f=>`${f} LIKE ?`).join(' OR ')})`).join(' OR ')})`);
   for(const token of indexedTokens)params.push(...fields.map(()=>'%'+token+'%'));
  }
  for(const token of literalTokens){parts.push(`(${fields.map(f=>`${f==='context_text'?contextText('q.'):'q.'+f} LIKE ? ESCAPE '\\'`).join(' OR ')})`);params.push(...fields.map(()=>'%'+token.replace(/[\\%_]/g,'\\$&')+'%'));}
  clauses.push('('+parts.join(' OR ')+')');
 }
 return{clauses,params,filters,method:indexed&&tokens.some(t=>[...t].length>=3&&!/[\\%_]/.test(t))?'local_keyword_index' as const:'local_keyword_scan' as const};
}

export async function searchQuestionRows(sql:Sql,raw:QuestionSearchFilters,indexed:boolean){
 const {clauses,params,filters,method}=questionRetrievalWhere(raw,indexed);
 const rows=await sql.all(`SELECT q.* FROM question_bank_items q ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY CASE WHEN q.knowledge_point=? THEN 0 ELSE 1 END,q.updated_at DESC,q.id ASC LIMIT ?`,[...params,filters.knowledgePoint??'',raw.limit??8]);
 return{rows,method};
}
