import {materialId} from '../../shared/materials';
import type {MockExamEntry,MockExamScope} from '../../shared/mock-exam-compilation';
import type {Sql} from '../xiaozhi-agent/session-state';
import {protocolHash} from '../xiaozhi-agent/capabilities/validation';
import {inferMockExam,standaloneAnswers} from './mock-exam-metadata';
import {mockExamPageEvidence} from './mock-exam-page-evidence';

const scanLimit=800, entryLimit=72;
const title=(row:Record<string,unknown>)=>String(row.original_file_name||row.title).slice(0,240);
const safeHash=(hash:unknown):hash is string=>typeof hash==='string'&&/^[a-f0-9]{64}$/u.test(hash);
const answerSection=`EXISTS(SELECT 1 FROM resource_chunks c WHERE c.resource_id=r.id AND c.contains_personal_data=0
  AND (ltrim(c.heading,'# ') IN ('参考答案','答案与解析','参考答案及评分标准')
    OR instr(ltrim(substr(c.content_md,1,28),'# '),'参考答案'||char(10))=1))`;
const heading=`COALESCE((SELECT substr(c.content_md,1,480) FROM resource_chunks c WHERE c.resource_id=r.id AND c.contains_personal_data=0
  AND (c.page_number IS NULL OR c.page_number<=1) ORDER BY c.chunk_index,c.id LIMIT 1),'') AS headline`;
const facts=`r.id,r.original_file_name,r.title,r.content_hash,r.parse_status,
  j.status AS structure_status,j.pages,j.processed,j.held,
  p.total AS pdf_total,p.state AS pdf_state,p.generation AS pdf_generation,
  q.answer_id,q.answer_version,q.question_version,q.revision AS pair_revision,a.content_hash AS current_answer_version,
  a.original_file_name AS answer_title,${answerSection} AS embedded,${heading}`;
const joins=`LEFT JOIN material_structure_jobs j ON j.resource_id=r.id AND j.version=r.content_hash
  LEFT JOIN material_pdf_jobs p ON p.resource_id=r.id AND p.version=r.content_hash
  LEFT JOIN material_book_pairs q ON q.question_id=r.id AND q.active=1
  LEFT JOIN teacher_resources a ON a.id=q.answer_id`;

function structure(row:Record<string,unknown>):MockExamEntry['structure'] {
  const pages=Number(row.pages||0),processed=Number(row.processed||0),held=Number(row.held||0);
  if(pages>0)return {state:row.structure_status==='complete'&&processed===pages?'parsed':'partial',pages,processed,held};
  if(row.parse_status==='partial')return {state:'partial'};
  return {state:['ready','parsed','chunked','indexed','graph_extracted'].includes(String(row.parse_status))?'parsed':'unavailable'};
}
function answer(row:Record<string,unknown>):MockExamEntry['answer'] {
  if(row.answer_id){
    if(row.question_version!==row.content_hash||row.answer_version!==row.current_answer_version)return {state:'stale'};
    return {state:'linked',resourceId:String(row.answer_id),version:String(row.answer_version),title:String(row.answer_title).slice(0,240),
      pairRevision:Number(row.pair_revision)};
  }
  return {state:Number(row.embedded)===1?'embedded':'missing'};
}
const sortKey=(entry:MockExamEntry)=>[entry.metadata.district,entry.metadata.subject,entry.metadata.round,entry.title].join('|');

export async function mockExamSources(work:Sql,scope:MockExamScope) {
  const rows=await work.all(`SELECT ${facts},
    EXISTS(SELECT 1 FROM material_book_pairs a2 WHERE a2.answer_id=r.id AND a2.active=1) AS is_answer
    FROM teacher_resources r ${joins}
    WHERE r.content_hash IS NOT NULL AND (instr(r.original_file_name || r.title,'模')>0
      OR EXISTS(SELECT 1 FROM resource_chunks c2 WHERE c2.resource_id=r.id AND c2.contains_personal_data=0
        AND c2.chunk_index<=1 AND instr(substr(c2.content_md,1,480),'模')>0))
    ORDER BY CASE WHEN instr(r.original_file_name || r.title,?)>0 THEN 0 ELSE 1 END,r.id LIMIT ?`,
    [String(scope.year),scanLimit+1]);
  let unlinkedAnswers=0;
  const byHash=new Map<string,MockExamEntry>();
  const sourceRows=new Map<string,Record<string,unknown>>();
  for(const row of rows.slice(0,scanLimit)){
    if(!materialId(row.id)||!safeHash(row.content_hash))continue;
    const name=title(row),metadata=inferMockExam(name,String(row.headline),scope);
    if(!metadata||Number(row.is_answer)===1)continue;
    if(standaloneAnswers(name)){unlinkedAnswers++;continue;}
    sourceRows.set(row.id,row);
    const item:MockExamEntry={...metadata,resourceId:row.id,version:row.content_hash,title:name,
      evidenceHash:protocolHash([name,String(row.headline)]),include:true,copies:1,permission:'unknown',structure:structure(row),answer:answer(row)};
    const previous=byHash.get(item.version);
    if(previous){
      const quality=(entry:MockExamEntry)=>Object.values(entry.metadata).filter(Boolean).length-entry.conflicts.length+
        (entry.answer.state==='linked'?10:0);
      const chosen=quality(item)>quality(previous)?item:previous;
      byHash.set(item.version,{...chosen,copies:previous.copies+1});
    }else byHash.set(item.version,item);
  }
  const entries=[...byHash.values()].sort((a,b)=>sortKey(a).localeCompare(sortKey(b),'zh-CN'));
  const selected=await Promise.all(entries.slice(0,entryLimit).map(async entry=>{
    const source=sourceRows.get(entry.resourceId);
    const pageEvidence=source&&await mockExamPageEvidence(work,source);
    return pageEvidence?{...entry,structure:{...entry.structure,pageEvidence}}:entry;
  }));
  return {entries:selected,unlinkedAnswers,limited:rows.length>scanLimit||entries.length>entryLimit};
}

export async function assertMockExamSource(work:Sql,entry:MockExamEntry) {
  const [row]=await work.all(`SELECT ${facts} FROM teacher_resources r ${joins} WHERE r.id=?`,[entry.resourceId]);
  const {pageEvidence,...storedStructure}=entry.structure;
  if(!row||row.content_hash!==entry.version||protocolHash([title(row),String(row.headline)])!==entry.evidenceHash||
    protocolHash([structure(row),answer(row)])!==protocolHash([storedStructure,entry.answer])||
    pageEvidence&&protocolHash(await mockExamPageEvidence(work,row)??null)!==protocolHash(pageEvidence))throw Error('source_changed');
}
