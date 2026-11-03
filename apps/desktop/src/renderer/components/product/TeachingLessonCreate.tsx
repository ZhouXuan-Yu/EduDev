import {useEffect,useState} from 'react';
import {Button,Input,Label,TextField} from '@heroui/react';
import {curriculumLabel,type CurriculumEntry} from '../../../shared/material-curriculum';
import {useDesktopNavigation} from '../desktop/DesktopFrame';
import {DisclosureCard} from '../ui/DisclosureCard';
import styles from '../../ui-system/teaching-lesson.module.css';

/** Explicit teacher click starts the original Pi with host-captured source revisions. */
export function TeachingLessonCreate({requirement,disabled}:{requirement:string;disabled:boolean}){
 const nav=useDesktopNavigation(),[subject,setSubject]=useState('语文'),[grade,setGrade]=useState('五年级'),[choices,setChoices]=useState<{title:string;entry:CurriculumEntry}[]>([]),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let live=true;void window.omniEdu?.listMaterialCurricula().then(rows=>{if(live)setChoices(rows.flatMap(r=>r.entry&&!r.stale&&r.entry.metadata.status==='active'?[{title:r.title,entry:r.entry}]:[]));}).catch(()=>{if(live)setError('备课依据未读取成功，请重新打开制作区后重试。');}).finally(()=>{if(live)setLoading(false);});return()=>{live=false;};},[]);
 async function create(){
  if(disabled||busy||loading||!requirement.trim()||!subject.trim()||!grade.trim())return;setBusy(true);setError('');
  try{
   const api=window.omniEdu;if(!api)throw Error();const entries=selected.map(id=>choices.find(c=>c.entry.id===id)!.entry);
   const list=await api.listAiConversations();let remembered='';try{remembered=localStorage.getItem('xiaozhi.current-session.v1')||'';}catch{}
   const existing=list.sessions.find(s=>s.id===remembered)||list.sessions[0],detail=existing?{session:existing}:await api.createAiConversationSession({title:'教案设计'});
   const curricula=entries.map(entry=>({resourceId:entry.source.resourceId,revision:entry.id}));
   const result=await api.startXiaozhi({sessionId:detail.session.id,commandId:'xicmd_'+crypto.randomUUID(),classroomPlan:{mode:'outline',lesson:{subject:subject.trim(),grade:grade.trim(),curricula}},prompt:`请制作完整可编辑的${subject.trim()}、${grade.trim()}教案：${requirement.trim()}。用education_propose_classroom_outline提交包含lesson的教学设计。各目标写成可观察行动，环节完整覆盖导入、探究讲授、练习、评价及总结，每个目标关联实际活动、检查题、预期证据和判断标准，附准备材料与教师提示语。不要只列标题。${entries.length?`教师本任务固定采用如下版本，先通过office_read_material逐项实读对应锚点，mappings.curriculumIndex按下面顺序，不能自行换版：\n${entries.map((e,i)=>`${i}: ${curriculumLabel(e.metadata)}；resourceId=${e.source.resourceId}，offset=${e.source.offset}，正文版本=${e.source.version}，登记修订=${e.id}`).join('\n')}`:'本任务未选定正式依据，只可做明确待对照的通用教案，在missingSources列出待补的课标/教材，不伪造标准编号或来源。'}合成资料、参考案例不得作为正式课标。lesson.subject必须为“${subject.trim()}”，lesson.grade必须为“${grade.trim()}”。只保存教学设计草稿后停止，等教师到教学工作台→互动课堂核对，不生成课页、不自动确认、不宣称文件已经交付。`});
   if(!result.ok)throw Error();nav.navigate({view:'ai',sessionId:detail.session.id});
  }catch{setError('教案尚未开始，请核对会话空闲及选定依据仍有效，再重试。');}finally{setBusy(false);}
 }
 return <section className={styles.stack} data-testid="teaching-lesson-create">
  <div className={styles.fields}><TextField isDisabled={disabled||busy}><Label>学科</Label><Input data-testid="lesson-subject" value={subject} maxLength={160} onChange={e=>setSubject(e.target.value)}/></TextField><TextField isDisabled={disabled||busy}><Label>年级</Label><Input data-testid="lesson-grade" value={grade} maxLength={160} onChange={e=>setGrade(e.target.value)}/></TextField></div>
  <DisclosureCard title={`备课依据 · 已选${selected.length}份（最多3份）`} data-testid="lesson-basis-toggle"><div className={styles.stack}>
   <p>{loading?'正在读取已登记的教材与课标…':choices.length?'选定版本会固定到本次任务；选取顺序与目标映射一同保存。':'尚无可用登记。可先制作待对照通用教案，或到资料库登记课标与教材版本。'}</p>
   {choices.map(c=><label key={c.entry.id} className={styles.choice}><input type="checkbox" data-testid={'lesson-basis-'+c.entry.source.resourceId} checked={selected.includes(c.entry.id)} disabled={disabled||busy||!selected.includes(c.entry.id)&&selected.length>=3} onChange={e=>setSelected(old=>e.target.checked?[...old,c.entry.id]:old.filter(id=>id!==c.entry.id))}/><span>{c.title}<small className={styles.muted}>{curriculumLabel(c.entry.metadata)}{selected.includes(c.entry.id)?` · 依据${selected.indexOf(c.entry.id)+1}`:''}</small></span></label>)}
  </div></DisclosureCard>
  {!selected.length&&<p className={styles.muted}>未选依据：生成待对照通用教案，不作正式课标对齐声明。</p>}
  {error&&<p role="alert" data-testid="lesson-create-error">{error}</p>}
  <div><Button data-testid="lesson-create" isDisabled={disabled||busy||loading||!requirement.trim()||!subject.trim()||!grade.trim()} onPress={()=>void create()}>{busy?'正在开始…':'请小智制作完整教案'}</Button></div>
 </section>;
}
