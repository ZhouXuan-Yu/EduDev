import {plainStudentInput} from './student-context';
import {validMathSolutionInput,validMathSolutionResult,mathSolutionParameters,type MathSolutionInput,type MathSolutionResult} from './math-solution';

/** Each submitted transition belongs to an actual ordered fragment of this analysis. */
export type QuestionSolutionCheck=MathSolutionInput&{sourceText:string;answerText:string;stepTexts:string[]};
export type QuestionSolutionResult={kind:'solution';result:MathSolutionResult};
const quote=(s:unknown,max:number):s is string=>typeof s==='string'&&s.trim().length>0&&s.length<=max&&!/[\x00-\x1f]/.test(s.replace(/[\n\r\t]/g,''));
export function validQuestionSolutionCheck(v:unknown):v is QuestionSolutionCheck{
 if(!plainStudentInput(v,['kind','left','right','domain','roots','steps','sourceText','answerText','stepTexts']))return false;
 const {sourceText,answerText,stepTexts,...input}=v;
 return validMathSolutionInput(input)&&quote(sourceText,6000)&&quote(answerText,6000)&&Array.isArray(stepTexts)&&stepTexts.length===input.steps.length&&stepTexts.every(s=>quote(s,2000));
}
export function questionSolutionBoundToQuestion(v:QuestionSolutionCheck,q:{stem:string;answer:string;analysis:string}):boolean{
 if(!q.stem.includes(v.sourceText)||!q.answer.includes(v.answerText))return false;
 let cursor=0;
 for(const text of v.stepTexts){const index=q.analysis.indexOf(text,cursor);if(index<0)return false;cursor=index+text.length;}
 return true;
}
export function validQuestionSolutionResult(v:unknown):v is QuestionSolutionResult{
 return plainStudentInput(v,['kind','result'])&&v.kind==='solution'&&validMathSolutionResult(v.result);
}
export const questionSolutionProperties={steps:mathSolutionParameters.properties.steps,
 stepTexts:{type:'array',minItems:1,maxItems:5,items:{type:'string',minLength:1,maxLength:2000},description:'与steps等长，按解析顺序引用每步analysis的逐字片段，不重用同一段。只绑定版本，不证明题意翻译。'},
} as const;
