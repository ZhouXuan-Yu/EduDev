import { useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Input, Label, TextField } from '@heroui/react';
import { ArrowLeft, ChevronDown, RefreshCw } from 'lucide-react';
import { ListView } from '../../heroui-pro/components/list-view';
import { SettingsPage, SettingsSurface, SettingsStack, SettingsInline } from './hana-settings/SettingsPrimitives';
import { XIAOZHI_SETTINGS_SCHEMA, XIAOZHI_SETTINGS_ERRORS, type XiaozhiSettingsView } from '../../../shared/xiaozhi-settings';
import './pi-model-settings.css';
import {PiWebSettings} from './PiWebSettings';
import {PiProviderBalance} from './PiProviderBalance';

export function PiModelSettings({ onBack, embedded = false, onBusyChange }: { onBack: () => void; embedded?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const [view, setView] = useState<XiaozhiSettingsView>(), [model, setModel] = useState(''), [key, setKey] = useState('');
  const [busy, setBusy] = useState(false), [verifying,setVerifying]=useState(false), [loading, setLoading] = useState(true), [notice, setNotice] = useState('');
  const live = useRef(true), lock = useRef(false), stamp = useRef(0);
  const [webBusy,setWebBusy]=useState(false);
  const [balanceBusy,setBalanceBusy]=useState(false);
  const disabled = loading || busy || webBusy || balanceBusy || !view || view.locked;
  useEffect(() => { onBusyChange?.(busy||webBusy||balanceBusy); return () => onBusyChange?.(false); }, [busy,webBusy,balanceBusy, onBusyChange]);
  function accept(next: XiaozhiSettingsView) { setView(next); setModel(next.models.length && !next.models.some(item => item.id === next.defaultModel) ? (next.models.find(item=>item.id==='deepseek-flash')?.id||next.models[0].id) : next.defaultModel); }
  async function reload(refresh = false) {
    if (lock.current) return;
    setLoading(true); setNotice(''); const request = ++stamp.current;
    try {
      const result = await window.omniEdu?.getXiaozhiSettings({ refresh });
      if (!live.current || stamp.current !== request) return;
      if (result?.ok) accept(result.value); else setNotice(result ? XIAOZHI_SETTINGS_ERRORS[result.error] : '无法读取设置，请重试。');
    } catch { if (live.current && stamp.current === request) setNotice('无法读取设置，请重试。'); }
    finally { if (live.current && stamp.current === request) setLoading(false); }
  }
  useEffect(() => { live.current = true; void reload(); const unsubscribe = window.omniEdu?.onXiaozhiEvent(event => { if (event.kind === 'status') void reload(); });
    return () => { live.current = false; stamp.current++; unsubscribe?.(); }; }, []);
  async function save() {
    if (disabled || lock.current || !view) return;
    lock.current = true; setBusy(true); setNotice(''); stamp.current++;
    const input = { schemaVersion: XIAOZHI_SETTINGS_SCHEMA, version: view.version, defaultModel: model, ...(key.trim() ? { apiKey: key.trim() } : {}) };
    // The form drops its copy as soon as the teacher submits, including failed saves.
    setKey('');
    try {
      const result = await window.omniEdu?.saveXiaozhiSettings(input);
      if (!live.current) return;
      if (result?.ok) { accept(result.value); setNotice('已保存。默认模型用于新对话，已有对话继续使用原模型。'); }
      else setNotice(result ? XIAOZHI_SETTINGS_ERRORS[result.error] : '设置没有保存，请重试。');
    } catch { if (live.current) setNotice('设置没有保存，请重试。'); }
    finally { lock.current = false; if (live.current) setBusy(false); }
  }
  async function verify(){
    if(disabled||lock.current||!view||!key.trim())return;
    lock.current=true;setBusy(true);setVerifying(true);setNotice('');stamp.current++;
    try{
      const result=await window.omniEdu?.verifyXiaozhiCredential({schemaVersion:XIAOZHI_SETTINGS_SCHEMA,apiKey:key.trim()});
      if(!live.current)return;
      if(result?.ok){
        const next={...view,models:result.value.models,catalogue:'official' as const,catalogueError:undefined};
        setView(next);setModel(next.models.some(item=>item.id===model)?model:(next.models.find(item=>item.id==='deepseek-flash')?.id||next.models[0]?.id||''));
        setNotice('密钥验证通过。请选择新对话的默认模型，再点击保存；当前密钥尚未保存。');
      }else setNotice(result?XIAOZHI_SETTINGS_ERRORS[result.error]:'验证没有完成，请重试。');
    }catch{if(live.current)setNotice('验证没有完成，请重试。');}
    finally{lock.current=false;if(live.current){setBusy(false);setVerifying(false);}}
  }
  return <div className={`pi-model-settings${embedded ? ' pi-settings-embedded' : ' pi-themed-surface'}`} data-testid="pi-model-settings">
    {!embedded && <header><Button variant="ghost" size="sm" data-testid="nav-ai" onPress={onBack}><ArrowLeft size={17} />返回小智</Button><span>设置</span></header>}
    <main>
      <SettingsPage tab="models"><SettingsStack gap="lg">
        <div><h1>模型与连接</h1><p>连接你的模型服务，设置小智新对话使用的模型。</p></div>
        <SettingsSurface className="pi-settings-provider"><SettingsStack gap="md">
          <SettingsInline justify="between" wrap><h2>DeepSeek</h2><span data-testid="pi-settings-configured">{view?.configured ? `已配置 · ${view.maskedApiKey}` : '尚未配置'}</span></SettingsInline>
          <p>当前使用 DeepSeek 官方接口。</p>
          {view?.credentialError && <p role="alert" data-testid="pi-settings-credential-error">{view.credentialError === 'storage_unavailable' ? '本机安全存储暂时不可用，请稍后重试。' : '本机无法读取已保存的密钥，请重新输入并保存。'}</p>}
          <form onSubmit={event => { event.preventDefault(); void save(); }}>
            <SettingsStack gap="md">
              <TextField isDisabled={disabled} value={key} onChange={setKey}><Label>API 密钥</Label><Input type="password" autoComplete="off" data-testid="pi-settings-key" placeholder="留空保留现有密钥" /></TextField>
              <SettingsInline justify="end"><Button type="button" variant="secondary" data-testid="pi-settings-verify" isDisabled={disabled||!key.trim()} onPress={()=>void verify()}>{verifying?'正在验证…':'验证密钥'}</Button></SettingsInline>
              <div className="pi-settings-model-field"><Label>新对话默认模型</Label><Dropdown>
                <Button variant="secondary" data-testid="pi-settings-default-model" isDisabled={disabled || !view?.models.length}>{model || (view?.models.length ? '请选择官方模型' : '等待模型列表')}<ChevronDown size={15} /></Button>
                <Dropdown.Popover className="pi-office-menu"><Dropdown.Menu aria-label="新对话默认模型" selectionMode="single" selectedKeys={[model]} onAction={id => { if (!disabled && view?.models.some(item => item.id === String(id))) setModel(String(id)); }}>
                  {view?.models.map(item => <Dropdown.Item key={item.id} id={item.id} textValue={item.id}><Label>{item.id}</Label><Dropdown.ItemIndicator /></Dropdown.Item>)}
                </Dropdown.Menu></Dropdown.Popover>
              </Dropdown></div>
              {view?.models.length&&!view.models.some(item=>item.id===view.defaultModel)&&<p role="status" data-testid="pi-settings-model-unavailable">原默认模型 {view.defaultModel} 已不在当前目录。请选择可用模型，保存后用于新对话。</p>}
              <SettingsInline justify="end"><Button type="submit" data-testid="pi-settings-save" isDisabled={disabled || !model}>{busy ? '正在验证并保存…' : '保存'}</Button></SettingsInline>
            </SettingsStack>
          </form>
          {view?.locked && <p role="status">小智正在处理任务，结束后可修改配置。</p>}
        </SettingsStack></SettingsSurface>
        <SettingsStack gap="sm"><SettingsInline justify="between" wrap><h2>可用模型</h2><Button size="sm" variant="ghost" data-testid="pi-settings-refresh" isDisabled={loading || busy} onPress={() => void reload(true)}><RefreshCw size={15} />{loading ? '正在读取…' : '刷新模型'}</Button></SettingsInline>
          {view?.catalogueError && <p role="alert" data-testid="pi-settings-catalogue-error">{XIAOZHI_SETTINGS_ERRORS[view.catalogueError]}{view.models.length ? ' 显示上次读取的官方目录。' : ''}</p>}
          {view?.catalogue === 'cache' && <p>{view.models.some(item => item.stale) ? '上次官方目录已过期，请刷新。' : '官方目录 · 本地缓存'}</p>}
          <ListView aria-label="DeepSeek 官方模型" variant="secondary" selectionMode="none" data-testid="pi-settings-model-list" renderEmptyState={() => <p>{loading ? '正在读取模型…' : '模型目录尚未读取，检查连接后重试。'}</p>}>
            {view?.models.map(item => <ListView.Item id={item.id} key={item.id} textValue={item.name}><ListView.ItemContent><ListView.Title>{item.name}</ListView.Title><ListView.Description>{item.id} · 上下文 {item.contextWindow.toLocaleString()} · 模型输出上限 {item.maxOutputTokens.toLocaleString()}</ListView.Description></ListView.ItemContent></ListView.Item>)}
          </ListView>
          <p>以上为模型官方能力。每轮实际回复上限由当前任务设置控制。</p>
        </SettingsStack>
        <PiWebSettings locked={busy||!!view?.locked} onBusyChange={setWebBusy}/>
        <PiProviderBalance view={view} onBusyChange={setBalanceBusy}/>
        {notice && <p role="status" data-testid="pi-settings-feedback">{notice}</p>}
      </SettingsStack></SettingsPage>
    </main>
  </div>;
}
