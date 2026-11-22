import {randomUUID} from 'node:crypto';
import type {TeachingBookPatch} from '../../shared/contracts';
import {CLASSROOM_CONTEXT_SCHEMA} from '../../shared/classroom-context';
import type {TeachingBookConfirm,TeachingBookRestore,TeachingBookVersion,TeachingBookVersionHistory,TeachingBookVersionKind,TeachingBookVersionPreview,TeachingBookVersionRead} from '../../shared/teaching-book-version';
import {renderTeachingBookMarkdown} from '../ai-harness/teaching-book-renderer';
import type {Sql} from '../xiaozhi-agent/session-state';
import {protocolHash} from '../xiaozhi-agent/capabilities/validation';
import {assertClassroomContext} from './classroom-context';
import {restoreTeachingBook,type TeachingBookContent} from './teaching-book-restore';

type VersionImage = {schema:1; content:TeachingBookContent; patches:TeachingBookPatch[]};
type Row = Record<string,unknown>;
const maximumImageBytes=2*1024*1024;
const summaries='id,book_id,revision,digest,title,kind,created_at,restored_from';

export function teachingBookDigest(content:TeachingBookContent) {
  const {status:_status,updatedAt:_updated,...book}=content.book;
  return protocolHash({book,chapters:content.chapters,pages:content.pages,blocks:content.blocks,
    sources:content.sources.map(({status:_status,...source})=>source),materialSources:content.materialSources??null});
}

function summary(row:Row):TeachingBookVersion {
  return {id:String(row.id),bookId:String(row.book_id),revision:Number(row.revision),digest:String(row.digest),
    title:String(row.title),kind:String(row.kind) as TeachingBookVersionKind,createdAt:String(row.created_at),
    ...(row.restored_from?{restoredFrom:String(row.restored_from)}:{})};
}

function render(content:TeachingBookContent) {
  return renderTeachingBookMarkdown({...content,health:{bookId:content.book.id,status:'healthy',sourceCount:content.sources.length,
    staleSourceRefs:[],missingSourceRefs:[],stalePageIds:[],staleBlockIds:[],checkedAt:''}},maximumImageBytes).markdown;
}

export function createTeachingBookVersions(sql:Sql,readContent:(sql:Sql,id:string)=>Promise<TeachingBookContent|undefined>,
    readPatches:(sql:Sql,id:string)=>Promise<TeachingBookPatch[]>) {
  const read=<T>(action:(work:Sql)=>Promise<T>)=>sql.readTransaction?sql.readTransaction(action):action(sql);
  const write=<T>(action:(work:Sql)=>Promise<T>)=>{
    if(!sql.transaction)throw Error('version_unavailable');
    return sql.transaction(action);
  };
  async function current(work:Sql,bookId:string,allowArchived=false) {
    const content=await readContent(work,bookId);
    if(!content||content.book.deletedAt&&!allowArchived)throw Error('book_unavailable');
    return content;
  }
  async function historical(work:Sql,bookId:string,versionId:string) {
    const [row]=await work.all('SELECT * FROM teaching_book_versions WHERE book_id=? AND id=?',[bookId,versionId]);
    if(!row)throw Error('version_unavailable');
    const version=summary(row), image=JSON.parse(String(row.image_json)) as VersionImage;
    if(image.schema!==1||image.content?.book.id!==bookId||!Array.isArray(image.patches)||
        teachingBookDigest(image.content)!==version.digest)throw Error('version_unavailable');
    return {version,image};
  }
  async function latestConfirmation(work:Sql,bookId:string) {
    const [row]=await work.all(`SELECT ${summaries} FROM teaching_book_versions WHERE book_id=? AND kind='confirmed' ORDER BY revision DESC LIMIT 1`,[bookId]);
    return row?summary(row):undefined;
  }
  async function append(work:Sql,content:TeachingBookContent,kind:TeachingBookVersionKind,time:string,restoredFrom?:string) {
    const bookId=content.book.id, id='teaching_version_'+randomUUID(), digest=teachingBookDigest(content);
    const [counter]=await work.all('SELECT COALESCE(MAX(revision),0) AS tip FROM teaching_book_versions WHERE book_id=?',[bookId]);
    const revision=Number(counter.tip)+1;
    const image:VersionImage={schema:1,content,patches:await readPatches(work,bookId)};
    const encoded=JSON.stringify(image);
    if(Buffer.byteLength(encoded)>maximumImageBytes)throw Error('version_too_large');
    const title=content.book.title;
    await work.run(`INSERT INTO teaching_book_versions (id,book_id,revision,digest,title,kind,created_at,restored_from,image_json)
      VALUES (?,?,?,?,?,?,?,?,?)`,[id,bookId,revision,digest,title,kind,time,restoredFrom??'',encoded]);
    return {id,bookId,revision,digest,title,kind,createdAt:time,...(restoredFrom?{restoredFrom}:{})};
  }
  return {
    async migrate() {
      await sql.run(`CREATE TABLE IF NOT EXISTS teaching_book_versions (
        id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES teaching_books(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL, digest TEXT NOT NULL, title TEXT NOT NULL, kind TEXT NOT NULL,
        created_at TEXT NOT NULL, restored_from TEXT NOT NULL, image_json TEXT NOT NULL, UNIQUE(book_id,revision))`);
    },
    async history(bookId:string,before=Number.MAX_SAFE_INTEGER):Promise<TeachingBookVersionHistory> {
      return read(async work=>{
        const [book]=await work.all('SELECT id FROM teaching_books WHERE id=?',[bookId]);
        if(!book)throw Error('book_unavailable');
        const [count]=await work.all('SELECT COUNT(*) AS total FROM teaching_book_versions WHERE book_id=?',[bookId]);
        const rows=await work.all(`SELECT ${summaries} FROM teaching_book_versions WHERE book_id=? AND revision<? ORDER BY revision DESC LIMIT 50`,[bookId,before]);
        return {versions:rows.map(summary),total:Number(count.total),currentConfirmed:await latestConfirmation(work,bookId)};
      });
    },
    async preview(input:TeachingBookVersionRead):Promise<TeachingBookVersionPreview> {
      return read(async work=>{
        const {bookId,versionId}=input;
        const stored=versionId?await historical(work,bookId,versionId):undefined;
        const content=stored?.image.content??await current(work,bookId,true);
        return {bookId,title:content.book.title,digest:teachingBookDigest(content),markdown:render(content),
          version:stored?.version,sourceTitles:[...new Set(content.sources.map(source=>source.title))],
          patchCount:stored?.image.patches.length??0,readOnly:!!stored||!!content.book.deletedAt};
      });
    },
    async confirm({bookId,digest}:TeachingBookConfirm) {
      return write(async work=>{
        const content=await current(work,bookId);
        if(teachingBookDigest(content)!==digest)throw Error('version_conflict');
        if(!content.chapters.length||!content.pages.length||!content.blocks.some(block=>block.status==='ready')||
            content.blocks.some(block=>!['ready','hidden'].includes(block.status)))throw Error('draft_incomplete');
        if(content.materialSources?.length){
          await assertClassroomContext(work,{schemaVersion:CLASSROOM_CONTEXT_SCHEMA,preferenceRevision:0,
            materials:content.materialSources.map(source=>({source,title:'讲义引用段落',characters:1,truncated:false,recognition:'saved_text'}))});
        }
        await assertCurrentBookSourceRows(work,content);
        const previous=await latestConfirmation(work,bookId);
        if(previous?.digest===digest)return previous;
        return append(work,content,'confirmed',new Date().toISOString());
      });
    },
    async restore(input:TeachingBookRestore) {
      return write(async work=>{
        const content=await current(work,input.bookId);
        if(teachingBookDigest(content)!==input.currentDigest)throw Error('version_conflict');
        const {version,image}=await historical(work,input.bookId,input.versionId);
        if(version.digest!==input.versionDigest||version.digest===input.currentDigest)throw Error('version_conflict');
        const time=new Date().toISOString();
        await append(work,content,'before_restore',time);
        await restoreTeachingBook(work,image.content,time);
        return append(work,await current(work,input.bookId),'restored_draft',time,version.id);
      });
    },
  };
}

async function assertCurrentBookSourceRows(work:Sql,content:TeachingBookContent) {
  const queries={
    knowledge_resource:'SELECT content_hash AS fingerprint FROM teacher_resources WHERE id=?',
    knowledge_chunk:'SELECT r.content_hash AS fingerprint FROM resource_chunks c JOIN teacher_resources r ON r.id=c.resource_id WHERE c.id=? AND c.contains_personal_data=0',
    teacher_notebook:"SELECT updated_at AS fingerprint FROM teacher_notebook_records WHERE id=? AND deleted_at=''",
    question_notebook:'SELECT updated_at AS fingerprint FROM question_bank_items WHERE id=?',
  };
  for(const source of content.sources) {
    if(source.kind==='manual')continue;
    const query=queries[source.kind];
    if(!query)throw Error('source_changed');
    const [row]=await work.all(query,[source.ref]);
    if(!row||source.fingerprint&&row.fingerprint!==source.fingerprint)throw Error('source_changed');
  }
}
