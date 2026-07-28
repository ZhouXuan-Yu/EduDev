import {
  Archive,
  BookOpenCheck,
  CalendarRange,
  ClipboardList,
  Database,
  FileText,
  FolderOpen,
  HardDrive,
  Layers3,
  PanelRightOpen,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  UploadCloud,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  AttachmentImportResult,
  LearningRecord,
  PlatformOverview,
  ReviewReport,
  Student,
  StudentInput,
} from '../shared/contracts';

const recordTypeLabels: Record<string, string> = {
  class: '课堂',
  homework: '作业',
  exam: '试卷',
  mistake: '错题',
  communication: '沟通',
  summary: '阶段总结',
};

const emptyOverview: PlatformOverview = {
  tagCount: 0,
  reportTemplateCount: 0,
  pendingSyncOperations: 0,
  pendingAiTasks: 0,
  teacherCount: 0,
  assignmentCount: 0,
  analytics: {
    activeStudents: 0,
    totalRecords: 0,
    totalReports: 0,
    totalAttachments: 0,
  },
};

const initialStudentForm: StudentInput = {
  displayName: '',
  grade: '',
  subjects: ['数学'],
  goals: '',
  currentIssues: '',
  parentConcerns: '',
  teacherNotes: '',
  tags: [],
};

type ToolKey = 'record' | 'review' | 'profile' | 'system';

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'blue' | 'amber' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) {
  return (
    <button className="icon-button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

function splitList(value: string) {
  return value
    .split(/[，,、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 MB';
  if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export function App() {
  const [dataRoot, setDataRoot] = useState('正在连接本地数据目录');
  const [overview, setOverview] = useState<PlatformOverview>(emptyOverview);
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [activeTool, setActiveTool] = useState<ToolKey>('record');
  const [studentQuery, setStudentQuery] = useState('');
  const [recordKeyword, setRecordKeyword] = useState('');
  const [recordTypeFilter, setRecordTypeFilter] = useState('');
  const [recordSubjectFilter, setRecordSubjectFilter] = useState('');
  const [recordTagFilter, setRecordTagFilter] = useState('');
  const [recordStartDate, setRecordStartDate] = useState('');
  const [recordEndDate, setRecordEndDate] = useState('');
  const [studentForm, setStudentForm] = useState<StudentInput>(initialStudentForm);
  const [editingStudent, setEditingStudent] = useState(false);
  const [recordForm, setRecordForm] = useState({
    recordType: 'mistake',
    subject: '数学',
    title: '',
    content: '',
    tags: '',
    occurredAt: new Date().toISOString().slice(0, 16),
  });
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({
    subject: '数学',
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reportType: 'monthly',
  });
  const [activeReport, setActiveReport] = useState<ReviewReport | null>(null);
  const [status, setStatus] = useState('选择学生后开始记录证据。');
  const [attachmentImport, setAttachmentImport] = useState<AttachmentImportResult | null>(null);

  const activeStudent = useMemo(
    () => students.find((student) => student.id === activeStudentId) ?? students[0],
    [students, activeStudentId],
  );

  async function refreshOverview() {
    const nextOverview = await window.omniEdu?.getPlatformOverview();
    if (nextOverview) setOverview(nextOverview);
  }

  async function bootstrap() {
    const data = await window.omniEdu?.bootstrap();
    if (!data) throw new Error('Electron preload 未连接');
    setDataRoot(data.dataRoot);
    setStudents(data.students);
    setOverview(data.overview ?? emptyOverview);
    setActiveStudentId((current) => current || data.students[0]?.id || '');
  }

  async function refreshStudents(query = studentQuery) {
    const nextStudents = await window.omniEdu?.listStudents(query);
    setStudents(nextStudents ?? []);
    await refreshOverview();
  }

  async function refreshRecords(studentId = activeStudent?.id) {
    if (!studentId) return;
    const nextRecords = await window.omniEdu?.listRecords(studentId, {
      type: recordTypeFilter || undefined,
      subject: recordSubjectFilter || undefined,
      tag: recordTagFilter || undefined,
      keyword: recordKeyword || undefined,
      startDate: recordStartDate || undefined,
      endDate: recordEndDate || undefined,
    });
    const nextReports = await window.omniEdu?.listReports(studentId);
    setRecords(nextRecords ?? []);
    setReports(nextReports ?? []);
    await refreshOverview();
  }

  useEffect(() => {
    bootstrap().catch((error) => setStatus(error instanceof Error ? error.message : '启动失败'));
  }, []);

  useEffect(() => {
    if (activeStudent) {
      refreshRecords(activeStudent.id).catch(() => setStatus('读取学习记录失败'));
      setStudentForm({
        displayName: activeStudent.displayName,
        realName: activeStudent.realName,
        grade: activeStudent.grade,
        school: activeStudent.school,
        subjects: activeStudent.subjects,
        goals: activeStudent.goals,
        currentIssues: activeStudent.currentIssues,
        parentConcerns: activeStudent.parentConcerns,
        teacherNotes: activeStudent.teacherNotes,
        tags: activeStudent.tags,
      });
    }
  }, [activeStudent?.id, recordTypeFilter, recordSubjectFilter, recordTagFilter, recordKeyword, recordStartDate, recordEndDate]);

  async function submitStudent() {
    if (!studentForm.displayName?.trim()) {
      setStatus('学生显示名不能为空。');
      return;
    }
    const saved = editingStudent && activeStudent
      ? await window.omniEdu?.updateStudent(activeStudent.id, studentForm)
      : await window.omniEdu?.createStudent(studentForm);
    setStudents(saved ?? []);
    setActiveStudentId((saved ?? [])[0]?.id ?? activeStudentId);
    setEditingStudent(false);
    setStudentForm(initialStudentForm);
    setStatus(editingStudent ? '学生档案已更新。' : '学生档案已创建。');
    await refreshOverview();
  }

  async function submitRecord() {
    if (!activeStudent || !recordForm.title.trim()) {
      setStatus('请先选择学生，并填写记录标题。');
      return;
    }
    const payload = {
      recordType: recordForm.recordType,
      subject: recordForm.subject,
      title: recordForm.title,
      content: recordForm.content,
      tags: splitList(recordForm.tags),
      occurredAt: new Date(recordForm.occurredAt).toISOString(),
    };
    const nextRecords = editingRecordId
      ? await window.omniEdu?.updateRecord(editingRecordId, payload)
      : await window.omniEdu?.createRecord({
          studentId: activeStudent.id,
          ...payload,
        });
    setRecords(nextRecords ?? []);
    await refreshStudents();
    resetRecordForm();
    setStatus(editingRecordId ? '学习记录已更新。' : '学习记录已保存。');
  }

  function resetRecordForm() {
    setEditingRecordId(null);
    setRecordForm({
      recordType: 'mistake',
      subject: activeStudent?.subjects[0] ?? '数学',
      title: '',
      content: '',
      tags: '',
      occurredAt: new Date().toISOString().slice(0, 16),
    });
  }

  function editRecord(record: LearningRecord) {
    setActiveTool('record');
    setEditingRecordId(record.id);
    setRecordForm({
      recordType: record.recordType,
      subject: record.subject,
      title: record.title,
      content: record.content,
      tags: record.tags.join('、'),
      occurredAt: record.occurredAt.slice(0, 16),
    });
    setStatus('已载入学习记录，可在右侧修改。');
  }

  async function importAttachment(recordId: string) {
    if (!activeStudent) return;
    setAttachmentImport({ status: 'copying', records, items: [] });
    setStatus('正在复制附件到学生本地目录。');
    const result = await window.omniEdu?.importAttachments(activeStudent.id, recordId);
    if (!result) return;
    setAttachmentImport(result);
    setRecords(result.records ?? []);
    await refreshStudents();
    const okCount = result.items.filter((item) => item.ok).length;
    const failedCount = result.items.length - okCount;
    if (result.status === 'canceled') {
      setStatus('已取消附件导入。');
    } else if (failedCount > 0) {
      setStatus(`附件导入完成：成功 ${okCount} 个，失败 ${failedCount} 个。`);
    } else {
      setStatus(`附件已复制：${okCount} 个文件。`);
    }
  }

  async function generateReview() {
    if (!activeStudent) return;
    const report = await window.omniEdu?.generateReview({
      studentId: activeStudent.id,
      ...reviewForm,
    });
    if (report) {
      setActiveReport(report);
      setReports([report, ...reports]);
      setStatus('复盘草稿已生成，可继续编辑。');
      setActiveTool('review');
      await refreshOverview();
    }
  }

  async function saveReport() {
    if (!activeReport) return;
    const saved = await window.omniEdu?.updateReport(activeReport.id, activeReport.contentMd, activeReport.parentSummary);
    if (saved) {
      setActiveReport(saved);
      await refreshRecords();
      setStatus('复盘已保存。');
    }
  }

  const productTracks = [
    { label: '个人档案', value: overview.analytics.activeStudents, unit: '在读学生' },
    { label: '团队协作', value: overview.assignmentCount, unit: '分配关系' },
    { label: 'AI 任务', value: overview.pendingAiTasks, unit: '待处理任务' },
    { label: '经营看板', value: overview.analytics.totalReports, unit: '复盘报告' },
  ];

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="学生档案">
        <div className="brand-row">
          <div className="brand-mark">OE</div>
          <div>
            <strong>Omni-Edu Agent</strong>
            <span>教学资产操作台</span>
          </div>
        </div>

        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="搜索学生"
            placeholder="搜索学生、年级、标签"
            value={studentQuery}
            onChange={(event) => {
              setStudentQuery(event.target.value);
              refreshStudents(event.target.value).catch(() => setStatus('学生搜索失败'));
            }}
          />
        </div>

        <button className="primary-action" onClick={() => {
          setActiveTool('profile');
          setEditingStudent(false);
          setStudentForm(initialStudentForm);
        }}>
          <Plus size={17} />
          新建学生
        </button>

        <section className="student-list" aria-label="学生列表">
          {students.map((student) => (
            <button
              key={student.id}
              className={`student-card ${student.id === activeStudent?.id ? 'active' : ''}`}
              onClick={() => setActiveStudentId(student.id)}
            >
              <div className="student-card-top">
                <strong>{student.displayName}</strong>
                <Badge tone={student.status === 'active' ? 'green' : 'neutral'}>{student.status === 'active' ? '在读' : '归档'}</Badge>
              </div>
              <span>{student.grade || '未填年级'} · {(student.subjects.length ? student.subjects : ['未填科目']).join(' / ')}</span>
              <div className="student-meta">
                <span><ClipboardList size={14} />{student.recordCount} 条记录</span>
                <span><HardDrive size={14} />{formatBytes(student.attachmentBytes)}</span>
              </div>
            </button>
          ))}
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">完整产品工作台</span>
            <h1>{activeStudent ? activeStudent.displayName : '选择或创建学生'}</h1>
          </div>
          <div className="toolbar">
            <IconButton label="打开学生目录" onClick={() => activeStudent && window.omniEdu?.openStudentFolder(activeStudent.id)}><FolderOpen size={18} /></IconButton>
            <button className="secondary-action" onClick={async () => {
              const result = await window.omniEdu?.exportDataRoot();
              if (result) setStatus(`完整数据目录已备份：${result.exportPath}`);
            }}><HardDrive size={17} />备份</button>
            <button className="secondary-action" onClick={async () => {
              if (!activeStudent) return;
              const result = await window.omniEdu?.exportStudent(activeStudent.id);
              if (result) setStatus(`已导出学生档案：${result.exportPath}`);
            }}><FileText size={17} />导出</button>
            <button className="secondary-action" onClick={async () => {
              if (!activeStudent) return;
              setStudents((await window.omniEdu?.archiveStudent(activeStudent.id)) ?? []);
              setStatus('学生已归档，资料未物理删除。');
            }}><Archive size={17} />归档</button>
          </div>
        </header>

        <div className="workspace-grid">
          <section className="main-column">
            <section className="student-brief">
              <div>
                <span className="section-number">01</span>
                <h2>学生当前状态</h2>
                <p>{activeStudent?.currentIssues || '还没有记录当前问题。'}</p>
              </div>
              <div className="brief-goal">
                <span>阶段目标</span>
                <strong>{activeStudent?.goals || '未设置'}</strong>
              </div>
              <div className="profile-tags">
                {(activeStudent?.tags ?? []).map((tag) => <Badge key={tag} tone="blue">{tag}</Badge>)}
              </div>
            </section>

            <section className="track-grid" aria-label="产品线状态">
              {productTracks.map((track) => (
                <article key={track.label} className="track-card">
                  <span>{track.label}</span>
                  <strong>{track.value}</strong>
                  <p>{track.unit}</p>
                </article>
              ))}
            </section>

            <section className="panel evidence-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-number">02</span>
                  <h2>证据时间线</h2>
                  <p>先看真实记录，再决定补充记录、附件或复盘。</p>
                </div>
                <div className="inline-actions">
                  <select value={recordTypeFilter} onChange={(event) => setRecordTypeFilter(event.target.value)}>
                    <option value="">全部类型</option>
                    {Object.entries(recordTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input placeholder="科目" value={recordSubjectFilter} onChange={(event) => setRecordSubjectFilter(event.target.value)} />
                  <input placeholder="标签" value={recordTagFilter} onChange={(event) => setRecordTagFilter(event.target.value)} />
                  <input placeholder="关键词" value={recordKeyword} onChange={(event) => setRecordKeyword(event.target.value)} />
                  <input type="date" aria-label="开始日期" value={recordStartDate} onChange={(event) => setRecordStartDate(event.target.value)} />
                  <input type="date" aria-label="结束日期" value={recordEndDate} onChange={(event) => setRecordEndDate(event.target.value)} />
                </div>
              </div>

              <div className="timeline">
                {records.map((record) => (
                  <article className="timeline-item" key={record.id}>
                    <div className="timeline-dot" />
                    <div className="timeline-body">
                      <div className="record-head">
                        <div>
                          <Badge tone={record.recordType === 'mistake' ? 'amber' : 'neutral'}>{recordTypeLabels[record.recordType] ?? record.recordType}</Badge>
                          <Badge>{record.subject || '全部'}</Badge>
                        </div>
                        <time>{formatTime(record.occurredAt)}</time>
                      </div>
                      <h3>{record.title}</h3>
                      <p>{record.content || '暂无正文'}</p>
                      <div className="record-tags">
                        {record.tags.map((tag) => <span key={tag}><Tag size={13} />{tag}</span>)}
                      </div>
                      {record.attachments.map((attachment) => (
                        <button className="attachment-row" key={attachment.id} onClick={() => window.omniEdu?.showAttachment(attachment.filePath)}>
                          <FileText size={16} />
                          {attachment.fileName} · {formatBytes(attachment.fileSize)}
                          <FolderOpen size={15} />
                        </button>
                      ))}
                      <div className="record-actions">
                        <button className="secondary-action compact-button" onClick={() => editRecord(record)}>编辑</button>
                        <button className="secondary-action compact-button" onClick={() => importAttachment(record.id)}>导入附件</button>
                      </div>
                    </div>
                  </article>
                ))}
                {!records.length ? <div className="empty-state">暂无学习记录。右侧“记录”面板可添加第一条证据。</div> : null}
              </div>
            </section>
          </section>

          <aside className="context-panel" aria-label="当前任务">
            <div className="tool-switcher" role="tablist" aria-label="当前任务">
              {[
                ['record', '记录', ClipboardList],
                ['review', '复盘', Sparkles],
                ['profile', '档案', Users],
                ['system', '系统', Database],
              ].map(([key, label, Icon]) => (
                <button key={key as string} className={activeTool === key ? 'active' : ''} onClick={() => setActiveTool(key as ToolKey)}>
                  <Icon size={16} />
                  {label as string}
                </button>
              ))}
            </div>

            {activeTool === 'record' ? (
              <section className="panel flush">
                <div className="panel-heading tight">
                  <div>
                    <h2>{editingRecordId ? '编辑学习记录' : '添加学习记录'}</h2>
                    <p>一条记录只服务一件事实，方便后续复盘引用。</p>
                  </div>
                  <PanelRightOpen size={18} />
                </div>
                <div className="form-grid">
                  <label>记录类型<select value={recordForm.recordType} onChange={(event) => setRecordForm({ ...recordForm, recordType: event.target.value })}>{Object.entries(recordTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                  <label>科目<input value={recordForm.subject} onChange={(event) => setRecordForm({ ...recordForm, subject: event.target.value })} /></label>
                  <label className="full">标题<input value={recordForm.title} onChange={(event) => setRecordForm({ ...recordForm, title: event.target.value })} /></label>
                  <label className="full">正文<textarea value={recordForm.content} onChange={(event) => setRecordForm({ ...recordForm, content: event.target.value })} /></label>
                  <label className="full">标签<input value={recordForm.tags} onChange={(event) => setRecordForm({ ...recordForm, tags: event.target.value })} placeholder="一次函数、审题、计算粗心" /></label>
                  <button className="primary-action wide" onClick={submitRecord}><Plus size={16} />{editingRecordId ? '保存修改' : '保存记录'}</button>
                  {editingRecordId ? <button className="secondary-action full-button" onClick={resetRecordForm}>取消编辑</button> : null}
                </div>
              </section>
            ) : null}

            {activeTool === 'review' ? (
              <section className="panel flush review-card">
                <div className="panel-heading tight">
                  <div>
                    <h2>阶段复盘</h2>
                    <p>基于当前学生的记录生成草稿，老师确认后保存。</p>
                  </div>
                  <Sparkles size={18} />
                </div>
                <div className="review-controls">
                  <label><CalendarRange size={16} />开始<input type="date" value={reviewForm.startDate} onChange={(event) => setReviewForm({ ...reviewForm, startDate: event.target.value })} /></label>
                  <label><BookOpenCheck size={16} />科目<input value={reviewForm.subject} onChange={(event) => setReviewForm({ ...reviewForm, subject: event.target.value })} /></label>
                </div>
                <label>结束日期<input type="date" value={reviewForm.endDate} onChange={(event) => setReviewForm({ ...reviewForm, endDate: event.target.value })} /></label>
                {activeReport ? (
                  <>
                    <textarea className="report-editor" value={activeReport.contentMd} onChange={(event) => setActiveReport({ ...activeReport, contentMd: event.target.value })} />
                    <label className="full report-summary-field">家长沟通版摘要<textarea value={activeReport.parentSummary} onChange={(event) => setActiveReport({ ...activeReport, parentSummary: event.target.value })} /></label>
                    <div className="quality-list">
                      {activeReport.qualityChecks.map((check) => (
                        <article key={check.key} className={check.passed ? 'passed' : 'failed'}>
                          <ShieldCheck size={15} />
                          <div>
                            <strong>{check.label}</strong>
                            <p>{check.detail}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </>
                ) : <div className="empty-state">选择时间范围后生成可编辑报告。</div>}
                <button className="primary-action wide" onClick={generateReview}><FileText size={16} />生成复盘</button>
                {activeReport ? <button className="secondary-action full-button" onClick={saveReport}>保存复盘</button> : null}
                <div className="report-list">
                  {reports.slice(0, 3).map((report) => <button key={report.id} onClick={() => setActiveReport(report)}>{report.title}</button>)}
                </div>
              </section>
            ) : null}

            {activeTool === 'profile' ? (
              <section className="panel flush">
                <div className="panel-heading tight">
                  <div>
                    <h2>{editingStudent ? '编辑学生档案' : '新建学生档案'}</h2>
                    <p>档案只记录老师实际需要长期追踪的信息。</p>
                  </div>
                  <Users size={18} />
                </div>
                <div className="form-grid">
                  <label className="full">显示名<input value={studentForm.displayName ?? ''} onChange={(event) => setStudentForm({ ...studentForm, displayName: event.target.value })} /></label>
                  <label>年级<input value={studentForm.grade ?? ''} onChange={(event) => setStudentForm({ ...studentForm, grade: event.target.value })} /></label>
                  <label>科目<input value={(studentForm.subjects ?? []).join('、')} onChange={(event) => setStudentForm({ ...studentForm, subjects: splitList(event.target.value) })} /></label>
                  <label className="full">阶段目标<input value={studentForm.goals ?? ''} onChange={(event) => setStudentForm({ ...studentForm, goals: event.target.value })} /></label>
                  <label className="full">当前问题<textarea value={studentForm.currentIssues ?? ''} onChange={(event) => setStudentForm({ ...studentForm, currentIssues: event.target.value })} /></label>
                  <label className="full">标签<input value={(studentForm.tags ?? []).join('、')} onChange={(event) => setStudentForm({ ...studentForm, tags: splitList(event.target.value) })} /></label>
                  <button className="primary-action wide" onClick={submitStudent}><Plus size={16} />{editingStudent ? '保存学生' : '创建学生'}</button>
                  {activeStudent ? <button className="secondary-action full-button" onClick={() => setEditingStudent(true)}>载入当前学生</button> : null}
                </div>
              </section>
            ) : null}

            {activeTool === 'system' ? (
              <section className="panel flush">
                <div className="panel-heading tight">
                  <div>
                    <h2>系统状态</h2>
                    <p>本地优先，云端同步和 AI 任务按完整方案预留。</p>
                  </div>
                  <Database size={18} />
                </div>
                <div className="system-list">
                  <span><Database size={16} />数据目录：{dataRoot}</span>
                  <span><Layers3 size={16} />统一标签：{overview.tagCount}</span>
                  <span><FileText size={16} />报告模板：{overview.reportTemplateCount}</span>
                  <span><UploadCloud size={16} />待同步：{overview.pendingSyncOperations}</span>
                  <span><Sparkles size={16} />AI 任务：{overview.pendingAiTasks}</span>
                  <span><Users size={16} />老师账号：{overview.teacherCount}</span>
                </div>
                {attachmentImport ? (
                  <div className="import-status-list">
                    {attachmentImport.status === 'copying' ? <strong>附件复制中...</strong> : null}
                    {attachmentImport.items.map((item) => (
                      <article key={`${item.sourcePath}-${item.fileName}`} className={item.ok ? 'passed' : 'failed'}>
                        <span>{item.ok ? '成功' : '失败'}</span>
                        <div>
                          <strong>{item.fileName}</strong>
                          <p>{item.ok ? formatBytes(item.fileSize) : item.errorMessage}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <p className="status-line">{status}</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
