import {createHash,randomUUID} from 'node:crypto';
import type {TeachingBookDetail} from '../../shared/contracts';
import type {Sql} from '../xiaozhi-agent/session-state';

export type TeachingBookContent = Omit<TeachingBookDetail,'health'>;

/** The live editor uses fresh row IDs after recovery. A stale open block editor
 * or pending patch can never write to the newly restored node. */
export async function restoreTeachingBook(sql:Sql,content:TeachingBookContent,time:string) {
  const {book,chapters,pages,blocks,sources,materialSources}=content;
  await sql.run('DELETE FROM teaching_book_chapters WHERE book_id=?',[book.id]);
  await sql.run('DELETE FROM teaching_book_sources WHERE book_id=?',[book.id]);
  await sql.run('DELETE FROM teaching_book_invalidations WHERE book_id=?',[book.id]);
  await sql.run("UPDATE teaching_books SET title=?,description=?,language=?,target_level=?,status='draft',version=version+1,updated_at=? WHERE id=?",
    [book.title,book.description,book.language,book.targetLevel,time,book.id]);
  const chapterIds=new Map<string,string>(), pageIds=new Map<string,string>();
  for(const chapter of chapters){
    const id='teaching_chapter_'+randomUUID();
    chapterIds.set(chapter.id,id);
    await sql.run(`INSERT INTO teaching_book_chapters (id,book_id,title,learning_objectives_json,content_type,prerequisites_json,summary,sort_order,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,[id,book.id,chapter.title,JSON.stringify(chapter.learningObjectives),
      chapter.contentType,JSON.stringify(chapter.prerequisites),chapter.summary,chapter.order,time,time]);
  }
  for(const page of pages){
    const id='teaching_page_'+randomUUID(),chapterId=chapterIds.get(page.chapterId);
    if(!chapterId)throw Error('version_unavailable');
    pageIds.set(page.id,id);
    await sql.run(`INSERT INTO teaching_book_pages (id,book_id,chapter_id,title,learning_objectives_json,content_type,status,sort_order,error,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,[id,book.id,chapterId,page.title,JSON.stringify(page.learningObjectives),
      page.contentType,page.status,page.order,page.error,time,time]);
  }
  for(const block of blocks){
    const pageId=pageIds.get(block.pageId);
    if(!pageId)throw Error('version_unavailable');
    await sql.run(`INSERT INTO teaching_book_blocks
      (id,page_id,type,status,title,params_json,payload_json,source_anchors_json,metadata_json,sort_order,error,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,['teaching_block_'+randomUUID(),pageId,block.type,block.status,
      block.title,JSON.stringify(block.params),JSON.stringify(block.payload),JSON.stringify(block.sourceAnchors),
      JSON.stringify(block.metadata),block.order,block.error,time,time]);
  }
  for(const source of sources){
    const id='teaching_source_'+createHash('sha1').update(`${book.id}:${source.kind}:${source.ref}`).digest('hex').slice(0,20);
    await sql.run(`INSERT INTO teaching_book_sources (id,book_id,kind,ref,title,snippet,fingerprint,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,[id,book.id,source.kind,source.ref,source.title,source.snippet,source.fingerprint,source.status,time,time]);
  }
  if(materialSources)await sql.run('UPDATE teaching_handout_origins SET material_sources_json=? WHERE book_id=?',
    [JSON.stringify(materialSources),book.id]);
}
