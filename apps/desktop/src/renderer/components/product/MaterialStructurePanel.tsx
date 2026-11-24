import { MaterialStructureReview } from "./MaterialStructureReview";
import { MaterialStructureReviewOverview } from "./MaterialStructureReviewOverview";
import { MaterialStructureTableEvidence } from "./MaterialStructureTableEvidence";
import { useCallback, useEffect, useState } from "react";
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
  pdf_text_conflict: "PDF 页源待核对，请对照原页检查",
  native_unconfirmed: "原生文字与局部识别尚未一致",
  printed_crop_unconfirmed: "题号已定位，裁片文字待核对",
  low_ocr_score: "OCR置信度偏低",
  ambiguous_region: "版面区域待核对",
  ambiguous_columns: "分栏待核对",
  uncertain_boundary: "题目边界待核对",
  numbering_conflict: "编号关系不明确",
  missing_question_number: "原页题号未确认",
  missing_question_start: "未定位题目起点",
  missing_choice_options: "部分整题选项待核对",
  formula_text_unconfirmed: "公式文字待核对",
  table_content_unconfirmed: "表格单元格待核对",
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
  onDraftDirty,
}: {
  resource: TeacherResource;
  onDraftDirty?: (dirty: boolean) => void;
}) {
  const [reviewDirty, setReviewDirty] = useState(false);
  const reportDirty = useCallback(
    (dirty: boolean) => {
      setReviewDirty(dirty);
      onDraftDirty?.(dirty);
    },
    [onDraftDirty],
  );
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
          isDisabled={busy || active || reviewDirty}
          onPress={() => void action("rebuild")}
          data-testid="structure-rebuild"
        >
          {view?.summary ? "重建结构" : "恢复文档结构"}
        </Button>
        {active && (
          <Button
            variant="secondary"
            isDisabled={busy || reviewDirty}
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
              isDisabled={busy || reviewDirty}
              onPress={() => void action("retry")}
              data-testid="structure-retry"
            >
              继续处理
            </Button>
          )}
        <Button
          variant="secondary"
          isDisabled={busy || reviewDirty}
          onPress={() => setRevision((value) => value + 1)}
        >
          刷新
        </Button>
      </div>
      {!view?.summary && !loading && !error && (
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
          {view.summary.held > 0 && ["complete", "partial"].includes(view.summary.status) && (
            <MaterialStructureReviewOverview key={view.summary.generation} summary={view.summary} page={page}
              disabled={reviewDirty || busy} onPage={setPage} />
          )}
          <div className="teacher-library-actions">
            <Button
              variant="secondary"
              isDisabled={page <= 1 || reviewDirty}
              onPress={() => setPage((value) => value - 1)}
              data-testid="structure-previous"
            >
              上一页
            </Button>
            <span>第 {page} 页</span>
            <Button
              variant="secondary"
              isDisabled={page >= view.summary.processed || reviewDirty}
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
          {view.page.nativeRecovery && (
            <p role="status" data-testid="structure-native-recovery">
              {view.page.nativeRecovery.native.ok
                ? `原生文字辅助补充 ${view.page.nativeRecovery.accepted.length} 行，${view.page.nativeRecovery.unresolved.length} 行待核对`
                : "原生文字辅助暂不可用，保留原 OCR 记录"}
            </p>
          )}
          {view.page.printedRecovery && (
            <p role="status" data-testid="structure-printed-recovery">
              已从原页补识 {view.page.printedRecovery.parents.length} 行，
              恢复 {view.page.printedRecovery.blanks.length} 处印刷填空
            </p>
          )}
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
          <DisclosureCard title="原始 OCR 行">
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
          </DisclosureCard>
          <DisclosureCard title="恢复段落" defaultExpanded>
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
                  <DisclosureCard title="原文与位置" headingLevel={4}>
                    <pre style={{ whiteSpace: "pre-wrap" }}>
                      {paragraph.rawText}
                      {"\n"}
                      {JSON.stringify(paragraph.anchor)}
                      {"\n"}
                      {paragraph.lineIds.join(", ")}
                    </pre>
                  </DisclosureCard>
                </article>
              ))}
            </div>
          </DisclosureCard>
          <DisclosureCard title="题目归属" defaultExpanded>
            <div
              data-testid="structure-questions"
              style={{ maxHeight: 450, overflow: "auto" }}
            >
              {view.questions.length ? (
                view.questions.map((question) => (
                  <article key={question.id}>
                    <p>
                      {question.number === "0" ? "题号未确认" : "题 " + question.number} · 第 {question.pageRange.join("–")}{" "}
                      页 ·{" "}
                      {view.reviewed?.[question.id]
                        ? "已核对入题本"
                        : question.status === "needs_review"
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
                    {!!question.tableSources?.length && view.references?.[question.id] && (
                      <MaterialStructureTableEvidence sources={question.tableSources} reference={view.references[question.id]} />
                    )}
                    {view.references?.[question.id] && (
                      <MaterialStructureReview
                        key={view.summary?.generation + question.id}
                        question={question}
                        reference={view.references[question.id]}
                        reviewedId={view.reviewed?.[question.id]}
                        disabled={busy || active || reviewDirty}
                        onDirty={reportDirty}
                        onSaved={() => setRevision((value) => value + 1)}
                      />
                    )}
                  </article>
                ))
              ) : (
                <p>本页尚无完整题目候选。跨页题目会在后续页面恢复后出现。</p>
              )}
            </div>
          </DisclosureCard>
        </div>
      )}
    </DisclosureCard>
  );
}
