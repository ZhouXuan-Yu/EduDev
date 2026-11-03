import {createHash} from 'node:crypto';
import type {PracticeTargetBasis,PracticeTargetSource,PracticeTargetReview} from '../../shared/practice-target';
import type {QuestionBankItem} from '../../shared/contracts';
import type {LearningReviewRepository} from './learning-review-repository';
import type {StudentContextRepository} from '../students/context-repository';
import {collectLearningEvidence} from './learning-evidence';
import {parseVariationEquation} from '../../shared/variation-equation';
import {checkEquation} from './math-host';

export type PracticeLearning=()=>Promise<{facts:Awaited<ReturnType<StudentContextRepository['learningSnapshot']>>;state:Awaited<ReturnType<LearningReviewRepository['state']>>}>;
export async function readPracticeTarget(read:PracticeLearning,source:PracticeTargetSource):Promise<PracticeTargetBasis>{
 const {facts,state}=await read();
 if(source.reviewVersion!==undefined&&source.reviewVersion!==state.version)throw Error('source_changed');
 const point=collectLearningEvidence(facts,Date.now()/1000,state.assessments).points.find(p=>p.records.some(r=>r.record.id===source.recordId&&r.version===source.version));
 if(!point)throw Error('source_changed');
 const assessment=state.assessments.filter(e=>e.recordId===source.recordId&&e.sourceVersion===source.version).at(-1);
 const diagnosis=assessment?.draft.kind==='assessment'?assessment.draft.correction.diagnosis:undefined;
 return{recordId:source.recordId,version:source.version,subject:point.subject,knowledgePoint:point.name,assessmentVersion:assessment?.version??null,...(diagnosis?{diagnosis}:{})};
}
export const samePracticeTarget=(a:PracticeTargetBasis,b:PracticeTargetBasis)=>createHash('sha256').update(JSON.stringify(a)).digest('hex')===createHash('sha256').update(JSON.stringify(b)).digest('hex');
/** Reuse S02's literal equation parser and exact solver; never label unsupported text verified. */
export async function checkPracticeAnswers(questions:QuestionBankItem[],signal:AbortSignal):Promise<PracticeTargetReview['answers']>{
 const answers:PracticeTargetReview['answers']=[];
 for(const q of questions){signal.throwIfAborted();const parsed=parseVariationEquation(q);if(parsed.state==='ready'){const result=await checkEquation(parsed.input,signal);answers.push({state:result.state,sourceText:parsed.sourceText,answerText:parsed.answerText,result});}else answers.push(parsed);}
 signal.throwIfAborted();
 if(answers.some(a=>a.state==='mismatch'||a.state==='answer_unreadable'))throw Error('answer_mismatch');
 return answers;
}
