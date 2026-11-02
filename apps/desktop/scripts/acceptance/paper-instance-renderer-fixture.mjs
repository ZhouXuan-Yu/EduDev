import {createHash} from 'node:crypto';
import {fixture, makeBasket, question, ownerA, ownerB, basketId, otherBasketId, version} from './paper-basket-renderer-fixture.mjs';
export {ownerA, ownerB, basketId, otherBasketId, version};
export const entryId = 'xibasketentry_66666666-6666-4666-8666-666666666666';
export const bankQuestion = {...question, id: 'question_77777777-7777-4777-8777-777777777777'};
export const replacementQuestion = {...bankQuestion, id: 'question_88888888-8888-4888-8888-888888888888', stem: 'UNIT replacement body'};
export const sourceContent = () => ({question: {mode: 'source'}, answer: {mode: 'source'}, analysis: {mode: 'source'}});
const digest = content => createHash('sha256').update(JSON.stringify(content)).digest('hex');
function instance(content = sourceContent(), revision = 1, source = bankQuestion) {
  return {schemaVersion: 'xiaozhi.paper-instance.v1', entryId, instanceRevision: revision, contentDigest: digest(content),
    sourceBinding: {questionId: source.id, sourceVersion: version}, content};
}
export function instanceFixture(blueprint) {
  const f = fixture(blueprint);
  f.api.getDataRoot = async () => 'unit-owned-data-root-A';
  const entry = {entryId, questionId: bankQuestion.id, contentVersion: version, sectionId: blueprint.sections[0].id,
    position: 0, question: bankQuestion, availability: {available: true}, instance: instance(), reviewCurrent: false, deliveryBlock: 'needs_review'};
  for (const [owner, id] of [[ownerA, basketId], [ownerB, otherBasketId]]) f.data.set(owner, {...makeBasket(blueprint),
    id, sessionId: owner, schemaVersion: 'xiaozhi.paper-basket.v2', persistedSchemaVersion: 'xiaozhi.paper-basket.v1',
    entries: [structuredClone(entry)], count: 1, uiState: {stage: 'organize', filters: {}, offset: 0, scrollTop: 0}});
  f.calls.v2 = [];
  const answer = value => ({ok: true, value: structuredClone(value)});
  f.api.listPaperBasketsV2 = async input => {f.calls.v2.push(['list', structuredClone(input)]);
    return answer({items: [f.data.get(input.sessionId)], total: 1, offset: input.offset, limit: input.limit});};
  f.api.readPaperBasketV2 = async input => {f.calls.v2.push(['read', structuredClone(input)]); return answer(f.data.get(input.sessionId));};
  f.api.createPaperBasketV2 = async input => {f.calls.v2.push(['create', structuredClone(input)]); return answer(f.data.get(input.sessionId));};
  f.api.readPaperBasketCandidateV2 = async input => {f.calls.v2.push(['candidate', structuredClone(input)]);
    return answer({question: input.questionId === bankQuestion.id ? bankQuestion : replacementQuestion,
      contentVersion: version, eligibility: {available: true}, matchingSectionIds: [blueprint.sections[0].id]});};
  f.api.listQuestionNotebook = async () => ({items: [replacementQuestion], total: 1});
  f.api.createPaperFromBasketV2 = async input => {f.calls.v2.push(['snapshot', structuredClone(input)]);
    return {ok: false, error: 'shortage'};};
  f.api.mutatePaperBasketV2 = async input => {
    f.calls.v2.push(['mutate', structuredClone(input)]);
    const next = structuredClone(f.data.get(input.sessionId)), op = input.operation, target = next.entries.find(e => e.entryId === op.entryId);
    if (next.revision !== input.expectedRevision) return {ok: false, error: 'conflict'};
    if (op.type === 'updateUiState') next.uiState = op.uiState;
    else {
      if (target && 'expectedInstanceRevision' in op && target.instance.instanceRevision !== op.expectedInstanceRevision) return {ok: false, error: 'conflict'};
      if (op.type === 'editEntry') target.instance = instance(op.content, target.instance.instanceRevision + 1, target.question);
      if (op.type === 'restoreEntrySource') target.instance = instance(sourceContent(), target.instance.instanceRevision + 1, target.question);
      if (op.type === 'replaceEntry') {
        target.question = structuredClone(replacementQuestion); target.questionId = replacementQuestion.id;
        target.instance = instance(sourceContent(), target.instance.instanceRevision + 1, replacementQuestion);
      }
      if (op.type === 'reviewEntry') {
        if (op.expectedContentDigest !== target.instance.contentDigest) return {ok: false, error: 'conflict'};
        target.instance.review = {eventId: 'xireview_99999999-9999-4999-8999-999999999999', action: op.action,
          instanceRevision: target.instance.instanceRevision, contentDigest: target.instance.contentDigest,
          sourceBinding: target.instance.sourceBinding, reviewedAt: '2026-11-02T00:00:00.000Z'};
      }
      for (const e of next.entries) {
        e.reviewCurrent = e.instance.review?.action === 'confirm';
        e.deliveryBlock = e.reviewCurrent ? undefined : 'needs_review';
      }
      next.complete = next.entries.every(e => e.reviewCurrent); next.revision++;
      next.persistedSchemaVersion = 'xiaozhi.paper-basket.v2';
    }
    f.data.set(input.sessionId, next); return answer(next);
  };
  return f;
}
