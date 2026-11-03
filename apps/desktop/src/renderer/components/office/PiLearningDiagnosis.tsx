import {Button,Input,TextArea} from '@heroui/react';
import {DisclosureCard} from '../ui/DisclosureCard';
import {PaperSelect} from '../paper-ui/PaperSelect';
import styles from '../../ui-system/learning-review.module.css';
import {DIAGNOSIS_CATEGORIES,LEARNING_DIAGNOSIS_SCHEMA,diagnosisAnswers,diagnosisEvidence,type LearningDiagnosis} from '../../../shared/learning-diagnosis';

/** Edits the existing assessment draft; the original card still performs the only confirmation. */
export function PiLearningDiagnosis({value,content,result,onChange}:{value?:LearningDiagnosis;content:string;result:'correct'|'incorrect'|'partial';onChange?:(value:LearningDiagnosis|undefined)=>void}){
 const answers=diagnosisAnswers(content),editable=Boolean(onChange);
 if(!value)return onChange?<Button variant="secondary" data-testid="learning-diagnosis-add" onPress={()=>onChange({schemaVersion:LEARNING_DIAGNOSIS_SCHEMA,category:result==='correct'?'none':'insufficient',evidence:[],interpretation:'请核对本次作答，暂不确定原因。',intervention:'先请学生说明本次作答步骤，再决定针对练习。'})}>补充错因依据</Button>:null;
 const change=(patch:Partial<LearningDiagnosis>)=>onChange?.({...value,...patch});
 const evidence=diagnosisEvidence(value,content);
 const updateEvidence=(index:number,patch:Partial<LearningDiagnosis['evidence'][number]>)=>change({evidence:value.evidence.map((e,i)=>i===index?{...e,...patch}:e)});
 return <DisclosureCard defaultExpanded title="错因依据与针对干预" bodyClassName={styles.diagnosis} data-testid="learning-diagnosis">
  <p>以下是对本次作答的初步解释。教师核对后用于调整练习，不作为人格或已经掌握的结论。</p>
  {editable?<PaperSelect label="错因判断" testId="learning-diagnosis-category" value={value.category} options={Object.entries(DIAGNOSIS_CATEGORIES).filter(([k])=>result==='correct'?k==='none':k!=='none').map(([id,label])=>({id,label}))} onChange={category=>change({category:category as LearningDiagnosis['category']})}/>:<p data-testid="learning-diagnosis-category-saved">{DIAGNOSIS_CATEGORIES[value.category]}</p>}
  <strong>观察到的实际作答</strong>
  {evidence.length===0&&<p data-testid="learning-diagnosis-no-evidence">尚无具体作答依据，请补充核对；不能据此判定概念或方法错误。</p>}
  {evidence.map((e,i)=><div key={i} className={styles.evidence} data-testid="learning-diagnosis-evidence">
   {editable?<div className={styles.range}><PaperSelect label="作答编号" testId={`learning-diagnosis-answer-${i}`} value={String(e.answerNumber)} options={answers.map(a=>({id:String(a.number),label:`作答 ${a.number}`}))} onChange={answerNumber=>updateEvidence(i,{answerNumber:Number(answerNumber)})}/><label className={styles.field}>起始行<Input data-testid={`learning-diagnosis-from-${i}`} type="number" min={1} max={200} value={e.fromLine} onChange={event=>updateEvidence(i,{fromLine:event.target.valueAsNumber})}/></label><label className={styles.field}>结束行<Input data-testid={`learning-diagnosis-to-${i}`} type="number" min={1} max={200} value={e.toLine} onChange={event=>updateEvidence(i,{toLine:event.target.valueAsNumber})}/></label></div>:<p>作答 {e.answerNumber} · 第 {e.fromLine}–{e.toLine} 行</p>}
   {e.quote===null?<p role="alert">引用超出本次作答、内容为空或过长，请重新选择。</p>:<blockquote className={styles.quote} data-testid="learning-diagnosis-quote">{e.quote}</blockquote>}
   {editable&&<Button variant="secondary" data-testid={`learning-diagnosis-remove-${i}`} onPress={()=>change({evidence:value.evidence.filter((_,n)=>n!==i)})}>移除此段依据</Button>}
  </div>)}
  {editable&&<Button variant="secondary" isDisabled={value.evidence.length>=3||!answers.length} data-testid="learning-diagnosis-evidence-add" onPress={()=>{const a=answers[0],line=a.lines.findIndex(v=>Boolean(v.trim()))+1;change({evidence:[...value.evidence,{answerNumber:a.number,fromLine:line,toLine:line}]});}}>引用一段实际作答</Button>}
  {editable?<><label className={styles.field}>初步解释<TextArea rows={3} data-testid="learning-diagnosis-interpretation" maxLength={1000} value={value.interpretation} onChange={e=>change({interpretation:e.target.value})}/></label><label className={styles.field}>针对性干预建议<TextArea rows={3} data-testid="learning-diagnosis-intervention" maxLength={1000} value={value.intervention} onChange={e=>change({intervention:e.target.value})}/></label><Button variant="secondary" data-testid="learning-diagnosis-remove" onPress={()=>onChange?.(undefined)}>移除本次错因分析</Button></>:<><p data-testid="learning-diagnosis-interpretation-saved">初步解释：{value.interpretation}</p><p data-testid="learning-diagnosis-intervention-saved">建议：{value.intervention}</p></>}
 </DisclosureCard>;
}
