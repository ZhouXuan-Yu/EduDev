import type {QuestionBankItem} from '../../shared/contracts';
import type {PaperBlueprint, PaperGeneration} from '../../shared/paper-blueprint';
import type {PaperBasketAvailability, PaperBasketEntry} from '../../shared/paper-basket';
import {archiveEligible} from '../../shared/question-archive';
import {questionSelectionIdentity as questionContentIdentity} from '../../shared/question-selection-identity';
import {questionFacts, questionVersion} from './question-context-provider';
import {paperSectionMatches} from './paper-selection';
import type {ApprovedPaperGroup, PaperSql, PaperStoreHost} from './paper-sql';

export async function basketGenerations(host: PaperStoreHost, sql: PaperSql, sessionId: string, blueprint: PaperBlueprint) {
  const refs = new Map<string, PaperGeneration>();
  if (blueprint.mode === 'source_only') return refs;
  if (!host.approvedGenerations) throw new Error('unavailable');
  let groups: ApprovedPaperGroup[];
  try {
    groups = await host.approvedGenerations(sessionId, sql);
  } catch (error) {
    // A broken approval must block generated entries without hiding pinned draft facts.
    // Ownership and storage failures still propagate; no failed proof grants eligibility.
    if (error instanceof Error && ['unavailable', 'source_changed'].includes(error.message)) return refs;
    throw error;
  }
  for (const group of groups) {
    if (group.sessionId !== sessionId) throw new Error('permission_denied');
    if (group.subject !== blueprint.subject || group.grade !== blueprint.grade) continue;
    if (blueprint.mode === 'ai_original' && group.generationKind !== 'ai_original') continue;
    for (const question of group.questions) {
      if (refs.has(question.id)) throw new Error('unavailable');
      refs.set(question.id, {groupId: group.id, effectDigest: group.effectDigest, generationKind: group.generationKind});
    }
  }
  return refs;
}

export async function basketQuestionAvailability(
  sql: PaperSql,
  question: QuestionBankItem,
  generations: ReadonlyMap<string, PaperGeneration>,
): Promise<PaperBasketAvailability> {
  if (questionContentIdentity(question).status !== 'available' || !archiveEligible(question)) {
    return {available: false, reason: 'unsupported'};
  }
  if (!question.answer.trim() || !question.analysis.trim() || question.document?.answer.origin === 'missing' || question.document?.analysis.origin === 'missing') {
    return {available: false, reason: 'missing_answer'};
  }
  if (question.sourceKind === 'generated' && !generations.has(question.id)) {
    return {available: false, reason: 'generation_unavailable'};
  }
  if (!['local_bank', 'teacher_resource', 'generated'].includes(question.sourceKind)) {
    return {available: false, reason: 'unsupported'};
  }
  try {
    await sql.validate(question);
  } catch {
    return {available: false, reason: 'source_unavailable'};
  }
  return {available: true};
}

export async function basketEntryAvailability(
  sql: PaperSql,
  entry: PaperBasketEntry,
  blueprint: PaperBlueprint,
  generations: ReadonlyMap<string, PaperGeneration>,
): Promise<PaperBasketAvailability> {
  const question = await sql.read(entry.questionId);
  if (!question || questionVersion(question) !== entry.contentVersion) return {available: false, reason: 'source_changed'};
  const available = await basketQuestionAvailability(sql, question, generations);
  if (!available.available) return available;
  if (JSON.stringify(generations.get(question.id)) !== JSON.stringify(entry.generation)) {
    return {available: false, reason: 'generation_unavailable'};
  }
  const section = blueprint.sections.find(item => item.id === entry.sectionId);
  if (!section || blueprint.mode === 'ai_original' && question.sourceKind !== 'generated'
    || !paperSectionMatches(question, blueprint, section)) return {available: false, reason: 'section_mismatch'};
  return {available: true};
}

export async function readBasketQuestion(sql: PaperSql, questionId: string) {
  const question = await sql.read(questionId);
  if (!question) throw new Error('source_changed');
  return questionFacts(question);
}
