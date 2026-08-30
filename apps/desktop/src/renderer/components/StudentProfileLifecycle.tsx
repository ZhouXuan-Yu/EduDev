import { Archive, CheckCircle2, FileDown, FolderOpen, LoaderCircle, Pencil, ShieldAlert, UserPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ExportStudentResult, Student, StudentInput } from '../../shared/contracts';

export type StudentFormMode = 'closed' | 'create' | 'edit';

type ActionFeedback = {
  tone: 'success' | 'error' | 'neutral';
  message: string;
  exportResult?: ExportStudentResult;
};

type Props = {
  activeStudent?: Student;
  formMode: StudentFormMode;
  form: StudentInput;
  onFormChange: (form: StudentInput) => void;
  onSave: () => Promise<void>;
  onStartEdit: () => void;
  onCancelForm: () => void;
  onStudentsChanged: (students: Student[], archivedStudentId: string) => Promise<void> | void;
  setStatus: (message: string) => void;
};

function splitList(value: string) {
  return value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean);
}

export function StudentProfileLifecycle({
  activeStudent,
  formMode,
  form,
  onFormChange,
  onSave,
  onStartEdit,
  onCancelForm,
  onStudentsChanged,
  setStatus,
}: Props) {
  const [busyAction, setBusyAction] = useState<'open' | 'export' | 'archive' | 'save' | ''>('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  useEffect(() => {
    setConfirmArchive(false);
    // Creating a student changes activeStudent.id before the save promise
    // settles. Keep that in-flight feedback alive; other student switches
    // still clear operation state to avoid cross-profile messages.
    if (busyAction === 'save') return;
    setFeedback(null);
    setBusyAction('');
  }, [activeStudent?.id]);

  const archived = activeStudent?.status === 'archived';

  async function openFolder() {
    if (!activeStudent || busyAction) return;
    setBusyAction('open');
    setFeedback(null);
    try {
      const result = await window.omniEdu?.openStudentFolder(activeStudent.id);
      if (typeof result === 'string' && result) throw new Error(result);
      const message = `已打开 ${activeStudent.displayName} 的本地档案目录。`;
      setFeedback({ tone: 'success', message });
      setStatus(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : '打开学生目录失败。';
      setFeedback({ tone: 'error', message });
      setStatus(message);
    } finally {
      setBusyAction('');
    }
  }

  async function exportArchive() {
    if (!activeStudent || busyAction) return;
    setBusyAction('export');
    setFeedback(null);
    try {
      const result = await window.omniEdu?.exportStudent(activeStudent.id);
      if (!result) {
        const message = '已取消学生档案导出，未写入目标目录。';
        setFeedback({ tone: 'neutral', message });
        setStatus(message);
        return;
      }
      const message = `学生档案导出完成，共 ${result.fileCount} 个文件。`;
      setFeedback({ tone: 'success', message, exportResult: result });
      setStatus(`${message} ${result.exportPath}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '导出学生档案失败。';
      setFeedback({ tone: 'error', message });
      setStatus(message);
    } finally {
      setBusyAction('');
    }
  }

  async function archiveStudent() {
    if (!activeStudent || archived || busyAction) return;
    setBusyAction('archive');
    setFeedback(null);
    try {
      const students = await window.omniEdu?.archiveStudent(activeStudent.id);
      if (!students) throw new Error('当前运行环境没有可用的学生归档通道。');
      await onStudentsChanged(students, activeStudent.id);
      setConfirmArchive(false);
      const message = `${activeStudent.displayName} 已归档；记录和附件仍保留在本机。`;
      setFeedback({ tone: 'success', message });
      setStatus(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : '归档学生失败。';
      setFeedback({ tone: 'error', message });
      setStatus(message);
    } finally {
      setBusyAction('');
    }
  }

  async function saveStudent() {
    if (busyAction) return;
    setBusyAction('save');
    setFeedback(null);
    try {
      await onSave();
      const message = formMode === 'edit' ? '学生档案已更新。' : '学生档案已创建。';
      setFeedback({ tone: 'success', message });
      setStatus(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存学生档案失败。';
      setFeedback({ tone: 'error', message });
      setStatus(message);
    } finally {
      setBusyAction('');
    }
  }

  return (
    <div className="student-profile-lifecycle" data-testid="student-profile-lifecycle">
      {!activeStudent ? (
        <section className="student-lifecycle-state" data-testid="student-lifecycle-no-student">
          <UserPlus size={20} />
          <div><strong>尚未选择学生</strong><p>可从左侧选择档案，或新建本地学生档案。</p></div>
        </section>
      ) : (
        <>
          <section className="profile-grid" data-testid="student-profile-readback">
            <article className="profile-block primary">
              <div className="student-profile-heading">
                <div><span className="workspace-number">02</span><strong>{activeStudent.displayName}</strong></div>
                <span className={`student-status-chip ${archived ? 'archived' : 'active'}`} data-testid={`student-status-${activeStudent.status}`}>
                  {archived ? '已归档' : '在读'}
                </span>
              </div>
              <div className="profile-line"><span>年级</span><strong>{activeStudent.grade || '未填写'}</strong></div>
              <div className="profile-line"><span>科目</span><strong>{activeStudent.subjects.length ? activeStudent.subjects.join(' / ') : '未填写'}</strong></div>
              <div className="profile-tags">
                {activeStudent.tags.length ? activeStudent.tags.map((tag) => <span className="badge" key={tag}>{tag}</span>) : <span className="badge">未设置标签</span>}
              </div>
            </article>
            <article className="profile-block"><h3>当前问题</h3><p>{activeStudent.currentIssues || '还没有记录当前问题。'}</p></article>
            <article className="profile-block"><h3>阶段目标</h3><p>{activeStudent.goals || '还没有设置阶段目标。'}</p></article>
            <article className="profile-block"><h3>家长关注点</h3><p>{activeStudent.parentConcerns || '还没有记录家长关注点。'}</p></article>
          </section>

          <section className="student-lifecycle-panel" data-testid="student-lifecycle-actions">
            <div>
              <span className="workspace-number">03</span>
              <div><strong>档案生命周期</strong><p>{archived ? '归档档案只读保留；当前没有恢复接口。' : '编辑、导出和归档都通过本地主进程执行。'}</p></div>
            </div>
            <div className="student-lifecycle-buttons">
              <button data-testid="student-edit" className="secondary-action" disabled={archived || Boolean(busyAction)} onClick={onStartEdit}><Pencil size={16} />编辑</button>
              <button data-testid="student-open-folder" className="secondary-action" disabled={Boolean(busyAction)} onClick={openFolder}>{busyAction === 'open' ? <LoaderCircle className="spin" size={16} /> : <FolderOpen size={16} />}打开目录</button>
              <button data-testid="student-export" className="secondary-action" disabled={Boolean(busyAction)} onClick={exportArchive}>{busyAction === 'export' ? <LoaderCircle className="spin" size={16} /> : <FileDown size={16} />}导出</button>
              <button data-testid="student-archive" className="danger-action" disabled={archived || Boolean(busyAction)} onClick={() => { setConfirmArchive(true); setFeedback(null); }}><Archive size={16} />归档</button>
            </div>
          </section>

          {confirmArchive ? (
            <section className="student-archive-confirm" data-testid="student-archive-confirmation">
              <ShieldAlert size={20} />
              <div><strong>确认归档 {activeStudent.displayName}？</strong><p>不会删除记录或附件，但归档后该学生不再作为其他业务页面的当前可写学生。</p></div>
              <button data-testid="student-archive-cancel" className="secondary-action" disabled={busyAction === 'archive'} onClick={() => setConfirmArchive(false)}><X size={16} />取消</button>
              <button data-testid="student-archive-confirm" className="danger-action" disabled={busyAction === 'archive'} onClick={archiveStudent}>{busyAction === 'archive' ? <LoaderCircle className="spin" size={16} /> : <Archive size={16} />}确认归档</button>
            </section>
          ) : null}
        </>
      )}

      {feedback ? (
        <section className={`student-lifecycle-feedback ${feedback.tone}`} data-testid={`student-lifecycle-feedback-${feedback.tone}`} aria-live="polite">
          {feedback.tone === 'success' ? <CheckCircle2 size={18} /> : feedback.tone === 'error' ? <ShieldAlert size={18} /> : <X size={18} />}
          <div><strong>{feedback.message}</strong>{feedback.exportResult ? <code data-testid="student-export-path">{feedback.exportResult.exportPath}</code> : null}</div>
        </section>
      ) : null}

      {formMode !== 'closed' ? (
        <section className="work-panel form-panel student-profile-form" data-testid="student-profile-form">
          <div className="student-form-heading">
            <div><span className="workspace-number">04</span><div><strong>{formMode === 'edit' ? '编辑学生档案' : '新建学生档案'}</strong><p>只记录老师需要长期追踪的信息，保存到本机 SQLite。</p></div></div>
            <button data-testid="student-form-cancel" aria-label="取消学生档案编辑" className="icon-action" disabled={busyAction === 'save'} onClick={onCancelForm}><X size={18} /></button>
          </div>
          <div className="form-grid">
            <label className="full">显示名<input data-testid="student-form-display-name" value={form.displayName ?? ''} onChange={(event) => onFormChange({ ...form, displayName: event.target.value })} /></label>
            <label>真实姓名<input data-testid="student-form-real-name" value={form.realName ?? ''} onChange={(event) => onFormChange({ ...form, realName: event.target.value })} /></label>
            <label>年级<input data-testid="student-form-grade" value={form.grade ?? ''} onChange={(event) => onFormChange({ ...form, grade: event.target.value })} /></label>
            <label>学校<input value={form.school ?? ''} onChange={(event) => onFormChange({ ...form, school: event.target.value })} /></label>
            <label>科目<input value={(form.subjects ?? []).join('、')} onChange={(event) => onFormChange({ ...form, subjects: splitList(event.target.value) })} /></label>
            <label className="full">阶段目标<input value={form.goals ?? ''} onChange={(event) => onFormChange({ ...form, goals: event.target.value })} /></label>
            <label className="full">当前问题<textarea value={form.currentIssues ?? ''} onChange={(event) => onFormChange({ ...form, currentIssues: event.target.value })} /></label>
            <label className="full">家长关注点<textarea value={form.parentConcerns ?? ''} onChange={(event) => onFormChange({ ...form, parentConcerns: event.target.value })} /></label>
            <label className="full">教师备注<textarea value={form.teacherNotes ?? ''} onChange={(event) => onFormChange({ ...form, teacherNotes: event.target.value })} /></label>
            <label className="full">标签<input value={(form.tags ?? []).join('、')} onChange={(event) => onFormChange({ ...form, tags: splitList(event.target.value) })} /></label>
            <button data-testid="student-form-save" className="primary-action wide" disabled={busyAction === 'save'} onClick={saveStudent}>{busyAction === 'save' ? <LoaderCircle className="spin" size={16} /> : formMode === 'edit' ? <Pencil size={16} /> : <UserPlus size={16} />}{formMode === 'edit' ? '保存学生' : '创建学生'}</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
