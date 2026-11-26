import {useEffect,useState} from 'react';
import {useWorkbenchState} from './WorkbenchState';
import styles from './settings-window-bridge.module.css';

/** Main-window presentation adapter; only the host verifies the selected ID. */
export function SettingsWindowBridge(){
  const {data}=useWorkbenchState();
  const selected=data?.activeSessionId||null;
  const [dimmed,setDimmed]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>window.settingsHost?.onDim(setDimmed),[]);
  useEffect(()=>{
    let current=true;
    void window.settingsHost?.select(selected).then(()=>{if(current)setNotice('');}).catch(()=>{if(current)setNotice('设置窗口的对话范围未同步，请重新选择当前对话。');});
    return()=>{current=false;};
  },[selected]);
  return <>{dimmed&&<div className={styles.dim} aria-hidden="true" data-testid="settings-main-dim"/>}{notice&&<div className={styles.notice} role="status">{notice}</div>}</>;
}
