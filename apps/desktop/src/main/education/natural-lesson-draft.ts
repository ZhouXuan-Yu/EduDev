import type { ClassroomPlanStart } from "../../shared/classroom-plan";

const grade = "(?:[一二三四五六七八九]年级|[1-9]年级|初[一二三]|高[一二三]|小学(?:低|中|高)年级)";
const subject = "(?:道德与法治|思想政治|综合实践活动|信息科技|语文|数学|英语|物理|化学|生物|地理|历史|科学|音乐|美术|体育|劳动)";
const connector = "(?:[\\s、，,:：]*)(?:的|上册|下册)?[\\s、，,:：]*";
const gradeFirst = new RegExp(`(${grade})${connector}(${subject})`, "g");
const subjectFirst = new RegExp(`(${subject})${connector}(${grade})`, "g");
const verb = "(?:设计|制作|生成|编写|写|拟定|准备|安排|做)";
const lead = "(?:新任务[：:]\\s*)?(?:(?:请你|请|麻烦|能否|可以|能不能|能帮我)\\s*)*";
const creation = new RegExp(`^${lead}(?:(?:(?:帮我|为我|给我)\\s*)?${verb}|(?:为|给)(?!我)[^。！？?\\n]{1,55}?${verb}|(?:给我|来)\\s*一[份篇节套])[^。！？?\\n]{0,200}?教案`, "u");

/** Only explicit new draft requests with an unambiguous subject and grade bind the classroom tool. */
export function naturalLessonDraft(prompt: string): Extract<ClassroomPlanStart, { mode: "outline" }> | undefined {
  const text = prompt.trim().slice(0, 1200);
  const direct = text.match(creation)?.[0];
  if (!direct ||
      /教案(?:的)?(?:模板|格式|结构|提示词|样式|范例)|(?:根据|依据|基于|沿用|使用|参考)(?:我|这份|该|附件|上次|已选|已上传|资料库)|(?:并|以及|同时).{0,20}(?:PPT|幻灯片|课件)/iu.test(text)) return;
  const prefix = text.split(/[。！？?\n]/u, 1)[0];
  const matches = [
    ...Array.from(prefix.matchAll(gradeFirst), match => [match[1], match[2]]),
    ...Array.from(prefix.matchAll(subjectFirst), match => [match[2], match[1]]),
  ];
  const pairs = new Map(matches.map(pair => [JSON.stringify(pair), pair]));
  if (pairs.size !== 1) return;
  const [[gradeName, subjectName]] = pairs.values();
  return { mode: "outline", lesson: { grade: gradeName, subject: subjectName, curricula: [] } };
}
