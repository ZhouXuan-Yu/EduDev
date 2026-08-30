import type { TeacherNotebook, TeacherNotebookRecord } from '../../shared/contracts';

export const NOTEBOOK_ANALYSIS_SCHEMA_VERSION = 'omni.notebook.analysis.v1' as const;

type NotebookEntry = TeacherNotebookRecord & { notebookName: string };

export type NotebookAnalysis = {
  schemaVersion: typeof NOTEBOOK_ANALYSIS_SCHEMA_VERSION;
  mode: 'context' | 'record_summary';
  query: string;
  coverage: {
    catalogCount: number;
    selectedCount: number;
    detailCount: number;
    omittedCount: number;
    maxDetailChars: number;
  };
  selection: Array<{
    recordId: string;
    notebookId: string;
    notebookName: string;
    recordType: string;
    title: string;
    summary: string;
    score: number;
    selectedForDetail: boolean;
  }>;
  details: Array<{
    recordId: string;
    notebookId: string;
    notebookName: string;
    recordType: string;
    title: string;
    userQuery: string;
    summary: string;
    outputPreview: string;
    redactionCount: number;
  }>;
  summaryDraft?: {
    recordId: string;
    title: string;
    text: string;
    basis: 'stored_summary' | 'bounded_output_excerpt';
    requiresTeacherReview: true;
  };
  facts: string[];
  unknowns: string[];
  nextActions: string[];
};

const MAX_CATALOG = 200;
const MAX_DETAIL = 5;
const MAX_DETAIL_CHARS = 1_800;
const MAX_SUMMARY_CHARS = 600;

function clean(value: unknown, max: number) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function tokens(value: string) {
  return [...new Set(clean(value, 600).toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter((item) => item.length >= 2))];
}

function scoreEntry(entry: NotebookEntry, queryTokens: string[]) {
  if (!queryTokens.length) return 1;
  const haystack = tokens([entry.title, entry.summary, entry.userQuery, entry.recordType].join(' '));
  const matched = queryTokens.filter((token) => haystack.includes(token)).length;
  return matched * 10 + (entry.summary ? 1 : 0);
}

function fallbackSummary(entry: NotebookEntry) {
  const stored = clean(entry.summary, MAX_SUMMARY_CHARS);
  if (stored) return { text: stored, basis: 'stored_summary' as const };
  const output = clean(entry.output, MAX_SUMMARY_CHARS);
  const sentence = output.split(/[。！？!?\n]/u).find(Boolean) ?? output;
  return { text: clean(sentence, MAX_SUMMARY_CHARS) || '当前记录没有可提取的摘要。', basis: 'bounded_output_excerpt' as const };
}

export async function buildNotebookAnalysis(params: {
  notebooks: TeacherNotebook[];
  records: Array<{ notebook: TeacherNotebook; records: TeacherNotebookRecord[] }>;
  query?: string;
  mode?: 'context' | 'record_summary';
  recordId?: string;
  sanitize?: (text: string) => Promise<{ sanitizedText: string; redactions: Array<{ count: number }> }>;
}): Promise<NotebookAnalysis> {
  const queryInput = clean(params.query, 1_000);
  const sanitizedQuery = params.sanitize ? await params.sanitize(queryInput) : { sanitizedText: queryInput, redactions: [] };
  const query = clean(sanitizedQuery.sanitizedText, 1_000);
  const mode = params.mode === 'record_summary' ? 'record_summary' : 'context';
  const rawEntries: NotebookEntry[] = params.records
    .flatMap(({ notebook, records }) => records.map((record) => ({ ...record, notebookName: notebook.name })))
    .filter((record) => !record.deletedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_CATALOG);
  const entries: NotebookEntry[] = await Promise.all(rawEntries.map(async (entry) => {
    const [notebookName, title, summary, userQuery, output] = await Promise.all([
      params.sanitize ? params.sanitize(entry.notebookName) : Promise.resolve({ sanitizedText: entry.notebookName, redactions: [] }),
      params.sanitize ? params.sanitize(entry.title) : Promise.resolve({ sanitizedText: entry.title, redactions: [] }),
      params.sanitize ? params.sanitize(entry.summary) : Promise.resolve({ sanitizedText: entry.summary, redactions: [] }),
      params.sanitize ? params.sanitize(entry.userQuery) : Promise.resolve({ sanitizedText: entry.userQuery, redactions: [] }),
      params.sanitize ? params.sanitize(entry.output) : Promise.resolve({ sanitizedText: entry.output, redactions: [] }),
    ]);
    return {
      ...entry,
      notebookName: clean(notebookName.sanitizedText, 160),
      title: clean(title.sanitizedText, 240),
      summary: clean(summary.sanitizedText, MAX_SUMMARY_CHARS),
      userQuery: clean(userQuery.sanitizedText, 800),
      output: clean(output.sanitizedText, MAX_DETAIL_CHARS),
    };
  }));
  const queryTokens = tokens(query);
  const ranked = entries
    .map((entry, index) => ({ entry, score: scoreEntry(entry, queryTokens), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = mode === 'record_summary' && params.recordId
    ? ranked.filter(({ entry }) => entry.id === params.recordId).slice(0, 1)
    : ranked.slice(0, MAX_DETAIL);
  const selectedIds = new Set(selected.map(({ entry }) => entry.id));
  const selection = ranked.slice(0, Math.min(MAX_CATALOG, 50)).map(({ entry, score }) => ({
    recordId: entry.id,
    notebookId: entry.notebookId,
    notebookName: clean(entry.notebookName, 160),
    recordType: entry.recordType,
    title: clean(entry.title, 240),
    summary: clean(entry.summary, MAX_SUMMARY_CHARS),
    score,
    selectedForDetail: selectedIds.has(entry.id),
  }));
  const details = [];
  for (const { entry } of selected) {
    const sanitized: { sanitizedText: string; redactions: Array<{ count: number }> } = { sanitizedText: clean(entry.output, MAX_DETAIL_CHARS), redactions: [] };
    details.push({
      recordId: entry.id,
      notebookId: entry.notebookId,
      notebookName: clean(entry.notebookName, 160),
      recordType: entry.recordType,
      title: clean(entry.title, 240),
      userQuery: clean(entry.userQuery, 800),
      summary: clean(entry.summary, MAX_SUMMARY_CHARS),
      outputPreview: clean(sanitized.sanitizedText, MAX_DETAIL_CHARS),
      redactionCount: sanitized.redactions.reduce((sum, item) => sum + Math.max(0, Number(item.count) || 0), 0),
    });
  }
  const summaryEntry = mode === 'record_summary' ? selected[0]?.entry : undefined;
  const summary = summaryEntry ? fallbackSummary(summaryEntry) : undefined;
  const omittedCount = Math.max(0, entries.length - details.length);
  const summaryDraft = summaryEntry && summary
    ? { recordId: summaryEntry.id, title: clean(summaryEntry.title, 240), text: summary.text, basis: summary.basis, requiresTeacherReview: true as const }
    : undefined;
  return {
    schemaVersion: NOTEBOOK_ANALYSIS_SCHEMA_VERSION,
    mode,
    query,
    coverage: { catalogCount: entries.length, selectedCount: selected.length, detailCount: details.length, omittedCount, maxDetailChars: MAX_DETAIL_CHARS },
    selection,
    details,
    ...(summaryDraft ? { summaryDraft } : {}),
    facts: [
      `本轮扫描 ${entries.length} 条未删除备课本记录，按查询相关性选择 ${details.length} 条读取细节。`,
      details.length ? '细节内容已限制长度，并经过本地脱敏后才作为模型上下文。' : '本轮没有读取任何笔记正文。',
      params.notebooks.length ? `当前有 ${params.notebooks.length} 个可用教师备课本。` : '当前没有可用教师备课本。',
    ],
    unknowns: [
      entries.length > details.length ? `还有 ${entries.length - details.length} 条记录只保留目录摘要，未读取正文。` : '',
      !entries.length ? '没有足够笔记内容支持跨记录结论。' : '',
      mode === 'record_summary' && !summaryEntry ? '请求的 recordId 未命中当前可见笔记。' : '',
    ].filter(Boolean),
    nextActions: details.length
      ? ['基于已选笔记回答当前任务，并明确未读取记录范围。', '摘要或改写结果仍需老师确认后保存回备课本。']
      : ['先创建备课本并保存一条记录，再请求按需分析。'],
  };
}
