import type {PaperInstanceBlock, PaperInstanceRoleContent} from '../../../shared/paper-instance';

export const isChoiceQuestion = (type: string) => /选择|单选|多选/.test(type);

/** A suggested split for teacher review, never a source or correctness assertion.
 * Only consecutive, delimited A..H labels with nonempty bodies qualify. Ambiguity stays as text.
 */
export function splitInstanceOptions(text: string): {statement: string; options: Extract<PaperInstanceBlock, {type: 'options'}>} | undefined {
  const matches = [...text.matchAll(/(?:^|\s)([A-H])[.．、)）]\s*/g)];
  if (matches.length < 2 || matches.length > 8) return;
  const statement = text.slice(0, matches[0].index).trim();
  const items = matches.map((match, index) => ({label: match[1],
    text: text.slice(match.index! + match[0].length, matches[index + 1]?.index ?? text.length).trim()}));
  if (!items.every((item, index) => item.label === String.fromCharCode(65 + index) && !!item.text)) return;
  return {statement, options: {type: 'options', items}};
}

export function instanceOptionsRequired(type: string, content: PaperInstanceRoleContent): boolean {
  if (!isChoiceQuestion(type) || content.mode !== 'edited') return false;
  return content.blocks.filter(block => block.type === 'options').flatMap(block => block.type === 'options' ? block.items : []).length < 2;
}
