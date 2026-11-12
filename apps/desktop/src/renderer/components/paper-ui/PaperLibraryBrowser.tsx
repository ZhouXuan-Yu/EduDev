import {Button} from '@heroui/react';
import type {ReactNode} from 'react';
import {BookOpen, Plus} from 'lucide-react';
import {PaperLibraryQuestionCard} from './PaperLibraryQuestionCard';
import type {PaperLibrarySelection} from './usePaperLibrarySelection';
import {PaperLibraryRail} from './PaperLibraryRail';
import {PaperLibraryToolbar} from './PaperLibraryToolbar';
import {usePaperLibraryBrowser} from './usePaperLibraryBrowser';
import {BASKET_PAGE_SIZE} from './paper-basket-ui';
import styles from '../../ui-system/paper-studio/paper-library-browser.module.css';

/** Read the canonical library without implicitly creating a session or basket. */
export function PaperLibraryBrowser({disabled, onCreate, onSelect, sourceActions, reviewOpen}: {
  disabled: boolean;
  onCreate: () => void;
  onSelect: (selection: PaperLibrarySelection) => void;
  sourceActions?: ReactNode;
  reviewOpen?: boolean;
}) {
  const state = usePaperLibraryBrowser();
  const {view, rows, total, loading, error} = state;
  const hasFilters = Object.values(view.ui.filters).some(value => typeof value === 'string' && !!value.trim());
  return <section className={styles.workspace} data-testid="paper-library-browser" aria-label="题库浏览">
    <PaperLibraryRail facet={view.facet} filters={view.ui.filters} categories={state.categories}
      loading={state.categoriesLoading} error={state.categoriesError} disabled={disabled}
      onFacet={state.facet} onFilter={state.filter} onRetry={state.retryCategories}/>
    <div className={styles.main}>
      <PaperLibraryToolbar filters={view.ui.filters} disabled={disabled} total={total} loading={loading}
        error={error} onFilter={state.filter} onReset={state.reset} sourceActions={sourceActions} reviewOpen={reviewOpen}/>
      <div ref={state.scroll} className={styles.questions} data-testid="paper-library-results"
        aria-busy={loading} role="region" aria-label="题库结果" tabIndex={0}>
        {loading && <p role="status">正在读取题目…</p>}
        {error && <div role="alert"><p>{error}</p>
          <Button variant="secondary" onPress={state.retry}>重新读取</Button>
        </div>}
        {!loading && !error && !rows.length && <div className={styles.empty}>
          <BookOpen size={28} aria-hidden="true"/>
          <h2>{view.ui.offset > 0 ? '此页没有题目' : hasFilters ? '没有匹配的题目' : '题库中还没有题目'}</h2>
          <p>{view.ui.offset > 0 ? '题目列表已更新，可返回上一页或重置筛选。' : '可以从资料库整理题目，或在题本中添加题目。'}</p>
        </div>}
        {!loading && !error && rows.map(({question, version}) => <PaperLibraryQuestionCard
          key={question.id + ':' + version} question={question} version={version} disabled={disabled}
          onSelect={() => onSelect({questionId: question.id, contentVersion: version,
            subject: question.subject, grade: question.grade, ui: view.ui})}/>)}
      </div>
      {state.storageIssue && <p role="status" className={styles.preferenceStatus} data-testid="paper-library-preference-error">
        浏览设置未能恢复或保存，当前仍可筛选；重开后可能使用默认条件。
        <Button variant="ghost" size="sm" isDisabled={disabled} onPress={state.retryPreferences}
          data-testid="paper-library-preference-retry">重试保存浏览设置</Button>
      </p>}
      {!loading && !error && (total > BASKET_PAGE_SIZE || view.ui.offset > 0) &&
        <footer className={styles.pagination}>
          <Button variant="secondary" isDisabled={disabled || view.ui.offset === 0} data-testid="paper-library-prev"
            onPress={() => state.page(Math.max(0, view.ui.offset - BASKET_PAGE_SIZE))}>上一页</Button>
          <span>{Math.floor(view.ui.offset / BASKET_PAGE_SIZE) + 1} / {Math.max(1, Math.ceil(total / BASKET_PAGE_SIZE))}</span>
          <Button variant="secondary" isDisabled={disabled || view.ui.offset + BASKET_PAGE_SIZE >= total}
            data-testid="paper-library-next" onPress={() => state.page(view.ui.offset + BASKET_PAGE_SIZE)}>下一页</Button>
        </footer>}
    </div>
    <aside className={styles.basket} aria-label="已选题目">
      <h2>已选题目 <span>0</span></h2>
      <div className={styles.empty}><BookOpen size={28} aria-hidden="true"/>
        <p>选择合适的题目加入，随后整理与核对。</p></div>
      <Button isDisabled={disabled} onPress={onCreate} data-testid="paper-library-create">
        <Plus size={16}/>新建题篮
      </Button>
    </aside>
  </section>;
}
