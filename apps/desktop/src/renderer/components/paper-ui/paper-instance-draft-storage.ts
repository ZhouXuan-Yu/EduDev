import type {PaperInstanceContent, PaperInstanceBlock} from '../../../shared/paper-instance';
import {validInstanceDigest} from '../../../shared/paper-instance';
import {validBasketEntryId, validBasketRevision} from '../../../shared/paper-basket';
export type InstanceDraft = {entryId: string; baseRevision: number; baseDigest: string; content: PaperInstanceContent};
export type InstanceDrafts = Record<string, InstanceDraft>;
export const instanceDraftKey = (dataRoot: string, sessionId: string, basketId: string) =>
  `xiaozhi.ui.paper-instance-input.v1:${encodeURIComponent(dataRoot)}:${sessionId}:${basketId}`;
const limit = 2 * 1024 * 1024;

/** Invalid teacher input (empty cells/text/duplicate labels) must remain recoverable, not be silently dropped. */
function draftContent(value: unknown): value is PaperInstanceContent {
  if (!value || typeof value !== 'object' || Object.keys(value).sort().join(',') !== 'analysis,answer,question') return false;
  const safeString = (v: unknown) => typeof v === 'string' && v.length <= 32768;
  const block = (b: PaperInstanceBlock): boolean => {
    if (!b || typeof b !== 'object') return false;
    if (b.type === 'text') return safeString(b.text);
    if (b.type === 'formula') return safeString(b.latex);
    if (b.type === 'sourceImage') return ['question', 'answer', 'analysis'].includes(b.role) && safeString(b.blockId) && validInstanceDigest(b.sourceVersion);
    if (b.type === 'table') return Array.isArray(b.rows) && b.rows.length <= 50 && b.rows.every(row => Array.isArray(row) && row.length <= 20 && row.every(safeString));
    return (b.type === 'options' || b.type === 'subquestions') && Array.isArray(b.items) && b.items.length <= 30 && b.items.every(item => item && safeString(item.label) && safeString(item.text));
  };
  return Object.values(value).every(role => role && (role.mode === 'source' && Object.keys(role).length === 1 ||
    role.mode === 'edited' && Array.isArray(role.blocks) && role.blocks.length <= 200 && role.blocks.every(block)));
}
export function readInstanceDrafts(key: string): {drafts: InstanceDrafts; error: string} {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {drafts: {}, error: ''};
    if (raw.length > limit) throw Error();
    const envelope = JSON.parse(raw);
    if (envelope?.schema !== 1 || !Array.isArray(envelope.drafts) || envelope.drafts.length > 100) throw Error();
    const drafts: InstanceDrafts = {};
    for (const draft of envelope.drafts) {
      if (!draft || Object.keys(draft).sort().join(',') !== 'baseDigest,baseRevision,content,entryId' || !validBasketEntryId(draft.entryId) || !validBasketRevision(draft.baseRevision) ||
        !validInstanceDigest(draft.baseDigest) || !draftContent(draft.content) || drafts[draft.entryId]) throw Error();
      drafts[draft.entryId] = draft;
    }
    return {drafts, error: ''};
  } catch {return {drafts: {}, error: '本机未保存输入的恢复记录不可读取，未将它当作已保存题目；原记录保留。'};}
}
export function writeInstanceDrafts(key: string, drafts: InstanceDrafts): boolean {
  try {
    if (!Object.keys(drafts).length) {localStorage.removeItem(key); return localStorage.getItem(key) === null;}
    const text = JSON.stringify({schema: 1, drafts: Object.values(drafts)});
    if (text.length > limit) return false;
    localStorage.setItem(key, text);
    return localStorage.getItem(key) === text;
  } catch {return false;}
}
