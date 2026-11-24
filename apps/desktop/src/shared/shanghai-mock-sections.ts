import { MOCK_EXAM_GRADES, MOCK_EXAM_SUBJECTS, SHANGHAI_DISTRICTS, mockExamYear } from "./mock-exam-compilation";

export const SHANGHAI_MOCK_SECTIONS = "shanghai-mock-sections.v1" as const;
const gradeAliases = ["初预", "初一", "初二", "初三", "高一年级", "高二年级", "高三年级"];
const roundNames = ["一", "二", "三", "四"];
const edition = "(?:[ABCD甲乙丙丁]卷)";
const variant = "(?:\\((" + edition + ")\\)|(" + edition + "))?";
const answerRole = "(?:参考答案(?:及解析)?|答案(?:解析|册)?|参考解答)";
const title = new RegExp(
  "^(\\d{4})年?上海(?:市)?(" + SHANGHAI_DISTRICTS.join("|") + ")(" +
  [...gradeAliases, ...MOCK_EXAM_GRADES].join("|") + ")(" + MOCK_EXAM_SUBJECTS.join("|") +
  ")([一二三四1-4])模" + variant +
  "(试卷|试题)?" + variant + "(" + answerRole + ")?" + variant + "$", "u",
);

const layoutText = (text: string) => text.normalize("NFKC").replace(/\s/gu, "");

/** Compare only a complete printed scope. Filenames, question numbers and partial covers cannot fill it. */
export function shanghaiMockSectionKey(text: string): string | undefined {
  const match = title.exec(layoutText(text));
  if (!match) return;
  const [, year, district, grade, subject, round, before1, before2, paper, inside1, inside2, answers, after1, after2] = match;
  if (!mockExamYear(Number(year)) || !paper && !answers) return;
  const variants = [before1, before2, inside1, inside2, after1, after2].filter(Boolean);
  if (variants.length > 1) return;
  const gradeName = MOCK_EXAM_GRADES[gradeAliases.indexOf(grade)] ?? grade;
  const roundNumber = Number(round) || roundNames.indexOf(round) + 1;
  return [SHANGHAI_MOCK_SECTIONS, year, district, gradeName, subject, roundNumber, variants[0] || ""].join("|");
}

/** An exam-looking heading with incomplete identity terminates inheritance. */
export function shanghaiMockSectionBoundary(text: string): boolean {
  const normalized = layoutText(text);
  return normalized.length <= 100 && /^\d{4}(?:年|届|学年|[-–—]|上海)/u.test(normalized) &&
    /(?:[一二三四1-4]模|模考|模拟)/u.test(normalized) &&
    /(?:试卷|试题|参考答案|答案册|答案解析|答案|参考解答)(?:\(?[ABCD甲乙丙丁]卷\)?)?$/u.test(normalized);
}
