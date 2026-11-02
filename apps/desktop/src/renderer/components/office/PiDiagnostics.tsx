import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import type {DiagnosticPreview,DiagnosticError} from '../../../shared/xiaozhi-diagnostics';
import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import {SettingsSection} from './hana-settings/SettingsSection';
import {SettingsStack} from './hana-settings/SettingsPrimitives';
import './pi-diagnostics.css';
const messages:Record<DiagnosticError,string>={invalid_input:'诊断参数无效，请重新选择记录。',permission_denied:'当前窗口无法读取诊断。',unavailable:'本轮没有可读取的 Pi 诊断记录，或记录暂时无法核对。请刷新重试。',expired:'这份诊断已过期，请重新读取后导出。',busy:'另一个诊断正在保存，请稍后重试。',write_failed:'诊断未保存，可能是目录不可写或文件被占用。请重新另存。'};
export function PiDiagnostics({sessionId,turns,onBusyChange}:{sessionId:string;turns:Pick<OfficeProjectedTurn,'id'|'status'>[];onBusyChange?:(busy:boolean)=>void}){
 const [runId,setRunId]=useState(turns.at(-1)?.id||''),[preview,setPreview]=useState<DiagnosticPreview>(),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const live=useRef(true),generation=useRef(0),lock=useRef(false);
 useEffect(()=>{live.current=true;return()=>{live.current=false;generation.current++;};},[]);
 useEffect(()=>{onBusyChange?.(busy);return()=>onBusyChange?.(false);},[busy,onBusyChange]);
 async function act(save:boolean){if(lock.current||!runId)return;lock.current=true;setBusy(true);setNotice('');const own=++generation.current;
  try{const api=window.omniEdu;if(!api)throw Error();
   if(save){if(!preview)return;const r=await api.saveXiaozhiDiagnostic({sessionId,previewId:preview.previewId});if(!live.current||own!==generation.current)return;
    if(r.ok)setNotice(r.value.cancelled?'已取消导出，未写入文件。':`诊断已保存，共 ${r.value.bytes} 字节，摘要 ${r.value.sha256.slice(0,12)}。`);else{setNotice(messages[r.error]);if(r.error==='expired')setPreview(undefined);}
   }else{setPreview(undefined);const r=await api.previewXiaozhiDiagnostic({sessionId,runId});if(!live.current||own!==generation.current)return;if(r.ok)setPreview(r.value);else setNotice(messages[r.error]);}
  }catch{if(live.current&&own===generation.current)setNotice(save?messages.write_failed:messages.unavailable);}finally{lock.current=false;if(live.current)setBusy(false);}
 }
 return <SettingsSection title="本轮诊断（高级）" description="在本机查看与另存，不自动上传，也不会重新执行任务。"><SettingsStack gap="sm">
  {!turns.length?<p data-testid="pi-diagnostic-empty">还没有运行记录。诊断不会为此创建模型请求。</p>:<>
   <label className="pi-diagnostic-choice">诊断轮次<select aria-label="诊断轮次" data-testid="pi-diagnostic-run" value={runId} disabled={busy} onChange={e=>{generation.current++;setRunId(e.target.value);setPreview(undefined);setNotice('');}}>{turns.map((t,i)=><option key={t.id} value={t.id}>第 {i+1} 轮{ i===turns.length-1?'（最近）':''}</option>)}</select></label>
   <div className="pi-settings-actions"><Button size="sm" variant="secondary" data-testid="pi-diagnostic-preview" isDisabled={busy||!runId} onPress={()=>void act(false)}>{busy?'正在处理…':preview?'重新读取诊断':'查看本轮诊断'}</Button>{preview&&<Button size="sm" variant="ghost" data-testid="pi-diagnostic-save" isDisabled={busy} onPress={()=>void act(true)}>导出这份诊断</Button>}</div>
  </>}
  {preview&&<div data-testid="pi-diagnostic-result"><p>已存记录快照 · {new Date(preview.report.generatedAt).toLocaleString('zh-CN')} · {preview.bytes} 字节。运行中的记录可能尚未结算；导出保留这份快照。</p><p>包含版本、阶段、错误类别和已记录用量；不包含原文、推理、学生字段、文件路径或密钥。费用未知；缺失数据不按零费用处理。</p><pre className="pi-diagnostic-preview" tabIndex={0} aria-label="脱敏诊断内容" data-testid="pi-diagnostic-json">{JSON.stringify(preview.report,null,2)}</pre><p>SHA256：<span className="pi-diagnostic-digest" data-testid="pi-diagnostic-hash">{preview.sha256}</span></p></div>}
  {notice&&<p role="status" data-testid="pi-diagnostic-notice">{notice}</p>}
 </SettingsStack></SettingsSection>;
}
