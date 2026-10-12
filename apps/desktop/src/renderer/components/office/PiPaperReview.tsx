import {useState} from 'react';
import {Button,Modal} from '@heroui/react';
import {ClipboardCheck} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {PAPER_SCHEMA,PAPER_ERRORS,type PaperSummary,type PaperView} from '../../../shared/paper-blueprint';
import {PaperReviewPanel} from '../PaperReviewPanel';
import {PaperExportEntry} from '../PaperExportEntry';
import '../paper-workspace.css';
export function PiPaperReview({sessionId,review,onRefresh,running=false}:{sessionId:string;review:PaperSummary;running?:boolean;onRefresh:()=>Promise<void>}){
 const [view,setView]=useState<PaperView>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function open(){if(busy)return;setBusy(true);setError('');try{const r=await window.omniEdu?.reviewPaper({schemaVersion:PAPER_SCHEMA,sessionId,id:review.id});if(r?.ok)setView(r.value);else setError(r?PAPER_ERRORS[r.error]:'无法读取试卷，请重试。');}catch{setError('无法读取试卷，请重试。');}finally{setBusy(false);}}
 return <ChatTool className="pi-learning-review" data-testid="pi-paper-review" data-state={review.state} defaultExpanded={review.state==='pending'} state={review.state==='pending'?'requires-action':review.state==='confirmed'?'output-available':'output-error'}><ChatTool.Trigger><ClipboardCheck size={16}/><span>核对试卷</span><span>{{pending:'需要你核对',confirmed:'已确认保存',rejected:'已拒绝'}[review.state]}</span></ChatTool.Trigger><ChatTool.Content><p>{review.title} · {review.count}题 · {review.totalPoints}分。{review.complete?'请在本机逐题预览并确认。':'题库不足，不能确认。'}参考答案未独立核验。</p><Button variant="secondary" data-testid="pi-paper-preview" isDisabled={busy} onPress={()=>void open()}>预览并核对试卷</Button>{error&&<p role="alert">{error}</p>}</ChatTool.Content>{view&&<Modal.Backdrop isOpen onOpenChange={open=>{if(!open)setView(undefined);}}><Modal.Container size="lg" scroll="inside"><Modal.Dialog className="pi-themed-surface" data-testid="pi-paper-dialog"><Modal.Header><Modal.Heading>试卷预览与核对</Modal.Heading></Modal.Header><Modal.Body><PaperReviewPanel view={view} onChanged={next=>{setView(next);void onRefresh();}}/><PaperExportEntry view={view} disabled={busy||running} onPrepared={()=>setView(undefined)}/></Modal.Body><Modal.Footer><Button variant="secondary" onPress={()=>setView(undefined)}>关闭</Button></Modal.Footer></Modal.Dialog></Modal.Container></Modal.Backdrop>}</ChatTool>;
}
