import type { TeachingBookDetail } from '../../shared/contracts';

export const TEACHING_BOOK_SCHEMA_VERSION = 'omni.teaching.book.v1' as const;

function clean(value: unknown, max = 400) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function buildTeachingBookInspection(detail: TeachingBookDetail | undefined, query = '') {
  if (!detail) return { schemaVersion: TEACHING_BOOK_SCHEMA_VERSION, ok: false, reason: 'book_not_found', query: clean(query, 240), coverage: { chapterCount: 0, pageCount: 0, selectedPages: 0, blockCount: 0, sourceCount: 0 }, health: { status: 'missing_sources', staleSourceRefs: [], missingSourceRefs: [], stalePageIds: [], staleBlockIds: [] }, facts: [], unknowns: ['未找到指定讲义或讲义已归档。'], nextActions: ['请先创建专题讲义/单元备课包，再查询其状态。'] };
  const { book, chapters, pages, blocks, sources, health } = detail;
  const selectedPages = pages.filter((page) => !query || `${page.title} ${page.id}`.toLowerCase().includes(query.toLowerCase())).slice(0, 20);
  return {
    schemaVersion: TEACHING_BOOK_SCHEMA_VERSION,
    ok: true,
    book: { id: book.id, title: clean(book.title, 200), description: clean(book.description, 600), status: book.status, language: book.language, targetLevel: clean(book.targetLevel, 80), version: book.version },
    coverage: { chapterCount: chapters.length, pageCount: pages.length, selectedPages: selectedPages.length, blockCount: blocks.length, sourceCount: sources.length },
    chapters: chapters.slice(0, 30).map((chapter) => ({ id: chapter.id, title: clean(chapter.title, 200), order: chapter.order, contentType: chapter.contentType, pageCount: pages.filter((page) => page.chapterId === chapter.id).length, learningObjectives: chapter.learningObjectives.slice(0, 8).map((item) => clean(item, 160)) })),
    pages: selectedPages.map((page) => ({ id: page.id, chapterId: page.chapterId, title: clean(page.title, 200), status: page.status, version: page.version, blockCount: page.blockCount, error: clean(page.error, 240) })),
    blocks: blocks.filter((block) => selectedPages.some((page) => page.id === block.pageId)).slice(0, 60).map((block) => ({ id: block.id, pageId: block.pageId, type: block.type, status: block.status, title: clean(block.title, 160), version: block.version, sourceRefs: block.sourceAnchors.slice(0, 12).map((source) => source.ref), error: clean(block.error, 180) })),
    sources: sources.slice(0, 40).map((source) => ({ kind: source.kind, ref: source.ref, title: clean(source.title, 200), status: source.status, fingerprint: clean(source.fingerprint, 160) })),
    health: { status: health.status, staleSourceRefs: health.staleSourceRefs.slice(0, 40), missingSourceRefs: health.missingSourceRefs.slice(0, 40), stalePageIds: health.stalePageIds.slice(0, 40), staleBlockIds: health.staleBlockIds.slice(0, 60) },
    facts: [
      `讲义“${clean(book.title, 120)}”当前为 ${book.status}，包含 ${chapters.length} 个章节、${pages.length} 个页面和 ${blocks.length} 个内容块。`,
      health.status === 'healthy' ? '已登记来源未发现漂移或缺失。' : `来源健康状态为 ${health.status}，只标记受影响页面/内容块，不盲目重生成整本讲义。`,
      '内容块保留 sourceRefs；正文仍由本地讲义工作区和知识资源作为真源。',
    ],
    unknowns: [
      health.missingSourceRefs.length ? '部分来源已删除或不可回读，不能据此断言内容仍然准确。' : '',
      health.staleSourceRefs.length ? '部分来源指纹发生变化，需要老师确认后再重生成受影响内容块。' : '',
    ].filter(Boolean),
    nextActions: health.status === 'healthy' ? ['可按页面或内容块继续编排、预览或导出。'] : ['先核对受影响来源，再按页面/内容块粒度重生成；不要整本盲目重建。'],
  };
}
