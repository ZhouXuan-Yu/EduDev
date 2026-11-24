import {createHash} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import {validQuestionArchive} from '../../shared/question-archive';
import type {MaterialSource} from '../../shared/materials';
import {materialBodyVersion} from './material-source';
import type {MaterialRepository, MaterialReadingSnapshot} from './material-repository';
import {extractMaterialQuestionWindow, type ExtractedQuestion} from './material-question-extract';
import {teacherOwnsRuleQuestion} from './material-rule-protection';
import {structureDuplicateIndex,structureDuplicateKey} from './material-structure-duplicates';

type Value = string | number | null;
type Sql = {all: (sql: string, values?: Value[]) => Promise<Record<string, unknown>[]>; run: (sql: string, values?: Value[]) => Promise<void>};
type Host = Sql & {materials: () => MaterialRepository; read: (id: string) => Promise<QuestionBankItem | undefined>};
type Window = MaterialReadingSnapshot & {hasMore: boolean};
type Plan = {question: QuestionBankItem; memberKey: string; resourceId: string; cursor: number; fingerprint: string; hasMore: boolean; engine: string; key: string};
const policyIndex = 'idx_material_rule_duplicates_v1';

export const ruleDuplicateHidden = process.env.OMNI_EDU_RULE_DUPLICATES==='0'?'0':`EXISTS(SELECT 1 FROM material_question_members d
  JOIN material_question_members keeper ON keeper.question_id=d.duplicate_of
  JOIN question_bank_items kept ON kept.id=keeper.question_id
  WHERE d.question_id=q.id AND d.duplicate_of<>'' AND d.duplicate_key<>''
  AND keeper.duplicate_key=d.duplicate_key AND keeper.duplicate_of='')`;
export function materialQuestionExtractionKey(id:string,version:string,sources:MaterialSource[],position:string){
  return createHash('sha256').update(id+'\0'+version+'\0numbered-text.v1\0'+JSON.stringify(sources)+'\0'+position).digest('hex');
}

export async function ensureRuleDuplicates(host: Sql) {
  const columns = new Set((await host.all('PRAGMA table_info(material_question_members)')).map(row => String(row.name)));
  if (!columns.size) return;
  const first = !(await host.all("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?", [policyIndex])).length;
  for (const [name, definition] of [['duplicate_key', "TEXT NOT NULL DEFAULT ''"], ['duplicate_of', "TEXT NOT NULL DEFAULT ''"], ['duplicate_order', "TEXT NOT NULL DEFAULT ''"]]) {
    if (!columns.has(name)) await host.run(`ALTER TABLE material_question_members ADD COLUMN ${name} ${definition}`);
  }
  await host.run("CREATE INDEX IF NOT EXISTS idx_rule_duplicates_folded ON material_question_members(duplicate_of,question_id) WHERE duplicate_of<>''");
  const tables = new Set((await host.all("SELECT name FROM sqlite_master WHERE type='table'")).map(row => String(row.name)));
  if (columns.has('resource_id') && columns.has('extraction_key')) {
    await host.run("CREATE INDEX IF NOT EXISTS idx_rule_duplicates_resource ON material_question_members(resource_id) WHERE duplicate_key<>''");
    const group = `(SELECT duplicate_key FROM material_question_members WHERE question_id=OLD.id AND duplicate_key<>'')`;
    const invalidateQuestion = (id: string) => `
      INSERT INTO material_question_origin_dirty_v1(question_id)
        SELECT question_id FROM material_question_members WHERE question_id=${id}
        OR (duplicate_key<>'' AND duplicate_key=${group})
        ON CONFLICT(question_id) DO UPDATE SET revision=revision+1;
      UPDATE material_question_members SET duplicate_of='' WHERE duplicate_key<>'' AND duplicate_key=${group};
      UPDATE material_question_members SET duplicate_key='',duplicate_of='',duplicate_order='' WHERE question_id=${id};`;
    for (const event of ['UPDATE', 'DELETE']) await host.run(`CREATE TRIGGER IF NOT EXISTS rule_duplicates_question_${event.toLowerCase()}_v1 AFTER ${event} ON question_bank_items BEGIN ${invalidateQuestion('OLD.id')} END`);
    for (const [table, events] of [
      ['question_notebook_bookmarks', ['INSERT', 'UPDATE', 'DELETE']],
      ['question_notebook_category_links', ['INSERT', 'DELETE']],
      ['question_bank_usage', ['INSERT', 'DELETE']],
    ] as const) if (tables.has(table)) for (const event of events) {
      const reference = event === 'DELETE' ? 'OLD.question_id' : 'NEW.question_id';
      const protectionGroup = `(SELECT duplicate_key FROM material_question_members WHERE question_id=${reference} AND duplicate_key<>'')`;
      await host.run(`CREATE TRIGGER IF NOT EXISTS rule_duplicates_${table}_${event.toLowerCase()}_v1 AFTER ${event} ON ${table} BEGIN
        INSERT INTO material_question_origin_dirty_v1(question_id) SELECT question_id FROM material_question_members
          WHERE question_id=${reference} OR (duplicate_key<>'' AND duplicate_key=${protectionGroup})
          ON CONFLICT(question_id) DO UPDATE SET revision=revision+1;
        UPDATE material_question_members SET duplicate_of='' WHERE duplicate_key<>'' AND duplicate_key=${protectionGroup};
        UPDATE material_question_members SET duplicate_key='',duplicate_of='',duplicate_order='' WHERE question_id=${reference};
      END`);
    }
    for (const [table, event, resources, changed] of [
      ['resource_chunks', 'UPDATE', 'OLD.resource_id,NEW.resource_id', 'OLD.id<>NEW.id OR OLD.resource_id<>NEW.resource_id OR OLD.chunk_index<>NEW.chunk_index OR OLD.content_md<>NEW.content_md OR OLD.contains_personal_data<>NEW.contains_personal_data OR OLD.page_number IS NOT NEW.page_number'],
      ['resource_chunks', 'INSERT', 'NEW.resource_id', ''],
      ['resource_chunks', 'DELETE', 'OLD.resource_id', ''],
      ['teacher_resources', 'UPDATE', 'OLD.id', 'OLD.content_hash<>NEW.content_hash'],
      ['teacher_resources', 'DELETE', 'OLD.id', ''],
    ]) if (tables.has(table)) await host.run(`CREATE TRIGGER IF NOT EXISTS rule_duplicates_${table}_${event.toLowerCase()}_v1 AFTER ${event} ON ${table} ${changed ? 'WHEN ' + changed : ''} BEGIN
      INSERT INTO material_question_origin_dirty_v1(question_id) SELECT question_id FROM material_question_members
        WHERE resource_id IN (${resources}) AND duplicate_key<>'' ON CONFLICT(question_id) DO UPDATE SET revision=revision+1;
      UPDATE material_question_members SET duplicate_key='',duplicate_of='',duplicate_order='' WHERE resource_id IN (${resources}) AND duplicate_key<>'';
    END`);
  }
  const firstStructure = !(await host.all("SELECT 1 FROM sqlite_master WHERE type='index' AND name=?", [structureDuplicateIndex])).length;
  if ((first || firstStructure) && tables.has('app_settings')) await host.run("UPDATE app_settings SET value_json=?,updated_at=datetime('now') WHERE key=?", [JSON.stringify({schema: 2, cursor: 0}), 'xiaozhi.question-origins.cursor.v1']);
  // Apply the existing bounded origin scan to historical structure drafts on first upgrade.
  // The index acts as a migration marker after the cursor is reset.
  await host.run(`CREATE INDEX IF NOT EXISTS ${structureDuplicateIndex}
    ON material_question_members(duplicate_key,duplicate_order,question_id)
    WHERE ${structureDuplicateKey("material_question_members")}`);
  // Last marker makes a preparation interrupted before cursor reset retry on the next launch.
  await host.run(`CREATE INDEX IF NOT EXISTS ${policyIndex} ON material_question_members(duplicate_key,duplicate_order,question_id) WHERE duplicate_key<>''`);
}

function creationOrder(value: string) {
  const timestamp = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d{1,3})?$/.test(value) ? value.replace(' ', 'T') + 'Z' : value;
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(timestamp)) return;
  const time = Date.parse(timestamp);
  if (Number.isFinite(time)) return new Date(time).toISOString();
}
function untouched(q: QuestionBankItem) {
  return !!q.archive && validQuestionArchive(q.archive) && q.archive.extractor === 'numbered-text.v1' &&
    q.archive.state === 'rule_extracted' && !q.archive.sourceChecked && !q.document &&
    typeof q.createdAt === 'string' && !!creationOrder(q.createdAt) && q.createdAt === q.updatedAt;
}
function content(q: QuestionBankItem | ExtractedQuestion) {
  const fields = 'fields' in q ? q.fields : q;
  const a = q.archive!;
  return JSON.stringify([fields.subject, fields.grade, fields.knowledgePoint, fields.questionType, fields.difficulty,
    fields.stem, fields.answer, fields.analysis, fields.sourceTitle, fields.sourceKind, fields.tags,
    a.schemaVersion, a.extractor, a.state, a.number, a.issues, a.sourceRisks, a.sourceChecked, a.answerOrigin, a.analysisOrigin]);
}
export function ruleDuplicateKey(q: ExtractedQuestion, window: Window, cursor: number) {
  const sources = q.archive.sources.map(source => {
    const unit = window.units.find(unit => unit.offset === source.offset);
    if (!unit || unit.resourceId !== source.resourceId || unit.version !== source.version) throw Error('source_changed');
    const c = unit.chunk;
    return [source.resourceId, source.version, source.offset, c.chunkIndex, c.contentMd, c.containsPersonalData, c.pageNumber || 0];
  });
  return createHash('sha256').update(JSON.stringify(['rule-duplicate.v1', cursor, q.key, content(q), sources])).digest('hex');
}
export async function prepareRuleDuplicate(host: Host, q: QuestionBankItem): Promise<Plan | undefined> {
  if (!untouched(q) || !q.archive!.sources.length || await teacherOwnsRuleQuestion(host, q.id)) return;
  const sources = q.archive!.sources, source = sources[0];
  if (sources.some(s => s.resourceId !== source.resourceId || s.version !== source.version)) return;
  const member = (await host.all('SELECT extraction_key,resource_id FROM material_question_members WHERE question_id=?', [q.id]))[0];
  if (!member || member.resource_id !== source.resourceId) return;
  const resource = await host.materials().resource(source.resourceId);
  if (resource.contentHash !== source.version) return;
  const cursor = Math.floor(source.offset / 16) * 16;
  const window = await host.materials().readingWindow(source.resourceId, cursor);
  for (const saved of sources) {
    const unit = window.units.find(unit => unit.offset === saved.offset);
    if (!unit || materialBodyVersion({...unit.chunk, id: saved.chunkId}) !== saved.bodyVersion) return;
    if (unit.chunk.id !== saved.chunkId && (await host.all('SELECT 1 FROM resource_chunks WHERE id=? LIMIT 1', [saved.chunkId])).length) return;
  }
  const candidate = extractMaterialQuestionWindow(window.units, resource.parseEngine, window.hasMore, cursor)
    .find(candidate => content(candidate) === content(q) && materialQuestionExtractionKey(source.resourceId, source.version, sources, candidate.key) === member.extraction_key);
  if (!candidate || candidate.archive.sources.length !== sources.length || candidate.archive.sources.some((s, i) => s.offset !== sources[i].offset)) return;
  return {question: q, memberKey: String(member.extraction_key), resourceId: source.resourceId, cursor, fingerprint: window.fingerprint, hasMore: window.hasMore, engine: resource.parseEngine, key: ruleDuplicateKey(candidate, window, cursor)};
}
export async function clearRuleDuplicate(host: Sql, id: string) {
  await host.run("UPDATE material_question_members SET duplicate_key='',duplicate_of='',duplicate_order='' WHERE question_id=? AND duplicate_key<>''", [id]);
}
async function assign(host: Sql, id: string, key: string) {
  const previous = (await host.all("SELECT question_id FROM material_question_members WHERE duplicate_key=? AND duplicate_key<>'' ORDER BY duplicate_order,question_id LIMIT 1", [key]))[0];
  const row = (await host.all('SELECT created_at FROM question_bank_items WHERE id=?', [id]))[0];
  const order = creationOrder(String(row.created_at));
  if (!order) throw Error('source_changed');
  await host.run('UPDATE material_question_members SET duplicate_key=?,duplicate_order=? WHERE question_id=?', [key, order, id]);
  const keeper = String((await host.all("SELECT question_id FROM material_question_members WHERE duplicate_key=? AND duplicate_key<>'' ORDER BY duplicate_order,question_id LIMIT 1", [key]))[0].question_id);
  if (previous && previous.question_id === keeper) {
    await host.run('UPDATE material_question_members SET duplicate_of=? WHERE question_id=?', [keeper === id ? '' : keeper, id]);
  } else {
    await host.run("UPDATE material_question_members SET duplicate_of=CASE WHEN question_id=? THEN '' ELSE ? END WHERE duplicate_key=? AND duplicate_key<>''", [keeper, keeper, key]);
  }
}
export async function applyRuleDuplicate(host: Host, plan: Plan) {
  const current = await host.read(plan.question.id);
  if (!current || !untouched(current) || await teacherOwnsRuleQuestion(host, current.id)) return true;
  if (JSON.stringify(current) !== JSON.stringify(plan.question)) return false;
  const member = (await host.all('SELECT extraction_key FROM material_question_members WHERE question_id=?', [current.id]))[0];
  const window = await host.materials().readingWindow(plan.resourceId, plan.cursor);
  const resource = await host.materials().resource(plan.resourceId);
  if (member?.extraction_key !== plan.memberKey || window.fingerprint !== plan.fingerprint || window.hasMore !== plan.hasMore || resource.parseEngine !== plan.engine) return false;
  await assign(host, current.id, plan.key);
  return true;
}
export async function reuseRuleDuplicate(host: Host, key: string) {
  const row = (await host.all("SELECT question_id FROM material_question_members WHERE duplicate_key=? AND duplicate_key<>'' ORDER BY duplicate_order,question_id LIMIT 1", [key]))[0];
  if (!row) return false;
  const q = await host.read(String(row.question_id));
  return !!q && untouched(q) && !await teacherOwnsRuleQuestion(host, q.id);
}
export async function recordNewRuleDuplicate(host: Host, q: QuestionBankItem, key: string) {
  if (untouched(q) && !await teacherOwnsRuleQuestion(host, q.id)) await assign(host, q.id, key);
}
