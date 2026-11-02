import {generatedPaperCount,type PaperBlueprint,type PaperSelection} from './paper-blueprint';

export type PaperFulfillmentState='satisfied'|'shortage'|'conflict';
type Counts={requiredCount:number;selectedCount:number;requiredPoints:number;selectedPoints:number;originalRequired:number;originalCount:number;generatedRequired:number;generatedCount:number;aiOriginalCount:number;variationCount:number;unclassifiedCount:number};
export type PaperFulfillmentSection=Counts&{sectionId:string;label:string;knowledgePoint?:string;knowledgeMatched:number;state:PaperFulfillmentState};
export type PaperFulfillment=Counts&{schemaVersion:'xiaozhi.paper-fulfillment.v1';state:PaperFulfillmentState;sections:PaperFulfillmentSection[];unassignedCount:number;duration:{minutes:number;basis:'blueprint_target';measured:false};knowledgeBasis:'saved_labels';answerVerified:false};
const empty=():Counts=>({requiredCount:0,selectedCount:0,requiredPoints:0,selectedPoints:0,originalRequired:0,originalCount:0,generatedRequired:0,generatedCount:0,aiOriginalCount:0,variationCount:0,unclassifiedCount:0});
const state=(s:Counts):PaperFulfillmentState=>s.unclassifiedCount||s.selectedCount>s.requiredCount||s.originalCount>s.originalRequired||s.generatedCount>s.generatedRequired?'conflict':s.selectedCount<s.requiredCount||s.originalCount<s.originalRequired||s.generatedCount<s.generatedRequired?'shortage':s.selectedPoints!==s.requiredPoints?'conflict':'satisfied';
/** Derived only from the original validated snapshot, never persisted or used as answer proof. */
export function paperFulfillment(blueprint:PaperBlueprint,selection:PaperSelection):PaperFulfillment{
 const sections:PaperFulfillmentSection[]=blueprint.sections.map(s=>{const generatedRequired=generatedPaperCount(blueprint,s);return{...empty(),sectionId:s.id,label:s.label,...(s.knowledgePoint?{knowledgePoint:s.knowledgePoint}:{}),knowledgeMatched:0,requiredCount:s.count,requiredPoints:s.count*s.points,originalRequired:s.count-generatedRequired,generatedRequired,state:'satisfied'};});
 const byId=new Map(sections.map((s,i)=>[s.sectionId,{summary:s,definition:blueprint.sections[i]}]));let unassignedCount=0;
 for(const item of selection.items){const row=byId.get(item.sectionId);if(!row){unassignedCount++;continue;}const s=row.summary;s.selectedCount++;s.selectedPoints+=item.points;
  if(!row.definition.knowledgePoint||item.question.knowledgePoint.includes(row.definition.knowledgePoint))s.knowledgeMatched++;
  if(item.question.sourceKind==='generated'){s.generatedCount++;if(item.generation?.generationKind==='ai_original')s.aiOriginalCount++;else if(item.generation?.generationKind==='variation')s.variationCount++;else s.unclassifiedCount++;}
  else if(item.question.sourceKind==='local_bank'||item.question.sourceKind==='teacher_resource')s.originalCount++;else s.unclassifiedCount++;
 }
 for(const s of sections){s.state=state(s);const definition=byId.get(s.sectionId)!.definition;if(s.selectedPoints!==s.selectedCount*definition.points||s.knowledgeMatched!==s.selectedCount)s.state='conflict';}
 const total=empty();for(const s of sections)for(const key of Object.keys(total) as (keyof Counts)[])total[key]+=s[key];
 // The teacher's total remains a target. Unknown section items still count as selected facts.
 total.requiredPoints=blueprint.totalPoints;total.selectedCount=selection.items.length;total.selectedPoints=selection.items.reduce((n,i)=>n+i.points,0);
 return{...total,schemaVersion:'xiaozhi.paper-fulfillment.v1',state:unassignedCount||sections.some(s=>s.state==='conflict')?'conflict':sections.some(s=>s.state==='shortage')?'shortage':state(total),sections,unassignedCount,duration:{minutes:blueprint.durationMinutes,basis:'blueprint_target',measured:false},knowledgeBasis:'saved_labels',answerVerified:false};
}
