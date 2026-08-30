import { BarChart3, CheckCircle2, Database, ListChecks, LoaderCircle, MessageSquare, RefreshCw, ShieldCheck, TriangleAlert, UploadCloud } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type {
  AiIntentRoute,
  AiModelGrade,
  AiModelGradeSummary,
  AiSubIntent,
  AiUsabilityHumanReview,
  AiUsabilityHumanReviewInput,
  AiUsabilityHumanReviewSummary,
  AiUsabilityReplayExperiment,
  AiUsabilityReplaySummary,
} from '../../shared/contracts';

const routeOptions: AiIntentRoute[] = ['general_qa', 'student_diagnosis', 'error_analysis', 'practice_design', 'lesson_design', 'report_draft', 'knowledge_retrieval', 'workspace_help'];
const subIntentOptions: AiSubIntent[] = ['casual_greeting', 'capability_intro', 'concept_explanation', 'student_progress', 'student_weakness', 'student_profile_review', 'risk_support', 'mistake_reasoning', 'error_pattern_summary', 'correction_guidance', 'triplet_practice', 'similar_questions', 'homework_plan', 'lesson_plan', 'teaching_sequence', 'classroom_activity', 'parent_summary', 'monthly_report', 'weekly_report', 'export_document', 'resource_search', 'source_citation', 'knowledge_graph_lookup', 'usage_help', 'settings_help', 'data_management_help', 'safety_boundary'];
const routeLabels: Record<AiIntentRoute, string> = { general_qa: '普通问答', student_diagnosis: '学生诊断', error_analysis: '错因分析', practice_design: '练习设计', lesson_design: '备课设计', report_draft: '报告草稿', knowledge_retrieval: '知识检索', workspace_help: '工作台帮助' };

const emptyHumanSummary: AiUsabilityHumanReviewSummary = { sampleCount: 0, averageTeacherScore: 0, minTeacherScore: 0, passedCount: 0, needsRewriteCount: 0, averageRoundsToUseful: 0, routeCounts: {}, issueCounts: {}, latestReviewedAt: '' };
const emptyReplaySummary: AiUsabilityReplaySummary = { experimentCount: 0, improvedCount: 0, unresolvedCount: 0, liveLinkedCount: 0, improvementRate: 0, averageScoreDelta: 0, averageRoundsDelta: 0, issueTransitionCounts: {}, latestCreatedAt: '' };
const emptyModelSummary: AiModelGradeSummary = { sampleCount: 0, passedCount: 0, failedCount: 0, averageOverallScore: 0, minOverallScore: 0, averageGradeAppropriatenessScore: 0, runLinkedCount: 0, tokenKnownCount: 0, issueCounts: {}, graderModeCounts: {}, promptVersionCounts: {}, latestReviewedAt: '' };

function initialForm(model: string): AiUsabilityHumanReviewInput {
  return { sampleId: '', prompt: '', route: 'student_diagnosis', subIntent: 'student_progress', teacherScore: 4, needsRewrite: false, roundsToUseful: 1, mainIssueCode: 'none', teacherNote: '', runId: '', sessionId: '', model, reviewedAt: new Date().toISOString().slice(0, 16) };
}

function parseDelimitedLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') { current += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { values.push(current.trim()); current = ''; }
    else current += char;
  }
  values.push(current.trim());
  return values;
}

export function parseUsabilityReviewCsv(text: string): AiUsabilityHumanReviewInput[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = parseDelimitedLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    const row = Object.fromEntries(headers.map((header, index) => [header.trim(), values[index] ?? '']));
    return {
      sampleId: row.sampleId || row.id || '', prompt: row.prompt || '', route: (row.route || 'general_qa') as AiIntentRoute,
      subIntent: row.subIntent || row.sub_intent || 'concept_explanation', teacherScore: Number(row.teacherScore || row.teacher_score || 0),
      needsRewrite: /^(true|1|yes|y|是|需要)$/i.test(row.needsRewrite || row.needs_rewrite || ''), roundsToUseful: Number(row.roundsToUseful || row.rounds_to_useful || 1),
      mainIssueCode: row.mainIssueCode || row.main_issue_code || 'none', teacherNote: row.teacherNote || row.teacher_note || '', reviewedAt: row.reviewedAt || row.reviewed_at || '',
      runId: row.runId || row.run_id || '', sessionId: row.sessionId || row.session_id || '', model: row.model || '',
    };
  });
}

function normalizedInput(raw: AiUsabilityHumanReviewInput, fallbackModel: string): AiUsabilityHumanReviewInput {
  return { ...raw, sampleId: raw.sampleId.trim(), prompt: raw.prompt.trim(), subIntent: String(raw.subIntent).trim(), mainIssueCode: raw.mainIssueCode.trim() || 'none', teacherNote: raw.teacherNote?.trim() ?? '', runId: raw.runId?.trim() ?? '', sessionId: raw.sessionId?.trim() ?? '', model: raw.model?.trim() || fallbackModel, teacherScore: Number(raw.teacherScore), roundsToUseful: Number(raw.roundsToUseful), reviewedAt: raw.reviewedAt || new Date().toISOString() };
}

export function validateUsabilityReview(input: AiUsabilityHumanReviewInput): string {
  if (!input.sampleId.trim()) return '请输入 sampleId。';
  if (!input.prompt.trim()) return '请输入老师真实问题。';
  if (!String(input.route).trim() || !String(input.subIntent).trim()) return '请选择 route 和 subIntent。';
  if (!Number.isInteger(Number(input.teacherScore)) || Number(input.teacherScore) < 1 || Number(input.teacherScore) > 5) return 'teacherScore 必须是 1 到 5 的整数。';
  if (!Number.isInteger(Number(input.roundsToUseful)) || Number(input.roundsToUseful) < 1 || Number(input.roundsToUseful) > 12) return 'roundsToUseful 必须是 1 到 12 的整数。';
  return '';
}

export type AiQualityReviewStatus = 'loading' | 'idle' | 'saving' | 'importing' | 'success' | 'error';
export type AiQualityReviewViewProps = {
  status: AiQualityReviewStatus; message: string; reviews: AiUsabilityHumanReview[]; humanSummary: AiUsabilityHumanReviewSummary;
  experiments: AiUsabilityReplayExperiment[]; replaySummary: AiUsabilityReplaySummary; modelGrades: AiModelGrade[]; modelSummary: AiModelGradeSummary;
  form: AiUsabilityHumanReviewInput; csvText: string; selectedBeforeId: string;
  onFormChange: (next: AiUsabilityHumanReviewInput) => void; onCsvChange: (value: string) => void; onSave: () => void; onImport: () => void;
  onRefresh: () => void; onSelectBefore: (review: AiUsabilityHumanReview) => void; onCancelBefore: () => void; onReplay: (prompt: string, label: string) => void;
};

function Metric({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: React.ReactNode }) {
  return <article className="quality-review-metric">{icon}<div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}

export function AiQualityReviewState(props: AiQualityReviewViewProps) {
  const failedReviews = props.reviews.filter((review) => review.needsRewrite || review.teacherScore <= 3 || review.mainIssueCode !== 'none').slice(0, 6);
  const selectedBefore = props.reviews.find((review) => review.id === props.selectedBeforeId);
  const busy = props.status === 'loading' || props.status === 'saving' || props.status === 'importing';
  return (
    <div className="usability-review-panel" data-testid="ai-quality-review-workspace">
      <div className="quality-review-toolbar">
        <div><h3>小智质量评审</h3><p>真实教师评分、失败样本回放和模型裁判证据均保存在本地 SQLite。</p></div>
        <button className="secondary-action" disabled={busy} onClick={props.onRefresh} data-testid="ai-quality-review-refresh"><RefreshCw size={16} />刷新证据</button>
      </div>
      {props.status === 'loading' ? <div className="quality-review-feedback neutral" data-testid="ai-quality-review-loading"><LoaderCircle className="backup-spinner" size={17} />正在读取本地质量证据…</div> : null}
      {props.status === 'saving' || props.status === 'importing' ? <div className="quality-review-feedback neutral" data-testid="ai-quality-review-working"><LoaderCircle className="backup-spinner" size={17} />{props.message}</div> : null}
      {props.status === 'success' ? <div className="quality-review-feedback success" role="status" data-testid="ai-quality-review-success"><CheckCircle2 size={17} />{props.message}</div> : null}
      {props.status === 'error' ? <div className="quality-review-feedback error" role="alert" data-testid="ai-quality-review-error"><TriangleAlert size={17} />{props.message}</div> : null}

      <div className="usability-review-summary" data-testid="ai-quality-review-summary">
        <Metric label="人工样本" value={props.humanSummary.sampleCount} detail="ai_usability_reviews" icon={<ListChecks size={18} />} />
        <Metric label="平均评分" value={props.humanSummary.sampleCount ? `${props.humanSummary.averageTeacherScore}/5` : '暂无'} detail={`需重写 ${props.humanSummary.needsRewriteCount}`} icon={<BarChart3 size={18} />} />
        <Metric label="有用轮次" value={props.humanSummary.sampleCount ? props.humanSummary.averageRoundsToUseful : '暂无'} detail="目标 1-2 轮内可用" icon={<MessageSquare size={18} />} />
        <Metric label="回放实验" value={props.replaySummary.experimentCount} detail={`改善 ${props.replaySummary.improvedCount} · 未解决 ${props.replaySummary.unresolvedCount}`} icon={<Database size={18} />} />
        <Metric label="模型 Grader" value={props.modelSummary.sampleCount} detail={`通过 ${props.modelSummary.passedCount} · run 绑定 ${props.modelSummary.runLinkedCount}`} icon={<ShieldCheck size={18} />} />
      </div>

      <div className="usability-review-workspace">
        <div className="usability-review-form" data-testid="ai-quality-review-form">
          <h3>单条教师评分</h3>
          {selectedBefore ? <div className="replay-before-banner" data-testid="ai-quality-selected-before"><span>before：{selectedBefore.sampleId} · {selectedBefore.teacherScore}/5 · {selectedBefore.mainIssueCode}</span><button className="secondary-action compact-button" onClick={props.onCancelBefore} data-testid="ai-quality-cancel-before">取消绑定</button></div> : null}
          <div className="form-grid">
            <label>sampleId<input data-testid="ai-quality-sample-id" value={props.form.sampleId} onChange={(event) => props.onFormChange({ ...props.form, sampleId: event.target.value })} placeholder="teacher_review_001" /></label>
            <label>route<select data-testid="ai-quality-route" value={props.form.route} onChange={(event) => props.onFormChange({ ...props.form, route: event.target.value as AiIntentRoute })}>{routeOptions.map((route) => <option key={route} value={route}>{routeLabels[route]} · {route}</option>)}</select></label>
            <label>subIntent<select data-testid="ai-quality-sub-intent" value={String(props.form.subIntent)} onChange={(event) => props.onFormChange({ ...props.form, subIntent: event.target.value })}>{subIntentOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>teacherScore<input data-testid="ai-quality-score" type="number" min={1} max={5} value={props.form.teacherScore} onChange={(event) => props.onFormChange({ ...props.form, teacherScore: Number(event.target.value) })} /></label>
            <label>roundsToUseful<input data-testid="ai-quality-rounds" type="number" min={1} max={12} value={props.form.roundsToUseful} onChange={(event) => props.onFormChange({ ...props.form, roundsToUseful: Number(event.target.value) })} /></label>
            <label>mainIssueCode<input data-testid="ai-quality-issue" value={props.form.mainIssueCode} onChange={(event) => props.onFormChange({ ...props.form, mainIssueCode: event.target.value })} placeholder="none / evidence_gap" /></label>
            <label>model<input data-testid="ai-quality-model" value={props.form.model ?? ''} onChange={(event) => props.onFormChange({ ...props.form, model: event.target.value })} /></label>
            <label>reviewedAt<input data-testid="ai-quality-reviewed-at" type="datetime-local" value={String(props.form.reviewedAt ?? '').slice(0, 16)} onChange={(event) => props.onFormChange({ ...props.form, reviewedAt: event.target.value })} /></label>
            <label className="full">prompt<textarea data-testid="ai-quality-prompt" rows={3} value={props.form.prompt} onChange={(event) => props.onFormChange({ ...props.form, prompt: event.target.value })} placeholder="老师真实问小智的问题" /></label>
            <label className="full">teacherNote<textarea data-testid="ai-quality-note" rows={3} value={props.form.teacherNote ?? ''} onChange={(event) => props.onFormChange({ ...props.form, teacherNote: event.target.value })} placeholder="评分依据与需要改进之处" /></label>
            <label className="checkbox-row full"><input data-testid="ai-quality-needs-rewrite" type="checkbox" checked={Boolean(props.form.needsRewrite)} onChange={(event) => props.onFormChange({ ...props.form, needsRewrite: event.target.checked })} />这条回复需要老师明显重写</label>
            <button className="primary-action wide" disabled={busy} onClick={props.onSave} data-testid="ai-quality-save"><CheckCircle2 size={16} />{props.status === 'saving' ? '保存中…' : '保存人工评分'}</button>
          </div>
        </div>

        <div className="usability-review-import" data-testid="ai-quality-csv-panel">
          <h3>CSV / TSV 导入</h3><p>导入前会先校验全部行；格式错误时保持零写入。</p>
          <label className="quality-review-file-picker">
            <span>选择本地 CSV / TSV 文件</span>
            <input
              data-testid="ai-quality-csv-file"
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              disabled={busy}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => props.onCsvChange(typeof reader.result === 'string' ? reader.result : '');
                reader.readAsText(file, 'utf-8');
              }}
            />
          </label>
          <textarea data-testid="ai-quality-csv-text" rows={8} value={props.csvText} onChange={(event) => props.onCsvChange(event.target.value)} placeholder="sampleId,prompt,route,subIntent,teacherScore,needsRewrite,roundsToUseful,mainIssueCode" />
          <button className="secondary-action wide" disabled={busy} onClick={props.onImport} data-testid="ai-quality-import"><UploadCloud size={16} />{props.status === 'importing' ? '导入中…' : '导入评分 CSV'}</button>
        </div>
      </div>

      <div className="usability-review-failures" data-testid="ai-quality-failures"><div className="section-subhead"><h3>失败样本回放</h3><span>低分、需重写或 issueCode 非 none。</span></div>
        {failedReviews.length ? failedReviews.map((review) => <article key={review.id} data-testid={`ai-quality-review-${review.id}`}><div><strong>{review.sampleId}</strong><span>{routeLabels[review.route] ?? review.route} · {review.subIntent} · {review.teacherScore}/5 · {review.mainIssueCode}</span><p>{review.prompt}</p></div><div className="failure-actions"><button className="secondary-action compact-button" onClick={() => props.onReplay(review.prompt, review.sampleId)} data-testid={`ai-quality-replay-${review.id}`}>回放到 AI</button><button className="secondary-action compact-button" onClick={() => props.onSelectBefore(review)} data-testid={`ai-quality-before-${review.id}`}>设为 before</button></div></article>) : <div className="empty-state" data-testid="ai-quality-failures-empty">暂无失败样本。</div>}
      </div>
      <div className="usability-review-failures" data-testid="ai-quality-experiments"><div className="section-subhead"><h3>before/after 回放实验</h3><span>由两条真实人工评分经 SQLite join 计算。</span></div>
        {props.experiments.length ? props.experiments.map((item) => <article key={item.id} data-testid={`ai-quality-experiment-${item.id}`}><div><strong>{item.improved ? '已改善' : '未完全改善'} · Δ{item.scoreDelta}/5</strong><span>{item.issueBefore} → {item.issueAfter} · 有用轮次 Δ{item.roundsDelta}</span><p>{item.replayPrompt}</p></div><button className="secondary-action compact-button" onClick={() => props.onReplay(item.replayPrompt, item.id)} data-testid={`ai-quality-experiment-replay-${item.id}`}>再次回放</button></article>) : <div className="empty-state" data-testid="ai-quality-experiments-empty">暂无 before/after 实验。</div>}
      </div>
      <div className="usability-review-failures" data-testid="ai-quality-model-grades"><div className="section-subhead"><h3>模型 Grader 裁判样本</h3><span>只读显示 harness 写入的真实裁判证据。</span></div>
        {props.modelGrades.length ? props.modelGrades.slice(0, 6).map((grade) => <article key={grade.id} data-testid={`ai-quality-model-grade-${grade.id}`}><div><strong>{grade.passed ? '通过' : '未通过'} · {grade.overallScore}/5 · {grade.sampleId}</strong><span>{grade.graderMode} · 年级适切 {grade.gradeAppropriatenessScore}/5 · {grade.runId ? `run ${grade.runId}` : '未绑定 run'}</span><p>{grade.issueCodes.length ? `issues: ${grade.issueCodes.join(', ')}` : grade.graderRationale}</p></div><button className="secondary-action compact-button" onClick={() => props.onReplay(grade.prompt, grade.sampleId)} data-testid={`ai-quality-model-replay-${grade.id}`}>回放 prompt</button></article>) : <div className="empty-state" data-testid="ai-quality-model-grades-empty">暂无模型 grader 样本。</div>}
      </div>
      <p className="quality-review-boundary" data-testid="ai-quality-review-boundary">人工评分和回放实验不修改原 AI 回复；模型 Grader 结果可能来自 deterministic proxy 或 llm_judge，界面按真实 graderMode 展示，不把 proxy 冒充真实模型裁判。</p>
    </div>
  );
}

type WorkspaceProps = { model: string; setStatus?: (message: string) => void; onReplayPrompt: (prompt: string, label: string) => void };

export function AiQualityReviewWorkspace({ model, setStatus, onReplayPrompt }: WorkspaceProps) {
  const [status, setReviewStatus] = useState<AiQualityReviewStatus>('loading');
  const [message, setMessage] = useState('');
  const [reviews, setReviews] = useState<AiUsabilityHumanReview[]>([]);
  const [humanSummary, setHumanSummary] = useState(emptyHumanSummary);
  const [experiments, setExperiments] = useState<AiUsabilityReplayExperiment[]>([]);
  const [replaySummary, setReplaySummary] = useState(emptyReplaySummary);
  const [modelGrades, setModelGrades] = useState<AiModelGrade[]>([]);
  const [modelSummary, setModelSummary] = useState(emptyModelSummary);
  const [selectedBeforeId, setSelectedBeforeId] = useState('');
  const [form, setForm] = useState<AiUsabilityHumanReviewInput>(() => initialForm(model));
  const [csvText, setCsvText] = useState('');
  const selectedBefore = useMemo(() => reviews.find((review) => review.id === selectedBeforeId), [reviews, selectedBeforeId]);

  async function refresh(nextStatus: AiQualityReviewStatus = 'idle', nextMessage = '') {
    try {
      if (!window.omniEdu) throw new Error('小智质量评审接口不可用，请重新启动应用。');
      const [nextReviews, nextHumanSummary, nextExperiments, nextReplaySummary, nextGrades, nextModelSummary] = await Promise.all([
        window.omniEdu.listAiUsabilityReviews(100), window.omniEdu.getAiUsabilityReviewSummary(), window.omniEdu.listAiUsabilityReplayExperiments(50), window.omniEdu.getAiUsabilityReplaySummary(), window.omniEdu.listAiModelGrades(20), window.omniEdu.getAiModelGradeSummary(),
      ]);
      setReviews(nextReviews); setHumanSummary(nextHumanSummary); setExperiments(nextExperiments); setReplaySummary(nextReplaySummary); setModelGrades(nextGrades); setModelSummary(nextModelSummary);
      setReviewStatus(nextStatus); setMessage(nextMessage);
    } catch (error) {
      const detail = error instanceof Error ? error.message : '小智质量证据读取失败。';
      setReviewStatus('error'); setMessage(detail); setStatus?.(detail);
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function saveReview() {
    const input = normalizedInput(form, model);
    const validation = validateUsabilityReview(input);
    if (validation) { setReviewStatus('error'); setMessage(validation); return; }
    setReviewStatus('saving'); setMessage('正在保存人工评分…');
    try {
      if (!window.omniEdu) throw new Error('小智质量评审接口不可用，请重新启动应用。');
      const saved = await window.omniEdu.createAiUsabilityReview(input);
      if (selectedBefore && saved.id !== selectedBefore.id) {
        await window.omniEdu.createAiUsabilityReplayExperiment({ beforeReviewId: selectedBefore.id, afterReviewId: saved.id, replayPrompt: saved.prompt, modelAfter: saved.model, promptVersionAfter: 'manual-ui-v1.4', experimentNote: '由小智质量评审工作区创建。' });
      }
      const success = selectedBefore ? '人工评分已保存，并创建 before/after 回放实验。' : '人工评分已保存到本地 SQLite。';
      setSelectedBeforeId(''); setForm(initialForm(model)); await refresh('success', success); setStatus?.(success);
    } catch (error) { const detail = error instanceof Error ? error.message : '保存人工评分失败。'; setReviewStatus('error'); setMessage(detail); setStatus?.(detail); }
  }

  async function importCsv() {
    const rows = parseUsabilityReviewCsv(csvText).map((row) => normalizedInput(row, model));
    if (!rows.length) { setReviewStatus('error'); setMessage('CSV 至少需要表头和一行样本。'); return; }
    const invalidIndex = rows.findIndex((row) => Boolean(validateUsabilityReview(row)));
    if (invalidIndex >= 0) { setReviewStatus('error'); setMessage(`CSV 第 ${invalidIndex + 2} 行无效：${validateUsabilityReview(rows[invalidIndex])} 未写入任何样本。`); return; }
    setReviewStatus('importing'); setMessage(`正在导入 ${rows.length} 条人工评分…`);
    try {
      if (!window.omniEdu) throw new Error('小智质量评审接口不可用，请重新启动应用。');
      for (const row of rows) await window.omniEdu.createAiUsabilityReview(row);
      setCsvText(''); const success = `已导入 ${rows.length} 条人工评分。`; await refresh('success', success); setStatus?.(success);
    } catch (error) { const detail = error instanceof Error ? error.message : '导入人工评分失败。'; setReviewStatus('error'); setMessage(`${detail}；若中途失败，请按 sampleId 检查已写入行。`); setStatus?.(detail); }
  }

  return <AiQualityReviewState status={status} message={message} reviews={reviews} humanSummary={humanSummary} experiments={experiments} replaySummary={replaySummary} modelGrades={modelGrades} modelSummary={modelSummary} form={form} csvText={csvText} selectedBeforeId={selectedBeforeId} onFormChange={setForm} onCsvChange={setCsvText} onSave={() => void saveReview()} onImport={() => void importCsv()} onRefresh={() => { setReviewStatus('loading'); setMessage(''); void refresh(); }} onSelectBefore={(review) => { setSelectedBeforeId(review.id); setForm((current) => ({ ...current, sampleId: `${review.sampleId}_after`, prompt: review.prompt, route: review.route, subIntent: review.subIntent, model: model || review.model, reviewedAt: new Date().toISOString().slice(0, 16) })); }} onCancelBefore={() => setSelectedBeforeId('')} onReplay={onReplayPrompt} />;
}
