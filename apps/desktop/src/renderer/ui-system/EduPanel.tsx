import type { ReactNode } from 'react';
import { Button } from '@heroui/react';
import { X } from 'lucide-react';
export function EduPanel({
  title,
  children,
  onClose,
  history = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  history?: boolean;
}) {
  return (
    <aside
      className={history ? 'edu-history-panel' : 'edu-context-panel'}
      aria-label={title}
      data-theme="light"
      data-heroui-native=""
      data-testid={history ? 'edu-history-panel' : 'edu-context-panel'}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="edu-panel-heading">
        <strong>{title}</strong>
        <Button variant="ghost" isIconOnly aria-label={'关闭' + title} onPress={onClose}>
          <X size={17} />
        </Button>
      </header>
      <div className="edu-panel-content">{children}</div>
    </aside>
  );
}
