import { useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Label, Switch } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import styles from '../../ui-system/student-settings/student-settings-layout.module.css';
import { XIAOZHI_WEB_SCHEMA, type XiaozhiWebPreferences } from '../../../shared/xiaozhi-web';
import { XIAOZHI_SETTINGS_ERRORS } from '../../../shared/xiaozhi-settings';

export function PiWebSettings({ locked, onBusyChange }: { locked: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [view, setView] = useState<XiaozhiWebPreferences>(), [enabled, setEnabled] = useState(true), [dns, setDns] = useState<XiaozhiWebPreferences['dnsMode']>('auto');
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const live = useRef(true), action = useRef(false);
  useEffect(() => { live.current = true; void window.omniEdu?.getXiaozhiSettings().then(result => { if (live.current && result.ok && result.value.web) {
    setView(result.value.web); setEnabled(result.value.web.enabled); setDns(result.value.web.dnsMode);
  } }).catch(() => { if (live.current) setNotice('联网设置未读取，请重新打开设置。'); }); return () => { live.current = false; }; }, []);
  const disabled = locked || busy || !view;
  async function save() {
    if (disabled || action.current || !view) return;
    action.current = true; setBusy(true); onBusyChange?.(true); setNotice('');
    try {
      const result = await window.omniEdu?.saveXiaozhiWebSettings({ schemaVersion: XIAOZHI_WEB_SCHEMA, version: view.version, enabled, dnsMode: dns });
      if (!live.current) return;
      if (result?.ok) { setView(result.value); setNotice('已保存，下次任务按此设置联网。'); }
      else setNotice(result ? XIAOZHI_SETTINGS_ERRORS[result.error] : '联网设置未保存。');
    } catch { if (live.current) setNotice('联网设置未保存，请重试。'); }
    finally { action.current = false; onBusyChange?.(false); if (live.current) setBusy(false); }
  }
  return <section className={styles.section} data-testid="pi-web-settings" aria-labelledby="pi-web-heading">
    <header className={styles.sectionHeading}><h2 id="pi-web-heading">联网资料</h2><p>公开网页用于补充资料，原始文件与学生图片保留本机。</p></header>
    <div className={styles.row}>
      <div className={styles.rowText}><span className={styles.rowLabel}>允许搜索和读取公开网页</span><p className={styles.hint}>只发送必要的脱敏查询，搜索摘要与网页正文分别标注来源。</p></div>
      <div className={styles.control}><Switch aria-label="允许联网资料" data-testid="pi-web-enabled" isSelected={enabled} isDisabled={disabled} onChange={setEnabled}><Switch.Content><Switch.Control><Switch.Thumb/></Switch.Control></Switch.Content></Switch></div>
    </div>
    <div className={styles.row}>
      <div className={styles.rowText}><span className={styles.rowLabel}>网络解析</span><p className={styles.hint}>仅用于小智的公开资料查询，不修改系统网络设置。自动模式在系统解析失败或返回代理虚拟地址时使用国内解析。</p></div>
      <div className={styles.control}><Dropdown><Button variant="secondary" data-testid="pi-web-dns" isDisabled={disabled}>{dns === 'auto' ? '自动（推荐）' : dns === 'system' ? '系统默认' : '阿里公共 DNS'}<ChevronDown size={15}/></Button>
      <Dropdown.Popover><Dropdown.Menu aria-label="网络解析" selectionMode="single" selectedKeys={[dns]} onAction={id => { if (!disabled && (id === 'auto' || id === 'system' || id === 'alidns')) setDns(id); }}>
        <Dropdown.Item id="auto" textValue="自动（推荐）"><Label>自动（推荐）</Label><Dropdown.ItemIndicator/></Dropdown.Item>
        <Dropdown.Item id="system" textValue="系统默认"><Label>系统默认</Label><Dropdown.ItemIndicator/></Dropdown.Item>
        <Dropdown.Item id="alidns" textValue="阿里公共 DNS"><Label>阿里公共 DNS</Label><Dropdown.ItemIndicator/></Dropdown.Item>
      </Dropdown.Menu></Dropdown.Popover></Dropdown></div>
    </div>
    <div className={styles.save}><Button data-testid="pi-web-save" isDisabled={disabled} onPress={() => void save()}>{busy ? '正在保存…' : '保存联网设置'}</Button></div>
    {notice && <p role="status" data-testid="pi-web-feedback">{notice}</p>}
  </section>;
}
