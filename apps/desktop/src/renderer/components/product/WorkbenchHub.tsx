import type {ReactNode} from 'react';
import {WorkbenchPageNavigation} from './WorkbenchPageNavigation';
import styles from '../../ui-system/u5-workbench.module.css';
import studentStyles from '../../ui-system/student-settings/student-workbench.module.css';
import {TeachingPageLayout} from './TeachingPageLayout';

/** The host retains domain state and guarded routes; this is only a page shell. */
export function WorkbenchHub({kind, children}: {kind: 'teaching' | 'students'; children: ReactNode}) {
  if (kind === 'students') return <section className={studentStyles.hub} aria-label="学生工作台" data-testid="workbench-hub-students">{children}</section>;
  return <section className={styles.hub} aria-label={kind === 'teaching' ? '教学工作台' : '学生工作台'} data-testid={`workbench-hub-${kind}`}>
    <TeachingPageLayout>
    {kind === 'teaching' && <WorkbenchPageNavigation view="teaching"/>}
    {children}
    </TeachingPageLayout>
  </section>;
}
