import type { AiMemorySurface, AiMemoryL3Slot } from './contracts';
import type { HistorySelection } from './xiaozhi-history-memory';
import type { PersonalMemorySelection } from './xiaozhi-personal-memory';

export const XIAOZHI_MEMORY_SURFACES: AiMemorySurface[] = ['chat', 'notebook', 'quiz', 'kb', 'book', 'partner', 'cowriter'];
export const XIAOZHI_MEMORY_SLOTS: AiMemoryL3Slot[] = ['recent', 'profile', 'scope', 'preferences'];
export const XIAOZHI_MEMORY_LABELS: Record<AiMemorySurface | AiMemoryL3Slot, string> = {
  chat: '对话摘要', notebook: '教学笔记', quiz: '练习摘要', kb: '知识资料', book: '教研书册',
  partner: '教研协作', cowriter: '教学写作', recent: '近期工作', profile: '教学背景', scope: '工作范围', preferences: '工作偏好',
};
export type XiaozhiMemorySource = { layer: 'L2'; source: AiMemorySurface } | { layer: 'L3'; source: AiMemoryL3Slot };
export const projectMemorySource = (item: XiaozhiMemorySource): XiaozhiMemorySource => item.layer === 'L2'
  ? { layer: 'L2', source: item.source } : { layer: 'L3', source: item.source };
export type XiaozhiMemorySelection = XiaozhiMemorySource & { id: string; version: number };
export type XiaozhiMemoryUseSelection = XiaozhiMemorySelection | HistorySelection | PersonalMemorySelection;
export type MemoryTeachingTarget = { folderId: string; term: string };
export function validTeachingTarget(value: unknown): value is MemoryTeachingTarget {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const target = value as Partial<MemoryTeachingTarget>;
  return Object.keys(value).length === 2 && typeof target.folderId === 'string'
    && /^aifolder_[0-9a-f-]{36}$/i.test(target.folderId) && typeof target.term === 'string'
    && /^20[0-9]{2}-(spring|fall)$/.test(target.term);
}
export type XiaozhiMemoryScopeInput = { sessionId: string; version: number; enabled: boolean; teachingTarget?: MemoryTeachingTarget | null; selections: XiaozhiMemoryUseSelection[] };
export type XiaozhiMemoryCatalogInput = { sessionId: string; offset: number } & XiaozhiMemorySource;
export type XiaozhiMemorySelectionState = 'ready' | 'changed' | 'disabled' | 'missing' | 'unavailable';
export type XiaozhiMemoryScope = { receivedReferences?:Array<{id:string;version:number;estimatedTokens:number;reason:string}>;
  teachingTarget?: MemoryTeachingTarget; currentFolderId?: string; version: number; enabled: boolean; modelAccess: 'unavailable' | 'available';
  selections: Array<XiaozhiMemoryUseSelection & { state: XiaozhiMemorySelectionState; label: string }> };
export type XiaozhiMemoryPreview = XiaozhiMemorySelection & { text: string; sanitizedText: string;
  section: string; status: 'active' | 'disabled' | 'deleted';
  provenance: 'event_refs' | 'surface_only' | 'none'; refs: Array<{ kind: 'run' | 'event'; id: string; label: string }>;
  sourceDocuments: AiMemorySurface[]; referenceCount: number };
export type XiaozhiMemoryCatalog = XiaozhiMemorySource & { offset: number; total: number; hasMore: boolean; entries: XiaozhiMemoryPreview[] };
export type XiaozhiMemoryTrace = { runId: string; status: string; events: Array<{ sequence: number; label: string; status: string; tool: string }> };
export type XiaozhiMemoryCatalogResult = { ok: true; catalog: XiaozhiMemoryCatalog } | { ok: false; error: 'invalid_input' | 'permission_denied' | 'configuration' };
