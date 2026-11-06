import { DisclosureCard } from "../ui/DisclosureCard";
import { useEffect, useState } from "react";
import {
  MATERIAL_AI_RESPONSE_RECEIPT,
  type AiResponseView,
} from "../../../shared/material-ai-response";

const phases = { first: "首次整理", source: "来源转录", final: "最后整理" };

/** Read-only local diagnostics under the original batch. */
export function MaterialAiResponses({
  batchId,
  units,
  start,
}: {
  batchId: string;
  units: { ordinal: number }[];
  start: number;
}) {
  const [open, setOpen] = useState(false);
  const [ordinal, setOrdinal] = useState(units[0]?.ordinal || 1);
  const [responseId, setResponseId] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState<AiResponseView>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let current = true;
    setLoading(true);
    setError("");
    void window
      .omniEdu!.getMaterialAiResponse({
        schemaVersion: MATERIAL_AI_RESPONSE_RECEIPT,
        batchId,
        ordinal,
        ...(responseId ? { responseId } : {}),
      })
      .then((result) => {
        if (current) setView(result);
      })
      .catch(() => {
        if (current) setError("未能读取本机响应记录，请重试或重新选择批次。");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [open, batchId, ordinal, responseId, revision]);
  const visible =
    view?.batchId === batchId && view.ordinal === ordinal ? view : undefined;
  return (
    <DisclosureCard
      data-testid="material-ai-responses"
      headingLevel={4}
      title="已收到的AI响应"
      isExpanded={open}
      onExpandedChange={setOpen}
    >
      {open && (
        <>
          <p>
            响应保存在本机，供检查识别或格式问题。内容仍需经过题库校验，查看记录无需调用模型。
          </p>
          <label>
            批次项目
            <select
              data-testid="material-ai-response-unit"
              value={ordinal}
              onChange={(event) => {
                setResponseId(undefined);
                setOrdinal(Number(event.target.value));
              }}
            >
              {units.map((unit) => (
                <option key={unit.ordinal} value={unit.ordinal}>
                  第{start + unit.ordinal - 1}项
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            刷新记录
          </button>
          {loading && <p role="status">正在读取本机响应…</p>}
          {error && (
            <p role="alert">
              {error}
              <button onClick={() => setRevision((value) => value + 1)}>
                重试读取
              </button>
            </p>
          )}
          {!loading && !error && visible && (
            <>
              {!visible.receipts.length && (
                <p>此项目没有接收记录。旧批次可能尚未保存这类回执。</p>
              )}
              {visible.receipts.map((receipt) => (
                <article
                  key={receipt.id}
                  data-testid="material-ai-response-record"
                  data-response-id={receipt.id}
                >
                  <p>
                    {phases[receipt.phase]} · {receipt.model} ·{" "}
                    {receipt.receivedAt
                      ? `已保存 ${receipt.bytes} 字节`
                      : "尚未收到完整响应"}
                  </p>
                  <p>
                    请求准备时间 {receipt.requestedAt}
                    {receipt.receivedAt && ` · 接收时间 ${receipt.receivedAt}`}
                  </p>
                  {receipt.receivedAt && (
                    <>
                      <pre className="material-ai-page-text">
                        SHA256 {receipt.sha256}
                      </pre>
                      <button onClick={() => setResponseId(receipt.id)}>
                        查看此响应
                      </button>
                    </>
                  )}
                </article>
              ))}
              {visible.selected && visible.selected.id === responseId && (
                <>
                  <p>
                    {visible.selected.encoding === "base64"
                      ? "响应含非UTF8字节，以下以Base64显示。"
                      : "收到的原始响应文字"}
                  </p>
                  <pre
                    className="material-ai-page-text"
                    data-testid="material-ai-response-body"
                  >
                    {visible.selected.body}
                  </pre>
                </>
              )}
            </>
          )}
        </>
      )}
    </DisclosureCard>
  );
}
