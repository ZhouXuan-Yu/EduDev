import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {PAPER_SCHEMA,type PaperView} from '../../shared/paper-blueprint';
import {readComposerDraft} from './office/composer-drafts';
import {PAPER_OUTPUT_SCHEMA,PAPER_EXPORT_INTENT_SCHEMA,type PaperExportIntent,type PaperExportInput} from '../../shared/paper-export';
import {XIAOZHI_ERRORS} from '../../shared/xiaozhi-projection';
import {PaperExportChoices} from './paper-ui/PaperExportChoices';
import {useDesktopNavigation} from './desktop/DesktopFrame';

/** Native output-only grant; input workspace and Office approval stay unchanged. */
export function PaperExportEntry({view,disabled=false,onPrepared}:{view:PaperView;disabled?:boolean;onPrepared?:()=>void}){
 const latestView=useRef(view);latestView.current=view;
 const navigation=useDesktopNavigation(),[label,setLabel]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),owner=useRef(0),lock=useRef(false);
 useEffect(()=>{const stamp=++owner.current;setLabel('');setError('');void window.omniEdu?.getXiaozhiSnapshot(view.sessionId).then(s=>{if(owner.current===stamp)setLabel(s.paperOutput?.label||s.workspace?.label||'');}).catch(()=>{if(owner.current===stamp)setError('保存位置读取未完成，请重新选择。');});return()=>{owner.current++;};},[view.sessionId,view.id,view.digest]);
 async function choose(current:()=>boolean){
  const result=await window.omniEdu?.selectPaperOutput({schemaVersion:PAPER_OUTPUT_SCHEMA,sessionId:view.sessionId});
  if(!current())return;
  if(!result?.ok)throw Error(result?XIAOZHI_ERRORS[result.error]:'目录选择未完成，请重试。');
  const snapshot=await window.omniEdu?.getXiaozhiSnapshot(view.sessionId);if(!current())return;return snapshot?.paperOutput?.label||snapshot?.workspace?.label||'';
 }
 async function prepare(audience?:PaperExportInput['audience'],format?:PaperExportInput['format'],template?:PaperExportInput['template']){
  if(lock.current||disabled)return;lock.current=true;const stamp=owner.current,origin=navigation.target,intent=navigation.intent;setBusy(true);setError('');
  const current=()=>stamp===owner.current&&navigation.isCurrent(intent)&&latestView.current.id===view.id
   &&latestView.current.sessionId===view.sessionId&&latestView.current.digest===view.digest
   &&latestView.current.state==='confirmed'&&latestView.current.exportCurrent===true&&latestView.current.sourceCurrent;
  try{
   const destination=audience&&label?label:await choose(current);if(!current())return;setLabel(destination||'');
   if(!destination){setError('未选择保存文件夹，尚未发起导出。');return;}
   if(audience&&format){
    const read=await window.omniEdu?.reviewPaper({schemaVersion:PAPER_SCHEMA,sessionId:view.sessionId,id:view.id});
    if(!current())return;
    if(!read?.ok||read.value.id!==view.id||read.value.sessionId!==view.sessionId||read.value.digest!==view.digest
      ||read.value.state!=='confirmed'||read.value.exportCurrent!==true||!read.value.sourceCurrent)throw Error('这份确认卷已失效，请重新打开并核对；尚未准备导出请求。');
    const saved=readComposerDraft(view.sessionId);
    if(saved.text||saved.skill||saved.paperExportIntent||saved.paperExportInvalid||saved.pendingPaperExport)
      throw Error('此会话已有未发送草稿或导出请求，请先处理；原输入未被覆盖。');
    const binding:PaperExportIntent={schemaVersion:PAPER_EXPORT_INTENT_SCHEMA,paperId:view.id,digest:view.digest!,audience,format,template:template??'paper'};
    const target=template==='answer_sheet'?'答题卡（仅学生卷，不得包含参考答案或解析）':audience==='student'?'学生卷':'教师答案卷';
    const suffix=template==='answer_sheet'?'answer_sheet':audience;
    const draft='请使用 education_export_paper 将我选择的这份确认试卷导出为'+target+'，格式 '+format+'，文件名“'+view.title.replace(/[\\/:*?"<>|]/g,'_').slice(0,80)+'-'+suffix+'.'+format+'”。使用已授权保存位置，等待我的文件审批；不要换卷、改题或重新抄题。';
    if(!navigation.navigate({view:'ai',sessionId:view.sessionId,draft,paperExportIntent:binding},{ifCurrent:origin,ifIntent:intent}))
      throw Error('导航或草稿状态已变化，请先处理；尚未载入导出请求。');
    onPrepared?.();
   }
  }catch(e){if(current())setError(e instanceof Error?e.message:'导出准备未完成，请重试。');}finally{lock.current=false;setBusy(false);}
 }
 if(view.state!=='confirmed'||view.exportCurrent!==true||!view.sourceCurrent)return null;
 return <section className="edu-paper-export" data-testid="paper-export-entry">
      <h2>交付试卷</h2>
      <p>选择学生卷、教师答案卷或答题卡，核对文件内容后保存。完整图文题保留已确认原图；答题卡不含答案或解析；无法完整交付时会提示。</p>
      <p data-testid="paper-print-template">A4 单栏 · 四边 20 毫米 · 角色页眉与页码。答题卡按题量留白：12 题以内每道解答题 4 行，13–30 题 2 行，更多题 1 行；图与排版公式以图片交付。</p>
      <p role="status" data-testid="paper-output-label">{label?'保存到：'+label:'首次导出请选择保存文件夹。'}</p>
      <Button variant="secondary" data-testid="paper-output-choose" isDisabled={disabled||busy} isPending={busy} onPress={()=>void prepare()}>{label?'更换保存文件夹':'选择保存文件夹'}</Button>
      <PaperExportChoices disabled={disabled||busy} onPrepare={(audience,format,template)=>void prepare(audience,format,template)}/>{error&&<p role="alert" data-testid="paper-output-error">{error}</p>}</section>;
}
