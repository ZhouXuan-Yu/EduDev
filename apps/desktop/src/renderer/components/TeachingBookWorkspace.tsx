import { Archive, FileDown, Plus, RefreshCw, RotateCcw, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import styles from '../ui-system/teaching-editors-alignment.module.css';
import {useDesktopNavigationGuard} from './desktop/DesktopFrame';
import {emptyBookDraft, emptyChapterDraft, emptyPageDraft, emptyBlockDraft, emptySourceDraft, emptyPatchDraft, emptySelectionPatchDraft, teachingBookDraftBaseline, teachingBookDirtyScopes, preserveTeachingBookDraftVersions} from './teaching-book-draft-state';
import type {
  TeachingBlockStatus,
  TeachingBlockType,
  TeachingBook,
  TeachingBookDetail,
  TeachingBookInvalidation,
  TeachingBookMarkdownPreview,
  TeachingBookPatch,
  TeachingBookStatus,
  TeachingContentType,
} from '../../shared/contracts';

type Props = { setStatus: (message: string) => void };

const contentTypes: TeachingContentType[] = ['theory', 'derivation', 'history', 'practice', 'concept', 'overview'];
const blockTypes: TeachingBlockType[] = ['text', 'section', 'callout', 'quiz', 'card', 'figure', 'concept_graph', 'timeline', 'code', 'deep_explanation', 'interactive', 'animation', 'user_note'];
const bookStatuses: TeachingBookStatus[] = ['draft', 'spine_ready', 'compiling', 'ready', 'partial', 'error'];
const blockStatuses: TeachingBlockStatus[] = ['pending', 'generating', 'ready', 'error', 'hidden'];


function splitLines(value: string) {
  return value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
}

function payloadText(payload: Record<string, unknown>) {
  for (const key of ['text', 'markdown', 'content']) {
    if (typeof payload[key] === 'string') return String(payload[key]);
  }
  return JSON.stringify(payload, null, 2);
}

function formatTime(value: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '未完成';
}

export function TeachingBookWorkspace({ setStatus }: Props) {
  const [books, setBooks] = useState<TeachingBook[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<TeachingBookDetail | null>(null);
  const [preview, setPreview] = useState<TeachingBookMarkdownPreview | null>(null);
  const [invalidations, setInvalidations] = useState<TeachingBookInvalidation[]>([]);
  const [patches, setPatches] = useState<TeachingBookPatch[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [bookDraft, setBookDraft] = useState(emptyBookDraft);
  const [chapterDraft, setChapterDraft] = useState(emptyChapterDraft);
  const [pageDraft, setPageDraft] = useState(emptyPageDraft);
  const [pageChapterId, setPageChapterId] = useState('');
  const [blockDraft, setBlockDraft] = useState(emptyBlockDraft);
  const [blockPageId, setBlockPageId] = useState('');
  const [editingBlockId, setEditingBlockId] = useState('');
  const [sourceDraft, setSourceDraft] = useState(emptySourceDraft);
  const [patchDraft, setPatchDraft] = useState(emptyPatchDraft);
  const [selectionPatchDraft, setSelectionPatchDraft] = useState(emptySelectionPatchDraft);
  const [bookBaseline, setBookBaseline] = useState(emptyBookDraft);
  const [blockBaseline, setBlockBaseline] = useState(emptyBlockDraft);
  const [patchBaseline, setPatchBaseline] = useState(emptyPatchDraft);

  const selected = useMemo(() => books.find((book) => book.id === selectedId) ?? null, [books, selectedId]);
  const editingBlock = useMemo(() => detail?.blocks.find((block) => block.id === editingBlockId) ?? null, [detail, editingBlockId]);
  const drafts = {book: bookDraft, chapter: chapterDraft, page: pageDraft, block: blockDraft, source: sourceDraft, patch: patchDraft, selection: selectionPatchDraft};
  const baseline = {...teachingBookDraftBaseline(detail?.book), book: bookBaseline, block: editingBlockId ? blockBaseline : emptyBlockDraft, patch: editingBlockId ? patchBaseline : emptyPatchDraft};
  const scopes = teachingBookDirtyScopes(drafts, baseline, editingBlockId);
  const dirty = Object.values(scopes).some(Boolean);
  const latest = useRef({detail, drafts, scopes, editingBlockId});
  latest.current = {detail, drafts, scopes, editingBlockId};
  const requests = useRef({book: 0, list: 0}), activeBookId = useRef('');
  const lastReadDetail = useRef<TeachingBookDetail | null>(null);
  useDesktopNavigationGuard(dirty || saving, '讲义有未保存或正在保存的修改，请先保存或明确放弃修改后再离开。');

  function resetDrafts(book?: TeachingBook) {
    const next = teachingBookDraftBaseline(book);
    setBookDraft(next.book); setChapterDraft(next.chapter); setPageDraft(next.page); setBlockDraft(next.block);
    setSourceDraft(next.source); setPatchDraft(next.patch); setSelectionPatchDraft(next.selection); setEditingBlockId('');
    setBookBaseline(next.book); setBlockBaseline(next.block); setPatchBaseline(next.patch);
  }
  function allowDraftChange() {
    if (!dirty && !saving && !loading) return true;
    setEditorOpen(true); setNotice('请先保存或明确放弃当前未保存修改，再切换、新建或刷新讲义。'); return false;
  }
  function startNewBook() {
    if (!selectedId && !detail) { setEditorOpen(true); return; }
    if (!allowDraftChange()) return;
    ++requests.current.book; ++requests.current.list; activeBookId.current = '';
    setSelectedId(''); setDetail(null); lastReadDetail.current = null; setPreview(null); setInvalidations([]); setPatches([]);
    resetDrafts(); setPageChapterId(''); setBlockPageId(''); setEditorOpen(true);
  }
  async function chooseBook(bookId: string) {
    if (bookId === selectedId && detail?.book.id === bookId) { setEditorOpen(true); return; }
    if (!allowDraftChange()) return;
    activeBookId.current = bookId; setEditorOpen(true); setLoading(true);
    try { await loadBook(bookId); }
    catch (error) { activeBookId.current = latest.current.detail?.book.id ?? ''; showError(error, '读取讲义失败，当前内容已保留，请重试。'); }
    finally { if (activeBookId.current === bookId || activeBookId.current === latest.current.detail?.book.id) setLoading(false); }
  }
  function returnToList() {
    setEditorOpen(false);
    if (dirty) setNotice('未保存修改保留在当前页面，重新打开此讲义可继续编辑。');
  }
  function discardDrafts() {
    if (saving || loading) return;
    const snapshot = lastReadDetail.current?.book.id === detail?.book.id ? lastReadDetail.current : detail;
    setDetail(snapshot); resetDrafts(snapshot?.book); setNotice('已明确放弃当前未保存修改，原保存记录与失败反馈保留。');
  }


  function showNotice(message: string) {
    setNotice(message);
    setErrorMessage('');
    setStatus(message);
  }

  function showError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message : fallback;
    setErrorMessage(message);
    setNotice('');
    setStatus(message);
  }

  function cancelBlockDraft() {
    setEditingBlockId(''); setBlockDraft(emptyBlockDraft);
    const snapshot = lastReadDetail.current;
    setDetail(current => current && snapshot?.book.id === current.book.id ? {...current, blocks: snapshot.blocks} : current);
  }

  async function loadBook(bookId: string, acceptBookDraft = false) {
    const stamp = ++requests.current.book;
    if (!bookId) { setDetail(null); lastReadDetail.current = null; setPreview(null); setInvalidations([]); setPatches([]); return; }
    const [nextDetail, nextPreview, nextInvalidations, nextPatches] = await Promise.all([
      window.omniEdu?.getTeachingBook(bookId),
      window.omniEdu?.previewTeachingBookMarkdown(bookId),
      window.omniEdu?.listTeachingBookInvalidations(bookId, true),
      window.omniEdu?.listTeachingBookPatches(bookId),
    ]);
    if (stamp !== requests.current.book || activeBookId.current !== bookId) return;
    if (!nextDetail || nextDetail.book.id !== bookId) throw new Error('未能读取当前讲义，请重试。');
    lastReadDetail.current = nextDetail;
    const current = latest.current, sameBook = current.detail?.book.id === bookId;
    const nextBlock = nextDetail.blocks.find(block => block.id === current.editingBlockId);
    const nextDrafts = teachingBookDraftBaseline(nextDetail.book, nextBlock, nextBlock ? payloadText(nextBlock.payload) : '');
    setDetail(preserveTeachingBookDraftVersions(current.detail, nextDetail, current.scopes, current.editingBlockId, acceptBookDraft));
    setPreview(nextPreview ?? null); setInvalidations(nextInvalidations ?? []); setPatches(nextPatches ?? []);
    if (!sameBook) resetDrafts(nextDetail.book);
    else {
      if (acceptBookDraft || !current.scopes.book) { setBookDraft(nextDrafts.book); setBookBaseline(nextDrafts.book); }
      if (!current.scopes.block) { setBlockDraft(nextDrafts.block); setBlockBaseline(nextDrafts.block); }
      if (!current.scopes.patch) { setPatchDraft(nextDrafts.patch); setPatchBaseline(nextDrafts.patch); }
    }
    setSelectedId(bookId);
    setPageChapterId((current) => nextDetail.chapters.some((item) => item.id === current) ? current : nextDetail.chapters[0]?.id ?? '');
    setBlockPageId((current) => nextDetail.pages.some((item) => item.id === current) ? current : nextDetail.pages[0]?.id ?? '');
  }

  async function loadBooks(preferredId = selectedId, showArchived = includeArchived) {
    const stamp = ++requests.current.list; setLoading(true);
    try {
      const next = await window.omniEdu?.listTeachingBooks(showArchived) ?? [];
      if (stamp !== requests.current.list) return;
      setBooks(next);
      const nextId = next.some((book) => book.id === preferredId) ? preferredId : Object.values(latest.current.scopes).some(Boolean) ? activeBookId.current : next.find((book) => !book.deletedAt)?.id ?? next[0]?.id ?? '';
      activeBookId.current = nextId;
      await loadBook(nextId);
      if (!nextId) setSelectedId('');
    } catch (error) { if (stamp === requests.current.list) showError(error, '读取讲义工作区失败，请稍后重试。'); }
    finally { if (stamp === requests.current.list) setLoading(false); }
  }

  useEffect(() => { void loadBooks(); return () => { ++requests.current.book; ++requests.current.list; }; }, []);
  useEffect(() => {
    if (!dirty && !saving) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', guard); return () => window.removeEventListener('beforeunload', guard);
  }, [dirty, saving]);

  async function refreshCurrent(message?: string, acceptBookDraft = false) {
    const bookId = activeBookId.current;
    const next = await window.omniEdu?.listTeachingBooks(includeArchived) ?? [];
    if (activeBookId.current !== bookId) return;
    setBooks(next); await loadBook(bookId, acceptBookDraft);
    if (message) showNotice(message);
  }

  async function createBook() {
    if (!bookDraft.title.trim()) { showError(null, '讲义标题不能为空。'); return; }
    setSaving(true);
    try {
      const created = await window.omniEdu?.createTeachingBook({ title: bookDraft.title.trim(), description: bookDraft.description.trim(), targetLevel: bookDraft.targetLevel.trim(), language: bookDraft.language.trim() || 'zh-CN' });
      if (!created) throw new Error('讲义创建后没有返回结果。');
      setSelectedId(created.id);
      await loadBooks(created.id, includeArchived);
      showNotice('讲义已创建并保存在本机。');
    } catch (error) { showError(error, '创建讲义失败。'); }
    finally { setSaving(false); }
  }

  async function updateBook() {
    if (!detail || detail.book.deletedAt) return;
    setSaving(true);
    try {
      await window.omniEdu?.updateTeachingBook(detail.book.id, { ...bookDraft, version: detail.book.version });
      await refreshCurrent('讲义信息已保存。', true);
    } catch (error) { showError(error, '保存讲义信息失败。'); await loadBooks(detail.book.id, includeArchived); }
    finally { setSaving(false); }
  }

  async function archiveBook() {
    if (!detail || detail.book.deletedAt) return;
    setSaving(true);
    try {
      await window.omniEdu?.deleteTeachingBook(detail.book.id);
      setIncludeArchived(true);
      await loadBooks(detail.book.id, true);
      showNotice('讲义已归档，可继续只读查看。');
    } catch (error) { showError(error, '归档讲义失败。'); }
    finally { setSaving(false); }
  }

  async function createChapter() {
    if (!detail || !chapterDraft.title.trim()) { showError(null, '请选择讲义并填写章节标题。'); return; }
    setSaving(true);
    try {
      const chapter = await window.omniEdu?.createTeachingBookChapter({
        bookId: detail.book.id, title: chapterDraft.title.trim(), summary: chapterDraft.summary.trim(), contentType: chapterDraft.contentType,
        learningObjectives: splitLines(chapterDraft.objectives), prerequisites: splitLines(chapterDraft.prerequisites), order: detail.chapters.length,
      });
      setChapterDraft(emptyChapterDraft);
      if (chapter) setPageChapterId(chapter.id);
      await refreshCurrent('章节已保存。');
    } catch (error) { showError(error, '创建章节失败。'); }
    finally { setSaving(false); }
  }

  async function createPage() {
    if (!detail || !pageChapterId || !pageDraft.title.trim()) { showError(null, '请选择章节并填写页面标题。'); return; }
    setSaving(true);
    try {
      const page = await window.omniEdu?.createTeachingBookPage({ bookId: detail.book.id, chapterId: pageChapterId, title: pageDraft.title.trim(), learningObjectives: splitLines(pageDraft.objectives), contentType: pageDraft.contentType, order: detail.pages.length });
      setPageDraft(emptyPageDraft);
      if (page) setBlockPageId(page.id);
      await refreshCurrent('讲义页面已保存。');
    } catch (error) { showError(error, '创建讲义页面失败。'); }
    finally { setSaving(false); }
  }

  function beginEditBlock(blockId: string) {
    if (blockId === editingBlockId) return;
    if (saving || scopes.block || scopes.patch || scopes.selection) { setNotice('请先保存内容块或明确放弃当前修改，再编辑其他内容块。'); return; }
    const block = detail?.blocks.find((item) => item.id === blockId);
    if (!block) return;
    const baseline = teachingBookDraftBaseline(detail?.book, block, payloadText(block.payload));
    setBlockBaseline(baseline.block); setPatchBaseline(baseline.patch);
    setEditingBlockId(block.id);
    setBlockPageId(block.pageId);
    setBlockDraft({ title: block.title, text: payloadText(block.payload), type: block.type, status: block.status, sourceRef: block.sourceAnchors[0]?.ref ?? '' });
    setPatchDraft({ title: block.title, text: payloadText(block.payload), reason: '' });
    setSelectionPatchDraft(emptySelectionPatchDraft);
  }

  async function saveBlock() {
    if (!detail || !blockPageId || !blockDraft.text.trim()) { showError(null, '请选择页面并填写内容块正文。'); return; }
    if (editingBlockId && !editingBlock) { showError(null, '当前内容块已不可用，草稿仍保留，请放弃本地修改后重新读取。'); return; }
    setSaving(true);
    try {
      const sourceAnchor = detail.sources.find((source) => source.ref === blockDraft.sourceRef);
      await window.omniEdu?.upsertTeachingBookBlock({
        pageId: blockPageId, title: blockDraft.title.trim(), type: blockDraft.type, status: blockDraft.status,
        payload: { text: blockDraft.text }, sourceAnchors: sourceAnchor ? [sourceAnchor] : editingBlock?.sourceAnchors ?? [],
        order: editingBlock?.order ?? detail.blocks.filter((block) => block.pageId === blockPageId).length,
      }, editingBlock?.id, editingBlock?.version);
      setEditingBlockId(''); setBlockDraft(emptyBlockDraft);
      await refreshCurrent(editingBlock ? '内容块已更新。' : '内容块已保存。');
    } catch (error) { showError(error, '保存内容块失败。'); await loadBook(detail.book.id); }
    finally { setSaving(false); }
  }

  async function addManualSource() {
    if (!detail || !sourceDraft.ref.trim() || !sourceDraft.title.trim()) { showError(null, '来源引用和标题不能为空。'); return; }
    setSaving(true);
    try {
      const ref = sourceDraft.ref.trim();
      await window.omniEdu?.addTeachingBookSource({ bookId: detail.book.id, kind: 'manual', ref, title: sourceDraft.title.trim(), snippet: sourceDraft.snippet.trim(), fingerprint: ref, status: 'available' });
      setSourceDraft(emptySourceDraft);
      await refreshCurrent('手工来源已绑定；健康检查只验证其本地指纹。');
    } catch (error) { showError(error, '添加讲义来源失败。'); }
    finally { setSaving(false); }
  }

  async function refreshHealth() {
    if (!detail) return;
    setSaving(true);
    try {
      const health = await window.omniEdu?.refreshTeachingBookHealth(detail.book.id);
      await refreshCurrent(`来源健康检查完成：${health?.status ?? 'unknown'}。`);
    } catch (error) { showError(error, '刷新来源健康失败。'); }
    finally { setSaving(false); }
  }

  async function regeneratePage(pageId: string, version: number) {
    setSaving(true);
    try { await window.omniEdu?.regenerateTeachingBookPage(pageId, version); await refreshCurrent('页面已标记为 pending，等待后续生成流程。'); }
    catch (error) { showError(error, '重置页面状态失败。'); }
    finally { setSaving(false); }
  }

  async function regenerateBlock(blockId: string, version: number) {
    setSaving(true);
    try { await window.omniEdu?.regenerateTeachingBookBlock(blockId, version); await refreshCurrent('内容块已标记为 pending，未伪造生成结果。'); }
    catch (error) { showError(error, '重置内容块状态失败。'); }
    finally { setSaving(false); }
  }

  async function proposePatch() {
    if (!detail || !editingBlock || !patchDraft.text.trim()) { showError(null, '请先选择内容块并填写 patch 预览。'); return; }
    setSaving(true);
    try {
      await window.omniEdu?.proposeTeachingBookBlockPatch({ bookId: detail.book.id, blockId: editingBlock.id, baseVersion: editingBlock.version, title: patchDraft.title.trim(), payload: { text: patchDraft.text }, reason: patchDraft.reason.trim() });
      await refreshCurrent('Patch 草稿已保存，讲义正文尚未改变；请检查后再应用。');
    } catch (error) { showError(error, '创建 patch 草稿失败。'); }
    finally { setSaving(false); }
  }

  async function proposeSelectionPatch() {
    if (!detail || !editingBlock) { showError(null, '请先选择需要局部修改的内容块。'); return; }
    const currentText = payloadText(editingBlock.payload);
    const start = Math.trunc(selectionPatchDraft.start);
    const end = Math.trunc(selectionPatchDraft.end);
    const selectedText = currentText.slice(start, end);
    if (start < 0 || end <= start || end > currentText.length || !selectedText || !selectionPatchDraft.replacement.trim()) {
      showError(null, '选区边界或替换文本无效，请按当前正文重新选择。'); return;
    }
    setSaving(true);
    try {
      await window.omniEdu?.proposeTeachingBookSelectionPatch({
        bookId: detail.book.id,
        blockId: editingBlock.id,
        baseVersion: editingBlock.version,
        selectionStart: start,
        selectionEnd: end,
        selectedText,
        replacementText: selectionPatchDraft.replacement,
        mode: selectionPatchDraft.mode,
        reason: selectionPatchDraft.reason.trim(),
      });
      await refreshCurrent('选区 patch 草稿已保存，正文和版本均未改变；请复核后应用。');
    } catch (error) { showError(error, '创建选区 patch 失败，选区可能已经漂移。'); }
    finally { setSaving(false); }
  }

  async function applyPatch(patchId: string) {
    setSaving(true);
    try { await window.omniEdu?.applyTeachingBookPatch(patchId); setEditingBlockId(''); await refreshCurrent('修改已应用，已重新读取保存后的内容。'); }
    catch (error) { showError(error, '应用 patch 失败，可能存在版本冲突。'); await loadBook(selectedId); }
    finally { setSaving(false); }
  }

  async function undoPatch(patchId: string) {
    setSaving(true);
    try { await window.omniEdu?.undoTeachingBookPatch(patchId); await refreshCurrent('Patch 已撤销，正文已恢复并产生新版本。'); }
    catch (error) { showError(error, '撤销 patch 失败。'); await loadBook(selectedId); }
    finally { setSaving(false); }
  }

  async function exportMarkdown() {
    if (!detail || !preview) return;
    setSaving(true);
    showNotice('正在导出教师确认的讲义 Markdown…');
    try {
      const dataRoot = await window.omniEdu?.getDataRoot();
      const exportPromise = window.omniEdu?.exportDocumentArtifact({ artifactId: `book_${detail.book.id.slice(-12)}`, title: detail.book.title, type: 'markdown', fileName: `${detail.book.title}.md`, contentMd: preview.markdown, description: `讲义 Markdown 导出；${preview.fallbackCount} 个块使用兼容 fallback，导出前已由教师确认。`, destinationRoot: dataRoot ? `${dataRoot}/exports/ai-artifacts` : undefined });
      const artifact = await Promise.race([
        exportPromise,
        new Promise<never>((_resolve, reject) => window.setTimeout(() => reject(new Error('讲义导出超过 15 秒，请重试。')), 15_000)),
      ]);
      if (artifact?.status !== 'exported') throw new Error('讲义导出没有进入 exported 状态。');
      showNotice(`讲义已导出：${artifact.filePath}`);
    } catch (error) { showError(error, '讲义导出失败。'); }
    finally { setSaving(false); }
  }

  const archived = Boolean(detail?.book.deletedAt);
  const filteredBooks = books.filter(book => `${book.title} ${book.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return (
    <div className={`teaching-book-workspace ${styles.workspace} ${styles.bookGrid}`} data-editor-open={editorOpen} data-testid="teaching-book-workspace">
      <section className={`work-panel teaching-book-library ${styles.bookLibrary}`} data-testid="teaching-book-library">
        <div className={`panel-heading ${styles.heading}`}><div><h2>讲义</h2><p className="muted">打开已有讲义继续编辑，或创建新的课堂讲义。</p></div><button className="primary-action" disabled={loading || saving} onClick={startNewBook} data-testid="teaching-book-new"><Plus size={16} />新建讲义</button></div>
        <div className={styles.toolbar}><label className={styles.search}>搜索讲义<input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索名称或说明" data-testid="teaching-book-search"/></label><button className="icon-button" aria-label="刷新讲义" disabled={loading || saving} onClick={() => { if (allowDraftChange()) void loadBooks(); }} data-testid="teaching-book-refresh"><RefreshCw size={16} /></button></div>
        <label className="checkbox-label"><input type="checkbox" checked={includeArchived} onChange={(event) => { if (!allowDraftChange()) return; setIncludeArchived(event.target.checked); void loadBooks(selectedId, event.target.checked); }} data-testid="teaching-book-show-archived" />显示已归档</label>
        {loading ? <div className="empty-state" data-testid="teaching-book-loading">正在读取讲义工作区…</div> : null}
        {errorMessage ? <div className="warning-box" role="alert" data-testid="teaching-book-error">{errorMessage}</div> : null}
        {notice ? <div className="success-box" role="status" data-testid="teaching-book-success">{notice}</div> : null}
        {dirty && <button className="secondary-action" disabled={saving || loading} onClick={discardDrafts} data-testid="teaching-book-discard-drafts">放弃未保存修改</button>}
        {dirty && !editorOpen && <button className="secondary-action" disabled={saving || loading} onClick={() => setEditorOpen(true)} data-testid="teaching-book-resume-draft">继续编辑当前草稿</button>}
        {!loading && !books.length ? <div className="empty-state" data-testid="teaching-book-empty">还没有讲义，点击“新建讲义”开始。</div> : null}
        <div className={styles.catalogue}><table aria-label="讲义列表"><thead><tr><th>名称</th><th>内容</th><th>版本</th></tr></thead><tbody>{filteredBooks.map((book) => <tr key={book.id} aria-selected={book.id === selectedId}><td><button disabled={loading || saving} onClick={() => void chooseBook(book.id)} data-testid={`teaching-book-item-${book.id}`}><strong>{book.title}</strong><small>{book.description || book.targetLevel || '讲义'}</small></button></td><td>{book.chapterCount} 章 · {book.pageCount} 页</td><td>第 {book.version} 版{book.deletedAt ? ' · 已归档' : ''}</td></tr>)}</tbody></table></div>
        {!loading && books.length > 0 && !filteredBooks.length && <p role="status" data-testid="teaching-book-filter-empty">没有匹配的讲义，请调整搜索词。</p>}
      </section>

      <div className={styles.bookEditor} hidden={!editorOpen} inert={loading || saving}>
      <button className="ghost-action" disabled={saving} onClick={returnToList} data-testid="teaching-book-back">返回讲义列表</button>
      <section className="work-panel teaching-book-editor" data-testid="teaching-book-editor" aria-busy={loading || saving}>
        <div className="panel-heading"><div><h3>{detail ? '讲义信息' : '创建讲义'}</h3><p className="muted">编辑后请保存；已归档讲义保持只读。</p></div></div>
        <div className="form-grid compact-form-grid">
          <label>标题<input value={bookDraft.title} onChange={(event) => setBookDraft({ ...bookDraft, title: event.target.value })} disabled={loading || saving || archived} data-testid="teaching-book-title" /></label>
          <label>适用年级<input value={bookDraft.targetLevel} onChange={(event) => setBookDraft({ ...bookDraft, targetLevel: event.target.value })} disabled={loading || saving || archived} data-testid="teaching-book-target-level" /></label>
          <label>语言<input value={bookDraft.language} onChange={(event) => setBookDraft({ ...bookDraft, language: event.target.value })} disabled={loading || saving || archived} data-testid="teaching-book-language" /></label>
          {detail ? <label>状态<select value={bookDraft.status} onChange={(event) => setBookDraft({ ...bookDraft, status: event.target.value as TeachingBookStatus })} disabled={loading || saving || archived} data-testid="teaching-book-status">{bookStatuses.map((status) => <option key={status}>{status}</option>)}</select></label> : null}
        </div>
        <label>说明<textarea value={bookDraft.description} onChange={(event) => setBookDraft({ ...bookDraft, description: event.target.value })} disabled={loading || saving || archived} data-testid="teaching-book-description" /></label>
        <div className="toolbar-row">{detail ? <><button className="primary-action" onClick={() => void updateBook()} disabled={loading || saving || archived} data-testid="teaching-book-save"><Save size={16} />保存信息</button><button className="secondary-action" onClick={() => { if (allowDraftChange()) void archiveBook(); }} disabled={loading || saving || archived} data-testid="teaching-book-archive"><Archive size={16} />归档</button></> : <button className="primary-action" onClick={() => void createBook()} disabled={loading || saving} data-testid="teaching-book-create"><Plus size={16} />创建讲义</button>}</div>
      </section>

      {detail && !archived ? <>
        <section className="work-panel teaching-book-structure" data-testid="teaching-book-structure">
          <div className="panel-heading"><div><h3>章节与页面</h3><p className="muted">结构写入来自教师操作，不把 AI 规划草稿自动落库。</p></div></div>
          <div className="teaching-book-structure-list">{detail.chapters.map((chapter) => <article key={chapter.id} data-testid={`teaching-book-chapter-${chapter.id}`}><strong>{chapter.title}</strong><span>{chapter.contentType} · v{chapter.version}</span>{detail.pages.filter((page) => page.chapterId === chapter.id).map((page) => <div key={page.id} data-testid={`teaching-book-page-${page.id}`}><span>{page.title} · {page.status} · {page.blockCount} 块</span><button className="ghost-action" onClick={() => void regeneratePage(page.id, page.version)} data-testid={`teaching-book-page-regenerate-${page.id}`}>标记重生成</button></div>)}</article>)}</div>
          <div className="teaching-book-form-row">
            <div><h4>新增章节</h4><label>标题<input value={chapterDraft.title} onChange={(event) => setChapterDraft({ ...chapterDraft, title: event.target.value })} data-testid="teaching-book-chapter-title" /></label><label>学习目标<textarea value={chapterDraft.objectives} onChange={(event) => setChapterDraft({ ...chapterDraft, objectives: event.target.value })} data-testid="teaching-book-chapter-objectives" /></label><label>类型<select value={chapterDraft.contentType} onChange={(event) => setChapterDraft({ ...chapterDraft, contentType: event.target.value as TeachingContentType })}>{contentTypes.map((item) => <option key={item}>{item}</option>)}</select></label><button className="secondary-action" onClick={() => void createChapter()} disabled={saving} data-testid="teaching-book-chapter-create"><Plus size={16} />保存章节</button></div>
            <div><h4>新增页面</h4><label>章节<select value={pageChapterId} onChange={(event) => setPageChapterId(event.target.value)} data-testid="teaching-book-page-chapter"><option value="">请选择</option>{detail.chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label><label>标题<input value={pageDraft.title} onChange={(event) => setPageDraft({ ...pageDraft, title: event.target.value })} data-testid="teaching-book-page-title" /></label><label>学习目标<textarea value={pageDraft.objectives} onChange={(event) => setPageDraft({ ...pageDraft, objectives: event.target.value })} /></label><button className="secondary-action" onClick={() => void createPage()} disabled={saving || !detail.chapters.length} data-testid="teaching-book-page-create"><Plus size={16} />保存页面</button></div>
          </div>
        </section>

        <section className="work-panel teaching-book-blocks" data-testid="teaching-book-blocks">
          <div className="panel-heading"><div><h3>内容块</h3><p className="muted">直接编辑使用版本锁；协作 patch 必须先保存草稿，再由教师应用。</p></div></div>
          <div className="teaching-book-block-list">{detail.blocks.map((block) => <article key={block.id} className={editingBlockId === block.id ? 'active' : ''} data-testid={`teaching-book-block-${block.id}`}><button onClick={() => beginEditBlock(block.id)} data-testid={`teaching-book-block-edit-${block.id}`}><strong>{block.title || block.type}</strong><span>{block.type} · {block.status} · v{block.version}</span><p>{payloadText(block.payload).slice(0, 180)}</p></button><button className="ghost-action" onClick={() => void regenerateBlock(block.id, block.version)} data-testid={`teaching-book-block-regenerate-${block.id}`}>标记重生成</button></article>)}</div>
          {!detail.pages.length ? <div className="empty-state" data-testid="teaching-book-blocks-empty">先创建页面，再添加内容块。</div> : null}
          <div className="form-grid compact-form-grid"><label>页面<select value={blockPageId} onChange={(event) => setBlockPageId(event.target.value)} data-testid="teaching-book-block-page"><option value="">请选择</option>{detail.pages.map((page) => <option key={page.id} value={page.id}>{page.title}</option>)}</select></label><label>类型<select value={blockDraft.type} onChange={(event) => setBlockDraft({ ...blockDraft, type: event.target.value as TeachingBlockType })} data-testid="teaching-book-block-type">{blockTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label>状态<select value={blockDraft.status} onChange={(event) => setBlockDraft({ ...blockDraft, status: event.target.value as TeachingBlockStatus })}>{blockStatuses.map((item) => <option key={item}>{item}</option>)}</select></label><label>来源<select value={blockDraft.sourceRef} onChange={(event) => setBlockDraft({ ...blockDraft, sourceRef: event.target.value })}><option value="">无来源锚点</option>{detail.sources.map((source) => <option key={`${source.kind}:${source.ref}`} value={source.ref}>{source.title}</option>)}</select></label></div>
          <label>标题<input value={blockDraft.title} onChange={(event) => setBlockDraft({ ...blockDraft, title: event.target.value })} data-testid="teaching-book-block-title" /></label><label>正文<textarea value={blockDraft.text} onChange={(event) => setBlockDraft({ ...blockDraft, text: event.target.value })} data-testid="teaching-book-block-text" /></label>
          <div className="toolbar-row"><button className="primary-action" onClick={() => void saveBlock()} disabled={saving || !detail.pages.length} data-testid="teaching-book-block-save"><Save size={16} />{editingBlock ? '保存内容块' : '新增内容块'}</button>{editingBlock ? <button className="secondary-action" onClick={cancelBlockDraft} data-testid="teaching-book-block-cancel">取消编辑</button> : null}</div>
          {editingBlock ? <div className="teaching-book-patch-form" data-testid="teaching-book-patch-form"><h4>整块协作修改</h4><label>候选标题<input value={patchDraft.title} onChange={(event) => setPatchDraft({ ...patchDraft, title: event.target.value })} data-testid="teaching-book-patch-title" /></label><label>候选正文<textarea value={patchDraft.text} onChange={(event) => setPatchDraft({ ...patchDraft, text: event.target.value })} data-testid="teaching-book-patch-text" /></label><label>修改原因<input value={patchDraft.reason} onChange={(event) => setPatchDraft({ ...patchDraft, reason: event.target.value })} data-testid="teaching-book-patch-reason" /></label><button className="secondary-action" onClick={() => void proposePatch()} disabled={saving} data-testid="teaching-book-patch-propose">保存整块 patch 草稿（不改正文）</button><h4>精确选区修改</h4><p className="muted" data-testid="teaching-book-selection-preview">当前选区：{payloadText(editingBlock.payload).slice(selectionPatchDraft.start, selectionPatchDraft.end) || '未选择'}</p><div className="form-grid compact-form-grid"><label>起点<input type="number" min="0" value={selectionPatchDraft.start} onChange={(event) => setSelectionPatchDraft({ ...selectionPatchDraft, start: Number(event.target.value) })} data-testid="teaching-book-selection-start" /></label><label>终点<input type="number" min="0" value={selectionPatchDraft.end} onChange={(event) => setSelectionPatchDraft({ ...selectionPatchDraft, end: Number(event.target.value) })} data-testid="teaching-book-selection-end" /></label><label>模式<select value={selectionPatchDraft.mode} onChange={(event) => setSelectionPatchDraft({ ...selectionPatchDraft, mode: event.target.value as 'react_edit' | 'automark' })} data-testid="teaching-book-selection-mode"><option value="react_edit">局部改写</option><option value="automark">自动批注</option></select></label></div><label>替换文本<textarea value={selectionPatchDraft.replacement} onChange={(event) => setSelectionPatchDraft({ ...selectionPatchDraft, replacement: event.target.value })} data-testid="teaching-book-selection-replacement" /></label><label>修改原因<input value={selectionPatchDraft.reason} onChange={(event) => setSelectionPatchDraft({ ...selectionPatchDraft, reason: event.target.value })} data-testid="teaching-book-selection-reason" /></label><button className="secondary-action" onClick={() => void proposeSelectionPatch()} disabled={saving} data-testid="teaching-book-selection-propose">保存选区 patch 草稿（不改正文）</button></div> : null}
          <div className="teaching-book-patch-list" data-testid="teaching-book-patch-list">{patches.map((patch) => <article key={patch.id} data-testid={`teaching-book-patch-${patch.id}`}><div><strong>{patch.operation}</strong><span>{patch.status} · base v{patch.baseVersion}{patch.resultVersion ? ` → v${patch.resultVersion}` : ''}</span><p>{patch.reason || '无修改原因'}</p>{patch.error ? <small>{patch.error}</small> : null}</div><div className="toolbar-row">{patch.status === 'draft' ? <button className="primary-action" onClick={() => void applyPatch(patch.id)} data-testid={`teaching-book-patch-apply-${patch.id}`}>应用</button> : null}{patch.status === 'applied' ? <button className="secondary-action" onClick={() => void undoPatch(patch.id)} data-testid={`teaching-book-patch-undo-${patch.id}`}><RotateCcw size={15} />撤销</button> : null}</div></article>)}</div>
        </section>

        <section className="work-panel teaching-book-sources" data-testid="teaching-book-sources">
          <div className="panel-heading"><div><h3>来源健康</h3><p className="muted">刷新只更新健康元数据与失效队列，不改讲义正文。</p></div><button className="secondary-action" onClick={() => void refreshHealth()} disabled={saving} data-testid="teaching-book-health-refresh"><RefreshCw size={16} />刷新健康</button></div>
          <div className={`teaching-book-health health-${detail.health.status}`} data-testid="teaching-book-health"><ShieldCheck size={18} /><strong>{detail.health.status}</strong><span>{detail.health.sourceCount} 个来源 · {detail.health.staleBlockIds.length} 个受影响块</span></div>
          <div className="teaching-book-source-list">{detail.sources.map((source) => <article key={`${source.kind}:${source.ref}`} data-testid={`teaching-book-source-${source.ref}`}><strong>{source.title}</strong><span>{source.kind} · {source.status}</span><p>{source.snippet || source.ref}</p></article>)}</div>
          <div className="teaching-book-source-form"><h4>绑定手工来源</h4><label>引用键<input value={sourceDraft.ref} onChange={(event) => setSourceDraft({ ...sourceDraft, ref: event.target.value })} data-testid="teaching-book-source-ref" /></label><label>标题<input value={sourceDraft.title} onChange={(event) => setSourceDraft({ ...sourceDraft, title: event.target.value })} data-testid="teaching-book-source-title" /></label><label>摘要<textarea value={sourceDraft.snippet} onChange={(event) => setSourceDraft({ ...sourceDraft, snippet: event.target.value })} data-testid="teaching-book-source-snippet" /></label><button className="secondary-action" onClick={() => void addManualSource()} disabled={saving} data-testid="teaching-book-source-add"><Plus size={16} />绑定来源</button></div>
          <div className="teaching-book-invalidation-list" data-testid="teaching-book-invalidations">{invalidations.map((item) => <article key={item.id}><strong>{item.ref}</strong><span>{item.status} · {formatTime(item.detectedAt)}</span><small>{item.stalePageIds.length} 页 / {item.staleBlockIds.length} 块</small></article>)}{!invalidations.length ? <div className="empty-state">没有来源失效记录。</div> : null}</div>
        </section>

        <section className="work-panel teaching-book-preview-panel" data-testid="teaching-book-preview-panel">
          <div className="panel-heading"><div><h3>安全预览与导出</h3><p className="muted">预览不写文件；只有教师点击导出后才产生 document_artifact。</p></div><div className="toolbar-row"><button className="secondary-action" onClick={() => { if (allowDraftChange()) void loadBook(detail.book.id).catch(error => showError(error, '读取预览失败，请重试。')); }} data-testid="teaching-book-preview-refresh"><Sparkles size={16} />重新编译</button><button className="primary-action" onClick={() => void exportMarkdown()} disabled={!preview || saving} data-testid="teaching-book-export"><FileDown size={16} />导出 Markdown</button></div></div>
          {preview ? <><div className="teaching-book-preview" data-testid="teaching-book-preview"><Markdown>{preview.markdown}</Markdown></div><small data-testid="teaching-book-preview-meta">schema={preview.schemaVersion} · blocks={preview.blockCount} · fallback={preview.fallbackCount} · writesFile={String(preview.writesFile)} · requiresTeacherReview={String(preview.requiresTeacherReview)}</small></> : <div className="empty-state">尚未生成预览。</div>}
        </section>
      </> : null}

      {detail && archived ? <section className="work-panel teaching-book-archived" data-testid="teaching-book-archived"><Archive size={20} /><div><h3>该讲义已归档</h3><p>可查看归档时的信息，内容保持只读。</p></div></section> : null}
      </div>
    </div>
  );
}
