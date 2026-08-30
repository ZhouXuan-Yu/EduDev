import type { ResourceChunk, TeachingBookDetail } from '../../shared/contracts';

export const TEACHING_BOOK_PLAN_SCHEMA_VERSION = 'omni.teaching.book.plan.v1' as const;

function clean(value: unknown, max = 240) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function buildTeachingBookPlan(detail: TeachingBookDetail, chunks: ResourceChunk[], request = '') {
  const seedTitles = chunks.map((chunk) => clean(chunk.knowledgePoint || chunk.heading || chunk.resourceTitle, 120)).filter(Boolean);
  const uniqueTitles = [...new Set(seedTitles)];
  const fallbackTitles = ['学习目标与范围', '核心概念', '方法与例题', '常见错误与辨析', '练习与迁移', '总结与检查'];
  const chapterTitles = (uniqueTitles.length ? uniqueTitles : fallbackTitles).slice(0, 8);
  const sourceRefs = chunks.slice(0, 12).map((chunk) => ({ kind: 'knowledge_chunk', ref: chunk.id, title: clean(chunk.resourceTitle, 180), snippet: clean(chunk.heading || chunk.contentMd, 360), fingerprint: chunk.createdAt, status: 'available' as const }));
  const chapters = chapterTitles.map((title, index) => ({
    id: `plan_chapter_${index + 1}`,
    title,
    order: index,
    rationale: index === 0 ? '先锁定学习目标和范围，避免章节堆砌。' : index === chapterTitles.length - 1 ? '以检查点和迁移任务收束，便于教师验收。' : '由来源命中的概念/主题生成，需教师确认顺序。',
    pages: [
      { id: `plan_page_${index + 1}_1`, title: `${title}：核心讲解`, blockTypes: ['text', 'callout'] },
      { id: `plan_page_${index + 1}_2`, title: `${title}：练习与检查`, blockTypes: ['quiz', 'card'] },
    ],
    sourceRefs: sourceRefs.slice(index % Math.max(1, sourceRefs.length), (index % Math.max(1, sourceRefs.length)) + 3).map((source) => source.ref),
  }));
  return {
    schemaVersion: TEACHING_BOOK_PLAN_SCHEMA_VERSION,
    ok: true,
    bookId: detail.book.id,
    title: clean(detail.book.title, 200),
    request: clean(request, 240),
    queries: [clean(detail.book.title, 160), clean(detail.book.description, 180)].filter(Boolean),
    coverage: { sourceChunks: chunks.length, selectedSources: sourceRefs.length, proposedChapters: chapters.length },
    chapters,
    sources: sourceRefs,
    facts: [
      `已用 ${sourceRefs.length} 条本地知识片段的标题/主题生成 ${chapters.length} 个章节候选。`,
      '章节顺序、页标题和 block 类型是 draft，不自动写入讲义或替换教师已有结构。',
      '来源只保存 chunk 引用和 bounded 摘要，正文仍由现有知识库真源提供。',
    ],
    unknowns: [
      sourceRefs.length ? '章节是否覆盖全部教学目标仍需教师确认。' : '当前没有知识库命中，章节候选只来自安全 fallback 模板。',
      '没有执行 LLM spine synthesis；复杂跨学科依赖需要后续教师调整。',
    ],
    nextActions: ['确认章节顺序与学习目标后，再创建真实 chapter/page shells。', '对来源发生漂移的内容块按 page/block 粒度重生成。'],
  };
}
