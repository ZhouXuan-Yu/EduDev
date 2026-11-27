import type { ClassroomPlanStart } from "../../shared/classroom-plan";
import { requestedLessonMaterials } from "./natural-lesson-materials";
import { namedTeachingMaterialMatches, namedTeachingMaterialTitles } from "./named-teaching-materials";
import { requestedLessonAgenda, type LessonAgendaSlot } from "./natural-lesson-agenda";

const grade = "(?:[一二三四五六七八九]年级|[1-9]年级|初[一二三]|高[一二三]|小学(?:低|中|高)年级)";
const subject = "(?:道德与法治|思想政治|综合实践活动|信息科技|语文|数学|英语|物理|化学|生物|地理|历史|科学|音乐|美术|体育|劳动)";
const connector = "(?:[\\s、，,:：]*)(?:的|上册|下册)?[\\s、，,:：]*";
const gradeFirst = new RegExp(`(${grade})${connector}(${subject})`, "g");
const subjectFirst = new RegExp(`(${subject})${connector}(${grade})`, "g");
const verb = "(?:设计|制作|生成|编写|写|拟定|准备|安排|做)";
const lead = "(?:新任务[：:]\\s*)?(?:(?:请你|请|麻烦|能否|可以|能不能|能帮我)\\s*)*";
const creation = new RegExp(`^${lead}(?:(?:(?:帮我|为我|给我)\\s*)?${verb}|(?:为|给)(?!我)[^。！？?\\n]{1,55}?${verb}|(?:给我|来)\\s*一[份篇节套])[^。！？?\\n]{0,200}?教案`, "u");

const delegate = "(?:(?:帮我|为我|给我)\\s*)?";
const ordinarySource = new RegExp(
  "^" + lead + delegate + "(?:依照|依据|根据|基于|参考|使用|结合|用)\\s*(?:具名(?:资料|材料)\\s*)?" +
  "(?:《([^《》\\r\\n]{1,160})》|([A-Za-z0-9][A-Za-z0-9_.-]{0,79}))(?=\\s|[，,：:]|" + verb + ")",
  "u",
);
const creationMinutes = new RegExp(
  "^" + lead + delegate + verb + "\\s*(?:[一1][份篇节套]\\s*)?([0-9０-９]{1,3})\\s*分钟(?=\\s*(?:的|" + grade + "|" + subject + "|《))",
  "gu",
);

export type NaturalLessonRequirements = { requestedMinutes?: number; requestedMaterials?: number; requestedAgenda?: LessonAgendaSlot[] };
type RegisteredLessonDraft = Extract<ClassroomPlanStart, { mode: "outline" }> & NaturalLessonRequirements & { sourceTitles?: string[] };
export type OrdinaryLessonDraft = NaturalLessonRequirements & { mode:"outline"; materialTitle:string; grade:string; subject?:string };

function requestedLessonMinutes(text: string, firstSentence: string): number | undefined {
  const minutes = new Set([
    ...firstSentence.matchAll(creationMinutes),
    ...text.matchAll(/(?:全课(?:时长)?|整节课(?:时长)?|总时长|总课时)\s*(?:为|共|[:：])?\s*([0-9０-９]{1,3})\s*分钟(?!\s*(?:左右|以内|以上|以下|到|至|[~～—–-]))(?=$|[\s，,。；;、])/gu),
    ...firstSentence.matchAll(/(?:[一1][份篇节套]\s*([0-9０-９]{1,3})\s*分钟的|教案[，,：:]\s*([0-9０-９]{1,3})\s*分钟(?!\s*(?:左右|以内|以上|以下|到|至|[~～—–-]))(?=$|[\s，,；;、]))/gu),
  ].map(match => Number((match[1] ?? match[2]).normalize("NFKC"))));
  if (minutes.size !== 1) return;
  const [value] = minutes;
  return value >= 2 && value <= 240 ? value : undefined;
}

/** Admission requires an explicit new draft and an unambiguous grade. A named local source can supply a missing subject. */
export function naturalLessonDraft(prompt: string): RegisteredLessonDraft | OrdinaryLessonDraft | undefined {
  const text = prompt.trim();
  const sources = namedTeachingMaterialMatches(text);
  const ordinary = sources.length === 0 ? ordinarySource.exec(text) : undefined;
  let request = ordinary ? text.slice(ordinary[0].length).replace(/^[\s，,：:]*/u, "") : text;
  for (const match of sources.toReversed())
    request = request.slice(0, match.index) + request.slice(match.index + match[0].length).replace(/^[\s，,：:]*/u, "");
  const direct = request.slice(0, 1200).match(creation)?.[0];
  if (!direct ||
      /教案(?:的)?(?:模板|格式|结构|提示词|样式|范例)|(?:依照|根据|依据|基于|沿用|使用|参考|用)\s*(?:我|这份|该|附件|上次|已选|已上传|(?:本地)?资料库)|(?:并|以及|同时).{0,20}(?:PPT|幻灯片|课件)/iu.test(request)) return;
  const prefix = request.split(/[。！？?\n]/u, 1)[0];
  const requestedMinutes = requestedLessonMinutes(request, prefix);
  const requestedMaterials = requestedLessonMaterials(request);
  const requestedAgenda = requestedLessonAgenda(request);
  const requirements = {
    ...(requestedMinutes === undefined ? {} : { requestedMinutes }),
    ...(requestedMaterials === undefined ? {} : { requestedMaterials }),
    ...(requestedAgenda === undefined ? {} : { requestedAgenda }),
  };
  if (ordinary) {
    const grades = new Set(direct.match(new RegExp(grade, "gu")) ?? []);
    const subjects = new Set(direct.match(new RegExp(subject, "gu")) ?? []);
    const materialTitle = (ordinary[1] ?? ordinary[2]).trim();
    if (!materialTitle || grades.size !== 1 || subjects.size > 1) return;
    return {
      mode: "outline", materialTitle, grade: [...grades][0],
      ...(subjects.size ? { subject: [...subjects][0] } : {}), ...requirements,
    };
  }
  const matches = [
    ...Array.from(prefix.matchAll(gradeFirst), match => [match[1], match[2]]),
    ...Array.from(prefix.matchAll(subjectFirst), match => [match[2], match[1]]),
  ];
  const pairs = new Map(matches.map(pair => [JSON.stringify(pair), pair]));
  if (pairs.size !== 1) return;
  const [[gradeName, subjectName]] = pairs.values();
  const sourceTitles = namedTeachingMaterialTitles(sources);
  return {
    mode: "outline",
    lesson: { grade: gradeName, subject: subjectName, curricula: [] },
    ...(sourceTitles.length ? { sourceTitles } : {}),
    ...requirements,
  };
}
