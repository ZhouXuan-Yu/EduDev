import {Button,Checkbox} from '@heroui/react';
import {QUESTION_QUALITY_MESSAGES,type QuestionQualityReview as Quality} from '../../../shared/question-quality';
const mathLabels={matched:'提交的计算符合参考结果（整题条件仍需核对）',mismatch:'计算不符合参考结果，禁止保存',unsupported:'超出当前计算范围，须人工复核',basis_changed:'题目或关联解析已修改，旧计算未使用，须人工复核',not_run:'未提交适用计算，须人工复核'};

/** Host-owned checks are shown separately from the teacher's explicit review. */
export function QuestionQualityReview({quality,checked,prechecked=false,grouped=false,reviewed,legacy,historyCount,pending,busy,onCheck,onReviewed}:{quality?:Quality;checked:boolean;prechecked?:boolean;grouped?:boolean;reviewed:boolean;legacy?:boolean;historyCount:number;pending:boolean;busy:boolean;onCheck:()=>void;onReviewed:(value:boolean)=>void}){
 const displayed=checked||prechecked;
 return <section className="pi-training-day" data-testid="question-quality-review" aria-label="题目质量核对">
  <strong>题目质量核对</strong>
  <p data-testid="question-quality-status" role="status">{legacy?'历史版本未记录质量检查，请逐题核对。':quality?.state==='blocked'&&displayed?'检查未通过，候选仍被隔离，未保存到题本。':displayed?'格式与本组、实读原题的同题检查已完成，仍需人工复核。':'请检查当前版本；修改题目后需要重新检查。'}</p>
  {prechecked&&!checked&&pending&&!grouped&&<p>这是小智提交时的检查结果。请检查当前版本，再明确核对；不会自动保存。</p>}
  <p>{displayed&&quality?.items.some(q=>q.math?.engine)?'本地计算只检查所列形式化表达式。':'自动数学核验尚未执行。'}请核对计算与题干、条件及参考答案的对应关系；计算或格式符合不代表整题正确。去重范围限于本组及实读原题。</p>
  {displayed&&quality&&<ul data-testid="question-quality-issues">{quality.items.map((q,i)=><li key={i}>第{i+1}题：{q.issues.length?q.issues.map(issue=>QUESTION_QUALITY_MESSAGES[issue]).join('；'):'需要人工复核'}</li>)}</ul>}
  {displayed&&quality&&<ul data-testid="question-math-receipts">{quality.items.map((q,i)=>q.math&&<li key={i} data-testid="question-math-receipt">第{i+1}题：{mathLabels[q.math.state]}{q.math.stepStates&&<p data-testid="question-math-steps">已检查 {q.math.stepStates.length} 步：{q.math.stepStates.map((s,j)=>`第${j+1}步${{matched:'符合',mismatch:'不符合',unsupported:'超出范围'}[s]}`).join('；')}。只覆盖下列计算。</p>}{q.math.calculation&&<p style={{whiteSpace:'pre-wrap'}}>{q.math.calculation}</p>}</li>)}</ul>}
  {!!historyCount&&<small>已保留 {historyCount} 个检查版本，最多 8 个。</small>}
  {pending&&<><Button variant="secondary" data-testid="question-quality-check" isDisabled={busy} onPress={onCheck}>检查当前版本</Button>
   {!grouped&&<Checkbox data-testid="question-quality-reviewed" isSelected={reviewed&&checked} isDisabled={busy||!checked||quality?.state!=='manual_review'} onChange={onReviewed}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control><span>我已核对本版本的题干、条件、答案、解析及所列计算的对应关系。</span></Checkbox.Content></Checkbox>}</>}
 </section>;
}
