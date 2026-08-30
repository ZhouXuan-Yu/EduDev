import type { TeachingBookBlock, TeachingBookDetail } from '../../shared/contracts';

export const TEACHING_BOOK_MARKDOWN_SCHEMA_VERSION = 'omni.teaching.book.markdown.v1' as const;
const MAX_MARKDOWN = 18_000;

function text(value: unknown, max = 2_000) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function safeText(value: unknown, max = 2_000) {
  return text(value, max)
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
    .replace(/https?:\/\//gi, '')
    .replace(/[<>]/g, (character) => character === '<' ? '&lt;' : '&gt;');
}

function fence(value: unknown, language = '') {
  const body = text(value, 6_000).replace(/```/g, '``\\`');
  return body ? `\n\n\`\`\`${language}\n${body}\n\`\`\`` : '';
}

function renderBlock(block: TeachingBookBlock): { markdown: string; fallback: boolean } {
  if (block.status === 'hidden') return { markdown: '', fallback: false };
  if (block.status === 'pending' || block.status === 'generating') return { markdown: `\n> 内容块“${text(block.title, 160)}”正在生成，当前仅展示占位。\n`, fallback: true };
  if (block.status === 'error') return { markdown: `\n> ⚠️ 内容块“${text(block.title, 160)}”生成失败：${text(block.error, 400) || '未知错误'}\n`, fallback: true };
  const payload = block.payload ?? {};
  switch (block.type) {
    case 'text':
    case 'chapter':
    case 'section':
      return { markdown: text(payload.body ?? payload.markdown ?? payload.content ?? payload.text ?? ''), fallback: false };
    case 'callout':
      return { markdown: `> **${text(payload.title ?? block.title ?? '提示', 160)}**\n> ${text(payload.body ?? payload.content, 2_000).replace(/\n/g, '\n> ')}`, fallback: false };
    case 'quiz': {
      const questions = Array.isArray(payload.questions) ? payload.questions.slice(0, 12) : [];
      if (!questions.length) return { markdown: `> **${text(block.title || '随堂小测', 160)}**\n> 暂无题目。`, fallback: true };
      const lines = questions.map((raw, index) => {
        const q = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        const options = q.options && typeof q.options === 'object' ? Object.entries(q.options as Record<string, unknown>).slice(0, 8).map(([key, value]) => `   - ${text(key, 20)}. ${text(value, 500)}`).join('\n') : '';
        const answer = text(q.correct_answer ?? q.answer, 300);
        const explanation = text(q.explanation, 800);
        return `${index + 1}. ${text(q.question ?? q.stem, 1_200)}${options ? `\n${options}` : ''}${answer ? `\n   - 答案：${answer}` : ''}${explanation ? `\n   - 解析：${explanation}` : ''}`;
      });
      return { markdown: `### ${text(block.title || '随堂小测', 160)}\n\n${lines.join('\n\n')}`, fallback: false };
    }
    case 'card': {
      const cards = Array.isArray(payload.cards) ? payload.cards.slice(0, 20) : [];
      return { markdown: `### ${text(block.title || '闪卡', 160)}\n\n${cards.map((raw, index) => { const card = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {}; return `**${index + 1}. ${text(card.front, 500)}**\n\n${text(card.back, 800)}${card.hint ? `\n\n> 提示：${text(card.hint, 300)}` : ''}`; }).join('\n\n---\n\n') || '> 暂无闪卡。'}`, fallback: cards.length === 0 };
    }
    case 'figure': {
      const code = payload.code && typeof payload.code === 'object' ? payload.code as Record<string, unknown> : {};
      const language = text(code.language ?? payload.render_type ?? 'text', 40).replace(/[^a-zA-Z0-9_-]/g, '');
      return { markdown: `${text(payload.description ?? block.title, 600)}${fence(code.content, language)}`, fallback: !text(code.content) };
    }
    case 'concept_graph': {
      const code = payload.code && typeof payload.code === 'object' ? payload.code as Record<string, unknown> : {};
      const graph = payload.graph && typeof payload.graph === 'object' ? payload.graph as Record<string, unknown> : {};
      const nodes = Array.isArray(graph.nodes) ? graph.nodes.slice(0, 40) : [];
      const edges = Array.isArray(graph.edges) ? graph.edges.slice(0, 60) : [];
      const graphSummary = `${nodes.length} 个概念，${edges.length} 条关系。`;
      return { markdown: `### ${text(block.title || '概念图', 160)}\n\n${graphSummary}${fence(code.content, 'mermaid')}`, fallback: !nodes.length && !text(code.content) };
    }
    case 'timeline': {
      const events = Array.isArray(payload.events) ? payload.events.slice(0, 20) : [];
      if (!events.length) return { markdown: `### ${safeText(block.title || '时间线', 160)}\n\n> 暂无可用时间线事件。`, fallback: true };
      const lines = events.map((raw, index) => {
        const event = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        const date = safeText(event.date ?? event.year ?? '', 60);
        const title = safeText(event.title ?? event.name ?? `事件 ${index + 1}`, 180);
        const body = safeText(event.body ?? event.description ?? event.content ?? '', 500);
        return `- **${date ? `${date} · ` : ''}${title}**${body ? `：${body}` : ''}`;
      });
      return { markdown: `### ${safeText(block.title || '时间线', 160)}\n\n${lines.join('\n')}`, fallback: false };
    }
    case 'code': {
      const code = payload.code && typeof payload.code === 'object' ? payload.code as Record<string, unknown> : payload;
      const language = text(code.language ?? payload.language ?? 'text', 40).replace(/[^a-zA-Z0-9_+#.-]/g, '') || 'text';
      const body = safeText(code.content ?? code.body ?? payload.content ?? '', 6_000);
      if (!body) return { markdown: `### ${safeText(block.title || '代码示例', 160)}\n\n> 暂无代码内容。`, fallback: true };
      return { markdown: `### ${safeText(block.title || '代码示例', 160)}${fence(body, language)}\n\n> 代码仅供阅读和教师复核，讲义渲染器不会执行。`, fallback: false };
    }
    case 'deep_explanation': {
      const sections = Array.isArray(payload.sections) ? payload.sections.slice(0, 8) : [];
      const claim = safeText(payload.claim ?? payload.summary ?? '', 900);
      const intro = claim ? `> **核心结论**：${claim}` : '';
      if (!sections.length && !intro) return { markdown: `### ${safeText(block.title || '深入讲解', 160)}\n\n> 暂无可用讲解内容。`, fallback: true };
      const rendered = sections.map((raw, index) => {
        const section = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
        const heading = safeText(section.heading ?? section.title ?? `步骤 ${index + 1}`, 180);
        const body = safeText(section.body ?? section.explanation ?? section.content ?? '', 900);
        const evidence = safeText(section.evidence ?? section.check ?? '', 500);
        return `#### ${heading}\n\n${body || '> 待教师补充。'}${evidence ? `\n\n> **核验**：${evidence}` : ''}`;
      }).join('\n\n');
      return { markdown: `### ${safeText(block.title || '深入讲解', 160)}\n\n${intro}${intro && rendered ? '\n\n' : ''}${rendered}`, fallback: false };
    }
    case 'user_note': {
      const note = safeText(payload.body ?? payload.content ?? payload.note ?? '', 2_000);
      if (!note) return { markdown: `> **教师笔记**：暂无内容。`, fallback: true };
      return { markdown: `> **教师笔记**\n> ${note.replace(/\n/g, '\n> ')}`, fallback: false };
    }
    case 'interactive':
    case 'animation':
      return { markdown: `\n> **${safeText(block.title || (block.type === 'interactive' ? '交互模块' : '动画模块'), 160)}**\n> 当前导出通道只保留安全占位信息；HTML、JavaScript、iframe、SVG 事件和本地路径不会执行。请在受控查看器中完成教师复核。\n`, fallback: true };
    case 'prompt':
      return { markdown: `> **可继续追问**\n> ${text(payload.prompt ?? payload.body ?? payload.content ?? block.title, 1_200)}`, fallback: false };
    default:
      return { markdown: `\n> **未支持的内容块类型：${text(block.type, 80)}**\n> 已保留标题和来源引用，等待兼容 renderer。\n`, fallback: true };
  }
}

export function renderTeachingBookMarkdown(detail: TeachingBookDetail): { schemaVersion: typeof TEACHING_BOOK_MARKDOWN_SCHEMA_VERSION; markdown: string; fallbackCount: number; blockCount: number; sourceRefs: string[]; } {
  const pagesByChapter = new Map<string, typeof detail.pages>();
  for (const page of detail.pages) pagesByChapter.set(page.chapterId, [...(pagesByChapter.get(page.chapterId) ?? []), page]);
  const blocksByPage = new Map<string, TeachingBookBlock[]>();
  for (const block of detail.blocks) blocksByPage.set(block.pageId, [...(blocksByPage.get(block.pageId) ?? []), block]);
  let fallbackCount = 0;
  const sourceRefs = new Set<string>();
  const sections: string[] = [`# ${text(detail.book.title, 200)}`, detail.book.description ? text(detail.book.description, 1_000) : '', detail.health.status !== 'healthy' ? `> ⚠️ 来源健康状态：${detail.health.status}。请在导出或发布前复核标记的来源。` : ''];
  for (const chapter of [...detail.chapters].sort((a, b) => a.order - b.order)) {
    sections.push(`\n## ${text(chapter.title, 200)}`);
    if (chapter.learningObjectives.length) sections.push(`\n**学习目标**\n${chapter.learningObjectives.slice(0, 8).map((item) => `- ${text(item, 240)}`).join('\n')}`);
    for (const page of (pagesByChapter.get(chapter.id) ?? []).sort((a, b) => a.order - b.order)) {
      sections.push(`\n### ${text(page.title, 200)}`);
      const blocks = (blocksByPage.get(page.id) ?? []).sort((a, b) => a.order - b.order);
      for (const block of blocks) {
        const rendered = renderBlock(block); if (rendered.fallback) fallbackCount += 1; sections.push(rendered.markdown);
        for (const source of block.sourceAnchors.slice(0, 20)) if (source.ref) sourceRefs.add(source.ref);
      }
    }
  }
  const markdown = sections.filter(Boolean).join('\n\n').replace(/\n{4,}/g, '\n\n').slice(0, MAX_MARKDOWN);
  return { schemaVersion: TEACHING_BOOK_MARKDOWN_SCHEMA_VERSION, markdown, fallbackCount, blockCount: detail.blocks.length, sourceRefs: [...sourceRefs].slice(0, 100) };
}
