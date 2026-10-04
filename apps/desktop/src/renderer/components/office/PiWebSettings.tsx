import { useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Label, Switch } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import { SettingsSurface, SettingsStack, SettingsInline } from './hana-settings/SettingsPrimitives';
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
  return <SettingsSurface data-testid="pi-web-settings"><SettingsStack gap="md"><h2>联网资料</h2>
    <SettingsInline justify="between" wrap><Label>允许搜索和读取公开网页</Label><Switch aria-label="允许联网资料" data-testid="pi-web-enabled" isSelected={enabled} isDisabled={disabled} onChange={setEnabled}><Switch.Content><Switch.Control><Switch.Thumb/></Switch.Control></Switch.Content></Switch></SettingsInline>
    <p>只发送必要的脱敏查询；原始文件和学生图片保留在本机。搜索摘要与网页正文会分别标注来源。</p>
    <SettingsInline justify="between" wrap><Label>网络解析</Label><Dropdown><Button variant="secondary" data-testid="pi-web-dns" isDisabled={disabled}>{dns === 'auto' ? '自动（推荐）' : dns === 'system' ? '系统默认' : '阿里公共 DNS'}<ChevronDown size={15}/></Button>
      <Dropdown.Popover><Dropdown.Menu aria-label="网络解析" selectionMode="single" selectedKeys={[dns]} onAction={id => { if (!disabled && (id === 'auto' || id === 'system' || id === 'alidns')) setDns(id); }}>
        <Dropdown.Item id="auto" textValue="自动（推荐）"><Label>自动（推荐）</Label><Dropdown.ItemIndicator/></Dropdown.Item>
        <Dropdown.Item id="system" textValue="系统默认"><Label>系统默认</Label><Dropdown.ItemIndicator/></Dropdown.Item>
        <Dropdown.Item id="alidns" textValue="阿里公共 DNS"><Label>阿里公共 DNS</Label><Dropdown.ItemIndicator/></Dropdown.Item>
      </Dropdown.Menu></Dropdown.Popover></Dropdown></SettingsInline>
    <p>自动模式在系统解析失败或返回代理虚拟地址时使用国内解析，仅用于小智的公开资料查询，不修改系统网络设置。</p>
    <SettingsInline justify="end"><Button data-testid="pi-web-save" isDisabled={disabled} onPress={() => void save()}>{busy ? '正在保存…' : '保存联网设置'}</Button></SettingsInline>
    {notice && <p role="status" data-testid="pi-web-feedback">{notice}</p>}
  </SettingsStack></SettingsSurface>;
}
