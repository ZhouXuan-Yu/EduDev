import type {Student} from '../../../shared/contracts';
import styles from '../../ui-system/student-settings/student-workbench.module.css';

/** A read-only projection of the current SQLite-backed student. */
export function StudentProfileOverview({student, expanded}: {student: Student; expanded: boolean}) {
  return <section className={styles.profileOverview} data-testid="student-profile-readback" aria-label={`${student.displayName}的档案`}>
    <dl className={styles.profileFacts}>
      <div><dt>年级</dt><dd>{student.grade || '未填写'}</dd></div>
      <div><dt>学科</dt><dd>{student.subjects.join(' / ') || '未填写'}</dd></div>
      <div><dt>当前关注</dt><dd>{student.currentIssues || '还没有记录当前关注。'}</dd></div>
      <div><dt>资料范围</dt><dd>{student.displayName}的学习记录与教师备注</dd></div>
    </dl>
    <section className={styles.teacherNotes}><h3>教师备注</h3><p>{student.teacherNotes || '还没有记录教师备注。'}</p></section>
    <span className={styles.profileStatus} data-testid={`student-status-${student.status}`}>{student.status === 'archived' ? '已归档 · 档案只读保留' : '在读'}</span>
    {expanded && <dl className={styles.profileFacts} data-testid="student-profile-additional-facts">
      <div><dt>阶段目标</dt><dd>{student.goals || '还没有设置阶段目标。'}</dd></div>
      <div><dt>家长关注点</dt><dd>{student.parentConcerns || '还没有记录家长关注点。'}</dd></div>
      <div><dt>标签</dt><dd>{student.tags.join('、') || '未设置标签'}</dd></div>
    </dl>}
  </section>;
}
