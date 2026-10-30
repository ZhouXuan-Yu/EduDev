import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {MANAGED_TOOL_ERRORS,type ManagedToolView,type ManagedToolPhase} from '../../../shared/managed-tools';
import {SettingsSection} from './hana-settings/SettingsSection';
import {SettingsRow} from './hana-settings/SettingsRow';
const phases:Record<ManagedToolPhase,string>={checking:'正在检查本机',downloading:'正在下载',verifying:'正在校验',installing:'正在准备文件',health:'正在实际运行检查',activating:'正在启用',ready:'已就绪',cancelled:'已取消',failed:'未完成'};
const states={ready:'可用',missing_dependency:'缺少组件',authorization_required:'需要授权',unsupported:'当前不支持',fault:'组件故障'};
export function PiManagedTools({running,onBusyChange}:{running:boolean;onBusyChange?:(value:boolean)=>void}){
  const [items,setItems]=useState<ManagedToolView[]>([]),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const live=useRef(false),reading=useRef(false),command=useRef<string|undefined>(undefined);
  async function refresh(){if(reading.current)return;reading.current=true;try{const result=await window.omniEdu?.listManagedTools();if(!live.current)return;if(!result?.ok)throw Error('configuration');setItems(result.value);setLoading(false);}catch{if(live.current){setNotice('工具状态暂时无法读取，请重试。');setLoading(false);}}finally{reading.current=false;}}
  useEffect(()=>{live.current=true;void refresh();const timer=setInterval(()=>void refresh(),1000);return()=>{live.current=false;clearInterval(timer);};},[]);
  async function prepare(id:string){
    if(command.current||running)return;command.current='mtcmd_'+crypto.randomUUID();setBusy(true);setNotice('');onBusyChange?.(true);
    try{const result=await window.omniEdu?.prepareManagedTool({id,commandId:command.current});if(!result?.ok)throw Error(result?.error||'configuration');if(live.current)setItems([result.value]);}
    catch(error){if(live.current)setNotice(MANAGED_TOOL_ERRORS[error instanceof Error?error.message:'configuration']||MANAGED_TOOL_ERRORS.configuration);}
    finally{command.current=undefined;if(live.current)setBusy(false);onBusyChange?.(false);void refresh();}
  }
  async function remove(id:string){if(busy||running)return;setBusy(true);onBusyChange?.(true);setNotice('');try{const result=await window.omniEdu?.removeManagedTool(id);if(!result?.ok)throw Error(result?.error||'configuration');if(live.current)setItems([result.value]);}catch(error){if(live.current)setNotice(MANAGED_TOOL_ERRORS[error instanceof Error?error.message:'configuration']||MANAGED_TOOL_ERRORS.configuration);}finally{if(live.current)setBusy(false);onBusyChange?.(false);}}
  return <div data-testid="pi-managed-tools"><SettingsSection title="本地计算工具" description="需要时由小智准备认可的免费组件，然后继续任务；已有工具可离线使用。">
    {loading&&<p role="status">正在核对本机工具…</p>}
    {items.map(item=><div key={item.id} data-testid="pi-managed-tool" data-status={item.status} data-phase={item.phase||''}>
      <SettingsRow label={`${item.name} · ${item.version}`} hint={`${states[item.status]} · ${item.reason}`} control={<div>
        <Button size="sm" data-testid="pi-managed-tool-prepare" isDisabled={busy||running||item.status==='ready'||item.status==='unsupported'} onPress={()=>void prepare(item.id)}>准备工具</Button>
        {command.current&&<Button size="sm" variant="ghost" data-testid="pi-managed-tool-cancel" onPress={()=>void window.omniEdu?.cancelManagedTool(command.current!)}>取消准备</Button>}
        {item.origin==='download'&&<Button size="sm" variant="ghost" data-testid="pi-managed-tool-remove" isDisabled={busy||running||item.inUse>0} onPress={()=>void remove(item.id)}>卸载组件</Button>}
      </div>}/>
      <p>{item.nextAction}{item.inUse>0?` · ${item.inUse} 个任务正在使用`:''}</p>
      {item.phase&&<p role="status" data-testid="pi-managed-tool-progress">{phases[item.phase]}{item.phase==='downloading'?` · ${item.downloadedBytes||0} / ${item.downloadBytes} 字节`:''}</p>}
      <details><summary>来源与组件信息</summary><p>{item.sourceUrl}</p><p>{item.license} · 下载 {item.downloadBytes} 字节 · 组件 {item.installedBytes} 字节</p></details>
    </div>)}
    {notice&&<p role="status" data-testid="pi-managed-tool-notice">{notice}</p>}
    <Button size="sm" variant="ghost" data-testid="pi-managed-tool-refresh" isDisabled={busy} onPress={()=>void refresh()}>重新检查</Button>
  </SettingsSection></div>;
}
