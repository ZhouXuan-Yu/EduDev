import { cloneElement, isValidElement, memo,useCallback, useMemo, useRef, useState } from 'react';
import { StreamMarkdown, type StreamMarkdownProps } from '../../heroui-pro/components/markdown';
import './office-markdown.css';
import { createMathPlugin } from '@streamdown/math';
import 'katex/dist/katex.min.css';
import {normalizeMathDelimiters} from './math-delimiters';
import {OfficeMarkdownDisclosure, OfficeMarkdownDisclosureScope, OfficeMarkdownSummary, type OfficeMarkdownDisclosureState} from './OfficeMarkdownDisclosure';

const plugins = { math: createMathPlugin({ singleDollarTextMath: true }) };

// Streamdown 2 marks fenced children in pre before choosing code vs inlineCode.
// Restore that default at the app boundary; keep the original Pro code card.
const components: NonNullable<StreamMarkdownProps['components']> = {
  details: OfficeMarkdownDisclosure,
  summary: OfficeMarkdownSummary,
  pre: ({ children }) => isValidElement<Record<string, unknown>>(children)
    ? cloneElement(children, { 'data-block': 'true' })
    : <>{children}</>,
};

export const OfficeMarkdown=memo(function OfficeMarkdown({ className, components: overrides, children,animated=false, ref, ...props }: StreamMarkdownProps) {
  const root = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState(() => ({source: children, states: new Map<number, OfficeMarkdownDisclosureState>()}));
  // An edit/replacement changes DOM-order identity. Append-only tokens and the
  // identical text at completion share only flags, never cached message content.
  if (history.source !== children) {
    setHistory({source: children, states: children.startsWith(history.source) ? history.states : new Map()});
  }
  const scope = useMemo(() => ({root, states: history.states}), [history.states]);
  const attachRoot = useCallback((node: HTMLDivElement | null) => {
    root.current = node;
    if (typeof ref === 'function') {
      const cleanup = ref(node);
      if (typeof cleanup === 'function') return () => {root.current = null; cleanup();};
    } else if (ref) ref.current = node;
  }, [ref]);
  // Stable component identity lets Streamdown retain already completed blocks.
  const merged=useMemo(()=>overrides?{...components,...overrides}:components,[overrides]);
  return <OfficeMarkdownDisclosureScope.Provider value={scope}>
    <StreamMarkdown {...props} ref={attachRoot} data-office-markdown-root="" animated={animated} children={normalizeMathDelimiters(children)} plugins={plugins} className={['office-markdown', className].filter(Boolean).join(' ')} components={merged} />
  </OfficeMarkdownDisclosureScope.Provider>;
});
