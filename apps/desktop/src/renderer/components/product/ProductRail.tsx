import { Button, Tooltip } from '@heroui/react';
import { useEffect, useState } from 'react';
import { BookOpen, FolderOpen, MessageSquare, Settings, Users } from 'lucide-react';
import { useDesktopNavigation } from '../desktop/DesktopFrame';
import { PRODUCT_SPACES, type ProductSpace, type ProductView } from './product-spaces';
import './product-spaces.css';

const icons = { ask: MessageSquare, materials: FolderOpen, teaching: BookOpen, students: Users, settings: Settings };
export function ProductRail({ active, disabled = false, visible = true, onNavigate, onActive }: {
  active: ProductSpace; disabled?: boolean; visible?: boolean; onNavigate?: (view: ProductView) => void; onActive?: () => void;
}) {
  const navigation = useDesktopNavigation();
  const [tooltip, setTooltip] = useState<ProductSpace>();
  useEffect(() => { if (!visible) setTooltip(undefined); }, [visible]);
  return <nav className="product-rail pi-icon-rail" aria-label="教师工作空间" data-testid="product-rail">
    {PRODUCT_SPACES.map(item => {
      const Icon = icons[item.id];
      return <Tooltip key={item.id} isDisabled={!visible || disabled} isOpen={visible && tooltip === item.id} onOpenChange={open=>setTooltip(open ? item.id : undefined)}><Button variant="ghost" isIconOnly isDisabled={disabled}
        className={item.id === 'settings' ? 'product-rail-settings' : undefined}
        aria-label={item.label} aria-current={active === item.id ? 'page' : undefined}
        data-testid={`product-nav-${item.id}`} onPress={() => {
          setTooltip(undefined);
          if (item.id === active && onActive) onActive();
          else if (onNavigate) onNavigate(item.view);
          else navigation.navigate({ view: item.view });
        }}><Icon size={21}/></Button><Tooltip.Content placement="right" className="product-rail-tooltip pi-themed-surface">{item.label}</Tooltip.Content></Tooltip>;
    })}
  </nav>;
}
