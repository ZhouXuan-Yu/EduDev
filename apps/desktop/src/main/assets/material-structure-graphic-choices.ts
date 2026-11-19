import { hasUnfinishedContinuationChoice } from "../../shared/material-ai-continuation";
import type { StructurePage, StructureParagraph } from "../../shared/material-document-structure";
import type { PageBlock } from "../../shared/material-page-blocks";

type GraphicChoice = { label: string; caption: StructureParagraph; image: PageBlock };
const isImage = (region: PageBlock) => region.kind === "image" || region.kind === "chart";
const choiceGlyph = /^[（(]\s*([A-H])\s*[）)]?$|^([A-H])[.．、]?$/u;
const completeGlyph = /^(?:[（(]\s*[A-H]\s*[）)]|[A-H][.．、])$/u;

/** Match literal letter captions by geometry, with the next parent as the upper bound. */
export function leadingGraphicChoices(previous: StructurePage, parts: StructureParagraph[], following: StructurePage) {
  if (previous.page + 1 !== following.page || previous.columns.length !== 1 ||
      following.columns.length !== 1 || previous.issues.length || following.issues.length) return;
  const first = parts[0];
  const last = parts.at(-1);
  const stem = parts.map(p => p.text).join("\n");
  if (!last || last.anchor.box[3] < 0.75 ||
      parts.some(p => !["question", "body"].includes(p.role)) ||
      !/(?:图像|图形|图示|示意图|曲线|下列各图|下列图)/u.test(stem) ||
      !hasUnfinishedContinuationChoice(stem)) return;

  const next = following.paragraphs.find(p => p.marker?.kind === "parent");
  if (!next || Number(next.marker?.label) !== Number(first.marker?.label) + 1 ||
      Math.abs(next.anchor.box[0] - first.anchor.box[0]) > 0.05 ||
      next.anchor.box[1] > 0.42) return;
  const end = next.anchor.box[1];
  const images = following.regions.filter(r => isImage(r) && r.box[1] < end);
  if (images.length < 2) return;

  // Seeing a figure group is enough to stop an incomplete choice question
  // from publishing. It takes one literal caption per image to attach it.
  const unresolved = { page: following, choices: [] as GraphicChoice[], needsReview: true };
  if (images.length > 8 || images.some(r => r.score < 0.75 || r.box[3] >= end - 0.008 ||
      r.box[2] - r.box[0] < 0.04 || r.box[3] - r.box[1] < 0.04)) return unresolved;
  const before = following.paragraphs.slice(0, following.paragraphs.indexOf(next))
    .filter(p => p.role !== "header");
  const titleIds = new Set(following.regions.filter(r => r.kind === "figure_title").map(r => r.id));
  const captions = before.filter(p => p.regionIds.some(id => titleIds.has(id)));
  if (captions.length !== images.length || before.some(p => !["figure", "option"].includes(p.role))) return unresolved;
  const used = new Set<string>();
  const choices: GraphicChoice[] = [];
  for (const caption of captions) {
    const glyph = choiceGlyph.exec(caption.text.trim());
    if (!glyph || caption.confidence < 0.7) return unresolved;
    const [x0, y0, x1, y1] = caption.anchor.box;
    const center = (x0 + x1) / 2;
    const matches = images.filter(({box}) => center >= box[0] && center <= box[2] &&
      y0 >= box[3] - 0.008 && y0 <= box[3] + 0.035 && y1 < end - 0.008);
    if (matches.length !== 1 || used.has(matches[0].id)) return unresolved;
    used.add(matches[0].id);
    choices.push({ label: glyph[1] ?? glyph[2], caption, image: matches[0] });
  }

  const covered = before.every(p => captions.includes(p) || p.role === "figure" &&
    images.some(({box}) => {
      const [x0, y0, x1, y1] = p.anchor.box;
      const x = (x0 + x1) / 2, y = (y0 + y1) / 2;
      return x >= box[0] - 0.005 && x <= box[2] + 0.005 && y >= box[1] - 0.005 && y <= box[3] + 0.005;
    }));
  if (!covered) return unresolved;

  // Pairwise order avoids a non-transitive sort when a row is skewed.
  choices.sort((a, b) => a.label.localeCompare(b.label));
  if (!choices.every((choice, i) => choice.label === String.fromCharCode(65 + i) &&
    choices.slice(0, i).every(({image}) => {
      const a = image.box, b = choice.image.box;
      return Math.abs(a[1] - b[1]) <= 0.025 ? a[2] < b[0] : a[3] < b[1];
    }))) return unresolved;
  return { page: following, choices, needsReview: choices.some(({caption}) =>
    caption.confidence < 0.85 || !completeGlyph.test(caption.text.trim())) };
}
