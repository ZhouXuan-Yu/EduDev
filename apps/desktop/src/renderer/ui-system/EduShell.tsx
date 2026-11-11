import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { ColumnResizeHandle, readColumnWidth, writeColumnWidth } from './ColumnResizeHandle';
import { EduNavigation } from './EduNavigation';
import { PAGE_CONTRACTS } from './page-contracts';
import './layout.css';
import './domain.css';
import './chat.css';
import './settings.css';
import './controls.css';
export function EduShell({
  view,
  title,
  actions,
  children,
  disabled = false,
  navigationOpen = true,
  testId,
  headerTestId,
  navigationResizable = false,
}: {
  view: string;
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  navigationOpen?: boolean;
  testId?: string;
  headerTestId?: string;
  navigationResizable?: boolean;
}) {
  const [navWidth, setNavWidth] = useState(() => {
    const savedWidth = readColumnWidth('xiaozhi.ui.navWidth.v1', 232, 200, 360);
    // Move the former default to the approved width while keeping resized columns.
    return savedWidth === 248 ? 232 : savedWidth;
  });
  useEffect(() => { writeColumnWidth('xiaozhi.ui.navWidth.v1', navWidth); }, [navWidth]);
  const contract = PAGE_CONTRACTS.find((p) => p.id === view)!;
  const teachingWorkspace = contract.group === '教学' && view !== 'paper';
  const heading = view === 'paper' ? '出题与组卷' : teachingWorkspace ? '教学工作台' : contract.title;
  return (
    <div
      className="edu-shell"
      data-edu-ui=""
      data-heroui-native=""
      data-theme="light"
      data-view={view}
      data-navigation={navigationOpen ? 'open' : 'closed'}
      data-testid={testId || 'edu-shell'}
      style={{'--edu-nav-width': `${navWidth}px`} as CSSProperties}
    >
      {navigationOpen && <EduNavigation view={view} disabled={disabled} />}
      {navigationOpen && navigationResizable && <ColumnResizeHandle side="left" width={navWidth} min={200} max={360} label="调整左侧导航宽度" onResize={setNavWidth} onReset={() => setNavWidth(232)} />}
      <main className="edu-workspace">
        <header className="edu-header" data-testid={headerTestId || 'edu-header'}>
          <div className="edu-breadcrumb">
            {!teachingWorkspace && !['ai', 'teaching', 'student_workbench', 'knowledge', 'settings', 'paper'].includes(view) && <><span>{contract.group}</span><ChevronRight size={14} /></>}
            <strong>{heading}</strong>
            {title && title !== heading && (
              <span className="edu-session-title" title={title}>
                {title}
              </span>
            )}
          </div>
          <div className="edu-header-actions">{actions}</div>
        </header>
        {children}
      </main>
    </div>
  );
}
