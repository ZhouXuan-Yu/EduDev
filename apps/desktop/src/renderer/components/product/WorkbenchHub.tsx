import type {ReactNode} from 'react';
import {WorkbenchPageNavigation} from './WorkbenchPageNavigation';
import styles from '../../ui-system/u5-workbench.module.css';

/** The host retains domain state and guarded routes; this is only a page shell. */
export function WorkbenchHub({kind, children}: {kind: 'teaching' | 'students'; children: ReactNode}) {
  return <section className={styles.hub} aria-label={kind === 'teaching' ? '教学工作台' : '学生工作台'} data-testid={`workbench-hub-${kind}`}>
    <header className={styles.heading}><h1>{kind === 'teaching' ? '教学工作台' : '学生工作台'}</h1>
      <p>{kind === 'teaching' ? '整理教学文件，继续备课、讲义与组卷。' : '先选择学生，再围绕真实记录安排教学。'}</p></header>
    {kind === 'teaching' && <WorkbenchPageNavigation view="teaching"/>}
    {children}
  </section>;
}
