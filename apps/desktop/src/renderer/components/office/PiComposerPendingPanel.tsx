import {AppNativeSelect} from '../ui/AppNativeSelect';
import {useEffect,useId,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {ChevronDown,ChevronUp} from 'lucide-react';
import type {XiaozhiControl,XiaozhiDecisionInput,XiaozhiWorkspaceSnapshot} from '../../../shared/xiaozhi-agent';
import {PiTeacherQuestionCard} from './PiControlCards';
import {PiCopyApproval} from './PiCopyApproval';
import {PiDeliveryBundleCard} from './PiDeliveryBundleCard';
import {PiOfficeArtifactCard} from './PiOfficeArtifactCard';
import {PiPermissionApproval} from './PiPermissionApproval';
import {PiTextChangeCard} from './PiTextChangeCard';
import {PiHistoryLookup} from './PiHistoryLookup';
import type {XiaozhiMemoryScope} from '../../../shared/xiaozhi-memory';
import {permissionAction} from './permissionPresentation';
import {focusWorkspacePending,isRecoverableTeacherQuestion,type WorkspacePendingItem} from './workspace-notifications';
import styles from '../../ui-system/composer-pending.module.css';

function composerQuestion(item:XiaozhiControl) {
  const label=item.options?.length?'选择或填写回答':'填写回答';
  return {kind:'question' as const,id:item.id,label:item.state==='interrupted'?`继续 · ${label}`:label,item};
}

export function pendingComposerItems(snapshot:XiaozhiWorkspaceSnapshot|undefined,sessionId:string,runId:string|undefined) {
  if(!snapshot||snapshot.projection.threadId!==sessionId)return [];
  const questions=(snapshot.controls||[]).filter(item=>item.kind==='question');
  if(!snapshot.running){
    const runs=new Set(snapshot.projection.turns.map(turn=>turn.id));
    return questions.filter(item=>runs.has(item.runId)&&isRecoverableTeacherQuestion(snapshot,item)).map(composerQuestion);
  }
  if(!runId)return [];
  const owned=(snapshot.deliveries||[]).filter(item=>item.runId===runId);
  const bundled=new Set(owned.flatMap(item=>item.files.filter(file=>!file.carried).map(file=>file.draftId)));
  return [
    ...questions.filter(item=>item.runId===runId&&item.state==='pending').map(composerQuestion),
    ...(snapshot.approvals||[]).filter(item=>item.runId===runId&&(item.permission?.state??item.state)==='pending')
      .map(item=>({kind:'approval' as const,id:item.id,label:item.permission?`授权 · ${permissionAction(item.permission.request.action)}`:'确认复制文件',item})),
    ...(snapshot.changes||[]).filter(item=>item.runId===runId&&item.state==='pending'&&!bundled.has(item.id))
      .map(item=>({kind:'change' as const,id:item.id,label:`保存 · ${item.path}`,item})),
    ...(snapshot.officeArtifacts||[]).filter(item=>item.runId===runId&&item.state==='pending'&&!bundled.has(item.id))
      .map(item=>({kind:'office' as const,id:item.id,label:`保存 · ${item.path}`,item})),
    ...owned.filter(item=>item.state==='pending')
      .map(item=>({kind:'bundle' as const,id:item.id,label:`确认 ${item.files.length} 份文件`,item})),
  ];
}

export function PiComposerPendingPanel({items,sessionId,reveal,onAnswer,onDecision,onRefresh,onOpen,history}:{
  items:ReturnType<typeof pendingComposerItems>;
  sessionId:string;
  reveal?:WorkspacePendingItem;
  onAnswer:(id:string,answer:string)=>Promise<void>;
  onDecision:(id:string,decision:XiaozhiDecisionInput['decision'])=>Promise<void>;
  onRefresh:()=>Promise<void>;
  onOpen:(path:string)=>void;
  history?:{scope:XiaozhiMemoryScope;query:string;close:()=>void;confirmed:()=>Promise<void>};
}) {
  const [selected,setSelected]=useState(''),[collapsedFor,setCollapsedFor]=useState('');
  const bodyId=useId(),headingId=useId(),toggle=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null);
  const handledReveal=useRef<WorkspacePendingItem>(undefined);
  const allItems=history?[...items,{kind:'history' as const,id:'history-lookup',label:'查找历史',item:history}]:items;
  const active=allItems.find(item=>item.id===selected)||allItems[0];
  const collapsed=Boolean(active&&collapsedFor===active.id);
  useEffect(()=>{
    if(!reveal)return;
    setSelected(reveal.id);
    setCollapsedFor('');
  },[reveal]);
  useEffect(()=>{
    if(!reveal||active?.id!==reveal.id||collapsed||handledReveal.current===reveal||!panel.current)return;
    if(focusWorkspacePending(panel.current,reveal))handledReveal.current=reveal;
  },[reveal,active?.id,collapsed]);
  if(!active)return null;
  const shared={sessionId,onRefresh,onOpen,running:true};
  const title=active.kind==='question'?(active.item.state==='interrupted'?'继续回答小智的问题':active.item.options?.length?'小智需要你的选择':'小智需要你补充信息')
    :active.kind==='approval'?(active.item.permission?'确认操作授权':'确认复制文件'):active.kind==='history'?'查找可参考的历史':'确认保存文件';
  return <section ref={panel} aria-labelledby={headingId} className={styles.anchor} data-testid="pi-composer-pending-panel"
    onKeyDown={event=>{
      if(event.key==='Escape'&&!event.defaultPrevented&&!event.nativeEvent.isComposing&&event.nativeEvent.keyCode!==229&&!collapsed){
        event.preventDefault();setCollapsedFor(active.id);toggle.current?.focus();
      }
    }}>
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 id={headingId} aria-live="polite">{title}</h2>
        {allItems.length>1&&<><span className={styles.count}>{allItems.length} 项待处理</span><AppNativeSelect indicatorOnly aria-label="选择待处理事项" className={styles.select} value={active.id}
          onChange={event=>{setSelected(event.target.value);setCollapsedFor('');}}>
          {allItems.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
        </AppNativeSelect></>}
        <Button ref={toggle} size="sm" variant="ghost" aria-controls={bodyId} aria-expanded={!collapsed}
          data-testid="pi-composer-pending-toggle" onPress={()=>setCollapsedFor(collapsed?'':active.id)}>
          {collapsed?<ChevronUp size={14} aria-hidden="true"/>:<ChevronDown size={14} aria-hidden="true"/>}
          {collapsed?'展开':'收起'}
        </Button>
      </header>
      <div id={bodyId} hidden={collapsed} className={active.kind==='question'?`${styles.body} ${styles.question}`:styles.body}>
        {active.kind==='question'?<PiTeacherQuestionCard key={active.id} item={active.item} onAnswer={onAnswer} inComposer/>
          :active.kind==='approval'?(active.item.permission?<PiPermissionApproval key={active.id} approval={active.item.permission} onRefresh={onRefresh}/>
            :<PiCopyApproval key={active.id} approval={active.item} onDecision={onDecision}/>)
          :active.kind==='change'?<PiTextChangeCard key={active.id} {...shared} change={active.item} composerReview/>
          :active.kind==='office'?<PiOfficeArtifactCard key={active.id} {...shared} artifact={active.item}/>
          :active.kind==='history'?<PiHistoryLookup key={active.id} sessionId={sessionId} scope={active.item.scope}
            query={active.item.query} onClose={active.item.close} onConfirmed={active.item.confirmed}/>
          :<PiDeliveryBundleCard key={active.id} {...shared} delivery={active.item}/>}
      </div>
    </div>
  </section>;
}
