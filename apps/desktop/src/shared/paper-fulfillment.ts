import {generatedPaperCount,type PaperBlueprint,type PaperSection,type PaperSelection} from './paper-blueprint';
import {emptyPaperDifficultyCounts,PAPER_DIFFICULTIES,paperPlannedDifficulty,paperSectionFit,type PaperDifficultyCounts} from './paper-section-fit';

export type PaperFulfillmentState='satisfied'|'shortage'|'conflict';
type Counts={requiredCount:number;selectedCount:number;requiredPoints:number;selectedPoints:number;originalRequired:number;originalCount:number;generatedRequired:number;generatedCount:number;aiOriginalCount:number;variationCount:number;unclassifiedCount:number};
export type PaperFulfillmentSection=Counts&{sectionId:string;label:string;questionType:string;difficulty?:PaperSection['difficulty'];knowledgePoint?:string;
 scopeMatched:number;typeMatched:number;difficultyMatched:number;knowledgeMatched:number;invalidOriginalCount:number;state:PaperFulfillmentState};
export type PaperFulfillment=Counts&{schemaVersion:'xiaozhi.paper-fulfillment.v1';state:PaperFulfillmentState;sections:PaperFulfillmentSection[];
 unassignedCount:number;difficulty:{planned:PaperDifficultyCounts;selected:PaperDifficultyCounts;basis:'question_count'};
 duration:{minutes:number;basis:'blueprint_target';measured:false};knowledgeBasis:'saved_labels';answerVerified:false};
const empty=():Counts=>({requiredCount:0,selectedCount:0,requiredPoints:0,selectedPoints:0,originalRequired:0,originalCount:0,generatedRequired:0,generatedCount:0,aiOriginalCount:0,variationCount:0,unclassifiedCount:0});
const state=(s:Counts):PaperFulfillmentState=>s.unclassifiedCount||s.selectedCount>s.requiredCount||s.originalCount>s.originalRequired||s.generatedCount>s.generatedRequired?'conflict':s.selectedCount<s.requiredCount||s.originalCount<s.originalRequired||s.generatedCount<s.generatedRequired?'shortage':s.selectedPoints!==s.requiredPoints?'conflict':'satisfied';
/** Derived only from the original validated snapshot, never persisted or used as answer proof. */
export function paperFulfillment(blueprint:PaperBlueprint,selection:PaperSelection):PaperFulfillment{
 const sections:PaperFulfillmentSection[]=blueprint.sections.map(s=>{const generatedRequired=generatedPaperCount(blueprint,s);return{...empty(),sectionId:s.id,label:s.label,questionType:s.questionType,
  ...(s.difficulty?{difficulty:s.difficulty}:{}),...(s.knowledgePoint?{knowledgePoint:s.knowledgePoint}:{}),
  scopeMatched:0,typeMatched:0,difficultyMatched:0,knowledgeMatched:0,invalidOriginalCount:0,requiredCount:s.count,requiredPoints:s.count*s.points,originalRequired:s.count-generatedRequired,generatedRequired,state:'satisfied'};});
 const selectedDifficulty=emptyPaperDifficultyCounts();
 const byId=new Map(sections.map((s,i)=>[s.sectionId,{summary:s,definition:blueprint.sections[i]}]));let unassignedCount=0;
 for(const item of selection.items){
  const difficulty = item.question.difficulty;
  selectedDifficulty[PAPER_DIFFICULTIES.includes(difficulty)?difficulty:'unspecified']++;
  const row=byId.get(item.sectionId);if(!row){unassignedCount++;continue;}const s=row.summary;s.selectedCount++;s.selectedPoints+=item.points;
  const fit=paperSectionFit(item.question,blueprint,row.definition);
  if(fit.scope)s.scopeMatched++;
  if(fit.type)s.typeMatched++;
  if(fit.difficulty)s.difficultyMatched++;
  if(fit.knowledge)s.knowledgeMatched++;
  if(item.question.sourceKind==='generated'){s.generatedCount++;if(item.generation?.generationKind==='ai_original')s.aiOriginalCount++;else if(item.generation?.generationKind==='variation')s.variationCount++;else s.unclassifiedCount++;}
  else if(item.question.sourceKind==='local_bank'||item.question.sourceKind==='teacher_resource'){
   s.originalCount++;
   if(item.generation)s.invalidOriginalCount++;
  }else s.unclassifiedCount++;
 }
 for(const s of sections){
  const definition=byId.get(s.sectionId)!.definition;
  const agrees=[s.scopeMatched,s.typeMatched,s.difficultyMatched,s.knowledgeMatched].every(n=>n===s.selectedCount);
  s.state=!agrees||s.invalidOriginalCount||blueprint.mode==='ai_original'&&s.variationCount||s.selectedPoints!==s.selectedCount*definition.points?'conflict':state(s);
 }
 const total=empty();for(const s of sections)for(const key of Object.keys(total) as (keyof Counts)[])total[key]+=s[key];
 // The teacher's total remains a target. Unknown section items still count as selected facts.
 total.requiredPoints=blueprint.totalPoints;total.selectedCount=selection.items.length;total.selectedPoints=selection.items.reduce((n,i)=>n+i.points,0);
 return{...total,schemaVersion:'xiaozhi.paper-fulfillment.v1',state:unassignedCount||sections.some(s=>s.state==='conflict')?'conflict':sections.some(s=>s.state==='shortage')?'shortage':state(total),sections,unassignedCount,
  difficulty:{planned:paperPlannedDifficulty(blueprint),selected:selectedDifficulty,basis:'question_count'},duration:{minutes:blueprint.durationMinutes,basis:'blueprint_target',measured:false},knowledgeBasis:'saved_labels',answerVerified:false};
}
