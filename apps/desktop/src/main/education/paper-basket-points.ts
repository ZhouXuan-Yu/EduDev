import {randomUUID} from 'node:crypto';
import {validPaperBlueprint} from '../../shared/paper-blueprint';
import type {StoredBasket} from './paper-basket-state';

/** Split a filled section around one changed score, preserving exact member order and quotas. */
export function setBasketEntryPoints(basket:StoredBasket,entryId:string,points:number){
 const entry=basket.data.entries.find(e=>e.entryId===entryId),blueprint=basket.data.blueprint;
 const section=blueprint.sections.find(s=>s.id===entry?.sectionId);
 if(!entry||!section)throw Error('conflict');
 if(section.points===points)return;
 const siblings=basket.data.entries.filter(e=>e.sectionId===section.id),index=siblings.findIndex(e=>e.entryId===entryId);
 const practice=basket.data.purpose==='practice';
 if(!practice&&siblings.length!==section.count)throw Error('shortage');
 if(!practice&&blueprint.mode==='hybrid'&&siblings.filter(e=>e.question.sourceKind==='generated').length!==section.generatedCount)throw Error('shortage');
 const groups=[siblings.slice(0,index),[entry],siblings.slice(index+1)].filter(g=>g.length);
 const sections=groups.map((group,i)=>{
  const id=i===0?section.id:'score_'+randomUUID().slice(0,8);
  for(const item of group)item.sectionId=id;
  return {...section,id,count:group.length,points:group[0]===entry?points:section.points,
   ...(blueprint.mode==='hybrid'?{generatedCount:group.filter(e=>e.question.sourceKind==='generated').length}:{})};
 });
 const at=blueprint.sections.indexOf(section);
 const nextSections=[...blueprint.sections.slice(0,at),...sections,...blueprint.sections.slice(at+1)];
 const next={...blueprint,totalPoints:practice?nextSections.reduce((sum,s)=>sum+s.count*s.points,0):blueprint.totalPoints+points-section.points,sections:nextSections};
 if(!validPaperBlueprint(next))throw Error('invalid_input');
 basket.data.blueprint=next;
 const positions=new Map<string,number>();for(const item of basket.data.entries){item.position=positions.get(item.sectionId)||0;positions.set(item.sectionId,item.position+1);}
}
