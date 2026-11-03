import {PAPER_SNAPSHOT_C2_SCHEMA,type PaperBasketC2Binding,type PaperTemplateSourceBinding} from '../../shared/paper-basket-c2';
import type {PaperBlueprint,PaperSelection,PaperBasketBinding} from '../../shared/paper-blueprint';
import {plainStudentInput} from '../../shared/student-context';
import {validTemplateRef,templateDigest} from '../../shared/paper-template-validation';
import {validBasketC2Binding} from './paper-basket-c2-state';
import {readStoredBasket,canonicalBasketJson} from './paper-basket-state';
import {readTemplateVersion,verifyTemplateVersion} from './paper-template-read';
import type {TemplateMaterials} from './paper-template-source';
import type {PaperSql} from './paper-sql';
export type C2SnapshotExtension={c2:PaperBasketC2Binding;templateSources:PaperTemplateSourceBinding[]};
export async function captureTemplateSources(sql:PaperSql,c2:PaperBasketC2Binding,studentId:string):Promise<PaperTemplateSourceBinding[]> {
  const sources=[];for(const ref of [c2.structureTemplate,c2.layoutTemplate])if(ref){const v=await readTemplateVersion(sql,ref,studentId);
    sources.push({template:structuredClone(ref),candidateDigest:v.candidateDigest,source:structuredClone(v.candidate.source)});}
  return sources;
}
export function validC2SnapshotExtension(value:unknown,blueprint:PaperBlueprint,selection:PaperSelection):value is C2SnapshotExtension {
  if(!plainStudentInput(value,['c2','templateSources'])||!Array.isArray(value.templateSources)||value.templateSources.length>2)return false;
  const entries=selection.items.map((item,index)=>({entryId:item.entryId!,sectionId:item.sectionId,questionId:item.question.id,contentVersion:item.source.version,position:index,question:item.question,instance:item.instance}));
  if(!validBasketC2Binding(value.c2,{blueprint,entries})||value.c2.retainedSections.some(r=>!r.released)||value.c2.unknownRetainedSections?.some(r=>!r.released)
    ||entries.some(e=>(value.c2 as PaperBasketC2Binding).entryPoints[e.entryId]!==blueprint.sections.find(s=>s.id===e.sectionId)?.points))return false;
  const refs=[value.c2.structureTemplate,value.c2.layoutTemplate].filter(Boolean);
  return refs.length===value.templateSources.length&&value.templateSources.every((s,index)=>plainStudentInput(s,['template','candidateDigest','source'])
    &&validTemplateRef(s.template)&&templateDigest(s.candidateDigest)&&canonicalBasketJson(s.template)===canonicalBasketJson(refs[index])&&!!s.source&&typeof s.source==='object');
}
export async function currentC2Snapshot(sql:PaperSql,materials:TemplateMaterials,sessionId:string,studentId:string,binding:PaperBasketBinding,extension:C2SnapshotExtension,signal:AbortSignal) {
  const b=await readStoredBasket(sql,sessionId,binding.basketId,true);
  if(!b.data.c2||b.studentId!==studentId||canonicalBasketJson(b.data.c2)!==canonicalBasketJson(extension.c2))return false;
  const sources=await captureTemplateSources(sql,b.data.c2,studentId);
  if(canonicalBasketJson(sources)!==canonicalBasketJson(extension.templateSources))return false;
  for(const source of sources){const v=await readTemplateVersion(sql,source.template,studentId);await verifyTemplateVersion(sql,materials,v,signal);}
  return true;
}
export const C2_SNAPSHOT_SCHEMA=PAPER_SNAPSHOT_C2_SCHEMA;
