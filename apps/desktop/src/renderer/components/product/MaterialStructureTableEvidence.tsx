import { useState } from "react";
import { Button } from "@heroui/react";
import type { DocumentStructureReference, StructureTableSource } from "../../../shared/material-document-structure";
import { DisclosureCard } from "../ui/DisclosureCard";
import { MaterialTableVision } from "./MaterialTableVision";
import { readMaterialStructureCrop } from "./material-structure-source-image";

function TableEvidence({ source, reference }: { source: StructureTableSource; reference: DocumentStructureReference }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<{ row: number; column: number }>();
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const held = source.rows.flat().filter(cell => cell.needsReview).length;
  async function load() {
    setLoading(true);
    setError("");
    try { setImage(await readMaterialStructureCrop(reference, source)); }
    catch { setError("表格原图无法读取，请重试。"); }
    finally { setLoading(false); }
  }
  return (
    <DisclosureCard title={`查看第 ${source.page} 页表格 · ${source.rows.length} 行 ${source.rows[0].length} 列`}
      data-testid="structure-table-evidence" isExpanded={expanded} onExpandedChange={setExpanded}>
      {expanded && <>
      <p>{held ? `${held} 个单元格待核对` : "已定位全部单元格，文字可对照原图"}</p>
      <div tabIndex={0} role="region" aria-label="可横向滚动的表格读数" style={{ overflowX: "auto" }}>
        <table aria-label="扫描表格读数" data-testid="structure-table-grid" style={{ borderCollapse: "collapse" }}>
          <tbody>
            {source.rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, column) => (
                  <td key={column} style={{ minWidth: "5.5rem", padding: "0.5rem", border: "1px solid var(--border, #d1d5db)" }}>
                    {cell.text || "未读清"}
                    {cell.suspectedOverprint && <div>疑似浅色叠印</div>}
                    {cell.needsReview && <Button size="sm" variant="ghost"
                      aria-label={`回查第 ${index + 1} 行第 ${column + 1} 列`}
                      aria-pressed={selected?.row === index && selected?.column === column}
                      data-testid={`table-vision-cell-${index}-${column}`}
                      onPress={() => setSelected({ row: index, column })}>回查</Button>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="toolbar-row">
        <Button variant="secondary" isDisabled={loading} data-testid="structure-table-original"
          onPress={() => image ? setImage("") : void load()}>{image ? "收起表格原图" : "查看表格原图"}</Button>
      </div>
      {selected && <MaterialTableVision key={`${selected.row}-${selected.column}`} source={source} reference={reference} {...selected} />}
      {loading && <p role="status">正在读取表格原图…</p>}
      {error && <p role="alert">{error}</p>}
      {image && <img src={image} alt={`第 ${source.page} 页的原始表格`} style={{ maxWidth: "100%", height: "auto" }}
        data-testid="structure-table-original-image" />}
      </>}
    </DisclosureCard>
  );
}

export function MaterialStructureTableEvidence({ sources, reference }: { sources: StructureTableSource[]; reference: DocumentStructureReference }) {
  return sources.map(source => <TableEvidence key={`${reference.generation}-${source.page}-${source.regionId}`} source={source} reference={reference} />);
}
