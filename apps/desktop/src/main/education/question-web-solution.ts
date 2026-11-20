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

function literalChoices(raw: string, allowStatement = false): Choice[] | undefined {
  const markers = [...raw.matchAll(/(?:^|\s)(?:[（(]([A-HＡ-Ｈ])[）)]|([A-HＡ-Ｈ])[.．、:：])/gu)];
  if (markers.length < 2 || markers.length > 8 || !allowStatement && raw.slice(0, markers[0].index).trim()) return;
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
const choiceType = /^(?:选择题|单选题|多选题|(?:单项|多项|不定项)选择题)$/u;

function selectedLetters(value: string) {
  let text = normalizedWebQuote(value).replace(/[.．。]$/u, "");
  const boxed = /^(?:\(([A-HＡ-Ｈ]+)\)|（([A-HＡ-Ｈ]+)）)$/u.exec(text);
  if (boxed) text = boxed[1] || boxed[2];
  if (!/^(?:[A-HＡ-Ｈ]{1,8}项?)(?:[,，、和及与][A-HＡ-Ｈ]{1,8}项?)*$/u.test(text)) return;
  const letters = [...text.matchAll(/[A-HＡ-Ｈ]/gu)].map(match => match[0].normalize("NFKC"));
  if (letters.length <= 8) return letters.sort().join("");
}

function choiceClaim(answer: string, options: Choice[]) {
  const letters = selectedLetters(answer);
  if (letters) return { letters, invalid: new Set(letters).size !== letters.length ||
    [...letters].some(label => !options.some(option => option.label === label)) };
  const text = questionText(answer);
  const marked = /^(?:([A-HＡ-Ｈ])[.．、:：]|[（(]([A-HＡ-Ｈ])[）)])(.+)$/u.exec(text);
  if (marked) {
    const label = (marked[1] || marked[2]).normalize("NFKC"), echo = marked[3];
    const option = options.find(candidate => candidate.label === label);
    return { letters: label, invalid: !option || echo !== option.text && echo.replace(/。$/u, "") !== option.text };
  }
  const identical = options.filter(option => option.text === text);
  if (identical.length === 1) return { letters: identical[0].label, invalid: false };
}

const decisionCue = /(?:^|[,，；;])\s*(?:(?:综上(?:所述)?|所以|因此|故)\s*[:：,，]?\s*)?(?:故选|应(?:当|该)?选|选择|选|正确选项(?:为|是)|(?:正确|本题|最终)?答案(?:为|是|[:：]))\s*[:：]?\s*/gu;
const hypothetical = /(?:^|[,，；;])\s*(?:[〖【]\s*)?(?:若|假设|假如|如果|要是|当[^,，；;]{1,80}时|有人|误以为|误认为|错解|错误(?:的)?(?:解法|答案|分析|结论|示范)|常见误区)/u;
const explanationTail = /[,，：:]\s*(?:其中|即|因为|理由|该项|此项|其余|对应)/u;

/** Explicit, affirmative choice conclusions only. Option discussion remains source text. */
function choiceConclusionConflict(q: QuestionBankItem, answer: string, analysis: string, detached?: Choice[]) {
  const doc = q.document;
  const projected = isCompleteQuestionDocument(doc) && doc.context.projection.choices;
  const options = detached ?? (projected && projected.state === "provided" ? literalChoices(projected.text) :
    choiceType.test(q.questionType.trim()) ? literalChoices(q.stem, true) : undefined);
  if (!options) return false;
  const claim = choiceClaim(answer, options);
  if (!claim || claim.invalid) return !!claim?.invalid;
  for (const line of analysis.split(/[。！？!?\r\n]/u)) {
    const sentence = line.replace(/^\s*(?:〖(?:详解|解答)〗|【(?:详解|解答)】|(?:详解|解答)[：:])/u, "");
    for (const cue of sentence.matchAll(decisionCue)) {
      if (hypothetical.test(sentence.slice(0, cue.index))) continue;
      const tail = sentence.slice(cue.index + cue[0].length);
      const conclusion = selectedLetters(tail.split(explanationTail, 1)[0].split(/[；;]/u, 1)[0]);
      if (conclusion && conclusion !== claim.letters) return true;
    }
  }
  return false;
}

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
  return { answer: answerText, analysis: analysisText, options: witness.options,
    choiceConflict: choiceConclusionConflict(q, answerText, analysisText, witness.options) };
}

/** The printed letter and a literal echo of that same option can agree. */
export function agreesWithWebAnswer(saved: string, observed: string, options?: Choice[]) {
  if (normalizedWebQuote(saved) === normalizedWebQuote(observed)) return true;
  const value = normalizedWebQuote(saved);
  const option = options?.find(candidate => candidate.label === value);
  return !!option && new RegExp("^" + optionLabels(option.label) + escape(option.text) + "$", "u")
    .test(questionText(observed));
}
