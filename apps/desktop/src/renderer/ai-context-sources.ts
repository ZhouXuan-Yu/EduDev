import type { AiConsoleRunResult, Attachment, KnowledgeOverview, LearningRecord, Student } from '../shared/contracts';
import type { SourceInfo } from './heroui-pro/components/context-indicator';

export type AiContextSourceInput = {
  activeStudent?: Student;
  records: readonly LearningRecord[];
  attachments: readonly Attachment[];
  knowledgeOverview: Pick<KnowledgeOverview, 'counts'>;
  aiResult?: AiConsoleRunResult | null;
};

export function buildAiContextSources(input: AiContextSourceInput): SourceInfo[] {
  const { activeStudent, records, attachments, knowledgeOverview, aiResult } = input;
  const knowledgeSnippetCount = aiResult?.knowledgeSnippets?.length;
  const graphNodeCount = aiResult?.graphNodes?.length;
  return [
    {
      count: activeStudent?.displayName ?? '未选',
      title: '学生档案',
      source: 'SQLite',
      detail: activeStudent
        ? '阶段目标、当前问题、家长关注点和标签已纳入上下文。'
        : '请选择学生后纳入档案上下文。',
    },
    {
      count: records.length,
      title: '学习记录',
      source: 'SQLite',
      detail: '最近记录已按发生时间倒序纳入上下文。',
    },
    {
      count: attachments.length,
      title: '附件元数据',
      source: '本地文件系统',
      detail: '只纳入文件数量和元数据，不读取或上传原始附件。',
    },
    {
      count: knowledgeSnippetCount ?? knowledgeOverview.counts.chunks,
      title: '老师知识库',
      source: 'SQLite / 本地切片',
      detail: knowledgeSnippetCount
        ? '已纳入命中的知识库文本片段。'
        : '当前没有命中可用知识库文本片段。',
    },
    {
      count: graphNodeCount ?? knowledgeOverview.counts.nodes,
      title: '知识图谱',
      source: 'SQLite nodes / edges',
      detail: graphNodeCount ? '已纳入命中的知识图谱节点。' : '当前没有命中可用知识图谱节点。',
    },
  ];
}
