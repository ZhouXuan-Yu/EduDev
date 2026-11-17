import { createHash } from "node:crypto";
import type {
  StructurePage,
  StructureQuestion,
} from "../../shared/material-document-structure";

/** Physical identity ignores added crop readings and ordinal paragraph renumbering. */
export function structureOcrSourceKey(
  question: StructureQuestion,
  pages: StructurePage[],
) {
  const records = pages.map((page) => {
    const paragraphIds = new Set([
      ...question.paragraphIds,
      ...question.sharedMaterialIds,
    ]);
    const ids = new Set(
      page.paragraphs
        .filter((p) => paragraphIds.has(p.id))
        .flatMap((p) => p.lineIds),
    );
    for (const asset of question.assets.filter((a) => a.page === page.page))
      for (const id of asset.lineIds ?? []) ids.add(id);
    const lines = page.lines
      .filter((line) => ids.has(line.id) && line.origin !== "pdf_native_crop")
      .map((line) => [line.sourceId, line.text, line.quad])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    return [
      page.resourceId,
      page.version,
      page.page,
      page.rasterSha256,
      page.sourceEngine,
      lines,
    ];
  });
  return createHash("sha256")
    .update(
      JSON.stringify([
        question.kind,
        question.number,
        question.pageRange,
        records,
      ]),
    )
    .digest("hex");
}
