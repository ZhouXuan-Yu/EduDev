import {Button} from '@heroui/react';
import type {PaperTemplateArrange} from '../../../shared/paper-template';
import type {PaperWorkspaceBasket} from './paper-basket-client';
export function PaperTemplateRetained({basket,disabled,onArrange}:{basket:PaperWorkspaceBasket;disabled:boolean;onArrange:(operation:PaperTemplateArrange['operation'])=>void}) {
  if(!basket.c2)return null;
  const c=basket.c2;
  return <section data-testid="paper-template-retained">
    <h3>模板应用与待安排项</h3>
    {basket.templateSourceCurrent===false&&<p role="alert">模板来源已失效或无法核实，保留题篮供对照；不能确认或导出。</p>}
    {c.retainedSections.map(r=><div key={r.section.id} data-testid="paper-template-retained-section">
      <p>{r.section.label} · 原要求 {r.section.count}题 × {r.section.points}分 · 当前 {r.entryIds.length}题 · {r.released?'已显式解除':'尚未采用'}</p>
      {!r.released&&<><p>题目仍完整显示于整理与预览。请逐题移至目标节；空节也须明确解除。</p>
      <Button variant="secondary" isDisabled={disabled||!!r.entryIds.length} onPress={()=>onArrange({kind:'release-empty',sectionId:r.section.id})} data-testid="paper-template-release-empty">明确解除空旧分节</Button></>}
    </div>)}
    {c.unknownRetainedSections?.map(r=><div key={r.sectionId}><p role="alert">原分节 {r.sectionId} 定义未知，保留 {r.entryIds.length}题 · {r.released?'已明确解除':'请显式安排题目并核定分值'}</p>
      {!r.released&&<Button variant="secondary" isDisabled={disabled||!!r.entryIds.length} onPress={()=>onArrange({kind:'release-empty',sectionId:r.sectionId})}>明确解除未知空旧分节</Button>}</div>)}
    {basket.entries.map(e=>{const s=basket.blueprint.sections.find(s=>s.id===e.sectionId),points=c.entryPoints[e.entryId];
      return s&&points!==s.points?<div key={e.entryId} data-testid="paper-template-points-conflict">
        <p role="alert">题目 {e.entryId} 保留原分值 {points??'未知'}；目标节每题 {s.points}分，尚未静默改分。</p>
        <Button variant="secondary" isDisabled={disabled} onPress={()=>onArrange({kind:'accept-points',entryId:e.entryId})} data-testid="paper-template-accept-points">明确采用目标节分值</Button>
      </div>:null;})}
  </section>;
}
