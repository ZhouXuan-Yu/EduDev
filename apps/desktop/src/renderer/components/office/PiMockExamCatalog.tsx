import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import {LibraryBig} from 'lucide-react';
import {DisclosureCard} from '../ui/DisclosureCard';
import {useDesktopNavigation, useDesktopNavigationGuard} from '../desktop/DesktopFrame';
import {PiMockExamArchive} from './PiMockExamArchive';
import {PiMockExamVersions} from './PiMockExamVersions';
import {PiMockExamAnswerReview} from './PiMockExamAnswerReview';
import {PiMockExamSelectionFeedback,mockExamFieldLabels as labels,type MockExamFocus} from './PiMockExamSelectionFeedback';
import {MOCK_EXAM_SCHEMA,MOCK_EXAM_GRADES,MOCK_EXAM_ROUNDS,MOCK_EXAM_SUBJECTS,SHANGHAI_DISTRICTS,mockExamAnswerPermission,mockExamCoverLabel,mockExamMetadataMatchesScope,mockExamPageEvidenceLabel,
  type MockExamCatalog,type MockExamCatalogChange,type MockExamCatalogSummary,type MockExamEntry,type MockExamMetadata} from '../../../shared/mock-exam-compilation';
import {mockExamFields as fields,mockExamPosition,mockExamSelectionIssue} from '../../../shared/mock-exam-selection';
import styles from '../../ui-system/mock-exam-catalog.module.css';

const values={district:SHANGHAI_DISTRICTS,grade:MOCK_EXAM_GRADES,subject:MOCK_EXAM_SUBJECTS,round:MOCK_EXAM_ROUNDS};
const permissions={unknown:'许可待核对',local_only:'老师确认本地使用',excluded:'不允许使用'};
const answers={missing:'缺答案',linked:'已关联独立答案册',stale:'答案册关联已过期',embedded:'已发现同册答案区'};
const structure={unavailable:'正文待解析',partial:'页面部分就绪',parsed:'正文已解析'};
const draftOf=(catalog:MockExamCatalog)=>catalog.entries.map(({resourceId,include,permission,metadata,answerPermission})=>({
  resourceId,include,permission,metadata:{...metadata},...(answerPermission?{answerPermission}:{}),
}));

function ExamFields({entry,change,update}:{entry:MockExamEntry;change:MockExamCatalogChange;update:(next:MockExamCatalogChange)=>void}){
  function field(key:keyof MockExamMetadata,value:string){
    update({...change,metadata:{...change.metadata,[key]:value?(key==='year'?Number(value):value):null}});
  }
  return <div className={styles.fields} data-testid="mock-exam-fields">
    {fields.map(key=><label key={key}>{labels[key]}
      {key==='year'?<input type="number" min="1990" max="2100" value={change.metadata.year??''}
        data-testid="mock-exam-field-year" onChange={event=>field(key,event.currentTarget.value)}/>
        :<select value={change.metadata[key]??''} data-testid={'mock-exam-field-'+key} onChange={event=>field(key,event.currentTarget.value)}>
          <option value="">待核对</option>{values[key].map(value=><option key={value}>{value}</option>)}
        </select>}
      <small>{entry.conflicts.includes(key)?key==='year'&&entry.cover?'请参考封面日期和文件名，确认当前汇编年份':'原文件名与正文给出了多个值':entry.inferred[key]||'没有可用的原件标记'}</small>
    </label>)}
    <label>使用许可
      <select value={change.permission} data-testid="mock-exam-permission" onChange={event=>{
        const permission=event.currentTarget.value as MockExamEntry['permission'];
        update({...change,permission,include:permission!=='excluded'&&change.include});
      }}>{Object.entries(permissions).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select>
    </label>
    {entry.answer.state==='linked'&&<label>答案册使用许可
      <select value={change.answerPermission?.permission??'unknown'} data-testid="mock-exam-answer-permission" onChange={event=>{
        const {resourceId,version,pairRevision}=entry.answer;
        if(!resourceId||!version||!pairRevision)return;
        update({...change,answerPermission:{resourceId,version,pairRevision,permission:event.currentTarget.value as MockExamEntry['permission']}});
      }}>{Object.entries(permissions).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select>
    </label>}
    <label className={styles.check}>收录到目录
      <input type="checkbox" checked={change.include} disabled={change.permission==='excluded'}
        data-testid="mock-exam-include" onChange={event=>update({...change,include:event.currentTarget.checked})}/>
    </label>
  </div>;
}

export function PiMockExamCatalog({summary,sessionId,disabled,onRefresh,initialCatalog,startOpen=false,showHistory=false,anchor=false,revealIntent}:{
  summary:MockExamCatalogSummary;sessionId:string;disabled:boolean;onRefresh:()=>Promise<void>;
  initialCatalog?:MockExamCatalog;startOpen?:boolean;showHistory?:boolean;anchor?:boolean;revealIntent?:number;
}){
  const navigation=useDesktopNavigation();
  const [open,setOpen]=useState(startOpen),[catalog,setCatalog]=useState(initialCatalog);
  const [edits,setEdits]=useState<MockExamCatalogChange[]>(()=>initialCatalog?draftOf(initialCatalog):[]),[active,setActive]=useState('');
  const [revising,setRevising]=useState(false),[reading,setReading]=useState(false),[saving,setSaving]=useState(false);
  const [issue,setIssue]=useState(''),[retry,setRetry]=useState(0);
  const [showSelectionIssue,setShowSelectionIssue]=useState(false),[focus,setFocus]=useState<MockExamFocus>();
  const fieldset=useRef<HTMLFieldSetElement>(null);
  const lock=useRef(false);
  const loaded=useRef(initialCatalog?[sessionId,summary.id,summary.revision,0].join('|'):'');
  const current=catalog?.summary??summary;
  const canEdit=current.state==='draft'||revising;
  const dirty=Boolean(catalog&&JSON.stringify(edits)!==JSON.stringify(draftOf(catalog)));
  useDesktopNavigationGuard(startOpen&&(dirty||saving),'先确认或放弃当前目录修改，再离开。');
  const identity={schemaVersion:MOCK_EXAM_SCHEMA,sessionId,id:summary.id} as const;
  const domId=anchor?`catalog-${summary.id}`:undefined;

  useEffect(()=>{
    if(revealIntent===undefined||!domId)return;
    setOpen(true);
    const frame=requestAnimationFrame(()=>document.getElementById(domId)?.scrollIntoView({block:'nearest'}));
    return()=>cancelAnimationFrame(frame);
  },[domId,revealIntent]);
  useEffect(()=>{
    if(!focus)return;
    const control=['include','permission'].includes(focus.control)?focus.control:`field-${focus.control}`;
    const input=fieldset.current?.querySelector<HTMLElement>(`[data-testid="mock-exam-${control}"]`);
    input?.scrollIntoView({block:'nearest'});
    input?.focus({preventScroll:true});
  },[focus]);

  async function sync(next:MockExamCatalog){
    setCatalog(next);setEdits(draftOf(next));setRevising(false);setActive('');setShowSelectionIssue(false);
    await onRefresh();
  }
  useEffect(()=>{
    if(!open)return;
    const key=[sessionId,summary.id,summary.revision,retry].join('|');
    if(loaded.current===key)return;
    const api=window.omniEdu;
    if(!api){setIssue('暂时无法读取模考目录。');return;}
    let live=true;
    setReading(true);
    void api.reviewMockExamCatalog({schemaVersion:MOCK_EXAM_SCHEMA,sessionId,id:summary.id}).then(result=>{
      if(!live)return;
      if(result.ok){loaded.current=key;setCatalog(result.value);setEdits(draftOf(result.value));setIssue('');setShowSelectionIssue(false);}
      else setIssue(result.message);
    }).catch(()=>{if(live)setIssue('暂时无法读取模考目录。');}).finally(()=>{if(live)setReading(false);});
    return()=>{live=false;};
  },[summary.id,summary.revision,sessionId,open,retry]);
  const seen=new Set<string>(),duplicates=new Set<string>();
  for(const edit of edits){
    const key=edit.include&&mockExamPosition(edit.metadata);
    if(!key)continue;
    if(seen.has(key))duplicates.add(key);
    seen.add(key);
  }
  const selectionIssue=catalog&&mockExamSelectionIssue(edits,catalog.scope);

  async function reveal(resourceId:string){
    try{
      const result=await window.omniEdu?.revealMockExamOriginal({schemaVersion:MOCK_EXAM_SCHEMA,sessionId,id:summary.id,resourceId});
      if(!result?.ok)setIssue(result?.message||'原件暂时无法定位。');
    }catch{setIssue('原件暂时无法定位。');}
  }
  async function save(){
    if(!catalog||disabled||lock.current)return;
    setIssue('');
    setShowSelectionIssue(Boolean(selectionIssue));
    if(selectionIssue)return;
    lock.current=true;setSaving(true);
    try{
      const result=await window.omniEdu?.confirmMockExamCatalog({schemaVersion:MOCK_EXAM_SCHEMA,sessionId,id:summary.id,
        revision:catalog.summary.revision,digest:catalog.summary.digest,changes:edits});
      if(result?.ok)await sync(result.value);
      else setIssue(result?.message||'目录确认未提交。');
    }catch{setIssue('暂时无法核对保存状态，请重新读取。');}
    finally{lock.current=false;setSaving(false);}
  }

  return <DisclosureCard id={domId} isExpanded={open} onExpandedChange={setOpen} data-testid="pi-mock-exam-catalog" title={
    <span className={styles.heading}>
      <LibraryBig size={17} aria-hidden="true"/>
      <span>
        <strong>{current.title}</strong>
        <small>{current.count} 份 · 第 {current.revision} 版 · {current.state==='draft'?'待核对':'目录已确认'}</small>
      </span>
    </span>
  }>
    {open&&<div data-testid="mock-exam-review" data-state={current.state} className={styles.review}>
      {reading&&<p role="status">正在读取本地目录…</p>}
      {catalog&&<>
        <p>目录确认只归档来源和分类。题目内容、缺页及答案仍按原件核对。</p>
        {catalog.limited&&<p role="status">候选超过本批上限。可按地区、轮次或学科分开整理。</p>}
        {catalog.summary.state==='draft'&&(catalog.scope.districts||catalog.scope.rounds)&&catalog.entries.some(entry=>
          !mockExamMetadataMatchesScope(entry.metadata,catalog.scope))&&
          <p data-testid="mock-exam-scope-review">分类未明确的候选暂未收录。对照原件核对后可勾选。</p>}
        {catalog.unlinkedAnswers>0&&<p>{catalog.unlinkedAnswers} 份独立答案册还没有建立试卷配对。</p>}
        {duplicates.size>0&&canEdit&&!showSelectionIssue&&<p role="status">有同一区、同一年份、年级、学科及轮次的不同文件。请核对后只收录一份。</p>}
        <ul className={styles.entries} tabIndex={0} aria-label="模考试卷目录">
          {catalog.entries.map((entry,index)=>{
            const edit=edits[index];
            if(!edit)return null;
            const key=mockExamPosition(edit.metadata);
            const cover=entry.cover&&mockExamCoverLabel(entry.cover);
            return <li key={entry.resourceId} className={styles.entry} data-testid="mock-exam-row" data-resource-id={entry.resourceId}>
              <strong>{entry.title}</strong>
              <span>{fields.map(field=>edit.metadata[field]??'待核对').join(' · ')}</span>
              {cover&&<span data-testid="mock-exam-cover-evidence">{cover}</span>}
              <span>{structure[entry.structure.state]}
                {entry.structure.pages?(' '+entry.structure.processed+'/'+entry.structure.pages+' 页'):''}
                {entry.structure.held?(' · '+entry.structure.held+' 处待核'):''} · {answers[entry.answer.state]} · {permissions[edit.permission]}</span>
              {entry.structure.pageEvidence&&<span data-testid="mock-exam-page-evidence">{mockExamPageEvidenceLabel(entry.structure.pageEvidence)}</span>}
              {entry.copies>1&&<span>{entry.copies} 份同内容文件已合为一条</span>}
              {entry.answer.title&&<span>答案册　{entry.answer.title} · {permissions[mockExamAnswerPermission(entry,edit.answerPermission)?.permission??'unknown']}</span>}
              {entry.answer.state==='linked'&&edit.permission!=='excluded'&&edit.answerPermission?.permission!=='excluded'&&
                <PiMockExamAnswerReview key={current.digest+':'+entry.resourceId}
                  input={{...identity,resourceId:entry.resourceId,revision:current.revision,digest:current.digest}}/>}
              {!edit.include&&<span>未收录</span>}
              {edit.include&&!mockExamMetadataMatchesScope(edit.metadata,catalog.scope,true)&&
                <span data-testid="mock-exam-outside-scope">超出目录范围。请修正分类或取消收录。</span>}
              {edit.include&&key&&duplicates.has(key)&&<span>有另一份同轮次文件</span>}
              {entry.conflicts.length>0&&<span>待核对字段　{entry.conflicts.map(field=>labels[field]).join('、')}</span>}
              <div className={styles.actions}>
                <Button size="sm" variant="ghost" onPress={()=>void reveal(entry.resourceId)} data-testid="mock-exam-original">定位原件</Button>
                {entry.answer.resourceId&&<Button size="sm" variant="ghost" onPress={()=>void reveal(entry.answer.resourceId!)}>定位答案册</Button>}
                {canEdit&&<Button size="sm" variant="secondary" isDisabled={saving||disabled} data-testid="mock-exam-row-edit"
                  onPress={()=>setActive(value=>value===entry.resourceId?'':entry.resourceId)}>{active===entry.resourceId?'收起核对':'核对条目'}</Button>}
              </div>
              {canEdit&&active===entry.resourceId&&<fieldset ref={fieldset} disabled={saving||disabled} className={styles.fieldset}>
                <legend>原件分类与许可</legend>
                <ExamFields entry={entry} change={edit} update={next=>setEdits(old=>old.map((item,i)=>i===index?next:item))}/>
              </fieldset>}
            </li>;
          })}
        </ul>
        {canEdit&&showSelectionIssue&&selectionIssue&&<PiMockExamSelectionFeedback issue={selectionIssue} entries={catalog.entries}
          edits={edits} active={active} onLocate={target=>{setActive(target.resourceId);setFocus(target);}}/>}
        <div className={styles.actions}>
          {anchor&&<Button variant="ghost" size="sm" isDisabled={saving} data-testid="mock-exam-open-workbench" onPress={()=>navigation.navigate({view:'artifacts',mockExam:{id:summary.id,sessionId}})}>在教学工作台打开</Button>}
          {canEdit&&dirty&&<Button variant="ghost" size="sm" isDisabled={saving} onPress={()=>{setEdits(draftOf(catalog));setActive('');setIssue('');setShowSelectionIssue(false);}}>放弃本次修改</Button>}
          {canEdit?<Button variant="primary" size="sm" isDisabled={disabled||saving||reading} data-testid="mock-exam-confirm"
            onPress={()=>void save()}>{saving?'正在复核原件…':'确认目录'}</Button>:
            <Button variant="secondary" size="sm" isDisabled={disabled||reading} data-testid="mock-exam-revise" onPress={()=>setRevising(true)}>修订目录</Button>}
        </div>
        {!canEdit&&!reading&&<PiMockExamArchive key={current.id+':'+current.revision} catalog={current} sessionId={sessionId}/>}
        {catalog.restoredFrom&&<p role="status">当前内容恢复自第 {catalog.restoredFrom} 版。</p>}
        {showHistory&&<PiMockExamVersions identity={identity} current={current} blocked={disabled||dirty||saving||reading} onRestore={sync}/>}
      </>}
      {issue&&<p role="alert" data-testid="mock-exam-error">{issue} <Button size="sm" variant="ghost" isDisabled={saving}
        onPress={()=>setRetry(value=>value+1)}>重新读取</Button></p>}
    </div>}
  </DisclosureCard>;
}
