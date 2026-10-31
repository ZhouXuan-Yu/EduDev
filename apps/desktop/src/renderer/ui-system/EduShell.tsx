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
  const [navWidth, setNavWidth] = useState(() => readColumnWidth('xiaozhi.ui.navWidth.v1', 248, 200, 360));
  useEffect(() => { writeColumnWidth('xiaozhi.ui.navWidth.v1', navWidth); }, [navWidth]);
  const contract = PAGE_CONTRACTS.find((p) => p.id === view)!;
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
      {navigationOpen && navigationResizable && <ColumnResizeHandle side="left" width={navWidth} min={200} max={360} label="调整左侧导航宽度" onResize={setNavWidth} onReset={() => setNavWidth(248)} />}
      <main className="edu-workspace">
        <header className="edu-header" data-testid={headerTestId || 'edu-header'}>
          <div className="edu-breadcrumb">
            {!['ai', 'teaching', 'student_workbench'].includes(view) && <><span>{contract.group}</span><ChevronRight size={14} /></>}
            <strong>{contract.title}</strong>
            {title && title !== contract.title && (
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
