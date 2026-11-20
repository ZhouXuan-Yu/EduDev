import { createHash } from "node:crypto";
import { leadingGraphicChoices } from "./material-structure-graphic-choices";
import {applyAssessmentNumbers,restoreAssessmentFormulaOrder,scoredAssessmentNumber,stripAssessmentNumber} from "./material-structure-numbering";
import {
  DOCUMENT_STRUCTURE_SCHEMA,
  DOCUMENT_STRUCTURE_ENGINE,
  type StructureIssue,
  type StructureLine,
  type StructureParagraph,
  type StructurePage,
  type StructurePageInput,
  type StructureQuestion,
  type ParagraphRole,
} from "../../shared/material-document-structure";
import type { PageBox } from "../../shared/material-page-preview";
import type { PageBlock } from "../../shared/material-page-blocks";

const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const area = (b: PageBox) => (b[2] - b[0]) * (b[3] - b[1]);
const overlap = (a: PageBox, b: PageBox) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
const union = (a: PageBox, b: PageBox): PageBox => [
  Math.min(a[0], b[0]),
  Math.min(a[1], b[1]),
  Math.max(a[2], b[2]),
  Math.max(a[3], b[3]),
];
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] || 0.015;
const assetKinds = new Set([
  "image",
  "chart",
  "table",
  "display_formula",
  "inline_formula",
]);
const imageKinds = new Set(["image", "chart"]);
const figureReference = /如图|见图|下图|图中|下表|表中/u;
const figureNumber = /图[ 	]*([1-9]\d{0,3})(?![\d.．—~～-])/gu;
const furnitureKinds = new Set([
  "header",
  "header_image",
  "footer",
  "footer_image",
  "number",
]);
const questionCue =
  /[?？]|求|计算|解方程|选择|填空|判断|已知|证明|下列|回答|写出|如图|简述|说明|[（(]\s*[）)]|_{2,}/u;
const examAdministration =
  /答题[纸卡]|姓名|报名号|考场|座位|条形码|考试时间|试卷上作答|填涂|(?:用|使用)[^，。；]{0,22}(?:铅笔|钢笔|水笔|圆珠笔|墨水)[^。；]{0,28}(?:作答|填写|书写)|(?:本卷|本场考试|试卷)(?:共|满分|时间)/u;
const sectionHeading =
  /^(?:[一二三四五六七八九十百]+[、．.]|第[一二三四五六七八九十百\d]+[章节单元])/u;
const printedExampleLead = /^例(?:题)?[ \t]*\d{1,5}(?:[.．、:：][ \t]*|[ \t]+)\p{Script=Han}/u;
const numberedFigureCaption = /^第\s*(\d{1,5})\s*题\s*(?:图|插图|示意图|表)[。．.]?$/u;
const previousMaterial =
  /(?:上[述面]|前述|以上|所给|同一份)的?(?:材料|短文|文章|资料)|(?:根据|依据|结合|参照)\s*该?(?:材料|短文|文章)|上文|前文|文中|文意/u;
const materialRange = /(?:回答|完成)?\s*(\d+)\s*[～~—–-]\s*(\d+)\s*题/u;

/** Whitespace at a line boundary is derived layout. All original line strings remain in the snapshot. */
export function joinStructureLines(lines: string[]) {
  let text = "";
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const join =
      /[\p{Script=Han}，。！？；：、（]$/u.test(text) ||
      /^[\p{Script=Han}，。！？；：、）]/u.test(line);
    text += (text && !join ? " " : "") + line;
  }
  return text;
}

function lineRole(
  line: StructureLine,
  regions: PageBlock[],
  page: Pick<StructurePageInput, "page" | "totalPages">,
): { role: ParagraphRole; marker?: StructureParagraph["marker"] } {
  const text = line.text.trim(),
    owned = regions.filter((region) => line.regionIds.includes(region.id));
  const kind = owned.sort((a, b) => area(a.box) - area(b.box))[0]?.kind;
  if (kind === "number" && line.box[1] >= 0.88) {
    const counter = /^(?:第[ \t]*(\d{1,5})[ \t]*页(?:[ \t]*共[ \t]*(\d{1,5})[ \t]*页)?|(\d{1,5})(?:\s*[/／]\s*(\d{1,5}))?)$/u.exec(text);
    const sheet = counter?.[1] || counter?.[3], total = counter?.[2] || counter?.[4];
    if (Number(sheet) === page.page && (!total || Number(total) === page.totalPages)) return { role: "footer" };
  }
  if (kind === "header" || kind === "header_image") return { role: "header" };
  if (
    kind === "footer" ||
    kind === "footer_image"
  )
    return { role: "footer" };
  if (
    kind === "footnote" ||
    kind === "vision_footnote" ||
    kind === "aside_text"
  )
    return { role: "note" };
  if (sectionHeading.test(text)) return { role: "heading" };
  if (/^(?:【|\[)?(?:参考答案|答案)(?:】|\]|[:：])/u.test(text))
    return { role: "answer" };
  if (/^(?:【|\[)?(?:解析|分析|解答)(?:】|\]|[:：])/u.test(text))
    return { role: "analysis" };
  const child = /^(?:[（(](\d{1,3})[）)]|([①-⑳]))[ \t]*/u.exec(text);
  if (child)
    return {
      role: "subquestion",
      marker: { kind: "child", label: child[1] || child[2] },
    };
  const option =
    /^[、，。]?\s*(?:[（(]([A-H])[）)]|([A-H])[.．、])[ \t]*/u.exec(text);
  if (option)
    return {
      role: "option",
      marker: { kind: "option", label: option[1] || option[2] },
    };
  if (numberedFigureCaption.test(text)) return { role: "figure" };
  const parent =
    /^(?:第\s*(\d{1,5})\s*题\s*[:：]?|(\d{1,5})[.．、](?!\d))[ \t]*/u.exec(
      text,
    );
  if (parent)
    return {
      role: "question",
      marker: { kind: "parent", label: parent[1] || parent[2] },
    };
  const scored = scoredAssessmentNumber(text);
  if (scored) return { role: "question", marker: { kind: "parent", label: scored } };
  if (/^(?:阅读\s*(?:下列|下面|以下)?|(?:根据|依据)\s*(?:下列|下面|以下))(?:材料|短文|文章)/u.test(text) ||
      /(?:回答|完成)/u.test(text) && materialRange.test(text)) return { role:"material" };
  if (kind === "doc_title" || kind === "paragraph_title")
    return { role: "heading" };
  if (kind === "table") return { role: "table" };
  if (kind === "display_formula" || kind === "inline_formula")
    return { role: "formula" };
  if (kind === "image" || kind === "chart" || kind === "figure_title")
    return { role: "figure" };
  return { role: "body" };
}

type LineRole = ReturnType<typeof lineRole>;
const centerY = (box: PageBox) => (box[1] + box[3]) / 2;
const widthOf = (box: PageBox) => box[2] - box[0];
const overlappingRuns = (left: StructureLine[], right: StructureLine[], height: number) =>
  left.length >= 2 && right.length >= 2 &&
  Math.min(Math.max(...left.map(l => l.box[3])), Math.max(...right.map(l => l.box[3]))) -
    Math.max(Math.min(...left.map(l => l.box[1])), Math.min(...right.map(l => l.box[1]))) >= height * 1.5;

/** Require distinct baseline pairs, even when a formula has several OCR boxes in one row. */
function hasParallelRows(left: StructureLine[], right: StructureLine[], height: number) {
  const byCenter = (a: StructureLine, b: StructureLine) => centerY(a.box) - centerY(b.box);
  const a = left.sort(byCenter), b = right.sort(byCenter);
  let i = 0, j = 0, lastBottom = 0, count = 0;
  while (i < a.length && j < b.length) {
    const x = a[i].box, y = b[j].box;
    const delta = centerY(x) - centerY(y);
    if (Math.abs(delta) <= height * 0.7 && Math.min(x[3], y[3]) > Math.max(x[1], y[1])) {
      if (Math.min(x[1], y[1]) >= lastBottom) {
        if (++count === 2) return true;
        lastBottom = Math.max(x[3], y[3]);
      }
      i++;
      j++;
    } else if (delta < 0) i++;
    else j++;
  }
  return false;
}

function alignedStarts(lane: StructureLine[], height: number) {
  // Tall OCR boxes such as diagonal stamps do not establish a run of body text.
  const ordered = lane.filter(line => line.box[3] - line.box[1] <= height * 2)
    .sort((a, b) => a.box[0] - b.box[0]);
  const aligned = new Set<StructureLine>();
  for (let i = 1; i < ordered.length; i++) {
    const current = ordered[i], previous = ordered[i - 1];
    if (current.box[0] - previous.box[0] <= 0.025 && Math.abs(centerY(current.box) - centerY(previous.box)) >= height) {
      aligned.add(previous);
      aligned.add(current);
    }
  }
  return [...aligned];
}

function hasIndependentLanes(
  left: StructureLine[], right: StructureLine[], owners: Map<string, PageBlock | undefined>,
  gutter: number, height: number,
) {
  // Fragments of a reliably recognized single text block cannot vote for a split through that block.
  const independent = (line: StructureLine) => {
    const owner = owners.get(line.id);
    return !owner || owner.box[0] >= gutter - 0.008 || owner.box[2] <= gutter + 0.008;
  };
  const leftLane = left.filter(independent), rightLane = right.filter(independent);
  if (!overlappingRuns(leftLane, rightLane, height)) return false;
  if (hasParallelRows(leftLane, rightLane, height) ||
    overlappingRuns(alignedStarts(leftLane, height), alignedStarts(rightLane, height), height)) return true;

  // Separate detected text blocks can corroborate genuine lanes with staggered baselines.
  const repeatedRegion = (lane: StructureLine[], onSide: (box: PageBox) => boolean) => {
    const counts = new Map<PageBlock, number>();
    for (const line of lane) {
      const owner = owners.get(line.id);
      if (owner && onSide(owner.box)) counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
    return lane.filter(line => {
      const owner = owners.get(line.id);
      return owner && (counts.get(owner) ?? 0) >= 2;
    });
  };
  return overlappingRuns(repeatedRegion(leftLane, box => box[2] <= gutter),
    repeatedRegion(rightLane, box => box[0] >= gutter), height);
}

/** Find gutters between neighboring text runs. Options affect gutter clearance,
 * but cannot create columns on their own. */
function columnsFor(
  lines: StructureLine[],
  roles: Map<string, LineRole>,
  regions: PageBlock[],
  height: number,
) {
  const ink = lines.filter(line =>
    !["header", "footer", "figure", "note", "formula", "table", "heading"].includes(roles.get(line.id)!.role) &&
    widthOf(line.box) < 0.65,
  );
  const body = ink.filter(line => roles.get(line.id)!.role !== "option" && widthOf(line.box) >= Math.max(0.10, height * 4));
  const byId = new Map(regions.map(region => [region.id, region]));
  const textOwners = new Map(body.map(line => {
    const owner = byId.get(line.regionIds[0]);
    return [line.id, owner?.kind === "text" && owner.score >= 0.8 ? owner : undefined] as const;
  }));
  const gutters: { x: number; strength: number; clearance: number }[] = [];
  let unresolved = false;
  for (let i = 32; i <= 168; i++) {
    const x = i / 200;
    const left = body.filter(({ box }) => box[2] <= x - 0.004 && box[2] >= x - 0.14);
    const right = body.filter(({ box }) => box[0] >= x + 0.004 && box[0] <= x + 0.14);
    if (!overlappingRuns(left, right, height)) continue;
    const crossings = ink.filter(({ box }) => box[0] < x - 0.008 && box[2] > x + 0.008).length;
    if (crossings > Math.max(1, Math.floor(ink.length * 0.025))) {
      unresolved ||= hasIndependentLanes(left, right, textOwners, x, height);
      continue;
    }
    const clearance = Math.min(x - Math.max(...left.map(l => l.box[2])), Math.min(...right.map(l => l.box[0])) - x);
    gutters.push({ x, strength: Math.min(left.length, right.length) - crossings * 3, clearance });
  }
  const splits: number[] = [];
  for (const { x } of gutters.sort((a, b) => b.strength - a.strength || b.clearance - a.clearance)) {
    if (splits.every(other => Math.abs(x - other) >= 0.16)) splits.push(x);
  }
  const bounds = [0, ...splits.sort((a, b) => a - b), 1];
  // When side-by-side short parents have independent aligned rows, preserve
  // the page as an uncertain layout even without sufficient gutter votes.
  const parents = splits.length ? [] : ink.filter(line => roles.get(line.id)!.role === "question" &&
    ink.some(part => part !== line && Math.abs(part.box[0] - line.box[0]) < 0.055));
  const sparseLanes = parents.some(left => parents.some(right =>
    right.box[0] - left.box[2] >= 0.12 &&
    Math.abs(centerY(left.box) - centerY(right.box)) <= height * 2,
  ));
  return {
    columns: bounds.slice(1).map((end, i): PageBox => [bounds[i], 0, end, 1]),
    unresolved: sparseLanes || unresolved && !splits.length,
  };
}

function orderedLines(lines: StructureLine[], columns: PageBox[], roles: Map<string, LineRole>) {
  const vertical = (a: StructureLine, b: StructureLine) =>
    Math.abs(centerY(a.box) - centerY(b.box)) < Math.min(a.box[3] - a.box[1], b.box[3] - b.box[1]) * 0.45
      ? a.box[0] - b.box[0]
      : a.box[1] - b.box[1] || a.box[0] - b.box[0];
  if (columns.length === 1)
    return { rows: [...lines].sort(vertical).map(line => ({ line, column: 0 })), unresolved: false };

  const ordered = lines.map(line => {
    const portions = columns.map(box => Math.max(0, Math.min(box[2], line.box[2]) - Math.max(box[0], line.box[0])));
    const column = portions.indexOf(Math.max(...portions));
    const crosses = portions.filter(p => p > 0.012 && p >= widthOf(line.box) * 0.12).length > 1;
    const role = roles.get(line.id)!.role;
    const spanning = crosses && (role === "heading" || role === "material" || role === "body" && widthOf(line.box) >= 0.65);
    const furniture = ["header", "footer", "note", "figure", "formula", "table"].includes(role);
    return { line, column: spanning ? -1 : column, unresolved: crosses && !spanning && !furniture };
  });
  const separators = ordered.filter(row => row.column < 0).sort((a, b) => vertical(a.line, b.line));
  const body = ordered.filter(row => row.column >= 0).sort((a, b) => centerY(a.line.box) - centerY(b.line.box));
  let start = 0;
  const rows: { line: StructureLine; column: number }[] = [];
  for (const separator of [...separators, undefined]) {
    let end = start;
    while (end < body.length && (!separator || centerY(body[end].line.box) < separator.line.box[1])) end++;
    rows.push(...body.slice(start, end).sort((a, b) => a.column - b.column || vertical(a.line, b.line)));
    if (separator) rows.push(separator);
    start = end;
  }
  return { rows, unresolved: ordered.some(row => row.unresolved) };
}

export function recoverStructurePage(input: StructurePageInput): StructurePage {
  if (input.lines.length > 2000 || input.regions.length > 256)
    throw Error("unit_too_large");
  const recovered =
    [
      ...(input.nativeRecovery?.accepted.map((item) => item.line) ?? []),
      ...(input.printedRecovery?.parents.map((item) => item.line) ?? []),
    ];
  const printedLines = new Map(input.printedRecovery?.parents.map(item => [item.line.id, item]));
  const blankBefore = new Map(input.printedRecovery?.blanks.map(blank => [blank.afterId, blank.beforeId]));
  const lines: StructureLine[] = [...input.lines, ...recovered].map((line) => {
    const box: PageBox = [
      Math.min(...line.normalizedQuad.map((p) => p[0])),
      Math.min(...line.normalizedQuad.map((p) => p[1])),
      Math.max(...line.normalizedQuad.map((p) => p[0])),
      Math.max(...line.normalizedQuad.map((p) => p[1])),
    ];
    const owned = input.regions
      .filter((region) => overlap(region.box, box) / area(box) >= 0.6)
      .sort((a, b) => area(a.box) - area(b.box));
    return {
      id: `p${input.page}-${line.id}`,
      sourceId: line.id,
      ...(line.id.startsWith("native-crop-")
        ? { origin: "pdf_native_crop" as const }
        : printedLines.has(line.id) ? { origin: "local_ocr_crop" as const } : {}),
      text: line.text,
      box,
      quad: line.normalizedQuad,
      score: line.score,
      regionIds: owned.map((region) => region.id),
    };
  });
  const height = median(lines.map((line) => line.box[3] - line.box[1]));
  const roles = new Map(lines.map(line => [line.id, lineRole(line, input.regions, input)]));
  const layout = columnsFor(lines, roles, input.regions, height);
  const { columns } = layout;
  const ordered = orderedLines(lines, columns, roles);
  applyAssessmentNumbers(ordered.rows, roles, height, questionCue);
  const formulas = restoreAssessmentFormulaOrder(ordered.rows, roles, height);
  const paragraphs: StructureParagraph[] = [];
  const byId = new Map(lines.map((line) => [line.id, line]));
  for (const { line, column } of formulas.rows) {
    const detected = roles.get(line.id)!,
      last = [...paragraphs]
        .reverse()
        .find((p) => !["figure", "header", "footer"].includes(p.role)),
      previous = last && byId.get(last.lineIds.at(-1)!);
    const compatible =
      detected.role === "body" &&
      last &&
      [
        "body",
        "question",
        "option",
        "subquestion",
        "answer",
        "analysis",
        "material",
      ].includes(last.role);
    const gap = previous ? line.box[1] - previous.box[3] : Infinity;
    const columnWidth =
      column < 0 ? 1 : columns[column][2] - columns[column][0];
    const aligned =
      previous && Math.abs(line.box[0] - previous.box[0]) < columnWidth * 0.09;
    const newIndent =
      last && line.box[0] - last.anchor.box[0] > columnWidth * 0.035;
    const shortEnd =
      previous &&
      previous.box[2] - previous.box[0] < columnWidth * 0.65 &&
      /[。！？.!?]$/u.test(previous.text.trim());
    const sameRow =
      previous &&
      Math.abs(
        (line.box[1] + line.box[3] - previous.box[1] - previous.box[3]) / 2,
      ) <
        height * 0.45 &&
      line.box[0] >= previous.box[2] - 0.005 &&
      line.box[0] - previous.box[2] < 0.1;
    const merge =
      compatible &&
      last.column === column &&
      previous &&
      (sameRow ||
        (gap >= -height * 0.65 &&
          gap < height * 0.8 &&
          aligned &&
          !(newIndent && shortEnd)));
    const regions = input.regions
      .filter((region) => line.regionIds.includes(region.id))
      .sort((a, b) => area(a.box) - area(b.box));
    const ambiguous =
      regions.length > 1 &&
      area(regions[0].box) / area(regions[1].box) > 0.85 &&
      regions[0].kind !== regions[1].kind;
    const issues: StructureIssue[] = [
      ...(formulas.uncertain.has(line.id) ? ["ambiguous_asset" as const] : []),
      ...(printedLines.get(line.sourceId)?.uncertain ? ["printed_crop_unconfirmed" as const] : []),
      ...(line.score < 0.85 ? ["low_ocr_score" as const] : []),
      ...(!line.regionIds.length || ambiguous || regions[0]?.score < 0.5
        ? ["ambiguous_region" as const]
        : []),
    ];
    if (merge) {
      last.lineIds.push(line.id);
      last.regionIds = [...new Set([...last.regionIds, ...line.regionIds])];
      last.rawText += "\n" + line.text;
      last.text = joinStructureLines(last.lineIds.map((id, i) =>
        (i > 0 && blankBefore.get(id) === last.lineIds[i - 1] ? "____" : "") + byId.get(id)!.text));
      last.anchor.box = union(last.anchor.box, line.box);
      last.confidence = Math.min(last.confidence, line.score);
      last.issues = [...new Set([...last.issues, ...issues])];
    } else
      paragraphs.push({
        id: `p${input.page}-paragraph-${paragraphs.length + 1}`,
        role: detected.role,
        column,
        lineIds: [line.id],
        regionIds: [...line.regionIds],
        rawText: line.text,
        text: line.text.trim(),
        anchor: { page: input.page, box: [...line.box] },
        confidence: line.score,
        issues,
        ...(detected.marker ? { marker: detected.marker } : {}),
        needsReview: true,
      });
  }
  const assigned = paragraphs.flatMap((paragraph) => paragraph.lineIds);
  if (
    assigned.length !== lines.length ||
    new Set(assigned).size !== lines.length
  )
    throw Error("structure_coverage_failed");
  return {
    schemaVersion: DOCUMENT_STRUCTURE_SCHEMA,
    engine: DOCUMENT_STRUCTURE_ENGINE,
    resourceId: input.resourceId,
    version: input.version,
    page: input.page,
    totalPages: input.totalPages,
    rasterSha256: input.rasterSha256,
    sourceEngine: input.sourceEngine,
    layoutEngine: input.layoutEngine,
    ...(input.rasterSource ? { rasterSource: input.rasterSource } : {}),
    rawText: input.lines.map((line) => line.text).join("\n"),
    ...(input.nativeRecovery ? { nativeRecovery: input.nativeRecovery } : {}),
    ...(input.printedRecovery ? { printedRecovery: input.printedRecovery } : {}),
    lines,
    regions: input.regions,
    columns,
    paragraphs,
    issues: [
      ...(input.nativeRecovery?.unresolved.length ? ["native_unconfirmed" as const] : []),
      ...(layout.unresolved || ordered.unresolved ? ["ambiguous_columns" as const] : []),
    ],
    needsReview: true,
  };
}

type Pending = {
  question: StructureQuestion;
  paragraphs: StructureParagraph[];
  pages: Map<number, StructurePage>;
};
/** A detached printed prompt can survive a cropped number. The neighboring
 * marker defines a boundary only. Unassigned marks remain in the page receipt. */
function isolatedUnnumberedPrompt(pending: Pending, page: StructurePage, next: StructureParagraph) {
  const [lead, ...remainder] = pending.paragraphs;
  if (pending.question.number !== "0" || pending.question.kind !== "question" ||
      pending.question.sharedMaterialIds.length || pending.pages.size !== 1 ||
      !pending.pages.has(page.page) || page.issues.length || lead?.role !== "body" ||
      lead.issues.length || lead.confidence < 0.9 || lead.column < 0 ||
      next.column !== lead.column || next.issues.length || next.confidence < 0.9 ||
      page.paragraphs.find(p => !["heading", "header", "footer", "figure", "note"].includes(p.role)) !== lead ||
      lead.anchor.box[1] > 0.2 || lead.text.length < 24 || lead.text.length > 1000 ||
      !/\p{Script=Han}{5}/u.test(lead.text) ||
      !/[?？](?:\s*[（(][^?？]{1,120}[）)])?$/u.test(lead.text) ||
      previousMaterial.test(lead.text) || figureReference.test(lead.text) ||
      /上题|前题|接上|续上|上页|同上|继续|如下图|如表|见表/u.test(lead.text) ||
      remainder.some(p => !["body", "formula"].includes(p.role) ||
        p.column !== lead.column || /\p{Script=Han}|[?？]/u.test(p.text))) return;
  const ownedText = (p: StructureParagraph, minScore: number) => page.regions.find(region =>
    region.kind === "text" && region.score >= minScore && p.regionIds.includes(region.id));
  const a = ownedText(lead, 0.85), b = ownedText(next, 0.8);
  if (!a || !b || a.id === b.id ||
      overlap(a.box,b.box) > 0 || Math.abs(a.box[0] - b.box[0]) > 0.12 ||
      a.box[2] - a.box[0] < (page.columns[lead.column][2] - page.columns[lead.column][0]) * 0.4 ||
      b.box[1] - Math.max(a.box[3], ...remainder.map(p => p.anchor.box[3])) < 0.06 ||
      page.regions.some(region => assetKinds.has(region.kind) &&
        overlap(region.box, lead.anchor.box) > area(region.box) * 0.12)) return;
  return lead;
}

/** An image-only continuation can end before the next parent marker.
 * Without a matching printed caption it is a lead for teacher review. */
function leadingQuestionFigure(
  question: StructureQuestion,
  pending: Pending,
  page: StructurePage,
  next: StructureParagraph,
) {
  const [first] = pending.paragraphs;
  const last = pending.paragraphs.at(-1);
  const prior = last && pending.pages.get(last.anchor.page);
  if (!prior || !last || pending.pages.size !== 1 || prior.page + 1 !== page.page ||
      prior.columns.length !== 1 || page.columns.length !== 1 ||
      prior.issues.length || page.issues.length || question.kind !== "question" ||
      question.sharedMaterialIds.length || question.assets.length ||
      question.answer || question.analysis ||
      Number(next.marker?.label) !== Number(question.number) + 1 ||
      Math.abs(first.anchor.box[0] - next.anchor.box[0]) > 0.05 ||
      last.anchor.box[3] < 0.78 || next.anchor.box[1] > 0.38) return;

  const start = page.paragraphs.indexOf(next);
  const prefix = page.paragraphs.slice(0, start).filter((p) => p.role !== "header");
  if (prefix.some((p) => p.role !== "figure")) return;
  const end = next.anchor.box[1];
  const before = page.regions.filter((r) => assetKinds.has(r.kind) && r.box[1] < end);
  if (before.length !== 1) return;
  const [image] = before;
  if (!imageKinds.has(image.kind) || image.score < 0.85 || image.box[3] > end - 0.008 ||
      image.box[3] - image.box[1] < 0.04 || image.box[2] - image.box[0] < 0.04) return;

  const after = page.paragraphs.slice(start + 1);
  const boundary = after.find((p) => p.marker?.kind === "parent" || p.role === "heading" || p.role === "material");
  const nextEnd = boundary?.anchor.box[1] ?? 0.92;
  const ownText = [next, ...after.filter((p) => p.anchor.box[1] < nextEnd)]
    .filter((p) => p.role !== "figure").map((p) => p.text).join("\n");
  const references = [...question.stem.matchAll(figureNumber)].map((match) => match[1]);
  const captions = prefix.filter((p) => p.regionIds.some((id) =>
    page.regions.some((r) => r.id === id && r.kind === "figure_title")));
  const caption = captions[0];
  const overlapX = caption && Math.min(caption.anchor.box[2], image.box[2]) -
    Math.max(caption.anchor.box[0], image.box[0]);
  const label = caption?.text.match(/^图\s*([1-9]\d{0,3})(?:$|[\s:：])/u)?.[1];
  const containedLabels = prefix.every((p) => p === caption ||
    overlap(p.anchor.box, image.box) >= area(p.anchor.box) * 0.85);
  if (!containedLabels) return;
  if (caption && captions.length === 1 && label && references.length === 1 &&
      label === references[0] && ![...ownText.matchAll(figureNumber)].some((m) => m[1] === label) &&
      overlapX && overlapX > 0 && caption.confidence >= 0.85 &&
      Math.abs(caption.anchor.box[1] - image.box[3]) < 0.04 &&
      caption.anchor.box[3] < end - 0.008) {
    return { image, caption };
  }

  // A complete printed A–D group and independent next-question figures
  // distinguish this lead from image-only choices or the next question's art.
  if (captions.length || references.length || !/(?:如图|见图|下图)/u.test(question.stem) ||
      question.subquestions.length ||
      question.options.length !== 4 || !question.options.every((o, i) =>
        o.label === "ABCD"[i] && o.text.replace(/^[（(]?[A-D][）).．、]?[ \t]*/u, "").trim().length >= 2) ||
      !page.regions.some((r) => imageKinds.has(r.kind) && r.score >= 0.75 &&
        r.box[1] >= next.anchor.box[3] && r.box[3] < nextEnd)) return;
  return { image };
}

function attachStructureAsset(question: StructureQuestion, page: StructurePage, region: PageBlock, choiceLabel?: string) {
  const lines = page.lines.filter((line) => overlap(line.box, region.box) / area(line.box) > 0.6);
  question.assets.push({
    page: page.page, regionId: region.id, kind: region.kind, box: [...region.box],
    ...(choiceLabel ? { choiceLabel } : {}),
    lineIds: lines.map((line) => line.id), rawText: lines.map((line) => line.text).join("\n"),
  });
  if (lines.length) question.confidence = Math.min(question.confidence, ...lines.map((line) => line.score));
  if (region.score < 0.5) question.issues.push("ambiguous_asset");
  if (lines.some((line) => line.score < 0.85)) question.issues.push("low_ocr_score");
}
/** Streaming book assembler. Retains one unfinished question and bounded shared-material context. */
export class StructureQuestionAssembler {
  private pending?: Pending;
  private section = "";
  private shared: StructureParagraph[] = [];
  private sharedPages = new Map<number, StructurePage>();
  private sharedOverflow = false;
  private inferredShared = false;
  private unassigned: StructureParagraph[] = [];
  private unassignedPages = new Map<number, StructurePage>();
  private sharedFrom?: number;
  private sharedUntil?: number;
  private instructions = false;
  private answers = false;
  private sequence = 0;
  push(page: StructurePage): StructureQuestion[] {
    const output: StructureQuestion[] = [];
    let choiceCaptions: Set<string> | undefined;
    let uncertainLeadingTableColumn: number | undefined;
    const pending = this.pending;
    if (pending?.question.kind === "question" && !pending.question.sharedMaterialIds.length &&
        pending.pages.size === 1) {
      const previous = pending.pages.values().next().value!;
      const group = leadingGraphicChoices(previous, pending.paragraphs, page);
      if (group) {
        if (group.choices.length) {
          choiceCaptions = new Set(group.choices.map((choice) => choice.caption.id));
          output.push(this.finish(undefined, group));
        } else pending.question.issues.push("missing_figure");
      }
    }
    const pageLead = page.paragraphs.find(p =>
      !["header", "footer", "figure", "note"].includes(p.role));
    if (this.pending?.question.kind === "question" && this.pending.pages.size === 1 &&
        this.pending.paragraphs[0].anchor.page + 1 === page.page && !page.issues.length &&
        pageLead && pageLead.anchor.box[1] < 0.3 && !pageLead.issues.length &&
        printedExampleLead.test(pageLead.text) &&
        this.pending.paragraphs.filter(p => p.marker?.kind === "option")
          .map(p => p.marker!.label).join("") === "ABCD")
      output.push(this.finish());
    if (page.issues.includes("native_unconfirmed") && this.pending) {
      this.pending.question.issues.push("native_unconfirmed");
      this.pending.pages.set(page.page, page);
      this.pending.question.pageRange[1] = page.page;
    }
    for (const paragraph of page.paragraphs) {
      if (choiceCaptions?.has(paragraph.id)) continue;
      if (["header", "footer", "figure", "note"].includes(paragraph.role))
        continue;
      if (paragraph.role === "heading") {
        if (paragraph.text === this.section) continue;
        if (this.pending) output.push(this.finish());
        this.section = paragraph.text;
        this.shared = [];
        this.sharedPages.clear();
        this.sharedOverflow = false;
        this.sharedFrom = undefined;
        this.sharedUntil = undefined;
        this.unassigned = [];
        this.unassignedPages.clear();
        this.instructions = /考生注意|注意事项|考试说明|作答要求/u.test(
          paragraph.text,
        );
        this.answers = /参考答案|答案[及与和]解析|答案详解/u.test(
          paragraph.text,
        );
        continue;
      }
      if (/^(?:考生注意|注意事项|考试说明)[:：]?$/u.test(paragraph.text)) {
        this.instructions = true;
        this.unassigned = [];
        this.unassignedPages.clear();
        continue;
      }
      if (paragraph.role === "material") {
        if (this.pending) output.push(this.finish());
        this.shared = [paragraph];
        this.unassigned = [];
        this.unassignedPages.clear();
        this.sharedPages = new Map([[page.page, page]]);
        this.sharedOverflow = false;
        const range = materialRange.exec(paragraph.text);
        this.sharedFrom = range ? Number(range[1]) : undefined;
        this.sharedUntil = range ? Number(range[2]) : undefined;
        if (!this.sharedFrom || !this.sharedUntil || this.sharedFrom > this.sharedUntil) {
          this.sharedFrom = undefined;
          this.sharedUntil = undefined;
        }
        continue;
      }
      const previous = this.pending?.paragraphs.at(-1);
      if (previous?.role === "option" && previous.anchor.page === page.page &&
          previous.column >= 0 && paragraph.column > previous.column &&
          paragraph.role === "table") {
        const related = page.paragraphs.filter(part => part.role === "table" &&
          part.regionIds.some(id => paragraph.regionIds.includes(id)));
        const tableText = related.map(part => part.text).join(" ");
        const scoreCard = paragraph.anchor.box[1] < 0.18 &&
          /题序|题号/u.test(tableText) && /得分/u.test(tableText) && /评卷人|阅卷人|总分/u.test(tableText);
        if (scoreCard && !this.pending!.paragraphs.some(part => /如表|见表|下表|表中/u.test(part.text))) {
          output.push(this.finish());
          continue;
        }
        // Keep a possible continuation with its original anchors pending review.
        this.pending!.question.issues.push("ambiguous_columns");
        uncertainLeadingTableColumn = paragraph.column;
      }
      if (paragraph.marker?.kind === "parent") {
        const number = paragraph.marker.label,
          previous = this.pending?.paragraphs[0],
          indent =
            previous &&
            paragraph.column === previous.column &&
            paragraph.anchor.page === previous.anchor.page &&
            paragraph.anchor.box[0] - previous.anchor.box[0] > 0.025;
        if (
          indent &&
          this.pending &&
          this.pending.question.number !== "0" &&
          (Number(number) <= Number(this.pending.question.number) ||
            /回答下列|回答以下|各小题|分别求|以下问题/u.test(
              this.pending.paragraphs[0].text,
            ))
        ) {
          this.append(
            {
              ...paragraph,
              role: "subquestion",
              marker: { kind: "child", label: number },
            },
            page,
          );
          continue;
        }
        if (this.instructions) {
          if (!questionCue.test(paragraph.text) || examAdministration.test(paragraph.text)) continue;
          this.instructions = false;
        }
        const numberingConflict =
          !!this.pending &&
          this.pending.question.number !== "0" &&
          Number(number) <= Number(this.pending.question.number);
        let precedingOrphan = false;
        if (numberingConflict)
          this.pending!.question.issues.push("numbering_conflict");
        if (this.pending) {
          const completed = this.finish({ page, next: paragraph });
          precedingOrphan = completed.number === "0" && !completed.issues.includes("missing_question_number");
          output.push(completed);
        }
        if (this.unassigned.length) {
          // Preserve an ambiguous lead-in for the immediately following
          // question. A new parent marker does not extend its ownership.
          if (!this.shared.length && this.unassignedPages.size === 1 &&
            this.unassigned.every(part => part.anchor.page === page.page &&
              part.column === paragraph.column && part.anchor.box[3] <= paragraph.anchor.box[1])) {
            this.shared = this.unassigned;
            this.sharedPages = this.unassignedPages;
            this.sharedFrom = undefined;
            this.sharedUntil = undefined;
            this.inferredShared = true;
          }
          this.unassigned = [];
          this.unassignedPages = new Map();
        }
        if (this.sharedUntil && Number(number) > this.sharedUntil) {
          this.shared = [];
          this.sharedPages.clear();
          this.sharedOverflow = false;
          this.sharedFrom = undefined;
          this.sharedUntil = undefined;
        }
        const ownsShared = !this.sharedFrom || Number(number) >= this.sharedFrom;
        this.pending = {
          question: {
            id: "structure-question-" + ++this.sequence,
            number,
            section: this.section,
            kind: this.answers ? "answer" : "question",
            paragraphIds: [],
            sharedMaterialIds: ownsShared ? this.shared.map((value) => value.id) : [],
            stem: "",
            answer: "",
            analysis: "",
            options: [],
            subquestions: [],
            anchors: [],
            assets: [],
            pageRange: [page.page, page.page],
            confidence: paragraph.confidence,
            issues: [],
            status: "needs_review",
            needsReview: true,
          },
          paragraphs: [],
          pages: new Map(),
        };
        if (ownsShared) this.pending.pages = new Map(this.sharedPages);
        if (numberingConflict)
          this.pending.question.issues.push("numbering_conflict");
        if (precedingOrphan)
          this.pending.question.issues.push("shared_material_scope");
        if (ownsShared && this.sharedOverflow)
          this.pending.question.issues.push("shared_material_scope");
        if (uncertainLeadingTableColumn === paragraph.column)
          this.pending.question.issues.push("ambiguous_columns");
        uncertainLeadingTableColumn = undefined;
        if (!questionCue.test(paragraph.text) && !this.answers && !scoredAssessmentNumber(paragraph.rawText))
          this.pending.question.issues.push("uncertain_boundary");
        this.append(paragraph, page);
        continue;
      }
      if (
        !this.pending &&
        !this.instructions &&
        !this.shared.length &&
        (questionCue.test(paragraph.text) || printedExampleLead.test(paragraph.text) ||
          ["option", "subquestion"].includes(paragraph.role))
      ) {
        this.pending = {
          question: {
            id: "",
            number: "0",
            section: this.section,
            kind: this.answers ? "answer" : "question",
            paragraphIds: [],
            sharedMaterialIds: [],
            stem: "",
            answer: "",
            analysis: "",
            options: [],
            subquestions: [],
            anchors: [],
            assets: [],
            pageRange: [page.page, page.page],
            confidence: paragraph.confidence,
            issues: ["missing_question_start"],
            status: "needs_review",
            needsReview: true,
          },
          paragraphs: [],
          pages: new Map(),
        };
      }
      if (this.pending) this.append(paragraph, page);
      else if (this.shared.length && paragraph.role === "body") {
        if (this.shared.length < 32) {
          this.shared.push(paragraph);
          this.sharedPages.set(page.page, page);
        } else this.sharedOverflow = true;
      } else if (!this.instructions && paragraph.role === "body") {
        if (this.unassigned.length < 32 && this.unassignedPages.size < 8) {
          this.unassigned.push(paragraph);
          this.unassignedPages.set(page.page, page);
        }
      }
    }
    if (
      this.pending &&
      (this.pending.paragraphs.length > 1024 || this.pending.pages.size > 8)
    ) {
      this.pending.question.issues.push("oversized_question");
      output.push(this.finish());
    }
    return output;
  }
  private append(paragraph: StructureParagraph, page: StructurePage) {
    const pending = this.pending!;
    pending.paragraphs.push(paragraph);
    pending.pages.set(page.page, page);
    pending.question.paragraphIds.push(paragraph.id);
    pending.question.pageRange[1] = page.page;
    pending.question.confidence = Math.min(
      pending.question.confidence,
      paragraph.confidence,
    );
    pending.question.issues.push(...paragraph.issues);
    pending.question.issues.push(...page.issues);
  }
  private finish(
    following?: { page: StructurePage; next: StructureParagraph },
    graphics?: NonNullable<ReturnType<typeof leadingGraphicChoices>>,
  ): StructureQuestion {
    const pending = this.pending!,
      q = pending.question,
      shared = q.sharedMaterialIds.length ? this.shared : [];
    const unnumbered = following && isolatedUnnumberedPrompt(pending, following.page, following.next);
    if (unnumbered) {
      q.paragraphIds = [unnumbered.id];
      q.confidence = unnumbered.confidence;
      q.issues = ["missing_question_number"];
    }
    let role: "stem" | "answer" | "analysis" = "stem";
    let child: StructureQuestion["subquestions"][number] | undefined;
    let parentChild: typeof child;
    for (const paragraph of unnumbered ? [unnumbered] : pending.paragraphs) {
      q.anchors.push(paragraph.anchor);
      if (paragraph.marker?.kind === "child") {
        role = "stem";
        const nested = /^[①-⑳]/u.test(paragraph.text.trim()) && parentChild;
        child = {
          label: paragraph.marker.label,
          paragraphIds: [],
          text: "",
          options: [],
        };
        if (nested) {
          parentChild!.children ??= [];
          parentChild!.children.push(child);
        } else {
          q.subquestions.push(child);
          parentChild = child;
        }
      }
      if (paragraph.role === "answer") role = "answer";
      if (paragraph.role === "analysis") role = "analysis";
      q[role] += (q[role] ? "\n" : "") + paragraph.text;
      if (child) {
        child.paragraphIds.push(paragraph.id);
        if (role === "stem")
          child.text += (child.text ? "\n" : "") + paragraph.text;
        else child[role] = (child[role] || "") + "\n" + paragraph.text;
      }
      const markers = [
        ...paragraph.text.matchAll(
          /(?:^|\s|[、，])(?:[（(]([A-H])[）)]|([A-H])[.．、])/gu,
        ),
      ];
      const first = markers.findIndex(
        (marker) => (marker[1] || marker[2]) === "A",
      );
      const options =
        paragraph.role === "option"
          ? markers
          : first >= 0 && markers.length - first >= 2
            ? markers.slice(first)
            : [];
      const target = child ? child.options! : q.options;
      for (const [index, marker] of options.entries())
        target.push({
          label: marker[1] || marker[2],
          paragraphIds: [paragraph.id],
          text: paragraph.text
            .slice(marker.index, options[index + 1]?.index)
            .trim(),
        });
    }
    q.stem = q.stem.replace(
      /^(?:第\s*\d+\s*题\s*[:：]?|\d+[.．、])[ \t]*/u,
      "",
    );
    const first = pending.paragraphs[0];
    if (first.marker?.kind === "parent" && first.marker.label === q.number) {
      const scored = scoredAssessmentNumber(first.rawText);
      q.stem = stripAssessmentNumber(q.stem, first, q.number);
      if (scored && !q.stem.trim() && !q.subquestions.length)
        q.issues.push("uncertain_boundary");
    }
    if (shared.length) {
      for (const paragraph of shared) {
        q.confidence = Math.min(q.confidence, paragraph.confidence);
        q.issues.push(...paragraph.issues);
      }
      q.stem =
        shared.map((paragraph) => paragraph.text).join("\n") +
        "\n" +
        q.stem;
      q.anchors.push(...shared.map((paragraph) => paragraph.anchor));
      q.pageRange[0] = Math.min(
        q.pageRange[0],
        ...shared.map((p) => p.anchor.page),
      );
    }
    q.answer = q.answer.replace(
      /^(?:【|\[)?(?:参考答案|答案)(?:】|\]|[:：])[ \t]*/u,
      "",
    );
    q.analysis = q.analysis.replace(
      /^(?:【|\[)?(?:解析|分析|解答)(?:】|\]|[:：])[ \t]*/u,
      "",
    );
    if (!unnumbered) for (const [number, page] of pending.pages) {
      const owned = [...pending.paragraphs, ...shared].filter(
          (p) => p.anchor.page === number,
        ),
        top = Math.min(...owned.map((p) => p.anchor.box[1])),
        bottom = Math.max(...owned.map((p) => p.anchor.box[3]));
      for (const region of page.regions.filter((region) =>
        assetKinds.has(region.kind),
      )) {
        const center = (region.box[1] + region.box[3]) / 2;
        const next = page.paragraphs
          .filter(
            (p) =>
              (p.marker?.kind === "parent" || p.role === "heading") &&
              p.anchor.box[1] > bottom &&
              owned.some((part) => part.column === p.column),
          )
          .sort((a, b) => a.anchor.box[1] - b.anchor.box[1])[0];
        const end = next ? next.anchor.box[1] : 0.97;
        if (center < top - 0.015 || center >= end) continue;
        const compatible = owned.some(
          (p) =>
            p.column < 0 ||
            ((region.box[0] + region.box[2]) / 2 >= page.columns[p.column][0] &&
              (region.box[0] + region.box[2]) / 2 <= page.columns[p.column][2]),
        );
        if (compatible) attachStructureAsset(q, page, region);
      }
    }
    for (const [number, page] of pending.pages) {
      const figures = q.assets.filter(asset => asset.page === number && imageKinds.has(asset.kind));
      if (!figures.length) continue;
      for (const caption of page.paragraphs) {
        if (caption.role !== "figure" || numberedFigureCaption.exec(caption.text)?.[1] !== q.number) continue;
        const box = caption.anchor.box;
        const matches = figures.filter(({box: image}) =>
          Math.min(box[2], image[2]) - Math.max(box[0], image[0]) >= (box[2] - box[0]) * 0.6 &&
          box[1] >= image[1] && box[1] - image[3] <= 0.04);
        if (matches.length === 1 && !q.paragraphIds.includes(caption.id)) {
          q.paragraphIds.push(caption.id);
          q.anchors.push(caption.anchor);
        }
      }
    }
    if (graphics) {
      q.pageRange[1] = graphics.page.page;
      for (const { label, caption, image } of graphics.choices) {
        attachStructureAsset(q, graphics.page, image, label);
        q.options.push({ label, paragraphIds: [caption.id], text: caption.rawText });
        q.paragraphIds.push(caption.id);
        q.anchors.push(caption.anchor, { page: graphics.page.page, box: [...image.box] });
        q.confidence = Math.min(q.confidence, caption.confidence);
        q.issues.push(...caption.issues);
      }
      if (graphics.needsReview) q.issues.push("ambiguous_asset");
    }
    if (following && !q.assets.length) {
      const match = leadingQuestionFigure(q, pending, following.page, following.next);
      if (match) {
        attachStructureAsset(q, following.page, match.image);
        q.anchors.push({ page: following.page.page, box: [...match.image.box] });
        q.pageRange[1] = following.page.page;
        if (match.caption) {
          q.paragraphIds.push(match.caption.id);
          q.anchors.push(match.caption.anchor);
        } else {
          q.issues.push("ambiguous_asset");
        }
      }
    }
    if (figureReference.test(q.stem) && !q.assets.length)
      q.issues.push("missing_figure");
    const groups = [
      q.options,
      ...q.subquestions.flatMap((part) => [
        part.options || [],
        ...(part.children || []).map((child) => child.options || []),
      ]),
    ].filter((group) => group.length);
    if (groups.length) {
      if (
        groups.every(
          (group) =>
            group.length >= 2 &&
            group.every(
              (option, index) =>
                option.label === String.fromCharCode(65 + index),
            ),
        )
      )
        q.issues = q.issues.filter((issue) => issue !== "uncertain_boundary");
      else q.issues.push("uncertain_boundary");
    }
    if (shared.length ? !this.sharedUntil : pending.paragraphs.some(part => previousMaterial.test(part.text)))
      q.issues.push("shared_material_scope");
    if (Math.max(q.stem.length, q.answer.length, q.analysis.length) > 12000)
      q.issues.push("oversized_question");
    q.issues = [...new Set(q.issues)];
    q.status =
      q.issues.length || q.confidence < 0.85 ? "needs_review" : "candidate";
    const page = pending.pages.values().next().value!;
    q.id =
      "sq_" +
      digest([
        page.resourceId,
        page.version,
        q.section,
        q.number,
        q.paragraphIds,
        q.stem,
      ]).slice(0, 40);
    this.pending = undefined;
    if (this.inferredShared) {
      this.shared = [];
      this.sharedPages.clear();
      this.inferredShared = false;
    }
    return q;
  }
  end() {
    return this.pending ? [this.finish()] : [];
  }
}
