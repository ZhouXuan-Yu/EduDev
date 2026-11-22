import {createHash, randomUUID} from 'node:crypto';
import type {ClassroomContext} from '../../shared/classroom-context';
import type {TeachingSourceRef} from '../../shared/contracts';
import {validMaterialSource,type MaterialSource} from '../../shared/materials';
import type {TeachingHandoutInput, TeachingHandoutSummary} from '../../shared/teaching-handout';
import type {Sql} from '../xiaozhi-agent/session-state';
import {createTaskState} from '../xiaozhi-agent/tasks/task-state';
import {assertClassroomContext} from './classroom-context';

export type HandoutOwner = {sessionId:string; taskId:string; runId:string; generation:number; requirementsVersion:number};
type VerifiedCitation = {anchor:TeachingSourceRef; source:MaterialSource};

type HandoutRun = Pick<HandoutOwner,'sessionId'|'runId'|'generation'>;
export async function readTeachingHandoutEffect(sql:Sql,owner:HandoutRun,callId:string) {
  const [row]=await sql.all(`SELECT receipt.call_id FROM teaching_handout_receipts receipt
    JOIN teaching_handout_origins origin ON origin.book_id=receipt.book_id AND origin.run_id=receipt.run_id
    JOIN teaching_books book ON book.id=origin.book_id
    WHERE origin.session_id=? AND origin.run_id=? AND receipt.generation=? AND receipt.call_id=?`,
  [owner.sessionId,owner.runId,owner.generation,callId]);
  return row?'matched' as const:'uncertain' as const;
}

async function recordReceipt(sql:Sql,bookId:string,owner:HandoutRun,callId:string) {
  await sql.run('INSERT INTO teaching_handout_receipts (run_id,call_id,book_id,generation) VALUES (?,?,?,?) ON CONFLICT(run_id,call_id) DO NOTHING',
    [owner.runId,callId,bookId,owner.generation]);
}

async function verifyCitations(sql:Sql,input:TeachingHandoutInput,context:ClassroomContext) {
  const cited = input.chapters.flatMap(chapter => chapter.citations);
  const materials = new Map(context.materials.filter(item => !item.truncated)
    .map(item => [item.source.resourceId+'/'+item.source.offset,item]));
  const selected = new Map<string,ClassroomContext['materials'][number]>();
  for (const citation of cited) {
    const key = citation.resourceId+'/'+citation.offset;
    const material = materials.get(key);
    if (!material) throw Error('source_required');
    selected.set(key,material);
  }
  await assertClassroomContext(sql,{...context,materials:[...selected.values()]});
  const rows = new Map<string,string>();
  for (const [key,material] of selected) {
    const [row] = await sql.all('SELECT content_md FROM resource_chunks WHERE id=?',[material.source.chunkId]);
    if (!row) throw Error('source_changed');
    rows.set(key,String(row.content_md));
  }
  return input.chapters.map(chapter => chapter.citations.map((citation):VerifiedCitation => {
    const key = citation.resourceId+'/'+citation.offset;
    const material = selected.get(key)!;
    if (!rows.get(key)?.includes(citation.quote)) throw Error('source_quote_mismatch');
    const source = material.source;
    return {source,anchor:{kind:'knowledge_chunk',ref:source.chunkId,title:material.title,snippet:citation.quote,
      fingerprint:source.version,status:'available'}};
  }));
}

async function writeBook(sql:Sql,bookId:string,input:TeachingHandoutInput,citations:VerifiedCitation[][],time:string) {
  const description = input.sourceGaps.length ? '待核对来源：'+input.sourceGaps.join('；').slice(0,980) : '';
  await sql.run("INSERT INTO teaching_books (id,title,description,target_level,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    [bookId,input.title,description,input.targetLevel,time,time]);
  const sources = new Map<string,VerifiedCitation>();
  for (const [chapterIndex,chapter] of input.chapters.entries()) {
    const chapterId = 'teaching_chapter_'+randomUUID(), pageId = 'teaching_page_'+randomUUID();
    const objectives = JSON.stringify(chapter.objectives);
    await sql.run('INSERT INTO teaching_book_chapters (id,book_id,title,learning_objectives_json,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
      [chapterId,bookId,chapter.title,objectives,chapterIndex,time,time]);
    await sql.run("INSERT INTO teaching_book_pages (id,book_id,chapter_id,title,status,sort_order,created_at,updated_at) VALUES (?,?,?,?,'ready',?,?,?)",
      [pageId,bookId,chapterId,'知识讲解与练习',chapterIndex,time,time]);
    const anchors = citations[chapterIndex].map(citation => citation.anchor);
    for (const citation of citations[chapterIndex]) {
      if (!sources.has(citation.anchor.ref)) sources.set(citation.anchor.ref,citation);
    }
    const blocks = [
      {title:'重点与难点',text:'重点：'+chapter.focus+'\n\n难点：'+chapter.difficulty,role:'focus'},
      {title:'知识讲解',text:chapter.explanation,role:'explanation'},
      {title:'例题',text:chapter.example.prompt,role:'example'},
      {title:'例题解题过程',text:chapter.example.steps.map((step,i)=>`${i+1}. ${step}`).join('\n')+'\n\n结论：'+chapter.example.answer,role:'worked_solution'},
      ...chapter.exercises.flatMap((exercise,i) => [
        {title:`练习 ${i+1} · ${exercise.difficulty}`,text:exercise.prompt,role:'exercise'},
        {title:`练习 ${i+1} · 答案与解析`,text:exercise.answer+'\n\n'+exercise.explanation,role:'exercise_solution'},
      ]),
    ];
    for (const [index,block] of blocks.entries()) {
      await sql.run(`INSERT INTO teaching_book_blocks (id,page_id,type,status,title,payload_json,source_anchors_json,metadata_json,sort_order,created_at,updated_at)
        VALUES (?,?,'text','ready',?,?,?,?,?,?,?)`,
      ['teaching_block_'+randomUUID(),pageId,block.title,JSON.stringify({text:block.text}),
        JSON.stringify(block.role==='explanation'||block.role==='focus'?anchors:[]),JSON.stringify({handoutRole:block.role}),index,time,time]);
    }
  }
  for (const {anchor} of sources.values()) {
    const id = 'teaching_source_'+createHash('sha1').update(`${bookId}:${anchor.kind}:${anchor.ref}`).digest('hex').slice(0,20);
    await sql.run("INSERT INTO teaching_book_sources (id,book_id,kind,ref,title,snippet,fingerprint,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'available',?,?)",
      [id,bookId,anchor.kind,anchor.ref,anchor.title,anchor.snippet,anchor.fingerprint,time,time]);
  }
  return [...sources.values()].map(item => item.source);
}

function mapSummary(row:Record<string,unknown>):TeachingHandoutSummary {
  return {bookId:String(row.book_id),taskId:String(row.task_id),runId:String(row.run_id),title:String(row.title),
    chapterCount:Number(row.chapter_count),sourceCount:Number(row.source_count)};
}

const summaryQuery = `SELECT origin.book_id,origin.task_id,origin.run_id,origin.input_hash,books.title,books.deleted_at,
  (SELECT COUNT(*) FROM teaching_book_chapters WHERE book_id=origin.book_id) AS chapter_count,
  (SELECT COUNT(*) FROM teaching_book_sources WHERE book_id=origin.book_id) AS source_count
  FROM teaching_handout_origins origin JOIN teaching_books books ON books.id=origin.book_id`;

export function createTeachingHandoutState(sql:Sql) {
  return {
    async migrate() {
      await sql.run(`CREATE TABLE IF NOT EXISTS teaching_handout_origins (
        book_id TEXT PRIMARY KEY REFERENCES teaching_books(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id), task_id TEXT NOT NULL,
        run_id TEXT NOT NULL UNIQUE REFERENCES ai_agent_runs(id), input_hash TEXT NOT NULL,
        material_sources_json TEXT NOT NULL, created_at TEXT NOT NULL)`);
      await sql.run('CREATE INDEX IF NOT EXISTS teaching_handout_origins_session ON teaching_handout_origins(session_id,created_at)');
      await sql.run(`CREATE TABLE IF NOT EXISTS teaching_handout_receipts (
        run_id TEXT NOT NULL REFERENCES teaching_handout_origins(run_id) ON DELETE CASCADE, call_id TEXT NOT NULL,
        book_id TEXT NOT NULL REFERENCES teaching_handout_origins(book_id) ON DELETE CASCADE, generation INTEGER NOT NULL,
        PRIMARY KEY(run_id,call_id))`);
    },
    async list(sessionId:string) {
      return (await sql.all(summaryQuery+" WHERE origin.session_id=? AND books.deleted_at='' ORDER BY origin.created_at DESC LIMIT 100",[sessionId])).map(mapSummary);
    },
    async materialSources(bookId:string) {
      const [row]=await sql.all('SELECT material_sources_json FROM teaching_handout_origins WHERE book_id=?',[bookId]);
      if (!row) return undefined;
      const sources:unknown=JSON.parse(String(row.material_sources_json));
      if (!Array.isArray(sources)||sources.length>20||!sources.every(validMaterialSource)) throw Error('configuration');
      return sources;
    },
    async save(owner:HandoutOwner,callId:string,input:TeachingHandoutInput,inputHash:string,context:ClassroomContext,current:()=>boolean) {
      if (!sql.transaction) throw Error('configuration');
      const fence = () => {if (!current()) throw Error('cancelled');};
      return sql.transaction(async work => {
        fence();
        const tasks = createTaskState(work,{sanitize:async text => text});
        const binding = await tasks.ownerForRun(owner.sessionId,owner.runId), task = await tasks.get(owner.taskId);
        const [run] = await work.all('SELECT status FROM ai_agent_runs WHERE id=? AND session_id=?',[owner.runId,owner.sessionId]);
        if (!binding || binding.taskId!==owner.taskId || binding.generation!==owner.generation ||
            binding.requirementsVersion!==owner.requirementsVersion || task?.binding?.runId!==owner.runId ||
            run?.status!=='running') throw Error('permission_denied');
        const [existing] = await work.all(summaryQuery+' WHERE origin.session_id=? AND origin.run_id=?',[owner.sessionId,owner.runId]);
        if (existing) {
          if (existing.input_hash!==inputHash || existing.deleted_at!=='') throw Error('conflict');
          await recordReceipt(work,String(existing.book_id),owner,callId);
          fence();
          return mapSummary(existing);
        }
        const citations = await verifyCitations(work,input,context);
        fence();
        const bookId = 'teaching_book_'+randomUUID(), time = new Date().toISOString();
        const sources = await writeBook(work,bookId,input,citations,time);
        await work.run('INSERT INTO teaching_handout_origins (book_id,session_id,task_id,run_id,input_hash,material_sources_json,created_at) VALUES (?,?,?,?,?,?,?)',
          [bookId,owner.sessionId,owner.taskId,owner.runId,inputHash,JSON.stringify(sources),time]);
        await recordReceipt(work,bookId,owner,callId);
        fence();
        return {bookId,taskId:owner.taskId,runId:owner.runId,title:input.title,chapterCount:input.chapters.length,sourceCount:sources.length};
      });
    },
  };
}
