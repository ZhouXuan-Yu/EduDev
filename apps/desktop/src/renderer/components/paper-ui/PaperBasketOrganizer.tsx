import {useCallback,useState, type ReactNode} from 'react';
import {Button} from '@heroui/react';
import {ChevronUp, ChevronDown, X} from 'lucide-react';
import {PaperSelect} from './PaperSelect';
import {basketEntryPoints, basketReasons, orderedBasketEntries} from './paper-basket-ui';
import type {PaperWorkspaceBasket, PaperWorkspaceEntry, PaperWorkspaceOperation} from './paper-basket-client';
import {PaperInstanceContent} from './PaperInstanceContent';
import {PaperInstanceEditor} from './PaperInstanceEditor';
import type {PaperInstanceDraftController} from './usePaperInstanceDrafts';
import {PaperEntryPoints} from './PaperEntryPoints';
import type {PaperEditorRecovery} from './PaperInstanceDialog';
import styles from '../../ui-system/paper-studio/paper-editor.module.css';

export function PaperBasketOrganizer({basket, disabled, onMutate, drafts, onReplace,onAdapt, onReload,onPointsDirty,pointsDirty=false,compact=false,recovery}: {
  basket: PaperWorkspaceBasket;
  disabled: boolean;
  pointsDirty?: boolean;
  onMutate: (operation: PaperWorkspaceOperation) => Promise<boolean>;
  drafts?: PaperInstanceDraftController;
  onReplace?: (entry: PaperWorkspaceEntry) => void;
  onAdapt?: (entry: PaperWorkspaceEntry) => void;
  onReload?: () => void;
  onPointsDirty?: (entryId:string,dirty:boolean)=>void;
  compact?: boolean;
  recovery?: PaperEditorRecovery;
}) {
  const entries = orderedBasketEntries(basket);
  const points = entries.map(entry => basketEntryPoints(basket, entry));
  const total = points.every(value => value != null) ? points.reduce<number>((sum, value) => sum + (value ?? 0), 0) : undefined;
  const pending = entries.filter(entry => entry.instance && !entry.reviewCurrent).length;
  function reorder(sectionId: string, index: number, direction: number) {
    const ids = entries.filter(entry => entry.sectionId === sectionId).map(entry => entry.entryId);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void onMutate({type: 'reorderSection', sectionId, entryIds: ids});
  }
  return <section data-testid="paper-basket-organizer">
    {compact ? <header className={styles.documentHeading}>
      <h2>{basket.title}</h2>
      <p><span data-testid="paper-editor-count" aria-live="polite">{entries.length}</span> 道题
        {basket.purpose !== 'practice' && ` · ${total == null ? '分值待核定' : total + ' 分'}`}
        {!!pending && ` · ${pending} 道待核对`}</p>
    </header> : <><h2>整理已选题</h2><p>调整题目顺序或移动分节；题数和分值可在“蓝图与来源策略”中修改。</p></>}
    {!entries.length && <p>题篮为空，请继续找题。</p>}
    {entries.map((entry, number) => {
      const siblings = entries.filter(item => item.sectionId === entry.sectionId);
      const index = siblings.findIndex(item => item.entryId === entry.entryId);
      const section = basket.blueprint.sections.find(item => item.id === entry.sectionId)??basket.c2?.retainedSections.find(r=>r.section.id===entry.sectionId)?.section;
      const points=basketEntryPoints(basket, entry);
      return <article className={compact ? styles.question : 'edu-paper-candidate-card'} key={entry.entryId} data-testid="paper-basket-entry" data-entry-id={entry.entryId}>
        {compact ? <header className={styles.questionHeader}><h3>第 {number + 1} 题</h3>
          <span className={styles.questionMeta}>{[entry.question.questionType, entry.question.knowledgePoint].filter(Boolean).join(' · ')}</span>
          <span className={styles.questionMeta}>{entry.reviewCurrent ? '已核对' : '待核对'}</span>
        </header> : <h3>第 {number + 1} 题 · {section?.label || '原分节未知，请重新安排'} · {points??'待核定'} 分</h3>}
        {!entry.availability.available && <p role="alert">{basketReasons[entry.availability.reason]}。保留加入时的题面，不会自动换题。</p>}
        <EntryBody entry={entry} points={points} drafts={drafts} disabled={disabled} pointsDirty={pointsDirty} compact={compact} recovery={recovery}
          onPointsDirty={onPointsDirty} onMutate={onMutate} onReplace={onReplace} onReload={onReload}>
        <div className={styles.actions}>
          {entry.instance&&onAdapt&&<Button variant={compact?'ghost':'secondary'} data-testid="paper-basket-adapt" isDisabled={disabled||pointsDirty||drafts?.dirty||!entry.availability.available} onPress={()=>onAdapt(entry)}>{compact?'改编':'指定此题改编'}</Button>}
          <Button variant={compact?'ghost':'secondary'} isIconOnly={compact} aria-label={`上移第 ${number + 1} 题`} data-testid="paper-basket-up" isDisabled={disabled || pointsDirty || drafts?.dirty || index === 0} onPress={() => reorder(entry.sectionId, index, -1)}>{compact?<ChevronUp size={16}/>: '上移'}</Button>
          <Button variant={compact?'ghost':'secondary'} isIconOnly={compact} aria-label={`下移第 ${number + 1} 题`} data-testid="paper-basket-down" isDisabled={disabled || pointsDirty || drafts?.dirty || index === siblings.length - 1} onPress={() => reorder(entry.sectionId, index, 1)}>{compact?<ChevronDown size={16}/>: '下移'}</Button>
          <Button variant={compact?'ghost':'secondary'} isIconOnly={compact} aria-label={`移除第 ${number + 1} 题`} data-testid="paper-basket-remove" isDisabled={disabled || pointsDirty || drafts?.dirty} onPress={() => void onMutate({type: 'remove', entryId: entry.entryId})}>{compact?<X size={16}/>: '移出题篮'}</Button>
        </div>
        <div className={compact?styles.moveSection:undefined}>
        <PaperSelect label="移动至分节" value={entry.sectionId} disabled={disabled || pointsDirty || drafts?.dirty} testId="paper-basket-move"
          hideLabel={compact}
          options={[...(!section ? [{id: entry.sectionId, label: '原分节已移除', disabled: true}] : []), ...basket.blueprint.sections.map(item => ({id: item.id, label: item.label}))]}
          onChange={sectionId => {if (sectionId !== entry.sectionId) void onMutate({type: 'moveEntry', entryId: entry.entryId,
            sectionId, index: entries.filter(item => item.sectionId === sectionId).length});}}/>
        </div>
        </EntryBody>
        {compact && <p className={styles.provenance}>{entry.question.sourceTitle || '本地题库'}</p>}
      </article>;
    })}
  </section>;
}

/** Bind decoded-image readiness to this exact saved content, never a prior revision. */
function EntryBody({entry,points,drafts,disabled,pointsDirty,onPointsDirty,onMutate,onReplace,onReload,compact,recovery,children}:{
 entry:PaperWorkspaceEntry;points?:number|null;drafts?:PaperInstanceDraftController;disabled:boolean;pointsDirty:boolean;
 onPointsDirty?:(entryId:string,dirty:boolean)=>void;onMutate:(operation:PaperWorkspaceOperation)=>Promise<boolean>;
 onReplace?:(entry:PaperWorkspaceEntry)=>void;onReload?:()=>void;
 compact:boolean;recovery?:PaperEditorRecovery;children:ReactNode;
}){
 const identity=entry.contentVersion+':'+(entry.instance?.contentDigest||'source');
 const [status,setStatus]=useState({identity:'',ready:false});
 const onReady=useCallback((ready:boolean)=>setStatus({identity,ready}),[identity]);
 return <>
  <PaperInstanceContent key={identity} entry={entry} onQuestionImagesReady={onReady}/>
  {!compact&&entry.instance&&points!=null&&<PaperEntryPoints points={points} disabled={disabled||!!drafts?.dirty} onDirty={dirty=>onPointsDirty?.(entry.entryId,dirty)} onSave={points=>onMutate({type:'setEntryPoints',entryId:entry.entryId,points})}/>}
  <footer className={compact?styles.questionFooter:undefined}>
  {entry.instance&&drafts&&onReplace&&onReload&&<PaperInstanceEditor entry={entry} drafts={drafts} disabled={disabled||pointsDirty}
    presentation={compact?'dialog':'inline'} recovery={recovery}
    imagesReady={status.identity===identity&&status.ready} onMutate={onMutate} onReplace={()=>onReplace(entry)} onReload={onReload}/>}
  {children}
  </footer>
 </>;
}
