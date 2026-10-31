import { useRef, type ReactNode } from 'react';
import { Files, ListTodo, PanelRightClose } from 'lucide-react';
import { Button } from '@heroui/react';
import '../../ui-system/workbench-context.css';

export type WorkbenchPanelMode = 'tasks' | 'files';

/** Presentation only. File requests and task mutations stay in their existing owners. */
export function WorkbenchContextPanel({ mode, onModeChange, onClose, tasks, files }: {
  mode: WorkbenchPanelMode;
  onModeChange: (mode: WorkbenchPanelMode) => void;
  onClose: () => void;
  tasks: ReactNode;
  files?: ReactNode;
}) {
  const tabs = useRef<HTMLDivElement>(null);
  const select = (value: WorkbenchPanelMode) => {
    onModeChange(value);
    requestAnimationFrame(() => tabs.current?.querySelector<HTMLButtonElement>(`[data-mode="${value}"]`)?.focus());
  };
  return <aside className="wb-context" aria-label="任务与文件" data-testid="edu-context-panel"
    data-heroui-native="" data-theme="light" onKeyDown={event => {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); onClose(); }
    }}>
    <header className="wb-context-heading"><strong>任务与文件</strong>
      <Button variant="ghost" isIconOnly aria-label="收起任务与文件" data-testid="workbench-panel-close" onPress={onClose}><PanelRightClose size={17} /></Button>
    </header>
    <div className="wb-context-tabs" ref={tabs} role="tablist" aria-label="任务与文件视图" onKeyDown={event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        select(event.key === 'Home' ? 'tasks' : event.key === 'End' ? 'files' : mode === 'tasks' ? 'files' : 'tasks');
      }
    }}>
      <button type="button" id="wb-task-tab" role="tab" aria-selected={mode === 'tasks'} aria-controls="wb-task-content" tabIndex={mode === 'tasks' ? 0 : -1} data-mode="tasks" data-testid="workbench-tab-tasks" onClick={() => onModeChange('tasks')}><ListTodo size={15} />当前任务</button>
      <button type="button" id="wb-files-tab" role="tab" aria-selected={mode === 'files'} aria-controls="wb-files-content" tabIndex={mode === 'files' ? 0 : -1} data-mode="files" data-testid="workbench-tab-files" onClick={() => onModeChange('files')}><Files size={15} />本地文件</button>
    </div>
    <section id="wb-task-content" role="tabpanel" aria-labelledby="wb-task-tab" hidden={mode !== 'tasks'} className="wb-context-body edu-domain" data-edu-domain="">{tasks}</section>
    <section id="wb-files-content" role="tabpanel" aria-labelledby="wb-files-tab" hidden={mode !== 'files'} className="wb-context-body wb-context-files">{files}</section>
  </aside>;
}
