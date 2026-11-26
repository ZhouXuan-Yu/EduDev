import {localDateTime} from '../interaction/student-record-draft';
import {useDesktopNavigationGuard} from './desktop/DesktopFrame';
import {useActionConfirmation} from './ui/ActionConfirmation';
import {Button} from '@heroui/react';
import { CheckCircle2, FileText, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { LearningRecord, ReviewReport, Student } from '../../shared/contracts';

export type ReviewReportForm = {
  subject: string;
  startDate: string;
  endDate: string;
  reportType: string;
};

export type ReviewReportUiState = {
  status: 'idle' | 'generating' | 'draft' | 'saving' | 'saved' | 'error';
  message: string;
};

type ReviewReportWorkspaceProps = {
  activeStudent?: Student;
  records: LearningRecord[];
  reports: ReviewReport[];
  selectedReportId?: string;
  onReportsChanged: (reports: ReviewReport[]) => void;
  setStatus: (message: string) => void;
};

type ReviewReportWorkspaceStateProps = {
  activeStudent?: Student;
  records: LearningRecord[];
  reports: ReviewReport[];
  form: ReviewReportForm;
  activeReport: ReviewReport | null;
  uiState: ReviewReportUiState;
  pendingSave?: boolean;
  onFormChange: (form: ReviewReportForm) => void;
  onGenerate: () => void;
  onSelectReport: (report: ReviewReport) => void;
  onReportChange: (report: ReviewReport) => void;
  onSave: () => void;
};

const defaultForm = (): ReviewReportForm => ({
  subject: '数学',
  startDate: localDateTime(new Date(Date.now() - 30 * 86400000)).slice(0, 10),
  endDate: localDateTime().slice(0, 10),
  reportType: 'monthly',
});

function shortDate(value: string) {
  if (!value) return '日期未知';
  return value.slice(0, 10);
}

export function ReviewReportWorkspaceState({ activeStudent, records, reports, form, activeReport, uiState, pendingSave = false, onFormChange, onGenerate, onSelectReport, onReportChange, onSave }: ReviewReportWorkspaceStateProps) {
  if (!activeStudent) {
    return <section className="work-panel review-report-workspace" data-testid="review-report-workspace"><div className="empty-state" data-testid="review-report-no-student">请先选择一名在读学生，再生成基于本地学习记录的复盘。</div></section>;
  }

  const studentReports = reports.filter((report) => report.studentId === activeStudent.id);
  const evidenceRecords = activeReport
    ? activeReport.sourceRecordIds.map((id) => records.find((record) => record.id === id)).filter((record): record is LearningRecord => Boolean(record))
    : [];
  const busy = pendingSave || uiState.status === 'generating' || uiState.status === 'saving';

  return (
    <div className="review-layout review-report-workspace" data-testid="review-report-workspace">
      <section className="work-panel">
        <div className="workspace-label"><span>01</span><div><h2>复盘条件</h2><p>为 {activeStudent.displayName} 创建本地可编辑复盘草稿。</p></div></div>
        <div className="form-grid single">
          <label>开始日期<input type="date" value={form.startDate} onChange={(event) => onFormChange({ ...form, startDate: event.target.value })} data-testid="review-report-start-date" /></label>
          <label>结束日期<input type="date" value={form.endDate} onChange={(event) => onFormChange({ ...form, endDate: event.target.value })} data-testid="review-report-end-date" /></label>
          <label>科目<input value={form.subject} onChange={(event) => onFormChange({ ...form, subject: event.target.value })} data-testid="review-report-subject" /></label>
          <button className="primary-action wide" onClick={onGenerate} disabled={busy} data-testid="review-report-generate"><FileText size={16} />{uiState.status === 'generating' ? '正在生成…' : '生成本地草稿'}</button>
        </div>
        {uiState.status === 'idle' ? <div className="review-report-feedback" data-testid="review-report-idle">根据已有学习记录创建草稿；修改后点击保存。</div> : null}
        {busy ? <div className="review-report-feedback working" role="status" data-testid="review-report-loading"><RefreshCw className="spinner" size={15} />{uiState.message}</div> : null}
        {uiState.status === 'error' ? <div className="review-report-feedback error" role="alert" data-testid="review-report-error">{uiState.message}</div> : null}
        {uiState.status === 'draft' ? <div className="review-report-feedback warning" role="status" data-testid="review-report-draft">{uiState.message}</div> : null}
        {uiState.status === 'saved' ? <div className="review-report-feedback success" role="status" data-testid="review-report-saved">{uiState.message}</div> : null}

        <div className="review-report-history" data-testid="review-report-history">
          <div className="section-heading"><h3>本地复盘历史</h3><span>{studentReports.length} 份</span></div>
          {studentReports.map((report) => <button key={report.id} className={report.id === activeReport?.id ? 'review-report-history-item active' : 'review-report-history-item'} onClick={() => onSelectReport(report)} data-testid={`review-report-history-${report.id}`}><strong>{report.title}</strong><span>{shortDate(report.startDate)} 至 {shortDate(report.endDate)}</span><em>{report.sourceRecordIds.length} 条证据</em></button>)}
          {!studentReports.length ? <div className="empty-state" data-testid="review-report-history-empty">当前学生还没有本地复盘。</div> : null}
        </div>
      </section>

      <section className="work-panel editor-panel">
        <div className="workspace-label"><span>02</span><div><h2>报告编辑器</h2><p>核对正文与摘要，修改后保存到本机。</p></div></div>
        {activeReport ? <>
          <div className="review-report-meta" data-testid="review-report-meta"><span>{activeReport.subject || '全部科目'}</span><span>{activeReport.sourceRecordIds.length} 条证据</span><span>更新 {shortDate(activeReport.updatedAt)}</span></div>
          <textarea className="report-editor" value={activeReport.contentMd} onChange={(event) => onReportChange({ ...activeReport, contentMd: event.target.value })} data-testid="review-report-content" />
          <button className="primary-action wide" onClick={onSave} disabled={busy} data-testid="review-report-save"><CheckCircle2 size={16} />{uiState.status === 'saving' ? '正在保存…' : '保存修改'}</button>
        </> : <div className="empty-state" data-testid="review-report-editor-empty">从左侧生成或打开一份复盘。</div>}
      </section>

      <section className="work-panel">
        <div className="workspace-label"><span>03</span><div><h2>家长版、证据与质量检查</h2><p>报告不允许脱离本地证据链。</p></div></div>
        {activeReport ? <>
          <label className="full">家长沟通版摘要<textarea value={activeReport.parentSummary} onChange={(event) => onReportChange({ ...activeReport, parentSummary: event.target.value })} data-testid="review-report-parent-summary" /></label>
          <div className="evidence-list" data-testid="review-report-evidence"><h3>已绑定源记录</h3>{evidenceRecords.map((record) => <article key={record.id} data-testid={`review-report-evidence-${record.id}`}><span>{shortDate(record.occurredAt)}</span><strong>{record.title}</strong></article>)}{activeReport.sourceRecordIds.length && evidenceRecords.length < activeReport.sourceRecordIds.length ? <p className="boundary-note">部分源记录当前未加载；报告仍保留其本地 ID，不会补造证据。</p> : null}{!activeReport.sourceRecordIds.length ? <div className="empty-state" data-testid="review-report-evidence-empty">此草稿没有命中源记录，质量检查应保持失败或待补充。</div> : null}</div>
          <div className="quality-list" data-testid="review-report-quality">{activeReport.qualityChecks.map((check) => <article key={check.key} className={check.passed ? 'passed' : 'failed'} data-testid={`review-report-quality-${check.key}`}><ShieldCheck size={15} /><div><strong>{check.label}</strong><p>{check.detail}</p></div></article>)}</div>
          <p className="boundary-note" data-testid="review-report-boundary">“保存修改”更新本地 SQLite 报告记录；如需最终交付文件，请使用文档导出。生成时的 Markdown 初始快照不代表最终稿。</p>
        </> : <div className="empty-state" data-testid="review-report-quality-empty">打开草稿后显示家长摘要、证据和后端质量检查。</div>}
      </section>
    </div>
  );
}

export function ReviewReportWorkspace({ activeStudent, records, reports, selectedReportId, onReportsChanged, setStatus }: ReviewReportWorkspaceProps) {
  const [form, setForm] = useState<ReviewReportForm>(defaultForm);
  const [activeReport, setActiveReport] = useState<ReviewReport | null>(null);
  const [uiState, setUiState] = useState<ReviewReportUiState>({ status: 'idle', message: '' });

  const [pendingSave, setPendingSave] = useState(false);
  const saving = useRef(false), draftCache = useRef(new Map<string, ReviewReport>());
  const current = useRef(activeReport); current.current = activeReport;
  const owner = useRef(activeStudent?.id); owner.current = activeStudent?.id;
  const latestReports = useRef(reports); latestReports.current = reports;
  const selectedIntent = useRef('');
  const generating=useRef(false), viewIntent=useRef(0);
  const confirmation=useActionConfirmation();
  useDesktopNavigationGuard(draftCache.current.size>0||pendingSave,'复盘还有未保存的修改，请先保存或放弃修改再离开。');
  const studentReports = useMemo(() => reports.filter(report => report.studentId === activeStudent?.id), [reports, activeStudent?.id]);
  function openReport(report: ReviewReport) {
    viewIntent.current++;
    const draft = draftCache.current.get(report.id);
    current.current = draft ?? report; setActiveReport(current.current);
    setUiState({status:draft?'draft':'saved',message:draft?'已恢复这份报告尚未保存的修改。':'已打开本地复盘。'});
  }
  useEffect(() => {
    current.current = null; setActiveReport(null);
    setUiState({status:'idle',message:''});
    setForm(previous => ({...previous,subject:activeStudent?.subjects[0] || previous.subject || '数学'}));
  }, [activeStudent?.id]);
  useEffect(() => {
    const intent = `${activeStudent?.id}:${selectedReportId}`;
    if (!selectedReportId || selectedIntent.current === intent) return;
    const selected = studentReports.find(report => report.id === selectedReportId);
    if (selected) { selectedIntent.current = intent; openReport(selected); }
  }, [selectedReportId, studentReports, activeStudent?.id]);
  function editReport(report: ReviewReport) {
    viewIntent.current++;
    draftCache.current.set(report.id, report); current.current = report; setActiveReport(report);
    setUiState({status:'draft',message:saving.current?'正在保存上一版，新输入会保留。':'当前修改尚未保存。切换报告后可继续编辑。'});
  }

  async function generate() {
    if (!activeStudent || saving.current || generating.current) return;
    const studentId = activeStudent.id;
    if (!form.startDate || !form.endDate) {
      setUiState({ status: 'error', message: '请选择完整的开始和结束日期。' });
      return;
    }
    if (form.startDate > form.endDate) {
      setUiState({ status: 'error', message: '开始日期不能晚于结束日期。' });
      return;
    }
    generating.current=true;setPendingSave(true);
    const intent=viewIntent.current;
    setUiState({ status: 'generating', message: '正在从本地学习记录创建草稿…' });
    try {
      const report = await window.omniEdu?.generateReview({ studentId: activeStudent.id, ...form });
      if (!report) throw new Error('复盘生成没有返回本地草稿。');
      if (owner.current !== studentId) return;
      onReportsChanged([report, ...latestReports.current.filter(item => item.id !== report.id)]);
      if(viewIntent.current===intent){current.current = report; setActiveReport(report);setUiState({ status: 'draft', message: '草稿已创建，可查看并修改。' });}
      setStatus('复盘本地草稿已创建。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '复盘生成失败，请重试。';
      if (owner.current === studentId && viewIntent.current===intent) {setUiState({ status: 'error', message });setStatus(message);}
    } finally {generating.current=false;setPendingSave(false);}
  }

  async function save() {
    const submitted = current.current;
    if (!submitted || saving.current || generating.current) return;
    if (!submitted.contentMd.trim()) {setUiState({status:'error',message:'复盘正文不能为空。'});return;}
    saving.current = true; setPendingSave(true);
    setUiState({status:'saving',message:'正在保存修改…'});
    try {
      const saved = await window.omniEdu?.updateReport(submitted.id,submitted.contentMd,submitted.parentSummary);
      if (!saved) throw new Error('复盘未保存，当前输入已保留。');
      const draft = draftCache.current.get(submitted.id);
      const changed = !!draft && (draft.contentMd !== submitted.contentMd || draft.parentSummary !== submitted.parentSummary);
      if (!changed) draftCache.current.delete(submitted.id);
      if (owner.current !== submitted.studentId) return;
      onReportsChanged(latestReports.current.map(item => item.id === saved.id ? saved : item));
      if (current.current?.id === submitted.id) {
        if (!changed) {current.current = saved;setActiveReport(saved);}
        setUiState({status:changed?'draft':'saved',message:changed?'上一版已保存，当前修改尚未保存。':'修改已保存到本机。'});
      }
      setStatus('复盘已保存。');
    } catch (error) {
      if (owner.current === submitted.studentId && current.current?.id === submitted.id)
        setUiState({status:'error',message:error instanceof Error?error.message:'复盘未保存，当前输入已保留。'});
    } finally {saving.current=false;setPendingSave(false);}
  }

  return <>
    {draftCache.current.size>0&&(activeReport&&draftCache.current.has(activeReport.id)?<Button variant="ghost" isDisabled={pendingSave} data-testid="review-discard" onPress={()=>confirmation.request({title:`放弃《${activeReport.title}》的修改？`,description:'其他报告的草稿、已经保存的内容和源记录会保留。',confirmLabel:'放弃本报告修改',action:()=>{draftCache.current.delete(activeReport.id);const saved=latestReports.current.find(item=>item.id===activeReport.id);if(saved)openReport(saved);else setActiveReport(null);}})}>放弃本报告修改</Button>:<Button variant="ghost" onPress={()=>{const draft=draftCache.current.values().next().value;if(draft)openReport(draft);}}>返回未保存的复盘</Button>)}
    <ReviewReportWorkspaceState activeStudent={activeStudent} records={records} reports={reports} form={form} activeReport={activeReport} uiState={uiState} pendingSave={pendingSave} onFormChange={setForm} onGenerate={() => void generate()} onSelectReport={openReport} onReportChange={editReport} onSave={() => void save()} />
    {confirmation.dialog}
  </>;
}
