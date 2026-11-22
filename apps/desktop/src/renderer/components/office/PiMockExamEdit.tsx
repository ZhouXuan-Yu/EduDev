import {useEffect,useState} from 'react';
import {Button} from '@heroui/react';
import {FilePenLine} from 'lucide-react';
import {MOCK_EXAM_EDIT_SCHEMA,type MockExamEditDecision,type MockExamEditReview,type MockExamEditSummary} from '../../../shared/mock-exam-edit';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {useOfficeControlState} from './OfficeComposerState';
import {DisclosureCard} from '../ui/DisclosureCard';
import styles from '../../ui-system/mock-exam-catalog.module.css';

const stateLabels={pending:'待老师核对',applied:'已应用为待核对版',rejected:'已拒绝',conflict:'目录或原件已变化',interrupted:'修订审阅已中断'};
const fields={district:'区',year:'年份',grade:'年级',subject:'学科',round:'轮次',include:'收录'};
const display=(value:string|number|boolean|null)=>value===null?'待核对':value===true?'收录':value===false?'不收录':String(value);

export function PiMockExamEdit({summary,sessionId,enabled,onRefresh}:{summary:MockExamEditSummary;sessionId:string;
  enabled:boolean;onRefresh:()=>Promise<void>}){
  const navigation=useDesktopNavigation(),{draft,update,lock}=useOfficeControlState('mock-exam-edit:'+summary.id);
  const [open,setOpen]=useState(summary.state==='pending'),[review,setReview]=useState<MockExamEditReview>();
  const [reading,setReading]=useState(false),[refresh,setRefresh]=useState(0);
  const pending=summary.state==='pending';
  const ready=review?.summary.fingerprint===summary.fingerprint&&review.summary.state===summary.state;
  const identity={schemaVersion:MOCK_EXAM_EDIT_SCHEMA,id:summary.id,sessionId} as const;

  useEffect(()=>{
    if(!open)return;
    let live=true;
    setReading(true);
    void (async()=>{
      try{
        const result=await window.omniEdu?.reviewMockExamEdit(identity);
        if(!live)return;
        if(result?.ok&&result.value.summary.fingerprint===summary.fingerprint)setReview(result.value);
        else update({error:result&&!result.ok?result.message:'无法读取目录差异。'});
      }catch{if(live)update({error:'无法读取目录差异。'});}
      finally{if(live)setReading(false);}
    })();
    return()=>{live=false;};
  },[open,sessionId,summary.id,summary.state,summary.fingerprint,refresh]);

  async function decide(action:MockExamEditDecision['action']){
    if(!pending||!enabled||lock.current||action==='approve'&&(!ready||reading))return;
    lock.current=true;update({busy:true,error:''});
    try{
      const result=await window.omniEdu?.decideMockExamEdit({...identity,action,fingerprint:summary.fingerprint});
      if(!result?.ok)update({error:result?.message||'本次决定未提交。'});
      await onRefresh();
    }catch{update({error:'暂时无法核对决定，请重新读取。'});}
    finally{lock.current=false;update({busy:false});}
  }
  return <DisclosureCard data-testid="pi-mock-exam-edit" isExpanded={open} onExpandedChange={setOpen}
    title={<span className={styles.heading}><FilePenLine size={16} aria-hidden="true"/><span><strong>修订 {summary.title}</strong>
      <small>第 {summary.revision} 版 · {summary.count} 份试卷 · {stateLabels[summary.state]}</small></span></span>}>
    {open&&<div className={styles.review} data-testid="mock-exam-edit-review" data-state={summary.state}>
      {reading&&<p role="status">正在读取目录差异…</p>}
      {ready&&<ul className={styles.entries} aria-label="修改前后对照">{review.diffs.map(diff=><li key={diff.resourceId} className={styles.entry}>
        <strong>{diff.title}</strong>
        <ul className={styles.diffList}>{diff.fields.map(field=><li key={field.name}><strong>{fields[field.name]}</strong>
          <span>修改前 {display(field.before)}</span><span>修改后 {display(field.after)}</span></li>)}</ul>
      </li>)}</ul>}
      {pending&&<p>应用后会保存为待核对的新版本。使用许可沿用现有记录。</p>}
      {summary.state==='applied'&&<p role="status">已保存第 {summary.appliedRevision} 版。请在目录里确认。</p>}
      {summary.state==='conflict'&&<p role="status">本次建议未应用，请打开当前目录重新核对。</p>}
      {draft.error&&<p role="alert">{draft.error} <Button size="sm" variant="ghost" isDisabled={draft.busy} onPress={()=>{
        update({error:''});setRefresh(value=>value+1);void onRefresh();
      }}>重新读取</Button></p>}
      <div className={styles.actions}>
        {pending?<>
          <Button size="sm" variant="ghost" data-testid="mock-exam-edit-reject" isDisabled={!enabled||draft.busy} onPress={()=>void decide('reject')}>拒绝</Button>
          <Button size="sm" variant="primary" data-testid="mock-exam-edit-approve" isDisabled={!enabled||draft.busy||reading||!ready}
            onPress={()=>void decide('approve')}>{draft.busy?'正在提交决定…':'应用修改'}</Button>
        </>:<Button size="sm" variant="secondary" data-testid="mock-exam-edit-open" onPress={()=>navigation.navigate({view:'artifacts',mockExam:{id:summary.catalogId,sessionId}})}>打开当前目录</Button>}
      </div>
    </div>}
  </DisclosureCard>;
}
