import { BookOpen, MessageSquare, FolderOpen, Users, Settings } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { PAGE_CONTRACTS } from './page-contracts';
import { useDesktopNavigation } from '../components/desktop/DesktopFrame';
const icons = {
  工作: MessageSquare,
  资料: FolderOpen,
  教学: BookOpen,
  学生: Users,
  系统: Settings,
};
const spaces = {
  工作: 'ask',
  资料: 'materials',
  教学: 'teaching',
  学生: 'students',
  系统: 'settings',
} as const;
let lastNavigationScroll = 0;
export function EduNavigation({ view, disabled = false }: { view: string; disabled?: boolean }) {
  const navigation = useDesktopNavigation();
  const list = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = lastNavigationScroll;
  }, []);
  useLayoutEffect(() => {
    const el = list.current,
      active = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !active) return;
    const parent = el.getBoundingClientRect(),
      child = active.getBoundingClientRect();
    if (child.top < parent.top) el.scrollTop -= parent.top - child.top;
    else if (child.bottom > parent.bottom) el.scrollTop += child.bottom - parent.bottom;
  }, [view]);
  return (
    <aside className="edu-navigation" data-testid="edu-navigation">
      <div className="edu-brand">
        <BookOpen size={21} />
        <strong>小智</strong>
        <span>教师工作台</span>
      </div>
      <nav
        ref={list}
        onScroll={(e) => {
          lastNavigationScroll = e.currentTarget.scrollTop;
        }}
        aria-label="教师工作空间"
        data-testid="product-rail"
      >
        {Object.entries(icons).map(([group, Icon]) => (
          <section className="edu-nav-group" key={group}>
            <button
              className="edu-nav-group-title"
              disabled={disabled}
              data-testid={'product-nav-' + spaces[group as keyof typeof spaces]}
              onClick={() =>
                navigation.navigate({ view: PAGE_CONTRACTS.find((p) => p.group === group)!.id })
              }
            >
              {group}
            </button>
            {PAGE_CONTRACTS.filter((p) => p.group === group).map((p) => (
              <button
                className="edu-nav-item"
                key={p.id}
                disabled={disabled}
                data-testid={p.id === 'ai' ? 'nav-ai-workspace' : 'nav-' + p.id}
                aria-current={p.id === view ? 'page' : undefined}
                onClick={() => navigation.navigate({ view: p.id })}
              >
                <Icon size={16} />
                <span>{p.title}</span>
              </button>
            ))}
          </section>
        ))}
      </nav>
      <div className="edu-local-note">
        <span />
        资料保存在本机
      </div>
    </aside>
  );
}
