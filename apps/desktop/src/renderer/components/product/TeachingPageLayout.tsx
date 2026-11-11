import {createContext, useContext, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import styles from '../../ui-system/workbench-page-navigation.module.css';

const TeachingActionTarget = createContext<HTMLDivElement | null>(null);

/** The page owns placement. Each domain retains its original action and state. */
export function TeachingPageLayout({children}: {children: ReactNode}) {
  const [actionTarget, setActionTarget] = useState<HTMLDivElement | null>(null);
  return <TeachingActionTarget.Provider value={actionTarget}>
    <header className={styles.heading} data-testid="teaching-page-heading">
      <div><h1>教学工作台</h1><p>围绕教学文件与课堂成果继续工作。</p></div>
      <div ref={setActionTarget} className={styles.actions} data-testid="teaching-page-actions"/>
    </header>
    {children}
  </TeachingActionTarget.Provider>;
}

/** Direct domain callers retain the action inline when no page slot is present. */
export function TeachingPageAction({children}: {children: ReactNode}) {
  const target = useContext(TeachingActionTarget);
  return target ? createPortal(children, target) : children;
}
