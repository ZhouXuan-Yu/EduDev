import {Button, Input} from '@heroui/react';
import type {PaperBlueprint, PaperSection, PaperMode, PaperGenerationContext} from '../../../shared/paper-blueprint';

type Props = {
 blueprint: PaperBlueprint; busy: boolean; loading: boolean; contextsLoading: boolean;
 contexts: PaperGenerationContext[]; contextOwner: string; hasView: boolean; actualPoints: number;
 change: (value: PaperBlueprint) => void;
 field: (key: 'title' | 'subject' | 'grade', value: string) => void;
 section: (index: number, patch: Partial<PaperSection>) => void;
 onMode: (mode: PaperMode) => void; onContext: (owner: string) => void;
 onSupplement: () => void; create: () => Promise<void>; cancel: () => Promise<void>;
};

/** Blueprint presentation only; IPC and snapshot ownership stay in the workspace. */
export function PaperBlueprintEditor({blueprint,busy,loading,contextsLoading,contexts,contextOwner,hasView,actualPoints,change,field,section,onMode,onContext,onSupplement,create,cancel}: Props) {
 return (<section className="edu-paper-editor">
      <h2>组卷蓝图</h2>
      <p>设置考查范围和题型结构。缺题时保留要求，不自动放宽条件。</p>
      <fieldset disabled={busy||loading}>
   <div className="paper-fields">
      <label>组卷方式<select data-testid="paper-mode" value={blueprint.mode} onChange={e=>{onMode(e.target.value as PaperMode);}}>
      <option value="source_only">纯题库原题</option>
      <option value="hybrid">原题与生成题混合</option>
      <option value="ai_original">AI原创题</option></select></label>{(['title','subject','grade'] as const).map(key=>
      <label key={key}>{{title:'试卷名称',subject:'学科',grade:'年级'}[key]}<Input data-testid={'paper-'+key} maxLength={key==='title'?160:128} value={blueprint[key]} onChange={e=>field(key,e.target.value)}/></label>)}<label>时长（分钟）<Input data-testid="paper-duration" type="number" min={1} max={1440} value={blueprint.durationMinutes} onChange={e=>change({...blueprint,durationMinutes:Number(e.target.value)})}/></label>
      <label>总分<Input data-testid="paper-total" type="number" min={1} max={10000} value={blueprint.totalPoints} onChange={e=>change({...blueprint,totalPoints:Number(e.target.value)})}/></label>
      </div>
   {blueprint.mode!=='source_only'&&<div data-testid="paper-generation-contexts">
      <label>已确认题组的出题任务<select data-testid="paper-generation-context" value={contextOwner} disabled={contextsLoading} onChange={e=>{onContext(e.target.value);}}>
      {contextOwner&&!contexts.some(context=>context.sessionId===contextOwner)&&<option value={contextOwner} disabled>此出题任务尚无可用的已确认题组，请先补充并核对</option>}
      <option value="">{contextsLoading?'正在核对已确认题组…':'选择出题任务'}</option>{contexts.map(c=>
      <option key={c.sessionId} value={c.sessionId}>{c.title} · 原创{c.originalCount}题 · 变式{c.variationCount}题</option>)}</select></label>
      <p>仅使用此任务中教师已确认、当前版本仍有效的题目；不把待审或失败题混入试卷。</p>{!contextsLoading&&!contexts.length&&<p data-testid="paper-generation-empty">当前学科年级还没有可用的已确认生成题。</p>}<Button variant="secondary" data-testid="paper-generation-open-ai" onPress={onSupplement}>前往小智补充题组</Button></div>}
   {blueprint.sections.map((s,i)=>
      <fieldset className="paper-section-fields" key={s.id} data-testid="paper-section">
      <legend>第 {i+1} 部分</legend>
      <div className="paper-fields">
      <label>部分名称<Input data-testid="paper-section-label" maxLength={80} value={s.label} onChange={e=>section(i,{label:e.target.value})}/></label>
      <label>题型<Input data-testid="paper-section-type" maxLength={128} value={s.questionType} onChange={e=>section(i,{questionType:e.target.value})}/></label>
      <label>题数<Input data-testid="paper-section-count" type="number" min={1} max={100} value={s.count} onChange={e=>section(i,{count:Number(e.target.value)})}/></label>{blueprint.mode==='hybrid'&&<label>其中生成题数<Input data-testid="paper-section-generated-count" type="number" min={0} max={s.count} value={s.generatedCount??0} onChange={e=>section(i,{generatedCount:Number(e.target.value)})}/></label>}<label>每题分数<Input data-testid="paper-section-points" type="number" min={1} max={1000} value={s.points} onChange={e=>section(i,{points:Number(e.target.value)})}/></label>
      <label>难度<select data-testid="paper-section-difficulty" value={s.difficulty||''} onChange={e=>section(i,{difficulty:e.target.value as PaperSection['difficulty']||undefined})}>
      <option value="">不限</option>
      <option value="easy">基础</option>
      <option value="medium">中等</option>
      <option value="hard">困难</option></select></label>
      <label>知识点（选填）<Input data-testid="paper-section-kp" maxLength={128} value={s.knowledgePoint||''} onChange={e=>section(i,{knowledgePoint:e.target.value||undefined})}/></label>
      </div>
      <Button variant="secondary" isDisabled={blueprint.sections.length===1} onPress={()=>change({...blueprint,sections:blueprint.sections.filter((_,index)=>index!==i)})}>移除此部分</Button></fieldset>)}

   <Button variant="secondary" isDisabled={blueprint.sections.length>=20} onPress={()=>change({...blueprint,sections:[...blueprint.sections,{id:'section_'+crypto.randomUUID().slice(0,8),label:'新增部分',questionType:'解答题',count:1,points:10,...(blueprint.mode==='hybrid'?{generatedCount:1}:{})}]})}>添加部分</Button>
  </fieldset>
      <p data-testid="paper-blueprint-score">蓝图合计 {actualPoints} 分 / 目标 {blueprint.totalPoints} 分</p>
      <div className="paper-review-actions">
      <Button data-testid="paper-generate" isDisabled={busy||loading||contextsLoading} isPending={busy} onPress={()=>void create()}>{hasView?'按当前蓝图重新生成':'按蓝图组卷'}</Button>{busy&&<Button variant="secondary" data-testid="paper-cancel" onPress={()=>void cancel()}>停止组卷</Button>}</div></section>);
}
