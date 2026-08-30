import type { ResourceChunk } from '../../shared/contracts';

export type ResearchOutlineResult = {
  schemaVersion: 'omni.research.outline.v1';
  query: string;
  title: string;
  outline: Array<{ id: string; heading: string; focus: string; sourceRefs: string[] }>;
  sourceRefs: Array<{ id: string; title: string; heading: string; evidenceStrength: string; pageNumber: number | null }>;
  unknowns: string[];
  evidenceBoundary: 'local_teacher_knowledge_only';
  requiresTeacherReview: true;
  writesFile: false;
};

function clean(value: string, max: number) {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function buildResearchOutline(query: string, chunks: ResourceChunk[], limit = 6): ResearchOutlineResult {
  const boundedQuery = clean(query, 240) || '未指定研究主题';
  const bounded = chunks.filter((chunk) => !chunk.containsPersonalData).slice(0, Math.max(1, Math.min(8, Math.trunc(limit))));
  const sourceRefs = bounded.map((chunk) => ({
    id: chunk.id,
    title: clean(chunk.resourceTitle, 120),
    heading: clean(chunk.heading || chunk.knowledgePoint || '未命名片段', 120),
    evidenceStrength: chunk.evidenceStrength,
    pageNumber: chunk.pageNumber,
  }));
  const outline = bounded.slice(0, 6).map((chunk, index) => ({
    id: `section-${index + 1}`,
    heading: clean(chunk.heading || chunk.knowledgePoint || `证据主题 ${index + 1}`, 100),
    focus: clean(chunk.contentMd, 360) || '待教师补充该主题的核心论点与范围。',
    sourceRefs: [chunk.id],
  }));
  const unknowns = unique([
    ...(bounded.length ? [] : ['本地教师知识库没有命中与该主题相关的安全切片。']),
    ...(bounded.some((chunk) => chunk.evidenceStrength !== 'direct') ? ['部分来源不是直接证据，需教师核对原文与适用范围。'] : []),
    '未联网检索外部文献，作者、发表时间、方法与反例尚未核验。',
  ]).slice(0, 4);
  return {
    schemaVersion: 'omni.research.outline.v1',
    query: boundedQuery,
    title: `${boundedQuery}：研究提纲（本地证据草案）`,
    outline,
    sourceRefs,
    unknowns,
    evidenceBoundary: 'local_teacher_knowledge_only',
    requiresTeacherReview: true,
    writesFile: false,
  };
}
