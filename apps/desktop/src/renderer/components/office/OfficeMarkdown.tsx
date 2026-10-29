import { cloneElement, isValidElement, memo,useMemo } from 'react';
import { StreamMarkdown, type StreamMarkdownProps } from '../../heroui-pro/components/markdown';
import './office-markdown.css';
import { createMathPlugin } from '@streamdown/math';
import 'katex/dist/katex.min.css';
import {normalizeMathDelimiters} from './math-delimiters';

const plugins = { math: createMathPlugin({ singleDollarTextMath: true }) };

// Streamdown 2 marks fenced children in pre before choosing code vs inlineCode.
// Restore that default at the app boundary; keep the original Pro code card.
const components: NonNullable<StreamMarkdownProps['components']> = {
  pre: ({ children }) => isValidElement<Record<string, unknown>>(children)
    ? cloneElement(children, { 'data-block': 'true' })
    : <>{children}</>,
};

export const OfficeMarkdown=memo(function OfficeMarkdown({ className, components: overrides, children,animated=false, ...props }: StreamMarkdownProps) {
  // Stable component identity lets Streamdown retain already completed blocks.
  const merged=useMemo(()=>overrides?{...components,...overrides}:components,[overrides]);
  return <StreamMarkdown {...props} animated={animated} children={normalizeMathDelimiters(children)} plugins={plugins} className={['office-markdown', className].filter(Boolean).join(' ')} components={merged} />;
});
