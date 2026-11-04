import {MATERIAL_FOLDER_BOOKS_SCHEMA as schema,validMaterialFolderBooksQuery,type MaterialFolderBooksQuery,type MaterialFolderBooksPage} from '../../shared/material-folder-books';
import type {MaterialBookRole} from '../../shared/material-book-pair';
type All=(sql:string,params?:(string|number|null)[])=>Promise<Record<string,unknown>[]>;
/** Read only archived PDF metadata. Existing book-pair writes retain all source/revision/billing guards. */
export async function listMaterialFolderBooks(all:All,role:(id:string)=>Promise<MaterialBookRole|null>,input:MaterialFolderBooksQuery):Promise<MaterialFolderBooksPage>{
 if(!validMaterialFolderBooksQuery(input))throw Error('invalid_input');
 const batch=(await all('SELECT status FROM material_import_batches WHERE id=?',[input.batchId]))[0];if(!batch)throw Error('invalid_input');
 const where="FROM material_import_entries e JOIN teacher_resources r ON r.id=e.resource_id WHERE e.batch_id=? AND e.kind='file' AND e.status='saved' AND lower(r.original_file_name) LIKE '%.pdf' AND instr(lower(e.relative_path),?)>0",params=[input.batchId,input.query.trim().toLowerCase()];
 const total=Number((await all('SELECT COUNT(DISTINCT r.id) n '+where,params))[0]?.n||0);
 // SQLite associates non-aggregate columns with the unique MIN(seq) row: duplicate paths stay one source.
 const rows=await all('SELECT r.id,r.content_hash,e.relative_path,MIN(e.seq) first_seq '+where+' GROUP BY r.id ORDER BY first_seq LIMIT 21 OFFSET ?',[...params,input.offset]);
 const books=await Promise.all(rows.slice(0,20).map(async r=>({resourceId:String(r.id),version:String(r.content_hash),relativePath:String(r.relative_path),role:await role(String(r.id))})));
 return{schemaVersion:schema,batchId:input.batchId,books,total,offset:input.offset,hasMore:rows.length>20,archiveComplete:['completed','partial'].includes(String(batch.status))};
}
