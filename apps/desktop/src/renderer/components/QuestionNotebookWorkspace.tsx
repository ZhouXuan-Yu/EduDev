import { useEffect, useRef, useState } from 'react';
import { BookOpenCheck, Database, History, Plus, Search, ShieldCheck } from 'lucide-react';
import type { QuestionBankItemInput, QuestionNotebookCategory, QuestionNotebookEntry, QuestionNotebookUsage } from '../../shared/contracts';

type Props = { setStatus: (message: string) => void };

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

export function QuestionNotebookWorkspace({ setStatus }: Props) {
  const [items, setItems] = useState<QuestionNotebookEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<QuestionNotebookCategory[]>([]);
  const [deletedCategories, setDeletedCategories] = useState<QuestionNotebookCategory[]>([]);
  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);
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

  function showNotice(message: string) {
    setNotice(message); setErrorMessage(''); setStatus(message);
  }

  function showError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;
    setErrorMessage(message); setNotice(''); setStatus(message);
  }

  async function refresh() {
    const requestId = ++requestRef.current;
    setLoading(true); setErrorMessage('');
    try {
      const [result, allCategories] = await Promise.all([
        window.omniEdu?.listQuestionNotebook({ query: query || undefined, categoryId: categoryId || undefined, bookmarked: bookmarkedOnly ? true : undefined, limit: 50, offset: 0 }),
        window.omniEdu?.listQuestionNotebookCategories(true),
      ]);
      if (requestId !== requestRef.current) return;
      const nextCategories = allCategories ?? [];
      setItems(result?.items ?? []); setTotal(result?.total ?? 0);
      setCategories(nextCategories.filter((category) => category.status === 'active'));
      setDeletedCategories(nextCategories.filter((category) => category.status === 'deleted'));
      setCategoryDrafts((current) => Object.fromEntries(nextCategories.filter((category) => category.status === 'active').map((category) => [category.id, current[category.id] ?? category.name])));
    } catch (error) { if (requestId === requestRef.current) showError(error, '读取题本失败，请稍后重试。'); }
    finally { if (requestId === requestRef.current) setLoading(false); }
  }

  useEffect(() => { void refresh(); }, [query, categoryId, bookmarkedOnly]);

  async function runAction(action: () => Promise<void>, success: string, fallback: string) {
    setSaving(true);
    try { await action(); await refresh(); showNotice(success); }
    catch (error) { await refresh(); showError(error, fallback); }
    finally { setSaving(false); }
  }

  async function createQuestion() {
    if (!questionDraft.stem.trim()) { showError(null, '题干不能为空。'); return; }
    await runAction(async () => {
      await window.omniEdu?.createQuestionBankItem({ ...questionDraft, stem: questionDraft.stem.trim(), answer: questionDraft.answer?.trim(), analysis: questionDraft.analysis?.trim(), tags: splitTags(tagText), sourceKind: questionDraft.sourceKind === 'teacher_resource' ? 'teacher_resource' : 'local_bank' });
      setQuestionDraft(emptyQuestionDraft); setTagText('');
    }, '题目已写入 canonical 本地题库，可在题本中收藏和追踪。', '创建本地题目失败。');
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
    await runAction(async () => { await window.omniEdu?.updateQuestionNotebookCategory(category.id, { name, version: category.version }); }, '分类已按版本锁重命名。', '重命名分类失败，可能存在版本冲突。');
  }

  async function deleteCategory(id: string) {
    await runAction(async () => { await window.omniEdu?.deleteQuestionNotebookCategory(id); if (categoryId === id) setCategoryId(''); }, '分类已软删除，历史关联仍可审计。', '删除分类失败。');
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

  const hasFilters = Boolean(query.trim() || categoryId || bookmarkedOnly);

  return (
    <div className="page-grid question-notebook-view" data-testid="question-notebook-workspace">
      <section className="work-panel span-2">
        <div className="workspace-label"><span>01</span><div><h2>题本</h2><p>正文来自 canonical 本地题库；收藏、分类与使用记录是可审计覆盖层。</p></div></div>
        <div className="toolbar-row question-notebook-toolbar"><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索题干、解析、知识点或标签" data-testid="question-notebook-search" /></label><label>分类<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} data-testid="question-notebook-category-filter"><option value="">全部分类</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}（{category.entryCount}）</option>)}</select></label><label className="checkbox-label"><input type="checkbox" checked={bookmarkedOnly} onChange={(event) => setBookmarkedOnly(event.target.checked)} data-testid="question-notebook-bookmarked-only" />仅看收藏</label></div>
        <div className="question-notebook-summary" data-testid="question-notebook-summary"><span>共 {total} 道题</span><span>当前显示 {items.length} 道</span><span>分类 {categories.length} 个</span></div>
        {loading ? <p data-testid="question-notebook-loading">正在读取本地题本…</p> : null}
        {errorMessage ? <div className="warning-box" role="alert" data-testid="question-notebook-error">{errorMessage}</div> : null}
        {notice ? <div className="success-box" role="status" data-testid="question-notebook-success">{notice}</div> : null}
        <div className="question-notebook-list">{!loading ? items.map((item) => <article className="question-notebook-card" key={item.id} data-testid={`question-notebook-card-${item.id}`}><div className="question-notebook-card-head"><div className="answer-meta"><span className="status-chip">{item.subject || '未分类学科'}</span><span className="status-chip">{difficultyLabel(item.difficulty)}</span><span>{item.questionType || '题目'} · {item.knowledgePoint || '未标知识点'}</span></div><button className={item.bookmarked ? 'bookmark-button active' : 'bookmark-button'} aria-label={item.bookmarked ? '取消收藏' : '收藏题目'} onClick={() => void toggleBookmark(item)} disabled={saving} data-testid={`question-notebook-bookmark-${item.id}`}>{item.bookmarked ? '★' : '☆'}</button></div><h3>{item.stem}</h3><details><summary>查看答案与解析</summary><div className="question-notebook-answer"><strong>答案</strong><p>{item.answer || '暂无标准答案'}</p><strong>解析</strong><p>{item.analysis || '暂无解析，需教师补充。'}</p></div></details><div className="question-notebook-card-foot"><span data-testid={`question-notebook-source-${item.id}`}>来源：{item.sourceTitle || '本地题库'} · {item.sourceKind} · 使用 {item.usageCount} 次</span><div className="question-category-chips">{categories.map((category) => <button key={category.id} className={item.categories.some((entry) => entry.id === category.id) ? 'category-chip active' : 'category-chip'} onClick={() => void toggleCategory(item, category.id)} disabled={saving} data-testid={`question-notebook-category-${item.id}-${category.id}`}>{category.name}</button>)}</div></div><div className="toolbar-row"><button className="secondary-action" onClick={() => void loadUsage(item.id)} data-testid={`question-notebook-usage-open-${item.id}`}><History size={15} />使用记录</button><button className="secondary-action" onClick={() => void recordManualUsage(item)} disabled={saving} data-testid={`question-notebook-usage-record-${item.id}`}>记录课堂使用</button></div>{usageQuestionId === item.id ? <div className="question-notebook-usage" data-testid={`question-notebook-usage-${item.id}`}>{usageLoading ? <span>正在读取使用记录…</span> : usages.length ? usages.map((usage) => <div key={usage.id}><strong>{usage.usageType}</strong><span>{usage.usageId || '无外部引用'} · {formatTime(usage.createdAt)}</span></div>) : <span data-testid="question-notebook-usage-empty">还没有使用记录。</span>}</div> : null}</article>) : null}{!loading && !items.length ? <div className="empty-state" data-testid={hasFilters ? 'question-notebook-no-results' : 'question-notebook-empty'}><BookOpenCheck size={20} /><span>{hasFilters ? '当前筛选没有命中题目，请调整搜索或分类。' : '题库中还没有题目。可在下方由教师创建 canonical 本地题目。'}</span></div> : null}</div>
      </section>

      <section className="work-panel" data-testid="question-notebook-create-panel">
        <div className="workspace-label"><span>02</span><div><h2>教师创建本地题目</h2><p>只允许标记为本地题库或教师资源；generated 来源只能由小智产物链产生。</p></div></div>
        <div className="form-grid compact-form-grid"><label>学科<input value={questionDraft.subject} onChange={(event) => setQuestionDraft({ ...questionDraft, subject: event.target.value })} data-testid="question-notebook-new-subject" /></label><label>年级<input value={questionDraft.grade} onChange={(event) => setQuestionDraft({ ...questionDraft, grade: event.target.value })} data-testid="question-notebook-new-grade" /></label><label>知识点<input value={questionDraft.knowledgePoint} onChange={(event) => setQuestionDraft({ ...questionDraft, knowledgePoint: event.target.value })} data-testid="question-notebook-new-knowledge-point" /></label><label>题型<input value={questionDraft.questionType} onChange={(event) => setQuestionDraft({ ...questionDraft, questionType: event.target.value })} data-testid="question-notebook-new-type" /></label><label>难度<select value={questionDraft.difficulty} onChange={(event) => setQuestionDraft({ ...questionDraft, difficulty: event.target.value as 'easy' | 'medium' | 'hard' })} data-testid="question-notebook-new-difficulty"><option value="easy">基础</option><option value="medium">中等</option><option value="hard">困难</option></select></label><label>来源<select value={questionDraft.sourceKind} onChange={(event) => setQuestionDraft({ ...questionDraft, sourceKind: event.target.value as 'local_bank' | 'teacher_resource' })} data-testid="question-notebook-new-source-kind"><option value="local_bank">本地题库</option><option value="teacher_resource">教师资源</option></select></label></div>
        <label>题干<textarea value={questionDraft.stem} onChange={(event) => setQuestionDraft({ ...questionDraft, stem: event.target.value })} data-testid="question-notebook-new-stem" /></label><label>答案<textarea value={questionDraft.answer} onChange={(event) => setQuestionDraft({ ...questionDraft, answer: event.target.value })} data-testid="question-notebook-new-answer" /></label><label>解析<textarea value={questionDraft.analysis} onChange={(event) => setQuestionDraft({ ...questionDraft, analysis: event.target.value })} data-testid="question-notebook-new-analysis" /></label><label>标签<input value={tagText} onChange={(event) => setTagText(event.target.value)} placeholder="逗号分隔" data-testid="question-notebook-new-tags" /></label><button className="primary-action" onClick={() => void createQuestion()} disabled={saving} data-testid="question-notebook-create-question"><Plus size={16} />写入本地题库</button>
      </section>

      <section className="work-panel" data-testid="question-notebook-category-admin">
        <div className="workspace-label"><span>03</span><div><h2>分类管理</h2><p>支持版本化重命名、软删除和恢复。</p></div></div>
        <div className="toolbar-row"><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="新分类名称" data-testid="question-notebook-category-name" /><button className="secondary-action" onClick={() => void createCategory()} disabled={saving} data-testid="question-notebook-create-category"><Plus size={16} />创建</button></div>
        <div className="question-category-admin-list">{categories.map((category) => <div className="category-admin-row" key={category.id} data-testid={`question-notebook-category-admin-${category.id}`}><input value={categoryDrafts[category.id] ?? category.name} onChange={(event) => setCategoryDrafts({ ...categoryDrafts, [category.id]: event.target.value })} data-testid={`question-notebook-category-rename-input-${category.id}`} /><span>{category.entryCount} 题 · v{category.version}</span><button className="ghost-action" onClick={() => void renameCategory(category)} disabled={saving} data-testid={`question-notebook-rename-category-${category.id}`}>重命名</button><button className="ghost-action" onClick={() => void deleteCategory(category.id)} disabled={saving} data-testid={`question-notebook-delete-category-${category.id}`}>删除</button></div>)}{!categories.length ? <span>还没有分类。</span> : null}</div>
        <details data-testid="question-notebook-deleted-categories"><summary>已删除分类（{deletedCategories.length}）</summary><div className="question-category-admin-list">{deletedCategories.map((category) => <div className="category-admin-row" key={category.id} data-testid={`question-notebook-deleted-category-${category.id}`}><span>{category.name} · {formatTime(category.deletedAt)}</span><button className="secondary-action" onClick={() => void restoreCategory(category.id)} disabled={saving} data-testid={`question-notebook-restore-category-${category.id}`}>恢复</button></div>)}{!deletedCategories.length ? <span>没有已删除分类。</span> : null}</div></details>
      </section>

      <section className="work-panel span-2"><div className="workspace-label"><span>04</span><div><h2>题本安全边界</h2></div></div><div className="system-list"><span><ShieldCheck size={16} />题目正文来自 canonical 本地题库，收藏与分类不改原题。</span><span><History size={16} />版本冲突会阻止覆盖；使用记录来自 SQLite readback。</span><span><Database size={16} />教师手工录题不得伪装成 generated 来源。</span></div></section>
    </div>
  );
}
