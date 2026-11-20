import {documentIllustrations,independentQuestionImage,isCompleteQuestionDocument,structuredQuestionChoices,structuredChoiceImage} from '../../shared/question-document';
import type {QuestionBlock} from '../../shared/question-document';
import {createHash} from 'node:crypto';
import type {QuestionBankItem} from '../../shared/contracts';
import {PAPER_INSTANCE_SCHEMA, sourcePaperInstanceContent, validPaperInstance, validPaperInstanceContent, type PaperInstance, type PaperInstanceContent, type PaperInstanceRole, type PaperInstanceBlock, type PaperInstanceOptionImage} from '../../shared/paper-instance';
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
  const image=independentQuestionImage(q.document,b.blockId);
  if (role !== 'question' || role !== b.role || q.id !== i.sourceBinding.questionId || b.sourceVersion !== i.sourceBinding.sourceVersion || !image) throw Error('unsupported');
  return image;
}

export function instanceChoiceImage(q: QuestionBankItem, instance: PaperInstance, label: string, ref: PaperInstanceOptionImage) {
  const image = structuredChoiceImage(q,label,ref.blockId);
  if (q.id !== instance.sourceBinding.questionId || ref.sourceVersion !== instance.sourceBinding.sourceVersion || image?.mime !== 'image/png') throw Error('unsupported');
  return image;
}

function checkChoiceImages(q: QuestionBankItem, i: PaperInstance, blocks: PaperInstanceBlock[]) {
  const required = structuredQuestionChoices(q).flatMap(option => option.blocks.flatMap(block =>
    block.kind === 'image' ? [[option.label,block.id]] : []));
  const provided = blocks.flatMap(block => block.type === 'options' ? block.items.flatMap(item =>
    (item.sourceImages ?? []).map(ref => [item.label,instanceChoiceImage(q,i,item.label,ref).id])) : []);
  return provided.length <= 32 && canonicalBasketJson(required) === canonicalBasketJson(provided) &&
    new Set(provided.map(([,id])=>id)).size === provided.length;
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
    if (role !== 'question' && c.blocks.some(block => block.type === 'options' && block.items.some(item => item.sourceImages))) return 'image_dependency';
    const images=new Set<string>();
    for (const b of c.blocks) if (b.type === 'sourceImage') { try { instanceSourceImage(q,i,role,b);if(images.has(b.blockId))return 'image_dependency';images.add(b.blockId); } catch { return 'image_dependency'; } }
    const projection = isCompleteQuestionDocument(q.document) ? q.document.context.projection : q.archive?.native?.projection;
    if(role==='question'){
      try { if (!checkChoiceImages(q,i,c.blocks)) return 'image_dependency'; } catch { return 'image_dependency'; }
      const figures=documentIllustrations(q.document);
      // Original text can independently require a setup diagram as well as
      // graphic choices. A stem edit must not remove that dependency.
      if(!images.size && c.blocks.some(b=>b.type==='options'&&b.items.some(item=>item.sourceImages)) &&
          /如[附右左下]?图|见[附右左下]?图|图中|图\s*所示/u.test(q.stem))return 'image_dependency';
      if(figures&&!figures.complete||projection?.figures.state==='provided'&&(!figures?.complete||!figures.blockIds.length||figures.blockIds.some(id=>!images.has(id))))return 'image_dependency';
    }
    if (!images.size&&c.blocks.some(b => b.type === 'text' && /(?:见|如下|参照下|图形|示意图|图示).*图/.test(b.text))) return 'image_dependency';
  }
  return undefined;
}
