import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  DocumentArtifactExportResult,
  Paper,
  PaperBlueprint,
  PaperBlueprintInput,
  PaperItem,
  PaperTypeSpec,
  PaperValidationResult,
  QuestionBankItem,
} from '../../shared/contracts';

type PaperWorkspaceProps = {
  setStatus: (message: string) => void;
};

type TypeSpecDraft = { questionType: string; count: string; pointsPerQuestion: string };

const emptyBlueprintDraft = {
  title: '',
  subject: '',
  grade: '',
  textbookVersion: '',
  scope: '',
  knowledgePoints: '',
  durationMinutes: '60',
  sourcePreference: 'any' as PaperBlueprintInput['sourcePreference'],
};

export function PaperWorkspace({ setStatus }: PaperWorkspaceProps) {
  const [blueprints, setBlueprints] = useState<PaperBlueprint[]>([]);
  const [selectedBlueprintId, setSelectedBlueprintId] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [blueprintDraft, setBlueprintDraft] = useState(emptyBlueprintDraft);
  const [typeSpecs, setTypeSpecs] = useState<TypeSpecDraft[]>([{ questionType: '选择题', count: '5', pointsPerQuestion: '3' }]);
  const [difficultyMix, setDifficultyMix] = useState({ easy: '50', medium: '40', hard: '10' });
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState('');
  const [validation, setValidation] = useState<PaperValidationResult | null>(null);
  const [exports, setExports] = useState<Record<string, DocumentArtifactExportResult>>({});
  const [replaceQuery, setReplaceQuery] = useState<Record<string, string>>({});
  const [replaceCandidates, setReplaceCandidates] = useState<Record<string, QuestionBankItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [savingBlueprint, setSavingBlueprint] = useState(false);
  const [creatingPaper, setCreatingPaper] = useState(false);
  const [busyItemId, setBusyItemId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');

  const selectedBlueprint = useMemo(
    () => blueprints.find((item) => item.id === selectedBlueprintId) ?? null,
    [blueprints, selectedBlueprintId],
  );
  const selectedPaper = useMemo(
    () => papers.find((item) => item.id === selectedPaperId) ?? null,
    [papers, selectedPaperId],
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    setErrorMessage('');
    setStatus(message);
  }, [setStatus]);

  const showError = useCallback((error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : fallback;
    setErrorMessage(message);
    setNotice('');
    setStatus(message);
  }, [setStatus]);

  const loadBlueprints = useCallback(async (preferredId?: string, showArchived = includeArchived) => {
    const next = await window.omniEdu?.listPaperBlueprints(showArchived) ?? [];
    setBlueprints(next);
    const nextId = next.some((item) => item.id === preferredId) ? String(preferredId) : next[0]?.id ?? '';
    setSelectedBlueprintId(nextId);
    return next;
  }, [includeArchived]);

  const loadPapers = useCallback(async (preferredId?: string) => {
    const next = await window.omniEdu?.listPapers(30) ?? [];
    setPapers(next);
    const nextId = next.some((item) => item.id === preferredId) ? String(preferredId) : next[0]?.id ?? '';
    setSelectedPaperId(nextId);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([loadBlueprints(), loadPapers()])
      .catch((error) => {
        if (!cancelled) showError(error, '读取组卷工作区失败，请稍后重试。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [loadBlueprints, loadPapers, showError]);

  useEffect(() => {
    if (!selectedBlueprint) return;
    setBlueprintDraft({
      title: selectedBlueprint.title,
      subject: selectedBlueprint.subject,
      grade: selectedBlueprint.grade,
      textbookVersion: selectedBlueprint.textbookVersion,
      scope: selectedBlueprint.scope,
      knowledgePoints: selectedBlueprint.knowledgePoints.join('、'),
      durationMinutes: String(selectedBlueprint.durationMinutes || 60),
      sourcePreference: selectedBlueprint.sourcePreference,
    });
    setTypeSpecs(selectedBlueprint.typeSpecs.length
      ? selectedBlueprint.typeSpecs.map((spec) => ({ questionType: spec.questionType, count: String(spec.count), pointsPerQuestion: String(spec.pointsPerQuestion) }))
      : [{ questionType: '选择题', count: '5', pointsPerQuestion: '3' }]);
    setDifficultyMix(selectedBlueprint.difficultyMix
      ? { easy: String(selectedBlueprint.difficultyMix.easy), medium: String(selectedBlueprint.difficultyMix.medium), hard: String(selectedBlueprint.difficultyMix.hard) }
      : { easy: '0', medium: '0', hard: '0' });
  }, [selectedBlueprint?.id, selectedBlueprint?.version]);

  function buildBlueprintInput(): PaperBlueprintInput {
    return {
      title: blueprintDraft.title.trim(),
      subject: blueprintDraft.subject.trim(),
      grade: blueprintDraft.grade.trim(),
      textbookVersion: blueprintDraft.textbookVersion.trim(),
      scope: blueprintDraft.scope.trim(),
      knowledgePoints: blueprintDraft.knowledgePoints.split(/[、,，\s]+/).map((point) => point.trim()).filter(Boolean),
      typeSpecs: typeSpecs.map((spec) => ({
        questionType: spec.questionType.trim(),
        count: Number(spec.count) || 0,
        pointsPerQuestion: Number(spec.pointsPerQuestion) || 0,
      })),
      difficultyMix: {
        easy: Number(difficultyMix.easy) || 0,
        medium: Number(difficultyMix.medium) || 0,
        hard: Number(difficultyMix.hard) || 0,
      },
      durationMinutes: Number(blueprintDraft.durationMinutes) || 0,
      sourcePreference: blueprintDraft.sourcePreference,
    };
  }

  async function saveBlueprint() {
    if (!blueprintDraft.title.trim()) {
      showError(null, '蓝图标题不能为空。');
      return;
    }
    setSavingBlueprint(true);
    try {
      const input = buildBlueprintInput();
      const saved = selectedBlueprint
        ? await window.omniEdu?.updatePaperBlueprint(selectedBlueprint.id, selectedBlueprint.version, input)
        : await window.omniEdu?.createPaperBlueprint(input);
      if (!saved) throw new Error('蓝图保存没有返回结果。');
      await loadBlueprints(saved.id);
      showNotice(selectedBlueprint ? `蓝图已更新到 v${saved.version}。` : `蓝图已创建：总分 ${saved.totalPoints} 分。`);
    } catch (error) {
      showError(error, '保存蓝图失败。');
    } finally {
      setSavingBlueprint(false);
    }
  }

  async function archiveBlueprint() {
    if (!selectedBlueprint) return;
    setSavingBlueprint(true);
    try {
      const archived = await window.omniEdu?.archivePaperBlueprint(selectedBlueprint.id, selectedBlueprint.version);
      await loadBlueprints(archived?.id);
      showNotice('蓝图已归档；已归档蓝图不能用于组卷。');
    } catch (error) {
      showError(error, '归档蓝图失败。');
    } finally {
      setSavingBlueprint(false);
    }
  }

  async function createPaper() {
    if (!selectedBlueprint) {
      showError(null, '请先选择或创建组卷蓝图。');
      return;
    }
    setCreatingPaper(true);
    setValidation(null);
    setExports({});
    try {
      const paper = await window.omniEdu?.createPaper(selectedBlueprint.id);
      if (!paper) throw new Error('组卷没有返回结果。');
      await loadPapers(paper.id);
      if (paper.items.length === 0) {
        showNotice('试卷已创建，但本地题库没有匹配的题目；请先扩充题库或调整蓝图。');
      } else {
        showNotice(`试卷已生成：${paper.items.length} 道题，总分 ${paper.totalPoints} 分。`);
      }
    } catch (error) {
      showError(error, '生成试卷失败。');
    } finally {
      setCreatingPaper(false);
    }
  }

  async function savePaperItem(item: PaperItem, patch: { stem?: string; answer?: string; analysis?: string; points?: number; locked?: boolean }) {
    if (busyItemId) return;
    setBusyItemId(item.id);
    try {
      const updated = await window.omniEdu?.updatePaperItem({ id: item.id, version: item.version, ...patch });
      if (updated) {
        setPapers((current) => current.map((paper) => (paper.id === updated.id ? updated : paper)));
        setValidation(null);
        showNotice('试卷题目已保存（版本锁生效）。');
      }
    } catch (error) {
      showError(error, '保存试卷题目失败。');
    } finally {
      setBusyItemId('');
    }
  }

  async function movePaperItem(item: PaperItem, direction: -1 | 1) {
    if (!selectedPaper) return;
    const sorted = [...selectedPaper.items].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex((entry) => entry.id === item.id);
    const target = sorted[index + direction];
    if (!target) return;
    setBusyItemId(item.id);
    try {
      await window.omniEdu?.updatePaperItem({ id: item.id, version: item.version, orderIndex: target.orderIndex });
      const refreshed = await window.omniEdu?.getPaper(selectedPaper.id);
      if (refreshed) setPapers((current) => current.map((paper) => (paper.id === refreshed.id ? refreshed : paper)));
    } catch (error) {
      showError(error, '调整题序失败。');
    } finally {
      setBusyItemId('');
    }
  }

  async function searchReplaceCandidates(item: PaperItem) {
    const query = (replaceQuery[item.id] ?? '').trim();
    if (!query) {
      showError(null, '请输入替换检索词。');
      return;
    }
    setBusyItemId(item.id);
    try {
      const results = await window.omniEdu?.searchQuestionBank({ query, limit: 5 }) ?? [];
      setReplaceCandidates((current) => ({ ...current, [item.id]: results }));
      if (!results.length) showNotice('本地题库没有命中可替换的题目。');
    } catch (error) {
      showError(error, '检索替换题目失败。');
    } finally {
      setBusyItemId('');
    }
  }

  async function applyReplace(item: PaperItem, questionId: string) {
    if (!selectedPaper) return;
    setBusyItemId(item.id);
    setValidation(null);
    try {
      const updated = await window.omniEdu?.replacePaperItem(selectedPaper.id, item.id, questionId);
      if (updated) {
        setPapers((current) => current.map((paper) => (paper.id === updated.id ? updated : paper)));
        setReplaceCandidates((current) => ({ ...current, [item.id]: [] }));
        showNotice('已换题；来源与题目正文来自本地题库。');
      }
    } catch (error) {
      showError(error, '换题失败。');
    } finally {
      setBusyItemId('');
    }
  }

  async function runValidation() {
    if (!selectedPaper) return;
    try {
      const result = await window.omniEdu?.validatePaper(selectedPaper.id);
      setValidation(result ?? null);
      if (result) showNotice(result.ok ? `校验通过：${result.itemCount} 道题，总分 ${result.totalPoints}。` : `校验发现 ${result.issues.filter((issue) => issue.level === 'error').length} 个必须修复的问题。`);
    } catch (error) {
      showError(error, '试卷校验失败。');
    }
  }

  async function exportPaperArtifacts() {
    if (!selectedPaper) return;
    setExporting(true);
    try {
      const dataRoot = await window.omniEdu?.getDataRoot();
      const result = await window.omniEdu?.exportPaper(selectedPaper.id, dataRoot ? `${dataRoot}/exports/papers` : undefined);
      if (!result) throw new Error('导出没有返回结果。');
      const failed = [result.paper, result.answerSheet, result.analysis].filter((artifact) => artifact.status !== 'exported');
      if (failed.length) throw new Error(`${failed.length} 个产物没有进入 exported 状态。`);
      setExports({ paper: result.paper, answerSheet: result.answerSheet, analysis: result.analysis });
      showNotice('试卷、答题纸和解析已导出到本地文件。');
    } catch (error) {
      showError(error, '导出试卷失败。');
    } finally {
      setExporting(false);
    }
  }

  const sortedItems = selectedPaper ? [...selectedPaper.items].sort((a, b) => a.orderIndex - b.orderIndex) : [];

  return (
    <div className="paper-workspace" data-testid="paper-workspace">
      <section className="work-panel paper-blueprint-panel" data-testid="paper-blueprint-panel">
        <div className="panel-heading">
          <div>
            <h2>智能组卷</h2>
            <p className="muted">蓝图约束 → 本地题库召回 → 教师编辑与锁定 → 校验 → 导出试卷、答题纸和解析。</p>
          </div>
          <button className="icon-button" aria-label="刷新组卷工作区" onClick={() => void Promise.all([loadBlueprints(selectedBlueprintId), loadPapers(selectedPaperId)])} data-testid="paper-refresh">刷新</button>
        </div>
        {loading ? <div className="empty-state" data-testid="paper-loading">正在读取组卷工作区…</div> : null}
        {errorMessage ? <div className="warning-box" role="alert" data-testid="paper-error">{errorMessage}</div> : null}
        {notice ? <div className="success-box" role="status" data-testid="paper-success">{notice}</div> : null}
        <label className="checkbox-label"><input type="checkbox" checked={includeArchived} onChange={(event) => { setIncludeArchived(event.target.checked); void loadBlueprints(selectedBlueprintId, event.target.checked); }} data-testid="paper-show-archived" />显示已归档蓝图</label>
        <div className="paper-blueprint-list" data-testid="paper-blueprint-list">
          {blueprints.map((blueprint) => (
            <button key={blueprint.id} className={blueprint.id === selectedBlueprintId ? 'active' : ''} onClick={() => setSelectedBlueprintId(blueprint.id)} data-testid={`paper-blueprint-${blueprint.id}`}>
              <strong>{blueprint.title}</strong>
              <span>{blueprint.subject || '未设置学科'} · {blueprint.typeSpecs.reduce((sum, spec) => sum + spec.count, 0)} 题 · {blueprint.totalPoints} 分 · v{blueprint.version}</span>
              <small>{blueprint.status === 'archived' ? '已归档' : '启用中'}</small>
            </button>
          ))}
          {!loading && !blueprints.length ? <p className="empty-state" data-testid="paper-blueprint-empty">还没有组卷蓝图，请先在右侧创建。</p> : null}
        </div>
        <button className="secondary-action" onClick={() => { setSelectedBlueprintId(''); setBlueprintDraft(emptyBlueprintDraft); setTypeSpecs([{ questionType: '选择题', count: '5', pointsPerQuestion: '3' }]); }} data-testid="paper-blueprint-new">新建蓝图</button>
      </section>

      <section className="work-panel paper-blueprint-editor" data-testid="paper-blueprint-editor">
        <div className="panel-heading"><div><h3>{selectedBlueprint ? `蓝图编辑（v${selectedBlueprint.version}）` : '创建蓝图'}</h3><p className="muted">蓝图保存后版本号递增；归档后不能用于组卷。</p></div></div>
        <div className="form-grid compact-form-grid">
          <label>标题<input value={blueprintDraft.title} onChange={(event) => setBlueprintDraft({ ...blueprintDraft, title: event.target.value })} data-testid="paper-blueprint-title" /></label>
          <label>学科<input value={blueprintDraft.subject} onChange={(event) => setBlueprintDraft({ ...blueprintDraft, subject: event.target.value })} data-testid="paper-blueprint-subject" /></label>
          <label>年级<input value={blueprintDraft.grade} onChange={(event) => setBlueprintDraft({ ...blueprintDraft, grade: event.target.value })} data-testid="paper-blueprint-grade" /></label>
          <label>教材版本<input value={blueprintDraft.textbookVersion} onChange={(event) => setBlueprintDraft({ ...blueprintDraft, textbookVersion: event.target.value })} data-testid="paper-blueprint-textbook" /></label>
          <label>范围<input value={blueprintDraft.scope} onChange={(event) => setBlueprintDraft({ ...blueprintDraft, scope: event.target.value })} data-testid="paper-blueprint-scope" /></label>
          <label>考查用时（分钟）<input type="number" value={blueprintDraft.durationMinutes} onChange={(event) => setBlueprintDraft({ ...blueprintDraft, durationMinutes: event.target.value })} data-testid="paper-blueprint-duration" /></label>
          <label className="full">知识点（顿号或空格分隔）<input value={blueprintDraft.knowledgePoints} onChange={(event) => setBlueprintDraft({ ...blueprintDraft, knowledgePoints: event.target.value })} data-testid="paper-blueprint-knowledge-points" /></label>
          <label>来源偏好<select value={blueprintDraft.sourcePreference} onChange={(event) => setBlueprintDraft({ ...blueprintDraft, sourcePreference: event.target.value as PaperBlueprintInput['sourcePreference'] })} data-testid="paper-blueprint-source-preference"><option value="any">不限</option><option value="local_bank">仅本地题库</option><option value="teacher_resource">仅教师资源</option></select></label>
        </div>
        <div className="paper-type-specs" data-testid="paper-blueprint-type-specs">
          <p className="muted">题型配置（题量 × 每题分值 = 总分）</p>
          {typeSpecs.map((spec, index) => (
            <div className="toolbar-row" key={`type-spec-${index}`}>
              <input value={spec.questionType} onChange={(event) => setTypeSpecs((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, questionType: event.target.value } : entry))} placeholder="题型" data-testid={`paper-blueprint-type-${index}-type`} />
              <input type="number" value={spec.count} onChange={(event) => setTypeSpecs((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, count: event.target.value } : entry))} placeholder="题量" data-testid={`paper-blueprint-type-${index}-count`} />
              <input type="number" value={spec.pointsPerQuestion} onChange={(event) => setTypeSpecs((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, pointsPerQuestion: event.target.value } : entry))} placeholder="每题分值" data-testid={`paper-blueprint-type-${index}-points`} />
              <button className="secondary-action compact-button" onClick={() => setTypeSpecs((current) => current.filter((_, entryIndex) => entryIndex !== index))} data-testid={`paper-blueprint-type-${index}-remove`}>删除</button>
            </div>
          ))}
          <button className="secondary-action" onClick={() => setTypeSpecs((current) => [...current, { questionType: '', count: '1', pointsPerQuestion: '5' }])} data-testid="paper-blueprint-add-type">添加题型</button>
        </div>
        <div className="form-grid compact-form-grid">
          <label>易（%）<input type="number" value={difficultyMix.easy} onChange={(event) => setDifficultyMix({ ...difficultyMix, easy: event.target.value })} data-testid="paper-blueprint-mix-easy" /></label>
          <label>中（%）<input type="number" value={difficultyMix.medium} onChange={(event) => setDifficultyMix({ ...difficultyMix, medium: event.target.value })} data-testid="paper-blueprint-mix-medium" /></label>
          <label>难（%）<input type="number" value={difficultyMix.hard} onChange={(event) => setDifficultyMix({ ...difficultyMix, hard: event.target.value })} data-testid="paper-blueprint-mix-hard" /></label>
        </div>
        <div className="toolbar-row">
          <button className="primary-action" onClick={saveBlueprint} disabled={savingBlueprint} data-testid="paper-blueprint-save">{savingBlueprint ? '保存中…' : selectedBlueprint ? '保存蓝图修改' : '创建蓝图'}</button>
          {selectedBlueprint && selectedBlueprint.status === 'active' ? <button className="danger-action" onClick={archiveBlueprint} disabled={savingBlueprint} data-testid="paper-blueprint-archive">归档蓝图</button> : null}
        </div>
      </section>

      <section className="work-panel paper-papers-panel" data-testid="paper-papers-panel">
        <div className="panel-heading"><div><h3>试卷</h3><p className="muted">按蓝图从本地题库确定性召回；题目正文为快照，可编辑并记录教师修改。</p></div></div>
        <div className="toolbar-row">
          <button className="primary-action" onClick={createPaper} disabled={creatingPaper || !selectedBlueprint || selectedBlueprint.status !== 'active'} data-testid="paper-create">{creatingPaper ? '生成中…' : '按蓝图生成试卷'}</button>
          <button className="secondary-action" onClick={() => void loadPapers(selectedPaperId)} data-testid="paper-list-refresh">刷新试卷列表</button>
        </div>
        <div className="paper-list" data-testid="paper-list">
          {papers.map((paper) => (
            <button key={paper.id} className={paper.id === selectedPaperId ? 'active' : ''} onClick={() => { setSelectedPaperId(paper.id); setValidation(null); setExports({}); }} data-testid={`paper-card-${paper.id}`}>
              <strong>{paper.title}</strong>
              <span>{paper.items.length} 题 · {paper.totalPoints} 分 · v{paper.version}</span>
            </button>
          ))}
          {!loading && !papers.length ? <p className="empty-state" data-testid="paper-list-empty">还没有试卷，请选择蓝图后生成。</p> : null}
        </div>
      </section>

      {selectedPaper ? (
        <section className="work-panel span-2 paper-editor" data-testid="paper-editor">
          <div className="panel-heading">
            <div><h3>{selectedPaper.title}</h3><p className="muted">{sortedItems.length} 道题 · 总分 {selectedPaper.totalPoints} · v{selectedPaper.version}；锁定的题目不能被换题。</p></div>
            <div className="toolbar-row">
              <button className="secondary-action" onClick={runValidation} data-testid="paper-validate">校验试卷</button>
              <button className="primary-action" onClick={exportPaperArtifacts} disabled={exporting} data-testid="paper-export">{exporting ? '导出中…' : '导出试卷 / 答题纸 / 解析'}</button>
            </div>
          </div>
          {validation ? (
            <div className="paper-validation" data-testid="paper-validation-summary">
              <strong>{validation.ok ? '校验通过' : '校验未通过'}</strong>
              <span>题目 {validation.itemCount} 道 · 总分 {validation.totalPoints}{validation.expectedPoints ? ` / 蓝图 ${validation.expectedPoints}` : ''}</span>
              {validation.issues.length ? (
                <ul>
                  {validation.issues.map((issue) => (
                    <li key={issue.code} className={issue.level} data-testid={`paper-validation-issue-${issue.code}`}>{issue.level === 'error' ? '必须修复' : '提示'}：{issue.message}</li>
                  ))}
                </ul>
              ) : <p data-testid="paper-validation-clean">没有发现问题。</p>}
            </div>
          ) : null}
          {Object.keys(exports).length ? (
            <div className="paper-exports" data-testid="paper-export-result">
              {(['paper', 'answerSheet', 'analysis'] as const).map((key) => {
                const artifact = exports[key];
                const label = key === 'paper' ? '试卷' : key === 'answerSheet' ? '答题纸' : '解析';
                return (
                  <article key={key} data-testid={`paper-export-${key}`}>
                    <strong>{label}</strong>
                    <span>{artifact.status} · {artifact.fileName} · {artifact.fileSize} 字节</span>
                    <code>{artifact.contentHash.slice(0, 16)}…</code>
                  </article>
                );
              })}
            </div>
          ) : null}
          {!sortedItems.length ? <p className="empty-state" data-testid="paper-editor-empty">这份试卷还没有题目；请调整蓝图后重新生成，或在题库中补充题目。</p> : null}
          <div className="paper-item-list" data-testid="paper-item-list">
            {sortedItems.map((item, index) => (
              <article className="paper-item" key={item.id} data-testid={`paper-item-${item.id}`}>
                <header>
                  <span className="status-chip">{index + 1}</span>
                  <span className="status-chip" data-testid={`paper-item-${item.id}-type`}>{item.questionType || '未设题型'}</span>
                  <span className="status-chip" data-testid={`paper-item-${item.id}-source`}>{item.sourceKind}</span>
                  <span className="status-chip" data-testid={`paper-item-${item.id}-difficulty`}>{item.difficulty}</span>
                  {item.teacherEdited ? <span className="status-chip" data-testid={`paper-item-${item.id}-edited`}>教师已修改</span> : null}
                  {item.locked ? <span className="status-chip" data-testid={`paper-item-${item.id}-locked`}>已锁定</span> : null}
                  <span className="muted" data-testid={`paper-item-${item.id}-knowledge`}>{item.knowledgePoint || '未标注知识点'}</span>
                </header>
                <label>题干<textarea value={item.stem} onChange={(event) => setPapers((current) => current.map((paper) => paper.id === selectedPaper.id ? { ...paper, items: paper.items.map((entry) => entry.id === item.id ? { ...entry, stem: event.target.value } : entry) } : paper))} data-testid={`paper-item-${item.id}-stem`} /></label>
                <label>答案<textarea value={item.answer} onChange={(event) => setPapers((current) => current.map((paper) => paper.id === selectedPaper.id ? { ...paper, items: paper.items.map((entry) => entry.id === item.id ? { ...entry, answer: event.target.value } : entry) } : paper))} data-testid={`paper-item-${item.id}-answer`} /></label>
                <label>解析<textarea value={item.analysis} onChange={(event) => setPapers((current) => current.map((paper) => paper.id === selectedPaper.id ? { ...paper, items: paper.items.map((entry) => entry.id === item.id ? { ...entry, analysis: event.target.value } : entry) } : paper))} data-testid={`paper-item-${item.id}-analysis`} /></label>
                <div className="toolbar-row">
                  <label>分值<input type="number" value={item.points} onChange={(event) => setPapers((current) => current.map((paper) => paper.id === selectedPaper.id ? { ...paper, items: paper.items.map((entry) => entry.id === item.id ? { ...entry, points: Number(event.target.value) || 0 } : entry) } : paper))} data-testid={`paper-item-${item.id}-points`} /></label>
                  <button className="primary-action compact-button" onClick={() => void savePaperItem(item, { stem: item.stem, answer: item.answer, analysis: item.analysis, points: item.points })} disabled={busyItemId === item.id} data-testid={`paper-item-${item.id}-save`}>保存本题</button>
                  <button className="secondary-action compact-button" onClick={() => void savePaperItem(item, { locked: !item.locked })} disabled={busyItemId === item.id} data-testid={`paper-item-${item.id}-lock`}>{item.locked ? '解锁' : '锁定'}</button>
                  <button className="secondary-action compact-button" onClick={() => void movePaperItem(item, -1)} disabled={index === 0 || busyItemId === item.id} data-testid={`paper-item-${item.id}-up`}>上移</button>
                  <button className="secondary-action compact-button" onClick={() => void movePaperItem(item, 1)} disabled={index === sortedItems.length - 1 || busyItemId === item.id} data-testid={`paper-item-${item.id}-down`}>下移</button>
                </div>
                <div className="toolbar-row">
                  <input value={replaceQuery[item.id] ?? ''} onChange={(event) => setReplaceQuery((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="检索替换题（本地题库）" data-testid={`paper-item-${item.id}-replace-query`} />
                  <button className="secondary-action compact-button" onClick={() => void searchReplaceCandidates(item)} disabled={busyItemId === item.id || item.locked} data-testid={`paper-item-${item.id}-replace-search`}>检索</button>
                </div>
                {(replaceCandidates[item.id] ?? []).length ? (
                  <div className="paper-replace-candidates" data-testid={`paper-item-${item.id}-replace-candidates`}>
                    {(replaceCandidates[item.id] ?? []).map((candidate) => (
                      <div className="toolbar-row" key={candidate.id}>
                        <span className="status-chip">{candidate.sourceKind}</span>
                        <span>{candidate.stem.slice(0, 60)}</span>
                        <button className="secondary-action compact-button" onClick={() => void applyReplace(item, candidate.id)} data-testid={`paper-item-${item.id}-replace-apply-${candidate.id}`}>替换</button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
