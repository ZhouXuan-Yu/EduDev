import {validPaperBlueprint, type PaperBlueprint} from '../../shared/paper-blueprint';
import type {PaperTemplateMapping} from '../../shared/paper-template';
import type {PaperRetainedSection,PaperBasketC2Binding} from '../../shared/paper-basket-c2';
type Member = {entryId: string; sectionId: string};
/** Template sections map onto basket IDs; applying never moves a member. */
export function planPaperTemplateMapping<T extends Member>(previous: PaperBlueprint, template: PaperBlueprint,
  entries: T[], mapping: PaperTemplateMapping[], pinnedPoints: Record<string,number|null> = {}, retained: PaperRetainedSection[] = [],unknown:PaperBasketC2Binding['unknownRetainedSections']=[]) {
  if(!validPaperBlueprint(previous) || !validPaperBlueprint(template)) throw Error('invalid_input');
  const old=new Map([...retained.map(s=>s.section),...previous.sections].map(s=>[s.id,s]));
  const templates=new Map(template.sections.map(s=>[s.id,s]));
  if(mapping.length!==templates.size || new Set(mapping.map(m=>m.templateSectionId)).size!==templates.size
    || mapping.some(m=>!templates.has(m.templateSectionId)) || new Set(mapping.map(m=>m.target.sectionId)).size!==mapping.length)
    throw Error('explicit_mapping_required');
  const entryPoints:Record<string,number|null>={};
  if(new Set(entries.map(e=>e.entryId)).size!==entries.length) throw Error('invalid_input');
  for(const e of entries) {
    const points=Object.hasOwn(pinnedPoints,e.entryId)?pinnedPoints[e.entryId]:old.get(e.sectionId)?.points??null;
    if(points!==null&&(!Number.isSafeInteger(points)||points<1||points>1000)) throw Error('invalid_input'); entryPoints[e.entryId]=points;
  }
  const sections=template.sections.map(section=>{
    const m=mapping.find(m=>m.templateSectionId===section.id)!;
    if((m.target.kind==='existing')!==old.has(m.target.sectionId)) throw Error('explicit_mapping_required');
    if(m.target.kind==='new'&&entries.some(e=>e.sectionId===m.target.sectionId))throw Error('explicit_mapping_required');
    const generatedCount=m.generatedCount??old.get(m.target.sectionId)?.generatedCount;
    if(previous.mode==='hybrid'&&generatedCount===undefined||previous.mode!=='hybrid'&&m.generatedCount!==undefined)throw Error('quota_mapping_required');
    return {...section,id:m.target.sectionId,...(previous.mode==='hybrid'?{generatedCount}:{} )};
  });
  const blueprint={...template,mode:previous.mode,sections};
  if(!validPaperBlueprint(blueprint)) throw Error('invalid_input');
  const used=new Set(sections.map(s=>s.id));
  const retainedSections:PaperRetainedSection[]=[...old.values()].filter(s=>!used.has(s.id)).map(section=>({section:structuredClone(section),
    entryIds:entries.filter(e=>e.sectionId===section.id).map(e=>e.entryId),released:retained.find(s=>s.section.id===section.id)?.released??false}));
  const conflicts=entries.flatMap(e=>{const target=sections.find(s=>s.id===e.sectionId);return target && target.points!==entryPoints[e.entryId]
    ? [{entryId:e.entryId,reason:'points_mismatch' as const,previousPoints:entryPoints[e.entryId],targetPoints:target.points}]:[];});
  const unknownRetainedSections=[...new Set([...unknown.map(r=>r.sectionId),...entries.filter(e=>!old.has(e.sectionId)).map(e=>e.sectionId)])].map(sectionId=>({sectionId,entryIds:entries.filter(e=>e.sectionId===sectionId).map(e=>e.entryId),released:unknown.find(r=>r.sectionId===sectionId)?.released??false}));
  return {blueprint,entries:structuredClone(entries),retainedSections,unknownRetainedSections,entryPoints,conflicts,
    mappingComplete:!retainedSections.some(s=>!s.released)&&!unknownRetainedSections.some(s=>!s.released)&&!conflicts.length};
}
