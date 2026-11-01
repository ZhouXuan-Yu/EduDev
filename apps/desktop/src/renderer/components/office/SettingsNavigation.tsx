import {useState} from 'react';
import {Button} from '@heroui/react';
import {ChevronRight, type LucideIcon} from 'lucide-react';
import styles from '../../ui-system/u5-settings.module.css';
type Entry = {readonly id: string; readonly label: string; readonly icon: LucideIcon};
const advancedIds = new Set(['skills', 'tools', 'diagnostics']);
/** Configuration metadata only; no credentials, history or path data enter navigation. */
export function SettingsNavigation({tabs, active, disabled, onSelect}: {
  tabs: readonly Entry[]; active: string; disabled: boolean; onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const advancedActive = advancedIds.has(active);
  const showAdvanced = expanded || advancedActive;
  const entry = (item: Entry) => <Button key={item.id} variant={active === item.id ? 'secondary' : 'ghost'} aria-current={active === item.id ? 'page' : undefined} data-testid={`pi-settings-tab-${item.id}`} isDisabled={disabled} onPress={() => onSelect(item.id)}><item.icon size={18}/>{item.label}</Button>;
  return <div className={styles.navigation}>
    <span className={styles.label}>日常设置</span>
    {['models','permissions','interface','backup','archives'].map(id => tabs.find(tab => tab.id === id)).filter((item): item is Entry => !!item).map(entry)}
    <Button variant="ghost" isDisabled={disabled} aria-expanded={showAdvanced} aria-controls="pi-settings-advanced-nav" data-testid="pi-settings-advanced-toggle" onPress={() => setExpanded(!showAdvanced)}><ChevronRight size={16} className={styles.chevron} data-expanded={showAdvanced}/>高级与诊断</Button>
    <div id="pi-settings-advanced-nav" className={styles.advanced} hidden={!showAdvanced}>
      {tabs.filter(item => advancedIds.has(item.id)).map(entry)}
    </div>
  </div>;
}
