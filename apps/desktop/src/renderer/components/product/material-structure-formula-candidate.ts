import type {
  DocumentStructureReference,
  DocumentStructureView,
  StructureFormulaSource,
} from "../../../shared/material-document-structure";

const simpleTerm = /^[+−-]?[\p{Script=Latin}\p{Script=Greek}0-9]+(?:[+−×·-][\p{Script=Latin}\p{Script=Greek}0-9]+)*$/u;

export function structureFormulaCandidate(
  view: DocumentStructureView,
  reference: DocumentStructureReference,
  source: StructureFormulaSource,
) {
  const { summary, page } = view;
  const saved = view.references?.[reference.candidateId];
  if (summary?.generation !== reference.generation || summary.version !== reference.version ||
      summary.resourceId !== reference.resourceId || saved?.sha256 !== reference.sha256 ||
      page?.page !== source.page || page.resourceId !== reference.resourceId ||
      page.version !== reference.version || page.rasterSha256 !== source.rasterSha256) return;

  const question = view.questions.find(question => question.id === reference.candidateId);
  const matchingSource = question?.formulaSources?.find(item =>
    item.page === source.page && item.rasterSha256 === source.rasterSha256 &&
    item.box.every((value, index) => value === source.box[index]) &&
    item.lineIds.length === source.lineIds.length && item.lineIds.every((id, index) => id === source.lineIds[index]),
  );
  if (!matchingSource) return;

  // Stacked equation evidence stores the lead, upper line, lower line, then any baseline companion.
  const [leadId, upperId, lowerId] = matchingSource.lineIds;
  if (matchingSource.lineIds.length < 3 || new Set([leadId, upperId, lowerId]).size !== 3 ||
      !page.lines.some(line => line.id === leadId)) return;
  const upper = page.lines.find(line => line.id === upperId);
  const lower = page.lines.find(line => line.id === lowerId);
  if (!upper || !lower) return;
  const numerator = upper.text.trim();
  const denominator = lower.text.trim();
  if (!numerator || !denominator || numerator.length > 32 || denominator.length > 32) return;

  // Never normalize superscripts, infer a baseline term, or convert ambiguous OCR into math.
  const copyText = upper.score >= 0.92 && lower.score >= 0.92 &&
    simpleTerm.test(numerator) && simpleTerm.test(denominator)
    ? `(${numerator})/(${denominator})`
    : undefined;
  return { numerator, denominator, copyText };
}
