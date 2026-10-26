import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
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
}: {
  view: string;
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  navigationOpen?: boolean;
  testId?: string;
  headerTestId?: string;
}) {
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
    >
      {navigationOpen && <EduNavigation view={view} disabled={disabled} />}
      <section className="edu-workspace">
        <header className="edu-header" data-testid={headerTestId || 'edu-header'}>
          <div className="edu-breadcrumb">
            <span>{contract.group}</span>
            <ChevronRight size={14} />
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
      </section>
    </div>
  );
}
