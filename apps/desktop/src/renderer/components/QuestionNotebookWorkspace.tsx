import {DisclosureCard} from './ui/DisclosureCard';
import styles from '../ui-system/teaching-question-alignment.module.css';
import {TeachingPageAction} from './product/TeachingPageLayout';
import {Button} from '@heroui/react';
import type {PaperReturnReference} from './paper-ui/paper-material-handoff';
import {QuestionEditBoundary, useQuestionEditGuard} from './paper-ui/QuestionEditGuard';
import {QuestionArchiveEditor} from './QuestionArchiveEditor';
import {QuestionSemanticSearch} from './QuestionSemanticSearch';
import {QuestionMathText} from './QuestionMathText';
import {QuestionContextEditor} from './QuestionContextEditor';
import {questionFactConflicts} from '../../shared/question-facts';
import {questionDuplicateCandidates} from '../../shared/question-identity';
import {QuestionAnswerEvidence, questionSourceLabel, questionUsageLabel} from './QuestionAnswerEvidence';
import {QuestionOriginalPicture} from './QuestionOriginalPicture';
import { useEffect, useRef, useState } from 'react';
import { BookOpenCheck, Database, History, Plus, Search, ShieldCheck } from 'lucide-react';
import type { QuestionBankItemInput, QuestionNotebookCategory, QuestionNotebookEntry, QuestionNotebookUsage, QuestionSearchFilters } from '../../shared/contracts';

type Props = {setStatus: (message: string) => void; paperReturn?: PaperReturnReference;
  onReturnToPaper?: () => void; onOpenMaterials?: () => void};

const emptyQuestionDraft: QuestionBankItemInput = {
  subject: '数学', grade: '', knowledgePoint: '', questionType: '解答题', difficulty: 'medium',
  stem: '', answer: '', analysis: '', sourceTitle: '教师本地题库', sourceKind: 'local_bank', tags: [],
};

function difficultyLabel(value: QuestionNotebookEntry['difficulty']) {
  if (value === 'hard') return '困难';
  if (value === 'medium') return '中等';
  return '基础';
}

function splitTags(value: string) {
  return value.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean).slice(0, 20);
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未知时间';
}

export function QuestionNotebookWorkspace(props: Props) {
  return <QuestionEditBoundary enabled={!!props.paperReturn}><QuestionNotebookBody {...props}/></QuestionEditBoundary>;
}

function QuestionNotebookBody({setStatus, paperReturn, onReturnToPaper, onOpenMaterials}: Props) {
  const [items, setItems] = useState<QuestionNotebookEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<QuestionNotebookCategory[]>([]);
  const [deletedCategories, setDeletedCategories] = useState<QuestionNotebookCategory[]>([]);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters,setFilters]=useState<QuestionSearchFilters>({});
  const [offset,setOffset]=useState(0);
  const [retrievalMethod,setRetrievalMethod]=useState('');
  const pageSize=20;
  function filterChange(key:keyof QuestionSearchFilters,value:string){setOffset(0);setFilters(current=>({...current,[key]:value||undefined}));}

  const [categoryId, setCategoryId] = useState('');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
  const [showSourceCandidates,setShowSourceCandidates]=useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [questionDraft, setQuestionDraft] = useState<QuestionBankItemInput>(emptyQuestionDraft);
  const [tagText, setTagText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [usageQuestionId, setUsageQuestionId] = useState('');
  const [usages, setUsages] = useState<QuestionNotebookUsage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const requestRef = useRef(0);
  const newQuestionDirty = JSON.stringify(questionDraft) !== JSON.stringify(emptyQuestionDraft) || !!tagText;
  const newQuestionRoot = useQuestionEditGuard(newQuestionDirty || saving);

  function showNotice(message: string) {
    setNotice(message); setErrorMessage(''); setStatus(message);
  }

  function showError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'') : fallback;
    setErrorMessage(message); setNotice(''); setStatus(message);
  }

  async function refresh(requireReadback = false) {
    const requestId = ++requestRef.current;
    setLoading(true); setErrorMessage(''); setNotice('');
    try {
      const [result, allCategories] = await Promise.all([
        window.omniEdu?.listQuestionNotebook({ ...filters, showSourceCandidates, query: query || undefined, categoryId: categoryId || undefined, bookmarked: bookmarkedOnly ? true : undefined, limit: pageSize, offset }),
        window.omniEdu?.listQuestionNotebookCategories(true),
      ]);
      if (requestId !== requestRef.current) {
        if (requireReadback) throw new Error('本次题本读取已被更新，请重新读取保存结果。');
        return;
      }
      if (requireReadback && (!result || !Array.isArray(allCategories))) throw new Error('题本重新读取未完成，请重试。');
      const nextCategories = allCategories ?? [];
      setItems(result?.items ?? []); setTotal(result?.total ?? 0); setRetrievalMethod(result?.retrievalMethod??'');
      if(offset>0&&offset>=(result?.total??0))setOffset(Math.max(0,Math.ceil((result?.total??0)/pageSize)-1)*pageSize);
      setCategories(nextCategories.filter((category) => category.status === 'active'));
      setDeletedCategories(nextCategories.filter((category) => category.status === 'deleted'));
      setCategoryDrafts((current) => Object.fromEntries(nextCategories.filter((category) => category.status === 'active').map((category) => [category.id, current[category.id] ?? category.name])));
    } catch (error) {
      if (requestId === requestRef.current) {
        // Keep C1 editors (and their guards/input) mounted until readback or explicit cancel.
        if (!paperReturn) {setItems([]);setTotal(0);setRetrievalMethod('');}
        showError(error, '读取题本失败，请稍后重试。');
      }
      if (requireReadback) throw error;
    }
    finally { if (requestId === requestRef.current) setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [query, categoryId, bookmarkedOnly, showSourceCandidates, filters, offset]);

  async function runAction(action: () => Promise<void>, success: string, fallback: string) {
    setSaving(true);
    try { await action(); await refresh(); showNotice(success); }
    catch (error) { await refresh(); showError(error, fallback); }
    finally { setSaving(false); }
  }

  async function createQuestion() {
    if (!questionDraft.stem.trim()) { showError(null, '题干不能为空。'); return; }
    await runAction(async () => {
      await window.omniEdu!.createQuestionBankItem({ ...questionDraft, stem: questionDraft.stem.trim(), answer: questionDraft.answer?.trim(), analysis: questionDraft.analysis?.trim(), tags: splitTags(tagText), sourceKind: questionDraft.sourceKind === 'teacher_resource' ? 'teacher_resource' : 'local_bank' });
      setQuestionDraft(emptyQuestionDraft); setTagText('');
    }, '题目已保存到本地题库，可收藏、分类并查看使用记录。', '创建本地题目失败。');
  }

  async function toggleBookmark(item: QuestionNotebookEntry) {
    await runAction(async () => { await window.omniEdu?.setQuestionNotebookBookmark({ questionId: item.id, bookmarked: !item.bookmarked, version: item.version }); }, item.bookmarked ? '题目已取消收藏。' : '题目已收藏。', '更新收藏失败，可能存在版本冲突。');
  }

  async function createCategory() {
    const name = categoryName.trim();
    if (!name) { showError(null, '分类名称不能为空。'); return; }
    await runAction(async () => { await window.omniEdu?.createQuestionNotebookCategory({ name }); setCategoryName(''); }, '题本分类已创建。', '创建分类失败。');
  }

  async function renameCategory(category: QuestionNotebookCategory) {
    const name = (categoryDrafts[category.id] ?? '').trim();
    if (!name) { showError(null, '分类名称不能为空。'); return; }
    await runAction(async () => { await window.omniEdu?.updateQuestionNotebookCategory(category.id, { name, version: category.version }); }, '分类已重命名。', '重命名分类失败，可能存在版本冲突。');
  }

  async function deleteCategory(id: string) {
    await runAction(async () => { await window.omniEdu?.deleteQuestionNotebookCategory(id); if (categoryId === id) setCategoryId(''); }, '分类已移至已删除列表，可随时恢复。', '删除分类失败。');
  }

  async function restoreCategory(id: string) {
    await runAction(async () => { await window.omniEdu?.restoreQuestionNotebookCategory(id); }, '分类已恢复，历史题目关联重新可见。', '恢复分类失败。');
  }

  async function toggleCategory(item: QuestionNotebookEntry, id: string) {
    await runAction(async () => {
      if (item.categories.some((category) => category.id === id)) await window.omniEdu?.removeQuestionNotebookCategory(item.id, id);
      else await window.omniEdu?.addQuestionNotebookCategory(item.id, id);
    }, '题目分类关联已更新。', '更新题目分类失败。');
  }

  async function loadUsage(questionId: string) {
    setUsageQuestionId(questionId); setUsageLoading(true);
    try { setUsages(await window.omniEdu?.listQuestionNotebookUsage(questionId, 20) ?? []); }
    catch (error) { showError(error, '读取题目使用记录失败。'); setUsages([]); }
    finally { setUsageLoading(false); }
  }

  async function recordManualUsage(item: QuestionNotebookEntry) {
    setSaving(true);
    try {
      await window.omniEdu?.recordQuestionBankUsage({ questionId: item.id, usageType: 'manual', usageId: `teacher-ui-${Date.now()}`, metadata: { source: 'question_notebook_ui' } });
      await refresh(); await loadUsage(item.id); showNotice('已记录一次教师课堂使用。');
    } catch (error) { showError(error, '记录题目使用失败。'); }
    finally { setSaving(false); }
  }

  const hasFilters = Boolean(query.trim() || categoryId || bookmarkedOnly || Object.values(filters).some(Boolean));
  const duplicateCandidates=questionDuplicateCandidates(items);

  return (
    <div className={`page-grid question-notebook-view ${styles.workspace}`} data-testid="question-notebook-workspace">
      {paperReturn && <div className="toolbar-row" data-testid="question-notebook-paper-handoff">
        <p>题目正式保存后，返回原题篮继续选题；不会自动加入。</p>
        <Button variant="secondary" data-testid="question-notebook-materials" onPress={onOpenMaterials}>查看资料</Button>
        <Button variant="secondary" data-testid="question-notebook-return-paper" onPress={onReturnToPaper}>返回原题篮</Button>
      </div>}
      <section className={`work-panel span-2 ${styles.primaryPanel}`}>
        <header className={styles.heading}><div><h2>题本</h2><p>集中管理本地题目，保留原题、答案出处与使用记录。</p></div><TeachingPageAction><Button onPress={() => { setCreateOpen(true); newQuestionRoot.current?.scrollIntoView({block:'start'}); }} data-testid="question-notebook-new"><Plus size={16}/>新建题目</Button></TeachingPageAction></header>
        <div className={`toolbar-row question-notebook-toolbar ${styles.toolbar}`}><label className={styles.search}><Search size={16} /><input value={query} onChange={(event) => {setOffset(0);setQuery(event.target.value);}} placeholder="搜索题干、解析、知识点或标签" data-testid="question-notebook-search" /></label><label>分类<select value={categoryId} onChange={(event) => {setOffset(0);setCategoryId(event.target.value);}} data-testid="question-notebook-category-filter"><option value="">全部分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}（{category.entryCount}）</option>)}</select></label><label className="checkbox-label"><input type="checkbox" checked={bookmarkedOnly} onChange={(event) => {setOffset(0);setBookmarkedOnly(event.target.checked);}} data-testid="question-notebook-bookmarked-only" />仅看收藏</label><Button variant="ghost" aria-expanded={filtersOpen} aria-controls="question-notebook-advanced-filters" onPress={() => setFiltersOpen(value => !value)} data-testid="question-notebook-filter-toggle">{filtersOpen ? '收起筛选' : '更多筛选'}{Object.values(filters).filter(Boolean).length ? `（${Object.values(filters).filter(Boolean).length}）` : ''}</Button></div>
        <div hidden={!filtersOpen} id="question-notebook-advanced-filters" className={`form-grid compact-form-grid ${styles.filters}`} data-testid="question-notebook-filters">
          {([['grade','年级'],['subject','学科'],['questionType','题型'],['knowledgePoint','知识点']] as const).map(([key,label])=><label key={key}>{label}<input value={filters[key]??''} onChange={event=>filterChange(key,event.target.value)} placeholder={key==='knowledgePoint'?'包含关键词':'全部（填写完整名称）'} data-testid={'question-notebook-filter-'+key}/></label>)}
          <label>难度<select value={filters.difficulty??''} onChange={event=>filterChange('difficulty',event.target.value)} data-testid="question-notebook-filter-difficulty"><option value="">全部难度</option><option value="easy">基础</option><option value="medium">中等</option><option value="hard">困难</option></select></label>
          <label>来源<select value={filters.sourceKind??''} onChange={event=>filterChange('sourceKind',event.target.value)} data-testid="question-notebook-filter-sourceKind"><option value="">全部来源</option><option value="local_bank">本地题库</option><option value="teacher_resource">教师资源</option><option value="generated">小智生成</option></select></label>
          <label className="checkbox-label"><input type="checkbox" checked={showSourceCandidates} onChange={event=>{setOffset(0);setShowSourceCandidates(event.target.checked);}} data-testid="question-notebook-source-candidates"/>显示原始候选（包含答案册自动候选和已关联 AI 稿的抽题记录）</label>
          <p className="muted" data-testid="question-notebook-duplicate-scope">同题候选只比较当前页；文字题只比较已保存文字。不会合并原题，也不表示答案已核验。</p>
        </div>
        <div className={`question-notebook-summary ${styles.summary}`} data-testid="question-notebook-summary"><span>共 {total} 道题</span><span>当前显示 {items.length} 道</span><span>分类 {categories.length} 个</span></div>
        {loading ? <p data-testid="question-notebook-loading">正在读取本地题本…</p> : null}
        {errorMessage ? <div className="warning-box" role="alert" data-testid="question-notebook-error">{errorMessage}</div> : null}
        {notice ? <div className="success-box" role="status" data-testid="question-notebook-success">{notice}</div> : null}
        <div className={styles.questionList}>{!loading || paperReturn ? items.map((item,index) => <article className={`question-notebook-card ${styles.questionCard}`} key={item.id} data-testid={`question-notebook-card-${item.id}`}><div className="question-notebook-card-head"><div className="answer-meta"><span className="status-chip">{item.subject || '未分类学科'}</span><span className="status-chip">{item.archive?.issues.includes('missing_difficulty')?'难度待分类':difficultyLabel(item.difficulty)}</span><span>{item.questionType || '题目'} · {item.knowledgePoint || '未标知识点'}</span></div><button className={item.bookmarked ? 'bookmark-button active' : 'bookmark-button'} aria-label={item.bookmarked ? '取消收藏' : '收藏题目'} onClick={() => void toggleBookmark(item)} disabled={saving} data-testid={`question-notebook-bookmark-${item.id}`}>{item.bookmarked ? '★' : '☆'}</button></div><span className="status-chip" data-testid={`question-notebook-duplicate-${item.id}`}>{duplicateCandidates[index].scope==='unsupported'?'题面待核对，未比较同题':duplicateCandidates[index].matches>1?`当前页同题候选 ${duplicateCandidates[index].matches} 条`:'当前页未发现同题候选'}</span><QuestionMathText as="h3" testId="question-notebook-stem" text={questionFactConflicts(item).includes('statement')?'题目内容待核对':item.stem}/>{item.document?<><QuestionOriginalPicture question={item}/>{item.archive?.ai?.policy!=='page-crop-complete.v1'&&<QuestionContextEditor question={item} openDisabled={!!paperReturn && loading} onSaved={async()=>{await refresh(!!paperReturn);showNotice('完整题面已保存，小智将读取新版本。');}}/>}</>:null}{!item.document&&(item.archive?.native||item.archive?.pageSource)?<QuestionOriginalPicture question={item}/>:null}<QuestionArchiveEditor question={item} openDisabled={!!paperReturn && loading} onSaved={async()=>{await refresh(!!paperReturn);showNotice('题目补正已保存。');}}/><DisclosureCard title="查看答案与解析" data-testid={`question-notebook-answer-fold-${item.id}`}>
                  <QuestionAnswerEvidence question={item}/>
                </DisclosureCard><div className="question-notebook-card-foot"><span data-testid={`question-notebook-source-${item.id}`}>来源：{item.sourceTitle || '本地题库'} · {questionSourceLabel(item.sourceKind)} · 使用 {item.usageCount} 次</span><div className="question-category-chips">{categories.map((category) => <button key={category.id} className={item.categories.some((entry) => entry.id === category.id) ? 'category-chip active' : 'category-chip'} onClick={() => void toggleCategory(item, category.id)} disabled={saving} data-testid={`question-notebook-category-${item.id}-${category.id}`}>{category.name}</button>)}</div></div><div className="toolbar-row"><button className="secondary-action" onClick={() => void loadUsage(item.id)} data-testid={`question-notebook-usage-open-${item.id}`}><History size={15} />使用记录</button><button className="secondary-action" onClick={() => void recordManualUsage(item)} disabled={saving} data-testid={`question-notebook-usage-record-${item.id}`}>记录课堂使用</button></div>{usageQuestionId === item.id ? <div className="question-notebook-usage" data-testid={`question-notebook-usage-${item.id}`}>{usageLoading ? <span>正在读取使用记录…</span> : usages.length ? usages.map((usage) => <div key={usage.id}><strong>{questionUsageLabel(usage.usageType)}</strong><span>{formatTime(usage.createdAt)}</span></div>) : <span data-testid="question-notebook-usage-empty">还没有使用记录。</span>}</div> : null}</article>) : null}{!loading && !items.length ? <div className="empty-state" data-testid={hasFilters ? 'question-notebook-no-results' : 'question-notebook-empty'}><BookOpenCheck size={20} /><span>{hasFilters ? '当前筛选没有命中题目，请调整搜索或分类。' : '题库中还没有题目，点击“新建题目”开始添加。'}</span></div> : null}</div>
        <div className="toolbar-row" data-testid="question-notebook-pagination"><button className="secondary-action" disabled={loading||offset===0} onClick={()=>setOffset(Math.max(0,offset-pageSize))} data-testid="question-notebook-prev">上一页</button><span>第 {Math.floor(offset/pageSize)+1} / {Math.max(1,Math.ceil(total/pageSize))} 页</span><button className="secondary-action" disabled={loading||offset+pageSize>=total} onClick={()=>setOffset(offset+pageSize)} data-testid="question-notebook-next">下一页</button><button className="ghost-action" disabled={!hasFilters} onClick={()=>{setQuery('');setCategoryId('');setBookmarkedOnly(false);setFilters({});setOffset(0);}} data-testid="question-notebook-clear">清除筛选</button><span data-testid="question-notebook-retrieval-method">本地关键词检索{retrievalMethod==='local_keyword_index'?' · 已用中文索引':''}</span></div>
      </section>

      <section ref={newQuestionRoot} className={`work-panel ${styles.createPanel}`} data-testid="question-notebook-create-panel">
        <div className={styles.createHeading}><Button variant="ghost" aria-expanded={createOpen || newQuestionDirty || saving} aria-controls="question-notebook-create-fields" isDisabled={newQuestionDirty || saving} onPress={() => setCreateOpen(value => !value)} data-testid="question-notebook-create-toggle">{createOpen ? '收起新建题目' : '教师创建本地题目'}</Button></div>
        <div id="question-notebook-create-fields" hidden={!createOpen && !newQuestionDirty && !saving} className={styles.createFields}>
        <p>手工添加的题目保存到本地；小智生成的内容另行标明来源。</p>
        <div className="form-grid compact-form-grid"><label>学科<input disabled={saving} value={questionDraft.subject} onChange={(event) => setQuestionDraft({ ...questionDraft, subject: event.target.value })} data-testid="question-notebook-new-subject" /></label><label>年级<input disabled={saving} value={questionDraft.grade} onChange={(event) => setQuestionDraft({ ...questionDraft, grade: event.target.value })} data-testid="question-notebook-new-grade" /></label><label>知识点<input disabled={saving} value={questionDraft.knowledgePoint} onChange={(event) => setQuestionDraft({ ...questionDraft, knowledgePoint: event.target.value })} data-testid="question-notebook-new-knowledge-point" /></label><label>题型<input disabled={saving} value={questionDraft.questionType} onChange={(event) => setQuestionDraft({ ...questionDraft, questionType: event.target.value })} data-testid="question-notebook-new-type" /></label><label>难度<select disabled={saving} value={questionDraft.difficulty} onChange={(event) => setQuestionDraft({ ...questionDraft, difficulty: event.target.value as 'easy' | 'medium' | 'hard' })} data-testid="question-notebook-new-difficulty"><option value="easy">基础</option><option value="medium">中等</option><option value="hard">困难</option></select></label><label>来源<select disabled={saving} value={questionDraft.sourceKind} onChange={(event) => setQuestionDraft({ ...questionDraft, sourceKind: event.target.value as 'local_bank' | 'teacher_resource' })} data-testid="question-notebook-new-source-kind"><option value="local_bank">本地题库</option><option value="teacher_resource">教师资源</option></select></label></div>
        <label>题干<textarea disabled={saving} value={questionDraft.stem} onChange={(event) => setQuestionDraft({ ...questionDraft, stem: event.target.value })} data-testid="question-notebook-new-stem" /></label><label>答案<textarea disabled={saving} value={questionDraft.answer} onChange={(event) => setQuestionDraft({ ...questionDraft, answer: event.target.value })} data-testid="question-notebook-new-answer" /></label><label>解析<textarea disabled={saving} value={questionDraft.analysis} onChange={(event) => setQuestionDraft({ ...questionDraft, analysis: event.target.value })} data-testid="question-notebook-new-analysis" /></label><label>标签<input disabled={saving} value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="逗号分隔" data-testid="question-notebook-new-tags" /></label><button className="primary-action" onClick={() => void createQuestion()} disabled={saving} data-testid="question-notebook-create-question"><Plus size={16} />写入本地题库</button>
        {paperReturn && newQuestionDirty && <Button variant="ghost" isDisabled={saving} data-testid="question-notebook-cancel-new" onPress={() => {setQuestionDraft(emptyQuestionDraft); setTagText(''); setErrorMessage('');}}>放弃未保存新题</Button>}
        </div>
      </section>

      <DisclosureCard title="按题意找相似题" data-testid="question-notebook-semantic-toggle"><QuestionSemanticSearch filters={filters}/></DisclosureCard>
      <section className={`work-panel ${styles.secondaryPanel}`} data-testid="question-notebook-category-admin">
        <DisclosureCard title="分类管理" data-testid="question-notebook-category-toggle">
        <p>可重命名分类；删除后仍可恢复。</p>
        <div className="toolbar-row"><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="新分类名称" data-testid="question-notebook-category-name" /><button className="secondary-action" onClick={() => void createCategory()} disabled={saving} data-testid="question-notebook-create-category"><Plus size={16} />创建</button></div>
        <div className="question-category-admin-list">{categories.map((category) => <div className="category-admin-row" key={category.id} data-testid={`question-notebook-category-admin-${category.id}`}><input value={categoryDrafts[category.id] ?? category.name} onChange={(event) => setCategoryDrafts({ ...categoryDrafts, [category.id]: event.target.value })} data-testid={`question-notebook-category-rename-input-${category.id}`} /><span>{category.entryCount} 题</span><button className="ghost-action" onClick={() => void renameCategory(category)} disabled={saving} data-testid={`question-notebook-rename-category-${category.id}`}>重命名</button><button className="ghost-action" onClick={() => void deleteCategory(category.id)} disabled={saving} data-testid={`question-notebook-delete-category-${category.id}`}>删除</button></div>)}{!categories.length ? <span>还没有分类。</span> : null}</div>
        <DisclosureCard
          data-testid="question-notebook-deleted-categories"
          title={`已删除分类（${deletedCategories.length}）`}
        >
          <div className="question-category-admin-list">
            {deletedCategories.map((category) => <div
              className="category-admin-row"
              key={category.id}
              data-testid={`question-notebook-deleted-category-${category.id}`}
            >
              <span>{category.name} · {formatTime(category.deletedAt)}</span>
              <button
                className="secondary-action"
                onClick={() => void restoreCategory(category.id)}
                disabled={saving}
                data-testid={`question-notebook-restore-category-${category.id}`}
              >恢复</button>
            </div>)}
            {!deletedCategories.length ? <span>没有已删除分类。</span> : null}
          </div>
        </DisclosureCard>
        </DisclosureCard>
      </section>

      <section className={`work-panel span-2 ${styles.secondaryPanel}`}><DisclosureCard title="题目与来源" data-testid="question-notebook-source-info"><div className="system-list"><span><ShieldCheck size={16} />题目保存在本地；收藏和分类不会改动原题。</span><span><History size={16} />题目已变化时会提示重新读取，使用记录可随时查看。</span><span><Database size={16} />教师补充与小智生成内容分别标注，答案需核实后使用。</span></div></DisclosureCard></section>
    </div>
  );
}
