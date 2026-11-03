import type {TrainingPlan} from './training-plan';
import {practiceCoverage,PRACTICE_RESULT_V2_SCHEMA,type PracticeOutcome,type SavedPracticeResult} from './practice-result';

export type TrainingProgressResult={recordId:string;planVersion:number;day:number;result:PracticeOutcome;occurredAt:string;practice?:SavedPracticeResult};
export type TrainingProgress={recorded:number;answered:number;unansweredDays:number[];total:number;nextDay:number|null;reviewDays:number[];days:{day:number;result:TrainingProgressResult['result']|null;recordId?:string;occurredAt?:string;coverage?:ReturnType<typeof practiceCoverage>}[]};

/** Record coverage only. No completion or mastery is inferred from a scheduled task. */
export function trainingProgress(plan:TrainingPlan,version:number,results:readonly TrainingProgressResult[]):TrainingProgress{
 const latest=new Map<number,TrainingProgressResult>();
 for(const result of results){
  if(result.planVersion!==version||!Number.isFinite(Date.parse(result.occurredAt)))continue;
  const before=latest.get(result.day);
  if(!before||result.occurredAt>before.occurredAt||result.occurredAt===before.occurredAt&&result.recordId>before.recordId)latest.set(result.day,result);
 }
 const days=plan.days.filter(day=>day.activity!=='rest').map(day=>{
  const result=latest.get(day.day);
  return{day:day.day,result:result?.result??null,...(result?{recordId:result.recordId,occurredAt:result.occurredAt,...(result.practice?.schemaVersion===PRACTICE_RESULT_V2_SCHEMA?{coverage:practiceCoverage(result.practice.answers)}:{})}:{})};
 });
 const pending=(day:typeof days[number])=>day.result==='unanswered'||Boolean(day.coverage?.unanswered);
 return{recorded:days.filter(day=>day.result!==null).length,answered:days.filter(day=>day.result!==null&&day.result!=='unanswered').length,unansweredDays:days.filter(pending).map(day=>day.day),total:days.length,nextDay:days.find(day=>day.result===null||pending(day))?.day??null,reviewDays:days.filter(day=>day.result==='incorrect'||day.result==='partial').map(day=>day.day),days};
}

export const TRAINING_TUTOR_MODES={hint:'逐步提示',explain:'详细讲解',reflect:'错因复盘',transfer:'举一反三'} as const;
export type TrainingTutorMode=keyof typeof TRAINING_TUTOR_MODES;
/** Only host-confirmed numeric plan coordinates enter this draft; saved observations stay in authorized tools. */
export function trainingTutorDraft(version:number,day:number,mode:TrainingTutorMode){
 const instructions={hint:'先给一个适合学生年级的小提示和一个检查理解的问题，等待实际回答，再逐步推进。不要一次给出完整答案。',explain:'结合学生年级、实际知识点与适用前提分步讲解，区分已知事实、证据与补充示例；缺少原题或图形时明确提出需要补充的内容。',reflect:'只根据实际保存的作答和教师观察讨论可能的错因，区分观察与推断；没有本次真实作答时先询问，不凭空诊断。',transfer:'结合当前知识点给出一个适龄的迁移思路或小例子，说明与原知识点的联系；若需要新题库题目或练习集，沿已有题目生成与教师核对流程处理，不宣称已验证正确或已保存。'};
 return `请继续当前学生教师已确认的计划版本 ${version} 第 ${day} 天，采用“${TRAINING_TUTOR_MODES[mode]}”。先实际调用学习分析工具，核对最新计划版本、当天安排与真实学习证据；如果版本已变化或当天不是训练项，请说明并等待教师重新选择。来源或策略已有变化时明确提醒，并优先解释真实新结果，不静默把旧安排说成最新建议。\n${instructions[mode]}\n不把安排、对话或模型推断记为完成、成绩或掌握；本次结果由教师另行记录。调整学习计划仍须走现有教师核对流程。`;
}

/** Notes and answers remain in the authorized tool; only an opaque source coordinate enters the draft. */
export function trainingResultTutorDraft(result:{tutorReference:string;planVersion:number;day:number},mode:'reflect'|'explain'){
 const action=mode==='reflect'?'错因复盘':'详细讲解';
 return `请围绕我选中的这次作答（作答引用 ${result.tutorReference}，计划版本 ${result.planVersion} 第 ${result.day} 天）做“${action}”。先实际调用学习分析工具，使用这条作答引用准确读取对应结果、实际答案与教师观察，不要用同一天的其他作答替代。引用不存在或记录已变化时请说明并等待刷新，不猜测内容。\n只根据该次真实证据开展${action}，区分教师观察与推断。缺少题面、实际答案或图形时先说明缺口，不凭空补出学生回答或诊断。按学生年级核对所用知识的成立条件，不把观察当作数学正确性的证明。仅计划版本不同时标为历史作答；新增证据不等于计划已更换，缺少独立掌握评估不等于已保存观察不真实。\n辅导不自动改成绩、掌握状态或学习事实；本次新结果由教师另行记录。`;
}
