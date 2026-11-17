import editorStyles from "../../ui-system/teaching-editors-alignment.module.css";
import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import type { ArchiveFields } from "../../../shared/question-archive";
import {
  STRUCTURE_REVIEW_SCHEMA,
  type DocumentStructureReference,
  type StructureQuestion,
} from "../../../shared/material-document-structure";
import { QuestionArchiveFields } from "../QuestionArchiveFields";
import "../question-archive.css";

export function MaterialStructureReview({
  question,
  reference,
  reviewedId,
  disabled,
  onDirty,
  onSaved,
}: {
  question: StructureQuestion;
  reference: DocumentStructureReference;
  reviewedId?: string;
  disabled: boolean;
  onDirty: (dirty: boolean) => void;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<ArchiveFields>();
  const [checked, setChecked] = useState(false),
    [difficultyChosen, setDifficultyChosen] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [savedId, setSavedId] = useState("");
  useEffect(() => {
    onDirty(!!fields || busy);
    return () => onDirty(false);
  }, [!!fields, busy, onDirty]);
  if (question.kind !== "question" || question.status !== "needs_review")
    return null;
  if (reviewedId || savedId)
    return (
      <p role="status" data-testid={"structure-reviewed-" + question.id}>
        教师修正已保存到题本，可在教学工作台继续编辑。
      </p>
    );
  if (
    question.issues.some((issue) =>
      [
        "missing_figure",
        "missing_question_start",
        "oversized_question",
      ].includes(issue),
    )
  )
    return (
      <p>题图、题目起点或完整范围仍需重新切题整理，原页和识别记录已保留。</p>
    );
  async function save() {
    if (!fields || !checked || !difficultyChosen || busy) return;
    setBusy(true);
    setError("");
    try {
      const saved = await window.omniEdu!.reviewMaterialStructure({
        schemaVersion: STRUCTURE_REVIEW_SCHEMA,
        reference,
        fields,
        sourceChecked: true,
      });
      setSavedId(saved.id);
      setFields(undefined);
      onSaved();
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setError(
        /structure_source_incomplete|question_too_large/.test(code)
          ? "原题图或完整范围仍需重新整理。输入已保留，可对照原页后继续处理。"
          : /structure_already_reviewed/.test(code)
            ? "该候选已保存到题本。请关闭当前编辑并刷新，在题本中继续补正。"
            : "保存未完成，输入已保留。请检查资料版本和后台任务后重试；同一份修正重复提交会返回原保存结果。",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={"question-archive " + editorStyles.workspace}
      data-testid={"structure-review-" + question.id}
    >
      {!fields ? (
        <Button
          variant="secondary"
          isDisabled={disabled}
          data-testid="structure-review-open"
          onPress={() => {
            setFields({
              stem: question.stem,
              answer: question.answer,
              analysis: question.analysis,
              subject: "",
              grade: "",
              knowledgePoint: "",
              questionType: "",
              difficulty: "medium",
            });
            setChecked(false);
            setDifficultyChosen(false);
            setError("");
          }}
        >
          核对并保存到题本
        </Button>
      ) : (
        <div
          className="question-notebook-form"
          data-testid="structure-review-form"
        >
          <p>
            请对照本题涉及的原始页面，补齐题干、选项、小问及公式。原始 OCR
            与结构候选会保留，修正内容记录为教师编辑。
          </p>
          <div className={editorStyles.fields}>
            <QuestionArchiveFields
              fields={fields}
              onChange={(next) => {
                setFields(next);
                if (next.stem !== fields.stem) setChecked(false);
              }}
              disabled={busy}
              difficultyChosen={difficultyChosen}
              onDifficultyChosen={() => setDifficultyChosen(true)}
              prefix="structure-review"
            />
          </div>
          <label className="question-archive-source-check">
            <input
              type="checkbox"
              checked={checked}
              disabled={busy}
              onChange={(event) => setChecked(event.target.checked)}
              data-testid="structure-review-checked"
            />
            <span>已对照原资料核对本题完整性、选项顺序、图表及跨页衔接</span>
          </label>
          <p>缺少答案、解析或分类时会保留待整理状态，正式组卷继续集中确认。</p>
          <div className="toolbar-row">
            <Button
              isDisabled={
                busy || !checked || !difficultyChosen || !fields.stem.trim()
              }
              onPress={() => void save()}
              data-testid="structure-review-save"
            >
              {busy ? "保存中…" : "保存教师修正"}
            </Button>
            <Button
              variant="secondary"
              isDisabled={busy}
              onPress={() => {
                setFields(undefined);
                setError("");
              }}
              data-testid="structure-review-cancel"
            >
              取消编辑
            </Button>
          </div>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
