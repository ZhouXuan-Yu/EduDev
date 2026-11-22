import type {TeachingBookPatch} from '../../shared/contracts';
import type {Sql} from '../xiaozhi-agent/session-state';

export async function insertTeachingBookPatch(sql:Pick<Sql,'run'>,patch:TeachingBookPatch) {
  await sql.run(`INSERT INTO teaching_book_patches (id,book_id,page_id,block_id,base_version,result_version,operation,
    before_title,after_title,before_payload_json,after_payload_json,reason,status,error,created_at,applied_at,undone_at,
    selection_start,selection_end,selected_text_hash,selected_text) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
    patch.id,patch.bookId,patch.pageId,patch.blockId,patch.baseVersion,patch.resultVersion,patch.operation,
    patch.beforeTitle,patch.afterTitle,JSON.stringify(patch.beforePayload),JSON.stringify(patch.afterPayload),
    patch.reason,patch.status,patch.error,patch.createdAt,patch.appliedAt,patch.undoneAt,
    patch.selectionStart,patch.selectionEnd,patch.selectedTextHash,patch.selectedText,
  ]);
}
