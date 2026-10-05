import {STUDENT_LEARNING_SCHEMA,LEARNING_MAX_BYTES,validLearningCalculationInput,validLearningCalculation,validLearningGradeInput,validLearningGrade,type LearningCalculationInput,type LearningCalculation,type LearningGradeInput,type LearningGradeResult} from '../../shared/student-learning';
import {runEducationWorker} from './worker-host';
export async function calculateLearning(input:LearningCalculationInput,signal:AbortSignal):Promise<LearningCalculation>{
 if(!validLearningCalculationInput(input))throw new Error('invalid_input');
 return runEducationWorker('learning',{operation:'analyse',...input},STUDENT_LEARNING_SCHEMA,signal,LEARNING_MAX_BYTES,256*1024,(v):v is LearningCalculation=>validLearningCalculation(v,input),v=>({points:v.points,dueOrder:v.dueOrder}));
}
/** Upstream heuristic output is a proposal, never a confirmed student fact. */
export async function gradeLearningAnswer(input:LearningGradeInput,signal:AbortSignal):Promise<LearningGradeResult>{
 if(!validLearningGradeInput(input))throw new Error('invalid_input');
 return runEducationWorker('learning',{operation:'grade',...input},STUDENT_LEARNING_SCHEMA,signal,65536,2048,validLearningGrade,v=>({isCorrect:v.isCorrect,errorType:v.errorType}));
}
