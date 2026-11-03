import type {QuestionBankItem} from '../../shared/contracts';
import {purposeFulfillmentBlocksConfirmation} from '../../shared/paper-purpose';
import {randomUUID,createHash} from 'node:crypto';
import type {PaperBlueprint,PaperGeneration,PaperSelection} from '../../shared/paper-blueprint';
import {generatedPaperCount} from '../../shared/paper-blueprint';
import type {PaperFulfillmentOperation,PaperFulfillmentPlan,PaperFulfillmentIssue} from '../../shared/paper-fulfillment-plan';
import {questionSelectionIdentity} from '../../shared/question-selection-identity';
import {canonicalBasketJson,type StoredBasket} from './paper-basket-state';
import {basketGenerations,basketEntryAvailability} from './paper-basket-source';
import {selectPaper,paperShortages} from './paper-selection';
import {newPaperInstance} from './paper-instance';
import {questionVersion} from './question-context-provider';
import type {PaperSql,PaperStoreHost} from './paper-sql';

const hash=(value:unknown)=>createHash('sha256').update(canonicalBasketJson(value)).digest('hex');
const lease=(current:()=>boolean)=>{if(!current())throw Error('cancelled');};
function membersDigest(b:StoredBasket){return hash({entries:b.data.entries,blueprint:b.data.blueprint,purpose:b.data.purpose??'paper',requirements:b.data.paperRequirements??'provided',c2:b.data.c2??null});}
function planDigest(b:StoredBasket,plan:Pick<PaperFulfillmentPlan,'planId'|'blueprint'|'revision'|'membersDigest'>){return hash({sessionId:b.sessionId,basketId:b.id,...plan});}
const proof=(p:PaperFulfillmentPlan)=>({planId:p.planId,blueprint:p.blueprint,revision:p.revision,membersDigest:p.membersDigest});

/** Validate the immutable members against proposed quotas; never delete or reassign them. */
export async function fulfillmentIssues(sql:PaperSql,host:PaperStoreHost,b:StoredBasket,blueprint:PaperBlueprint,current:()=>boolean):Promise<PaperFulfillmentIssue[]> {
  const issues:PaperFulfillmentIssue[]=[],generations=await basketGenerations(host,sql,b.sessionId,blueprint);
  for(const entry of b.data.entries){
    lease(current);const section=blueprint.sections.find(s=>s.id===entry.sectionId);
    if(!section){issues.push({kind:'orphan',entryId:entry.entryId,sectionId:entry.sectionId});continue;}
    const points=b.data.c2?.entryPoints[entry.entryId]??b.data.blueprint.sections.find(s=>s.id===entry.sectionId)?.points;
    if(points!==section.points)issues.push({kind:'points_conflict',entryId:entry.entryId,sectionId:entry.sectionId});
    if(!(await basketEntryAvailability(sql,entry,blueprint,generations)).available)issues.push({kind:'member_unavailable',entryId:entry.entryId,sectionId:entry.sectionId});
  }
  for(const section of blueprint.sections){
    const members=b.data.entries.filter(e=>e.sectionId===section.id),generated=members.filter(e=>e.question.sourceKind==='generated').length,quota=generatedPaperCount(blueprint,section);
    if(generated>quota||members.length-generated>section.count-quota)issues.push({kind:'over_quota',sectionId:section.id});
  }
  if(b.data.c2&&(b.data.c2.retainedSections.some(r=>!r.released)||b.data.c2.unknownRetainedSections?.some(r=>!r.released)||b.data.blueprint.sections.some(s=>!blueprint.sections.some(n=>n.id===s.id))))issues.push({kind:'template_unresolved'});
  lease(current);return issues;
}

function residualBlueprint(b:StoredBasket,blueprint:PaperBlueprint):PaperBlueprint|undefined {
  const sections=blueprint.sections.flatMap(section=>{
    const selected=b.data.entries.filter(e=>e.sectionId===section.id),generated=selected.filter(e=>e.question.sourceKind==='generated').length,quota=generatedPaperCount(blueprint,section);
    const missingGenerated=quota-generated,missingOriginal=section.count-quota-(selected.length-generated),count=missingOriginal+missingGenerated;
    return count?[{...section,count,...(blueprint.mode==='hybrid'?{generatedCount:missingGenerated}:{})}]:[];
  });
  return sections.length?{...blueprint,sections,totalPoints:sections.reduce((sum,s)=>sum+s.count*s.points,0)}:undefined;
}

async function additions(sql:PaperSql,host:PaperStoreHost,b:StoredBasket,blueprint:PaperBlueprint,current:()=>boolean):Promise<PaperSelection> {
  const groups=blueprint.mode==='source_only'?[]:await host.approvedGenerations!(b.sessionId,sql);
  const refs=new Map<string,PaperGeneration>(),generated:QuestionBankItem[]=[];
  for(const group of groups){
    if(group.sessionId!==b.sessionId)throw Error('permission_denied');
    if(group.subject!==blueprint.subject||group.grade!==blueprint.grade||blueprint.mode==='ai_original'&&group.generationKind!=='ai_original')continue;
    for(const question of group.questions){if(refs.has(question.id))throw Error('unavailable');refs.set(question.id,{groupId:group.id,effectDigest:group.effectDigest,generationKind:group.generationKind});generated.push(question);}
  }
  const identities=new Set<string>();for(const entry of b.data.entries){const identity=questionSelectionIdentity(entry.question);if(identity.status==='available')identities.add(identity.key);}
  return selectPaper({...sql,page:async(filter,after)=>{
    lease(current);const original=filter.mode==='ai_original'?[]:await sql.page(filter,after),last=original.at(-1)?.id;
    const candidates=generated.filter(q=>q.id>after&&(!last||q.id<=last)).map(question=>({id:question.id,question}));
    return Array.from(new Map([...original,...candidates].map(q=>[q.id,q])).values()).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0).slice(0,200);
  }},blueprint,current,refs,{ids:new Set(b.data.entries.map(e=>e.questionId)),identities});
}

/** Caller owns the sole SQL transaction, revision write, template sync and operation receipt. */
export async function applyFulfillmentOperation(sql:PaperSql,host:PaperStoreHost,b:StoredBasket,op:PaperFulfillmentOperation,requestId:string,current:()=>boolean) {
  lease(current);
  if(op.type==='saveFulfillmentPlan'){
    b.data.fulfillment={planId:'xiplan_'+randomUUID(),blueprint:structuredClone(op.blueprint),revision:b.revision+1,membersDigest:membersDigest(b),digest:'',status:'draft',issues:await fulfillmentIssues(sql,host,b,op.blueprint,current)};
    b.data.fulfillment.digest=planDigest(b,proof(b.data.fulfillment));return;
  }
  const plan=b.data.fulfillment;
  if(!plan||plan.planId!==op.planId||plan.digest!==op.digest||plan.revision!==b.revision||plan.membersDigest!==membersDigest(b)||plan.digest!==planDigest(b,proof(plan)))throw Error('conflict');
  const issues=await fulfillmentIssues(sql,host,b,plan.blueprint,current);
  if(issues.length)throw Error(issues.some(i=>i.kind==='member_unavailable')?'source_changed':'conflict');
  if(op.type==='confirmFulfillmentPlan'){
    if(plan.status!=='draft')throw Error('conflict');
    b.data.blueprint=structuredClone(plan.blueprint);
    if(b.data.purpose==='paper')b.data.paperRequirements='provided';
    plan.status='confirmed';plan.revision=b.revision+1;plan.membersDigest=membersDigest(b);plan.digest=planDigest(b,proof(plan));return;
  }
  if(plan.status!=='confirmed'||op.confirmedRevision!==plan.revision)throw Error('conflict');
  if((b.data.fulfillmentReceipts?.length??0)>=200)throw Error('unavailable');
  const before=canonicalBasketJson(b.data.entries),residual=residualBlueprint(b,plan.blueprint);
  const selection=residual?await additions(sql,host,b,residual,current):{items:[],scanned:0,scanComplete:false,excluded:{unsupported:0,missing_answer:0,source_unavailable:0},duplicateRecords:0};
  lease(current);const addedEntryIds:string[]=[];
  for(const item of selection.items){
    const entry={entryId:'xibasketentry_'+randomUUID(),questionId:item.question.id,contentVersion:questionVersion(item.question),sectionId:item.sectionId,
      position:b.data.entries.filter(e=>e.sectionId===item.sectionId).length,question:structuredClone(item.question),...(item.generation?{generation:structuredClone(item.generation)}:{})};
    b.data.entries.push({...entry,instance:newPaperInstance(entry)});addedEntryIds.push(entry.entryId);
  }
  if(canonicalBasketJson(b.data.entries.slice(0,b.data.entries.length-addedEntryIds.length))!==before)throw Error('conflict');
  const items=b.data.entries.map((e,index)=>({sectionId:e.sectionId,number:index+1,points:plan.blueprint.sections.find(s=>s.id===e.sectionId)!.points,question:e.question,source:{schemaVersion:'xiaozhi.education.question-context.v1' as const,questionId:e.questionId,version:e.contentVersion},...(e.generation?{generation:e.generation}:{})}));
  plan.status='fulfilled';plan.report={addedEntryIds,shortages:paperShortages(plan.blueprint,items),scanned:selection.scanned,scanComplete:selection.scanComplete,excluded:selection.excluded,duplicateRecords:selection.duplicateRecords};
  (b.data.fulfillmentReceipts??=[]).push({requestId,planId:plan.planId,revision:b.revision+1,report:structuredClone(plan.report)});
  lease(current);
}

export const fulfillmentBlocksConfirmation=(b:StoredBasket)=>purposeFulfillmentBlocksConfirmation(b.data.purpose,b.data.fulfillment);

export function finalizeFulfillmentProof(b:StoredBasket){const plan=b.data.fulfillment;if(plan&&plan.status!=='fulfilled'){plan.membersDigest=membersDigest(b);plan.digest=planDigest(b,proof(plan));}}
