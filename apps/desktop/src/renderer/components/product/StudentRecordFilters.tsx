import {useState, type ReactNode} from 'react';
import {Button} from '@heroui/react';
import {ChevronDown} from 'lucide-react';
import styles from '../../ui-system/student-settings/student-workbench.module.css';

/** Disclosure only. All filter values and handlers remain owned by App. */
export function StudentRecordFilters({children, plain}: {children: ReactNode; plain: boolean}) {
  const [expanded, setExpanded] = useState(false);
  if (!plain) return <>{children}</>;
  return <div className={styles.recordFilters}>
    <Button variant="ghost" data-testid="student-record-filters-toggle" aria-expanded={expanded} aria-controls="student-record-filters" onPress={() => setExpanded(!expanded)}>筛选记录<ChevronDown size={16}/></Button>
    <div id="student-record-filters" hidden={!expanded}>{children}</div>
  </div>;
}
