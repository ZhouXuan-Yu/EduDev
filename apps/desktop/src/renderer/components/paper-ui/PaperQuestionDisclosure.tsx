import {useState, type ReactNode} from 'react';
import {Disclosure} from '@heroui/react';
import styles from '../../ui-system/paper-studio/paper-studio.module.css';

/** Compact official disclosure composition, with application-owned text and layout. */
export function PaperQuestionDisclosure({title, children, defaultExpanded = false, 'data-testid': testId}: {
  title: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  'data-testid'?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return <section className={styles.detailItem} data-expanded={expanded}>
    <Disclosure.Root isExpanded={expanded} onExpandedChange={setExpanded} data-testid={testId}>
      <Disclosure.Heading level={4}>
        <Disclosure.Trigger>
          <span className={styles.detailLabel}><span className={styles.detailText}>{title}</span><Disclosure.Indicator/></span>
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body><div className={styles.detailBody}>{children}</div></Disclosure.Body>
      </Disclosure.Content>
    </Disclosure.Root>
  </section>;
}
