import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import type { DocumentStructureReference, StructureTableSource } from "../../../shared/material-document-structure";
import { tableVisionPlan, type TableVisionCandidate, type TableVisionQuery } from "../../../shared/material-table-vision";
import { readMaterialStructureCrops } from "./material-structure-source-image";

const labels = { read: "读到候选", partial: "部分可读", unreadable: "无法读清", conflict: "读数冲突" } as const;
const errors = {
  privacy_blocked: "发现疑似个人信息，回查已停止。",
  configuration: "请先配置 DeepSeek。",
  authentication: "DeepSeek 密钥验证失败，请检查模型设置。",
  timeout: "回查超时，可以稍后重新发起。",
  source_changed: "原件或解析版本已变化，请刷新资料后重试。",
  invalid_response: "模型返回的格式无法核验，可重试或查看原图。",
  rate_limit: "DeepSeek 暂时限流，请稍后重试。",
  busy: "有一个单元格正在回查，请稍后再试。",
  unit_too_large: "局部图超出回查范围，请对照原图核对。",
} as const;

function errorText(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const reason = Object.keys(errors).find(code => message.includes(code)) as keyof typeof errors | undefined;
  return reason ? errors[reason] : "回查未完成，请稍后重试或查看原图。";
}

export function MaterialTableVision({ source, reference, row, column }: {
  source: StructureTableSource;
  reference: DocumentStructureReference;
  row: number;
  column: number;
}) {
  const [previews, setPreviews] = useState<{ image: string; label: string }[]>([]);
  const [candidate, setCandidate] = useState<TableVisionCandidate>();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function request(action: TableVisionQuery["action"]): TableVisionQuery {
    return { reference, page: source.page, regionId: source.regionId, row, column, action };
  }
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    const plan = async () => {
      const { target, context, header, rowLabel, suspectedOverprint } = tableVisionPlan(source, row, column);
      const regions = [
        { box: target, label: "待核单元格原图" },
        { box: context, label: "关联行列原图" },
        ...(header ? [{ box: header, label: "关联首行原图" }] : []),
        ...(rowLabel ? [{ box: rowLabel, label: "关联首列原图" }] : []),
      ];
      const images = await readMaterialStructureCrops(reference, source, regions.map(region => region.box), suspectedOverprint);
      return images.map((image, index) => ({ image, label: regions[index]?.label ?? "去浅色叠印对照图" }));
    };
    Promise.all([plan(), window.omniEdu!.recheckMaterialTable({ reference, page: source.page,
      regionId: source.regionId, row, column, action: "read" })])
      .then(([images, result]) => {
        if (!current) return;
        setPreviews(images);
        setCandidate(result.status === "candidate" ? result.candidate : undefined);
      })
      .catch(reason => { if (current) setError(errorText(reason)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [source, reference, row, column]);

  async function run() {
    setError("");
    setNotice("");
    setRunning(true);
    try {
      const result = await window.omniEdu!.recheckMaterialTable(request("run"));
      if (result.status === "candidate") setCandidate(result.candidate);
      if (result.status === "cancelled") setNotice("已取消回查。");
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setRunning(false);
    }
  }
  async function cancel() {
    try { await window.omniEdu!.recheckMaterialTable(request("cancel")); }
    catch (reason) { setError(errorText(reason)); }
  }

  return (
    <section aria-label={`第 ${row + 1} 行第 ${column + 1} 列视觉回查`} data-testid="table-vision-review">
      <p>第 {row + 1} 行第 {column + 1} 列</p>
      {loading && <p role="status">正在读取待核区域…</p>}
      {!!previews.length && <DisclosureCard title="查看拟发送的局部">
        {previews.map(({image, label}) =>
          <img key={label} alt={label}
            style={{ maxWidth: "100%", display: "block" }} src={image} />)}
      </DisclosureCard>}
      {candidate ? <div data-testid="table-vision-candidate" role="status">
        <p>DeepSeek · {labels[candidate.state]} · 待核对</p>
        {candidate.text && <p>候选读数 {candidate.text}</p>}
        {candidate.columnLabel && <p>候选列名 {candidate.columnLabel}</p>}
        {candidate.unit && <p>候选单位 {candidate.unit}</p>}
      </div> : !!previews.length && <Button data-testid="table-vision-run" variant="secondary"
        isDisabled={running} onPress={() => void run()}>用 DeepSeek 回查</Button>}
      {running && <div className="toolbar-row">
        <p role="status">正在进行视觉回查…</p>
        <Button variant="ghost" data-testid="table-vision-cancel" onPress={() => void cancel()}>取消</Button>
      </div>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
import {DisclosureCard} from '../ui/DisclosureCard';
