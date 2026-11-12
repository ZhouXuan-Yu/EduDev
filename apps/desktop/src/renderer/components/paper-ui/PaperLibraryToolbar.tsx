import {Button, Label, SearchField} from '@heroui/react';
import type {ReactNode} from 'react';
import type {PaperBasketUiState} from '../../../shared/paper-basket';
import {PaperQuestionDisclosure} from './PaperQuestionDisclosure';
import {PaperSelect} from './PaperSelect';
import styles from '../../ui-system/paper-studio/paper-library-browser.module.css';

export function PaperLibraryToolbar({filters, disabled, total, loading, error, onFilter, onReset, sourceActions, reviewOpen}: {
  filters: PaperBasketUiState['filters'];
  disabled: boolean;
  total: number;
  loading: boolean;
  error: string;
  onFilter: (patch: Partial<PaperBasketUiState['filters']>) => void;
  onReset: () => void;
  sourceActions?: ReactNode;
  reviewOpen?: boolean;
}) {
  const questionTypes = ['选择题', '填空题', '解答题'];
  if (filters.questionType && !questionTypes.includes(filters.questionType)) questionTypes.push(filters.questionType);
  const advanced = !!(filters.questionNumber || filters.sourceKind);
  return <div className={styles.toolbar} data-review-open={reviewOpen}>
    <SearchField value={filters.query ?? ''} isDisabled={disabled} aria-label="搜索题库"
      onChange={query => onFilter({query})}>
      <SearchField.Group><SearchField.SearchIcon/>
        <SearchField.Input maxLength={240} data-testid="paper-library-query" placeholder="搜索题干、知识点或标签"/>
        <SearchField.ClearButton aria-label="清除题目搜索"/>
      </SearchField.Group>
    </SearchField>
    {sourceActions}
    <div className={styles.filterRow}>
      <div className={styles.filterControl}><span>题型</span>
        <PaperSelect label="题型" hideLabel value={filters.questionType ?? ''} disabled={disabled}
          testId="paper-library-type" options={[{id: '', label: '全部题型'}, ...questionTypes.map(id => ({id, label: id}))]}
          onChange={questionType => onFilter({questionType})}/>
      </div>
      <div className={styles.filterControl}><span>难度</span>
        <PaperSelect label="难度" hideLabel value={filters.difficulty ?? ''} disabled={disabled} testId="paper-library-difficulty"
          options={[{id: '', label: '全部难度'}, {id: 'easy', label: '基础'}, {id: 'medium', label: '中等'}, {id: 'hard', label: '较难'}]}
          onChange={value => onFilter({difficulty: value === 'easy' || value === 'medium' || value === 'hard' ? value : undefined})}/>
      </div>
      <Button variant="ghost" isDisabled={disabled} onPress={onReset} data-testid="paper-library-reset">重置</Button>
      <span className={styles.count}>{loading ? '正在读取题目…' : error ? '读取失败' : `共 ${total} 道题`}</span>
    </div>
    <PaperQuestionDisclosure title={advanced ? '更多筛选 · 已有条件' : '更多筛选'} defaultExpanded={advanced}
      data-testid="paper-library-advanced">
      <div className={styles.advancedFilters}>
        <SearchField value={filters.questionNumber ?? ''} isDisabled={disabled}
          onChange={questionNumber => onFilter({questionNumber})}>
          <Label>原题号</Label>
          <SearchField.Group><SearchField.Input maxLength={240} data-testid="paper-library-question-number"
            placeholder="资料中的原题号"/><SearchField.ClearButton aria-label="清除原题号"/></SearchField.Group>
        </SearchField>
        <PaperSelect label="题源" value={filters.sourceKind ?? ''} disabled={disabled} testId="paper-library-source-kind"
          options={[{id: '', label: '全部题源'}, {id: 'local_bank', label: '本地题库'},
            {id: 'teacher_resource', label: '教师资料'}, {id: 'generated', label: '生成题'}]}
          onChange={value => onFilter({sourceKind: value === 'local_bank' || value === 'teacher_resource' || value === 'generated' ? value : undefined})}/>
      </div>
    </PaperQuestionDisclosure>
  </div>;
}
