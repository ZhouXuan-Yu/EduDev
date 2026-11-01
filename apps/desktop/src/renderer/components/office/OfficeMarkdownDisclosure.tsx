import {Children, createContext, isValidElement, useContext, useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode, type RefObject} from 'react';
import {DisclosureCard} from '../ui/DisclosureCard';

export type OfficeMarkdownDisclosureState = {htmlOpen: boolean; expanded: boolean; identity: string; restoreFocus?: boolean};
export const OfficeMarkdownDisclosureScope = createContext<{
  root: RefObject<HTMLDivElement | null>;
  states: Map<number, OfficeMarkdownDisclosureState>;
} | null>(null);
const marker = '[data-office-markdown-disclosure]';

type MarkdownNode = {tagName?: string};
type SummaryProps = ComponentPropsWithoutRef<'span'> & {node?: MarkdownNode};
type DetailsProps = ComponentPropsWithoutRef<'details'> & {node?: MarkdownNode};

/** An inert marker for the parent adapter; orphan summaries retain their content. */
export function OfficeMarkdownSummary({children, node: _node, ...props}: SummaryProps) {
  return <span {...props}>{children}</span>;
}

function titleText(children: ReactNode): string {
  return Children.toArray(children).map(child => {
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    if (!isValidElement<{children?: ReactNode; alt?: string}>(child)) return '';
    return child.props.alt ?? titleText(child.props.children);
  }).join('');
}

/** Only app-owned Markdown HTML is adapted: the upstream sanitizer still runs.
 * Rich summary content stays in the mounted body, outside the trigger button.
 * Module-level renderers keep Disclosure state stable across streaming updates.
 */
export function OfficeMarkdownDisclosure({children, open, id, className}: DetailsProps) {
  const scope = useContext(OfficeMarkdownDisclosureScope);
  const wrapper = useRef<HTMLDivElement>(null);
  const htmlOpen = Boolean(open);
  const parts = Children.toArray(children);
  const index = parts.findIndex(child => isValidElement<SummaryProps>(child)
    && (child.type === OfficeMarkdownSummary || child.props.node?.tagName === 'summary'));
  const summary = index < 0 ? undefined : parts[index];
  const summaryChildren = isValidElement<SummaryProps>(summary) ? summary.props.children : undefined;
  const richSummary = Children.toArray(summaryChildren).some(child => isValidElement(child));
  const [expanded, setExpanded] = useState(htmlOpen);
  const lastHtmlOpen = useRef(htmlOpen);
  const position = () => {
    // On the initial commit descendant layout effects precede the root's ref
    // attachment. The local ancestor is already mounted; no document lookup.
    const root = scope?.root.current ?? wrapper.current?.closest('[data-office-markdown-root]');
    if (!root || !wrapper.current) return undefined;
    const nodes = Array.from(root.querySelectorAll(marker)).filter(node => node.closest('[data-office-markdown-root]') === root);
    const index = nodes.indexOf(wrapper.current);
    if (index < 0) return undefined;
    const label = (node: Element) => [
      node.querySelector('[data-slot="card"]')?.id ?? '',
      node.querySelector('[data-slot="disclosure-trigger"]')?.textContent ?? '',
    ];
    const identify = (node: Element) => {
      const ancestors = [];
      let parent = node.parentElement?.closest(marker);
      const parentIndex = parent ? nodes.indexOf(parent) : -1;
      while (parent && nodes.includes(parent)) {
        ancestors.push(label(parent));
        parent = parent.parentElement?.closest(marker);
      }
      const footnotes = node.closest('[data-footnotes]');
      return JSON.stringify([label(node), parentIndex, ancestors,
        footnotes ? [footnotes.id, node.closest('li')?.id ?? ''] : null]);
    };
    const identity = identify(wrapper.current);
    // Titles alone cannot distinguish newly inserted duplicate siblings. A
    // changed duplicate count is ambiguous: reset instead of migrating state.
    const duplicates = nodes.filter(node => identify(node) === identity).length;
    return {index, identity: JSON.stringify([identity, duplicates])};
  };
  // Upstream streaming blocks have block-relative HAST offsets, including
  // duplicate zeroes. Committed DOM order distinguishes siblings and nesting.
  useLayoutEffect(() => {
    const current = position();
    if (scope && current) {
      let state = scope.states.get(current.index);
      if (!state || state.htmlOpen !== htmlOpen || state.identity !== current.identity) {
        state = {htmlOpen, expanded: htmlOpen, identity: current.identity};
        scope.states.set(current.index, state);
      }
      setExpanded(state.expanded);
      if (state.restoreFocus) {
        delete state.restoreFocus;
        const node = wrapper.current;
        const doc = node?.ownerDocument;
        if (doc?.activeElement === doc?.body) {
          node?.querySelector<HTMLButtonElement>('[data-slot="disclosure-trigger"]')?.focus({preventScroll: true});
        }
      }
    } else if (lastHtmlOpen.current !== htmlOpen) {
      setExpanded(htmlOpen);
    }
    lastHtmlOpen.current = htmlOpen;
  });
  useLayoutEffect(() => {
    const node = wrapper.current;
    return () => {
      const active = node?.ownerDocument.activeElement;
      // Capture only this disclosure's exact trigger, never a body link/input
      // or a nested disclosure's trigger.
      if (!node || active !== node.querySelector('[data-slot="disclosure-trigger"]') || active?.closest(marker) !== node) return;
      const current = position();
      const state = current && scope?.states.get(current.index);
      if (state && state.identity === current.identity) state.restoreFocus = true;
    };
  }, [scope]);
  const changeExpanded = (value: boolean) => {
    const current = position();
    if (scope && current) scope.states.set(current.index, {htmlOpen, expanded: value, identity: current.identity});
    setExpanded(value);
  };
  return <div ref={wrapper} data-office-markdown-disclosure="">
    <DisclosureCard id={id} className={className}
    title={titleText(summaryChildren).trim() || '查看详情'}
    isExpanded={expanded} onExpandedChange={changeExpanded}>
    {richSummary && <div>{summaryChildren}</div>}
    {parts.filter((_, position) => position !== index)}
    </DisclosureCard>
  </div>;
}
