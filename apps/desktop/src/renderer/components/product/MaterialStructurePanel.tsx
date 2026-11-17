import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import type { TeacherResource } from "../../../shared/contracts";
import type {
  DocumentStructureView,
  ParagraphRole,
} from "../../../shared/material-document-structure";
import { MATERIAL_TASK_SCHEMA } from "../../../shared/material-parse-task";
import { DisclosureCard } from "../ui/DisclosureCard";

const roles: Record<ParagraphRole, string> = {
  heading: "标题",
  body: "正文",
  question: "题干",
  option: "选项",
  subquestion: "小问",
  answer: "答案",
  analysis: "解析",
  material: "共用材料",
  header: "页眉",
  footer: "页脚",
  note: "注释",
  formula: "公式",
  table: "表格",
  figure: "图片",
};
const issueLabels: Record<string, string> = {
  low_ocr_score: "OCR置信度偏低",
  ambiguous_region: "版面区域待核对",
  ambiguous_columns: "分栏待核对",
  uncertain_boundary: "题目边界待核对",
  numbering_conflict: "编号关系不明确",
  missing_question_start: "未定位题目起点",
  missing_figure: "题图未完整定位",
  ambiguous_asset: "图表归属待核对",
  shared_material_scope: "共用材料范围待核对",
  oversized_question: "超出自动恢复范围",
};
const states = {
  pending: "等待后台处理",
  running: "后台恢复中",
  complete: "结构恢复完成",
  partial: "部分结构待核对",
  failed: "处理失败",
  cancelled: "已停止",
};

export function MaterialStructurePanel({
  resource,
}: {
  resource: TeacherResource;
}) {
  const [page, setPage] = useState(1),
    [view, setView] = useState<DocumentStructureView>(),
    [error, setError] = useState("");
  const [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const [image, setImage] = useState(""),
    [imageError, setImageError] = useState("");
  const query = {
    resourceId: resource.id,
    version: resource.contentHash,
    page,
  };
  const supported = /\.(pdf|docx|png|jpe?g|webp)$/i.test(
    resource.originalFileName,
  );
  useEffect(() => {
    if (!supported || !window.omniEdu?.getMaterialStructure) return;
    let live = true,
      timer: ReturnType<typeof setTimeout> | undefined;
    setLoading(true);
    setError("");
    setImage("");
    setImageError("");
    const read = async () => {
      try {
        const result = await window.omniEdu!.getMaterialStructure({
          resourceId: resource.id,
          version: resource.contentHash,
          page,
        });
        if (!live) return;
        setView(result);
        if (
          result.summary &&
          ["pending", "running"].includes(result.summary.status)
        )
          timer = setTimeout(() => void read(), 2500);
      } catch {
        if (live) setError("结构记录读取失败，请刷新重试。");
      } finally {
        if (live) setLoading(false);
      }
    };
    void read();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [resource.id, resource.contentHash, page, revision, supported]);
  if (!supported) return null;
  const active =
    !!view?.summary && ["pending", "running"].includes(view.summary.status);
  async function action(kind: "rebuild" | "retry" | "cancel") {
    setBusy(true);
    setError("");
    try {
      if (kind === "rebuild")
        await window.omniEdu!.rebuildMaterialStructure(query);
      else
        await window.omniEdu!.controlMaterialTask({
          schemaVersion: MATERIAL_TASK_SCHEMA,
          resourceId: resource.id,
          version: resource.contentHash,
          action: kind,
        });
      setRevision((value) => value + 1);
    } catch {
      setError("任务操作未完成。后台正在处理时，请稍后刷新。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <DisclosureCard
      title="段落与试题结构"
      data-testid="material-structure-panel"
    >
      <p>
        原始
        OCR、段落和题目关系保存在本机。结构恢复结果均需核对，疑点题目会暂缓入库。
      </p>
      {loading && <p role="status">正在读取结构记录…</p>}
      {error && <p role="alert">{error}</p>}
      <div className="teacher-library-actions">
        <Button
          variant="secondary"
          isDisabled={busy || active}
          onPress={() => void action("rebuild")}
          data-testid="structure-rebuild"
        >
          {view?.summary ? "重建结构" : "恢复文档结构"}
        </Button>
        {active && (
          <Button
            variant="secondary"
            isDisabled={busy}
            onPress={() => void action("cancel")}
            data-testid="structure-cancel"
          >
            停止处理
          </Button>
        )}
        {view?.summary &&
          ["failed", "cancelled"].includes(view.summary.status) && (
            <Button
              variant="secondary"
              isDisabled={busy}
              onPress={() => void action("retry")}
              data-testid="structure-retry"
            >
              继续处理
            </Button>
          )}
        <Button
          variant="secondary"
          isDisabled={busy}
          onPress={() => setRevision((value) => value + 1)}
        >
          刷新
        </Button>
      </div>
      {!view?.summary && !loading && (
        <p data-testid="structure-empty">
          当前资料尚未建立结构记录，可在后台恢复。
        </p>
      )}
      {view?.summary && (
        <>
          <p role="status" data-testid="structure-status">
            {states[view.summary.status]} · {view.summary.processed}/
            {view.summary.pages} 页 · {view.summary.paragraphs} 段 ·{" "}
            {view.summary.questions} 个候选 · {view.summary.held} 个待核对
            {view.summary.error ? " · " + view.summary.error : ""}
          </p>
          <div className="teacher-library-actions">
            <Button
              variant="secondary"
              isDisabled={page <= 1}
              onPress={() => setPage((value) => value - 1)}
              data-testid="structure-previous"
            >
              上一页
            </Button>
            <span>第 {page} 页</span>
            <Button
              variant="secondary"
              isDisabled={page >= view.summary.processed}
              onPress={() => setPage((value) => value + 1)}
              data-testid="structure-next"
            >
              下一页
            </Button>
          </div>
        </>
      )}
      {view?.page && (
        <div data-testid="structure-page" style={{ overflowWrap: "anywhere" }}>
          <p>
            {view.page.columns.length} 栏 · {view.page.lines.length} 条 OCR 行 ·{" "}
            {view.page.paragraphs.length} 个段落 · {view.page.regions.length}{" "}
            个版面区域
          </p>
          <Button
            variant="secondary"
            onPress={() => {
              setImageError("");
              void window
                .omniEdu!.getMaterialStructureImage(query)
                .then(setImage)
                .catch(() => setImageError("原始页图读取失败，请重试。"));
            }}
          >
            对照原始页图
          </Button>
          {imageError && <p role="alert">{imageError}</p>}
          {image && (
            <img
              src={image}
              alt={`第${page}页结构来源`}
              style={{ maxWidth: "100%", height: "auto" }}
              data-testid="structure-source-image"
            />
          )}
          <details>
            <summary>原始 OCR 行</summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                maxHeight: 400,
                overflow: "auto",
              }}
              data-testid="structure-raw"
            >
              {view.page.rawText}
            </pre>
          </details>
          <details open>
            <summary>恢复段落</summary>
            <div
              style={{ maxHeight: 450, overflow: "auto" }}
              data-testid="structure-paragraphs"
            >
              {view.page.paragraphs.map((paragraph) => (
                <article key={paragraph.id}>
                  <p>
                    {roles[paragraph.role]} ·{" "}
                    {paragraph.column < 0
                      ? "通栏"
                      : `第 ${paragraph.column + 1} 栏`}{" "}
                    · {(paragraph.confidence * 100).toFixed(1)}% ·{" "}
                    {paragraph.lineIds.length} 行
                    {paragraph.issues.length ? " · 待核对" : ""}
                  </p>
                  <p style={{ whiteSpace: "pre-wrap" }}>{paragraph.text}</p>
                  <details>
                    <summary>原文与位置</summary>
                    <pre style={{ whiteSpace: "pre-wrap" }}>
                      {paragraph.rawText}
                      {"\n"}
                      {JSON.stringify(paragraph.anchor)}
                      {"\n"}
                      {paragraph.lineIds.join(", ")}
                    </pre>
                  </details>
                </article>
              ))}
            </div>
          </details>
          <details open>
            <summary>题目归属</summary>
            <div
              data-testid="structure-questions"
              style={{ maxHeight: 450, overflow: "auto" }}
            >
              {view.questions.length ? (
                view.questions.map((question) => (
                  <article key={question.id}>
                    <p>
                      题 {question.number} · 第 {question.pageRange.join("–")}{" "}
                      页 ·{" "}
                      {question.status === "needs_review"
                        ? "暂缓入库"
                        : "结构候选，尚未核验"}
                    </p>
                    <p style={{ whiteSpace: "pre-wrap" }}>{question.stem}</p>
                    <p>
                      {question.options.length} 个选项 ·{" "}
                      {question.subquestions.length} 个小问 ·{" "}
                      {question.assets.length} 个图表/公式区域
                    </p>
                    {!!question.issues.length && (
                      <p>
                        待核对原因{" "}
                        {question.issues
                          .map((issue) => issueLabels[issue] || issue)
                          .join("、")}
                      </p>
                    )}
                  </article>
                ))
              ) : (
                <p>本页尚无完整题目候选。跨页题目会在后续页面恢复后出现。</p>
              )}
            </div>
          </details>
        </div>
      )}
    </DisclosureCard>
  );
}
