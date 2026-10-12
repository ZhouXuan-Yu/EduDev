import {TextArea} from '@heroui/react';
import {QUESTION_PROJECTION_FIELDS,QUESTION_PROJECTION_LABELS,type QuestionProjection} from '../../../shared/question-projection';

/** Uses the same HeroUI form primitives as the original review, with explicit teacher coverage. */
export function QuestionProjectionFields({value,disabled,onChange}:{value:QuestionProjection;disabled:boolean;onChange:(next:QuestionProjection)=>void}){
 const pending=QUESTION_PROJECTION_FIELDS.filter(key=>{const part=value[key];return part.state==='missing'||part.state==='provided'&&!part.text.trim()||key==='statement'&&part.state==='not_applicable';});
 return <section data-testid="question-projection-fields"><p>已有文字是待核对的候选转写，可直接校正。请逐项对照原图：完整转写或明确本题没有此项。图形需核对连线、标注、量程和坐标；候选不会自动成为已确认内容。</p>
  <p data-testid="question-projection-uncertainty">必要图义或读数无法核实时，请保留疑点并选“尚未核对”，核实前不能保存完整题面。原图标记来源不明时请注明，不把它当作标准答案。</p>
  <p role="status" aria-live="polite" data-testid="question-projection-coverage">已核对 {QUESTION_PROJECTION_FIELDS.length-pending.length} / {QUESTION_PROJECTION_FIELDS.length} 项{pending.length?`；还需核对：${pending.map(key=>QUESTION_PROJECTION_LABELS[key]).join('、')}。`:'；请最后确认与全部原图一致。'}</p>
  {QUESTION_PROJECTION_FIELDS.map(key=>{const part=value[key];return <div key={key}>
   <label>{QUESTION_PROJECTION_LABELS[key]}<select data-testid={`projection-${key}-state`} aria-label={`${QUESTION_PROJECTION_LABELS[key]}核对状态`} disabled={disabled} value={part.state} onChange={e=>onChange({...value,[key]:{state:e.target.value as typeof part.state,text:e.target.value==='not_applicable'?'':part.text}})}>
    <option value="missing">尚未核对</option><option value="provided">已完整转写</option>{key!=='statement'&&<option value="not_applicable">本题没有此项</option>}
   </select></label>
   {part.state!=='not_applicable'&&<TextArea aria-label={QUESTION_PROJECTION_LABELS[key]} data-testid={`projection-${key}-text`} disabled={disabled} maxLength={key==='statement'?12000:4000} value={part.text} onChange={e=>onChange({...value,[key]:{state:'missing',text:e.target.value}})}/>}
  </div>;})}<p>确认的是转写与原图一致，答案仍需独立核对。</p>
 </section>;
}
