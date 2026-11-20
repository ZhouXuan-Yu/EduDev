import {MATERIAL_BOOK_PAIR_SCHEMA,validMaterialBookPairInput,type MaterialBookPairInput,type MaterialBookPairView,type MaterialBookRole} from '../../shared/material-book-pair';
import {materialId} from '../../shared/materials';
import type {TeacherResource} from '../../shared/contracts';
import {listMaterialFolderBooks} from './material-folder-books';
import type {MaterialFolderBooksQuery} from '../../shared/material-folder-books';
type Row=Record<string,unknown>;type Value=string|number|null;
type Host={all:(q:string,p?:Value[])=>Promise<Row[]>;run:(q:string,p?:Value[])=>Promise<void>;resource:(id:string)=>Promise<TeacherResource>;writer:<T>(action:(target:MaterialBookPairs)=>Promise<T>)=>Promise<T>};
export async function migrateMaterialBookPairs(host:Pick<Host,'run'>){
 await host.run(`CREATE TABLE IF NOT EXISTS material_book_pairs(question_id TEXT PRIMARY KEY,question_version TEXT NOT NULL,answer_id TEXT NOT NULL,answer_version TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),active INTEGER NOT NULL CHECK(active IN (0,1)))`);
 await host.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_material_book_answer ON material_book_pairs(answer_id) WHERE active=1');
}
// Derived visibility only, with q as the canonical question alias. No question or teacher overlay is changed.
// Unknown/stale archives stay visible. Do not rely on origin coverage: cross-chunk rule candidates have no origin row.
const ruleArchive="CASE WHEN json_valid(aq.archive_json) THEN aq.archive_json ELSE '{}' END";
// An uncorrelated indexed ID set parses only linked answer candidates, rather than the entire bank per list/count.
export const answerRuleCandidateHidden=`q.id IN (SELECT aq.id FROM material_book_pairs p
 CROSS JOIN teacher_resources a ON a.id=p.answer_id AND a.content_hash=p.answer_version
 CROSS JOIN teacher_resources r ON r.id=p.question_id AND r.content_hash=p.question_version
 CROSS JOIN material_question_members m ON m.resource_id=p.answer_id
 CROSS JOIN question_bank_items aq ON aq.id=m.question_id
 WHERE p.active=1 AND
 json_extract(${ruleArchive},'$.schemaVersion')='xiaozhi.question-archive.v1'
 AND json_extract(${ruleArchive},'$.extractor')='numbered-text.v1'
 AND json_extract(${ruleArchive},'$.state')='rule_extracted'
 AND json_type(${ruleArchive},'$.sourceChecked')='false'
 AND aq.created_at=aq.updated_at
 AND json_type(${ruleArchive},'$.sources')='array'
 AND json_array_length(${ruleArchive},'$.sources') BETWEEN 1 AND 64
 AND NOT EXISTS(SELECT 1 FROM question_notebook_bookmarks b WHERE b.question_id=aq.id AND b.bookmarked=1)
 AND NOT EXISTS(SELECT 1 FROM question_notebook_category_links l WHERE l.question_id=aq.id)
 AND NOT EXISTS(SELECT 1 FROM question_bank_usage u WHERE u.question_id=aq.id)
 AND NOT EXISTS(SELECT 1 FROM json_each(${ruleArchive},'$.sources') s
    WHERE COALESCE(json_extract(CASE WHEN s.type='object' THEN s.value ELSE '{}' END,'$.resourceId'),'')<>p.answer_id
     OR COALESCE(json_extract(CASE WHEN s.type='object' THEN s.value ELSE '{}' END,'$.version'),'')<>p.answer_version)
)`;
const frozenInput="CASE WHEN json_valid(u.input_json) THEN u.input_json ELSE '{}' END";
const sameSavedAnswerRole=`u.status IN ('complete','review','no_questions')
 AND json_extract(${frozenInput},'$.bookRole.kind') IS 'answers'
 AND json_extract(${frozenInput},'$.bookRole.questionId') IS ?
 AND json_extract(${frozenInput},'$.bookRole.questionVersion') IS ?
 AND json_extract(${frozenInput},'$.bookRole.answerId') IS ?
 AND json_extract(${frozenInput},'$.bookRole.answerVersion') IS ?`;

// The scheduler sets dispatch evidence before transport. A settled preflight refusal
// can coexist with a new role, but its old batch and folder reservation stay frozen.
const terminalPrivacyRefusal=`b.status='attention' AND b.calls=0
 AND NOT EXISTS(SELECT 1 FROM material_ai_units u WHERE u.batch_id=b.id AND (
  u.status IS NOT 'failed' OR u.error IS NOT 'privacy_blocked' OR u.dispatched_at IS NOT 0
  OR u.owner_pid IS NOT 0 OR u.lease IS NOT '' OR u.first_json IS NOT '' OR u.final_json IS NOT ''
  OR u.image_sha IS NOT '' OR NOT json_valid(u.input_json)
  OR json_type(${frozenInput}) IS NOT 'object' OR json_type(${frozenInput},'$.bookRole') IS NOT NULL))
 AND NOT EXISTS(SELECT 1 FROM material_ai_response_receipts e WHERE e.batch_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM material_ai_members m WHERE m.batch_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM material_ai_page_units p WHERE p.batch_id=b.id
  AND (p.first_sha IS NOT '' OR p.final_sha IS NOT '' OR p.image_sha IS NOT ''))
 AND NOT EXISTS(SELECT 1 FROM material_ai_image_inputs i WHERE i.batch_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM material_ai_page_crops c WHERE c.batch_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM material_ai_page_verifications v WHERE v.batch_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM material_ai_bound_answers a WHERE a.batch_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM material_ai_book_references r WHERE r.batch_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM material_ai_native_inputs n WHERE n.batch_id=b.id)
 AND NOT EXISTS(SELECT 1 FROM material_ai_task_keys k LEFT JOIN material_folder_ai f ON f.batch_id=k.folder_id
  WHERE k.batch_id=b.id AND k.folder_id<>'' AND
   (f.status IS NULL OR f.status NOT IN ('paused','attention','complete','configuration_changed')))`;

/** Book identity/roles only. A link is neither an answer match nor permission to send data. */
export class MaterialBookPairs{
 constructor(private host:Host){}
 async migrate(){await migrateMaterialBookPairs(this.host);}
 async folderCandidates(input:MaterialFolderBooksQuery){return listMaterialFolderBooks(this.host.all,id=>this.role(id),input);}
 async role(resourceId:string):Promise<MaterialBookRole|null>{
  const row=(await this.host.all('SELECT * FROM material_book_pairs WHERE active=1 AND (question_id=? OR answer_id=?)',[resourceId,resourceId]))[0];
  return row?{kind:row.answer_id===resourceId?'answers':'questions',questionId:String(row.question_id),questionVersion:String(row.question_version),answerId:String(row.answer_id),answerVersion:String(row.answer_version),revision:Number(row.revision)}:null;
 }
 async view(resourceId:string):Promise<MaterialBookPairView>{
  if(!materialId(resourceId))throw Error('invalid_input');await this.host.resource(resourceId);const role=await this.role(resourceId);
  if(!role){const row=(await this.host.all('SELECT revision FROM material_book_pairs WHERE question_id=?',[resourceId]))[0];return{schemaVersion:MATERIAL_BOOK_PAIR_SCHEMA,resourceId,revision:Number(row?.revision||0),role:null,current:true};}
  const [q,a]=await Promise.all([this.host.resource(role.questionId),this.host.resource(role.answerId)]);
  return{schemaVersion:MATERIAL_BOOK_PAIR_SCHEMA,resourceId,revision:role.revision,role,questionTitle:q.originalFileName,answerTitle:a.originalFileName,current:q.contentHash===role.questionVersion&&a.contentHash===role.answerVersion};
 }
 async change(input:MaterialBookPairInput):Promise<MaterialBookPairView>{
  if(!validMaterialBookPairInput(input))throw Error('invalid_input');
  return this.host.writer(async target=>{
   const primary=await target.host.resource(input.resourceId);if(primary.contentHash!==input.version)throw Error('source_changed');
   const existing=await target.role(input.resourceId),prior=(await target.host.all('SELECT * FROM material_book_pairs WHERE question_id=?',[input.resourceId]))[0];
   // A tombstone keeps the revision monotonic. Replaying an old unlink must not remove a newer pair.
   if(input.action==='unlink'){
    if(!existing){if(!prior&&input.revision===0||prior&&prior.active===0&&[input.revision,input.revision+1].includes(Number(prior.revision)))return target.view(input.resourceId);throw Error('conflict');}
    if(existing.questionId!==input.resourceId||existing.revision!==input.revision)throw Error('conflict');
    await target.host.run('UPDATE material_book_pairs SET active=0,revision=revision+1 WHERE question_id=?',[input.resourceId]);return target.view(input.resourceId);
   }
   const answer=await target.host.resource(input.answerId!);if(answer.contentHash!==input.answerVersion)throw Error('source_changed');
   if(!/\.pdf$/i.test(primary.originalFileName)||!/\.pdf$/i.test(answer.originalFileName))throw Error('unsupported');
   if(existing&&existing.questionId===input.resourceId&&existing.questionVersion===input.version&&existing.answerId===input.answerId&&existing.answerVersion===input.answerVersion&&[input.revision,input.revision+1].includes(existing.revision))return target.view(input.resourceId);
   if(existing?.kind==='answers'||Number(prior?.revision||0)!==input.revision||await target.role(input.answerId!))throw Error('conflict');
   // Local rule extraction is reversible derived data; existing teacher work remains canonical.
   const ai=await target.host.all(`SELECT 1 FROM material_ai_batches b WHERE b.resource_id=? AND (
    NOT EXISTS(SELECT 1 FROM material_ai_units u WHERE u.batch_id=b.id)
    OR (EXISTS(SELECT 1 FROM material_ai_units u WHERE u.batch_id=b.id AND NOT (${sameSavedAnswerRole}))
        AND NOT (${terminalPrivacyRefusal})))
    LIMIT 1`,[input.answerId!,input.resourceId,input.version,input.answerId!,input.answerVersion!]);
   if(ai.length)throw Error('answer_already_processed');
   await target.host.run(`INSERT INTO material_book_pairs VALUES(?,?,?,?,?,1) ON CONFLICT(question_id) DO UPDATE SET question_version=excluded.question_version,answer_id=excluded.answer_id,answer_version=excluded.answer_version,revision=excluded.revision,active=1`,[input.resourceId,input.version,input.answerId!,input.answerVersion!,input.revision+1]);
   return target.view(input.resourceId);
  });
 }
}
