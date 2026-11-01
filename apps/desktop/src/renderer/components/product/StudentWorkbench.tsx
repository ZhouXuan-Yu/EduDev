import {useState, type ReactNode} from 'react';
import type {Student} from '../../../shared/contracts';
import {WorkbenchPageNavigation} from './WorkbenchPageNavigation';
import styles from '../../ui-system/u5-workbench.module.css';

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
export function StudentWorkbench({student, directory, children, creating}: {
  student?: Student; directory: (onSelected: (studentId: string) => void) => ReactNode; children: ReactNode; creating: boolean;
}) {
  const [revealedId, setRevealedId] = useState(readSelection);
  function reveal(studentId: string) {
    setRevealedId(studentId);
    rememberStudentContext(studentId);
  }
  return <section className={styles.studentLayout} data-testid="student-workbench-layout">
    <div className={styles.directory}>{directory(reveal)}</div>
    <div className={styles.detail}>
      <WorkbenchPageNavigation view="students"/>
      {(canShowStudentContext(revealedId, student?.id)) || creating ? <>
        {!creating && student && <header className={styles.context}><strong>{student.displayName}</strong><span>{student.grade || '未填年级'} · {student.subjects.join(' / ') || '未填科目'}</span></header>}
        {children}
      </> : <div className={styles.empty} data-testid="student-workbench-empty"><h2>选择一位学生</h2><p>搜索或选择左侧档案，查看学习记录、错题、计划与复盘。</p><p>还没有档案？使用左侧“新建学生”开始。</p></div>}
    </div>
  </section>;
}
