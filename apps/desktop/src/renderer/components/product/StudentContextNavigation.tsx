import {Button} from '@heroui/react';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import styles from '../../ui-system/student-settings/student-workbench.module.css';

export type StudentContextTab = 'profile' | 'records';

const routes = [
  ['mistakes', '错题与练习'],
  ['mastery', '学习计划'],
  ['review', '学习复盘'],
  ['analytics', '学习概览'],
] as const;

/** Two local presentation tabs, plus the existing guarded domain routes. */
export function StudentContextNavigation({active, onSelect}: {
  active: StudentContextTab;
  onSelect: (tab: StudentContextTab) => void;
}) {
  const navigation = useDesktopNavigation();
  return <nav className={styles.contextNavigation} aria-label="学生工作台页内导航" data-testid="student-page-navigation">
    <div className={styles.contextTabs} role="tablist" aria-label="学生信息">
      {([['profile', '档案'], ['records', '学习记录']] as const).map(([id, label]) =>
        <button key={id} type="button" role="tab" id={`student-context-tab-${id}`} data-testid={`student-context-tab-${id}`}
          aria-selected={active === id} aria-controls="student-context-panel" className={styles.contextTab} onClick={() => onSelect(id)}>{label}</button>)}
      {routes.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={false}
        className={styles.contextTab} data-testid={`hub-entry-${id}`} onClick={() => navigation.navigate({view: id})}>{label}</button>)}
    </div>
  </nav>;
}

export function StudentRecordNavigation() {
  const navigation = useDesktopNavigation();
  return <div className={styles.recordActions} aria-label="学习记录操作">
    <Button variant="ghost" data-testid="hub-entry-search" onPress={() => navigation.navigate({view: 'search'})}>查找记录</Button>
    <Button data-testid="hub-entry-intake" onPress={() => navigation.navigate({view: 'intake'})}>添加记录</Button>
  </div>;
}

export function StudentFullProfileAction() {
  const navigation = useDesktopNavigation();
  return <Button variant="ghost" data-testid="hub-entry-students" onPress={() => navigation.navigate({view: 'students'})}>完整档案与历史</Button>;
}
