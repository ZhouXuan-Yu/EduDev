import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {RefreshCw} from 'lucide-react';
import {SettingsSurface,SettingsStack,SettingsInline} from './hana-settings/SettingsPrimitives';
import {XIAOZHI_SETTINGS_ERRORS,type XiaozhiSettingsView,type XiaozhiProviderBalance} from '../../../shared/xiaozhi-settings';

export function PiProviderBalance({view,onBusyChange}:{view?:XiaozhiSettingsView;onBusyChange:(busy:boolean)=>void}){
 const [balance,setBalance]=useState<XiaozhiProviderBalance>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const live=useRef(true),lock=useRef(false),generation=useRef(0);
 useEffect(()=>{generation.current++;setBalance(undefined);setError('');},[view?.version]);
 useEffect(()=>{live.current=true;return()=>{live.current=false;generation.current++;};},[]);
 useEffect(()=>{onBusyChange(busy);return()=>onBusyChange(false);},[busy,onBusyChange]);
 async function query(){
  if(lock.current||!view?.configured||view.credentialError)return;lock.current=true;setBusy(true);setBalance(undefined);setError('');const stamp=generation.current;
  try{const result=await window.omniEdu?.queryXiaozhiBalance();if(live.current&&stamp===generation.current){if(result?.ok)setBalance(result.value);else setError(result?XIAOZHI_SETTINGS_ERRORS[result.error]:'余额查询没有完成，请重试。');}}
  catch{if(live.current&&stamp===generation.current)setError('余额查询没有完成，请重试。');}
  finally{lock.current=false;if(live.current)setBusy(false);}
 }
 return <SettingsSurface data-testid="pi-provider-balance"><SettingsStack gap="md">
  <SettingsInline justify="between" wrap><h2>账户余额</h2><Button size="sm" variant="secondary" data-testid="pi-balance-refresh" isDisabled={busy||!view?.configured||!!view?.credentialError} onPress={()=>void query()}><RefreshCw size={15}/>{busy?'正在查询…':'查询余额'}</Button></SettingsInline>
  <p>查询已保存的 DeepSeek 账户。这里显示账户余额，小智不设置运行预算。</p>
  {busy&&<p role="status">正在读取官方账户余额…</p>}
  {error&&<p role="alert" data-testid="pi-balance-error">{error}</p>}
  {balance&&<div data-testid="pi-balance-result"><p>{balance.available?'账户可调用':'账户暂不可调用'} · {new Date(balance.observedAt).toLocaleString('zh-CN')}</p>{balance.balances.map(row=><p key={row.currency}>{row.currency==='CNY'?'人民币':'美元'}余额：{row.total}（充值 {row.toppedUp}，赠送 {row.granted}）</p>)}</div>}
  <details data-testid="pi-package-capabilities"><summary>扩展能力</summary>{view?.packages?.map(item=><div key={item.name} data-testid={'pi-package-'+item.name.replace(/[^\w-]/g,'_')}><strong>{item.label} · {item.state==='active'?'已接入':'已安装，接入中'}</strong><p>{item.scope}</p><small>{item.name} {item.version}</small></div>)}</details>
 </SettingsStack></SettingsSurface>;
}
