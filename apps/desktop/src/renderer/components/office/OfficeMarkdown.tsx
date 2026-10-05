import { cloneElement, isValidElement } from 'react';
import { StreamMarkdown, type StreamMarkdownProps } from '../../heroui-pro/components/markdown';
import './office-markdown.css';

// Streamdown 2 marks fenced children in pre before choosing code vs inlineCode.
// Restore that default at the app boundary; keep the original Pro code card.
const components: NonNullable<StreamMarkdownProps['components']> = {
  pre: ({ children }) => isValidElement<Record<string, unknown>>(children)
    ? cloneElement(children, { 'data-block': 'true' })
    : <>{children}</>,
};

export function OfficeMarkdown({ className, ...props }: Omit<StreamMarkdownProps, 'components'>) {
  return <StreamMarkdown {...props} className={['office-markdown', className].filter(Boolean).join(' ')} components={components} />;
}
