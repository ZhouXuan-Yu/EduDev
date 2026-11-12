import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {Button, Label, SearchField} from '@heroui/react';
import type {QuestionNotebookCategory} from '../../../shared/contracts';
import {PAPER_BASKET_SCHEMA, type PaperBasketCandidate, type PaperBasketUiState} from '../../../shared/paper-basket';
import {EmptyState} from '../../heroui-pro/components/empty-state';
import {PaperCandidateCard} from './PaperCandidateCard';
import {PaperQuestionDisclosure} from './PaperQuestionDisclosure';
import {PaperSelect} from './PaperSelect';
import {basketErrors, BASKET_PAGE_SIZE, observeCandidateScroll} from './paper-basket-ui';
import {paperBasketClient, type PaperWorkspaceBasket, type PaperWorkspaceEntry, type PaperWorkspaceOperation} from './paper-basket-client';
import styles from '../../ui-system/paper-studio/paper-studio.module.css';

type CandidateRow = {id: string; candidate?: PaperBasketCandidate; error?: string};

export function PaperCandidateBrowser({basket, ui, disabled, restoreKey, onUi, onMutate, replaceEntry, onCancelReplace, onReplaced, sourceActions, additionalActions}: {
  sourceActions?: ReactNode;
  additionalActions?: ReactNode;
  basket: PaperWorkspaceBasket;
  ui: PaperBasketUiState;
  disabled: boolean;
  restoreKey: number;
  onUi: (value: PaperBasketUiState) => void;
  onMutate: (operation: PaperWorkspaceOperation) => Promise<boolean>;
  replaceEntry?: PaperWorkspaceEntry;
  onCancelReplace?: () => void;
  onReplaced?: () => void;
}) {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [categories, setCategories] = useState<QuestionNotebookCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const scroll = useRef<HTMLDivElement>(null);
  const latest = useRef({ui, onUi}); latest.current = {ui, onUi};
  const filters = JSON.stringify(ui.filters);
  const blueprintKey = JSON.stringify(basket.blueprint);

  useEffect(() => {
    let live = true;
    void window.omniEdu!.listQuestionNotebookCategories(false).then(value => {if (live) setCategories(value.filter(item => item.status === 'active'));})
      .catch(() => {if (live) setError('分类读取未完成，未生成示例分类。');});
    return () => {live = false;};
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    const timer = setTimeout(() => {void (async () => {
      try {
        const result = await window.omniEdu!.listQuestionNotebook({...ui.filters, subject: basket.blueprint.subject,
          grade: basket.blueprint.grade, limit: BASKET_PAGE_SIZE, offset: ui.offset});
        if (!live) return;
        setTotal(result.total);
        const loaded: CandidateRow[] = [];
        // At most four candidate reads in flight, each bound to this basket and source version.
        for (let index = 0; index < result.items.length; index += 4) {
          const chunk = await Promise.all(result.items.slice(index, index + 4).map(async item => {
            try {
              const detail = await paperBasketClient(window.omniEdu!).candidate({schemaVersion: PAPER_BASKET_SCHEMA,
                sessionId: basket.sessionId, basketId: basket.id, questionId: item.id});
              return detail.ok ? {id: item.id, candidate: detail.value} : {id: item.id, error: basketErrors[detail.error]};
            } catch {return {id: item.id, error: '完整题面读取未完成，请重新读取。'};}
          }));
          if (!live) return;
          loaded.push(...chunk);
        }
        setRows(loaded);
      } catch {if (live) setError('题库查询未完成，请重试。没有把读取失败当作空题库。');}
      finally {if (live) setLoading(false);}
    })();}, 200);
    return () => {live = false; clearTimeout(timer);};
  }, [basket.id, basket.sessionId, blueprintKey, filters, ui.offset, refresh]);

  useLayoutEffect(() => {
    if (loading || !scroll.current) return;
    return observeCandidateScroll(scroll.current, latest.current.ui.scrollTop, position => {
      latest.current.onUi({...latest.current.ui, scrollTop: position});
    });
  }, [loading, restoreKey, basket.id, basket.sessionId, blueprintKey, filters, ui.offset, refresh]);

  function filter(key: keyof PaperBasketUiState['filters'], value: string) {
    const next = {...ui.filters};
    if (value) Object.assign(next, {[key]: value}); else delete next[key];
    onUi({...ui, filters: next, offset: 0, scrollTop: 0});
  }
  function page(offset: number) {onUi({...ui, offset, scrollTop: 0});}
  const knowledgePoints = [...new Set(basket.blueprint.sections.map(section => section.knowledgePoint).filter((point): point is string => !!point))];
  return <section className={styles.candidates} data-testid="paper-candidate-browser" aria-label="找题与选题">
    <aside className={styles.filterRail} aria-label="知识点与分类">
      <h2 className={styles.railTitle}>知识点与分类</h2>
      <SearchField value={ui.filters.knowledgePoint || ''} isDisabled={disabled} onChange={value => filter('knowledgePoint', value)}>
        <Label>知识点</Label><SearchField.Group><SearchField.Input maxLength={240} data-testid="paper-basket-kp"/><SearchField.ClearButton/></SearchField.Group>
      </SearchField>
      {!!knowledgePoints.length && <div className={styles.knowledgePoints}>
        <p className={styles.railNote}>蓝图知识点</p>
        <button type="button" className={styles.knowledgePoint} disabled={disabled} aria-pressed={!ui.filters.knowledgePoint}
          onClick={() => filter('knowledgePoint', '')}>全部知识点</button>
        {knowledgePoints.map(point => <button key={point} type="button" className={styles.knowledgePoint} disabled={disabled}
          aria-pressed={ui.filters.knowledgePoint === point} onClick={() => filter('knowledgePoint', point)}>{point}</button>)}
      </div>}
      <PaperSelect label="分类" value={ui.filters.categoryId || ''} disabled={disabled} testId="paper-basket-category"
        options={[{id: '', label: '全部分类'}, ...categories.map(item => ({id: item.id, label: item.name}))]} onChange={value => filter('categoryId', value)}/>
      <p className={styles.railNote}>{basket.blueprint.subject} · {basket.blueprint.grade}</p>
    </aside>
    <div className={styles.candidateMain}>
      <div className={styles.findToolbar}>
        {replaceEntry && <section role="group" aria-label="为当前题目换题" data-testid="paper-instance-replacement">
          <p>选择完整候选替换当前题目，保留它在试卷中的位置。换题后需要重新核对。</p>
          <Button variant="secondary" data-testid="paper-instance-replace-cancel" onPress={onCancelReplace}>取消换题，返回整理</Button>
        </section>}
        <div className={styles.searchFields}>
          <SearchField aria-label="搜索题目" value={ui.filters.query || ''} isDisabled={disabled} onChange={value => filter('query', value)}>
            <SearchField.Group><SearchField.SearchIcon/><SearchField.Input maxLength={240}
              data-testid="paper-basket-search" placeholder="题干、解析、知识点或标签"/><SearchField.ClearButton/></SearchField.Group>
          </SearchField>
          <Button variant="secondary" isDisabled={disabled} data-testid="paper-basket-search-submit" onPress={() => setRefresh(value => value + 1)}>搜索</Button>
        </div>
        {sourceActions}
        <div className={styles.filters}>
          <div className={styles.inlineFilter}><span className={styles.filterLabel}>题型</span><div className={styles.filterControl}>
            <PaperSelect label="题型" hideLabel value={ui.filters.questionType || ''} disabled={disabled} testId="paper-basket-type"
              options={[{id: '', label: '全部题型'}, ...[...new Set(basket.blueprint.sections.map(item => item.questionType))].map(id => ({id, label: id}))]}
              onChange={value => filter('questionType', value)}/>
          </div></div>
          <div className={styles.inlineFilter}><span className={styles.filterLabel}>难度</span><div className={styles.filterControl}>
            <PaperSelect label="难度" hideLabel value={ui.filters.difficulty || ''} disabled={disabled} testId="paper-basket-difficulty"
              options={[{id: '', label: '全部难度'}, {id: 'easy', label: '基础'}, {id: 'medium', label: '中等'}, {id: 'hard', label: '困难'}]}
              onChange={value => filter('difficulty', value)}/>
          </div></div>
          <Button variant="ghost" isDisabled={disabled} onPress={() => onUi({...ui, filters: {}, offset: 0, scrollTop: 0})}>重置</Button>
          <PaperQuestionDisclosure title={ui.filters.questionNumber || ui.filters.sourceKind ? '更多筛选 · 已有条件' : '更多筛选'}
            defaultExpanded={!!ui.filters.questionNumber || !!ui.filters.sourceKind} data-testid="paper-basket-advanced">
            <div className={styles.advancedFields}>
              <SearchField value={ui.filters.questionNumber || ''} isDisabled={disabled} onChange={value => filter('questionNumber', value)}>
                <Label>原题号</Label><SearchField.Group><SearchField.Input maxLength={240} data-testid="paper-basket-question-number" placeholder="按资料中的原题号精确查找"/><SearchField.ClearButton/></SearchField.Group>
              </SearchField>
              <PaperSelect label="题源" value={ui.filters.sourceKind || ''} disabled={disabled} testId="paper-basket-source-kind"
                options={[{id: '', label: '全部题源'}, {id: 'local_bank', label: '本地题库'}, {id: 'teacher_resource', label: '教师资料'}, {id: 'generated', label: '生成题'}]}
                onChange={value => filter('sourceKind', value)}/>
            </div>
            <div className={styles.resultActions}>
              <Button variant="secondary" isDisabled={disabled || ui.offset === 0} data-testid="paper-basket-prev" onPress={() => page(Math.max(0, ui.offset - BASKET_PAGE_SIZE))}>上一页</Button>
              <span>第 {Math.floor(ui.offset / BASKET_PAGE_SIZE) + 1} 页 · 共 {total} 条查询结果</span>
              <Button variant="secondary" isDisabled={disabled || ui.offset + BASKET_PAGE_SIZE >= total} data-testid="paper-basket-next" onPress={() => page(ui.offset + BASKET_PAGE_SIZE)}>下一页</Button>
              <Button variant="secondary" isDisabled={disabled || loading} data-testid="paper-basket-refresh-candidates" onPress={() => setRefresh(value => value + 1)}>重新读取完整候选</Button>
              {additionalActions}
            </div>
          </PaperQuestionDisclosure>
          <span className={styles.resultCount}>{total} 条结果 · 第 {Math.floor(ui.offset / BASKET_PAGE_SIZE) + 1} 页</span>
        </div>
      </div>
      {loading && <p role="status">正在读取完整题面与当前资格…</p>}
      {error && <p role="alert">{error}<Button variant="secondary" onPress={() => setRefresh(value => value + 1)}>重新读取</Button></p>}
      <div className={styles.candidateList} data-testid="paper-candidate-scroll" tabIndex={0} aria-label="完整题目列表" ref={scroll}>
        {!loading && !error && !rows.length && <EmptyState><EmptyState.Header><EmptyState.Title>没有匹配题目</EmptyState.Title>
          <EmptyState.Description>调整真实筛选条件，或前往题本补充资料；当前手选题不会被替换。</EmptyState.Description></EmptyState.Header></EmptyState>}
        {rows.map(row => row.candidate ? <PaperCandidateCard key={row.id + ':' + row.candidate.contentVersion} candidate={row.candidate}
          basket={basket} disabled={disabled || loading || !!error} onMutate={onMutate} replaceEntry={replaceEntry} onReplaced={onReplaced}/> : <article key={row.id} role="alert">{row.error}</article>)}
      </div>
    </div>
  </section>;
}
