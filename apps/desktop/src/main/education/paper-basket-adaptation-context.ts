import type {AdaptationRunInput} from './paper-basket-adaptation-run';
import type {QuestionContextSource} from '../../shared/question-context';
import {prepareQuestionAliases, type QuestionAliases} from './question-aliases';

type BoundParentService = {
  boundParent: (input: AdaptationRunInput, signal: AbortSignal,
    current: () => boolean) => Promise<QuestionContextSource | undefined>;
};

/** Discovery only. The real question provider must still read the exact source
 * successfully before observedQuestions can authorize a variation proposal.
 */
export async function preparePaperAdaptationContext(service: BoundParentService,
  input: AdaptationRunInput, aliases: QuestionAliases, signal: AbortSignal, current: () => boolean): Promise<string> {
  const parent = await service.boundParent(input, signal, current);
  signal.throwIfAborted();
  if (!current()) throw new Error('cancelled');
  if (!parent) return '';
  const prepared = prepareQuestionAliases(aliases, [parent]);
  // No await between the final lease check, alias allocation and commit.
  prepared.commit();
  return `\n指定题改编的已绑定父题：${prepared.references[0]}，冻结版本 ${parent.version}。这是本 run 的 discovery 别名，尚未实读；请用 education_read_question(reference="${prepared.references[0]}", version="${parent.version}") 读取，不带 purpose。仅成功读取后才能作为 education_propose_questions 的 sourceReferences；不得改用最新版本、猜测别名或用原始题目ID读取。`;
}
