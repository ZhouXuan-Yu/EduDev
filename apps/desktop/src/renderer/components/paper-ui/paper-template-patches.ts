import type {PaperReferenceCandidate,ReferenceField} from '../../../shared/paper-reference';
import type {PaperTemplatePatch} from '../../../shared/paper-template';
export function paperTemplatePatches(candidate:PaperReferenceCandidate):PaperTemplatePatch[] {
  const patches:PaperTemplatePatch[]=[];
  const add=(path:string,f:ReferenceField)=>patches.push({path,teacherValue:f.teacherValue??f.value??'',confirmed:f.confirmed});
  for(const key of ['title','subject','grade','durationMinutes','totalPoints'] as const)add(key,candidate[key]);
  candidate.sections.forEach((s,index)=>{for(const key of ['label','questionType','count','points','difficulty','knowledgePoint'] as const)add(`sections.${index}.${key}`,s[key]);});
  for(const key of ['paper','orientation','columns','top','right','bottom','left','columnGap'] as const)add('layout.'+key,candidate.layout[key]);
  return patches;
}
