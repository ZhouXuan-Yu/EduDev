import type {ReactNode} from 'react';
import {ChevronLeft} from 'lucide-react';
import styles from '../../ui-system/paper-studio/paper-studio.module.css';

type PaperStudioHeadingProps = {
  backDisabled: boolean;
  onBack: () => void;
  context?: string;
  children: ReactNode;
};

export function PaperStudioHeading({backDisabled, onBack, context, children}: PaperStudioHeadingProps) {
  return <header className={styles.heading}>
    <div className={styles.headingContext}>
      <button type="button" className={styles.backNavigation} data-testid="paper-basket-back-teaching"
        disabled={backDisabled} onClick={onBack}>
        <ChevronLeft size={14} aria-hidden="true"/>
        教学工作台
      </button>
      <h1 className={styles.title}>出题与组卷</h1>
      {context && <small className={styles.headingSummary}>{context}</small>}
    </div>
    <div className={styles.headingActions}>{children}</div>
  </header>;
}
