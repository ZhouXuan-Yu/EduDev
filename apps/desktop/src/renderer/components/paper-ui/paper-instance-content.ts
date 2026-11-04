import {documentIllustrations,hasTeacherTextPresentation,isCompleteQuestionDocument} from '../../../shared/question-document';
import type {QuestionBlock} from '../../../shared/question-document';
import type {PaperInstanceBlock, PaperInstanceContent, PaperInstanceRole} from '../../../shared/paper-instance';
import type {PaperWorkspaceEntry} from './paper-basket-client';
import {isChoiceQuestion, splitInstanceOptions} from './paper-instance-options';

export const instanceRoles: PaperInstanceRole[] = ['question', 'answer', 'analysis'];
export const instanceRoleLabels: Record<PaperInstanceRole, string> = {question: '题干、选项与小问', answer: '参考答案', analysis: '解析'};
export const sameInstanceContent = (a: PaperInstanceContent, b: PaperInstanceContent) => JSON.stringify(a) === JSON.stringify(b);

/** Seed editable blocks without losing original figures. References remain subject to host delivery checks. */
export function seedInstanceRole(entry: PaperWorkspaceEntry, role: PaperInstanceRole): PaperInstanceBlock[] {
  const q = entry.question, sourceVersion = entry.contentVersion;
  const image = (blockId: string): PaperInstanceBlock => ({type: 'sourceImage', role, blockId, sourceVersion});
  const text = (blocks: QuestionBlock[]): string => blocks.map(block => {
    if (block.kind === 'text' || block.kind === 'latex') return block.text;
    if (block.kind === 'table') return block.rows.map(row => row.map(cell => cell.text).join(' | ')).join('\n');
    if (block.kind === 'subquestion') return block.label + ' ' + text(block.blocks);
    if (block.kind === 'choices') return block.options.map(option => option.label + ' ' + text(option.blocks)).join('\n');
    return '';
  }).filter(Boolean).join('\n');
  const figures = (blocks: QuestionBlock[]): PaperInstanceBlock[] => blocks.flatMap(block => block.kind === 'image' ? [image(block.id)]
    : block.kind === 'choices' ? block.options.flatMap(option => figures(option.blocks)) : block.kind === 'subquestion' ? figures(block.blocks) : []);
  const blocks = (source: QuestionBlock[]): PaperInstanceBlock[] => source.flatMap((block): PaperInstanceBlock[] => {
    switch (block.kind) {
      case 'text': return [{type: 'text', text: block.text}];
      case 'latex': return [{type: 'formula', latex: block.text}];
      case 'image': return [image(block.id)];
      case 'table': return [{type: 'table', rows: block.rows.map(row => row.map(cell => cell.text))}];
      case 'choices': return [{type: 'options', items: block.options.map(option => ({label: option.label, text: text(option.blocks)}))}, ...figures([block])];
      case 'subquestion': return [{type: 'subquestions', items: [{label: block.label, text: text(block.blocks)}]}, ...figures(block.blocks)];
    }
  });
  if (role === 'question' && q.document?.blocks.length && !isCompleteQuestionDocument(q.document)) return blocks(q.document.blocks);
  const native = q.archive?.native?.roles[role];
  const value = native?.text || q[role === 'question' ? 'stem' : role] || '';
  const split = role === 'question' && isChoiceQuestion(q.questionType) ? splitInstanceOptions(value) : undefined;
  const result: PaperInstanceBlock[] = split
    ? [...(split.statement ? [{type: 'text' as const, text: split.statement}] : []), split.options]
    : [{type: 'text', text: value}];
  if (native) result.push(...native.figures.map(figure => image(figure.blockId)));
  else if (role === 'question' && q.document) {
    // V2 projections provide context alongside full-role screenshots. Keep their dependencies explicit.
    if (isCompleteQuestionDocument(q.document) && !hasTeacherTextPresentation(q.document)) {
      for (const field of ['formulas', 'tables', 'choices', 'subquestions'] as const) {
        const projection = q.document.context.projection[field];
        if (field === 'choices') {
          if (split) continue; // Already represented once in the structured options above.
          const choices = isChoiceQuestion(q.questionType) && splitInstanceOptions(projection.text);
          if (choices && !choices.statement) {result.push(choices.options); continue;}
        }
        if (projection.text.trim()) result.push({type: 'text', text: projection.text});
      }
    }
    const independent=documentIllustrations(q.document);
    result.push(...(independent?independent.blockIds.map(image):figures(q.document.blocks)));
  }
  else if (q.document) result.push(...figures(q.document.blocks.filter(block => block.id.startsWith(`source_${role}_`))));
  return result;
}

export function blankInstanceBlock(type: Exclude<PaperInstanceBlock['type'], 'sourceImage'>): PaperInstanceBlock {
  switch (type) {
    case 'text': return {type, text: ''};
    case 'formula': return {type, latex: ''};
    case 'table': return {type, rows: [['', ''], ['', '']]};
    case 'options': return {type, items: [{label: 'A', text: ''}, {label: 'B', text: ''}]};
    case 'subquestions': return {type, items: [{label: '1', text: ''}]};
  }
}
