import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Input, Label, TextField } from '@heroui/react';
import { XIAOZHI_MCP_ERRORS, XIAOZHI_MCP_SCHEMA, type XiaozhiMcpCatalog, type XiaozhiMcpResult, type XiaozhiMcpServer } from '../../../shared/xiaozhi-mcp';
import { SettingsSection } from './hana-settings/SettingsSection';
import { SettingsStack } from './hana-settings/SettingsPrimitives';
import {PiAcquisitionSettings} from './PiAcquisitionSettings';
import {PiMcpCredential} from './PiMcpCredential';

const statuses: Record<XiaozhiMcpServer['status'], string> = { unverified: '尚未连接', ready: '目录已读取', failed: '连接失败', schema_changed: '工具目录已变更，请重新连接并授权', revoked: '授权已撤销' };
export function PiMcpSettings({ running, sessionId, onBusyChange }: { running: boolean; sessionId?: string; onBusyChange?: (busy: boolean) => void }) {
  const [catalog, setCatalog] = useState<XiaozhiMcpCatalog>(), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const [transport, setTransport] = useState<'http' | 'stdio'>('http'), [name, setName] = useState(''), [address, setAddress] = useState(''), [args, setArgs] = useState('[]'), [secret, setSecret] = useState('');
  const [selection, setSelection] = useState<Record<string, string[]>>({}), [acknowledged, setAcknowledged] = useState(false);
  const live = useRef(true), lock = useRef(false), generation = useRef(0);
  const selectedSession = useRef(sessionId);
  selectedSession.current = sessionId;
  const disabled = running || busy;
  function current(own: number, target: string | undefined) {
    return live.current && generation.current === own && selectedSession.current === target;
  }
  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);
  function accept(result: XiaozhiMcpResult<XiaozhiMcpCatalog> | undefined) {
    if (!result) { setNotice('连接设置暂时无法读取，请重试。'); return false; }
    if (!result.ok) { setNotice(XIAOZHI_MCP_ERRORS[result.error]); return false; }
    setCatalog(result.value); setSelection(Object.fromEntries(result.value.servers.map(s => [s.id, s.tools.filter(t => t.selected).map(t => t.name)]))); return true;
  }
  async function refresh() {
    if (lock.current) return;
    const own = ++generation.current, target = sessionId;
    try { const result = await window.omniEdu?.getXiaozhiMcpCatalog(); if (current(own, target)) accept(result); }
    catch { if (current(own, target)) setNotice('连接设置暂时无法读取，请重试。'); }
  }
  useEffect(() => {
    live.current = true; lock.current = false; setBusy(false); setCatalog(undefined); setSelection({}); setNotice(''); setSecret('');
    void refresh();
    return () => { live.current = false; generation.current++; };
  }, [sessionId]);
  type McpCatalogCall = Promise<XiaozhiMcpResult<XiaozhiMcpCatalog> | undefined> | undefined;
  async function act(work: () => McpCatalogCall, success = '', onAccepted?: () => void) {
    if (lock.current || running) return; lock.current = true; setBusy(true); setNotice('');
    const own = ++generation.current, target = sessionId;
    try {
      const result = await work();
      if (current(own, target) && accept(result)) { onAccepted?.(); if (success) setNotice(success); }
    }
    catch { if (current(own, target)) setNotice('操作未完成，请刷新后重试。'); }
    finally { if (current(own, target)) { lock.current = false; setBusy(false); } }
  }
  function input(s: XiaozhiMcpServer) { return { schemaVersion: XIAOZHI_MCP_SCHEMA, revision: catalog!.revision, serverId: s.id }; }
  async function add() {
    let parsed: string[] = [];
    if (transport === 'stdio') { try { const value = JSON.parse(args); if (!Array.isArray(value) || value.some(a => typeof a !== 'string')) throw Error(); parsed = value; } catch { setNotice('程序参数需要填写字符串 JSON 数组。'); return; } }
    await act(() => window.omniEdu?.addXiaozhiMcp(transport === 'http' ? { name, transport, url: address, ...(secret ? { bearerToken: secret } : {}) } : { name, transport, command: address, args: parsed, ...(secret ? { secret } : {}) }),
      '已保存连接。请读取工具目录，再逐项授权。', () => { setName(''); setAddress(''); setArgs('[]'); setSecret(''); setAcknowledged(false); });
  }
  return <SettingsStack gap="lg"><PiAcquisitionSettings sessionId={sessionId}/><SettingsSection title="外部工具连接（高级）" description="仅连接你信任的服务。工具参数会发送至该服务；读取工具也可能接触服务自身的数据。">
    <SettingsStack gap="sm"><p>请核实服务或程序的来源与用途，工具的只读声明来自服务。选中工具均按外部操作治理，每次调用按当前任务权限校验并执行一次尝试。学生原图和未脱敏资料不得通过外部工具传出。</p>
      <Button size="sm" variant="ghost" data-testid="pi-mcp-refresh" isDisabled={disabled} onPress={() => void refresh()}>刷新连接列表</Button>
      {!catalog ? <p role="status">正在读取连接设置…</p> : !catalog.servers.length ? <p data-testid="pi-mcp-empty">尚未添加外部工具。</p> : catalog.servers.map(server => <SettingsSection key={server.id} title={server.name} description={server.endpoint}>
        <p data-testid={`pi-mcp-status-${server.id}`}>{statuses[server.status]}{server.trustedSchemaHash ? ' · 已授权选中工具' : ' · 未授权调用'}</p>
        {server.lastError && <p role="alert">{XIAOZHI_MCP_ERRORS[server.lastError]}</p>}
        <PiMcpCredential key={`${sessionId}-${server.id}`} server={server} revision={catalog.revision} disabled={disabled}
          onSave={(credential, onSaved) => act(() => window.omniEdu?.setXiaozhiMcpCredential(credential), '密钥配置已更新。请重新连接读取目录并重新授权选中工具。', onSaved)}/>
        <div className="pi-settings-actions"><Button size="sm" variant="secondary" data-testid={`pi-mcp-inspect-${server.id}`} isDisabled={disabled} onPress={() => void act(() => window.omniEdu?.inspectXiaozhiMcp(input(server)))}>连接并读取目录</Button>
          <Button size="sm" variant="ghost" data-testid={`pi-mcp-revoke-${server.id}`} isDisabled={disabled} onPress={() => void act(() => window.omniEdu?.revokeXiaozhiMcp(input(server)), '授权已撤销。')}>撤销授权</Button>
          <Button size="sm" variant="ghost" data-testid={`pi-mcp-remove-${server.id}`} isDisabled={disabled} onPress={() => void act(() => window.omniEdu?.removeXiaozhiMcp(input(server)), '已移除连接。')}>移除连接</Button></div>
        <SettingsStack gap="sm">{server.tools.map(tool => <Checkbox key={tool.name} isSelected={(selection[server.id] || []).includes(tool.name)} isDisabled={disabled || server.status !== 'ready'} data-testid={`pi-mcp-tool-${server.id}-${tool.name}`}
          onChange={checked => setSelection(value => ({ ...value, [server.id]: checked ? [...(value[server.id] || []), tool.name] : (value[server.id] || []).filter(n => n !== tool.name) }))}>
          <Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control><span>{tool.title} · {tool.readOnly ? '服务声明只读' : '服务未声明只读'}</span></Checkbox.Content>
        </Checkbox>)}</SettingsStack>
        {server.schemaHash && <><p>目录标识：{server.schemaHash.slice(0, 12)} · 授权只对当前目录有效</p><Button size="sm" data-testid={`pi-mcp-trust-${server.id}`} isDisabled={disabled || server.status !== 'ready' || !(selection[server.id]?.length)} onPress={() => void act(() => window.omniEdu?.trustXiaozhiMcp({ ...input(server), schemaHash: server.schemaHash!, tools: selection[server.id] || [] }), '已保存当前目录的工具选择，实际调用按当前任务授权处理。')}>信任并授权选中工具</Button></>}
      </SettingsSection>)}
    </SettingsStack></SettingsSection>
    <SettingsSection title="添加连接"><SettingsStack gap="sm">
      <div className="pi-settings-actions"><Button size="sm" variant={transport === 'http' ? 'secondary' : 'ghost'} isDisabled={disabled} onPress={() => { setTransport('http'); setAddress(''); setSecret(''); setAcknowledged(false); }}>远程 HTTP</Button><Button size="sm" variant={transport === 'stdio' ? 'secondary' : 'ghost'} isDisabled={disabled} onPress={() => { setTransport('stdio'); setAddress(''); setSecret(''); setAcknowledged(false); }}>本地程序 stdio</Button></div>
      <TextField value={name} onChange={setName} isDisabled={disabled}><Label>连接名称</Label><Input data-testid="pi-mcp-name" maxLength={64}/></TextField>
      <TextField value={address} onChange={setAddress} isDisabled={disabled}><Label>{transport === 'http' ? '服务地址（HTTPS）' : '本地可执行程序路径'}</Label><Input data-testid="pi-mcp-address" autoComplete="off"/></TextField>
      {transport === 'stdio' && <TextField value={args} onChange={setArgs} isDisabled={disabled}><Label>程序参数（JSON 数组，不填写密钥）</Label><Input data-testid="pi-mcp-args"/></TextField>}
      <TextField value={secret} onChange={setSecret} isDisabled={disabled}><Label>{transport === 'http' ? 'Bearer 密钥（可选）' : 'MCP_API_KEY（可选）'}</Label><Input data-testid="pi-mcp-secret" type="password" autoComplete="off"/></TextField>
      <Checkbox isSelected={acknowledged} onChange={setAcknowledged} isDisabled={disabled} data-testid="pi-mcp-ack"><Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control>我已确认此服务或程序可信，并了解其数据访问范围</Checkbox.Content></Checkbox>
      <Button data-testid="pi-mcp-add" isDisabled={disabled || !acknowledged || !name.trim() || !address.trim()} onPress={() => void add()}>保存连接</Button>
    </SettingsStack></SettingsSection>{running && <p role="status">任务运行期间不能修改工具连接。</p>}{busy && <p role="status">正在处理连接…</p>}{notice && <p role="status" data-testid="pi-mcp-notice">{notice}</p>}
  </SettingsStack>;
}
