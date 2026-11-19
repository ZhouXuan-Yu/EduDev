import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@heroui/react';
import { FocusScope } from 'react-aria/FocusScope';
import { useOverlay } from 'react-aria/useOverlay';
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
  const { overlayProps } = useOverlay({ isOpen: history, onClose }, panelRef);
  useEffect(() => {
    if (history) panelRef.current?.focus();
  }, [history]);
  const panel = (
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
      onKeyDown={
        history ? overlayProps.onKeyDown : (e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }
      }
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
  // Share React Aria's scope/overlay tree with portalled menus and dialogs.
  // The ordinary context panel remains a non-modal part of the workspace.
  return history ? <FocusScope contain restoreFocus>{panel}</FocusScope> : panel;
}
