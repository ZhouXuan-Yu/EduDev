import {PAPER_BASKET_V2_SCHEMA} from '../../shared/paper-basket-v2';
import type {PaperInstance} from '../../shared/paper-instance';
import {assertInstance} from './paper-instance';
import {createHash} from 'node:crypto';
import {validPaperBlueprint, validPaperSession, type PaperBlueprint, type PaperBasketBinding, type PaperItem} from '../../shared/paper-blueprint';
import {
  PAPER_BASKET_SCHEMA, basketArray, validBasketEntryId, validBasketId, validBasketRevision,
  validBasketUiState, type PaperBasketEntry, type PaperBasketSummary, type PaperBasketUiState,
} from '../../shared/paper-basket';
import {plainStudentInput} from '../../shared/student-context';
import {questionVersion} from './question-context-provider';
import type {PaperRow, PaperSql} from './paper-sql';

export type BasketData = {blueprint: PaperBlueprint; entries: (PaperBasketEntry & {instance?: PaperInstance})[]; uiState?: PaperBasketUiState};
export type StoredBasket = PaperBasketSummary & {studentId: string; schemaVersion: typeof PAPER_BASKET_SCHEMA | typeof PAPER_BASKET_V2_SCHEMA; data: BasketData};
export type BasketReceipt = {basketId: string; paperId?: string; revision: number};
const MAX_STATE_BYTES = 32 * 1024 * 1024;
const MAX_OWNER_BASKETS = 200;
const MAX_OWNER_OPERATIONS = 10000;
const MAX_OWNER_UI_OPERATIONS = 10000;
export type BasketOperationKind = 'create' | 'mutate' | 'snapshot' | 'ui_state';
const RECEIPT_KINDS = {
  create: 'domain:create',
  mutate: 'domain:mutate',
  snapshot: 'domain:snapshot',
  ui_state: 'ui:state',
} as const;

export async function migratePaperBaskets(sql: Pick<PaperSql, 'run'>) {
  await sql.run(`CREATE TABLE IF NOT EXISTS paper_baskets (
    id TEXT PRIMARY KEY, session_id TEXT NOT NULL, student_id TEXT NOT NULL,
    schema_version TEXT NOT NULL, revision INTEGER NOT NULL CHECK(revision BETWEEN 1 AND 1000000),
    state TEXT NOT NULL CHECK(state IN ('active','archived')), data_json TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  await sql.run('CREATE INDEX IF NOT EXISTS paper_baskets_owner ON paper_baskets(session_id, updated_at, id)');
  await sql.run(`CREATE TABLE IF NOT EXISTS paper_basket_operations (
    session_id TEXT NOT NULL, request_id TEXT NOT NULL, student_id TEXT NOT NULL,
    operation_kind TEXT NOT NULL, input_hash TEXT NOT NULL, basket_id TEXT NOT NULL,
    paper_id TEXT, result_revision INTEGER NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(session_id, request_id), FOREIGN KEY(basket_id) REFERENCES paper_baskets(id)
  )`);
  await sql.run('CREATE INDEX IF NOT EXISTS paper_basket_operations_scope ON paper_basket_operations(session_id, operation_kind)');
  await sql.run(`CREATE TABLE IF NOT EXISTS paper_instance_events (
    session_id TEXT NOT NULL, student_id TEXT NOT NULL, basket_id TEXT NOT NULL, entry_id TEXT NOT NULL,
    event_id TEXT NOT NULL, instance_revision INTEGER NOT NULL, operation_kind TEXT NOT NULL,
    before_digest TEXT, after_digest TEXT NOT NULL, data_json TEXT NOT NULL, created_at TEXT NOT NULL,
    PRIMARY KEY(session_id,basket_id,event_id), FOREIGN KEY(basket_id) REFERENCES paper_baskets(id))`);
  await sql.run('CREATE INDEX IF NOT EXISTS paper_instance_events_entry ON paper_instance_events(session_id,basket_id,entry_id,instance_revision)');
  await sql.run("CREATE UNIQUE INDEX IF NOT EXISTS paper_instance_content_revision ON paper_instance_events(session_id,basket_id,entry_id,instance_revision) WHERE operation_kind!='reviewEntry'");
}

export async function authorizePaperOwner(sql: PaperSql, sessionId: string, expectedStudentId?: string) {
  if (!validPaperSession(sessionId)) throw new Error('invalid_input');
  const row = (await sql.all('SELECT student_id FROM ai_conversation_sessions WHERE id=? AND archived_at IS NULL', [sessionId]))[0];
  if (!row) throw new Error('permission_denied');
  const studentId = String(row.student_id || '');
  if (expectedStudentId !== undefined && expectedStudentId !== studentId) throw new Error('permission_denied');
  if (studentId && !(await sql.all("SELECT id FROM students WHERE id=? AND status='active'", [studentId])).length) {
    throw new Error('permission_denied');
  }
  return studentId;
}

export function canonicalBasketJson(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalBasketJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return '{' + Object.keys(record).sort().filter(key => record[key] !== undefined)
      .map(key => JSON.stringify(key) + ':' + canonicalBasketJson(record[key])).join(',') + '}';
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('invalid_input');
  return encoded;
}

function validStoredEntry(value: unknown, v2 = false): value is PaperBasketEntry & {instance?: PaperInstance} {
  if (!plainStudentInput(value, ['entryId', 'questionId', 'contentVersion', 'sectionId', 'position', 'question', 'generation', ...(v2 ? ['instance'] : [])])) return false;
  if (!validBasketEntryId(value.entryId) || typeof value.questionId !== 'string' || !/^question_[a-f0-9-]{36}$/i.test(value.questionId)
    || typeof value.contentVersion !== 'string' || !/^[a-f0-9]{64}$/.test(value.contentVersion)
    || typeof value.sectionId !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(value.sectionId)
    || !Number.isSafeInteger(value.position) || Number(value.position) < 0 || Number(value.position) >= 100
    || !value.question || typeof value.question !== 'object') return false;
  const question = value.question as PaperBasketEntry['question'];
  if (question.id !== value.questionId || questionVersion(question) !== value.contentVersion) return false;
  if (value.generation !== undefined) {
    const generation = value.generation;
    if (!plainStudentInput(generation, ['groupId', 'effectDigest', 'generationKind'])
      || typeof generation.groupId !== 'string' || !/^xiquestion_[a-f0-9-]{36}$/i.test(generation.groupId)
      || typeof generation.effectDigest !== 'string' || !/^[a-f0-9]{64}$/.test(generation.effectDigest)
      || !['variation', 'ai_original'].includes(String(generation.generationKind))) return false;
  }
  if (v2) { try { assertInstance(value as PaperBasketEntry, value.instance as PaperInstance); } catch { return false; } }
  return true;
}

export function parseBasket(row: PaperRow): StoredBasket {
  try {
    const raw = String(row.data_json);
    if (Buffer.byteLength(raw) > MAX_STATE_BYTES) throw new Error();
    const data: unknown = JSON.parse(raw);
    if (!validBasketId(row.id) || !validPaperSession(row.session_id) || typeof row.student_id !== 'string'
      || ![PAPER_BASKET_SCHEMA, PAPER_BASKET_V2_SCHEMA].includes(String(row.schema_version) as typeof PAPER_BASKET_SCHEMA) || !validBasketRevision(Number(row.revision))
      || !['active', 'archived'].includes(String(row.state))
      || !plainStudentInput(data, ['blueprint', 'entries', 'uiState']) || !validPaperBlueprint(data.blueprint)
      || !basketArray(data.entries) || !data.entries.every(entry => validStoredEntry(entry, row.schema_version === PAPER_BASKET_V2_SCHEMA))
      || data.uiState !== undefined && !validBasketUiState(data.uiState)) throw new Error();
    if (new Set(data.entries.map(entry => entry.entryId)).size !== data.entries.length
      || new Set(data.entries.map(entry => entry.questionId)).size !== data.entries.length) throw new Error();
    const positions = new Map<string, number>();
    for (const entry of data.entries) {
      const position = positions.get(entry.sectionId) || 0;
      if (entry.position !== position) throw new Error();
      positions.set(entry.sectionId, position + 1);
    }
    const basketData = data as BasketData;
    return {
      id: String(row.id), sessionId: String(row.session_id), studentId: row.student_id,
      schemaVersion: row.schema_version as StoredBasket['schemaVersion'], revision: Number(row.revision), state: row.state as StoredBasket['state'], title: basketData.blueprint.title,
      count: basketData.entries.length, createdAt: String(row.created_at), updatedAt: String(row.updated_at), data: basketData,
    };
  } catch {
    throw new Error('unavailable');
  }
}

export async function readStoredBasket(sql: PaperSql, sessionId: string, basketId: string, allowV2 = false) {
  const row = (await sql.all('SELECT * FROM paper_baskets WHERE id=? AND session_id=?', [basketId, sessionId]))[0];
  if (!row) throw new Error('permission_denied');
  const basket = parseBasket(row);
  await authorizePaperOwner(sql, sessionId, basket.studentId);
  if (!allowV2 && basket.schemaVersion !== PAPER_BASKET_SCHEMA) throw new Error('conflict');
  return basket;
}

export function basketSummary(basket: StoredBasket): PaperBasketSummary {
  const {id, sessionId, revision, state, title, count, createdAt, updatedAt} = basket;
  return {id, sessionId, revision, state, title, count, createdAt, updatedAt};
}

export function orderedBasketEntries(data: BasketData) {
  const sectionIds = [...data.blueprint.sections.map(section => section.id), ...data.entries.map(entry => entry.sectionId)];
  return [...new Set(sectionIds)].flatMap(sectionId => data.entries.filter(entry => entry.sectionId === sectionId)
    .map((entry, position) => ({...entry, position})));
}

export async function basketBindingCurrent(sql: PaperSql, sessionId: string, studentId: string, blueprint: PaperBlueprint, binding: PaperBasketBinding, items: PaperItem[]) {
  try {
    const basket = await readStoredBasket(sql, sessionId, binding.basketId, true);
    if (basket.studentId !== studentId || basket.state !== 'active' || basket.revision !== binding.basketRevision
      || canonicalBasketJson(basket.data.blueprint) !== canonicalBasketJson(blueprint)) return false;
    const entries = orderedBasketEntries(basket.data);
    return entries.length === items.length && entries.every((entry, index) =>
      entry.entryId === binding.entryIds[index] && entry.entryId === items[index].entryId
      && entry.questionId === items[index].source.questionId && entry.contentVersion === items[index].source.version
      && entry.sectionId === items[index].sectionId
      && canonicalBasketJson(entry.instance || null) === canonicalBasketJson(items[index].instance || null)
      && canonicalBasketJson(entry.generation || null) === canonicalBasketJson(items[index].generation || null));
  } catch {
    return false;
  }
}

export function encodeBasket(data: BasketData) {
  const encoded = JSON.stringify(data);
  if (Buffer.byteLength(encoded) > MAX_STATE_BYTES) throw new Error('invalid_input');
  return encoded;
}

export async function previousBasketOperation(sql: PaperSql, sessionId: string, requestId: string, kind: BasketOperationKind, input: unknown, studentId: string): Promise<BasketReceipt | undefined> {
  const row = (await sql.all('SELECT * FROM paper_basket_operations WHERE session_id=? AND request_id=?', [sessionId, requestId]))[0];
  if (!row) return undefined;
  const legacyKind = kind === 'ui_state' ? 'mutate' : kind;
  if (row.student_id !== studentId || row.operation_kind !== RECEIPT_KINDS[kind] && row.operation_kind !== legacyKind
    || row.input_hash !== basketInputHash(input)) throw new Error('conflict');
  return {basketId: String(row.basket_id), revision: Number(row.result_revision), ...(row.paper_id ? {paperId: String(row.paper_id)} : {})};
}

function basketInputHash(input: unknown) {
  return createHash('sha256').update(canonicalBasketJson(input)).digest('hex');
}

export async function recordBasketOperation(sql: PaperSql, sessionId: string, requestId: string, kind: BasketOperationKind, input: unknown, studentId: string, receipt: BasketReceipt) {
  const scopeKinds = kind === 'ui_state'
    ? [RECEIPT_KINDS.ui_state]
    : [RECEIPT_KINDS.create, RECEIPT_KINDS.mutate, RECEIPT_KINDS.snapshot];
  const placeholders = scopeKinds.map(() => '?').join(',');
  const count = Number((await sql.all(`SELECT COUNT(*) AS count FROM paper_basket_operations
    WHERE session_id=? AND operation_kind IN (${placeholders})`, [sessionId, ...scopeKinds]))[0]?.count || 0);
  // Legacy receipts had a shared 10,000 cap and cannot be classified from their hash.
  // Retain every legacy receipt for retries, outside both new bounded allocations.
  const maximum = kind === 'ui_state' ? MAX_OWNER_UI_OPERATIONS : MAX_OWNER_OPERATIONS;
  if (count >= maximum) throw new Error('unavailable');
  await sql.run(`INSERT INTO paper_basket_operations(session_id,request_id,student_id,operation_kind,input_hash,basket_id,paper_id,result_revision,created_at)
    VALUES(?,?,?,?,?,?,?,?,?)`, [sessionId, requestId, studentId, RECEIPT_KINDS[kind], basketInputHash(input), receipt.basketId, receipt.paperId || null, receipt.revision, new Date().toISOString()]);
}

export async function checkBasketCapacity(sql: PaperSql, sessionId: string) {
  const count = Number((await sql.all('SELECT COUNT(*) AS count FROM paper_baskets WHERE session_id=?', [sessionId]))[0]?.count || 0);
  if (count >= MAX_OWNER_BASKETS) throw new Error('unavailable');
}
