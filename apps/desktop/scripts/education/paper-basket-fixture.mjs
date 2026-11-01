import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {PaperRepository} from '../../src/main/education/paper-repository.ts';
import {PaperBasketRepository} from '../../src/main/education/paper-basket-repository.ts';
import {migratePaperBaskets} from '../../src/main/education/paper-basket-state.ts';
import {QuestionReviewRepository} from '../../src/main/education/question-review-repository.ts';

/** Owned SQLite and source files. Qualification adapters are controlled; no model or app is started. */
export async function basketFixture(root) {
  fs.mkdirSync(root, {recursive: true});
  const file = path.join(root, 'app.sqlite');
  const db = new DatabaseSync(file);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE students(id TEXT PRIMARY KEY,status TEXT);
    CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT);
    CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,student_id TEXT);
    CREATE TABLE questions(id TEXT PRIMARY KEY,body TEXT);
    CREATE TABLE bookmarks(question_id TEXT PRIMARY KEY,version TEXT);
    CREATE TABLE generations(id TEXT PRIMARY KEY,body TEXT);
    CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,student_id TEXT,
      action_type TEXT,status TEXT,title TEXT,payload_json TEXT,result_json TEXT DEFAULT '{}',
      created_at TEXT,updated_at TEXT,confirmed_at TEXT,rejected_at TEXT);`);
  const sid = 'aisession_' + randomUUID();
  const other = 'aisession_' + randomUUID();
  const student = 'student_' + randomUUID();
  db.prepare("INSERT INTO students VALUES(?,'active')").run(student);
  db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,NULL)').run(sid, student);
  db.prepare("INSERT INTO ai_conversation_sessions VALUES(?,'',NULL)").run(other);
  let pages = 0;
  let writes = 0;
  let openWriters = 0;
  let peakWriters = 0;
  let afterWrite;
  let afterValidation;
  let closed = false;
  const sources = new Map();

  const put = question => db.prepare('INSERT OR REPLACE INTO questions VALUES(?,?)')
    .run(question.id, JSON.stringify(question));
  function question(label, patch = {}) {
    const item = {
      id: 'question_' + randomUUID(), subject: '数学', grade: '初二', knowledgePoint: '合成合同',
      questionType: '解答题', difficulty: 'medium', stem: `独立合成条件 ${label}：计算并说明条件。`,
      answer: '合成答案，需教师核对。', analysis: '合成解析，不证明数学质量。',
      sourceTitle: '受控本地题库', sourceKind: 'local_bank', tags: [],
      createdAt: '2026-11-01', updatedAt: '2026-11-01', ...patch,
    };
    const sourceFile = path.join(root, item.id + '.txt');
    fs.writeFileSync(sourceFile, item.stem);
    sources.set(item.id, {file: sourceFile, text: item.stem});
    put(item);
    return item;
  }
  function sqlFor(connection) {
    return {
      all: async (sql, params = []) => connection.prepare(sql).all(...params),
      run: async (sql, params = []) => connection.prepare(sql).run(...params),
      read: async id => {
        const row = connection.prepare('SELECT body FROM questions WHERE id=?').get(id);
        return row ? JSON.parse(row.body) : undefined;
      },
      create: async input => {
        const item = {...input, id: 'question_' + randomUUID(), createdAt: '2026-11-01', updatedAt: '2026-11-01'};
        const sourceFile = path.join(root, item.id + '.txt');
        fs.writeFileSync(sourceFile, item.stem);
        sources.set(item.id, {file: sourceFile, text: item.stem});
        connection.prepare('INSERT INTO questions VALUES(?,?)').run(item.id, JSON.stringify(item));
        return item;
      },
      page: async (_blueprint, after) => {
        pages++;
        return connection.prepare('SELECT * FROM questions WHERE id>? ORDER BY id LIMIT 200').all(after)
          .map(row => ({id: row.id, question: JSON.parse(row.body)}));
      },
      validate: async item => {
        const source = sources.get(item.id);
        if (!source || fs.readFileSync(source.file, 'utf8') !== source.text) throw Error('source_changed');
        await afterValidation?.();
      },
    };
  }
  async function transaction(work, readOnly = false) {
    const connection = new DatabaseSync(file);
    connection.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=0;');
    if (readOnly) connection.exec('PRAGMA query_only=ON;');
    let begun = false;
    try {
      connection.exec(readOnly ? 'BEGIN;' : 'BEGIN IMMEDIATE;');
      begun = true;
      if (!readOnly) {
        writes++;
        openWriters++;
        peakWriters = Math.max(peakWriters, openWriters);
      }
      const result = await work(sqlFor(connection));
      connection.exec('COMMIT;');
      return result;
    } catch (error) {
      if (begun) connection.exec('ROLLBACK;');
      throw error;
    } finally {
      if (begun && !readOnly) openWriters--;
      connection.close();
    }
  }
  const host = {
    ...sqlFor(db),
    transaction: work => transaction(work),
    readTransaction: work => transaction(work, true),
    approvedGenerations: async (_sessionId, sql) => (await sql.all('SELECT body FROM generations ORDER BY id'))
      .map(row => JSON.parse(row.body)),
  };
  await migratePaperBaskets(host);
  await migratePaperBaskets(host);
  function repositories() {
    const papers = new PaperRepository(host);
    const baskets = new PaperBasketRepository({
      ...host,
      approvedGenerations: (owner, sql) => host.approvedGenerations(owner, sql),
      afterWrite: async () => afterWrite?.(),
      saveSnapshot: (...args) => papers.createBasketSnapshotInTransaction(...args),
      readSnapshot: (...args) => papers.reviewInTransaction(...args),
    });
    return {papers, baskets};
  }
  return {
    root, file, db, sid, other, student, host, put, question, sources, repositories,
    ...repositories(),
    hook: action => { afterWrite = action; },
    validationHook: action => { afterValidation = action; },
    useActualReviews: () => {
      const reviews = new QuestionReviewRepository(host);
      host.approvedGenerations = (owner, sql) => reviews.approvedForPaper(owner, sql);
      return reviews;
    },
    counters: () => ({pages, writes, peakWriters}),
    group: (questions, kind = 'ai_original', sessionId = sid) => {
      const group = {
        id: 'xiquestion_' + randomUUID(), sessionId, subject: '数学', grade: '初二', title: '合成已审组',
        generationKind: kind, effectDigest: 'a'.repeat(64), questions,
      };
      db.prepare('INSERT INTO generations VALUES(?,?)').run(group.id, JSON.stringify(group));
      return group;
    },
    close: () => {
      if (!closed) db.close();
      closed = true;
    },
  };
}
