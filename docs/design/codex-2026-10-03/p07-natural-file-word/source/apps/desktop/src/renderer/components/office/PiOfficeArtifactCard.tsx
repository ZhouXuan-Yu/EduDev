import {useEffect,useRef,useState} from 'react';
import {Button,Input,Label,Tabs,TextArea,TextField} from '@heroui/react';
import {FileText} from 'lucide-react';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {Markdown} from '../../heroui-pro/components/markdown';
import {useOfficeControlState} from './OfficeComposerState';
import {OFFICE_ARTIFACT_SCHEMA,OFFICE_ARTIFACT_ERRORS,type OfficeArtifactDecision,type OfficeArtifactSummary,type OfficeArtifactReview,type OfficeArtifactState} from '../../../shared/xiaozhi-office-artifacts';
import {validOfficeDraft,type OfficeDraft} from '../../../shared/xiaozhi-office-draft';
import './pi-office-artifact.css';

const labels:Record<OfficeArtifactState,string>={pending:'需要你的确认',approved:'已确认，等待生成',generating:'正在生成',prepared:'已生成，等待保存',committing:'正在保存',saved:'已保存并核验',rejected:'已拒绝，未写入',interrupted:'已中断，未继续写入',uncertain:'保存中断，需要核验',conflict:'内容或文件已变化，未覆盖',failed:'生成或保存未完成'};
const escaped=(v:string|number)=>String(v).replace(/[\\`*_{}\[\]()#+.!|<>-]/g,'\\$&');
const preview=(draft:OfficeDraft)=>['# '+escaped(draft.title),...draft.sections.flatMap(section=>['## '+escaped(section.heading),...section.paragraphs.map(escaped),...(section.table?[[
 '| '+section.table.columns.map(escaped).join(' | ')+' |','| '+section.table.columns.map(()=>'---').join(' | ')+' |',...section.table.rows.map(row=>'| '+row.map(cell=>escaped(cell).replace(/\r?\n/g,' ⏎ ')).join(' | ')+' |')].join('\n')]:[])])].join('\n\n');

/** Original Pro inline approval and HeroUI fields. Draft editing stays local, never JSON in a product flow. */
export function PiOfficeArtifactCard({artifact,sessionId,running,onRefresh,onOpen}:{artifact:OfficeArtifactSummary;sessionId:string;running:boolean;onRefresh:()=>Promise<void>;onOpen:(path:string)=>void}){
 const {draft,update,lock}=useOfficeControlState(`office-artifact:${artifact.id}`);
 const [review,setReview]=useState<OfficeArtifactReview>(),[reading,setReading]=useState(false),[expanded,setExpanded]=useState(artifact.state==='pending'),[tab,setTab]=useState('preview');
 const live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{
  if(!expanded)return;
  let current=true;setReading(true);setReview(undefined);
  void window.omniEdu?.reviewXiaozhiOffice({schemaVersion:OFFICE_ARTIFACT_SCHEMA,sessionId,draftId:artifact.id}).then(result=>{
   if(!current)return;
   if(result?.ok&&result.value.id===artifact.id&&result.value.revision===artifact.revision){
    setReview(result.value);update({error:'',...(draft.officeRevision!==result.value.revision?{officeDraft:structuredClone(result.value.draft),officeRevision:result.value.revision,editing:false}:{})});
   }else update({error:result&&!result.ok?OFFICE_ARTIFACT_ERRORS[result.error]:'拟内容已更新，请刷新后重试。'});
  }).catch(()=>{if(current)update({error:'无法读取本地拟内容，请重试。'});}).finally(()=>{if(current)setReading(false);});
  return()=>{current=false;};
 },[sessionId,artifact.id,artifact.revision,expanded]);
 const pending=artifact.state==='pending',content=draft.officeDraft??review?.draft;
 const editable=pending&&running&&!draft.busy&&!reading&&!!review;
 function edit(action:(value:OfficeDraft)=>void){if(!editable||!content)return;const next=structuredClone(content);action(next);update({officeDraft:next,officeRevision:artifact.revision,editing:true,error:''});}
 async function saveDraft(){
  if(!editable||!draft.editing||lock.current||!content)return;
  if(!validOfficeDraft(content)){update({error:'请填写有效标题、段落和表格；数字必须有效，内容不能超出支持长度。'});return;}
  lock.current=true;update({busy:true,error:''});
  try{
   const result=await window.omniEdu?.reviseXiaozhiOffice({schemaVersion:OFFICE_ARTIFACT_SCHEMA,sessionId,draftId:artifact.id,revision:artifact.revision,draft:content});
   if(!live.current)return;
   if(result?.ok){update({editing:false,officeRevision:result.value.revision});setTab('preview');}else update({error:result?OFFICE_ARTIFACT_ERRORS[result.error]:'拟内容没有保存，请重试。'});
   await onRefresh();
  }catch{if(live.current)update({error:'拟内容状态未能确认，请刷新后检查。'});}
  finally{lock.current=false;if(live.current)update({busy:false});}
 }
 async function decide(action:OfficeArtifactDecision['action']){
  if(lock.current||(action==='approve'&&(!editable||draft.editing)))return;
  lock.current=true;update({busy:true,error:''});
  try{
   const result=await window.omniEdu?.decideXiaozhiOffice({schemaVersion:OFFICE_ARTIFACT_SCHEMA,sessionId,draftId:artifact.id,revision:artifact.revision,action});
   if(!live.current)return;
   if(!result?.ok)update({error:result?OFFICE_ARTIFACT_ERRORS[result.error]:'本次操作没有提交，请重试。'});
   await onRefresh();
  }catch{if(live.current)update({error:'文档状态未能确认，请刷新后检查。'});}
  finally{lock.current=false;if(live.current)update({busy:false});}
 }
 const state=pending||artifact.state==='uncertain'?'requires-action':['approved','generating','prepared','committing'].includes(artifact.state)?'input-available':artifact.state==='saved'?'output-available':'output-error';
 return <ChatTool state={state} isExpanded={expanded} onExpandedChange={setExpanded} className="pi-copy-approval pi-office-artifact"
  data-testid="pi-office-artifact" data-office-id={artifact.id} data-state={artifact.state} data-revision={artifact.revision}>
  <ChatTool.Trigger><FileText size={16}/><strong>{artifact.format.toUpperCase()} 文档</strong><span title={artifact.path}>{artifact.path}</span><span>{labels[artifact.state]}</span></ChatTool.Trigger>
  <ChatTool.Content>
   {reading?<p role="status">正在读取本地拟内容…</p>:review&&<div className="pi-office-review" data-testid="pi-office-review">
    <Tabs selectedKey={tab} onSelectionChange={key=>setTab(String(key))}>
     <Tabs.ListContainer><Tabs.List aria-label="办公文档审阅">{[['preview','拟内容'],...(pending?[['edit','修改拟内容']]:[]),['sources','来源']].map(([key,label])=><Tabs.Tab key={key} id={key}>{label}<Tabs.Indicator/></Tabs.Tab>)}</Tabs.List></Tabs.ListContainer>
     <Tabs.Panel id="preview"><div className="pi-office-preview" data-testid="pi-office-preview"><Markdown components={{img:({alt})=><span>［图片：{alt||'未加载'}］</span>,a:({children})=><span>{children}</span>}}>{preview(content??review.draft)}</Markdown></div></Tabs.Panel>
     {pending&&<Tabs.Panel id="edit"><div className="pi-office-editor" data-testid="pi-office-editor">
      {content&&<>
       <TextField value={content.title} onChange={value=>edit(next=>{next.title=value;})} isDisabled={!editable}><Label>文档标题</Label><Input maxLength={120} data-testid="pi-office-title"/></TextField>
       {content.sections.map((section,index)=><div className="pi-office-section" key={index}>
        <TextField value={section.heading} onChange={value=>edit(next=>{next.sections[index].heading=value;})} isDisabled={!editable}><Label>章节 {index+1} 标题</Label><Input maxLength={120} data-testid={`pi-office-heading-${index}`}/></TextField>
        {section.paragraphs.map((text,paragraph)=><TextField key={paragraph} value={text} onChange={value=>edit(next=>{next.sections[index].paragraphs[paragraph]=value;})} isDisabled={!editable}><Label>章节 {index+1} · 段落 {paragraph+1}</Label><TextArea maxLength={1000} rows={3} data-testid={`pi-office-paragraph-${index}-${paragraph}`}/></TextField>)}
        {section.table&&<>
         <p>表格（数字单元格保留数字类型）</p>
         {section.table.columns.map((column,c)=><TextField key={`column-${c}`} value={column} onChange={value=>edit(next=>{next.sections[index].table!.columns[c]=value;})} isDisabled={!editable}><Label>第 {c+1} 列标题</Label><Input maxLength={120} data-testid={`pi-office-column-${index}-${c}`}/></TextField>)}
         {section.table.rows.map((row,r)=><div className="pi-office-table-row" key={r}><p>第 {r+1} 行</p>{row.map((cell,c)=><TextField key={c} value={typeof cell==='number'&&!Number.isFinite(cell)?'':String(cell)} onChange={value=>edit(next=>{next.sections[index].table!.rows[r][c]=typeof cell==='number'?value.trim()?Number(value):Number.NaN:value;})} isDisabled={!editable}><Label>{section.table!.columns[c]}</Label><Input type={typeof cell==='number'?'number':'text'} maxLength={typeof cell==='string'?120:undefined} data-testid={`pi-office-cell-${index}-${r}-${c}`}/></TextField>)}</div>)}
        </>}
       </div>)}
      </>}
     </div><div className="pi-office-actions"><Button size="sm" variant="secondary" isDisabled={!editable||!draft.editing} onPress={()=>void saveDraft()} data-testid="pi-office-save-draft">保存拟内容</Button><Button size="sm" variant="ghost" isDisabled={!editable||!draft.editing} onPress={()=>update({officeDraft:structuredClone(review.draft),officeRevision:artifact.revision,editing:false,error:''})} data-testid="pi-office-discard-edit">放弃修改</Button></div></Tabs.Panel>}
     <Tabs.Panel id="sources"><div className="pi-office-sources" data-testid="pi-office-sources">{review.sources.length?review.sources.map(source=><p key={`${source.kind}:${source.path}`}>{source.kind==='parent_artifact'?'上一版产物':'资料来源'} · {source.path}</p>):<p>本次没有文件资料来源；内容为 AI 起草，经教师审阅后保存。</p>}{review.parentArtifactId&&<p>此文档为新版本，原文件保持不变。</p>}</div></Tabs.Panel>
    </Tabs>
    <p>{pending?draft.editing?'有未保存的修改，请先保存拟内容，再确认此版本。':'确认仅保存本次拟内容；来源或目标发生变化时不会覆盖。':'这是本次操作的拟内容记录；实际文件请从工作区打开。'}</p>
   </div>}
   {pending&&<ChatTool.Approval><ChatTool.ApprovalActions><ChatTool.Approve isDisabled={!editable||draft.editing} onPress={()=>void decide('approve')} data-testid="pi-office-approve">确认保存</ChatTool.Approve><ChatTool.Reject isDisabled={draft.busy||!running} onPress={()=>void decide('reject')} data-testid="pi-office-reject">拒绝</ChatTool.Reject></ChatTool.ApprovalActions></ChatTool.Approval>}
  </ChatTool.Content>
  <div className="pi-office-actions">
   {!pending&&<Button size="sm" variant="ghost" onPress={()=>setExpanded(value=>!value)} data-testid="pi-office-review-toggle">{expanded?'收起拟内容':'查看拟内容'}</Button>}
   {artifact.state==='saved'&&<Button size="sm" variant="ghost" onPress={()=>onOpen(artifact.path)} data-testid="pi-office-open">打开文件</Button>}
   {artifact.state==='uncertain'&&<Button size="sm" variant="ghost" isDisabled={draft.busy||running} onPress={()=>void decide('verify')} data-testid="pi-office-verify">核验现有文件</Button>}
   {draft.busy&&<span role="status">正在提交…</span>}
  </div>
  {draft.error&&<p role="alert" data-testid="pi-office-error">{draft.error}<Button size="sm" variant="ghost" onPress={()=>void onRefresh()}>刷新状态</Button></p>}
 </ChatTool>;
}
