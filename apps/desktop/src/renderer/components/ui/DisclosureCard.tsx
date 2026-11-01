import type {ReactNode} from 'react';
import {Card, Disclosure, type DisclosureRootProps} from '@heroui/react';
import styles from '../../ui-system/disclosure-card.module.css';

export type DisclosureCardProps = Omit<DisclosureRootProps, 'title' | 'children' | 'className' | 'id' | 'dangerouslySetInnerHTML'> & {
  title: ReactNode;
  children: ReactNode;
  /** Applied to the official outer Card; other root props target Disclosure.Root. */
  className?: string;
  /** Real DOM anchor on Card; also retains the official DisclosureGroup item key. */
  id?: string;
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Applied through Disclosure.Body's official className API. */
  bodyClassName?: string;
  'data-testid'?: string;
};

/** A settings/domain disclosure, with HeroUI owning state, focus and animations.
 * Content stays mounted while collapsed, preserving nested form and async state.
 * Titles must be non-interactive: the official trigger is already a button.
 */
export function DisclosureCard({title, children, className, id, headingLevel = 3, bodyClassName, ...rootProps}: DisclosureCardProps) {
  return <Card.Root id={id} className={[styles.card, className].filter(Boolean).join(' ')}>
    <Disclosure.Root {...rootProps} id={id}>
      <Disclosure.Heading level={headingLevel}>
        <Disclosure.Trigger className={styles.trigger}><span className={styles.title}>{title}</span><Disclosure.Indicator className={styles.indicator}/></Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className={bodyClassName}>{children}</Disclosure.Body>
      </Disclosure.Content>
    </Disclosure.Root>
  </Card.Root>;
}
