import type {QuestionBlock} from '../../shared/question-document';
import {createHash} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import {PAPER_INSTANCE_SCHEMA, sourcePaperInstanceContent, validPaperInstance, validPaperInstanceContent, type PaperInstance, type PaperInstanceContent, type PaperInstanceRole, type PaperInstanceBlock} from '../../shared/paper-instance';
import type {PaperBasketEntry} from '../../shared/paper-basket';
import {canonicalBasketJson} from './paper-basket-state';
export const instanceDigest = (binding: PaperInstance['sourceBinding'], content: PaperInstanceContent) => createHash('sha256').update(canonicalBasketJson({binding, content})).digest('hex');
export function newPaperInstance(entry: PaperBasketEntry, revision = 1, content = sourcePaperInstanceContent()): PaperInstance {
  const sourceBinding = {questionId: entry.questionId, sourceVersion: entry.contentVersion, ...(entry.generation ? {generation: entry.generation} : {})};
  return {schemaVersion: PAPER_INSTANCE_SCHEMA, entryId: entry.entryId, instanceRevision: revision, sourceBinding, content, contentDigest: instanceDigest(sourceBinding, content)};
}
export function assertInstance(entry: PaperBasketEntry, instance: PaperInstance) {
  if (!validPaperInstance(instance) || instance.entryId !== entry.entryId || instance.sourceBinding.questionId !== entry.questionId
    || instance.sourceBinding.sourceVersion !== entry.contentVersion || canonicalBasketJson(instance.sourceBinding.generation || null) !== canonicalBasketJson(entry.generation || null)
    || instance.contentDigest !== instanceDigest(instance.sourceBinding, instance.content)) throw new Error('unavailable');
}
export const instanceReviewed = (i: PaperInstance) => !!i.review && i.review.action === 'confirm' && i.review.instanceRevision === i.instanceRevision
  && i.review.contentDigest === i.contentDigest && canonicalBasketJson(i.review.sourceBinding) === canonicalBasketJson(i.sourceBinding);
export function instanceBlockText(b: PaperInstanceBlock): string {
  switch (b.type) {
    case 'text': return b.text;
    case 'formula': return '$$' + b.latex + '$$';
    case 'table': return [b.rows[0].join(' | '), b.rows[0].map(() => '---').join(' | '), ...b.rows.slice(1).map(r => r.join(' | '))].map(r => '| ' + r + ' |').join('\n');
    case 'options': case 'subquestions': return b.items.map(i => i.label + '. ' + i.text).join('\n');
    case 'sourceImage': return '';
  }
}
/** Display scalar derived from the sole role content, never persisted as a replacement QuestionDocument. */
export function instanceRoleText(q: QuestionBankItem, i: PaperInstance, role: PaperInstanceRole) {
  const content = i.content[role];
  return content.mode === 'source' ? q[role === 'question' ? 'stem' : role] : content.blocks.map(instanceBlockText).filter(Boolean).join('\n');
}
/** Only independent document figures can be reused, never a whole role screenshot/native typeset page. */
export function instanceSourceImage(q: QuestionBankItem, i: PaperInstance, role: PaperInstanceRole, b: Extract<PaperInstanceBlock,{type:'sourceImage'}>): Extract<QuestionBlock,{kind:'image'}> {
  const doc = q.document;
  if (role !== b.role || b.sourceVersion !== i.sourceBinding.sourceVersion || !doc || doc.schemaVersion !== 'xiaozhi.question-document.v2'
    || !doc.blocks.some(block => block.id === b.blockId && block.kind === 'image')) throw Error('unsupported');
  // The existing ledger proves complete role screenshots. It has no independent
  // illustration proof. Preserve these references as blocked drafts until such
  // proof exists; a block ID or an instance review cannot manufacture it.
  throw Error('unsupported');
}

/** undefined keeps source/non-choice semantics. An empty array means an edited
 * choice is a valid draft but cannot be delivered; never invent source labels. */
export function editedInstanceChoiceLabels(q: QuestionBankItem, i: PaperInstance): string[] | undefined {
  if (!/选择|单选|多选/.test(q.questionType) || i.content.question.mode !== 'edited') return undefined;
  if (!validPaperInstanceContent(i.content)) return [];
  const items = i.content.question.blocks.flatMap(b => b.type === 'options' ? b.items : []);
  const labels = items.map(item => item.label);
  return items.length >= 2 && new Set(labels).size === labels.length ? labels : [];
}

export function instanceDeliveryBlock(q: QuestionBankItem, i: PaperInstance): 'image_dependency' | 'options_required' | undefined {
  const labels = editedInstanceChoiceLabels(q,i);
  if (labels && labels.length < 2) return 'options_required';
  for (const role of ['question','answer','analysis'] as const) {
    const c = i.content[role];
    if (c.mode === 'source') continue;
    for (const b of c.blocks) if (b.type === 'sourceImage') { try { instanceSourceImage(q,i,role,b); } catch { return 'image_dependency'; } }
    // A source declares diagram dependencies that the current role protocol cannot
    // isolate from its complete screenshot. Preserve edits, refuse delivery.
    const projection = q.document?.schemaVersion === 'xiaozhi.question-document.v2' ? q.document.context.projection : q.archive?.native?.projection;
    if (role === 'question' && projection?.figures.state === 'provided') return 'image_dependency';
    if (c.blocks.some(b => b.type === 'text' && /(?:见|如下|参照下|图形|示意图|图示).*图/.test(b.text))) return 'image_dependency';
  }
  return undefined;
}
