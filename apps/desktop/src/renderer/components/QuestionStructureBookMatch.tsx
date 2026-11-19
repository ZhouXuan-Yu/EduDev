import { useState } from 'react';
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
  if (!question.archive?.structure || !question.archive.sourceChecked || !isCompleteQuestionDocument(question.document)) return null;

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

  return <section data-testid="structure-book-matches">
    <button type="button" className="secondary-action" data-testid="structure-book-match" disabled={busy} onClick={()=>void match()}>
      {busy?'正在核对题册和答案册…':'匹配独立答案册'}
    </button>
    {error&&<p role="alert">{error}</p>}
    {view?.indexPending&&<p role="status">答案目录正在后台建立，完成后可重试。</p>}
    <MaterialBookMatchRows rows={view?.rows??[]}/>
  </section>;
}
