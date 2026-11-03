import {createHash} from 'node:crypto';
import type {PaperSql} from './paper-sql';
import {canonicalBasketJson} from './paper-basket-state';
import type {PaperAdaptationView,PaperAdaptationReceipt} from '../../shared/paper-basket-adaptation';
export type AdaptationRecord=Omit<PaperAdaptationView,'candidates'|'current'|'generationStarted'>&{entryHash:string;points:number;runId?:string};
export const adaptationHash=(v:unknown)=>createHash('sha256').update(canonicalBasketJson(v)).digest('hex');
/** Existing operation ledger only; no separate adaptation engine/table or legacy row rewrite. */
export async function migratePaperBasketAdaptations(sql:Pick<PaperSql,'all'|'run'>){
 if(!(await sql.all('PRAGMA table_info(paper_basket_operations)')).some(c=>c.name==='adaptation_json'))await sql.run('ALTER TABLE paper_basket_operations ADD COLUMN adaptation_json TEXT');
}
export async function adaptationOperation(sql:PaperSql,sessionId:string,requestId:string){return (await sql.all('SELECT * FROM paper_basket_operations WHERE session_id=? AND request_id=?',[sessionId,requestId]))[0];}
export async function writeAdaptationOperation(sql:PaperSql,sessionId:string,studentId:string,basketId:string,requestId:string,kind:string,input:unknown,result:AdaptationRecord|PaperAdaptationReceipt|{cancelled:true},revision:number){
 const count=Number((await sql.all("SELECT count(*) AS n FROM paper_basket_operations WHERE session_id=? AND operation_kind GLOB 'domain:adaptation-*'",[sessionId]))[0]?.n||0);if(count>=10000)throw Error('unavailable');
 await sql.run('INSERT INTO paper_basket_operations(session_id,request_id,student_id,operation_kind,input_hash,basket_id,result_revision,created_at,adaptation_json) VALUES(?,?,?,?,?,?,?,?,?)',[sessionId,requestId,studentId,kind,adaptationHash(input),basketId,revision,new Date().toISOString(),JSON.stringify(result)]);
}
export function checkAdaptationOperation(row:Record<string,unknown>,studentId:string,basketId:string,kind:string,input:unknown){if(row.student_id!==studentId||row.basket_id!==basketId||row.operation_kind!==kind||row.input_hash!==adaptationHash(input))throw Error('conflict');}
