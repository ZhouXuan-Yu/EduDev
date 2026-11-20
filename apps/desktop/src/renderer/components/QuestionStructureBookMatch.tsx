import { useEffect, useRef, useState } from 'react';
import type { QuestionNotebookEntry } from '../../shared/contracts';
import { STRUCTURE_BOOK_MATCH_SCHEMA, type BookMatchView } from '../../shared/question-book-answer';
import { isCompleteQuestionDocument } from '../../shared/question-document';
import { MaterialBookMatchRows } from './product/MaterialBookMatches';

export function QuestionStructureBookMatch({question, onReadback}:{
  question: QuestionNotebookEntry;
  onReadback: (question: QuestionNotebookEntry) => void;
}) {
  const [view, setView] = useState<BookMatchView>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const section = useRef<HTMLElement>(null);
  const readback = useRef(onReadback);
  const eligible=!!question.archive?.structure && question.archive.sourceChecked && isCompleteQuestionDocument(question.document);
  const questionId=question.id;
  useEffect(()=>{readback.current=onReadback;},[onReadback]);
  useEffect(()=>{
    const node=section.current,api=window.omniEdu;
    if(!eligible||!node||!api)return;
    let active=true,visible=false,inFlight=false,version='',published='';
    setView(undefined);
    async function load(){
      if(!active||!visible||inFlight||!api)return;
      inFlight=true;
      try {
        version ||= (await api.getArchivedQuestionVersion(questionId)).version;
        const current=await api.getMaterialBookMatches({schemaVersion:STRUCTURE_BOOK_MATCH_SCHEMA,questionId,version});
        if(!active)return;
        setView(current);
        const applied=current.rows.find(row=>row.afterVersion&&row.state==='applied');
        if(applied&&applied.afterVersion!==published){
          const saved=await api.getQuestionNotebookEntry(questionId);
          if(active&&saved){published=applied.afterVersion;readback.current(saved);}
        }
      }catch{/* A manual match still exposes a failed refresh. */}
      finally{inFlight=false;}
    }
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)void load();});
    observer.observe(node);
    const timer=setInterval(()=>void load(),3000);
    return ()=>{active=false;observer.disconnect();clearInterval(timer);};
  },[eligible,questionId]);
  if (!eligible) return null;

  async function match() {
    const api = window.omniEdu!;
    setBusy(true);
    setError('');
    try {
      const {version} = await api.getArchivedQuestionVersion(question.id);
      const result = await api.matchMaterialBookAnswers({schemaVersion:STRUCTURE_BOOK_MATCH_SCHEMA, questionId:question.id, version});
      setView(result);
      if (result.rows.some(row => row.afterVersion)) {
        const saved = await api.getQuestionNotebookEntry(question.id);
        if (!saved) throw Error('readback_failed');
        onReadback(saved);
      }
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes('book_pair_required')
        ? '请先在知识库中为这份题册关联答案册。'
        : '匹配或读取未完成。请核对资料原件和题目版本后重试。');
    } finally {
      setBusy(false);
    }
  }

  return <section ref={section} data-testid="structure-book-matches">
    <button type="button" className="secondary-action" data-testid="structure-book-match" disabled={busy} onClick={()=>void match()}>
      {busy?'正在核对题册和答案册…':'匹配独立答案册'}
    </button>
    {error&&<p role="alert">{error}</p>}
    {view?.indexPending&&<p role="status">答案目录正在后台建立，完成后会自动匹配。</p>}
    {view?.automaticPending&&<p role="status" data-testid="structure-book-match-pending">正在等待后台配答。</p>}
    {view?.automaticError&&<p role="alert">后台配答未完成。请核对原件和关联后重试。</p>}
    <MaterialBookMatchRows rows={view?.rows??[]}/>
  </section>;
}
