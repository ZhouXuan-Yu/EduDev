import {plainStudentInput} from '../../shared/student-context';
import type {PaperView} from '../../shared/paper-blueprint';
import type {PaperRow, PaperSql} from './paper-sql';
import {paperLineageHead} from './paper-edit-lineage';

export type PaperAgentTarget = {paperId: string; digest?: string} | {title: string} | undefined;
export type PaperAgentRead =
  | {kind: 'found'; paper: PaperView}
  | {kind: 'missing' | 'not_confirmed' | 'digest_mismatch'}
  | {kind: 'ambiguous'; choices: {paperId: string; title: string}[]};

export const paperAgentReadProperties = {
  paperId: {type:'string',pattern:'^xipaper_[a-f0-9-]{36}$'},
  digest: {type:'string',pattern:'^[a-f0-9]{64}$'},
  title: {type:'string',minLength:1,maxLength:160},
} as const;

export function parsePaperAgentTarget(raw: unknown): PaperAgentTarget {
  if (!plainStudentInput(raw, ['paperId','digest','title'])) throw Error('invalid_input');
  if (Object.keys(raw).length === 0) return undefined;
  if (raw.paperId !== undefined) {
    if (raw.title !== undefined || typeof raw.paperId !== 'string' ||
        !/^xipaper_[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(raw.paperId) ||
        raw.digest !== undefined && (typeof raw.digest !== 'string' || !/^[a-f0-9]{64}$/u.test(raw.digest))) {
      throw Error('invalid_input');
    }
    return raw.digest === undefined ? {paperId:raw.paperId} : {paperId:raw.paperId,digest:raw.digest};
  }
  if (raw.digest !== undefined || typeof raw.title !== 'string' || !raw.title.trim() ||
      raw.title.length > 160 || /[\x00-\x1f]/u.test(raw.title)) throw Error('invalid_input');
  return {title:raw.title.trim()};
}

/** Sanitize text before JSON encoding so removing a path or name cannot remove
 * JSON syntax. Host-confirmed opaque references remain round-trippable. */
export async function paperAgentResultJson(value:unknown, clean:(text:string)=>Promise<string>):Promise<string> {
  const cleanStrings = new Map<string,Promise<string>>();
  async function visit(item:unknown,key?:string):Promise<unknown> {
    if (typeof item === 'string') {
      if (key === 'paperId' || key === 'digest' || key === 'supersededBy' || key === 'modifiedFrom') return item;
      const existing = cleanStrings.get(item);
      if (existing) return existing;
      const result = clean(item);
      cleanStrings.set(item,result);
      return result;
    }
    if (Array.isArray(item)) return Promise.all(item.map(value => visit(value)));
    if (item && typeof item === 'object') {
      const pairs=await Promise.all(Object.entries(item).map(async ([key,value])=>[key,await visit(value,key)] as const));
      return Object.fromEntries(pairs);
    }
    return item;
  }
  return JSON.stringify(await visit(value));
}

export async function paperConfirmedCandidates(sql:PaperSql, sessionId:string, studentId:string, action:string,
  successors:ReadonlyMap<string,string>, runId:string, taskRuns:readonly string[], title?:string) {
  const rows = await sql.all(
    'SELECT id,title,run_id,status FROM ai_confirmation_items WHERE session_id=? AND student_id=? AND action_type=? ORDER BY rowid DESC',
    [sessionId,studentId,action],
  );
  const byId = new Map(rows.map(row => [String(row.id),row]));
  const currentRun = rows.filter(row => row.run_id === runId);
  const taskScope = new Set(taskRuns);
  const currentTask = rows.filter(row => taskScope.has(String(row.run_id)));
  const normalized = (value: unknown) => String(value).trim().normalize('NFKC');
  const selected = title !== undefined
    ? rows.filter(row => normalized(row.title) === normalized(title))
    : currentRun.length ? currentRun : currentTask.length ? currentTask : rows;
  const candidates = new Map<string, PaperRow>();
  for (const candidate of selected) {
    const root = String(candidate.id);
    const head = paperLineageHead(successors, root);
    const row = byId.get(head);
    if (row?.status === 'confirmed') candidates.set(head,row);
  }
  return {candidates, hasSelected: selected.length > 0};
}
