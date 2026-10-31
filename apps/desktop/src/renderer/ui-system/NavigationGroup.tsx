import { useId, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

/** Application-owned disclosure; no vendor component or theme overrides. */
export function NavigationGroup({ id, title, expanded, disabled, onToggle, children }: {
  id: string;
  title: string;
  expanded: boolean;
  disabled: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = useId();
  return (
    <section className="edu-nav-group">
      <button
        type="button"
        className="edu-nav-group-title"
        disabled={disabled}
        data-testid={'nav-group-' + id}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span>{title}</span>
        <ChevronRight size={14} className="edu-nav-chevron" aria-hidden="true" />
      </button>
      <div id={panelId} className="edu-nav-disclosure" data-expanded={expanded} inert={!expanded} aria-hidden={!expanded}>
        <div className="edu-nav-disclosure-content">{children}</div>
      </div>
    </section>
  );
}
