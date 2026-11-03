import {Button} from '@heroui/react';
import type {PaperBasketOperation, PaperBasketView} from '../../../shared/paper-basket';
import {PaperQuestionContent} from './PaperQuestionContent';
import {PaperSelect} from './PaperSelect';
import {basketReasons, orderedBasketEntries} from './paper-basket-ui';
import type {PaperWorkspaceBasket, PaperWorkspaceEntry, PaperWorkspaceOperation} from './paper-basket-client';
import {PaperInstanceContent} from './PaperInstanceContent';
import {PaperInstanceEditor} from './PaperInstanceEditor';
import type {PaperInstanceDraftController} from './usePaperInstanceDrafts';
import {PaperEntryPoints} from './PaperEntryPoints';

export function PaperBasketOrganizer({basket, disabled, onMutate, drafts, onReplace, onReload,onPointsDirty,pointsDirty=false}: {
  basket: PaperWorkspaceBasket;
  disabled: boolean;
  pointsDirty?: boolean;
  onMutate: (operation: PaperWorkspaceOperation) => Promise<boolean>;
  drafts?: PaperInstanceDraftController;
  onReplace?: (entry: PaperWorkspaceEntry) => void;
  onReload?: () => void;
  onPointsDirty?: (entryId:string,dirty:boolean)=>void;
}) {
  const entries = orderedBasketEntries(basket);
  function reorder(sectionId: string, index: number, direction: number) {
    const ids = entries.filter(entry => entry.sectionId === sectionId).map(entry => entry.entryId);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void onMutate({type: 'reorderSection', sectionId, entryIds: ids});
  }
  return <section data-testid="paper-basket-organizer">
    <h2>整理已选题</h2>
    <p>调整题目顺序或移动分节；题数和分值可在“蓝图与来源策略”中修改。</p>
    {!entries.length && <p>题篮为空，请继续找题。</p>}
    {entries.map((entry, number) => {
      const siblings = entries.filter(item => item.sectionId === entry.sectionId);
      const index = siblings.findIndex(item => item.entryId === entry.entryId);
      const section = basket.blueprint.sections.find(item => item.id === entry.sectionId)??basket.c2?.retainedSections.find(r=>r.section.id===entry.sectionId)?.section;
      const points=basket.c2?basket.c2.entryPoints[entry.entryId]:section?.points;
      return <article className="edu-paper-candidate-card" key={entry.entryId} data-testid="paper-basket-entry" data-entry-id={entry.entryId}>
        <h3>第 {number + 1} 题 · {section?.label || '原分节未知，请重新安排'} · {points??'待核定'} 分</h3>
        {!entry.availability.available && <p role="alert">{basketReasons[entry.availability.reason]}。保留加入时的题面，不会自动换题。</p>}
        <PaperInstanceContent entry={entry}/>
        {entry.instance&&points!=null&&<PaperEntryPoints points={points} disabled={disabled||!!drafts?.dirty} onDirty={dirty=>onPointsDirty?.(entry.entryId,dirty)} onSave={points=>onMutate({type:'setEntryPoints',entryId:entry.entryId,points})}/>}
        {entry.instance && drafts && onReplace && onReload && <PaperInstanceEditor entry={entry} drafts={drafts} disabled={disabled||pointsDirty}
          onMutate={onMutate} onReplace={() => onReplace(entry)} onReload={onReload}/>}
        <div className="edu-paper-actions">
          <Button variant="secondary" data-testid="paper-basket-up" isDisabled={disabled || pointsDirty || drafts?.dirty || index === 0} onPress={() => reorder(entry.sectionId, index, -1)}>上移</Button>
          <Button variant="secondary" data-testid="paper-basket-down" isDisabled={disabled || pointsDirty || drafts?.dirty || index === siblings.length - 1} onPress={() => reorder(entry.sectionId, index, 1)}>下移</Button>
          <Button variant="secondary" data-testid="paper-basket-remove" isDisabled={disabled || pointsDirty || drafts?.dirty} onPress={() => void onMutate({type: 'remove', entryId: entry.entryId})}>移出题篮</Button>
        </div>
        <PaperSelect label="移动至分节" value={entry.sectionId} disabled={disabled || pointsDirty || drafts?.dirty} testId="paper-basket-move"
          options={[...(!section ? [{id: entry.sectionId, label: '原分节已移除', disabled: true}] : []), ...basket.blueprint.sections.map(item => ({id: item.id, label: item.label}))]}
          onChange={sectionId => {if (sectionId !== entry.sectionId) void onMutate({type: 'moveEntry', entryId: entry.entryId,
            sectionId, index: entries.filter(item => item.sectionId === sectionId).length});}}/>
      </article>;
    })}
  </section>;
}
