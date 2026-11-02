import {questionContentIdentity} from '../../shared/question-identity';
import {PAPER_COMPARE_SCHEMA,type PaperCompareAmbiguity,type PaperCompareChange,type PaperCompareField,type PaperCompareItem,type PaperCompareItemChange,type PaperCompareItems,type PaperCompareSection,type PaperCompareSections,type PaperCompareSummary,type PaperCompareView,type PaperItem,type PaperSection,type PaperView} from '../../shared/paper-blueprint';

const section=(s:PaperSection):PaperCompareSection=>({id:s.id,label:s.label,questionType:s.questionType,count:s.count,points:s.points,...(s.difficulty!==undefined?{difficulty:s.difficulty}:{}),...(s.knowledgePoint!==undefined?{knowledgePoint:s.knowledgePoint}:{}),...(s.generatedCount!==undefined?{generatedCount:s.generatedCount}:{})});
const summary=(v:PaperView):PaperCompareSummary=>({title:v.blueprint.title,count:v.count,totalPoints:v.totalPoints,durationMinutes:v.blueprint.durationMinutes,mode:v.blueprint.mode,state:v.state,...(v.digest!==undefined?{digest:v.digest}:{})});
const item=(i:PaperItem,identity?:string):PaperCompareItem=>({...(identity!==undefined?{identity}:{}),number:i.number,sectionId:i.sectionId,points:i.points,...(i.question.difficulty!==undefined?{difficulty:i.question.difficulty}:{}),...(i.question.knowledgePoint!==undefined?{knowledgePoint:i.question.knowledgePoint}:{}),...(i.question.sourceKind!==undefined?{sourceKind:i.question.sourceKind}:{}),...(i.generation?.effectDigest!==undefined?{generationEffectDigest:i.generation.effectDigest}:{})});
const differences=(pairs:[string,unknown,unknown][])=>pairs.filter(([,left,right])=>!Object.is(left,right)).map(([field])=>field);

function sectionDiff(left:PaperSection[],right:PaperSection[]):PaperCompareSections{
 const matched=new Map(right.map(s=>[s.id,s])),added:PaperCompareSection[]=[],removed:PaperCompareSection[]=[],kept:PaperCompareSection[]=[],changed:PaperCompareSections['changed']=[];
 for(const s of left){
  const other=matched.get(s.id);if(!other){removed.push(section(s));continue;}
  const fields=differences([['label',s.label,other.label],['questionType',s.questionType,other.questionType],['count',s.count,other.count],['points',s.points,other.points],['difficulty',s.difficulty,other.difficulty],['knowledgePoint',s.knowledgePoint,other.knowledgePoint],['generatedCount',s.generatedCount,other.generatedCount]]);
  if(fields.length)changed.push({id:s.id,left:section(s),right:section(other),fields});else kept.push(section(s));
 }
 const present=new Set(left.map(s=>s.id));for(const s of right)if(!present.has(s.id))added.push(section(s));
 return{added,removed,kept,changed};
}

function itemDiff(left:PaperView,right:PaperView):PaperCompareItems{
 const collect=(view:PaperView)=>{const groups=new Map<string,PaperItem[]>(),unsupported:PaperItem[]=[];for(const entry of view.selection.items){const identity=questionContentIdentity(entry.question);if(identity.status!=='available'){unsupported.push(entry);continue;}const group=groups.get(identity.key);if(group)group.push(entry);else groups.set(identity.key,[entry]);}return{groups,unsupported};};
 const leftSide=collect(left),rightSide=collect(right),ambiguous:PaperCompareAmbiguity[]=[],added:PaperCompareItem[]=[],removed:PaperCompareItem[]=[],kept:PaperCompareItem[]=[],changed:PaperCompareItemChange[]=[];
 const duplicate=new Set<string>();for(const [key,group] of leftSide.groups)if(group.length>1)duplicate.add(key);for(const [key,group] of rightSide.groups)if(group.length>1)duplicate.add(key);
 const flagged=new Set<string>(),flag=(key:string)=>{if(flagged.has(key))return;flagged.add(key);ambiguous.push({identity:key,reason:'duplicate_identity',left:(leftSide.groups.get(key)??[]).map(entry=>item(entry,key)),right:(rightSide.groups.get(key)??[]).map(entry=>item(entry,key))});};
 for(const key of leftSide.groups.keys())if(duplicate.has(key))flag(key);for(const key of rightSide.groups.keys())if(duplicate.has(key))flag(key);
 for(const [key,group] of leftSide.groups){
  if(duplicate.has(key))continue;
  const other=rightSide.groups.get(key),leftEntry=item(group[0],key);
  if(!other){removed.push(leftEntry);continue;}
  const rightEntry=item(other[0],key),changes:PaperCompareChange[]=[];
  const change=(field:PaperCompareField,a:unknown,b:unknown)=>{if(!Object.is(a,b))changes.push({field,left:a as string|number|undefined,right:b as string|number|undefined});};
  change('number',group[0].number,other[0].number);change('sectionId',group[0].sectionId,other[0].sectionId);change('points',group[0].points,other[0].points);
  change('difficulty',group[0].question.difficulty,other[0].question.difficulty);change('knowledgePoint',group[0].question.knowledgePoint,other[0].question.knowledgePoint);
  change('sourceKind',group[0].question.sourceKind,other[0].question.sourceKind);change('generation.effectDigest',group[0].generation?.effectDigest,other[0].generation?.effectDigest);
  change('instance.contentDigest',group[0].instance?.contentDigest,other[0].instance?.contentDigest);
  change('instance.answer',group[0].instance?JSON.stringify(group[0].instance.content.answer):undefined,other[0].instance?JSON.stringify(other[0].instance.content.answer):undefined);
  change('instance.review',group[0].instance?.review?.eventId,other[0].instance?.review?.eventId);
  if(changes.length)changed.push({identity:key,left:leftEntry,right:rightEntry,changes});else kept.push(leftEntry);
 }
 for(const [key,group] of rightSide.groups)if(!duplicate.has(key)&&!leftSide.groups.has(key))added.push(item(group[0],key));
 if(leftSide.unsupported.length||rightSide.unsupported.length)ambiguous.push({reason:'unsupported_identity',left:leftSide.unsupported.map(entry=>item(entry)),right:rightSide.unsupported.map(entry=>item(entry))});
 return{added,removed,kept,changed,ambiguous};
}

/** Read-only diff of two saved paper snapshots. Matching uses questionContentIdentity only; duplicates are flagged, never guessed. */
export function comparePaperViews(left:PaperView,right:PaperView):PaperCompareView{
 const items=itemDiff(left,right);
 return{schemaVersion:PAPER_COMPARE_SCHEMA,left:summary(left),right:summary(right),sections:sectionDiff(left.blueprint.sections,right.blueprint.sections),items,ambiguous:items.ambiguous.length>0,writes:false,answerVerified:false};
}
