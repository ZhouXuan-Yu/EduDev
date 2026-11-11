import {useState} from 'react';
import {ChevronRight, type LucideIcon} from 'lucide-react';
import styles from '../../ui-system/student-settings/student-settings-layout.module.css';
type Entry = {readonly id: string; readonly label: string; readonly icon: LucideIcon};
const advancedIds = new Set(['skills', 'tools', 'diagnostics']);
/** Configuration metadata only; no credentials, history or path data enter navigation. */
export function SettingsNavigation({tabs, active, disabled, onSelect}: {
  tabs: readonly Entry[]; active: string; disabled: boolean; onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const advancedActive = advancedIds.has(active);
  const showAdvanced = expanded || advancedActive;
  const activeGroup = active === 'archives' ? 'backup' : active;
  const entry = (item: Entry) => <button type="button" className={styles.navigationEntry} key={item.id} aria-current={activeGroup === item.id ? 'page' : undefined} data-testid={`pi-settings-tab-${item.id}`} disabled={disabled} onClick={() => onSelect(item.id)}>{item.label}</button>;
  return <div className={styles.navigation}>
    <span className={styles.label}>日常设置</span>
    {['models','interface','permissions','backup'].map(id => tabs.find(tab => tab.id === id)).filter((item): item is Entry => !!item).map(entry)}
    <button type="button" className={styles.advancedToggle} disabled={disabled} aria-expanded={showAdvanced} aria-controls="pi-settings-advanced-nav" data-testid="pi-settings-advanced-toggle" onClick={() => setExpanded(!showAdvanced)}><ChevronRight size={16} className={styles.chevron} data-expanded={showAdvanced}/>高级与诊断</button>
    <div id="pi-settings-advanced-nav" className={styles.advanced} hidden={!showAdvanced}>
      {tabs.filter(item => advancedIds.has(item.id)).map(entry)}
    </div>
  </div>;
}
