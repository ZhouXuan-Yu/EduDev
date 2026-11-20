import { createHash } from "node:crypto";
import { namedPageFooter } from "./material-document-structure";
import type {
  StructurePage,
  StructureQuestion,
} from "../../shared/material-document-structure";

/** Physical identity ignores added crop readings and ordinal paragraph renumbering. */
export function structureOcrSourceKey(
  question: StructureQuestion,
  pages: StructurePage[],
  ignoreProvenNamedPageFooters = false,
) {
  let droppedFooter = false, retainsOriginalText = false;
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
    const lines = page.lines.flatMap(line => {
      if (!ids.has(line.id) || line.origin) return [];
      if (ignoreProvenNamedPageFooters && namedPageFooter(line, page.regions, page)) {
        droppedFooter = true;
        return [];
      }
      retainsOriginalText ||= !!line.text.trim();
      return [[line.sourceId, line.text, line.quad]];
    })
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
  if (ignoreProvenNamedPageFooters && (!droppedFooter || !retainsOriginalText)) return;
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
