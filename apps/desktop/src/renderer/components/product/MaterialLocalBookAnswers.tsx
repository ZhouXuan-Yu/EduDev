import { useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import type { TeacherResource } from '../../../shared/contracts';
import { LOCAL_BOOK_ANSWERS_PAGE_COUNT, LOCAL_BOOK_ANSWERS_SCHEMA,
  type LocalBookAnswersView } from '../../../shared/material-local-book-answers';
import { MaterialLocalBookAnswerSource } from './MaterialLocalBookAnswerSource';

export function MaterialLocalBookAnswers({ resource }: { resource: TeacherResource }) {
  const [view, setView] = useState<LocalBookAnswersView>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sourcePage, setSourcePage] = useState<number>();
  const sourceTrigger = useRef<HTMLElement | null>(null);
  const request = useRef(0);
  const currentStart = useRef(1);
  useEffect(() => () => { request.current++; }, []);

  function closeSource() {
    setSourcePage(undefined);
    requestAnimationFrame(() => sourceTrigger.current?.focus());
  }

  async function scan(start: number) {
    const attempt = ++request.current;
    currentStart.current = start;
    setPending(true);
    setError('');
    setSourcePage(undefined);
    try {
      const result = await window.omniEdu!.getLocalBookAnswers({
        schemaVersion: LOCAL_BOOK_ANSWERS_SCHEMA, resourceId: resource.id, version: resource.contentHash, start,
      });
      if (attempt === request.current) setView(result);
    } catch (cause) {
      if (attempt !== request.current) return;
      setView(undefined);
      setError(/source_changed|book_pair_required/u.test(String(cause))
        ? '原件版本或答案册关联已变化。请刷新资料后再读取。' : '读取失败，请重试。');
    } finally {
      if (attempt === request.current) setPending(false);
    }
  }

  return <section aria-label="本地单选答案候选" data-testid="local-book-answers" aria-busy={pending}>
    <div className="toolbar-row">
      <Button variant="secondary" data-testid="local-book-answers-scan"
        isDisabled={pending} onPress={() => void scan(currentStart.current)}>
        {view || error ? '重新读取本地答案' : '查看本地单选答案'}
      </Button>
    </div>
    {pending && <p role="status">正在读取本地识别结果…</p>}
    {error && <p role="alert">{error}</p>}
    {view && <>
      {!view.total ? <p role="status">答案册正在等待本地处理，请稍后重新读取。</p> : <>
        <p role="status">第 {view.start}–{view.end} 页，共 {view.total} 页。
          {view.pending > 0 && ` ${view.pending} 页还未处理。`}
          {view.review > 0 && ` ${view.review} 页需对照原件。`}
        </p>
        {view.pages.length ? <p>本地识别候选，待核对原页。</p> : <p>这几页暂无可定位的单选答案候选。</p>}
        {view.pages.map(({ page, answers }) => <div key={page} data-testid="local-book-answer-page">
          <div className="toolbar-row">
            <span>第 {page} 页 · {answers.length} 条</span>
            <Button variant="tertiary" data-testid="local-book-answer-original" isDisabled={pending}
              onPress={event => { sourceTrigger.current = event.target as HTMLElement; setSourcePage(page); }}>
              对照第 {page} 页原图
            </Button>
          </div>
          <ul>
            {Array.from(new Set(answers.map(answer => answer.section))).map(section => <li key={section}>
              <p>{section}</p>
              <p data-testid="local-book-answer-values">{answers.filter(answer => answer.section === section)
                .map(answer => `${answer.number} ${answer.answer}`).join(' · ')}</p>
            </li>)}
          </ul>
        </div>)}
        {view.total > LOCAL_BOOK_ANSWERS_PAGE_COUNT && <div className="toolbar-row">
          <button type="button" className="secondary-action" disabled={pending || view.start <= 1}
            onClick={() => void scan(Math.max(1, view.start - LOCAL_BOOK_ANSWERS_PAGE_COUNT))}>前一批页码</button>
          <button type="button" className="secondary-action" disabled={pending || view.end >= view.total}
            onClick={() => void scan(view.end + 1)}>后一批页码</button>
        </div>}
        {sourcePage !== undefined && <MaterialLocalBookAnswerSource key={sourcePage} resource={resource}
          page={sourcePage} onClose={closeSource}/>}
      </>}
    </>}
  </section>;
}
