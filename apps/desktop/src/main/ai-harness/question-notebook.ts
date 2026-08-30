import type { QuestionNotebookEntry, QuestionNotebookFilters } from '../../shared/contracts';

export const QUESTION_NOTEBOOK_SCHEMA_VERSION = 'omni.question.notebook.v1' as const;

export type QuestionNotebookAnalysis = {
  schemaVersion: typeof QUESTION_NOTEBOOK_SCHEMA_VERSION;
  filters: {
    query: string;
    categoryId: string;
    bookmarked?: boolean;
    sourceKind: string;
    limit: number;
    offset: number;
  };
  coverage: {
    total: number;
    selected: number;
    hasMore: boolean;
  };
  items: Array<{
    questionId: string;
    subject: string;
    grade: string;
    knowledgePoint: string;
    questionType: string;
    difficulty: string;
    stem: string;
    answer: string;
    analysis: string;
    sourceTitle: string;
    sourceKind: string;
    tags: string[];
    bookmarked: boolean;
    version: number;
    categories: Array<{ id: string; name: string }>;
    usageCount: number;
    lastUsedAt: string;
  }>;
  facts: string[];
  unknowns: string[];
  nextActions: string[];
};

const MAX_TEXT = 1_200;
const MAX_ITEMS = 20;

function clean(value: unknown, max = MAX_TEXT) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export async function buildQuestionNotebookAnalysis(params: {
  result: { items: QuestionNotebookEntry[]; total: number };
  filters?: QuestionNotebookFilters;
  sanitize?: (text: string) => Promise<{ sanitizedText: string }>;
}): Promise<QuestionNotebookAnalysis> {
  const filters = params.filters ?? {};
  const sanitize = async (text: string, max = MAX_TEXT) => {
    const bounded = clean(text, max);
    const result = params.sanitize ? await params.sanitize(bounded) : { sanitizedText: bounded };
    return clean(result.sanitizedText, max);
  };
  const items = await Promise.all(params.result.items.slice(0, MAX_ITEMS).map(async (item) => ({
    questionId: item.id,
    subject: await sanitize(item.subject, 120),
    grade: await sanitize(item.grade, 80),
    knowledgePoint: await sanitize(item.knowledgePoint, 180),
    questionType: await sanitize(item.questionType, 120),
    difficulty: item.difficulty,
    stem: await sanitize(item.stem),
    answer: await sanitize(item.answer),
    analysis: await sanitize(item.analysis),
    sourceTitle: await sanitize(item.sourceTitle, 180),
    sourceKind: item.sourceKind,
    tags: await Promise.all(item.tags.slice(0, 12).map((tag) => sanitize(tag, 80))),
    bookmarked: item.bookmarked,
    version: item.version,
    categories: await Promise.all(item.categories.slice(0, 12).map(async (category) => ({ id: category.id, name: await sanitize(category.name, 100) }))),
    usageCount: item.usageCount,
    lastUsedAt: item.lastUsedAt,
  })));
  const query = await sanitize(filters.query ?? '', 240);
  const limit = Math.max(1, Math.min(Math.trunc(filters.limit ?? 20), MAX_ITEMS));
  const offset = Math.max(0, Math.trunc(filters.offset ?? 0));
  return {
    schemaVersion: QUESTION_NOTEBOOK_SCHEMA_VERSION,
    filters: {
      query,
      categoryId: clean(filters.categoryId, 160),
      ...(filters.bookmarked == null ? {} : { bookmarked: filters.bookmarked }),
      sourceKind: clean(filters.sourceKind, 40),
      limit,
      offset,
    },
    coverage: { total: params.result.total, selected: items.length, hasMore: offset + items.length < params.result.total },
    items,
    facts: [
      `当前题目收藏索引命中 ${params.result.total} 道 canonical 题库题，返回 ${items.length} 道。`,
      '收藏、分类和历史引用是题库之上的轻量索引，题干/答案仍以本地题库为唯一真源。',
      items.some((item) => item.usageCount > 0) ? '部分题目存在题组或其他历史引用。' : '当前返回题目没有可回读的历史引用。',
    ],
    unknowns: [
      params.result.total > items.length ? `还有 ${params.result.total - items.length} 道命中题目未在本页展开。` : '',
      !items.length ? '没有足够的收藏/分类题目支持进一步判断。' : '',
    ].filter(Boolean),
    nextActions: items.length ? ['可继续按分类、收藏状态或知识点筛选。', '如需修改题目收藏或分类，请通过教师操作确认后执行。'] : ['先从现有题库收藏题目或创建分类，再进行检索。'],
  };
}
