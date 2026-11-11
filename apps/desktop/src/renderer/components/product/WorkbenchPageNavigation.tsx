import {Button} from '@heroui/react';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import styles from '../../ui-system/u5-workbench.module.css';
import teachingStyles from '../../ui-system/workbench-page-navigation.module.css';

export const teachingPages = [
  ['artifacts', '教学文件'], ['notebook', '备课本'], ['book', '讲义'],
  ['question_notebook', '题本'], ['paper', '组卷'],
] as const;
export const studentPages = [
  ['students', '档案与记录'], ['search', '查找记录'], ['intake', '添加记录'],
  ['mistakes', '错题与练习'], ['mastery', '学习计划'], ['review', '学习复盘'], ['analytics', '学习概览'],
] as const;
export function isStudentPage(view: string) {return studentPages.some(([id]) => id === view);}
export function isTeachingPage(view: string) {return teachingPages.some(([id]) => id === view);}
/** Navigation links, not local tabs: original route guards and browser history remain authoritative. */
export function WorkbenchPageNavigation({view}: {view: string}) {
  const navigation = useDesktopNavigation();
  if (view === 'teaching' || isTeachingPage(view)) {
    return <nav className={teachingStyles.navigation} aria-label="教学工作台页内导航" data-testid="teaching-page-navigation">
      {teachingPages.map(([id, label]) => <button key={id} type="button" className={teachingStyles.item}
        aria-current={view === id || view === 'teaching' && id === 'artifacts' ? 'page' : undefined}
        data-testid={`hub-entry-${id}`} onClick={() => navigation.navigate({view: id})}>{label}</button>)}
    </nav>;
  }
  const students = isStudentPage(view);
  const entries = students ? studentPages : teachingPages;
  return <nav className={styles.navigation} aria-label={students ? '学生工作台页内导航' : '教学工作台页内导航'} data-testid={students ? 'student-page-navigation' : 'teaching-page-navigation'}>
    {entries.map(([id, label]) => <Button key={id} size="sm" variant={view === id || view === 'teaching' && id === 'artifacts' ? 'secondary' : 'ghost'} aria-current={view === id || view === 'teaching' && id === 'artifacts' ? 'page' : undefined} data-testid={`hub-entry-${id}`} onPress={() => navigation.navigate({view: id})}>{label}</Button>)}
  </nav>;
}
