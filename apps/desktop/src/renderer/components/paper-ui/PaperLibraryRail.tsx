import {useId, type KeyboardEvent} from 'react';
import {Button, Label, SearchField} from '@heroui/react';
import type {QuestionNotebookCategory} from '../../../shared/contracts';
import type {PaperBasketUiState} from '../../../shared/paper-basket';
import type {PaperLibraryFacet} from './paper-library-view';
import styles from '../../ui-system/paper-studio/paper-library-browser.module.css';

export function PaperLibraryRail({facet, filters, categories, loading, error, disabled, onFacet, onFilter, onRetry}: {
  facet: PaperLibraryFacet;
  filters: PaperBasketUiState['filters'];
  categories: QuestionNotebookCategory[];
  loading: boolean;
  error: string;
  disabled: boolean;
  onFacet: (value: PaperLibraryFacet) => void;
  onFilter: (patch: Partial<PaperBasketUiState['filters']>) => void;
  onRetry: () => void;
}) {
  const id = useId();
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey ||
      !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')];
    const index = tabs.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + 1) % tabs.length;
    tabs[next].focus();
    onFacet(tabs[next].dataset.facet as PaperLibraryFacet);
  }
  const unavailable = !!filters.categoryId && !loading && !error &&
    !categories.some(category => category.id === filters.categoryId);
  return <aside className={styles.filters} aria-label="知识点与分类">
    <div role="tablist" aria-label="题库分类方式" className={styles.railTabs} onKeyDown={navigate}>
      {([{id: 'knowledge', label: '知识点'}, {id: 'categories', label: '分类'}] as const).map(item =>
        <button type="button" role="tab" key={item.id} id={`${id}-${item.id}-tab`} data-facet={item.id}
          data-testid={`paper-library-facet-${item.id}`} aria-controls={`${id}-${item.id}-panel`}
          aria-selected={facet === item.id} tabIndex={facet === item.id ? 0 : -1} disabled={disabled}
          onClick={() => onFacet(item.id)}>{item.label}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-knowledge-panel`} aria-labelledby={`${id}-knowledge-tab`} hidden={facet !== 'knowledge'}>
      <SearchField value={filters.knowledgePoint ?? ''} isDisabled={disabled}
        onChange={knowledgePoint => onFilter({knowledgePoint})}>
        <Label>知识点</Label>
        <SearchField.Group><SearchField.Input maxLength={240} data-testid="paper-library-knowledge-point"/>
          <SearchField.ClearButton aria-label="清除知识点"/></SearchField.Group>
      </SearchField>
    </div>
    <div role="tabpanel" id={`${id}-categories-panel`} aria-labelledby={`${id}-categories-tab`}
      hidden={facet !== 'categories'} aria-busy={loading}>
      <button type="button" className={styles.category} aria-pressed={!filters.categoryId} disabled={disabled}
        data-testid="paper-library-category-all" onClick={() => onFilter({categoryId: undefined})}>全部分类</button>
      {loading && <p role="status">正在读取分类…</p>}
      {error && <div role="alert"><p>{error}</p><Button variant="ghost" size="sm" onPress={onRetry}>重试分类</Button></div>}
      {!loading && !error && !categories.length && <p>尚未创建分类，可在题本中管理。</p>}
      {unavailable && <p role="status">原分类暂不可用，可切换全部分类。</p>}
      {categories.map(category => <button type="button" key={category.id} className={styles.category}
        data-testid="paper-library-category" data-category-id={category.id} disabled={disabled}
        aria-pressed={filters.categoryId === category.id} onClick={() => onFilter({categoryId: category.id})}>
        <span>{category.name}</span><small>{category.entryCount}</small>
      </button>)}
    </div>
    <p>浏览已保存题目，核对题干、原图和来源。</p>
  </aside>;
}
