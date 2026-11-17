import { createHash } from "node:crypto";
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
const furnitureKinds = new Set([
  "header",
  "header_image",
  "footer",
  "footer_image",
  "number",
]);
const questionCue =
  /[?？]|求|计算|解方程|选择|填空|判断|已知|证明|下列|回答|写出|如图|简述|说明|[（(]\s*[）)]|_{2,}/u;
const sectionHeading =
  /^(?:[一二三四五六七八九十百]+[、．.]|第[一二三四五六七八九十百\d]+[章节单元])/u;

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
): { role: ParagraphRole; marker?: StructureParagraph["marker"] } {
  const text = line.text.trim(),
    owned = regions.filter((region) => line.regionIds.includes(region.id));
  const kind = owned.sort((a, b) => area(a.box) - area(b.box))[0]?.kind;
  if (kind === "header" || kind === "header_image") return { role: "header" };
  if (
    kind === "footer" ||
    kind === "footer_image" ||
    (kind === "number" && /^\d+(?:\s*\/\s*\d+)?$/u.test(text))
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
  if (
    /^(?:阅读|根据|依据).{0,30}(?:材料|短文|文章)|(?:回答|完成)\s*\d+\s*[～~—–-]\s*\d+\s*题/u.test(
      text,
    )
  )
    return { role: "material" };
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
  const parent =
    /^(?:第\s*(\d{1,5})\s*题\s*[:：]?|(\d{1,5})[.．、](?!\d))[ \t]*/u.exec(
      text,
    );
  if (parent)
    return {
      role: "question",
      marker: { kind: "parent", label: parent[1] || parent[2] },
    };
  if (kind === "doc_title" || kind === "paragraph_title")
    return { role: "heading" };
  if (kind === "table") return { role: "table" };
  if (kind === "display_formula" || kind === "inline_formula")
    return { role: "formula" };
  if (kind === "image" || kind === "chart" || kind === "figure_title")
    return { role: "figure" };
  return { role: "body" };
}

function columnsFor(
  lines: StructureLine[],
  regions: PageBlock[],
  height: number,
): PageBox[] {
  const body = lines.filter(
    (line) =>
      lineRole(line, regions).role !== "option" &&
      !regions.some(
        (region) =>
          line.regionIds.includes(region.id) &&
          (assetKinds.has(region.kind) ||
            furnitureKinds.has(region.kind) ||
            region.kind === "doc_title"),
      ),
  );
  const candidates = [0.4, 0.45, 0.5, 0.55, 0.6];
  for (const split of candidates) {
    const left = body.filter(
      (line) => line.box[2] < split - 0.012 && line.box[2] - line.box[0] > 0.16,
    );
    const right = body.filter(
      (line) => line.box[0] > split + 0.012 && line.box[2] - line.box[0] > 0.16,
    );
    if (left.length < 2 || right.length < 2) continue;
    const vertical =
      Math.min(
        Math.max(...left.map((line) => line.box[3])),
        Math.max(...right.map((line) => line.box[3])),
      ) -
      Math.max(
        Math.min(...left.map((line) => line.box[1])),
        Math.min(...right.map((line) => line.box[1])),
      );
    if (vertical < height * 1.5) continue;
    const cross = body.filter(
      (line) =>
        line.box[0] < split - 0.02 &&
        line.box[2] > split + 0.02 &&
        line.box[2] - line.box[0] < 0.65,
    );
    if (cross.length > Math.max(1, body.length * 0.05)) continue;
    return [
      [0, 0, split, 1],
      [split, 0, 1, 1],
    ];
  }
  return [[0, 0, 1, 1]];
}

function orderedLines(lines: StructureLine[], columns: PageBox[]) {
  const vertical = (a: StructureLine, b: StructureLine) =>
    Math.abs((a.box[1] + a.box[3] - b.box[1] - b.box[3]) / 2) <
    Math.min(a.box[3] - a.box[1], b.box[3] - b.box[1]) * 0.45
      ? a.box[0] - b.box[0]
      : a.box[1] - b.box[1] || a.box[0] - b.box[0];
  if (columns.length === 1)
    return lines
      .map((line) => ({ line, column: 0 }))
      .sort((a, b) => vertical(a.line, b.line));
  const split = columns[0][2],
    wide = lines
      .filter(
        (line) => line.box[0] < split - 0.025 && line.box[2] > split + 0.025,
      )
      .sort(vertical);
  const rows: { line: StructureLine; column: number }[] = [],
    used = new Set<string>();
  for (const separator of [...wide, undefined]) {
    const band = lines.filter(
      (line) =>
        !used.has(line.id) &&
        !wide.includes(line) &&
        (!separator || (line.box[1] + line.box[3]) / 2 < separator.box[1]),
    );
    for (const column of [0, 1])
      for (const line of band
        .filter((line) =>
          (line.box[0] + line.box[2]) / 2 < split ? column === 0 : column === 1,
        )
        .sort(vertical)) {
        rows.push({ line, column });
        used.add(line.id);
      }
    if (separator) {
      rows.push({ line: separator, column: -1 });
      used.add(separator.id);
    }
  }
  return rows;
}

export function recoverStructurePage(input: StructurePageInput): StructurePage {
  if (input.lines.length > 2000 || input.regions.length > 256)
    throw Error("unit_too_large");
  const recovered =
    input.nativeRecovery?.accepted.map((item) => item.line) ?? [];
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
        : {}),
      text: line.text,
      box,
      quad: line.normalizedQuad,
      score: line.score,
      regionIds: owned.map((region) => region.id),
    };
  });
  const height = median(lines.map((line) => line.box[3] - line.box[1])),
    columns = columnsFor(lines, input.regions, height),
    ordered = orderedLines(lines, columns);
  const paragraphs: StructureParagraph[] = [];
  const byId = new Map(lines.map((line) => [line.id, line]));
  for (const { line, column } of ordered) {
    const detected = lineRole(line, input.regions),
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
      ...(line.score < 0.85 ? ["low_ocr_score" as const] : []),
      ...(!line.regionIds.length || ambiguous || regions[0]?.score < 0.5
        ? ["ambiguous_region" as const]
        : []),
    ];
    if (merge) {
      last.lineIds.push(line.id);
      last.regionIds = [...new Set([...last.regionIds, ...line.regionIds])];
      last.rawText += "\n" + line.text;
      last.text = joinStructureLines(
        last.lineIds.map((id) => byId.get(id)!.text),
      );
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
    lines,
    regions: input.regions,
    columns,
    paragraphs,
    issues: input.nativeRecovery?.unresolved.length
      ? ["native_unconfirmed"]
      : [],
    needsReview: true,
  };
}

type Pending = {
  question: StructureQuestion;
  paragraphs: StructureParagraph[];
  pages: Map<number, StructurePage>;
};
/** Streaming book assembler. Retains one unfinished question and bounded shared-material context. */
export class StructureQuestionAssembler {
  private pending?: Pending;
  private section = "";
  private shared: StructureParagraph[] = [];
  private sharedPages = new Map<number, StructurePage>();
  private sharedOverflow = false;
  private unassigned: StructureParagraph[] = [];
  private unassignedPages = new Map<number, StructurePage>();
  private sharedUntil?: number;
  private instructions = false;
  private answers = false;
  private sequence = 0;
  push(page: StructurePage): StructureQuestion[] {
    const output: StructureQuestion[] = [];
    if (page.issues.includes("native_unconfirmed") && this.pending) {
      this.pending.question.issues.push("native_unconfirmed");
      this.pending.pages.set(page.page, page);
      this.pending.question.pageRange[1] = page.page;
    }
    for (const paragraph of page.paragraphs) {
      if (["header", "footer", "figure", "note"].includes(paragraph.role))
        continue;
      if (paragraph.role === "heading") {
        if (paragraph.text === this.section) continue;
        if (this.pending) output.push(this.finish());
        this.section = paragraph.text;
        this.shared = [];
        this.sharedPages.clear();
        this.sharedOverflow = false;
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
        this.sharedUntil =
          Number(
            paragraph.text.match(
              /(?:回答|完成)?\s*\d+\s*[～~—–-]\s*(\d+)\s*题/u,
            )?.[1],
          ) || undefined;
        continue;
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
        if (this.instructions && !questionCue.test(paragraph.text)) continue;
        if (
          this.instructions &&
          /姓名|考场|座位|答题纸|条形码|满分|考试时间/u.test(paragraph.text)
        )
          continue;
        const numberingConflict =
          !!this.pending &&
          this.pending.question.number !== "0" &&
          Number(number) <= Number(this.pending.question.number);
        const precedingOrphan = this.pending?.question.number === "0";
        if (numberingConflict)
          this.pending!.question.issues.push("numbering_conflict");
        if (this.pending) output.push(this.finish());
        if (this.unassigned.length && !this.shared.length) {
          this.shared = this.unassigned;
          this.sharedPages = this.unassignedPages;
          this.sharedUntil = undefined;
          this.unassigned = [];
          this.unassignedPages = new Map();
        }
        if (this.sharedUntil && Number(number) > this.sharedUntil) {
          this.shared = [];
          this.sharedPages.clear();
        }
        this.pending = {
          question: {
            id: "structure-question-" + ++this.sequence,
            number,
            section: this.section,
            kind: this.answers ? "answer" : "question",
            paragraphIds: [],
            sharedMaterialIds: this.shared.map((value) => value.id),
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
        this.pending.pages = new Map(this.sharedPages);
        if (numberingConflict)
          this.pending.question.issues.push("numbering_conflict");
        if (precedingOrphan)
          this.pending.question.issues.push("shared_material_scope");
        if (this.sharedOverflow)
          this.pending.question.issues.push("shared_material_scope");
        if (!questionCue.test(paragraph.text) && !this.answers)
          this.pending.question.issues.push("uncertain_boundary");
        this.append(paragraph, page);
        continue;
      }
      if (
        !this.pending &&
        !this.instructions &&
        !this.shared.length &&
        (questionCue.test(paragraph.text) ||
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
  private finish(): StructureQuestion {
    const pending = this.pending!,
      q = pending.question;
    let role: "stem" | "answer" | "analysis" = "stem";
    let child: StructureQuestion["subquestions"][number] | undefined;
    let parentChild: typeof child;
    for (const paragraph of pending.paragraphs) {
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
    if (this.shared.length) {
      for (const paragraph of this.shared) {
        q.confidence = Math.min(q.confidence, paragraph.confidence);
        q.issues.push(...paragraph.issues);
      }
      q.stem =
        this.shared.map((paragraph) => paragraph.text).join("\n") +
        "\n" +
        q.stem;
      q.anchors.push(...this.shared.map((paragraph) => paragraph.anchor));
      q.pageRange[0] = Math.min(
        q.pageRange[0],
        ...this.shared.map((p) => p.anchor.page),
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
    for (const [number, page] of pending.pages) {
      const owned = [...pending.paragraphs, ...this.shared].filter(
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
        if (compatible) {
          const lines = page.lines.filter(
            (line) => overlap(line.box, region.box) / area(line.box) > 0.6,
          );
          q.assets.push({
            page: number,
            regionId: region.id,
            kind: region.kind,
            box: [...region.box],
            lineIds: lines.map((l) => l.id),
            rawText: lines.map((l) => l.text).join("\n"),
          });
          if (lines.length)
            q.confidence = Math.min(
              q.confidence,
              ...lines.map((line) => line.score),
            );
          if (region.score < 0.5) q.issues.push("ambiguous_asset");
          if (lines.some((line) => line.score < 0.85))
            q.issues.push("low_ocr_score");
        }
      }
    }
    if (/如图|下图|图中|下表|表中/u.test(q.stem) && !q.assets.length)
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
    if (q.sharedMaterialIds.length && !this.sharedUntil)
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
    return q;
  }
  end() {
    return this.pending ? [this.finish()] : [];
  }
}
