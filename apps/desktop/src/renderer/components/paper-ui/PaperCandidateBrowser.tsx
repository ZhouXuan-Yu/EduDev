import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {Button, Label, SearchField} from '@heroui/react';
import type {QuestionNotebookCategory} from '../../../shared/contracts';
import {PAPER_BASKET_SCHEMA, type PaperBasketCandidate, type PaperBasketOperation, type PaperBasketUiState, type PaperBasketView} from '../../../shared/paper-basket';
import {EmptyState} from '../../heroui-pro/components/empty-state';
import {PaperQuestionContent} from './PaperQuestionContent';
import {PaperSelect} from './PaperSelect';
import {basketErrors, basketReasons, BASKET_PAGE_SIZE, observeCandidateScroll} from './paper-basket-ui';
import {paperBasketClient, type PaperWorkspaceBasket, type PaperWorkspaceEntry, type PaperWorkspaceOperation} from './paper-basket-client';

type CandidateRow = {id: string; candidate?: PaperBasketCandidate; error?: string};

export function PaperCandidateBrowser({basket, ui, disabled, restoreKey, onUi, onMutate, replaceEntry, onCancelReplace, onReplaced}: {
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
  return <section className="edu-paper-candidates" data-testid="paper-candidate-browser">
    <h2>找题与选题</h2>
    {replaceEntry && <section role="group" aria-label="为当前题目换题" data-testid="paper-instance-replacement">
      <p>选择完整候选替换当前题目，保留它在试卷中的位置。换题后需要重新核对。</p>
      <Button variant="secondary" data-testid="paper-instance-replace-cancel" onPress={onCancelReplace}>取消换题，返回整理</Button>
    </section>}
    <p>{basket.blueprint.subject} · {basket.blueprint.grade}。按知识点、题型或分类查找题目，选中后加入题篮。</p>
    <div className="edu-paper-candidate-filters">
      <SearchField value={ui.filters.query || ''} isDisabled={disabled} onChange={value => filter('query', value)}>
        <Label>搜索题目</Label><SearchField.Group><SearchField.SearchIcon/><SearchField.Input maxLength={240}
          data-testid="paper-basket-search" placeholder="题干、解析、知识点或标签"/><SearchField.ClearButton/></SearchField.Group>
      </SearchField>
      <SearchField value={ui.filters.questionNumber || ''} isDisabled={disabled} onChange={value => filter('questionNumber', value)}>
        <Label>原题号</Label><SearchField.Group><SearchField.Input maxLength={240} data-testid="paper-basket-question-number" placeholder="按资料中的原题号精确查找"/><SearchField.ClearButton/></SearchField.Group>
      </SearchField>
      <SearchField value={ui.filters.knowledgePoint || ''} isDisabled={disabled} onChange={value => filter('knowledgePoint', value)}>
        <Label>知识点</Label><SearchField.Group><SearchField.Input maxLength={240} data-testid="paper-basket-kp"/><SearchField.ClearButton/></SearchField.Group>
      </SearchField>
      <PaperSelect label="分类" value={ui.filters.categoryId || ''} disabled={disabled} testId="paper-basket-category"
        options={[{id: '', label: '全部分类'}, ...categories.map(item => ({id: item.id, label: item.name}))]} onChange={value => filter('categoryId', value)}/>
      <PaperSelect label="题型" value={ui.filters.questionType || ''} disabled={disabled} testId="paper-basket-type"
        options={[{id: '', label: '全部题型'}, ...[...new Set(basket.blueprint.sections.map(item => item.questionType))].map(id => ({id, label: id}))]}
        onChange={value => filter('questionType', value)}/>
      <PaperSelect label="难度" value={ui.filters.difficulty || ''} disabled={disabled} testId="paper-basket-difficulty"
        options={[{id: '', label: '全部难度'}, {id: 'easy', label: '基础'}, {id: 'medium', label: '中等'}, {id: 'hard', label: '困难'}]}
        onChange={value => filter('difficulty', value)}/>
      <PaperSelect label="题源" value={ui.filters.sourceKind || ''} disabled={disabled} testId="paper-basket-source-kind"
        options={[{id: '', label: '全部题源'}, {id: 'local_bank', label: '本地题库'}, {id: 'teacher_resource', label: '教师资料'}, {id: 'generated', label: '生成题'}]}
        onChange={value => filter('sourceKind', value)}/>
    </div>
    <div className="edu-paper-actions">
      <Button variant="secondary" isDisabled={disabled || ui.offset === 0} data-testid="paper-basket-prev" onPress={() => page(Math.max(0, ui.offset - BASKET_PAGE_SIZE))}>上一页</Button>
      <span>第 {Math.floor(ui.offset / BASKET_PAGE_SIZE) + 1} 页 · 共 {total} 条查询结果</span>
      <Button variant="secondary" isDisabled={disabled || ui.offset + BASKET_PAGE_SIZE >= total} data-testid="paper-basket-next" onPress={() => page(ui.offset + BASKET_PAGE_SIZE)}>下一页</Button>
      <Button variant="ghost" isDisabled={disabled} onPress={() => onUi({...ui, filters: {}, offset: 0, scrollTop: 0})}>重置筛选</Button>
      <Button variant="secondary" isDisabled={disabled || loading} data-testid="paper-basket-refresh-candidates" onPress={() => setRefresh(value => value + 1)}>重新读取完整候选</Button>
    </div>
    {loading && <p role="status">正在读取完整题面与当前资格…</p>}
    {error && <p role="alert">{error}<Button variant="secondary" onPress={() => setRefresh(value => value + 1)}>重新读取</Button></p>}
    <div className="edu-paper-candidate-list" data-testid="paper-candidate-scroll" tabIndex={0} aria-label="完整题目列表" ref={scroll}>
      {!loading && !error && !rows.length && <EmptyState><EmptyState.Header><EmptyState.Title>没有匹配题目</EmptyState.Title>
        <EmptyState.Description>调整真实筛选条件，或前往题本补充资料；当前手选题不会被替换。</EmptyState.Description></EmptyState.Header></EmptyState>}
      {rows.map(row => row.candidate ? <CandidateCard key={row.id + ':' + row.candidate.contentVersion} candidate={row.candidate}
        basket={basket} disabled={disabled || loading || !!error} onMutate={onMutate} replaceEntry={replaceEntry} onReplaced={onReplaced}/> : <article key={row.id} role="alert">{row.error}</article>)}
    </div>
  </section>;
}

function CandidateCard({candidate, basket, disabled, onMutate, replaceEntry, onReplaced}: {
  candidate: PaperBasketCandidate; basket: PaperWorkspaceBasket; disabled: boolean;
  onMutate: (operation: PaperWorkspaceOperation) => Promise<boolean>;
  replaceEntry?: PaperWorkspaceEntry; onReplaced?: () => void;
}) {
  const [sectionId, setSectionId] = useState(candidate.matchingSectionIds[0] || '');
  const [imageReady, setImageReady] = useState(false);
  const added = basket.entries.some(entry => entry.questionId === candidate.question.id && entry.entryId !== replaceEntry?.entryId);
  const replacementAllowed = !!replaceEntry?.instance && candidate.matchingSectionIds.includes(replaceEntry.sectionId);
  return <article className="edu-paper-candidate-card" data-testid="paper-basket-candidate" data-question-id={candidate.question.id}>
    <header><h3>{candidate.question.questionType} · {candidate.question.knowledgePoint || '知识点未标注'}</h3></header>
    <PaperQuestionContent question={candidate.question} contentVersion={candidate.contentVersion} generation={candidate.generation} onImageReady={setImageReady}/>
    {!candidate.eligibility.available && <p role="note">{basketReasons[candidate.eligibility.reason]}</p>}
    <div className="edu-paper-candidate-action">
      {!replaceEntry && <PaperSelect label="加入分节" value={sectionId} disabled={disabled || added || !candidate.eligibility.available}
        options={candidate.matchingSectionIds.length ? candidate.matchingSectionIds.map(id => ({id, label: basket.blueprint.sections.find(s => s.id === id)?.label || id})) : [{id: '', label: '没有匹配分节'}]}
        onChange={setSectionId}/>}
      {replaceEntry ? <Button className="edu-primary-action-contrast" data-testid="paper-instance-replace-candidate"
        isDisabled={disabled || added || !candidate.eligibility.available || !replacementAllowed || !imageReady}
        onPress={() => {void onMutate({type: 'replaceEntry', entryId: replaceEntry.entryId,
          expectedInstanceRevision: replaceEntry.instance!.instanceRevision, questionId: candidate.question.id,
          expectedSourceVersion: candidate.contentVersion}).then(ok => {if (ok) onReplaced?.();});}}>替换当前题目</Button> :
      <Button className="edu-primary-action-contrast" data-testid="paper-basket-add" isDisabled={disabled || added || !candidate.eligibility.available || !sectionId || !imageReady}
        onPress={() => void onMutate({type: 'add', questionId: candidate.question.id, sectionId, expectedSourceVersion: candidate.contentVersion})}>
        {added ? '已加入题篮' : '加入题篮'}
      </Button>}
    </div>
  </article>;
}
