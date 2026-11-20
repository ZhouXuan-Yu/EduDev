import type { QuestionBankItem } from "../../shared/contracts";
import { isCompleteQuestionDocument } from "../../shared/question-document";
import type { WebAnswerProposal } from "../../shared/question-web-answer";

export const normalizedWebQuote = (text: string) => text.normalize("NFC").replace(/\s+/gu, "");
const questionText = (text: string) => text.normalize("NFC").replace(/[（(]\s*[）)]/gu, "()")
  .replace(/\s+/gu, (space, offset, value: string) =>
    /\d/u.test(value[offset - 1] ?? "") && /\d/u.test(value[offset + space.length] ?? "") ? " " : "");
const escape = (value: string) => value.replace(/[$.*+?^{}()|[\]\\]/gu, "\\$&");
const labelText = (label: string) => String.fromCharCode(label.charCodeAt(0) + 0xfee0);
const optionLabels = (label: string) => {
  const glyphs = "[" + label + labelText(label) + "]";
  return "(?:" + glyphs + "[.．、:：]|[（(]" + glyphs + "[）)])";
};
type Choice = { label: string; text: string };

function literalChoices(raw: string): Choice[] | undefined {
  const markers = [...raw.matchAll(/(?:^|\s)(?:[（(]([A-HＡ-Ｈ])[）)]|([A-HＡ-Ｈ])[.．、:：])/gu)];
  if (markers.length < 2 || markers.length > 8 || raw.slice(0, markers[0].index).trim()) return;
  const options = markers.map((marker, i) => ({
    label: (marker[1] || marker[2]).normalize("NFKC"),
    text: questionText(raw.slice(marker.index + marker[0].length, markers[i + 1]?.index)),
  }));
  if (options.every((option, i) => option.label === String.fromCharCode(65 + i) && option.text)) return options;
}

/** Only detached, ordered textual choices are appended to the statement.
 * Other fields still require a literal witness inside the saved stem. */
function questionWitness(q: QuestionBankItem) {
  const stem = normalizedWebQuote(q.stem), d = q.document;
  if (!stem) return;
  if (!d) return { stem };
  if (!isCompleteQuestionDocument(d)) return;
  const p = d.context.projection;
  if (p.figures.state !== "not_applicable" || p.tables.state !== "not_applicable" ||
      d.context.illustrations?.blockIds.length ||
      d.blocks.some(block => block.kind === "choices" &&
        block.options.some(option => option.blocks.some(item => item.kind !== "text" && item.kind !== "latex"))) ||
      [p.statement, p.formulas, p.subquestions].some(part =>
        part.state !== "not_applicable" && (part.state !== "provided" ||
          !normalizedWebQuote(part.text) || !stem.includes(normalizedWebQuote(part.text))))) return;
  if (p.choices.state === "not_applicable") return { stem };
  if (p.choices.state !== "provided" || !p.choices.text.trim()) return;
  if (stem.includes(normalizedWebQuote(p.choices.text))) return { stem };
  const options = literalChoices(p.choices.text);
  if (options) return { stem: questionText(q.stem), options };
}

const markers = /(?:^|\n)[ \t]*(?:【(参考答案|答案|解析|分析|详解|解答)】|〖(参考答案|答案|解析|分析|详解|解答)〗|(参考答案|答案|解析|分析|详解|解答)[ \t]*[:：])[ \t]*/gu;
const anotherQuestion = /(?:^|\n)[ \t]*(?:第[ \t]*[0-9０-９]+[ \t]*题|[0-9０-９]+[.、．]|(?:【|〖)?(?:例题|例|变式训练|变式|练习)[ \t]*[0-9０-９]+)/u;
const questionHeading = /^(?:[【〖]?(?:试题|题目|原题)[】〗]?[：:]?)?(?:(?:第[0-9０-９]{1,5}题|[0-9０-９]{1,5}[.、．])[：:]?)?(?:[（(][0-9０-９]{1,3}分[）)])?$/u;

/** Match one explicitly labelled answer in a selected, complete question region. */
export function exactWebSolution(q: QuestionBankItem, input: WebAnswerProposal, text: string) {
  const witness = questionWitness(q);
  if (!witness) return false;
  const labelled = [...text.matchAll(markers)].map(match => ({ match, label: match[1] || match[2] || match[3] }));
  const answers = labelled.filter(item => item.label.endsWith("答案"));
  const details = labelled.filter(item => !item.label.endsWith("答案"));
  if (answers.length !== 1 || details.length > 2 ||
      details.length === 2 && (details[0].label !== "分析" || !["详解","解答"].includes(details[1].label))) return false;
  const answer = answers[0].match, analysis = details[0]?.match;
  if (analysis && analysis.index <= answer.index || anotherQuestion.test(text.slice(answer.index))) return false;
  const normalize = witness.options ? questionText : normalizedWebQuote;
  const body = normalize(text), prefix = normalize(text.slice(0, answer.index)), quote = normalize(input.questionQuote);
  if (body.split(witness.stem).length !== 2) return false;
  const index = prefix.indexOf(witness.stem);
  if (index < 0) return false;
  let literal = witness.stem;
  if (witness.options) {
    if (!questionHeading.test(prefix.slice(0,index))) return false;
    const tail = witness.options.map(option => optionLabels(option.label) + escape(option.text)).join("");
    const match = new RegExp("^" + escape(witness.stem) + tail, "u").exec(prefix.slice(index));
    if (!match) return false;
    literal = match[0];
  }
  const trailing = prefix.slice(index + literal.length);
  if (quote !== literal || (witness.options
    ? !/^[。？！?!]*$/u.test(trailing)
    : !!trailing.replace(/[：:。？！?!【】\[\]()（）\-—]/gu, ""))) return false;
  const answerText = text.slice(answer.index + answer[0].length, analysis?.index).trim();
  const analysisText = analysis ? text.slice(analysis.index + analysis[0].length).trim() : "";
  if (!answerText || input.answerQuote !== undefined && normalizedWebQuote(input.answerQuote) !== normalizedWebQuote(answerText) ||
      input.analysisQuote !== undefined && normalizedWebQuote(input.analysisQuote) !== normalizedWebQuote(analysisText)) return false;
  return { answer: answerText, analysis: analysisText, options: witness.options };
}

/** The printed letter and a literal echo of that same option can agree. */
export function agreesWithWebAnswer(saved: string, observed: string, options?: Choice[]) {
  if (normalizedWebQuote(saved) === normalizedWebQuote(observed)) return true;
  const value = normalizedWebQuote(saved);
  const option = options?.find(candidate => candidate.label === value);
  return !!option && new RegExp("^" + optionLabels(option.label) + escape(option.text) + "$", "u")
    .test(questionText(observed));
}
