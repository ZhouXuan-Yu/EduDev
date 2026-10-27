import { useEffect, useRef, type ReactNode } from 'react';
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
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (history) panelRef.current?.focus();
  }, [history]);
  return (
    <aside
      ref={panelRef}
      className={history ? 'edu-history-panel' : 'edu-context-panel'}
      aria-label={title}
      aria-modal={history ? true : undefined}
      role={history ? 'dialog' : undefined}
      tabIndex={history ? -1 : undefined}
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
