import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import type {OrdinaryHistory,OrdinaryReceipt,OrdinaryTarget,OrdinaryUndo} from '../../../shared/xiaozhi-ordinary-config';
import {THINKING_LABELS,validThinkingChoice} from '../../../shared/xiaozhi-thinking';
import {XIAOZHI_SETTINGS_ERRORS} from '../../../shared/xiaozhi-settings';
import styles from '../../ui-system/student-settings/student-settings-layout.module.css';

const names={
  default_model:'默认模型',
  global_thinking:'默认思考强度',
  session_thinking:'当前会话思考强度',
};

export function PiConfigHistory({field,sessionId,open,version,disabled=false,onUndone}:OrdinaryTarget&{
  open:boolean;version?:number;disabled?:boolean;onUndone?:(receipt:OrdinaryReceipt)=>void;
}){
  const [page,setPage]=useState<OrdinaryHistory>();
  const [cursors,setCursors]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState('');
  const stamp=useRef(0);
  const submitting=useRef(false);
  const pending=useRef<OrdinaryUndo|undefined>(undefined);
  const target={field,sessionId};
  const label=(value:string|null)=>value===null?(field==='default_model'?'跟随当前来源':'跟随全局默认')
    :field!=='default_model'&&validThinkingChoice(value)?THINKING_LABELS[value]:value;

  async function load(next:string[]){
    const request=++stamp.current;
    setBusy(true);
    try{
      const result=await window.omniEdu?.getXiaozhiConfigHistory({...target,cursor:next.at(-1)});
      if(stamp.current!==request)return;
      if(result?.ok){setPage(result.value);setCursors(next);}
      else setFeedback(result?XIAOZHI_SETTINGS_ERRORS[result.error]:'无法读取修改记录，请重试。');
    }catch{
      if(stamp.current===request)setFeedback('无法读取修改记录，请重试。');
    }finally{
      if(stamp.current===request)setBusy(false);
    }
  }
  useEffect(()=>{
    if(open)void load([]);
    return ()=>{stamp.current++;};
  },[field,sessionId,open,version]);

  async function undo(){
    if(busy||disabled||submitting.current||!page?.undo)return;
    const head=page.undo;
    const operation=pending.current?.changeId===head.changeId?pending.current:{
      ...target,operationId:crypto.randomUUID(),changeId:head.changeId,changeVersion:head.version,
    };
    pending.current=operation;
    submitting.current=true;
    setBusy(true);setFeedback('');
    const request=++stamp.current;
    try{
      const result=await window.omniEdu?.undoXiaozhiConfig(operation);
      if(stamp.current!==request)return;
      if(result?.ok){
        pending.current=undefined;
        setFeedback('已撤回。更改从下一次适用运行生效。');
        await load([]);
        onUndone?.(result.value);
      }else{
        setFeedback(result?XIAOZHI_SETTINGS_ERRORS[result.error]:'未收到撤回回执，可以重试同一次操作。');
        if(result?.error==='stale_change')await load([]);
      }
    }catch{
      if(stamp.current===request)setFeedback('未收到撤回回执，可以重试同一次操作。');
    }finally{
      submitting.current=false;
      if(stamp.current===request)setBusy(false);
    }
  }

  if(!open)return null;
  return <section aria-label={`${names[field]}修改记录`} className={styles.configHistory} data-testid={`pi-config-history-${field}`}>
    <h4>{names[field]}</h4>
    {page&&<p>当前已保存：{label(page.value)}</p>}
    {busy&&<p role="status">正在读取或更新记录…</p>}
    {feedback&&<p role="status" data-testid={`pi-config-feedback-${field}`}>{feedback}</p>}
    {page?.items.length===0&&<p data-testid={`pi-config-empty-${field}`}>暂无修改记录。</p>}
    {!!page?.items.length&&<ol>
      {page.items.map(item=><li key={item.changeId}>
        <span>{item.kind==='undo'?'撤回':'保存'} · {label(item.previous)} → {label(item.value)}{item.undone?'（已撤回）':''}</span>
        <time dateTime={item.savedAt}>{new Date(item.savedAt).toLocaleString()}</time>
      </li>)}
    </ol>}
    <div className={styles.configActions}>
      <Button type="button" variant="ghost" size="sm" data-testid={`pi-config-refresh-${field}`} isDisabled={busy} onPress={()=>{setFeedback('');void load([]);}}>刷新记录</Button>
      {cursors.length>0&&<Button type="button" size="sm" variant="ghost" isDisabled={busy} onPress={()=>void load(cursors.slice(0,-1))}>较新一页</Button>}
      {page?.cursor&&<Button type="button" size="sm" variant="ghost" isDisabled={busy} onPress={()=>void load([...cursors,page.cursor!])}>较早一页</Button>}
      <Button type="button" size="sm" variant="secondary" data-testid={`pi-config-undo-${field}`}
        aria-disabled={busy||disabled||!page?.undo} onPress={()=>void undo()}>撤回最近一次修改</Button>
    </div>
  </section>;
}
