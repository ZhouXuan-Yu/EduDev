import { useEffect, useRef, useState } from 'react';
import { Button, Dropdown, Input, Label, TextField } from '@heroui/react';
import { ArrowLeft, ChevronDown, RefreshCw } from 'lucide-react';
import { ListView } from '../../heroui-pro/components/list-view';
import { SettingsPage } from './hana-settings/SettingsPrimitives';
import { DisclosureCard } from '../ui/DisclosureCard';
import { XIAOZHI_SETTINGS_SCHEMA, XIAOZHI_SETTINGS_ERRORS, type XiaozhiSettingsView } from '../../../shared/xiaozhi-settings';
import styles from '../../ui-system/student-settings/student-settings-layout.module.css';
import {PiWebSettings} from './PiWebSettings';
import {PiProviderBalance} from './PiProviderBalance';
import {PiThinkingPicker} from './PiThinkingPicker';
import {PiConfigHistory} from './PiConfigHistory';
import type {OrdinaryCommit} from '../../../shared/xiaozhi-ordinary-config';
import type {ThinkingChoice} from '../../../shared/xiaozhi-thinking';
import {useDesktopNavigationGuard} from '../desktop/DesktopFrame';

export function PiModelSettings({ onBack, embedded = false, onBusyChange, onSaved, currentSession }: {
  onBack: () => void; embedded?: boolean; onBusyChange?: (busy: boolean) => void; onSaved?: (view: XiaozhiSettingsView) => void;
  currentSession?: { id: string; title: string };
}) {
  const [view, setView] = useState<XiaozhiSettingsView>(), [model, setModel] = useState<string|null>(null), [key, setKey] = useState('');
  const [busy, setBusy] = useState(false), [verifying,setVerifying]=useState(false), [loading, setLoading] = useState(true), [notice, setNotice] = useState('');
  const [historyOpen,setHistoryOpen]=useState(false);
  const [windowNotice,setWindowNotice]=useState('');
  const live = useRef(true), lock = useRef(false), stamp = useRef(0);
  const deferredConfigRead = useRef(false);
  const draft = useRef<{version:number;model:string|null}|undefined>(undefined);
  const pendingSave=useRef<OrdinaryCommit|undefined>(undefined);
  const pendingThinking=useRef<OrdinaryCommit|undefined>(undefined);
  const [webBusy,setWebBusy]=useState(false);
  const [balanceBusy,setBalanceBusy]=useState(false);
  const dirty=Boolean(draft.current&&(model!==draft.current.model||key.trim()||view?.version!==draft.current.version));
  const conflict=dirty&&draft.current?.version!==view?.version;
  useDesktopNavigationGuard(dirty || busy, '模型设置有未保存的更改，请先保存或放弃。');
  const disabled = loading || busy || webBusy || balanceBusy || !view || (view.ordinaryLocked??view.locked);
  const credentialDisabled=disabled||Boolean(view?.locked);
  const modelUnavailable=model!==null&&!!view?.models.length&&!view.models.some(item=>item.id===model);

  useEffect(() => { onBusyChange?.(dirty||busy||webBusy||balanceBusy); return () => onBusyChange?.(false); }, [dirty,busy,webBusy,balanceBusy, onBusyChange]);

  function accept(next:XiaozhiSettingsView){
    setView(next);
    if(!draft.current)setModel(next.defaultModelOverride??null);
  }
  function startDraft(){
    if(view&&!draft.current)draft.current={version:view.version,model:view.defaultModelOverride??null};
    pendingSave.current=undefined;
  }
  function editModel(next:string|null){
    if(model===next)return;
    startDraft();
    setModel(next);
    if(!key.trim()&&next===view?.defaultModelOverride&&draft.current?.version===view?.version)draft.current=undefined;
  }
  function editKey(next:string){
    startDraft();
    setKey(next);
    if(!next.trim()&&model===view?.defaultModelOverride&&draft.current?.version===view?.version)draft.current=undefined;
  }
  function discard(){
    draft.current=undefined;pendingSave.current=undefined;
    setModel(view?.defaultModelOverride??null);setKey('');setNotice('已放弃未保存的模型设置。');
  }
  async function openConfigWindow(sessionId?: string) {
    setWindowNotice('');
    try {
      const result = await window.omniEdu?.openXiaozhiConfigWindow?.(sessionId);
      if (!result?.ok) setWindowNotice(result ? XIAOZHI_SETTINGS_ERRORS[result.error] : '暂时无法打开普通设置窗口。');
      else if (result.value === 'focused_other_scope') setWindowNotice('已聚焦原窗口。要更换会话范围，请关闭该窗口后重新打开。');
    } catch {
      setWindowNotice('暂时无法打开普通设置窗口。');
    }
  }
  async function reload(refresh=false,automatic=false) {
    if(lock.current)return;
    if(!automatic)setLoading(true);
    const request=++stamp.current;
    try {
      const result = await window.omniEdu?.getXiaozhiSettings({refresh});
      if(!live.current||stamp.current!==request)return;
      if(result?.ok){
        accept(result.value);
        if(refresh)setNotice(result.value.catalogueError?'模型目录刷新失败。已保存的设置保持有效。':'模型目录已刷新。');
      }else if(!automatic)setNotice(result?XIAOZHI_SETTINGS_ERRORS[result.error]:'无法读取设置，请重试。');
    }catch{if(live.current&&stamp.current===request&&!automatic)setNotice('无法读取设置，请重试。');}
    finally{if(live.current&&stamp.current===request)setLoading(false);}
  }
  useEffect(()=>{
    live.current=true;
    void reload();
    const unsubscribe=window.omniEdu?.onXiaozhiEvent(event=>{if(event.kind==='status')void reload(false,true);});
    const unsubscribeConfig=window.omniEdu?.onXiaozhiConfigChange?.(change=>{
      if(change.sessionId)return;
      if(lock.current)deferredConfigRead.current=true;
      else void reload(false,true);
    });
    return ()=>{live.current=false;stamp.current++;unsubscribe?.();unsubscribeConfig?.();};
  },[]);
  function unlock(){
    lock.current=false;
    if(!live.current)return;
    setBusy(false);
    if(deferredConfigRead.current){
      deferredConfigRead.current=false;
      void reload(false,true);
    }
  }

  async function save(){
    if(disabled||lock.current||!view||!draft.current||!dirty||conflict&&!pendingSave.current||modelUnavailable||key.trim()&&credentialDisabled)return;
    lock.current=true;setBusy(true);setLoading(false);setNotice('');stamp.current++;
    let received=false;
    try{
      let input=pendingSave.current;
      const hadCredential=Boolean(key.trim());
      if(!input){
        const operationId=crypto.randomUUID(),expectedVersion=draft.current.version;
        input={operationId,field:'default_model',expectedVersion,value:model};
        if(hadCredential){
          const staged=await window.omniEdu?.stageXiaozhiCredential({schemaVersion:XIAOZHI_SETTINGS_SCHEMA,apiKey:key.trim()});
          if(!live.current)return;
          if(!staged?.ok){setNotice(staged?XIAOZHI_SETTINGS_ERRORS[staged.error]:'密钥暂时无法验证，请重试。');return;}
          input.credentialId=staged.value.credentialId;
        }
        pendingSave.current=input;
      }
      const result=await window.omniEdu?.commitXiaozhiConfig(input);
      if(!live.current)return;
      if(!result?.ok){
        setNotice(result?XIAOZHI_SETTINGS_ERRORS[result.error]:'未收到保存回执，可以重试同一次提交。');
        if(result?.error==='validation_unavailable'&&input.credentialId)pendingSave.current=undefined;
        if(result?.error==='conflict'){
          pendingSave.current=undefined;
          const fresh=await window.omniEdu?.getXiaozhiSettings();
          if(fresh?.ok&&live.current)accept(fresh.value);
        }
        return;
      }
      received=true;
      draft.current=undefined;pendingSave.current=undefined;setKey('');
      const updated={...view,version:result.value.version,defaultModelOverride:model,defaultModel:model??view.defaultModel};
      accept(updated);
      const saved=result.value.outcome==='committed'?'已保存。更改从下一次适用运行生效。':'设置没有变化。';
      setNotice(saved);
      // A newly supplied credential already required a successful catalogue fetch before commit.
      const refreshCatalogue=result.value.outcome==='committed'&&view.configured&&!hadCredential;
      const fresh=await window.omniEdu?.getXiaozhiSettings({refresh:refreshCatalogue});
      if(!live.current)return;
      if(fresh?.ok){
        accept(fresh.value);onSaved?.(fresh.value);
        if(fresh.value.catalogueError)setNotice(saved+' 模型目录刷新失败，可以单独刷新。');
      }else setNotice(saved+' 设置读取失败，可以刷新后查看。');
    }catch{
      if(live.current)setNotice(received?'已保存。设置刷新失败，可以单独刷新。':'未收到保存回执，可以重试同一次提交。');
    }finally{
      unlock();
    }
  }

  async function saveThinking(choice:ThinkingChoice|null){
    if(choice===null||disabled||lock.current||!view?.thinking)return;
    lock.current=true;setBusy(true);setNotice('');stamp.current++;
    const expectedVersion=view.thinking.global.version;
    const existing=pendingThinking.current;
    const input=existing?.expectedVersion===expectedVersion&&existing.value===choice?existing
      :{operationId:crypto.randomUUID(),field:'global_thinking' as const,expectedVersion,value:choice};
    pendingThinking.current=input;
    try{
      const result=await window.omniEdu?.commitXiaozhiConfig(input);
      if(!live.current)return;
      if(result?.ok){
        pendingThinking.current=undefined;
        setView({...view,thinking:{...view.thinking,global:{version:result.value.version,choice}}});
        setNotice(result.value.outcome==='committed'?'默认思考已保存。没有会话覆盖的对话从下一轮生效。':'默认思考强度没有变化。');
      }else{
        setNotice(result?XIAOZHI_SETTINGS_ERRORS[result.error]:'未收到保存回执，可以重试同一次提交。');
        if(result?.error==='conflict'){
          const fresh=await window.omniEdu?.getXiaozhiSettings();
          if(fresh?.ok&&live.current)accept(fresh.value);
        }
      }
    }catch{if(live.current)setNotice('未收到保存回执，可以重试同一次提交。');}
    finally{unlock();}
  }

  async function verify(){
    if(credentialDisabled||lock.current||!view||!key.trim())return;
    lock.current=true;setBusy(true);setVerifying(true);setNotice('');stamp.current++;
    try{
      const result=await window.omniEdu?.verifyXiaozhiCredential({schemaVersion:XIAOZHI_SETTINGS_SCHEMA,apiKey:key.trim()});
      if(!live.current)return;
      if(result?.ok){
        const next={...view,models:result.value.models,catalogue:'official' as const,catalogueError:undefined};
        setView(next);
        setNotice('密钥验证通过。请选择新对话的默认模型，再点击保存；当前密钥尚未保存。');
      }else setNotice(result?XIAOZHI_SETTINGS_ERRORS[result.error]:'验证没有完成，请重试。');
    }catch{if(live.current)setNotice('验证没有完成，请重试。');}
    finally{unlock();if(live.current)setVerifying(false);}
  }
  const migrations=Object.values(view?.legacyCredentialMigration ?? {});
  const migrationPending=migrations.some(status=>status!=='not_needed' && status!=='migrated');
  return <div className={embedded ? styles.modelEmbedded : styles.modelStandalone} data-testid="pi-model-settings">
    {!embedded && <header className={styles.standaloneHeader}><Button variant="ghost" size="sm" data-testid="nav-ai" onPress={onBack}><ArrowLeft size={17} />返回小智</Button><span>设置</span></header>}
    <main className={styles.modelMain}>
      <SettingsPage tab="models" className={styles.modelContent}>
        <section className={styles.section} aria-labelledby="pi-model-heading">
          <header className={styles.sectionHeading}><h2 id="pi-model-heading">模型与连接</h2><p>配置模型后，新对话使用这里的默认值。</p></header>
          <div className={styles.configActions}>
            <Button type="button" variant="secondary" data-testid="pi-settings-open-config-window" onPress={() => void openConfigWindow()}>
              在新窗口打开普通设置
            </Button>
            {currentSession&&<Button type="button" variant="ghost" data-testid="pi-settings-open-session-config-window"
              onPress={() => void openConfigWindow(currentSession.id)}>为当前会话打开</Button>}
          </div>
          {currentSession&&<p className={styles.hint}>当前会话：{currentSession.title}</p>}
          {windowNotice&&<p role="alert">{windowNotice}</p>}
          {view?.credentialError && <p role="alert" data-testid="pi-settings-credential-error">{view.credentialError === 'storage_unavailable' ? '本机安全存储暂时不可用，请稍后重试。' : '本机无法读取已保存的密钥，请重新输入并保存。'}</p>}
          {migrationPending && <p role="status" data-testid="pi-settings-credential-migration-pending">历史密钥尚未迁移。请检查本机安全存储或重新保存密钥。</p>}
          {!migrationPending && migrations.includes('migrated') && <p role="status" data-testid="pi-settings-credential-migration-done">历史密钥已转存到本机安全存储。</p>}
          {loading && <p role="status" data-testid="pi-settings-loading">正在读取模型设置…</p>}
          {view?.catalogueError && <p role="alert" data-testid="pi-settings-catalogue-error">{XIAOZHI_SETTINGS_ERRORS[view.catalogueError]}{view.models.length ? ' 显示上次读取的官方目录。' : ''}</p>}
          {!loading&&!view&&<Button variant="secondary" data-testid="pi-settings-retry-read" onPress={()=>void reload()}>重新读取设置</Button>}
          <form onSubmit={event => { event.preventDefault(); void save(); }}>
            <div className={styles.row}>
              <div className={styles.rowText}>
                <label className={styles.rowLabel} htmlFor="pi-settings-api-key">API 密钥</label>
                <p className={styles.hint}>留空时保留已有密钥。当前使用 DeepSeek 官方接口。</p>
                <p className={styles.hint} data-testid="pi-settings-configured">{loading ? '正在读取配置状态…' : !view ? '配置状态尚未读出' : view.configured ? `已配置 · ${view.maskedApiKey}` : '尚未配置'}</p>
              </div>
              <div className={styles.credentialControl}>
                <TextField aria-label="API 密钥" isDisabled={credentialDisabled} value={key} onChange={editKey}><Input className={styles.readablePlaceholder} id="pi-settings-api-key" type="password" autoComplete="off" data-testid="pi-settings-key" placeholder="留空保留现有密钥" /></TextField>
                <div className={styles.save}><Button type="button" variant="secondary" data-testid="pi-settings-verify" isDisabled={credentialDisabled || !key.trim()} onPress={() => void verify()}>{verifying ? '正在验证…' : '验证密钥'}</Button></div>
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.rowText}><span className={styles.rowLabel}>默认模型</span><p className={styles.hint}>会话内可以单独选择，已有对话继续使用原模型。</p></div>
              <div className={styles.control}>
                <Dropdown>
                  <Button variant="secondary" aria-label="新对话默认模型" data-testid="pi-settings-default-model" isDisabled={disabled}>
                    {model??(view?.defaultModelOverride===null?`跟随当前来源 · ${view.defaultModel}`:'跟随当前来源')}<ChevronDown size={15} />
                  </Button>
                  <Dropdown.Popover className="pi-office-menu"><Dropdown.Menu aria-label="新对话默认模型" selectionMode="single" selectedKeys={[model??'source:inherit']} onAction={id=>{
                    if(disabled)return;
                    if(id==='source:inherit')editModel(null);
                    else if(view?.models.some(item=>item.id===String(id)))editModel(String(id));
                  }}>
                    <Dropdown.Item id="source:inherit" textValue="跟随当前来源"><Label>跟随当前来源</Label><Dropdown.ItemIndicator/></Dropdown.Item>
                    {view?.models.map(item => <Dropdown.Item key={item.id} id={item.id} textValue={item.id}><Label>{item.id}</Label><Dropdown.ItemIndicator /></Dropdown.Item>)}
                  </Dropdown.Menu></Dropdown.Popover>
                </Dropdown>
              </div>
            </div>
            {modelUnavailable && (
              <p role="status" data-testid="pi-settings-model-unavailable">模型 {model} 已不在当前目录。请选择可用模型，保存后用于新对话。</p>
            )}
            <div className={`${styles.row} ${styles.thinkingRow}`}>
              <div className={styles.rowText}><span className={styles.rowLabel}>默认思考强度</span><p className={styles.hint}>选择后即保存，没有会话覆盖的对话从下一轮生效。</p></div>
              <div className={styles.thinkingControl}>
                <PiThinkingPicker view={view} scope="global" disabled={disabled} onChange={choice=>void saveThinking(choice)}/>
              </div>
            </div>
            <div className={styles.save}>
              {dirty&&<Button type="button" variant="ghost" data-testid="pi-settings-discard" isDisabled={busy} onPress={discard}>放弃修改</Button>}
              {conflict&&<Button type="button" variant="secondary" data-testid="pi-settings-rebase" isDisabled={disabled} onPress={()=>{
                if(!view)return;
                draft.current={version:view.version,model:view.defaultModelOverride??null};pendingSave.current=undefined;
                setNotice('已保留草稿并采用最新配置版本。请核对后保存。');
              }}>保留草稿，采用最新版本</Button>}
              <Button className="edu-primary-action-contrast" type="submit" data-testid="pi-settings-save"
                isDisabled={disabled||!dirty||conflict&&!pendingSave.current||modelUnavailable||Boolean(key.trim()&&credentialDisabled)}>{busy?'正在处理…':'保存模型设置'}</Button>
            </div>
            {dirty&&<p className={styles.hint} data-testid="pi-settings-unsaved">模型或密钥有未保存的更改。你可以继续编辑、保存或放弃。</p>}
            {conflict&&<p role="alert" data-testid="pi-settings-draft-conflict">
              已保存的配置发生变化，当前草稿已保留。当前已保存：{view?.defaultModelOverride??'跟随当前来源'}。
              草稿中的默认模型：{model??'跟随当前来源'}。
            </p>}
          </form>
          {view?.locked&&<p role="status">运行或其他宿主操作期间暂不能更新密钥。</p>}
          {notice && <p role="status" data-testid="pi-settings-feedback">{notice}</p>}
        </section>
        <DisclosureCard title="最近配置修改" isExpanded={historyOpen} onExpandedChange={setHistoryOpen} data-testid="pi-settings-config-history">
          <PiConfigHistory field="default_model" open={historyOpen} version={view?.version} disabled={disabled} onUndone={()=>void reload(false,true)}/>
          <PiConfigHistory field="global_thinking" open={historyOpen} version={view?.thinking?.global.version} disabled={disabled} onUndone={()=>void reload(false,true)}/>
        </DisclosureCard>
        <PiWebSettings locked={busy || !!view?.locked} onBusyChange={setWebBusy}/>
        <DisclosureCard title="可用模型与账户信息" data-testid="pi-settings-model-details">
          <div className={styles.details}>
            <section aria-labelledby="pi-model-catalogue-heading">
              <header className={styles.catalogueHeading}><h2 id="pi-model-catalogue-heading">可用模型</h2><Button size="sm" variant="ghost" data-testid="pi-settings-refresh" isDisabled={loading || busy} onPress={() => void reload(true)}><RefreshCw size={15} />{loading ? '正在读取…' : '刷新模型'}</Button></header>
                <div className={styles.catalogue}>
                {view?.catalogue === 'cache' && <p>{view.models.some(item => item.stale) ? '上次官方目录已过期，请刷新。' : '官方目录 · 本地缓存'}</p>}
                <ListView aria-label="DeepSeek 官方模型" variant="secondary" selectionMode="none" data-testid="pi-settings-model-list" renderEmptyState={() => <p>{loading ? '正在读取模型…' : '模型目录尚未读取，检查连接后重试。'}</p>}>
                  {view?.models.map(item => <ListView.Item id={item.id} key={item.id} textValue={item.name}><ListView.ItemContent><ListView.Title>{item.name}</ListView.Title><ListView.Description>{item.id} · 上下文 {item.contextWindow.toLocaleString()} · 模型输出上限 {item.maxOutputTokens.toLocaleString()}</ListView.Description></ListView.ItemContent></ListView.Item>)}
                </ListView>
                <p className={styles.hint}>刷新只请求官方模型目录，用于核对模型名称、容量和思考档位，不发送教学问题或继续旧任务。以上为模型官方能力，每轮实际回复上限受当前任务与模型容量约束。</p>
                </div>
            </section>
            <PiProviderBalance view={view} onBusyChange={setBalanceBusy}/>
          </div>
        </DisclosureCard>
      </SettingsPage>
    </main>
  </div>;
}
