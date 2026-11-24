import {validWorkbenchQuery, workbenchTaskGroup, type WorkbenchPage, type WorkbenchQuery, type WorkbenchResult, type WorkbenchTaskRow} from '../../shared/xiaozhi-workbench';
import type {Sql} from './session-state';
import {protocolHash} from './capabilities/validation';
import {readWorkbenchApprovals, readWorkbenchApprovalDetail} from './workbench-approvals';
import {readWorkbenchTasks} from './workbench-tasks';
import {readWorkbenchCapabilities, workbenchTaskContext} from './workbench-capabilities';
import {workbenchFailure, workbenchText, type WorkbenchRead} from './workbench-state';
import {xiaozhiToolLabel} from '../../shared/xiaozhi-projection';
import {readWorkbenchHome} from './workbench-home';
import type {TeachingFileCatalogEntry} from '../../shared/contracts';
import {readWorkbenchArtifactLinks} from './workbench-artifact-links';
import {mockExamWorkbenchRows} from '../education/mock-exam-state';
import {readTaskSummaryPage} from './task-summary-read';

type PagedQuery = Exclude<WorkbenchQuery, {kind: 'approval_detail' | 'home' | 'task_artifacts' | 'artifact_tasks'}>;
type Cursor = {v: 1; query: string; key: string; id: string};
function queryHash(query: PagedQuery) {const {cursor: _cursor, ...scope} = query; return protocolHash(scope);}
function cursorFor(query: PagedQuery, key: string, id: string) {
  return Buffer.from(JSON.stringify({v: 1, query: queryHash(query), key, id})).toString('base64url');
}
function readCursor(query: PagedQuery): Cursor | null {
  if (!query.cursor) return null;
  try {
    if (!/^[A-Za-z0-9_-]+$/u.test(query.cursor)) throw Error();
    const value = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8'));
    if (!value || value.v !== 1 || Object.keys(value).sort().join(',') !== 'id,key,query,v'
        || typeof value.id !== 'string' || value.id.length > 1000 || typeof value.key !== 'string' || value.key.length > 100
        || value.query !== queryHash(query)) throw Error();
    return value as Cursor;
  } catch {throw Error('changed');}
}
function page<T>(read: WorkbenchRead, query: PagedQuery, universe: T[], filtered: T[], counts: Record<string, number>, identity: (item: T) => {key: string; id: string}): WorkbenchPage<T> {
  const compare = (left: {key: string; id: string}, right: {key: string; id: string}) =>
    left.key === right.key ? (left.id < right.id ? -1 : left.id === right.id ? 0 : 1) : left.key > right.key ? -1 : 1;
  const cursor = readCursor(query), sorted = filtered.sort((left, right) => compare(identity(left), identity(right)));
  const remaining = cursor ? sorted.filter(item => compare(identity(item), cursor) > 0) : sorted;
  const items = remaining.slice(0, query.limit || 25), last = items[items.length - 1];
  const partial = read.failures.length > 0;
  return {schemaVersion: 1, asOf: read.now, items, total: partial ? null : universe.length,
    matched: partial ? null : filtered.length, counts: partial ? null : counts,
    nextCursor: remaining.length > items.length && last ? cursorFor(query, identity(last).key, identity(last).id) : null,
    partial, unavailableCount: read.unavailable, sourceFailures: read.failures, scanned: universe.length + read.unavailable};
}
function taskMatches(task: WorkbenchTaskRow, filter: Extract<WorkbenchQuery, {kind: 'tasks'}>['filter']) {
  if (filter === 'all') return true;
  if (filter === 'unfinished') return !['completed', 'ended'].includes(task.state);
  if (filter === 'resumable') return task.resumeCandidate || task.continuationCandidate;
  if (filter === 'blocked') return !['completed', 'ended'].includes(task.state)
    && (task.state === 'paused' || task.state === 'interrupted' || task.pendingApprovalCount !== 0 || task.unknownEffectCount !== 0
      || task.blockedReasons.some(reason => ['not_latest', 'goal_controls', 'needs_new_candidate'].includes(reason)));
  return task.state === filter;
}
const overviewGroups = {active: {rank: 3, limit: 5}, attention: {rank: 2, limit: 5}, completed: {rank: 1, limit: 3}} as const;
function recentTasks(items: WorkbenchTaskRow[]) {
  const recent = items.filter(item => item.state !== 'ended')
    .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.taskId.localeCompare(b.taskId));
  return (Object.keys(overviewGroups) as (keyof typeof overviewGroups)[]).flatMap(group =>
    recent.filter(item => workbenchTaskGroup(item.state) === group).slice(0, overviewGroups[group].limit));
}
function stateCounts<T>(items: T[], state: (item: T) => string, initial: string[]) {
  const result: Record<string, number> = Object.fromEntries(initial.map(key => [key, 0]));
  for (const item of items) {const key = state(item); result[key] = (result[key] || 0) + 1;}
  return result;
}
export function createWorkbenchSummary(options: {read: <T>(action: (sql: Sql) => Promise<T>) => Promise<T>;
  indexedTasks?: boolean;
  recentArtifacts?: () => Promise<TeachingFileCatalogEntry[]>}) {
  return async (input: unknown): Promise<WorkbenchResult> => {
    if (!validWorkbenchQuery(input)) return {ok: false, error: 'invalid_input'};
    try {
      const value = await options.read(async sql => {
        if(input.kind==='tasks' && options.indexedTasks)return readTaskSummaryPage(sql,input);
        const tables = new Set((await sql.all("SELECT name FROM sqlite_master WHERE type='table'")).map(row => String(row.name)));
        const read: WorkbenchRead = {sql, now: new Date().toISOString(), tables, sessions: new Map(), failures: [], unavailable: 0};
        const requestedSession = input.kind === 'approval_detail' ? input.ref.sessionId : 'sessionId' in input ? input.sessionId : undefined;
        if (!tables.has('ai_conversation_sessions')) workbenchFailure(read, 'sessions', 'not_initialized', null);
        else {
          for (const row of await sql.all('SELECT id,title FROM ai_conversation_sessions WHERE archived_at IS NULL'
            +(requestedSession?' AND id=?':''),requestedSession?[requestedSession]:[])) {
            if (typeof row.id !== 'string' || !row.id || typeof row.title !== 'string') {workbenchFailure(read, 'sessions', 'corrupt'); continue;}
            read.sessions.set(row.id, {id: row.id, title: workbenchText(row.title)});
          }
        }
        if (input.kind === 'home') {
          const approvals = await readWorkbenchApprovals(read);
          return readWorkbenchHome(read, await readWorkbenchTasks(read, approvals), approvals, options.recentArtifacts);
        }
        if (input.kind === 'task_artifacts' || input.kind === 'artifact_tasks') return readWorkbenchArtifactLinks(read, input);
        if (requestedSession) {
          if (!read.sessions.has(requestedSession)) throw Error('permission_denied');
          read.sessions = new Map([[requestedSession, read.sessions.get(requestedSession)!]]);
        }
        if (input.kind === 'approval_detail') return {schemaVersion: 1 as const, kind: input.kind, asOf: read.now,
          detail: await readWorkbenchApprovalDetail(read, input.ref)};
        if (input.kind === 'tasks') {
          const approvals = await readWorkbenchApprovals(read), all = await readWorkbenchTasks(read, approvals);
          const items = input.taskId ? all.filter(item => item.taskId === input.taskId) : all;
          const overview = input.filter === 'overview';
          return {...page(read, input, items, overview ? recentTasks(items) : items.filter(item => taskMatches(item, input.filter)),
            stateCounts(items, item => item.state, ['active', 'review_required', 'paused', 'interrupted', 'completed', 'ended']),
            item => ({key: overview ? overviewGroups[workbenchTaskGroup(item.state)].rank + ':' + item.updatedAt : item.updatedAt, id: item.taskId})), kind: input.kind};
        }
        if (input.kind === 'approvals') {
          const items = await readWorkbenchApprovals(read), state = input.state || 'pending';
          return {...page(read, input, items, items.filter(item => state === 'all' || item.state === state),
            stateCounts(items, item => item.state, ['pending', 'approved', 'executing', 'executed', 'rejected', 'invalidated', 'uncertain', 'failed', 'interrupted', 'verified']),
            item => ({key: item.updatedAt, id: item.kind + ':' + item.sessionId + ':' + item.id})), kind: input.kind};
        }
        if (input.kind === 'mock_exam_catalogs') {
          const items=await mockExamWorkbenchRows(read.sql,input.sessionId);
          const terms=(input.query||'').trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
          const matches=items.filter(item=>terms.every(term=>item.title.toLocaleLowerCase().includes(term)));
          return {...page(read,input,items,matches,stateCounts(items,item=>item.state,['draft','confirmed']),
            item=>({key:item.updatedAt,id:item.id})),kind:input.kind};
        }
        const context = await workbenchTaskContext(read, input), {items, registryRevision} = await readWorkbenchCapabilities(read, context);
        const search = (input.query || '').trim().toLocaleLowerCase();
        return {...page(read, input, items, items.filter(item => !search || [item.name, item.version, item.source, item.capabilityId, item.providerId,
          item.capabilityId?.startsWith('edu.core.tool.') ? xiaozhiToolLabel(item.name) : null]
          .some(field => field?.toLocaleLowerCase().includes(search))), stateCounts(items, item => item.origin, ['registered', 'candidate', 'installed']),
          item => ({key: item.verifiedAt || '', id: item.id})), kind: input.kind, context, registryRevision};
      });
      return {ok: true, value};
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      return {ok: false, error: code === 'permission_denied' || code === 'changed' ? code : 'unavailable'};
    }
  };
}
