import {useEffect,useRef,useState} from 'react';
import {Button,Card,Input,Label,TextArea,TextField} from '@heroui/react';
import {validClassroomPlanDocument,type ClassroomPlanDocument,type ClassroomPlanItem} from '../../../shared/classroom-plan';
import {classroomErrors} from '../../../shared/classroom';
import {useDesktopCommands,useDesktopNavigation} from '../desktop/DesktopFrame';
import {ClassroomOutlineReferenceCard,ClassroomOutlineSceneCard} from './ClassroomOutlineCards';
import '../../ui-system/classroom-outline.css';
import {TeachingLessonDetails} from './TeachingLessonDetails';
import {teachingLessonIssues} from '../../../shared/teaching-lesson';
import {DisclosureCard} from '../ui/DisclosureCard';

export const classroomPlanStatus:Record<ClassroomPlanItem['status'],string>={draft:'待确认大纲',confirmed:'大纲已确认',generating:'正在生成课页',interrupted:'已暂停，成功页保留',ready:'课页已齐，待课堂核对',rejected:'已拒绝'};
export function canGenerateClassroomPlan(plan:ClassroomPlanItem,dirty:boolean){return !plan.document.lesson&&!dirty&&['confirmed','interrupted'].includes(plan.status);}

/** Teacher approval is persisted by main; local edits never silently retain approval. */
export function ClassroomOutlineEditor({onOpenClassroom}:{onOpenClassroom:(id:string)=>Promise<void>}){
 const nav=useDesktopNavigation(),[rows,setRows]=useState<ClassroomPlanItem[]>([]),[selected,setSelected]=useState<ClassroomPlanItem>(),[draft,setDraft]=useState<ClassroomPlanDocument>(),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const epoch=useRef(0),selection=useRef<string|undefined>(undefined),dirty=Boolean(selected&&draft&&JSON.stringify(selected.document)!==JSON.stringify(draft));
 const [history,setHistory]=useState<ClassroomPlanItem[]>([]),[historyBusy,setHistoryBusy]=useState(false);
 useEffect(()=>{setHistory([]);},[selected?.id]);
 const generating=rows.some(p=>p.status==='generating'),readOnly=busy||selected?.status==='generating'||selected?.status==='rejected';
 function choose(value:ClassroomPlanItem){if(dirty){setError('请先保存大纲修改或放弃修改，再切换。');return;}++epoch.current;selection.current=value.id;setLoading(false);setSelected(value);setDraft(structuredClone(value.document));setError('');setNotice('');}
 async function load(){
  if(dirty)return;const stamp=++epoch.current;setLoading(true);
  try{const result=await window.omniEdu?.listClassroomPlans();if(!result?.ok)throw Error(result?.error||'unavailable');if(stamp!==epoch.current)return;setRows(result.data);const value=result.data.find(p=>p.id===selection.current)||result.data[0];selection.current=value?.id;setSelected(value);setDraft(value?structuredClone(value.document):undefined);}
  catch(e){if(stamp===epoch.current)setError(classroomErrors[e instanceof Error?e.message:'']||classroomErrors.unavailable);}
  finally{if(stamp===epoch.current)setLoading(false);}
 }
 useEffect(()=>{void load();return()=>{++epoch.current;};},[]);
 useEffect(()=>{if(!generating||dirty||busy)return;const timer=setInterval(()=>void load(),1200);return()=>clearInterval(timer);},[generating,dirty,busy,selected?.id]);
 useDesktopCommands(command=>{if(dirty&&['back','forward'].includes(command)){setError('请先保存大纲修改或放弃修改，再离开。');return true;}return false;},36);
 useEffect(()=>{
  if(!dirty)return;const guard=(event:Event)=>{if(event.target instanceof Element&&!event.target.closest('[data-testid="classroom-plan-editor"]')&&(!(event instanceof KeyboardEvent)||['Enter',' '].includes(event.key))){event.preventDefault();event.stopPropagation();setError('请先保存大纲修改或放弃修改，再离开。');}};
  document.addEventListener('pointerdown',guard,true);document.addEventListener('keydown',guard,true);return()=>{document.removeEventListener('pointerdown',guard,true);document.removeEventListener('keydown',guard,true);};
 },[dirty]);
 function apply(value:ClassroomPlanItem){++epoch.current;selection.current=value.id;setLoading(false);setRows(old=>[value,...old.filter(p=>p.id!==selected?.id&&p.id!==value.id)]);setSelected(value);setDraft(structuredClone(value.document));}
 async function mutate(action:'save'|'confirm'|'reject'){
  if(!selected||!draft||busy||selected.status==='generating')return;setBusy(true);setError('');setNotice('');
  try{
   if(!validClassroomPlanDocument(draft))throw Error('invalid_input');const api=window.omniEdu;if(!api)throw Error('unavailable');
   const result=action==='save'?await api.editClassroomPlan({id:selected.id,version:selected.version,document:draft}):await api.decideClassroomPlan({id:selected.id,version:selected.version,decision:action});
   if(!result.ok)throw Error(result.error);apply(result.data);setNotice(action==='save'?'新版本已保存，请重新确认。':action==='confirm'?(draft.lesson?'当前教案已确认，内容已保存。':'当前大纲已确认。点击生成课页后，小智才开始制作。'):'大纲已拒绝。');
  }catch(e){setError(classroomErrors[e instanceof Error?e.message:'']||classroomErrors.unavailable);}finally{setBusy(false);}
 }
 async function generate(){
  if(!selected||!canGenerateClassroomPlan(selected,dirty)||busy)return;setBusy(true);setError('');
  try{
   const result=await window.omniEdu?.startXiaozhi({sessionId:selected.sessionId,commandId:'xicmd_'+crypto.randomUUID(),classroomPlan:{mode:'generate',id:selected.id,version:selected.version},prompt:`教师已在页面确认“${selected.document.title}”当前大纲。请先 education_read_classroom_plan 实读宿主绑定版本，只补 missingSceneIds；每页使用 education_prepare_planned_scene 生成原生 contentJson，再 education_save_classroom_scene 保存。全部页成功后 education_finish_classroom_plan 提交待核对课堂。成功页不要重做，不改大纲，不自动确认课堂，不导出文件。`});
   if(!result?.ok)throw Error(result?.error||'unavailable');nav.navigate({view:'ai',sessionId:selected.sessionId});
  }catch(e){setError(classroomErrors[e instanceof Error?e.message:'']||'生成尚未开始，请确认会话空闲、大纲及来源仍有效后重试。');}finally{setBusy(false);}
 }
 async function stop(){if(!selected||busy)return;setBusy(true);try{const result=await window.omniEdu?.stopXiaozhi(selected.sessionId);if(!result?.ok)throw Error();setNotice('已请求停止；已保存页保留，状态会在本轮结束后更新。');}catch{setError('停止请求未送达，请回来源对话核对。');}finally{setBusy(false);}}
 async function loadHistory(){
  if(!selected||historyBusy)return;const id=selected.id;setHistoryBusy(true);setError('');
  try{const result=await window.omniEdu?.readClassroomPlanHistory(id);if(!result?.ok)throw Error(result?.error||'unavailable');if(selection.current===id)setHistory(result.data);}catch(e){if(selection.current===id)setError(classroomErrors[e instanceof Error?e.message:'']||classroomErrors.unavailable);}finally{setHistoryBusy(false);}
 }
 function field<K extends keyof ClassroomPlanDocument>(key:K,value:ClassroomPlanDocument[K]){++epoch.current;setLoading(false);setDraft(old=>old?{...old,[key]:value}:old);setNotice('');}
 function scene(index:number,key:'title'|'activity'|'durationMinutes',value:string|number){++epoch.current;setLoading(false);setDraft(old=>old?{...old,scenes:old.scenes.map((s,i)=>i===index?{...s,[key]:value}:s)}:old);setNotice('');}
 if(!rows.length&&!error)return null;
 const total=draft?.scenes.reduce((n,s)=>n+s.durationMinutes,0)||0,valid=draft&&validClassroomPlanDocument(draft),confirmable=valid&&draft&&!teachingLessonIssues(draft).length;
 return <section className="edu-classroom-plan" data-testid="classroom-plan-editor" aria-label="课堂大纲与生成进度">
  <header className="edu-plan-heading"><div><h2>{draft?.lesson?'核对教案与教学依据':'先确认大纲，再制作课页'}</h2><p className="edu-plan-muted">资料与版本保留在同一课堂中，成功页不会因停止而丢失。</p></div><Button variant="ghost" size="sm" isDisabled={busy||loading||dirty} onPress={()=>void load()} data-testid="classroom-plan-refresh">刷新大纲</Button></header>
  {error&&<p role="alert" data-testid="classroom-plan-error">{error}</p>}{notice&&<p role="status" data-testid="classroom-plan-notice">{notice}</p>}
  <div className="edu-plan-grid"><nav className="edu-plan-list" aria-label="课堂大纲">{rows.map(value=><Button key={value.id} variant={selected?.id===value.id?'secondary':'ghost'} isDisabled={busy} onPress={()=>choose(value)} data-testid={'classroom-plan-'+value.id}><span className="edu-plan-entry">{value.document.title}<span className="edu-plan-list-state">{classroomPlanStatus[value.status]} · 第{value.revision}版</span></span></Button>)}</nav>
   {selected&&draft&&<section className="edu-plan-detail" data-testid="classroom-plan-detail" data-status={selected.status}>
    <div className="edu-plan-heading"><strong>{draft.lesson?(selected.status==='draft'?'教案待确认':selected.status==='confirmed'?'教案已确认':classroomPlanStatus[selected.status]):classroomPlanStatus[selected.status]}</strong><span className="edu-plan-muted">{draft.lesson?`${draft.scenes.length}个教学环节 · 第${selected.revision}版`:`已保存 ${selected.checkpoints.length} / ${draft.scenes.length} 页`}</span></div>
    <div className="edu-plan-section-stack"><Card><Card.Header><Card.Title>教学设计</Card.Title><Card.Description>先核对目标与总时长，再查看各页安排。</Card.Description></Card.Header><Card.Content>
    <div className="edu-plan-fields"><TextField isDisabled={readOnly}><Label>课堂名称</Label><Input data-testid="classroom-plan-title" value={draft.title} maxLength={160} onChange={e=>field('title',e.target.value)}/></TextField><TextField isDisabled={readOnly}><Label>教学目标（每行一个）</Label><TextArea data-testid="classroom-plan-objectives" value={draft.objectives.join('\n')} onChange={e=>field('objectives',e.target.value.split('\n'))}/></TextField></div>
    <div className="edu-plan-duration"><TextField isDisabled={readOnly}><Label>课堂总时长（分钟）</Label><Input data-testid="classroom-plan-total" type="number" min={2} max={240} value={String(draft.totalMinutes)} onChange={e=>field('totalMinutes',Number(e.target.value))}/></TextField><span className="edu-plan-muted" role="status">各页合计 {total} 分钟{total!==draft.totalMinutes?'，请调整为与总时长一致':''}</span></div>
    </Card.Content></Card>
    <ClassroomOutlineSceneCard plan={selected} document={draft} readOnly={readOnly} onChange={scene}/>
    {draft.lesson&&!valid&&<p role="alert" data-testid="lesson-structure-error">请填写完整目标、达成标准与各环节内容；目标编号须有效，每个目标均需关联探究或练习和具体检查。导入、探究讲授、练习、评价不能缺少。</p>}
    <TeachingLessonDetails plan={selected} document={draft} readOnly={readOnly} onChange={lesson=>field('lesson',lesson)}/>
    <DisclosureCard title="历史版本与恢复" data-testid="classroom-plan-history-toggle"><div className="edu-plan-fields"><p>恢复先放入当前草稿，保存为新版本后重新确认；原版本及原确认记录保留。</p><div><Button variant="secondary" data-testid="classroom-plan-history-load" isDisabled={historyBusy||busy||dirty} onPress={()=>void loadHistory()}>读取历史版本</Button></div>{history.map(row=><div key={row.id}><strong>第{row.revision}版 · {row.document.title}</strong><p>{classroomPlanStatus[row.status]} · {row.document.totalMinutes}分钟 · {row.document.scenes.length}个环节</p><Button size="sm" variant="ghost" data-testid={'classroom-plan-restore-'+row.revision} isDisabled={readOnly||dirty||row.id===selected.id} onPress={()=>{setDraft(structuredClone(row.document));setError('');setNotice(`第${row.revision}版已放入当前草稿，请核对后保存为新版本。`);}}>恢复到草稿</Button></div>)}</div></DisclosureCard>
    <ClassroomOutlineReferenceCard plan={selected}/></div>
    <footer className="edu-plan-actions">
     <Button variant="secondary" data-testid="classroom-plan-save" isDisabled={readOnly||!dirty||!valid} onPress={()=>void mutate('save')}>保存修改为新版本</Button>
     {dirty&&<Button variant="ghost" onPress={()=>{setDraft(structuredClone(selected.document));setError('');}}>放弃修改</Button>}
     <Button data-testid="classroom-plan-confirm" isDisabled={busy||dirty||!confirmable||selected.status!=='draft'} onPress={()=>void mutate('confirm')}>{draft.lesson?'确认当前教案':'确认当前大纲'}</Button>
     {!draft.lesson&&<Button data-testid="classroom-plan-generate" isDisabled={busy||!canGenerateClassroomPlan(selected,dirty)} onPress={()=>void generate()}>{selected.status==='interrupted'?'继续缺页':'生成课页'}</Button>}
     {selected.status==='generating'&&<Button variant="secondary" data-testid="classroom-plan-stop" isDisabled={busy} onPress={()=>void stop()}>停止生成</Button>}
     {selected.classroomId&&<Button variant="secondary" data-testid="classroom-plan-preview" isDisabled={busy||dirty} onPress={()=>void onOpenClassroom(selected.classroomId!)}>预演并核对课堂</Button>}
     {selected.status==='draft'&&<Button variant="ghost" isDisabled={busy||dirty} onPress={()=>void mutate('reject')}>拒绝大纲</Button>}
    </footer><p className="edu-plan-muted">{draft.lesson?'教案内容保存在本机，修改后重新确认。':'大纲确认、课堂核对与文件写入分别批准；修改大纲后须重新确认。'}</p>
   </section>}
  </div>
 </section>;
}
