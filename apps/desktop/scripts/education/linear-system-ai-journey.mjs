import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {reviewQuestionQuality} from './review-question-quality.mjs';
import {settleWorkspaceTransitions} from '../xiaozhi-agent/capture-workspace-metrics.mjs';

/** One controlled real Pi repair and teacher approval, using the previous missing-voltage error. */
export async function linearSystemAiJourney(c){
 const {data,output,report,until,check}=c;
 const facts=()=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return{questions:db.prepare('SELECT * FROM question_bank_items ORDER BY id').all(),reviews:db.prepare("SELECT * FROM ai_confirmation_items WHERE action_type='pi_question_candidate' ORDER BY created_at,id").all()};}finally{db.close();}};
 const p=r=>JSON.parse(r.payload_json),effect=r=>JSON.parse(r.result_json),n=v=>({numerator:String(v),denominator:'1'});
 const firstStem='R1单独接入电源时电流为2 A；R1和R2串联时电流为0.5 A。(1)求R1；(2)求R2。';
 const fixedStem='电源电压为220 V。'+firstStem,answer='(1)R1=110 Ω；(2)R2=330 Ω。';
 const model={kind:'linear_system',variables:['U','R1','R2'],equations:[{coefficients:[n(1),n(-2),n(0)],constant:n(0),sourceText:'R1单独接入电源时电流为2 A'},{coefficients:[n(2),n(-1),n(-1)],constant:n(0),sourceText:'R1和R2串联时电流为0.5 A'}],targets:[{variable:'R1',expected:n(110),answerText:'R1=110 Ω'},{variable:'R2',expected:n(330),answerText:'R2=330 Ω'}]};
 const repaired={...model,equations:[...model.equations,{coefficients:[n(1),n(0),n(0)],constant:n(220),sourceText:'电源电压为220 V'}]};
 report.boundaries=['Controlled actual previous missing-voltage circuit → real DeepSeek/Pi formal model → local SymPy quarantine → same-run repair → existing teacher UI → cold SQLite/native readback','Teacher supplied exact formalization for reproducibility; not autonomous condition extraction or full F2/all-subject reliability. conditionsVerified=false. No ordinary user data or original files changed'];
 await c.launch();assert.equal(facts().questions.length,0);
 const input=c.page().getByTestId('office-prompt-input');
 await input.fill(`请做一次受控的审题和修复验收，使用education_propose_questions，generationKind=ai_original、sourceReferences=[]，物理、初三、串联电路，title为“电路条件审查”，reason为“核对遗漏的电源电压”，questionType=written，options=null，difficulty=hard。首次题干严格为“${firstStem}”，答案严格为“${answer}”，解析按(1)、(2)填写，首次不要补电压；提交mathChecks=${JSON.stringify([model])}，用于检验仅两个电流不能确定两个电阻。必须先提交这份初稿。收到quality_blocked和线性条件不足反馈后，在同一个run中带repairReference修复，题干严格改为“${fixedStem}”，答案仍为“${answer}”，解析(1)U=I1R1得到R1=220/2=110 Ω；(2)总电阻220/0.5=440 Ω，R2=440−110=330 Ω，mathChecks=${JSON.stringify([repaired])}。添加220 V是本次教师明确指定的修复条件，不可猜补其他数据。保留原变量和目标顺序，等待教师确认，不生成练习或文件，不自行保存。`);
 await input.press('Enter');assert.equal(await input.inputValue(),'');
 await until(()=>facts().reviews.some(r=>p(r).repair?.parent&&effect(r).qualityHistory?.length),180000);
 const failed=facts().reviews.find(r=>!p(r).repair?.parent),fixed=facts().reviews.find(r=>p(r).repair?.parent?.id===failed?.id);assert(failed&&fixed);
 assert.equal(failed.run_id,fixed.run_id);assert.equal(effect(failed).qualityHistory[0].quality.items[0].math.state,'mismatch');assert.match(effect(failed).qualityHistory[0].quality.items[0].math.calculation,/不足以唯一确定/);assert.equal(effect(fixed).qualityHistory[0].quality.items[0].math.state,'matched');assert.equal(facts().questions.length,0);
 check('Actual Pi receives insufficient-condition failure, keeps targets and repairs same run with teacher-authorized voltage; no preapproval facts');
 const card=c.page().locator(`[data-testid="pi-question-review"][data-review-id="${fixed.id}"]`);await card.getByTestId('question-review-stem').waitFor();await reviewQuestionQuality(card);await card.getByTestId('question-math-receipts').last().getByText('所列线性条件能确定目标值',{exact:false}).waitFor();
 for(const[theme,width,height]of[['light',1366,768],['dark',1920,1080]]){await c.page().emulateMedia({colorScheme:theme});await c.page().setViewportSize({width,height});await settleWorkspaceTransitions(c.page(),{hiddenSnapshot:true});await card.getByTestId('question-math-receipts').last().scrollIntoViewIfNeeded();await c.neutralCapture();const png=`linear-${theme}-${width}x${height}.png`;await c.page().screenshot({path:path.join(output,png),animations:'disabled'});report.visuals.push({png,theme,width,height});assert(await c.page().evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await card.getByTestId('question-review-confirm').click();await until(()=>facts().reviews.find(r=>r.id===fixed.id).status==='confirmed');await until(async()=>!(await c.snapshot()).running,180000);assert.equal(facts().questions.length,1);assert.equal(facts().questions[0].stem,fixedStem);assert.equal(facts().reviews.find(r=>r.id===failed.id).status,'pending');assert.equal(effect(facts().reviews.find(r=>r.id===fixed.id)).quality.items[0].math.conditionsVerified,false);
 check('Teacher sees exact condition equations and approves one corrected fact; insufficient predecessor stays isolated');
 const before=facts(),session=c.session(),entries=c.native().entries;await c.restart();assert.equal(c.session(),session);assert.deepEqual(facts(),before);assert.deepEqual(c.native().entries,entries);assert((await c.snapshot()).questionReviews.some(r=>r.id===fixed.id&&r.state==='confirmed'));
 check('Cold current Electron restores v2 formal plan and unchanged legacy quality receipt without replay');report.result={failedId:failed.id,fixedId:fixed.id,readback:before};
}
