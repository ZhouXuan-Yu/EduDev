import { useEffect, useMemo, useState } from 'react';
import type {
  AiConfirmationExerciseSetEdit,
  AiConfirmationItem,
  AiConsoleRunResult,
  AttachmentImportResult,
  ErrorCategory,
  ErrorTaxonomyResult,
  LearningRecord,
  MistakeImageAnalysis,
  QuestionBankItem,
  Student,
} from '../../shared/contracts';
import { ExerciseSetLibrary } from './ExerciseSetLibrary';

type MistakesWorkspaceProps = {
  activeStudent?: Student;
  records: LearningRecord[];
  attachmentImport: AttachmentImportResult | null;
  aiResult: AiConsoleRunResult | null;
  aiRunning: boolean;
  confirmations: AiConfirmationItem[];
  onImportAttachment: (recordId: string) => Promise<void>;
  onSendAi: (prompt: string) => Promise<void>;
  onConfirm: (item: AiConfirmationItem, exerciseSetEdit?: AiConfirmationExerciseSetEdit) => Promise<void>;
  onReject: (item: AiConfirmationItem) => Promise<void>;
  onProposed?: () => void;
  setStatus: (message: string) => void;
};

type AnalysisDraft = {
  text: string;
  sanitizedText: string;
  redactions: string[];
};

export function MistakesWorkspace({
  activeStudent,
  records,
  attachmentImport,
  aiResult,
  aiRunning,
  confirmations,
  onImportAttachment,
  onSendAi,
  onConfirm,
  onReject,
  onProposed,
  setStatus,
}: MistakesWorkspaceProps) {
  const [analyses, setAnalyses] = useState<MistakeImageAnalysis[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [draft, setDraft] = useState<AnalysisDraft>({ text: '', sanitizedText: '', redactions: [] });
  const [loading, setLoading] = useState(false);
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [confirmingTriplet, setConfirmingTriplet] = useState(false);
  const [similarResults, setSimilarResults] = useState<QuestionBankItem[]>([]);
  const [selectedSimilarIds, setSelectedSimilarIds] = useState<string[]>([]);
  const [searchingSimilar, setSearchingSimilar] = useState(false);
  const [proposingSet, setProposingSet] = useState(false);
  const [similarError, setSimilarError] = useState('');
  const [searchedSimilar, setSearchedSimilar] = useState(false);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [errorAnalysis, setErrorAnalysis] = useState<ErrorTaxonomyResult | null>(null);
  const [errorRange, setErrorRange] = useState({ start: '', end: '' });
  const [errorSubject, setErrorSubject] = useState('');
  const [analyzingError, setAnalyzingError] = useState(false);
  const [errorTaxonomyError, setErrorTaxonomyError] = useState('');
  const [reviewEdits, setReviewEdits] = useState<Record<string, { category: ErrorCategory; note: string; include: boolean }>>({});
  const [proposingReview, setProposingReview] = useState(false);
  const [tripletDraft, setTripletDraft] = useState<Array<{ role: string; stem: string; answer: string; sourceKind: 'local_bank' | 'teacher_resource' | 'generated' }>>([]);

  const mistakeRecords = useMemo(() => records.filter((record) => record.recordType === 'mistake'), [records]);
  const selectedAnalysis = analyses.find((item) => item.id === selectedAnalysisId) ?? analyses[0];
  const tripletConfirmation = confirmations.find((item) => item.actionType === 'save_exercise_set' && item.status === 'pending');

  useEffect(() => {
    let cancelled = false;
    if (!activeStudent) {
      setAnalyses([]);
      return undefined;
    }
    setLoading(true);
    window.omniEdu?.listMistakeImageAnalyses(activeStudent.id)
      .then((items) => {
        if (cancelled) return;
        setAnalyses(items ?? []);
        setSelectedAnalysisId((current) => current || items?.[0]?.id || '');
      })
      .catch(() => !cancelled && setStatus('读取错题 OCR 状态失败，请重试。'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [activeStudent?.id, setStatus]);

  useEffect(() => {
    if (!selectedAnalysis) {
      setDraft({ text: '', sanitizedText: '', redactions: [] });
      return;
    }
    setDraft({
      text: selectedAnalysis.teacherCorrectedText || selectedAnalysis.extractedText,
      sanitizedText: selectedAnalysis.sanitizedText,
      redactions: selectedAnalysis.redactions.map((item) => `${item.kind}:${item.count}`),
    });
  }, [selectedAnalysis?.id, selectedAnalysis?.updatedAt]);

  useEffect(() => {
    const items = aiResult?.similarQuestions?.slice(0, 3).map((item, index) => ({
      role: index === 0 ? '原题（来源）' : index === 1 ? '相似题（本地命中）' : '变式题（待教师复核）',
      stem: item.stem,
      answer: item.answer,
      sourceKind: item.sourceKind,
    })) ?? (tripletConfirmation?.payload.exerciseSet?.items?.slice(0, 3).map((item) => ({
      role: item.role === 'original' ? '原题（来源）' : item.role === 'similar' ? '相似题（本地命中）' : '变式题（待教师复核）',
      stem: item.stem,
      answer: item.answer,
      sourceKind: item.sourceKind,
    })) ?? []);
    setTripletDraft(items);
  }, [aiResult?.harness?.agentRunId, aiResult?.similarQuestions, tripletConfirmation?.id]);

  async function createNeedsOcr(record: LearningRecord, attachment: LearningRecord['attachments'][number]) {
    if (!activeStudent) return;
    setLoading(true);
    try {
      const analysis = await window.omniEdu?.createMistakeImageAnalysis({
        studentId: activeStudent.id,
        recordId: record.id,
        attachmentId: attachment.id,
        localPath: attachment.filePath,
      });
      if (analysis) {
        setAnalyses((current) => [analysis, ...current.filter((item) => item.id !== analysis.id)]);
        setSelectedAnalysisId(analysis.id);
        setStatus('已建立 needs_ocr 任务；当前未伪造 OCR 文本，请教师粘贴或校正识别结果。');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '建立 OCR 任务失败。');
    } finally {
      setLoading(false);
    }
  }

  async function previewSanitized() {
    if (!activeStudent || !draft.text.trim()) {
      setStatus('请先输入或校正题目文本。');
      return;
    }
    setLoading(true);
    try {
      const result = await window.omniEdu?.sanitizeProblemText(draft.text, activeStudent.id);
      if (result) {
        setDraft({
          ...draft,
          sanitizedText: result.sanitizedText,
          redactions: result.redactions.map((item) => `${item.kind}:${item.count}`),
        });
        setStatus(result.containsSensitiveData ? '已生成脱敏预览；原始文本仍只保留在本地。' : '已生成脱敏预览，未发现需替换的敏感字段。');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '脱敏预览失败。');
    } finally {
      setLoading(false);
    }
  }

  async function saveCorrection() {
    if (!selectedAnalysis || !draft.text.trim()) {
      setStatus('没有可保存的校正文本。');
      return;
    }
    setSavingCorrection(true);
    try {
      const saved = await window.omniEdu?.updateMistakeImageCorrection(selectedAnalysis.id, { extractedText: draft.text });
      if (saved) {
        setAnalyses((current) => current.map((item) => item.id === saved.id ? saved : item));
        setDraft({ text: saved.teacherCorrectedText || saved.extractedText, sanitizedText: saved.sanitizedText, redactions: saved.redactions.map((item) => `${item.kind}:${item.count}`) });
        setStatus('教师校正已保存，并已重新生成脱敏文本。');
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存教师校正失败。');
    } finally {
      setSavingCorrection(false);
    }
  }

  async function sendForAnalysis() {
    const text = draft.sanitizedText || draft.text;
    if (!activeStudent || !text.trim()) {
      setStatus('请先准备题目文本并生成脱敏预览。');
      return;
    }
    await onSendAi(`请分析当前学生的错题，并基于以下脱敏题目文本检索本地相似题，生成原题、相似题、变式题三元题组草稿。只使用可验证来源，保留 generated/source 标记，不要自动保存。\n\n学生：${activeStudent.displayName}\n脱敏题目：\n${text}`);
  }

  async function confirmTripletWithEdits(item: AiConfirmationItem) {
    if (confirmingTriplet) return;
    const originalItems = item.payload.exerciseSet?.items ?? [];
    const edits: AiConfirmationExerciseSetEdit = {
      items: originalItems.map((original, index) => ({
        stem: tripletDraft[index]?.stem ?? original.stem,
        answer: tripletDraft[index]?.answer ?? original.answer,
      })),
    };
    setConfirmingTriplet(true);
    try {
      await onConfirm(item, edits.items.length ? edits : undefined);
    } finally {
      setConfirmingTriplet(false);
    }
  }

  async function searchSimilarQuestions() {
    if (!draft.text.trim()) {
      setStatus('请先输入或校正题目文本，再检索本地相似题。');
      return;
    }
    setSearchingSimilar(true);
    setSimilarError('');
    try {
      const results = await window.omniEdu?.searchQuestionBank({ query: draft.text.trim(), limit: 8 }) ?? [];
      setSimilarResults(results);
      setSelectedSimilarIds([]);
      setSearchedSimilar(true);
      if (results.length) setStatus(`本地题库命中 ${results.length} 道相似题，可选择后生成题组草稿。`);
      else setStatus('本地题库没有命中相似题。');
    } catch (error) {
      setSimilarError(error instanceof Error ? error.message : '相似题检索失败。');
    } finally {
      setSearchingSimilar(false);
    }
  }

  function toggleSimilarSelection(questionId: string) {
    setSelectedSimilarIds((current) => {
      if (current.includes(questionId)) return current.filter((id) => id !== questionId);
      if (current.length >= 6) return current;
      return [...current, questionId];
    });
  }

  async function proposeFromSelected() {
    if (!activeStudent || !draft.text.trim() || selectedSimilarIds.length === 0) return;
    setProposingSet(true);
    setSimilarError('');
    try {
      const confirmation = await window.omniEdu?.proposeExerciseSetFromQuestions({
        studentId: activeStudent.id,
        title: `${activeStudent.displayName} 针对性练习`,
        originalStem: draft.text.trim(),
        originalAnswer: '',
        sourceQuestionIds: selectedSimilarIds,
      });
      if (confirmation) {
        setSelectedSimilarIds([]);
        setSimilarResults([]);
        setSearchedSimilar(false);
        onProposed?.();
        setStatus('已生成题组草稿；请在待确认区核对并确认写入。');
      }
    } catch (error) {
      setSimilarError(error instanceof Error ? error.message : '生成题组草稿失败。');
    } finally {
      setProposingSet(false);
    }
  }

  async function runOcr(analysisId: string) {
    if (ocrRunning) return;
    setOcrRunning(true);
    setOcrError('');
    try {
      const updated = await window.omniEdu?.runMistakeImageOcr(analysisId);
      if (updated) {
        setAnalyses((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        setDraft((current) => ({ ...current, text: updated.teacherCorrectedText || updated.extractedText }));
        setStatus(updated.ocrStatus === 'ocr_done'
          ? `OCR 完成（最低置信度 ${Math.round((updated.ocrConfidence ?? 0) * 100)}%）；请教师核对并修正识别文本。`
          : `OCR 结束：${updated.ocrStatus}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OCR 识别失败。';
      setOcrError(message);
      setStatus(message);
      void window.omniEdu?.listMistakeImageAnalyses(activeStudent?.id ?? '').then((items) => items && setAnalyses(items));
    } finally {
      setOcrRunning(false);
    }
  }

  async function analyzeErrorPatterns() {
    if (!activeStudent) {
      setStatus('请先选择学生后再分析错因。');
      return;
    }
    setAnalyzingError(true);
    setErrorTaxonomyError('');
    try {
      const result = await window.omniEdu?.analyzeStudentErrorPatterns(activeStudent.id, {
        startDate: errorRange.start || undefined,
        endDate: errorRange.end || undefined,
        subject: errorSubject.trim() || undefined,
      });
      setErrorAnalysis(result ?? null);
      if (result) {
        const total = Object.values(result.analysis.counts).reduce((sum, count) => sum + count, 0);
        setStatus(total
          ? `错因分析完成：${total} 条证据已分类，其中 ${result.analysis.classifications.filter((item) => item.needsTeacherReview).length} 条需要教师复核。`
          : '当前时间范围内没有可分类的错题证据，结果保持 unknown。');
      }
    } catch (error) {
      setErrorTaxonomyError(error instanceof Error ? error.message : '错因分析失败。');
    } finally {
      setAnalyzingError(false);
    }
  }

  const pendingTriplet = tripletConfirmation;
  const pendingErrorReview = confirmations.find(
    (item) => item.actionType === 'save_error_review' && item.status === 'pending' && item.studentId === activeStudent?.id,
  );

  useEffect(() => {
    if (!errorAnalysis) {
      setReviewEdits({});
      return;
    }
    setReviewEdits((current) => {
      const next: Record<string, { category: ErrorCategory; note: string; include: boolean }> = {};
      for (const classification of errorAnalysis.analysis.classifications) {
        next[classification.recordId] = current[classification.recordId] ?? { category: classification.category, note: '', include: true };
      }
      return next;
    });
  }, [errorAnalysis]);

  async function submitErrorReview() {
    if (!errorAnalysis || !activeStudent) {
      setStatus('请先运行错因分析并选择学生。');
      return;
    }
    const items = errorAnalysis.analysis.classifications
      .filter((classification) => reviewEdits[classification.recordId]?.include !== false)
      .map((classification) => ({
        recordId: classification.recordId,
        category: reviewEdits[classification.recordId]?.category ?? classification.category,
        note: reviewEdits[classification.recordId]?.note ?? '',
      }));
    if (!items.length) {
      setErrorTaxonomyError('请至少勾选一条要保存的错因条目。');
      return;
    }
    setProposingReview(true);
    setErrorTaxonomyError('');
    try {
      const confirmation = await window.omniEdu?.proposeErrorReview({
        studentId: activeStudent.id,
        startDate: errorAnalysis.analysis.window.startDate,
        endDate: errorAnalysis.analysis.window.endDate,
        subject: errorAnalysis.analysis.window.subject || undefined,
        items,
      });
      if (confirmation) {
        onProposed?.();
        setStatus(`已生成错因复核确认项（${items.length} 条）；确认后才会写入学习记录。`);
      }
    } catch (error) {
      setErrorTaxonomyError(error instanceof Error ? error.message : '提交错因复核失败。');
    } finally {
      setProposingReview(false);
    }
  }  return (
    <div className="page-grid mistakes-workspace" data-testid="mistakes-workspace">
      <section className="work-panel span-2">
        <div className="panel-heading">
          <div>
            <h2>错题资产工作区</h2>
            <p className="muted">导入 → needs_ocr → 教师校正 → 脱敏预览 → 小智分析；每一步都显示真实状态。</p>
          </div>
          <span className="status-chip" data-testid="mistakes-student-state">{activeStudent ? `当前学生：${activeStudent.displayName}` : '请先选择学生'}</span>
        </div>
        {!activeStudent ? <div data-testid="mistakes-empty-student"><p>请选择学生后开始处理错题。</p></div> : null}
        <div className="pipeline-list" data-testid="mistakes-pipeline">
          {[
            ['错题图片导入', attachmentImport?.status === 'succeeded' ? '已完成' : '可操作'],
            ['OCR 状态', analyses.some((item) => item.ocrStatus === 'needs_ocr') ? 'needs_ocr' : analyses.length ? '已有记录' : '等待图片'],
            ['教师校正', selectedAnalysis?.ocrStatus === 'teacher_corrected' ? '已校正' : '可编辑'],
            ['脱敏预览', draft.sanitizedText ? '已生成' : '未生成'],
            ['小智分析', aiRunning ? '运行中' : aiResult?.ok ? '已返回' : '待发送'],
            ['三元题组', pendingTriplet ? '待教师确认' : tripletDraft.length ? '可编辑预览' : '等待召回'],
          ].map(([label, state], index) => (
            <article key={label} data-testid={`mistakes-pipeline-${index + 1}`}><span>{String(index + 1).padStart(2, '0')}</span><strong>{label}</strong><span className="status-chip">{state}</span></article>
          ))}
        </div>
      </section>

      <section className="work-panel" data-testid="mistake-image-import-panel">
        <div className="panel-heading"><div><h3>1. 导入错题图片</h3><p className="muted">原始图片只复制到本地数据目录，不上传模型。</p></div></div>
        {attachmentImport?.status === 'copying' ? <p data-testid="mistake-attachment-import-loading">正在复制附件到学生本地目录…</p> : null}
        {attachmentImport?.status === 'canceled' ? <div className="warning-box" data-testid="mistake-attachment-import-canceled">已取消附件选择，没有写入任何附件。</div> : null}
        {attachmentImport?.status === 'succeeded' ? <div className="success-box" data-testid="mistake-attachment-import-success">已复制 {attachmentImport.items.filter((item) => item.ok).length} 个附件到本地学生档案。</div> : null}
        {attachmentImport?.status === 'partial' || attachmentImport?.status === 'failed' ? <div className="warning-box" data-testid="mistake-attachment-import-failed">{attachmentImport.items.filter((item) => !item.ok).map((item) => `${item.fileName}：${item.errorMessage ?? '复制失败'}`).join('；') || '附件导入失败，请重试。'}</div> : null}
        {!mistakeRecords.length ? <p data-testid="mistake-image-empty">当前学生没有错题记录，请先在录入页创建错题记录。</p> : null}
        {mistakeRecords.map((record) => (
          <article className="evidence-row" key={record.id} data-testid={`mistake-record-${record.id}`}>
            <div><strong>{record.title}</strong><span>{record.attachments.length} 个附件</span></div>
            <div className="toolbar-row">
              <button className="secondary-action compact-button" onClick={() => void onImportAttachment(record.id)} disabled={!activeStudent || loading || attachmentImport?.status === 'copying'} data-testid={`mistake-import-${record.id}`}>导入附件</button>
              {record.attachments.filter((attachment) => attachment.fileType === 'image').map((attachment) => (
                <button className="link-button" key={attachment.id} onClick={() => createNeedsOcr(record, attachment)} disabled={loading} data-testid={`create-ocr-${attachment.id}`}>建立 OCR 任务</button>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="work-panel" data-testid="mistake-ocr-panel">
        <div className="panel-heading"><div><h3>2. OCR / 教师校正</h3><p className="muted">本地 RapidOCR 识别；没有真实 OCR 结果时保持 needs_ocr，不编造识别文本。</p></div></div>
        {loading ? <p data-testid="mistake-loading">正在读取或保存错题状态…</p> : null}
        {!analyses.length ? <p data-testid="mistake-ocr-empty">暂无 OCR 任务。</p> : (
          <>
            <label>分析记录<select value={selectedAnalysis?.id ?? ''} onChange={(event) => setSelectedAnalysisId(event.target.value)} data-testid="mistake-analysis-select">{analyses.map((item) => <option key={item.id} value={item.id}>{item.ocrStatus} · {item.id.slice(-8)}</option>)}</select></label>
            {selectedAnalysis?.ocrStatus === 'needs_ocr' ? (
              <div className="toolbar-row">
                <button className="primary-action" onClick={() => void runOcr(selectedAnalysis.id)} disabled={ocrRunning} data-testid="mistake-ocr-run">{ocrRunning ? '识别中…' : '本地 OCR 识别'}</button>
                {ocrRunning ? <span className="status-chip" data-testid="mistake-ocr-progress">RapidOCR 识别中，请稍候…</span> : null}
              </div>
            ) : null}
            {ocrError ? <div className="warning-box" data-testid="mistake-ocr-error">{ocrError}</div> : null}
            {selectedAnalysis?.ocrStatus === 'ocr_done' ? <div className="info-box" data-testid="mistake-ocr-done">OCR 已完成（最低置信度 {Math.round((selectedAnalysis.ocrConfidence ?? 0) * 100)}%）；低置信度内容请教师重点核对。</div> : null}
            <label>教师校正文本<textarea value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} placeholder="粘贴 OCR 结果或手动输入题干" data-testid="mistake-correction-input" /></label>
            <div className="toolbar-row"><button className="secondary-action" onClick={previewSanitized} disabled={loading || !draft.text.trim()} data-testid="mistake-sanitize-button">生成脱敏预览</button><button className="primary-action" onClick={saveCorrection} disabled={savingCorrection || !draft.text.trim()} data-testid="mistake-save-correction">{savingCorrection ? '保存中…' : '保存教师校正'}</button></div>
          </>
        )}
      </section>

      <section className="work-panel span-2" data-testid="mistake-sanitized-panel">
        <div className="panel-heading"><div><h3>3. 脱敏预览与小智分析</h3><p className="muted">发送给小智的内容只使用脱敏文本，保留来源和未知项。</p></div><button className="primary-action" onClick={sendForAnalysis} disabled={aiRunning || !draft.sanitizedText} data-testid="mistake-send-ai">{aiRunning ? '小智分析中…' : '发送小智分析'}</button></div>
        <div className="preview-grid"><article><h4>脱敏文本</h4><pre data-testid="mistake-sanitized-text">{draft.sanitizedText || '尚未生成脱敏预览。'}</pre></article><article><h4>替换记录</h4><p data-testid="mistake-redactions">{draft.redactions.length ? draft.redactions.join('、') : '未发现敏感字段。'}</p></article></div>
        {aiResult && !aiResult.ok ? <div className="warning-box" data-testid="mistake-ai-failed">{aiResult.errorMessage || '小智分析失败；未生成题组。'}</div> : null}
        {aiResult?.ok ? <div className="success-box" data-testid="mistake-ai-success">小智已返回结构化结果；相似题来源会显示为本地命中或 generated。</div> : null}
      </section>

      <section className="work-panel span-2" data-testid="mistake-triplet-panel">
        <div className="panel-heading"><div><h3>4. 三元题组预览</h3><p className="muted">编辑题干与答案将随确认写入题组；来源与题型保持原始确认预览，不可修改。</p></div></div>
        {pendingTriplet ? <div className="info-box" data-testid="mistake-triplet-edit-boundary">确认时将以当前编辑后的题干与答案写入题组；来源与题型保持原始确认预览，不可修改。</div> : null}
        {!tripletDraft.length ? <p data-testid="mistake-triplet-empty">暂无题组草稿。完成脱敏后发送小智分析。</p> : tripletDraft.map((item, index) => (
          <article className="triplet-item" key={`${item.role}-${index}`} data-testid={`mistake-triplet-item-${index}`}>
            <span className="status-chip">{item.role}</span><span className="status-chip" data-testid={`mistake-triplet-source-${index}`}>{item.sourceKind}</span>
            <label>题干<textarea value={item.stem} onChange={(event) => setTripletDraft((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, stem: event.target.value } : entry))} data-testid={`mistake-triplet-stem-${index}`} /></label>
            <label>答案<textarea value={item.answer} onChange={(event) => setTripletDraft((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, answer: event.target.value } : entry))} data-testid={`mistake-triplet-answer-${index}`} /></label>
          </article>
        ))}
        <div className="similar-recall-panel" data-testid="mistake-similar-panel">
          <div className="toolbar-row">
            <button className="secondary-action" onClick={searchSimilarQuestions} disabled={searchingSimilar || !draft.text.trim()} data-testid="mistake-similar-search">{searchingSimilar ? '检索中…' : '检索本地相似题'}</button>
            <button className="primary-action" onClick={proposeFromSelected} disabled={proposingSet || !selectedSimilarIds.length || !activeStudent} data-testid="mistake-similar-propose">{proposingSet ? '生成草稿中…' : `生成题组草稿${selectedSimilarIds.length ? `（已选 ${selectedSimilarIds.length}）` : ''}`}</button>
          </div>
          {similarError ? <div className="warning-box" data-testid="mistake-similar-error">{similarError}</div> : null}
          {searchedSimilar && !similarResults.length ? <p data-testid="mistake-similar-empty">本地题库没有命中相似题；可先在题库页录入，或改用小智生成。</p> : null}
          {similarResults.length ? (
            <div className="similar-results-list" data-testid="mistake-similar-results">
              {similarResults.map((question) => (
                <label key={question.id} className="similar-result-row" data-testid={`mistake-similar-item-${question.id}`}>
                  <input type="checkbox" checked={selectedSimilarIds.includes(question.id)} onChange={() => toggleSimilarSelection(question.id)} disabled={!selectedSimilarIds.includes(question.id) && selectedSimilarIds.length >= 6} data-testid={`mistake-similar-select-${question.id}`} />
                  <div>
                    <span className="status-chip" data-testid={`mistake-similar-source-${question.id}`}>{question.sourceKind}</span>
                    <strong>{question.stem}</strong>
                    <p>{question.answer}{question.knowledgePoint ? `｜${question.knowledgePoint}` : ''}{question.difficulty ? `｜难度：${question.difficulty}` : ''}</p>
                  </div>
                </label>
              ))}
            </div>
          ) : null}
        </div>
        {pendingTriplet ? <div className="confirmation-inline" data-testid="mistake-triplet-confirmation"><strong>待教师确认：{pendingTriplet.title}</strong><div className="toolbar-row"><button className="primary-action" onClick={() => confirmTripletWithEdits(pendingTriplet)} disabled={confirmingTriplet} data-testid="mistake-triplet-confirm">{confirmingTriplet ? '确认写入中…' : '确认并写入'}</button><button className="secondary-action" onClick={() => onReject(pendingTriplet)} disabled={confirmingTriplet} data-testid="mistake-triplet-reject">拒绝（零写入）</button></div></div> : null}
      </section>

      <section className="work-panel span-2" data-testid="exercise-set-library">
        <div className="panel-heading">
          <div>
            <h3>5. 已确认题组</h3>
            <p className="muted">只读展示当前学生已由教师确认并写入 SQLite 的题组；generated 来源始终明确标识。</p>
          </div>
        </div>
        <div className="warning-box" data-testid="exercise-set-readonly-boundary">这里是正式题组回读，不提供隐式编辑。需要修改时应重新生成草稿并再次经过教师确认。</div>
        <ExerciseSetLibrary activeStudent={activeStudent} setStatus={setStatus} />
      </section>

      <section className="work-panel span-2" data-testid="mistake-error-taxonomy-panel">
        <div className="panel-heading">
          <div>
            <h3>6. 错因分类建议（只读草稿）</h3>
            <p className="muted">复用 DeepTutor 四类 taxonomy（structural / deviation / application / metacognitive）；证据不足一律记为 unknown，不自动写入学生档案。</p>
          </div>
        </div>
        <div className="toolbar-row">
          <label>开始日期<input type="date" value={errorRange.start} onChange={(event) => setErrorRange({ ...errorRange, start: event.target.value })} data-testid="error-taxonomy-start" /></label>
          <label>结束日期<input type="date" value={errorRange.end} onChange={(event) => setErrorRange({ ...errorRange, end: event.target.value })} data-testid="error-taxonomy-end" /></label>
          <label>学科<input value={errorSubject} onChange={(event) => setErrorSubject(event.target.value)} placeholder="全部" data-testid="error-taxonomy-subject" /></label>
          <button className="primary-action" onClick={() => void analyzeErrorPatterns()} disabled={analyzingError || !activeStudent} data-testid="error-taxonomy-run">{analyzingError ? '分析中…' : '分析错因'}</button>
        </div>
        {!activeStudent ? <p className="empty-state" data-testid="error-taxonomy-no-student">请先选择学生。</p> : null}
        {errorTaxonomyError ? <div className="warning-box" data-testid="error-taxonomy-error">{errorTaxonomyError}</div> : null}
        {errorAnalysis ? (
          <>
            <div className="error-taxonomy-counts" data-testid="error-taxonomy-counts">
              {(['structural', 'deviation', 'application', 'metacognitive', 'unknown'] as const).map((category) => (
                <span key={category} className="status-chip" data-testid={`error-taxonomy-count-${category}`}>{category}：{errorAnalysis.analysis.counts[category] ?? 0}</span>
              ))}
            </div>
            <p className="muted" data-testid="error-taxonomy-window">
              时间范围 {errorAnalysis.analysis.window.startDate} 至 {errorAnalysis.analysis.window.endDate}（UTC 日历）｜纳入 {errorAnalysis.analysis.evidence.includedRecordCount} 条证据
            </p>
            <div className="error-taxonomy-records" data-testid="error-taxonomy-classifications">
              {errorAnalysis.analysis.classifications.map((item) => (
                <article key={item.recordId} data-testid={`error-taxonomy-item-${item.recordId}`}>
                  <span className="status-chip">{item.confidence}</span>
                  <span>{item.evidence.join('；') || '无可用证据'}</span>
                  {item.needsTeacherReview ? <span className="status-chip" data-testid={`error-taxonomy-review-${item.recordId}`}>需教师复核</span> : null}
                  <div className="toolbar-row">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={reviewEdits[item.recordId]?.include !== false}
                        onChange={(event) => setReviewEdits((current) => ({ ...current, [item.recordId]: { category: current[item.recordId]?.category ?? item.category, note: current[item.recordId]?.note ?? '', include: event.target.checked } }))}
                        data-testid={`error-taxonomy-include-${item.recordId}`}
                      />
                      纳入保存
                    </label>
                    <label>教师修正分类
                      <select
                        value={reviewEdits[item.recordId]?.category ?? item.category}
                        onChange={(event) => setReviewEdits((current) => ({ ...current, [item.recordId]: { category: event.target.value as ErrorCategory, note: current[item.recordId]?.note ?? '', include: current[item.recordId]?.include !== false } }))}
                        data-testid={`error-taxonomy-category-${item.recordId}`}
                      >
                        {(['structural', 'deviation', 'application', 'metacognitive', 'unknown'] as const).map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <label>教师备注
                      <input
                        value={reviewEdits[item.recordId]?.note ?? ''}
                        onChange={(event) => setReviewEdits((current) => ({ ...current, [item.recordId]: { category: current[item.recordId]?.category ?? item.category, note: event.target.value, include: current[item.recordId]?.include !== false } }))}
                        placeholder="可选：写给自己的复核说明"
                        data-testid={`error-taxonomy-note-${item.recordId}`}
                      />
                    </label>
                  </div>
                </article>
              ))}
              {!errorAnalysis.analysis.classifications.length ? <p data-testid="error-taxonomy-empty">时间范围内没有可分类的错题/订正记录；结果保持 unknown。</p> : null}
            </div>
            {errorAnalysis.analysis.unknowns.length ? (
              <div className="info-box" data-testid="error-taxonomy-unknowns">{errorAnalysis.analysis.unknowns.join('；')}</div>
            ) : null}
            <div className="warning-box" data-testid="error-taxonomy-boundary">以上是只读建议草稿：错因是带证据的推断而不是学生标签。只有教师确认后，才会以「错因复核」学习记录写入本地数据库。</div>
            {errorAnalysis.analysis.classifications.length ? (
              <div className="toolbar-row">
                <button className="primary-action" onClick={() => void submitErrorReview()} disabled={proposingReview} data-testid="error-taxonomy-submit">{proposingReview ? '提交中…' : '提交保存（需教师确认）'}</button>
              </div>
            ) : null}
            {pendingErrorReview ? (
              <div className="confirmation-inline" data-testid="error-review-confirmation">
                <strong>待教师确认：{pendingErrorReview.title}</strong>
                <p className="muted">确认后会把 {pendingErrorReview.payload.errorReview?.items.length ?? 0} 条错因复核写入该学生的学习记录。</p>
                <div className="toolbar-row">
                  <button className="primary-action" onClick={() => void onConfirm(pendingErrorReview)} data-testid="error-review-confirm">确认写入</button>
                  <button className="secondary-action" onClick={() => void onReject(pendingErrorReview)} data-testid="error-review-reject">拒绝（零写入）</button>
                </div>
              </div>
            ) : null}
            <details data-testid="error-taxonomy-markdown-panel">
              <summary>教师可读文本（只读）</summary>
              <pre data-testid="error-taxonomy-markdown">{errorAnalysis.markdown}</pre>
            </details>
          </>
        ) : null}
      </section>
    </div>
  );
}
