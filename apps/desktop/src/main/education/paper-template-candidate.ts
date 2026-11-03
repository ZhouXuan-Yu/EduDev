import {validPaperBlueprint, type PaperBlueprint} from '../../shared/paper-blueprint';
import {PAPER_LAYOUT_SCHEMA, parsePaperLayout} from '../../shared/paper-layout';
import {unknownReferenceField, type PaperReferenceCandidate, type ReferenceField} from '../../shared/paper-reference';
import type {PaperTemplatePatch} from '../../shared/paper-template';

export function patchTemplateCandidate(source: PaperReferenceCandidate, patches: PaperTemplatePatch[]) {
  const next = structuredClone(source);
  for(const patch of patches) {
    const parts=patch.path.split('.');
    if(parts[0]==='sections') {
      const index=Number(parts[1]);
      if(index>next.sections.length || index>=20) throw Error('invalid_input');
      if(index===next.sections.length) next.sections.push({id:'teacher_'+index,label:unknownReferenceField(),questionType:unknownReferenceField(),count:unknownReferenceField(),points:unknownReferenceField(),difficulty:unknownReferenceField(),knowledgePoint:unknownReferenceField()});
    }
    let parent: Record<string, unknown> = next as unknown as Record<string, unknown>;
    for(const part of parts.slice(0,-1)) parent=parent[part] as Record<string,unknown>;
    const field=parent?.[parts.at(-1)!] as ReferenceField | undefined;
    if(!field || typeof field.confirmed!=='boolean') throw Error('invalid_input');
    field.teacherValue=patch.teacherValue; field.confirmed=patch.confirmed;
  }
  return next;
}
function value(field: ReferenceField, optional=false) {
  const v=(field.teacherValue ?? field.value ?? '').trim();
  if(!v && optional) return '';
  if(!v || !field.confirmed || field.teacherValue===undefined && field.status!=='known') throw Error('fields_unconfirmed');
  return v;
}
function integer(field: ReferenceField) {const v=value(field); if(!/^\d+$/.test(v)) throw Error('invalid_input'); return Number(v);}
export function templateStructure(candidate: PaperReferenceCandidate): PaperBlueprint {
  const blueprint = {title:value(candidate.title),subject:value(candidate.subject),grade:value(candidate.grade),durationMinutes:integer(candidate.durationMinutes),
    totalPoints:integer(candidate.totalPoints),mode:'source_only' as const,sections:candidate.sections.map((s,index)=>({id:'template_'+index,
      label:value(s.label),questionType:value(s.questionType),count:integer(s.count),points:integer(s.points),
      ...(value(s.difficulty,true)?{difficulty:value(s.difficulty) as 'easy'|'medium'|'hard'}:{}),
      ...(value(s.knowledgePoint,true)?{knowledgePoint:value(s.knowledgePoint)}:{})}))};
  if(!validPaperBlueprint(blueprint)) throw Error('invalid_input'); return blueprint;
}
export function templateLayout(candidate: PaperReferenceCandidate) {
  const l=candidate.layout;
  // Reference extraction uses twips. Conversion is explicit to the shared integer 0.1mm contract.
  const length=(f:ReferenceField)=>Math.round(integer(f)*254/1440);
  return parsePaperLayout({schemaVersion:PAPER_LAYOUT_SCHEMA,paper:value(l.paper),orientation:value(l.orientation),columns:integer(l.columns),
    margins:{top:length(l.top),right:length(l.right),bottom:length(l.bottom),left:length(l.left)},columnGap:length(l.columnGap)});
}
