import { BookOpen, MessageSquare, FolderOpen, Users, Settings } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { PAGE_CONTRACTS, type PageContract } from './page-contracts';
import { useDesktopNavigation } from '../components/desktop/DesktopFrame';
import { NavigationGroup } from './NavigationGroup';
import { useNavigationGroups } from './navigation-preferences';
import './navigation.css';

const groups = [
  { id: 'ask', title: '工作', Icon: MessageSquare },
  { id: 'materials', title: '资料', Icon: FolderOpen },
  { id: 'teaching', title: '教学', Icon: BookOpen },
  { id: 'students', title: '学生', Icon: Users },
] as const;
const navigationGroups = groups.map((group) => ({
  ...group,
  pages: PAGE_CONTRACTS.filter((page) => page.group === group.title),
}));
const settings = PAGE_CONTRACTS.find((page) => page.id === 'settings')!;
let lastNavigationScroll = 0;
export function EduNavigation({ view, disabled = false }: { view: string; disabled?: boolean }) {
  const navigation = useDesktopNavigation();
  const activeGroup = navigationGroups.find((group) => group.pages.some((page) => page.id === view))?.id;
  const { expanded, toggle } = useNavigationGroups(view, activeGroup);
  const list = useRef<HTMLElement>(null);
  const revealedView = useRef<string>(undefined);
  function revealActiveItem() {
    if (revealedView.current === view) return;
    const el = list.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !active || active.closest('[inert]')) return;
    const parent = el.getBoundingClientRect(),
      child = active.getBoundingClientRect();
    if (child.top < parent.top) el.scrollTop -= parent.top - child.top;
    else if (child.bottom > parent.bottom) el.scrollTop += child.bottom - parent.bottom;
    const visible = active.getBoundingClientRect();
    const panel = active.closest('.edu-nav-disclosure')?.getBoundingClientRect();
    // Keep the reveal pending while an opening panel still clips the destination.
    if (visible.top >= parent.top && visible.bottom <= parent.bottom &&
      (!panel || (visible.top >= panel.top && visible.bottom <= panel.bottom))) revealedView.current = view;
  }
  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = lastNavigationScroll;
  }, []);
  useLayoutEffect(revealActiveItem, [view, expanded]);

  function item(page: PageContract, Icon: typeof BookOpen) {
    return (
      <button
        type="button"
        className="edu-nav-item"
        key={page.id}
        disabled={disabled}
        data-testid={page.id === 'ai' ? 'nav-ai-workspace' : 'nav-' + page.id}
        aria-current={page.id === view ? 'page' : undefined}
        onClick={() => navigation.navigate({ view: page.id })}
      >
        <Icon size={16} aria-hidden="true" />
        <span>{page.title}</span>
      </button>
    );
  }
  return (
    <aside className="edu-navigation" data-testid="edu-navigation">
      <div className="edu-brand">
        <BookOpen size={21} aria-hidden="true" />
        <strong>小智</strong>
        <span>教师工作台</span>
      </div>
      <nav
        ref={list}
        onScroll={(e) => {
          lastNavigationScroll = e.currentTarget.scrollTop;
        }}
        onTransitionEnd={(event) => {
          if (event.propertyName === 'grid-template-rows' && event.target instanceof HTMLElement &&
            event.target.dataset.expanded === 'true' && event.target.querySelector('[aria-current="page"]')) revealActiveItem();
        }}
        aria-label="教师工作空间"
        data-testid="product-rail"
      >
        {navigationGroups.map(({ id, title, Icon, pages }) => (
          <NavigationGroup key={id} id={id} title={title} expanded={expanded[id]} disabled={disabled} onToggle={() => toggle(id)}>
            {pages.map((page) => item(page, Icon))}
          </NavigationGroup>
        ))}
      </nav>
      <footer className="edu-navigation-footer" data-testid="edu-navigation-footer" aria-label="工作台设置">
        {item(settings, Settings)}
      </footer>
    </aside>
  );
}
