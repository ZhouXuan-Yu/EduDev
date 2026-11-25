import { useEffect, useRef, useState } from 'react';
import { Button } from '@heroui/react';
import type { TeacherResource } from '../../../shared/contracts';
import { LOCAL_BOOK_ANSWERS_PAGE_COUNT, LOCAL_BOOK_ANSWERS_SCHEMA, LOCAL_BOOK_RECHECK_SCHEMA,
  type LocalBookAnswersView } from '../../../shared/material-local-book-answers';
import { MaterialLocalBookAnswerSource } from './MaterialLocalBookAnswerSource';

export function MaterialLocalBookAnswers({ resource }: { resource: TeacherResource }) {
  const [view, setView] = useState<LocalBookAnswersView>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sourcePage, setSourcePage] = useState<number>();
  const [checkingPage, setCheckingPage] = useState<number>();
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

  async function recheck(page: number) {
    const attempt = ++request.current;
    setCheckingPage(page);
    setError('');
    try {
      const result = await window.omniEdu!.recheckLocalBookAnswers({
        schemaVersion:LOCAL_BOOK_RECHECK_SCHEMA,resourceId:resource.id,version:resource.contentHash,page,
      });
      if (attempt === request.current) setView(current => current && {...current,
        pages:current.pages.map(item => item.page === page ? {...item,recheck:result} : item)});
    } catch (cause) {
      if (attempt !== request.current) return;
      const message = String(cause);
      const stale = /source_changed|source_incomplete|book_pair_required/u.test(message);
      if (stale) setView(undefined);
      setError(message.includes('local_recheck_unavailable') ? '当前电脑无法使用 Windows 中文 OCR，候选答案仍可对照原页。'
        : stale ? '原页或关联已变化，请重新读取答案册。'
        : '本地复读未完成，请重试或对照原页。');
    } finally {
      if (attempt === request.current) setCheckingPage(undefined);
    }
  }

  const busy = pending || checkingPage !== undefined;

  return <section aria-label="本地单选答案候选" data-testid="local-book-answers" aria-busy={busy}>
    <div className="toolbar-row">
      <Button variant="secondary" data-testid="local-book-answers-scan"
        isDisabled={busy} onPress={() => void scan(currentStart.current)}>
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
        {view.pages.map(({ page, answers, recheck: receipt }) => <div key={page} data-testid="local-book-answer-page">
          <div className="toolbar-row">
            <span>第 {page} 页 · {answers.length} 条</span>
            <Button variant="tertiary" data-testid="local-book-answer-original" isDisabled={pending}
              onPress={event => { sourceTrigger.current = event.target as HTMLElement; setSourcePage(page); }}>
              对照第 {page} 页原图
            </Button>
            <Button variant="tertiary" data-testid="local-book-answer-recheck" isDisabled={busy}
              onPress={() => void recheck(page)}>{checkingPage === page ? '正在复读…' : '用本地 OCR 复读'}</Button>
          </div>
          {receipt && <p role="status" data-testid="local-book-answer-recheck-result">
            复读字母 {receipt.agreeing}/{receipt.checked} 条一致。
            {receipt.different > 0 && ` ${receipt.different} 条所在答案行读数不同。`}
            {receipt.unreadable > 0 && ` ${receipt.unreadable} 条所在答案行读不清。`}
            {' '}仍须对照原卷配答。
          </p>}
          <ul>
            {Array.from(new Set(answers.map(answer => answer.section))).map(section => <li key={section}>
              <p>{section}</p>
              <p data-testid="local-book-answer-values">{answers.filter(answer => answer.section === section)
                .map(answer => `${answer.number} ${answer.answer}`).join(' · ')}</p>
            </li>)}
          </ul>
        </div>)}
        {view.total > LOCAL_BOOK_ANSWERS_PAGE_COUNT && <div className="toolbar-row">
          <button type="button" className="secondary-action" disabled={busy || view.start <= 1}
            onClick={() => void scan(Math.max(1, view.start - LOCAL_BOOK_ANSWERS_PAGE_COUNT))}>前一批页码</button>
          <button type="button" className="secondary-action" disabled={busy || view.end >= view.total}
            onClick={() => void scan(view.end + 1)}>后一批页码</button>
        </div>}
        {sourcePage !== undefined && <MaterialLocalBookAnswerSource key={sourcePage} resource={resource}
          page={sourcePage} onClose={closeSource}/>}
      </>}
    </>}
  </section>;
}
