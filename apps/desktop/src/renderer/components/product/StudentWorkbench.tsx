import {useState, type ReactNode} from 'react';
import {Folder} from 'lucide-react';
import type {Student} from '../../../shared/contracts';
import {StudentContextNavigation, StudentRecordNavigation, type StudentContextTab} from './StudentContextNavigation';
import styles from '../../ui-system/student-settings/student-workbench.module.css';

const selectionPreference = 'edudev.ui.student-context.v1';
function readSelection() {
  try {return sessionStorage.getItem(selectionPreference) || '';} catch {return '';}
}
/** Record only an explicit user selection; never infer one from App's fallback student. */
export function rememberStudentContext(studentId: string) {
  try {sessionStorage.setItem(selectionPreference, studentId);} catch { /* Preference only; domain state remains in App. */ }
}
export function canShowStudentContext(selectedId: string, currentId: string | undefined) {
  return !!selectedId && selectedId === currentId;
}

/** Only disclosure state lives here. Selection, CRUD, loading and unsaved guards stay in App. */
export function StudentWorkbench({student, directory, createAction, profile, records, creating}: {
  student?: Student;
  directory: (onSelected: (studentId: string) => void) => ReactNode;
  createAction: ReactNode;
  profile: ReactNode;
  records: ReactNode;
  creating: boolean;
}) {
  const [revealedId, setRevealedId] = useState(readSelection);
  const [tab, setTab] = useState<StudentContextTab>('profile');
  function reveal(studentId: string) {
    setRevealedId(studentId);
    rememberStudentContext(studentId);
    setTab('profile');
  }
  const selected = canShowStudentContext(revealedId, student?.id);
  return <section className={styles.workbench} data-testid="student-workbench-layout">
    <header className={styles.heading}>
      <div><h1>学生工作台</h1><p>先选择学生，再围绕学习记录安排下一步教学。</p></div>
      <div className={styles.createAction}>{createAction}</div>
    </header>
    <div className={styles.studentLayout}>
      <div className={styles.directory}>
        {directory(reveal)}
      </div>
      <div className={styles.detail}>
        {selected || creating ? <>
          {!creating && student && <>
            <header className={styles.context}><h2>{student.displayName}</h2><p>{student.grade || '未填年级'} · {student.subjects.join(' / ') || '未填科目'}</p></header>
            <StudentContextNavigation active={tab} onSelect={setTab}/>
          </>}
          <section id="student-context-panel" role="tabpanel" aria-labelledby={`student-context-tab-${tab}`}>
            {tab === 'records' && !creating ? <><StudentRecordNavigation/>{records}</> : profile}
          </section>
        </> : <div className={styles.empty} data-testid="student-workbench-empty">
          <Folder size={28} aria-hidden="true"/>
          <h2>选择一位学生</h2>
          <p>查看该学生的档案、学习记录、错题与计划。也可以先创建一份档案。</p>
        </div>}
      </div>
    </div>
  </section>;
}
