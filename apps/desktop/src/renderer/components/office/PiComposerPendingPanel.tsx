import {useId,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {ChevronDown,ChevronUp} from 'lucide-react';
import type {XiaozhiWorkspaceSnapshot} from '../../../shared/xiaozhi-agent';
import {PiTeacherQuestionCard} from './PiControlCards';
import {PiDeliveryBundleCard} from './PiDeliveryBundleCard';
import {PiOfficeArtifactCard} from './PiOfficeArtifactCard';
import {PiTextChangeCard} from './PiTextChangeCard';
import styles from '../../ui-system/composer-pending.module.css';

export function pendingComposerItems(snapshot:XiaozhiWorkspaceSnapshot|undefined,sessionId:string,runId:string|undefined) {
  if(!snapshot?.running||snapshot.projection.threadId!==sessionId||!runId)return [];
  const owned=(snapshot.deliveries||[]).filter(item=>item.runId===runId);
  const bundled=new Set(owned.flatMap(item=>item.files.filter(file=>!file.carried).map(file=>file.draftId)));
  return [
    ...(snapshot.controls||[]).filter(item=>item.runId===runId&&item.kind==='question'&&item.state==='pending')
      .map(item=>({kind:'question' as const,id:item.id,label:'选择回答',item})),
    ...(snapshot.changes||[]).filter(item=>item.runId===runId&&item.state==='pending'&&!bundled.has(item.id))
      .map(item=>({kind:'change' as const,id:item.id,label:item.path,item})),
    ...(snapshot.officeArtifacts||[]).filter(item=>item.runId===runId&&item.state==='pending'&&!bundled.has(item.id))
      .map(item=>({kind:'office' as const,id:item.id,label:item.path,item})),
    ...owned.filter(item=>item.state==='pending')
      .map(item=>({kind:'bundle' as const,id:item.id,label:`确认 ${item.files.length} 份文件`,item})),
  ];
}

export function PiComposerPendingPanel({items,sessionId,onAnswer,onRefresh,onOpen}:{
  items:ReturnType<typeof pendingComposerItems>;
  sessionId:string;
  onAnswer:(id:string,answer:string)=>Promise<void>;
  onRefresh:()=>Promise<void>;
  onOpen:(path:string)=>void;
}) {
  const [selected,setSelected]=useState(''),[collapsedFor,setCollapsedFor]=useState('');
  const bodyId=useId(),headingId=useId(),toggle=useRef<HTMLButtonElement>(null);
  const active=items.find(item=>item.id===selected)||items[0];
  if(!active)return null;
  const collapsed=collapsedFor===active.id;
  const shared={sessionId,onRefresh,onOpen,running:true};
  return <section aria-labelledby={headingId} className={styles.anchor} data-testid="pi-composer-pending-panel"
    onKeyDown={event=>{
      if(event.key==='Escape'&&!event.defaultPrevented&&!collapsed){
        event.preventDefault();setCollapsedFor(active.id);toggle.current?.focus();
      }
    }}>
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 id={headingId} aria-live="polite">{active.kind==='question'?'小智需要你的选择':'确认保存文件'}</h2>
        {items.length>1&&<select aria-label="选择待处理事项" className={styles.select} value={active.id}
          onChange={event=>{setSelected(event.target.value);setCollapsedFor('');}}>
          {items.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
        </select>}
        <Button ref={toggle} size="sm" variant="ghost" aria-controls={bodyId} aria-expanded={!collapsed}
          data-testid="pi-composer-pending-toggle" onPress={()=>setCollapsedFor(collapsed?'':active.id)}>
          {collapsed?<ChevronUp size={14} aria-hidden="true"/>:<ChevronDown size={14} aria-hidden="true"/>}
          {collapsed?'展开':'收起'}
        </Button>
      </header>
      <div id={bodyId} hidden={collapsed} className={active.kind==='question'?`${styles.body} ${styles.question}`:styles.body}>
        {active.kind==='question'?<PiTeacherQuestionCard key={active.id} item={active.item} onAnswer={onAnswer} inComposer/>
          :active.kind==='change'?<PiTextChangeCard key={active.id} {...shared} change={active.item} composerReview/>
          :active.kind==='office'?<PiOfficeArtifactCard key={active.id} {...shared} artifact={active.item}/>
          :<PiDeliveryBundleCard key={active.id} {...shared} delivery={active.item}/>}
      </div>
    </div>
  </section>;
}
