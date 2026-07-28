import {
  Archive,
  BookOpenCheck,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  FolderOpen,
  HardDrive,
  History,
  PanelRightOpen,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  UploadCloud,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LearningRecord, ReviewReport, Student, StudentInput } from '../shared/contracts';

const recordTypeLabels: Record<string, string> = {
  class: '课堂',
  homework: '作业',
  exam: '试卷',
  mistake: '错题',
  communication: '沟通',
  summary: '阶段总结',
};

const todo = [
  ['done', '工程骨架：Electron + Vite + React + TypeScript'],
  ['done', '安全 IPC：Renderer 只通过 preload 调用 Main'],
  ['done', 'SQLite：students / learning_records / attachments / review_reports'],
  ['done', '学生档案：创建、编辑、归档、搜索'],
  ['done', '学习记录：类型、科目、正文、标签、时间线'],
  ['done', '附件管理：复制到学生目录，只入库元数据'],
  ['done', '阶段复盘：按范围聚合记录并生成可编辑 Markdown'],
  ['next', '本地搜索：学生和记录关键词检索，后续升级 FTS'],
];

const reviewChecks = [
  ['MVP 边界', '未引入账号、云同步、机构排课、家长端或学生端入口。'],
  ['本地优先', 'SQLite 保存结构化数据，附件复制到本机学生目录。'],
  ['教师可修正', '学生画像、学习记录和复盘 Markdown 都保留编辑入口。'],
  ['证据链', '复盘只聚合时间范围内真实学习记录和手动标签。'],
  ['演示闭环', '新建学生、加记录、挂附件、看时间线、生成复盘均已接入真实 IPC。'],
];

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
  const [dataRoot, setDataRoot] = useState('正在连接 Electron preload...');
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [reports, setReports] = useState<ReviewReport[]>([]);
  const [activeStudentId, setActiveStudentId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [recordKeyword, setRecordKeyword] = useState('');
  const [recordTypeFilter, setRecordTypeFilter] = useState('');
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
  const [status, setStatus] = useState('就绪：请从左侧选择或创建学生。');

  const activeStudent = useMemo(
    () => students.find((student) => student.id === activeStudentId) ?? students[0],
    [students, activeStudentId],
  );

  async function bootstrap() {
    const data = await window.omniEdu?.bootstrap();
    if (!data) throw new Error('Electron preload 未连接');
    setDataRoot(data.dataRoot);
    setStudents(data.students);
    setActiveStudentId((current) => current || data.students[0]?.id || '');
  }

  async function refreshStudents(query = studentQuery) {
    const nextStudents = await window.omniEdu?.listStudents(query);
    setStudents(nextStudents ?? []);
  }

  async function refreshRecords(studentId = activeStudent?.id) {
    if (!studentId) return;
    const nextRecords = await window.omniEdu?.listRecords(studentId, {
      type: recordTypeFilter || undefined,
      keyword: recordKeyword || undefined,
    });
    const nextReports = await window.omniEdu?.listReports(studentId);
    setRecords(nextRecords ?? []);
    setReports(nextReports ?? []);
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
  }, [activeStudent?.id, recordTypeFilter, recordKeyword]);

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
    setStatus(editingRecordId ? '学习记录已更新。' : '学习记录已保存到 SQLite。');
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
    setEditingRecordId(record.id);
    setRecordForm({
      recordType: record.recordType,
      subject: record.subject,
      title: record.title,
      content: record.content,
      tags: record.tags.join('、'),
      occurredAt: record.occurredAt.slice(0, 16),
    });
    setStatus('已载入学习记录，可在右侧修改后保存。');
  }

  async function importAttachment(recordId: string) {
    if (!activeStudent) return;
    const nextRecords = await window.omniEdu?.importAttachments(activeStudent.id, recordId);
    setRecords(nextRecords ?? []);
    await refreshStudents();
    setStatus('附件已复制到学生本地目录，数据库仅保存路径和元数据。');
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
      setStatus('复盘草稿已基于真实学习记录生成。');
    }
  }

  async function saveReport() {
    if (!activeReport) return;
    const saved = await window.omniEdu?.updateReport(activeReport.id, activeReport.contentMd);
    if (saved) {
      setActiveReport(saved);
      await refreshRecords();
      setStatus('复盘 Markdown 已保存。');
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="学生档案">
        <div className="brand-row">
          <div className="brand-mark">OE</div>
          <div>
            <strong>Omni-Edu Agent</strong>
            <span>本地学生档案</span>
          </div>
        </div>

        <div className="search-box">
          <Search size={16} />
          <input
            aria-label="搜索学生"
            placeholder="搜索姓名、年级、标签"
            value={studentQuery}
            onChange={(event) => {
              setStudentQuery(event.target.value);
              refreshStudents(event.target.value).catch(() => setStatus('学生搜索失败'));
            }}
          />
        </div>

        <button className="primary-action" onClick={() => {
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
                <span><ClipboardList size={14} />{student.recordCount} 条</span>
                <span><HardDrive size={14} />{formatBytes(student.attachmentBytes)}</span>
              </div>
            </button>
          ))}
        </section>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">第一阶段 MVP 工作台</span>
            <h1>{activeStudent ? `${activeStudent.displayName} 的长期学习档案` : '创建第一个学生档案'}</h1>
          </div>
          <div className="toolbar">
            <IconButton label="打开本地目录" onClick={() => activeStudent && window.omniEdu?.openStudentFolder(activeStudent.id)}><FolderOpen size={18} /></IconButton>
            <IconButton label="查看历史复盘"><History size={18} /></IconButton>
            <button className="secondary-action" onClick={async () => {
              if (!activeStudent) return;
              setStudents((await window.omniEdu?.archiveStudent(activeStudent.id)) ?? []);
              setStatus('学生已归档，未物理删除任何资料。');
            }}><Archive size={17} />归档</button>
          </div>
        </header>

        <div className="content-grid">
          <section className="main-column">
            <div className="profile-band">
              <div>
                <h2>学生画像</h2>
                <p>{activeStudent?.currentIssues || '先创建学生，补充当前问题、目标和标签。'}</p>
              </div>
              <div className="profile-stat">
                <span>阶段目标</span>
                <strong>{activeStudent?.goals || '暂无目标'}</strong>
              </div>
              <div className="profile-tags">
                {(activeStudent?.tags ?? []).map((tag) => <Badge key={tag} tone="blue">{tag}</Badge>)}
              </div>
            </div>

            <section className="flow-strip" aria-label="MVP 闭环">
              {['创建学生', '添加记录', '上传附件', '本地保存', '时间线查看', '生成复盘'].map((step, index) => (
                <div className="flow-step" key={step}>
                  <span>{index + 1}</span>
                  <strong>{step}</strong>
                </div>
              ))}
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>学习记录时间线</h2>
                  <p>按发生时间倒序展示，可按记录类型和关键词筛选。</p>
                </div>
                <div className="inline-actions">
                  <select value={recordTypeFilter} onChange={(event) => setRecordTypeFilter(event.target.value)}>
                    <option value="">全部类型</option>
                    {Object.entries(recordTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input placeholder="搜索记录" value={recordKeyword} onChange={(event) => setRecordKeyword(event.target.value)} />
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
                        <button className="secondary-action compact-button" onClick={() => editRecord(record)}>
                          编辑记录
                        </button>
                      </div>
                      <button className="upload-zone" onClick={() => importAttachment(record.id)}>
                        <UploadCloud size={18} />
                        导入附件并复制到学生目录
                      </button>
                    </div>
                  </article>
                ))}
                {!records.length ? <div className="empty-state">暂无学习记录，先在右侧添加一条课堂、作业或错题证据。</div> : null}
              </div>
            </section>
          </section>

          <aside className="context-panel" aria-label="操作面板">
            <section className="panel flush">
              <div className="panel-heading tight">
                <div>
                  <h2>{editingStudent ? '编辑学生档案' : '新建学生档案'}</h2>
                  <p>先让老师能在 5 秒内找到创建入口。</p>
                </div>
                <PanelRightOpen size={18} />
              </div>
              <div className="form-grid">
                <label className="full">显示名<input value={studentForm.displayName ?? ''} onChange={(event) => setStudentForm({ ...studentForm, displayName: event.target.value })} /></label>
                <label>年级<input value={studentForm.grade ?? ''} onChange={(event) => setStudentForm({ ...studentForm, grade: event.target.value })} /></label>
                <label>科目<input value={(studentForm.subjects ?? []).join('、')} onChange={(event) => setStudentForm({ ...studentForm, subjects: splitList(event.target.value) })} /></label>
                <label className="full">阶段目标<input value={studentForm.goals ?? ''} onChange={(event) => setStudentForm({ ...studentForm, goals: event.target.value })} /></label>
                <label className="full">当前问题<textarea value={studentForm.currentIssues ?? ''} onChange={(event) => setStudentForm({ ...studentForm, currentIssues: event.target.value })} /></label>
                <label className="full">标签<input value={(studentForm.tags ?? []).join('、')} onChange={(event) => setStudentForm({ ...studentForm, tags: splitList(event.target.value) })} /></label>
                <button className="primary-action wide" onClick={submitStudent}><Plus size={16} />{editingStudent ? '保存学生' : '创建学生'}</button>
                {activeStudent ? <button className="secondary-action full-button" onClick={() => setEditingStudent(true)}>载入当前学生编辑</button> : null}
              </div>
            </section>

            <section className="panel flush">
              <div className="panel-heading tight">
                <div>
                  <h2>添加学习记录</h2>
                  <p>{editingRecordId ? '正在编辑已保存记录，附件会继续保留。' : '教师输入优先，AI 后续只做辅助归纳。'}</p>
                </div>
                <PanelRightOpen size={18} />
              </div>
              <div className="form-grid">
                <label>记录类型<select value={recordForm.recordType} onChange={(event) => setRecordForm({ ...recordForm, recordType: event.target.value })}>{Object.entries(recordTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label>科目<input value={recordForm.subject} onChange={(event) => setRecordForm({ ...recordForm, subject: event.target.value })} /></label>
                <label className="full">标题<input value={recordForm.title} onChange={(event) => setRecordForm({ ...recordForm, title: event.target.value })} /></label>
                <label className="full">正文<textarea value={recordForm.content} onChange={(event) => setRecordForm({ ...recordForm, content: event.target.value })} /></label>
                <label className="full">标签<input value={recordForm.tags} onChange={(event) => setRecordForm({ ...recordForm, tags: event.target.value })} placeholder="一次函数、审题、计算粗心" /></label>
                <button className="primary-action wide" onClick={submitRecord}><Plus size={16} />{editingRecordId ? '保存记录修改' : '保存学习记录'}</button>
                {editingRecordId ? <button className="secondary-action full-button" onClick={resetRecordForm}>取消编辑</button> : null}
              </div>
            </section>

            <section className="panel flush review-card">
              <div className="panel-heading tight">
                <div>
                  <h2>阶段复盘草稿</h2>
                  <p>模板生成，老师编辑确认后保存。</p>
                </div>
                <Sparkles size={18} />
              </div>
              <div className="review-controls">
                <label><CalendarRange size={16} />开始<input type="date" value={reviewForm.startDate} onChange={(event) => setReviewForm({ ...reviewForm, startDate: event.target.value })} /></label>
                <label><BookOpenCheck size={16} />科目<input value={reviewForm.subject} onChange={(event) => setReviewForm({ ...reviewForm, subject: event.target.value })} /></label>
              </div>
              <label>结束日期<input type="date" value={reviewForm.endDate} onChange={(event) => setReviewForm({ ...reviewForm, endDate: event.target.value })} /></label>
              {activeReport ? (
                <textarea className="report-editor" value={activeReport.contentMd} onChange={(event) => setActiveReport({ ...activeReport, contentMd: event.target.value })} />
              ) : (
                <div className="markdown-preview">
                  <strong>等待生成</strong>
                  <p>系统会统计标签、记录类型，并列出真实证据，生成可编辑 Markdown。</p>
                </div>
              )}
              <button className="primary-action wide" onClick={generateReview}><FileText size={16} />生成可编辑 Markdown</button>
              {activeReport ? <button className="secondary-action full-button" onClick={saveReport}>保存复盘</button> : null}
              <div className="report-list">
                {reports.slice(0, 3).map((report) => <button key={report.id} onClick={() => setActiveReport(report)}>{report.title}</button>)}
              </div>
            </section>

            <section className="panel flush">
              <div className="panel-heading tight">
                <div>
                  <h2>本地存储状态</h2>
                  <p>大文件只保留路径和元数据。</p>
                </div>
                <Database size={18} />
              </div>
              <div className="storage-list">
                <span><ShieldCheck size={16} />离线可用</span>
                <span><HardDrive size={16} />应用数据目录：{dataRoot}</span>
                <span><FolderOpen size={16} />学生目录：{activeStudent ? `students/${activeStudent.id}` : '待创建'}</span>
                <span><FileText size={16} />状态：{status}</span>
              </div>
            </section>
          </aside>
        </div>
      </section>

      <aside className="audit-panel" aria-label="对抗性审查">
        <div className="panel-heading tight">
          <div>
            <span className="eyebrow">Adversarial Review</span>
            <h2>对抗性审查</h2>
          </div>
          <CheckCircle2 size={19} />
        </div>
        <div className="audit-list">
          {reviewChecks.map(([title, body]) => (
            <article key={title}>
              <CheckCircle2 size={16} />
              <div>
                <strong>{title}</strong>
                <p>{body}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="todo-block">
          <h3>开发 Todo</h3>
          {todo.map(([state, item]) => <label key={item}><input type="checkbox" checked={state === 'done'} readOnly />{item}</label>)}
        </div>
      </aside>
    </main>
  );
}
