import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { OfficeReadingBookmark } from './OfficeReadingPosition';
import type {OfficeDraft} from '../../../shared/xiaozhi-office-draft';
import type {XiaozhiMessagePresentation} from '../../../shared/xiaozhi-message-presentation';
import { readComposerDraft, writeComposerDraft } from './composer-drafts';
import type {ComposerDraft} from './composer-drafts';
import {samePaperExportIntent,validPaperExportIntent,copyPaperExportIntent,type PaperExportIntent} from '../../../shared/paper-export';
import {Button} from '@heroui/react';

/** Unsent local input only; the session-keyed provider survives layout reparenting. */
function useDraftState(sessionId?: string) {
  const [saved] = useState(() => readComposerDraft(sessionId));
  const [input,setInput]=useState<ComposerDraft>(saved);
  const inputRef=useRef(input);inputRef.current=input;
  const draft=input.text,skillName=input.skill;
  const [storageFailed, setStorageFailed] = useState(false);
  function updateInput(next:ComposerDraft){
    inputRef.current=next;setInput(next);
    const saved=!sessionId||writeComposerDraft(sessionId,next);setStorageFailed(!saved);return saved;
  }
  function setDraft(value:React.SetStateAction<string>){const old=inputRef.current;updateInput({...old,text:typeof value==='function'?value(old.text):value});}
  function setSkillName(value:React.SetStateAction<string>){const old=inputRef.current;updateInput({...old,skill:typeof value==='function'?value(old.skill):value});}
  const [submitting, setSubmitting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [failedPrompt, setFailedPrompt] = useState<string>();
  const [failedPresentation,setFailedPresentation]=useState<XiaozhiMessagePresentation>();
  const [failedPaperExportIntent,setFailedPaperExportIntent]=useState<PaperExportIntent>();
  const [stopFailed, setStopFailed] = useState(false);
  const sendLock = useRef(false), stopLock = useRef(false);
  const [queueMode, setQueueMode] = useState<'steer' | 'followUp'>('steer');
  const draftRef = useRef(draft); draftRef.current = draft;
  function receiveSeed(text:string,intent?:PaperExportIntent):boolean{
    const old=inputRef.current;
    if(intent!==undefined&&!validPaperExportIntent(intent))return false;
    if(old.paperExportInvalid||sendLock.current)return false;
    if(old.text===text&&samePaperExportIntent(old.paperExportIntent,intent))return updateInput(old);
    if(old.text||old.skill||old.paperExportIntent){
      if(intent&&!old.pendingPaperExport)updateInput({...old,pendingPaperExport:{text,paperExportIntent:copyPaperExportIntent(intent)}});
      return false;
    }
    if(old.pendingPaperExport&&(old.pendingPaperExport.text!==text||!samePaperExportIntent(old.pendingPaperExport.paperExportIntent,intent)))return false;
    const next:ComposerDraft={text,skill:old.skill,...(intent?{paperExportIntent:copyPaperExportIntent(intent)}:{})};
    return updateInput(next);
  }
  function cancelExport(){
    const old=inputRef.current;
    updateInput({text:'',skill:old.skill,...(old.pendingPaperExport?{pendingPaperExport:old.pendingPaperExport}:{})});
    setFailedPrompt(undefined);setFailedPresentation(undefined);setFailedPaperExportIntent(undefined);
  }
  function cancelPendingExport(){const {pendingPaperExport:_pending,...rest}=inputRef.current;updateInput(rest);}
  function clearSent(prompt:string,intent?:PaperExportIntent){
    const old=inputRef.current;
    if(old.text!==prompt||!samePaperExportIntent(old.paperExportIntent,intent))return;
    const {paperExportIntent:_intent,paperExportInvalid:_invalid,...rest}=old;updateInput({...rest,text:''});
  }
  const [showSkill, setShowSkill] = useState(false);
  const [controlDrafts, setControlDrafts] = useState<Record<string, OfficeControlDraft>>({});
  const controlLocks = useRef(new Map<string, { current: boolean }>());
  const readingBookmark = useRef<OfficeReadingBookmark | undefined>(undefined);
  return { draft, draftRef, storageFailed, setDraft,inputRef,paperExportIntent:input.paperExportIntent,paperExportInvalid:input.paperExportInvalid,
    pendingPaperExport:input.pendingPaperExport,receiveSeed,cancelExport,cancelPendingExport,clearSent,
    submitting, setSubmitting, stopping, setStopping, failedPrompt, setFailedPrompt,failedPresentation,setFailedPresentation,failedPaperExportIntent,setFailedPaperExportIntent,
    stopFailed, setStopFailed, sendLock, stopLock, queueMode, setQueueMode, skillName, setSkillName, showSkill, setShowSkill,
    controlDrafts, setControlDrafts, controlLocks, readingBookmark };
}
const DraftContext = createContext<ReturnType<typeof useDraftState> | null>(null);

export function OfficeComposerState({ children, sessionId }: { children: ReactNode; sessionId?: string }) {
  const state = useDraftState(sessionId);
  return <DraftContext.Provider value={state}>{children}</DraftContext.Provider>;
}

export function useOfficeComposerState() {
  // Original standalone consumers retain their local state without a provider.
  const local = useDraftState();
  return useContext(DraftContext) ?? local;
}
/** Teacher requested continuation draft only; never auto-send or restore it on Back. */
export function OfficeComposerSeed({text,paperExportIntent,onConsumed}:{text?:string;paperExportIntent?:PaperExportIntent;onConsumed:()=>void}){
  const state=useOfficeComposerState();
  const key=paperExportIntent?JSON.stringify(paperExportIntent):'';
  useEffect(()=>{if(text&&state.receiveSeed(text,paperExportIntent))onConsumed();},[text,key]);
  const pending=state.pendingPaperExport;
  if(!pending&&!text)return null;
  const usePending=()=>{
    const seed=pending??(text?{text,paperExportIntent}:undefined);
    if(seed&&state.receiveSeed(seed.text,seed.paperExportIntent)){
      if(seed.text===text&&samePaperExportIntent(seed.paperExportIntent,paperExportIntent))onConsumed();
    }
  };
  return <p className="office-history-notice" role="status" data-testid="paper-export-seed-pending">
    已有草稿或待处理请求，原输入已保留；尚未载入这次请求。
    <Button variant="ghost" size="sm" isDisabled={!!state.draft||!!state.paperExportIntent||state.submitting} onPress={usePending} data-testid="paper-export-seed-use">使用待发送请求</Button>
    <Button variant="ghost" size="sm" isDisabled={state.submitting} onPress={()=>{state.cancelPendingExport();if(!pending||pending.text===text&&samePaperExportIntent(pending.paperExportIntent,paperExportIntent))onConsumed();}} data-testid="paper-export-seed-cancel">取消待发送请求</Button>
  </p>;
}

interface OfficeControlDraft {
  answer: string; text: string; mode: 'steer' | 'followUp'; revision: number;
  editing: boolean; busy: boolean; error: string;
  officeDraft?:OfficeDraft;officeRevision?:number;
  learningDraft?:import('../../../shared/learning-review').LearningReviewDraft;
  practiceDraft?:import('../../../shared/practice-review').PracticeReviewDraft;
  questionDraft?:import('../../../shared/question-review').QuestionReviewDraft;
  questionQuality?:{draftJson:string;quality:import('../../../shared/question-quality').QuestionQualityReview;reviewed:boolean};
  originalDraft?:import('../../../shared/original-question-review').OriginalQuestionDraft;
  originalMultiDraft?:import('../../../shared/original-multi-review').OriginalMultiDraft;
  originalComplete?:boolean;
}
/** UI drafts and mutual exclusion survive layout changes; main still validates every action. */
export function useOfficeControlState(id: string, initial: Partial<OfficeControlDraft> = {}) {
  const context = useContext(DraftContext);
  const seed: OfficeControlDraft = { answer: '', text: '', mode: 'steer', revision: 0, editing: false, busy: false, error: '', ...initial };
  const [local, setLocal] = useState(seed), localLock = useRef(false);
  if (context && !context.controlLocks.current.has(id)) {
    const locks = context.controlLocks.current;
    if (locks.size >= 64) { const oldest = [...locks].find(([key, value]) => key !== id && !value.current); if (oldest) locks.delete(oldest[0]); }
    locks.set(id, { current: false });
  }
  const draft = context?.controlDrafts[id] ?? local;
  function update(patch: Partial<OfficeControlDraft>) {
    if (!context) { setLocal(previous => ({ ...previous, ...patch })); return; }
    context.setControlDrafts(previous => {
      const next = { ...previous, [id]: { ...(previous[id] ?? seed), ...patch } };
      if (Object.keys(next).length > 64) { const oldest = Object.keys(next).find(key => key !== id && !next[key].busy); if (oldest) delete next[oldest]; }
      return next;
    });
  }
  return { draft, update, lock: context?.controlLocks.current.get(id) ?? localLock };
}
