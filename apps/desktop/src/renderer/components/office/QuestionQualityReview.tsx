import {mathSolutionSummary} from '../../../shared/math-solution';
import {Button,Checkbox} from '@heroui/react';
import {QUESTION_QUALITY_MESSAGES,type QuestionQualityReview as Quality} from '../../../shared/question-quality';
import styles from '../../ui-system/question-review.module.css';
const mathLabels={matched:'提交的形式模型符合参考结果（整题条件仍需核对）',mismatch:'计算或条件检查未通过，禁止保存',unsupported:'超出当前计算范围，须人工复核',basis_changed:'题目或关联解析已修改，旧计算未使用，须人工复核',not_run:'未提交适用计算，须人工复核'};

function ScienceResult({science}:{science:NonNullable<NonNullable<Quality['items'][number]['math']>['science']>}){
 if(science.kind==='solution')return <div data-testid="question-science-result" data-proof-kind="solution"><p>{mathSolutionSummary(science.result)}</p></div>;
 if(science.kind==='equation'){const r=science.result;return <div data-testid="question-science-result"><p>原式限制：{r.restrictions.join('；')||'无额外限制'}；{r.solutionStatus==='finite'?`有效解集 {${r.solutions.join(', ')}}`:'暂不能确定有限解集'}</p>{r.candidates.map((c,i)=><p key={i}>候选 {c.value}：{!c.admissible?'不满足原式限制':c.satisfies?'代回符合':'代回不符'}</p>)}</div>;}
 const r=science.result;
 const message=r.state==='matched'?'数值与量纲符合提交的参考答案。':r.state==='mismatch'?'数值与参考答案不一致，请核对单位和计算。':r.state==='dimension_mismatch'?(r.reason==='incompatible_addition'?'加减两侧的量纲不一致。':'原物理量与目标单位的量纲不一致，不能直接换算。'):r.reason==='unsupported_unit'?'当前不支持此单位或仿射温标，尚未核验。':r.reason==='undefined'?'表达式存在除零或无实数值等问题，尚未核验。':'超出当前单位计算范围，尚未核验。';
 const dimensions=r.actual?.dimensions.replace(/amount_of_substance|luminous_intensity|length|mass|time|current|temperature/g,k=>({length:'长度',mass:'质量',time:'时间',current:'电流',temperature:'温度',amount_of_substance:'物质的量',luminous_intensity:'发光强度'}[k]!)).replace(/,\s*/g,'、');
 const decimal=r.actual?.decimal.replace(/(\.\d*?[1-9])0+$/,'$1').replace(/\.0+$/,'');
 return <div data-testid="question-science-result"><p>{message}</p>{r.actual&&<p>实际值：{r.actual.exact} {r.actual.unit}{!/^-?\d+$/.test(r.actual.exact)&&`（约 ${decimal}）`}；量纲：{dimensions==='1'?'无量纲':dimensions}；单位换算系数：{r.actual.scaleFactor}</p>}</div>;
}

/** Host-owned checks are shown separately from the teacher's explicit review. */
export function QuestionQualityReview({quality,checked,prechecked=false,grouped=false,reviewed,legacy,historyCount,pending,busy,onCheck,onReviewed}:{quality?:Quality;checked:boolean;prechecked?:boolean;grouped?:boolean;reviewed:boolean;legacy?:boolean;historyCount:number;pending:boolean;busy:boolean;onCheck:()=>void;onReviewed:(value:boolean)=>void}){
 const displayed=checked||prechecked;
 return <section className={`pi-training-day ${styles.quality}`} data-testid="question-quality-review" aria-label="题目质量核对">
  <strong>题目质量核对</strong>
  <p data-testid="question-quality-status" role="status">{legacy?'历史版本未记录质量检查，请逐题核对。':quality?.state==='blocked'&&displayed?'检查未通过，候选仍被隔离，未保存到题本。':displayed?'格式与本组、实读原题的同题检查已完成，仍需人工复核。':'请检查当前版本；修改题目后需要重新检查。'}</p>
  {prechecked&&!checked&&pending&&!grouped&&<p>这是小智提交时的检查结果。请检查当前版本，再明确核对；不会自动保存。</p>}
  <p>{displayed&&quality?.items.some(q=>q.math?.engine||q.equation?.result?.engine)?'本地计算只检查所列形式化表达式。':'自动数学核验尚未执行。'}请核对计算与题干、条件及参考答案的对应关系；计算或格式符合不代表整题正确。去重范围限于本组及实读原题。</p>
  {displayed&&quality&&<ul className={styles.list} data-testid="question-quality-issues">{quality.items.map((q,i)=><li key={i}>第{i+1}题：{q.issues.length?q.issues.map(issue=>QUESTION_QUALITY_MESSAGES[issue]).join('；'):'需要人工复核'}</li>)}</ul>}
  {displayed&&quality&&<ul data-testid="question-math-receipts">{quality.items.map((q,i)=>q.math&&<li key={i} data-testid="question-math-receipt">第{i+1}题：{mathLabels[q.math.state]}{q.math.stepStates&&<p data-testid="question-math-steps">已检查 {q.math.stepStates.length} 步：{q.math.stepStates.map((s,j)=>`第${j+1}步${{matched:'符合',mismatch:'不符合',unsupported:'超出范围'}[s]}`).join('；')}。只覆盖下列计算。</p>}{q.math.calculation&&<p style={{whiteSpace:'pre-wrap'}}>{q.math.calculation}</p>}{q.math.science&&<ScienceResult science={q.math.science}/>}</li>)}</ul>}
  {displayed&&quality&&<ul data-testid="question-variation-equations">{quality.items.map((q,i)=>q.equation&&<li key={i} data-testid="question-variation-equation" data-state={q.equation.state}>第{i+1}题 · 宿主逐题复算：{{matched:'当前方程与答案符合',mismatch:'当前方程与答案不符，不能保存',answer_unreadable:'请填写可核验的完整解集后重试',not_applicable:'不适用字面方程自动核验，沿用所列工具并人工核对',not_run:'当前版本尚未复算',unsupported:'超出当前求解范围，需人工核对'}[q.equation.state]}{q.equation.result&&<><p>实际实数解集：{q.equation.result.solutionStatus==='finite'?(q.equation.result.solutions.length?q.equation.result.solutions.join('、'):'空集'):q.equation.result.solutionStatus==='non_finite'?'非有限解集':'未确定'}。</p><p>仅覆盖当前完整字面方程及答案，不验证题意翻译、解析每步或难度。</p></>}</li>)}</ul>}
  {!!historyCount&&<small>已保留 {historyCount} 个检查版本，最多 8 个。</small>}
  {pending&&<><div className={styles.qualityActions}><Button variant="secondary" data-testid="question-quality-check" isDisabled={busy} onPress={onCheck}>检查当前版本</Button></div>
   {!grouped&&<div className={styles.reviewed}><Checkbox data-testid="question-quality-reviewed" isSelected={reviewed&&checked} isDisabled={busy||!checked||quality?.state!=='manual_review'} onChange={onReviewed}><Checkbox.Content><Checkbox.Control><Checkbox.Indicator/></Checkbox.Control><span>我已核对本版本的题干、条件、答案、解析及所列计算的对应关系。</span></Checkbox.Content></Checkbox></div>}</>}
 </section>;
}
