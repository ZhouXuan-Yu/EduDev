import { useState, type ReactNode } from 'react';
import { Button, Tooltip } from '@heroui/react';
import { MessageSquare } from 'lucide-react';
import { AppLayout } from '../../heroui-pro/components/app-layout';
import { Sidebar } from '../../heroui-pro/components/sidebar';
import { useDesktopCommands, useDesktopNavigation } from '../desktop/DesktopFrame';
import { ProductRail } from './ProductRail';
import { PRODUCT_PAGES, PRODUCT_SPACES, productSpaceFor, type ProductPageSpace } from './product-spaces';
import '../office/pi-workspace-theme.css';

/** Layout adapter: existing domain pages still own their typed IPC and real data. */
export function ProductSpaceShell({ view, children, notice }: { view: string; children: ReactNode; notice?: string }) {
  const navigation = useDesktopNavigation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const space = productSpaceFor(view) as ProductPageSpace;
  const group = PRODUCT_SPACES.find(item => item.id === space)!;
  const pages = PRODUCT_PAGES[space];
  const title = pages.find(page => page.view === view)?.label;
  useDesktopCommands(command => {
    if (command !== 'sidebar') return false;
    setSidebarOpen(value => !value); return true;
  }, 20);
  return <div className="product-workspace pi-themed-surface" data-testid="product-space-workspace" data-space={space}>
    <ProductRail active={space}/>
    <AppLayout className="product-layout" sidebarCollapsible="offcanvas" scrollMode="content" reduceMotion
      sidebarOpen={sidebarOpen} onSidebarOpenChange={setSidebarOpen} asideOpen={false}
      sidebar={<Sidebar aria-label={`${group.label}分类`}><Sidebar.Header><strong>{group.label}</strong></Sidebar.Header>
        <Sidebar.Content><Sidebar.Group><Sidebar.GroupLabel>浏览</Sidebar.GroupLabel>
          {pages.map(page => <Button key={page.view} variant="ghost" className="product-page-link"
            data-testid={`nav-${page.view}`} aria-current={page.view === view ? 'page' : undefined}
            onPress={() => navigation.navigate({ view: page.view })}>{page.label}</Button>)}
        </Sidebar.Group></Sidebar.Content>
        <Sidebar.Footer><Button variant="ghost" className="product-page-link" onPress={() => navigation.navigate({ view: 'ai' })}><MessageSquare size={16}/>请小智帮忙</Button></Sidebar.Footer>
      </Sidebar>}
      navbar={<header className="product-header" data-testid="product-space-header">
        <Tooltip><Sidebar.Trigger aria-label="显示或隐藏分类" data-testid="product-sidebar-toggle"/><Tooltip.Content>分类侧栏</Tooltip.Content></Tooltip>
        <span>{group.label}</span><span className="product-header-path">/</span><strong>{title}</strong>
      </header>}>
      <main className="product-space-content" aria-label={title} data-testid="product-space-content">
        {notice && <p className="product-notice" role="status">{notice}</p>}{children}
      </main>
    </AppLayout>
  </div>;
}
