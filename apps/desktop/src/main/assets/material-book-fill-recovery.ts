import type {QuestionBankItem} from '../../shared/contracts';
import {isCompleteQuestionDocument} from '../../shared/question-document';
import {aiTextSignature} from '../../shared/material-ai-image';
import {samePrintedFillAnswer} from '../../shared/material-answer-slots';
import type {readAiPageReceipt} from './material-ai-page-evidence';
import type {bookAnswerPage} from './material-book-answer-content';

/** Only a derived delimiter conflict can be repaired by a new authenticated
 * book journal. Callers still validate the complete current source and entry. */
export function canResolveBookFillConflict(q:QuestionBankItem,proof:Awaited<ReturnType<typeof readAiPageReceipt>>,entry:ReturnType<typeof bookAnswerPage>['entries'][number]):boolean{
 const archive=q.archive;
 if(!archive||archive.state!=='ai_needs_review'||archive.book||archive.web||archive.sourceChecked||archive.issues.length!==1||archive.issues[0]!=='answer_conflict'||archive.sourceRisks.length||archive.ai?.policy!=='page-crop-complete.v1'||archive.answerOrigin!=='ai_generated'||archive.analysisOrigin!=='ai_generated'||!isCompleteQuestionDocument(q.document)||q.document.answer.origin!=='ai_generated'||q.document.analysis.origin!=='ai_generated'||q.document.answer.text!==q.answer||q.document.analysis.text!==q.analysis||q.document.context.projection.statement.text!==q.stem||proof.first.pageIssues.length||proof.final.pageIssues.length||entry.number!==archive.number||!entry.agrees||entry.issues.some(i=>i!=='missing_analysis')||aiTextSignature(q.answer)===aiTextSignature(entry.answer))return false;
 const first=proof.first.questions.filter(a=>a.number===archive.number),final=proof.final.questions.filter(a=>a.number===archive.number);
 if(first.length!==1||final.length!==1||[...first,...final].some(a=>a.issues.length||a.answerOrigin!=='ai_generated'||a.analysisOrigin!=='ai_generated'||a.questionType!==q.questionType)||final[0].stem!==q.stem||final[0].answer!==q.answer||final[0].analysis!==q.analysis)return false;
 return samePrintedFillAnswer(q,first[0].answer,final[0].answer)&&samePrintedFillAnswer(q,final[0].answer,entry.answer);
}
