import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import type { MockExamAnswerReview, MockExamAnswerReviewRead } from "../../../shared/mock-exam-compilation";
import { bookMatchReasons } from "../../../shared/question-book-answer";
import { DisclosureCard } from "../ui/DisclosureCard";
import styles from "../../ui-system/mock-exam-catalog.module.css";

const labels = { saved: "已写回题本", held: "待核对", changed: "题目或记录已变化" };
type ReadState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; value: MockExamAnswerReview };

export function PiMockExamAnswerReview({ input }: { input: MockExamAnswerReviewRead }) {
  const { schemaVersion, sessionId, id, resourceId, revision, digest } = input;
  const [open, setOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<ReadState>({ status: "loading" });

  useEffect(() => {
    if (!open) return;
    let current = true;
    setState({ status: "loading" });
    const unavailable = "暂时无法读取逐题配答。";
    const api = window.omniEdu;
    if (!api) {
      setState({ status: "error", message: unavailable });
      return;
    }
    void api.reviewMockExamAnswers({ schemaVersion, sessionId, id, resourceId, revision, digest }).then(result => {
      if (!current) return;
      setState(result.ok ? { status: "ready", value: result.value } : { status: "error", message: result.message });
    }).catch(() => {
      if (current) setState({ status: "error", message: unavailable });
    });
    return () => { current = false; };
  }, [open, reload, schemaVersion, sessionId, id, resourceId, revision, digest]);

  return <DisclosureCard title="逐题配答记录" headingLevel={4} isExpanded={open} onExpandedChange={setOpen}
    data-testid="mock-exam-answer-review">
    {open && <div className={styles.answerReview}>
      {state.status === "loading" && <p role="status">正在核对原件并读取配答记录…</p>}
      {state.status === "error" && <p role="alert" data-testid="mock-exam-answer-review-error">{state.message}</p>}
      {state.status === "ready" && <>
        {!state.value.rows.length && <p data-testid="mock-exam-answer-review-empty">当前配对尚无可读的逐题记录。可在资料库打开试题核对。</p>}
        {state.value.rows.length > 0 && <>
          <p>显示最近已记录的题目。整卷答案仍须按原件核对。</p>
          <ul className={styles.answerReviewRows} aria-label="近期逐题配答记录">
            {state.value.rows.map(row => <li key={row.id} data-testid="mock-exam-answer-review-item" data-state={row.state}>
              <strong>第 {row.number} 题 · {labels[row.state]}</strong>
              {row.answerPage && <span>答案册第 {row.answerPage} 页</span>}
              {row.reason && <span>{Object.hasOwn(bookMatchReasons, row.reason) ? bookMatchReasons[row.reason] : "请核对原页"}</span>}
            </li>)}
          </ul>
        </>}
        {state.value.limited && <p>还有较早记录，可到资料库按原页查看。</p>}
        {state.value.unreadable > 0 && <p>{state.value.unreadable} 条记录暂不可读。</p>}
      </>}
      {state.status !== "loading" && <Button variant="ghost" size="sm" onPress={() => setReload(value => value + 1)}>
        {state.status === "error" ? "重试" : "刷新记录"}
      </Button>}
    </div>}
  </DisclosureCard>;
}
