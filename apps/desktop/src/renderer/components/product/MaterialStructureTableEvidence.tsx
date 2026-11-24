import { useState } from "react";
import { Button } from "@heroui/react";
import type { DocumentStructureReference, StructureTableSource } from "../../../shared/material-document-structure";
import { supportsTableCellVision } from "../../../shared/material-table-vision";
import { DisclosureCard } from "../ui/DisclosureCard";
import { MaterialTableVision } from "./MaterialTableVision";
import { readMaterialStructureCrop } from "./material-structure-source-image";

function TableOriginal({ source, reference, showPage }: {
  source: StructureTableSource; reference: DocumentStructureReference; showPage: boolean;
}) {
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try { setImage(await readMaterialStructureCrop(reference, source)); }
    catch { setError("表格原图无法读取，请重试。"); }
    finally { setLoading(false); }
  }
  return <>
    <div className="toolbar-row">
      <Button variant="secondary" isDisabled={loading} data-testid="structure-table-original"
        onPress={() => image ? setImage("") : void load()}>
        {image ? "收起" : "查看"}{showPage && `第 ${source.page} 页`}表格原图
      </Button>
    </div>
    {loading && <p role="status">正在读取表格原图…</p>}
    {error && <p role="alert">{error}</p>}
    {image && <img src={image} alt={`第 ${source.page} 页的原始表格`} style={{ maxWidth: "100%", height: "auto" }}
      data-testid="structure-table-original-image" />}
  </>;
}

const tableKey = ({ page, regionId }: Pick<StructureTableSource, "page" | "regionId">) => `${page}-${regionId}`;

function TableEvidence({ sources, reference }: { sources: StructureTableSource[]; reference: DocumentStructureReference }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<{ source: StructureTableSource; row: number; column: number }>();
  const [first] = sources;
  const combined = sources.length > 1;
  const originalOnly = sources.some(source => !supportsTableCellVision(source));
  const held = sources.flatMap(source => source.rows.flat()).filter(cell => cell.needsReview).length;
  const title = combined
    ? `查看跨页表格 · 第 ${first.page}–${sources.at(-1)!.page} 页`
    : `查看第 ${first.page} 页表格 · ${first.rows.length} 行 ${first.rows[0].length} 列`;
  return (
    <DisclosureCard title={title}
      data-testid="structure-table-evidence" isExpanded={expanded} onExpandedChange={setExpanded}>
      {expanded && <>
      <p>{first.layout === "aligned_text" ? `按原文位置还原的表格${held ? `，${held} 个单元格待核对` : ""}，可对照原图` :
        held ? `${held} 个单元格待核对${originalOnly ? "，可查看原图" : ""}` : "已定位全部单元格，文字可对照原图"}</p>
      <div tabIndex={0} role="region" aria-label="可横向滚动的表格读数" style={{ overflowX: "auto" }}>
        <table aria-label="扫描表格读数" data-testid="structure-table-grid" style={{ borderCollapse: "collapse" }}>
          {sources.map((source, fragment) => {
            const canRecheck = supportsTableCellVision(source);
            const showHeader = fragment === 0 || source.rows[0].some(cell => cell.needsReview);
            return (
              <tbody key={tableKey(source)}>
                {combined && <tr><th scope="rowgroup" colSpan={first.rows[0].length}>第 {source.page} 页</th></tr>}
                {source.rows.map((row, index) => (showHeader || index > 0) && (
                  <tr key={index}>
                    {row.map((cell, column) => !cell.covered && (
                      <td key={column} rowSpan={cell.rowSpan} colSpan={cell.columnSpan} style={{ minWidth: "5.5rem", padding: "0.5rem", border: "1px solid var(--border, #d1d5db)" }}>
                        {cell.text || "未读清"}
                        {cell.suspectedOverprint && <div>疑似浅色叠印</div>}
                        {cell.needsReview && canRecheck && <Button size="sm" variant="ghost"
                          aria-label={`回查${combined ? `第 ${source.page} 页` : ""}第 ${index + 1} 行第 ${column + 1} 列`}
                          aria-pressed={selected?.source === source && selected.row === index && selected.column === column}
                          data-testid={`table-vision-cell-${index}-${column}`}
                          onPress={() => setSelected({ source, row: index, column })}>回查</Button>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
      {sources.map(source => <TableOriginal key={tableKey(source)} source={source} reference={reference} showPage={combined} />)}
      {selected && <MaterialTableVision key={`${tableKey(selected.source)}-${selected.row}-${selected.column}`} reference={reference} {...selected} />}
      </>}
    </DisclosureCard>
  );
}

export function MaterialStructureTableEvidence({ sources, reference }: { sources: StructureTableSource[]; reference: DocumentStructureReference }) {
  const groups: StructureTableSource[][] = [];
  const tails = new Map<string, StructureTableSource[]>();
  for (const source of sources) {
    const previousKey = source.continuesFrom && tableKey(source.continuesFrom);
    const group = previousKey && tails.get(previousKey);
    if (group) {
      group.push(source);
      tails.delete(previousKey);
      tails.set(tableKey(source), group);
    } else {
      const single = [source];
      groups.push(single);
      tails.set(tableKey(source), single);
    }
  }
  return groups.map(group => <TableEvidence key={`${reference.generation}-${tableKey(group[0])}`} sources={group} reference={reference} />);
}
