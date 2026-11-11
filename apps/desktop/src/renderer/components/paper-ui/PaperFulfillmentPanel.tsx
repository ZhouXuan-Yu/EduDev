import {useEffect,useState} from 'react';
import {Button} from '@heroui/react';
import {validPaperBlueprint,type PaperBlueprint} from '../../../shared/paper-blueprint';
import type {PaperFulfillmentIssue} from '../../../shared/paper-fulfillment-plan';
import {useDesktopNavigationGuard} from '../desktop/DesktopFrame';
import {DisclosureCard} from '../ui/DisclosureCard';
import type {PaperWorkspaceBasket,PaperWorkspaceOperation} from './paper-basket-client';
import {PaperBasketBlueprintForm} from './PaperBasketBlueprintForm';

const labels:Record<PaperFulfillmentIssue['kind'],string>={orphan:'原成员没有对应分节',over_quota:'已有成员超过严格配额',member_unavailable:'原成员来源失效或不符合方案',points_conflict:'方案分值与原有效分值冲突',template_unresolved:'模板旧节尚未安排或拟被移除'};
export function PaperFulfillmentPanel({basket, disabled, onMutate, onDirty, isExpanded, onExpandedChange}: {
  basket: PaperWorkspaceBasket;
  disabled: boolean;
  onMutate: (op: PaperWorkspaceOperation) => Promise<boolean>;
  onDirty: (value: boolean) => void;
  isExpanded?: boolean;
  onExpandedChange?: (value: boolean) => void;
}) {
  const plan=basket.fulfillment;
  const [draft,setDraft]=useState<PaperBlueprint>(plan?.blueprint??basket.blueprint),[dirty,setDirty]=useState(false),[baseRevision,setBaseRevision]=useState(basket.revision),[message,setMessage]=useState('');
  useDesktopNavigationGuard(dirty,'需求方案有未保存修改，请保存或明确放弃后离开。');
  useEffect(()=>{setDraft(plan?.blueprint??basket.blueprint);setDirty(false);onDirty(false);setBaseRevision(basket.revision);setMessage('');},[basket.id,plan?.planId]);
  useEffect(()=>()=>onDirty(false),[basket.id]);
  const stale=plan&&plan.status!=='fulfilled'&&plan.revision!==basket.revision;
  function edit(value:PaperBlueprint){if(!dirty)setBaseRevision(basket.revision);setDraft(value);setDirty(true);onDirty(true);}
  function discard(){setDraft(plan?.blueprint??basket.blueprint);setBaseRevision(basket.revision);setDirty(false);onDirty(false);setMessage('');}
  async function save(){
    if(dirty&&baseRevision!==basket.revision){setMessage('题篮修订已变化；本地方案保留，请放弃后重新核对当前篮。');return;}
    if(await onMutate({type:'saveFulfillmentPlan',blueprint:draft})){setDirty(false);onDirty(false);}
  }
  return <DisclosureCard title="需求方案与严格补缺" data-testid="paper-fulfillment-plan" isExpanded={isExpanded} onExpandedChange={onExpandedChange}>
    <p>先编辑并保存方案，再明确确认。执行只补剩余名额，原题、实例和审核逐字节保留；不会重选整篮、降低难度或放宽知识点。</p>
    <PaperBasketBlueprintForm value={draft} purpose={basket.purpose??'paper'} disabled={disabled} dirty={dirty} hasBasket={false} onChange={edit} onSave={()=>{}} onDiscard={discard}/>
    <Button variant="secondary" data-testid="paper-plan-save" isDisabled={disabled||!validPaperBlueprint(draft)} onPress={()=>void save()}>保存方案草稿</Button>
    {message&&<p role="alert">{message}</p>}
    {plan&&<>
      <p data-testid="paper-plan-status">方案 {plan.planId} · {{draft:'待明确确认',confirmed:'已确认，待补缺',fulfilled:'本次补缺已持久保存'}[plan.status]} · 绑定修订 {plan.revision}</p>
      {stale&&<p role="alert">题篮已变化，此方案不能执行；请重新保存并确认。</p>}
      {!!plan.issues.length&&<ul data-testid="paper-plan-issues">{plan.issues.map((issue,index)=><li key={index}>{labels[issue.kind]} {issue.sectionId??''} {issue.entryId??''}；原成员仍保留，处理后重新保存方案。</li>)}</ul>}
      <Button variant="secondary" data-testid="paper-plan-confirm" isDisabled={disabled||dirty||!!stale||plan.status!=='draft'||!!plan.issues.length}
        onPress={()=>void onMutate({type:'confirmFulfillmentPlan',planId:plan.planId,digest:plan.digest})}>明确确认此方案与当前题篮</Button>
      <Button className="edu-primary-action-contrast" data-testid="paper-plan-fulfill" isDisabled={disabled||dirty||!!stale||plan.status!=='confirmed'}
        onPress={()=>void onMutate({type:'fulfillPlan',planId:plan.planId,digest:plan.digest,confirmedRevision:plan.revision})}>按确认方案仅补缺额</Button>
      {plan.report&&<section data-testid="paper-plan-report">
        <p>本次新增 {plan.report.addedEntryIds.length} 题；扫描 {plan.report.scanned} 条，{plan.report.scanComplete?'本次候选扫描完成':'未扫描完整候选集'}。未调用模型自动生成。</p>
        {plan.report.shortages.length?<ul role="alert">{plan.report.shortages.map((gap,index)=><li key={index}>{gap.label} · {gap.sourceKind==='generated'?'已确认生成题':gap.sourceKind==='original'?'题库原题':'严格配额'}：已有 {gap.selected}/{gap.required}，仍缺 {gap.missing}。未放宽要求。</li>)}</ul>:<p>本次严格配额已满足；新增题仍须教师核对，尚未确认试卷。</p>}
        <p>排除：不支持 {plan.report.excluded.unsupported}、缺少答案 {plan.report.excluded.missing_answer}、来源不可用 {plan.report.excluded.source_unavailable}；重复候选 {plan.report.duplicateRecords}。</p>
      </section>}
    </>}
  </DisclosureCard>;
}
