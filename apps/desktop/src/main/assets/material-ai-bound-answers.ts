import {createHash} from 'node:crypto';
import {BOUND_ANSWERS,boundAnswerSource,parseBoundAnswers,applyBoundAnswers,type BoundAnswers} from '../../shared/material-ai-bound-answers';
import type {AiPagePrompt,AiPageResponse} from '../../shared/material-ai-page';
type Host={all:(sql:string,p?:(string|number|null)[])=>Promise<Record<string,unknown>[]>;run?:(sql:string,p?:(string|number|null)[])=>Promise<void>};
export const boundSourceSha=(source:AiPageResponse)=>createHash('sha256').update(JSON.stringify(source)).digest('hex');
export const BOUND_ANSWERS_TABLE=`CREATE TABLE IF NOT EXISTS material_ai_bound_answers(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,policy TEXT NOT NULL,source_sha TEXT NOT NULL,response_json TEXT NOT NULL,final_sha TEXT NOT NULL,PRIMARY KEY(batch_id,ordinal),FOREIGN KEY(batch_id,ordinal) REFERENCES material_ai_units(batch_id,ordinal))`;
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export function resolveBoundAnswers(source:AiPageResponse,raw:string){const answers=parseBoundAnswers(raw,source,boundSourceSha(source));return{answers,raw:JSON.stringify(applyBoundAnswers(source,answers))};}
export async function boundAnswerTextIsPublic(answers:BoundAnswers,clean:(text:string)=>Promise<string>){const text=answers.questions.flatMap(q=>[q.answer,q.analysis]).join('\n');return await clean(text)===text;}
/** Required only for newly frozen, source-concordant third passes. Historical receipts are untouched. */
export async function readBoundAnswers(host:Host,batchId:string,ordinal:number,first:AiPageResponse,review:AiPageResponse|undefined,prompt:AiPagePrompt|undefined,finalRaw:string){
 const source=boundAnswerSource(first,review,prompt);if(!source)return;
 const row=(await host.all('SELECT * FROM material_ai_bound_answers WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0];
 try{if(!row||row.policy!==BOUND_ANSWERS||row.source_sha!==boundSourceSha(source)||row.final_sha!==sha(finalRaw)||typeof row.response_json!=='string'||resolveBoundAnswers(source,row.response_json).raw!==finalRaw)throw Error();}catch{throw Error('source_changed');}
}
export async function writeBoundAnswers(host:Host,batchId:string,ordinal:number,source:AiPageResponse,response:string,finalRaw:string){
 if(!host.run||resolveBoundAnswers(source,response).raw!==finalRaw)throw Error('invalid_response');
 await host.run('INSERT INTO material_ai_bound_answers(batch_id,ordinal,policy,source_sha,response_json,final_sha) VALUES(?,?,?,?,?,?)',[batchId,ordinal,BOUND_ANSWERS,boundSourceSha(source),response,sha(finalRaw)]);
}
