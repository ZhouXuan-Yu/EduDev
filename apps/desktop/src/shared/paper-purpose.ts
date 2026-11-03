import {plainStudentInput} from './student-context';
import type {PaperBlueprint} from './paper-blueprint';
import type {PaperFulfillmentPlan} from './paper-fulfillment-plan';

export type PaperPurpose='practice'|'paper';
export type PaperPracticeSetup={title:string;subject:string;grade:string};
export type PaperRequirements='required'|'provided';
export const validPaperPurpose=(value:unknown):value is PaperPurpose=>value==='practice'||value==='paper';
/** Historical paper plans remain visible but do not impose examination quotas on practice. */
export const purposeFulfillmentBlocksConfirmation=(purpose:PaperPurpose|undefined,plan:PaperFulfillmentPlan|undefined)=>purpose!=='practice'&&(plan?.status==='confirmed'||plan?.status==='fulfilled'&&!!plan.report?.shortages.length);
export function validPracticeSetup(value:unknown):value is PaperPracticeSetup {
  return plainStudentInput(value,['title','subject','grade'])&&['title','subject','grade'].every(key=>{
    const text=value[key];return typeof text==='string'&&text.trim().length>0&&text.length<=(key==='title'?160:128)&&!/[\x00-\x1f]/.test(text);
  });
}
/** Host-owned practice defaults, not teacher-supplied examination requirements. */
export function practiceBlueprint(setup:PaperPracticeSetup):PaperBlueprint {
  return {...setup,durationMinutes:30,mode:'source_only',totalPoints:5,
    sections:['选择题','填空题','解答题','简答题','判断题'].map((questionType,index)=>({id:'practice_'+index,label:questionType,questionType,count:1,points:1}))};
}

/** Derive only the selected practice members; never fill the old examination quotas. */
export function practiceSnapshotBlueprint(blueprint:PaperBlueprint,entries:{sectionId:string;question:{sourceKind:string}}[]):PaperBlueprint {
  const sections=blueprint.sections.flatMap(section=>{
    const members=entries.filter(entry=>entry.sectionId===section.id);
    return members.length?[{...section,count:members.length,...(blueprint.mode==='hybrid'?{generatedCount:members.filter(e=>e.question.sourceKind==='generated').length}:{})}]:[];
  });
  return {...blueprint,sections,totalPoints:sections.reduce((sum,s)=>sum+s.count*s.points,0)};
}
