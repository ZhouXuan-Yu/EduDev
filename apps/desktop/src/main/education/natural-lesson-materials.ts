import { LESSON_DETAIL_LIMIT } from "../../shared/teaching-lesson";

const maxMaterials = 6;
const countWords = "一二三四五六七八九十";
const count = "(?:[0-9]{1,2}|[一二两三四五六七八九十])";
const unit = "[段篇份则组]";
const subject = "(?:材料|史料|短文|文章|回忆|记录|案例|对话|情境|故事)";
const boundary = "[^。！？?；;，,\n]";
const requests = [
  new RegExp(String.raw`(?:自拟|自编|原创|虚构)\s*(?:(${count})\s*${unit})?${boundary}{0,36}?${subject}`, "gu"),
  new RegExp(String.raw`(?:编写|写|编|生成|附上|提供|给出|配上)\s*(?:(${count})\s*${unit})?(?:(?!教案)${boundary}){0,14}?(?:模拟|虚构|自拟|原创)${boundary}{0,20}?${subject}`, "gu"),
];

/** Captures explicit requests for self-contained synthetic reading material. */
export function requestedLessonMaterials(prompt: string): number | undefined {
  const text = prompt.normalize("NFKC");
  const counts = requests.flatMap(pattern => Array.from(text.matchAll(pattern), match => {
    const start = match.index ?? 0;
    if (/(?:无需|不用|不要|不必|不需要|不要求|避免|禁止)\s*$/u.test(text.slice(Math.max(0, start - 12), start))) return 0;
    if (!match[1]) return 1;
    if (match[1] === "两") return 2;
    return /^[0-9]/u.test(match[1]) ? Number(match[1]) : countWords.indexOf(match[1]) + 1;
  }));
  const requested = Math.max(0, ...counts);
  return requested > 0 && requested <= maxMaterials ? requested : undefined;
}

export const lessonMaterialsToolSchema = {
  type: "array", maxItems: maxMaterials,
  items: {
    type: "object", additionalProperties: false, required: ["title", "text"],
    properties: {
      title: { type: "string", minLength: 1, maxLength: 80 },
      text: { type: "string", minLength: 24, maxLength: 460 },
    },
  },
};

type Material = { title: string; text: string };
const words = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Store the same editable text the teacher sees and that the confirmed exports use. */
export function includeLessonMaterials(
  content: string,
  materials: Material[] = [],
  requested?: number,
): { content: string; materialCount: number } | { issue: string } {
  if (requested !== undefined && materials.length !== requested) {
    return { issue: `教师要求 ${requested} 份自拟材料，当前 materials 提交 ${materials.length} 份。请逐份提供 title 和可直接发给学生的 text 正文。` };
  }

  const titles = new Set<string>(), bodies = new Set<string>();
  const sections: string[] = [];
  for (const [index, material] of materials.entries()) {
    const label = String.fromCharCode(65 + index);
    const title = material.title.trim();
    const text = material.text.trim();
    const titleKey = words(title), bodyKey = words(text);
    if (!titleKey || /[\r\n]/u.test(title) || titles.has(titleKey)) {
      return { issue: `材料 ${label} 必须有独立的一行标题。` };
    }
    if (bodyKey.length < 24 || bodies.has(bodyKey) ||
      /^(?:(?:请)?(?:教师|老师)(?:另行|自行)?(?:准备|提供|编写|补充|选取)|(?:正文|原文|内容)?(?:待补充|略|见附件))/u.test(text)) {
      return { issue: `材料 ${label} 缺少独立正文。请在 text 写实际给学生阅读的文字。` };
    }
    titles.add(titleKey);
    bodies.add(bodyKey);
    sections.push(`【模拟课堂材料 ${label}】${title}\n${text}`);
  }
  const combined = [content, ...sections].join("\n\n");
  if (combined.length > LESSON_DETAIL_LIMIT) {
    return { issue: `教学内容和模拟材料合计超过 ${LESSON_DETAIL_LIMIT} 字符。请压缩概要和材料，保留每份正文及课堂要用的证据句。` };
  }
  return { content: combined, materialCount: materials.length };
}
