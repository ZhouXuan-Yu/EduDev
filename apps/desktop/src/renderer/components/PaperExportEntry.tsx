import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import type {PaperView} from '../../shared/paper-blueprint';
import {PAPER_OUTPUT_SCHEMA,type PaperExportInput} from '../../shared/paper-export';
import {XIAOZHI_ERRORS} from '../../shared/xiaozhi-projection';
import {useDesktopNavigation} from './desktop/DesktopFrame';

/** Native output-only grant; input workspace and Office approval stay unchanged. */
export function PaperExportEntry({view,disabled=false,onPrepared}:{view:PaperView;disabled?:boolean;onPrepared?:()=>void}){
 const navigation=useDesktopNavigation(),[label,setLabel]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),owner=useRef(0),lock=useRef(false);
 useEffect(()=>{const stamp=++owner.current;setLabel('');setError('');void window.omniEdu?.getXiaozhiSnapshot(view.sessionId).then(s=>{if(owner.current===stamp)setLabel(s.paperOutput?.label||s.workspace?.label||'');}).catch(()=>{if(owner.current===stamp)setError('保存位置读取未完成，请重新选择。');});return()=>{owner.current++;};},[view.sessionId]);
 async function choose(){
  const result=await window.omniEdu?.selectPaperOutput({schemaVersion:PAPER_OUTPUT_SCHEMA,sessionId:view.sessionId});
  if(!result?.ok)throw Error(result?XIAOZHI_ERRORS[result.error]:'目录选择未完成，请重试。');
  const snapshot=await window.omniEdu?.getXiaozhiSnapshot(view.sessionId);return snapshot?.paperOutput?.label||snapshot?.workspace?.label||'';
 }
 async function prepare(audience?:PaperExportInput['audience'],format?:PaperExportInput['format']){
  if(lock.current||disabled)return;lock.current=true;const stamp=owner.current;setBusy(true);setError('');
  try{
   const destination=audience&&label?label:await choose();if(stamp!==owner.current)return;setLabel(destination);
   if(!destination){setError('未选择保存文件夹，尚未发起导出。');return;}
   if(audience&&format){navigation.navigate({view:'ai',sessionId:view.sessionId,draft:'请使用 education_export_paper 将本会话最新已确认试卷导出为'+(audience==='student'?'学生卷':'教师答案卷')+'，格式 '+format+'，文件名“'+view.title.replace(/[\\/:*?"<>|]/g,'_').slice(0,80)+'-'+audience+'.'+format+'”。使用已授权保存位置，等待我的文件审批；不要改题或重新抄题。'});onPrepared?.();}
  }catch(e){if(stamp===owner.current)setError(e instanceof Error?e.message:'导出准备未完成，请重试。');}finally{lock.current=false;if(stamp===owner.current)setBusy(false);}
 }
 if(view.state!=='confirmed'||view.exportCurrent!==true||!view.sourceCurrent)return null;
 return <section className="work-panel" data-testid="paper-export-entry"><h2>交付试卷</h2><p>选择学生卷或教师答案卷，核对文件内容后保存。完整图文题保留已确认原图；无法完整交付时会提示。</p><p role="status" data-testid="paper-output-label">{label?'保存到：'+label:'首次导出请选择保存文件夹。'}</p><Button variant="secondary" data-testid="paper-output-choose" isDisabled={disabled||busy} isPending={busy} onPress={()=>void prepare()}>{label?'更换保存文件夹':'选择保存文件夹'}</Button><div>{(['student','teacher'] as const).flatMap(audience=>(['docx','pdf'] as const).map(format=><Button key={audience+format} variant="secondary" data-testid={'paper-export-'+audience+'-'+format} isDisabled={disabled||busy} onPress={()=>void prepare(audience,format)}>{audience==='student'?'学生卷':'教师答案卷'} · {format==='docx'?'Word':'PDF'}</Button>))}</div>{error&&<p role="alert" data-testid="paper-output-error">{error}</p>}</section>;
}
