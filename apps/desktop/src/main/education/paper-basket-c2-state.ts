import {PAPER_BASKET_C2_SCHEMA,type PaperBasketC2Binding} from '../../shared/paper-basket-c2';
import {validPaperBlueprint} from '../../shared/paper-blueprint';
import {validPaperLayout} from '../../shared/paper-layout';
import {validTemplateRef} from '../../shared/paper-template-validation';
import {plainStudentInput} from '../../shared/student-context';
import type {BasketData,StoredBasket} from './paper-basket-state';
import {templateHash} from './paper-template-repository';
export function validBasketC2Binding(value:unknown,data:Pick<BasketData,'entries'|'blueprint'>):value is PaperBasketC2Binding {
  if(!plainStudentInput(value,['entryPoints','retainedSections','unknownRetainedSections','structureTemplate','layoutTemplate','layout'])
    || !value.entryPoints || typeof value.entryPoints!=='object' || Array.isArray(value.entryPoints)
    || !Array.isArray(value.retainedSections)||value.retainedSections.length>40
    || value.structureTemplate!==undefined&&!validTemplateRef(value.structureTemplate)
    || value.layoutTemplate!==undefined&&!validTemplateRef(value.layoutTemplate)
    || (value.layout===undefined)!==(value.layoutTemplate===undefined) || value.layout!==undefined&&!validPaperLayout(value.layout))return false;
  const points=value.entryPoints as Record<string,unknown>;
  if(Object.keys(points).length!==data.entries.length || data.entries.some(e=>points[e.entryId]!==null&&(!Number.isSafeInteger(points[e.entryId])||Number(points[e.entryId])<1||Number(points[e.entryId])>1000)))return false;
  const ids=new Set(data.blueprint.sections.map(s=>s.id));
  for(const r of value.retainedSections){
    if(!plainStudentInput(r,['section','entryIds','released']) || typeof r.released!=='boolean' || !Array.isArray(r.entryIds)
      || !r.section || typeof r.section!=='object')return false;
    const section=r.section as BasketData['blueprint']['sections'][number];
    if(!validPaperBlueprint({...data.blueprint,sections:[section],totalPoints:section.count*section.points})||ids.has(section.id))return false;
    ids.add(section.id);
    const members=data.entries.filter(e=>e.sectionId===section.id).map(e=>e.entryId);
    if(r.released&&members.length||JSON.stringify(r.entryIds)!==JSON.stringify(members))return false;
  }
  if(value.unknownRetainedSections!==undefined){if(!Array.isArray(value.unknownRetainedSections)||value.unknownRetainedSections.length>100)return false;
    for(const r of value.unknownRetainedSections){if(!plainStudentInput(r,['sectionId','entryIds','released'])||typeof r.released!=='boolean'||r.released&&data.entries.some(e=>e.sectionId===r.sectionId)||typeof r.sectionId!=='string'||!/^[a-zA-Z0-9_-]{1,40}$/.test(r.sectionId)||ids.has(r.sectionId)
      ||JSON.stringify(r.entryIds)!==JSON.stringify(data.entries.filter(e=>e.sectionId===r.sectionId).map(e=>e.entryId)))return false;ids.add(r.sectionId);}}
  return data.entries.every(e=>ids.has(e.sectionId));
}
export function syncBasketC2(b:StoredBasket) {
  const c=b.data.c2;if(!c)return;
  c.entryPoints=Object.fromEntries(b.data.entries.map(e=>[e.entryId,Object.hasOwn(c.entryPoints,e.entryId)?c.entryPoints[e.entryId]:b.data.blueprint.sections.find(s=>s.id===e.sectionId)?.points??null]));
  for(const r of c.retainedSections)r.entryIds=b.data.entries.filter(e=>e.sectionId===r.section.id).map(e=>e.entryId);
  c.unknownRetainedSections=(c.unknownRetainedSections||[]).map(r=>({...r,entryIds:b.data.entries.filter(e=>e.sectionId===r.sectionId).map(e=>e.entryId)}));
  if(!validBasketC2Binding(c,b.data))throw Error('invalid_input');
  b.schemaVersion=PAPER_BASKET_C2_SCHEMA;
}
export function basketC2Conflicts(data:BasketData) {
  return data.entries.flatMap(e=>{const section=data.blueprint.sections.find(s=>s.id===e.sectionId),points=data.c2?.entryPoints[e.entryId];
    return section&&points!==undefined&&points!==section.points?[{entryId:e.entryId,previousPoints:points,targetPoints:section.points}]:[];});
}
export function basketC2Digest(data:BasketData) {return templateHash({schemaVersion:PAPER_BASKET_C2_SCHEMA,blueprint:data.blueprint,entries:data.entries,c2:data.c2,...(data.purpose?{purpose:data.purpose}:{}),...(data.paperRequirements?{paperRequirements:data.paperRequirements}:{}),...(data.fulfillment?{fulfillment:data.fulfillment}:{})});}
export function assertC2SnapshotReady(b:StoredBasket) {
  if(!b.data.c2)return;
  if(b.data.c2.retainedSections.some(s=>!s.released)||b.data.c2.unknownRetainedSections?.some(s=>!s.released)||basketC2Conflicts(b.data).length)throw Error('conflict');
}
