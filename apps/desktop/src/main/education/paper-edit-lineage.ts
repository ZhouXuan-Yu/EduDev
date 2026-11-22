import type {PaperSql} from './paper-sql';

/** Both receipts and the immutable confirmation must identify the same edit. */
export async function paperEditSuccessors(sql:PaperSql,sessionId?:string) {
  const links=new Map<string,string>();
  if(!(await sql.all("SELECT name FROM sqlite_master WHERE type='table' AND name='paper_basket_operations'")).length)return links;
  const rows=await sql.all(`SELECT i.paper_id AS source_id,c.paper_id AS edit_id,c.basket_id
    FROM paper_basket_operations i
    JOIN paper_basket_operations c ON c.session_id=i.session_id AND c.basket_id=i.basket_id
      AND c.student_id=i.student_id AND c.operation_kind='domain:confirm-paper' AND c.rowid>i.rowid
    JOIN ai_confirmation_items s ON s.id=i.paper_id AND s.session_id=i.session_id AND s.student_id=i.student_id
      AND s.action_type='pi_paper_candidate'
    JOIN ai_confirmation_items p ON p.id=c.paper_id AND p.session_id=c.session_id AND p.student_id=c.student_id
      AND p.action_type='pi_paper_candidate' AND p.status='confirmed'
    WHERE i.operation_kind='domain:import-paper' AND i.paper_id<>c.paper_id
      AND CASE WHEN json_valid(p.payload_json) THEN json_extract(p.payload_json,'$.input.basket.basketId') END=c.basket_id
      AND CASE WHEN json_valid(p.payload_json) THEN json_extract(p.payload_json,'$.input.basket.basketRevision') END=c.result_revision
      AND CASE WHEN json_valid(p.payload_json) THEN json_extract(p.payload_json,'$.input.requestId') END=c.request_id
      ${sessionId?'AND i.session_id=?':''}
    ORDER BY c.rowid`,sessionId?[sessionId]:[]);
  const basketHeads=new Map<string,string>();
  for(const row of rows){
    if(typeof row.source_id!=='string'||typeof row.edit_id!=='string'||typeof row.basket_id!=='string')continue;
    const previous=basketHeads.get(row.basket_id)??row.source_id;
    links.set(previous,row.edit_id);
    basketHeads.set(row.basket_id,row.edit_id);
  }
  return links;
}
