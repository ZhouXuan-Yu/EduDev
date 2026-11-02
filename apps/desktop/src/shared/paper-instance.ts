import type {PaperGeneration} from './paper-blueprint';
import {plainStudentInput} from './student-context';
import {basketArray, validBasketEntryId, validBasketRevision} from './paper-basket';

export const PAPER_INSTANCE_SCHEMA = 'xiaozhi.paper-instance.v1' as const;
export const PAPER_INSTANCE_CONTENT_BYTES = 128 * 1024;
export type PaperInstanceRole = 'question' | 'answer' | 'analysis';
export type PaperInstanceBlock =
  | {type: 'text'; text: string}
  | {type: 'formula'; latex: string}
  | {type: 'table'; rows: string[][]}
  | {type: 'options'; items: {label: string; text: string}[]}
  | {type: 'subquestions'; items: {label: string; text: string}[]}
  | {type: 'sourceImage'; role: PaperInstanceRole; blockId: string; sourceVersion: string};
export type PaperInstanceRoleContent = {mode: 'source'} | {mode: 'edited'; blocks: PaperInstanceBlock[]};
export type PaperInstanceContent = Record<PaperInstanceRole, PaperInstanceRoleContent>;
export type PaperInstanceSourceBinding = {questionId: string; sourceVersion: string; generation?: PaperGeneration};
export type PaperInstanceReview = {
  eventId: string; action: 'confirm' | 'reject'; instanceRevision: number; contentDigest: string;
  sourceBinding: PaperInstanceSourceBinding; reviewedAt: string;
};
export type PaperInstance = {
  schemaVersion: typeof PAPER_INSTANCE_SCHEMA; entryId: string; instanceRevision: number; contentDigest: string;
  sourceBinding: PaperInstanceSourceBinding; content: PaperInstanceContent; review?: PaperInstanceReview;
};
export const sourcePaperInstanceContent = (): PaperInstanceContent => ({question: {mode: 'source'}, answer: {mode: 'source'}, analysis: {mode: 'source'}});
export const validInstanceDigest = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
// A conjunction between two comparisons is prose, even when its <...>
// fragment resembles a tag. Other markup retains the original rejection rule.
function hasHtmlMarkup(value: string): boolean {
  for (const match of value.matchAll(/<\/?[a-z][a-z0-9-]*(?:\s[^<>]*|\s*\/?)>|<!--|<!DOCTYPE/gi)) {
    const comparison = /^<[a-z][0-9]*\s+(?:且|并且|或|and|or)\s+[a-z0-9_{}()[\].+*/^\\ -]+>$/i.test(match[0])
      && /[\p{L}\p{N}_)\]}]\s*$/u.test(value.slice(0, match.index))
      && /^\s*[-+]?[\p{L}\p{N}({\\]/u.test(value.slice(match.index! + match[0].length));
    if (!comparison) return true;
  }
  return false;
}
const safeText = (v: unknown): v is string => typeof v === 'string' && v.length <= 32768
  && !hasHtmlMarkup(v)
  && !/[\x00-\x08\x0b\x0c\x0e-\x1f]|(?:https?|file|data|javascript):|[a-z]:[\\/]|\\\\/i.test(v);
const label = (v: unknown) => typeof v === 'string' && /^[\p{L}\p{N}()（）.、-]{1,24}$/u.test(v);
function validBlock(v: unknown): v is PaperInstanceBlock {
  if (!plainStudentInput(v, ['type','text','latex','rows','items','role','blockId','sourceVersion'])) return false;
  switch (v.type) {
    case 'text': return plainStudentInput(v, ['type','text']) && safeText(v.text) && !!v.text.trim();
    case 'formula': return plainStudentInput(v, ['type','latex']) && safeText(v.latex) && !!v.latex.trim() && !/\\(?:href|url|includegraphics|input|include|html)/i.test(v.latex);
    case 'table': return plainStudentInput(v, ['type','rows']) && basketArray(v.rows, 50) && v.rows.length > 0
      && v.rows.every(row => basketArray(row, 20) && row.length > 0 && row.every(safeText))
      && v.rows.every(row => (row as string[]).length === (v.rows as string[][])[0].length);
    case 'options': case 'subquestions': return plainStudentInput(v, ['type','items']) && basketArray(v.items, 30) && v.items.length > 0
      && v.items.every(item => plainStudentInput(item, ['label','text']) && label(item.label) && safeText(item.text) && !!item.text.trim())
      && new Set(v.items.map(item => (item as {label:string}).label)).size === v.items.length;
    case 'sourceImage': return plainStudentInput(v, ['type','role','blockId','sourceVersion'])
      && typeof v.role === 'string' && ['question','answer','analysis'].includes(v.role) && typeof v.blockId === 'string'
      && /^[a-zA-Z0-9_-]{1,120}$/.test(v.blockId) && validInstanceDigest(v.sourceVersion);
    default: return false;
  }
}
function safeContentTree(v: unknown, seen = new Set<object>(), budget = {nodes: 0}, depth = 0): boolean {
  if (++budget.nodes > 12000 || depth > 12) return false;
  if (typeof v === 'string') return v.length <= 32768;
  if (v === null || typeof v === 'number' || typeof v === 'boolean') return true;
  if (!v || typeof v !== 'object' || seen.has(v)) return false;
  const array = Array.isArray(v), prototype = Object.getPrototypeOf(v);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false;
  const descriptors = Object.getOwnPropertyDescriptors(v), keys = Reflect.ownKeys(descriptors);
  if (array && (v.length > 200 || keys.length !== v.length + 1)) return false;
  seen.add(v);
  for (const key of keys) {
    if (array && key === 'length') continue;
    if (typeof key !== 'string') return false;
    const d = descriptors[key];
    if (!('value' in d) || !d.enumerable || !safeContentTree(d.value, seen, budget, depth + 1)) return false;
  }
  seen.delete(v); return true;
}
export function validPaperInstanceContent(v: unknown): v is PaperInstanceContent {
  if (!safeContentTree(v) || !plainStudentInput(v, ['question','answer','analysis'])) return false;
  for (const key of ['question','answer','analysis']) {
    const role = v[key];
    if (!plainStudentInput(role, ['mode','blocks'])) return false;
    if (role.mode === 'source') { if (!plainStudentInput(role, ['mode'])) return false; }
    else if (role.mode !== 'edited' || !basketArray(role.blocks, 200) || !role.blocks.length || !role.blocks.every(validBlock)) return false;
  }
  return new TextEncoder().encode(JSON.stringify(v)).length <= PAPER_INSTANCE_CONTENT_BYTES;
}
export function validPaperInstance(v: unknown): v is PaperInstance {
  if (!plainStudentInput(v, ['schemaVersion','entryId','instanceRevision','contentDigest','sourceBinding','content','review'])
    || v.schemaVersion !== PAPER_INSTANCE_SCHEMA || !validBasketEntryId(v.entryId) || !validBasketRevision(v.instanceRevision)
    || !validInstanceDigest(v.contentDigest) || !validPaperInstanceContent(v.content)) return false;
  const binding = v.sourceBinding;
  if (!plainStudentInput(binding, ['questionId','sourceVersion','generation']) || typeof binding.questionId !== 'string'
    || !/^question_[a-f0-9-]{36}$/i.test(binding.questionId) || !validInstanceDigest(binding.sourceVersion)) return false;
  if (binding.generation !== undefined && (!plainStudentInput(binding.generation, ['groupId','effectDigest','generationKind'])
    || typeof binding.generation.groupId !== 'string' || !/^xiquestion_[a-f0-9-]{36}$/i.test(binding.generation.groupId)
    || !validInstanceDigest(binding.generation.effectDigest) || (typeof binding.generation.generationKind !== 'string' || !['ai_original','variation'].includes(binding.generation.generationKind)))) return false;
  const r = v.review;
  return r === undefined || plainStudentInput(r, ['eventId','action','instanceRevision','contentDigest','sourceBinding','reviewedAt'])
    && typeof r.eventId === 'string' && /^xireview_[a-f0-9-]{36}$/i.test(r.eventId) && typeof r.action === 'string' && ['confirm','reject'].includes(r.action)
    && r.instanceRevision === v.instanceRevision && r.contentDigest === v.contentDigest && JSON.stringify(r.sourceBinding) === JSON.stringify(binding)
    && typeof r.reviewedAt === 'string' && Number.isFinite(Date.parse(r.reviewedAt));
}
