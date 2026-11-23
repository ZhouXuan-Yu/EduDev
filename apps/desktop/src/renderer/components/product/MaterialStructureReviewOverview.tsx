import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import {
  STRUCTURE_REVIEW_GROUPS,
  type DocumentStructureSummary,
  type DocumentStructureReviewOverview,
  type StructureReviewGroup,
} from "../../../shared/material-document-structure";

const labels: Record<StructureReviewGroup, string> = {
  boundaries: "题目边界与分栏",
  choices: "选项",
  formulas: "公式",
  visuals: "图表与版面",
  transcription: "文字识别",
};

export function MaterialStructureReviewOverview({ summary, page, disabled, onPage }: {
  summary: DocumentStructureSummary;
  page: number;
  disabled: boolean;
  onPage: (page: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState<{ page: number; overview?: DocumentStructureReviewOverview; error?: true }>();
  const { resourceId, version, generation } = summary;
  useEffect(() => {
    if (!open) return;
    let live = true;
    void window.omniEdu!.getMaterialStructureReviewOverview({ resourceId, version, page }).then(overview => {
      if (live) setView(overview?.generation === generation ? { page, overview } : { page, error: true });
    }).catch(() => {
      if (live) setView({ page, error: true });
    });
    return () => { live = false; };
  }, [open, page, generation, resourceId, version, revision]);

  const current = view?.page === page ? view : undefined;
  const groups = current?.overview?.groups ?? [];
  return (
    <section aria-label="整份资料的结构核对" data-testid="structure-review-overview">
      <Button variant="secondary" aria-expanded={open} data-testid="structure-review-overview-toggle"
        onPress={() => { setView(undefined); setOpen(value => !value); }}>
        {open ? "收起整份资料的核对项" : "查看整份资料的核对项"}
      </Button>
      {open && (!current ? <p role="status">正在汇总本次识别结果…</p>
        : current.error ? <>
          <p role="alert">暂时无法读取核对项，请重试。</p>
          <Button variant="secondary" onPress={() => { setView(undefined); setRevision(value => value + 1); }}>重试</Button>
        </> : groups.length ? <>
          <p>同一道题可能出现在多个类别中。点击类别可跳到相应页面。</p>
          <div className="teacher-library-actions">
            {STRUCTURE_REVIEW_GROUPS.flatMap(kind => {
              const group = groups.find(item => item.kind === kind);
              if (!group) return [];
              const target = group.nextPage;
              return <Button key={kind} variant="secondary" isDisabled={disabled || target === page}
                data-testid={`structure-review-overview-${kind}`} onPress={() => onPage(target)}>
                {labels[kind]} {group.count} 题 · 第 {target} 页
              </Button>;
            })}
          </div>
        </> : <p>本次识别没有标记需要核对的题目。</p>)}
    </section>
  );
}
