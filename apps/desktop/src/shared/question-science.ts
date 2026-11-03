import {plainStudentInput} from './student-context';
import {validMathEquationInput,validMathEquationResult,mathEquationParameters,type MathEquationInput,type MathEquationResult} from './math-equation';
import {validMathQuantityInput,validMathQuantityResult,mathQuantityParameters,type MathQuantityInput,type MathQuantityResult} from './math-quantity';

/** A quotation binds a formal model to the displayed revision, not to a proven interpretation. */
export type QuestionScienceCheck=(MathEquationInput|MathQuantityInput)&{sourceText:string;answerText:string};
export type QuestionScienceResult={kind:'equation';result:MathEquationResult}|{kind:'quantity';result:MathQuantityResult};
export function validQuestionScienceCheck(v:unknown):v is QuestionScienceCheck{
 if(!plainStudentInput(v,['kind','left','right','domain','roots','expression','targetUnit','expected','sourceText','answerText']))return false;
 const {sourceText,answerText,...input}=v;
 const quote=(s:unknown)=>typeof s==='string'&&s.trim().length>0&&s.length<=6000&&!/[\x00-\x1f]/.test(s.replace(/[\n\r\t]/g,''));
 return quote(sourceText)&&quote(answerText)&&(validMathEquationInput(input)||validMathQuantityInput(input)&&input.expected!==null);
}
export function questionScienceBoundToQuestion(v:QuestionScienceCheck,q:{stem:string;answer:string}):boolean{
 return q.stem.includes(v.sourceText)&&q.answer.includes(v.answerText);
}
export function validQuestionScienceResult(v:unknown):v is QuestionScienceResult{
 return plainStudentInput(v,['kind','result'])&&(v.kind==='equation'&&validMathEquationResult(v.result)||v.kind==='quantity'&&validMathQuantityResult(v.result)&&v.result.state!=='calculated');
}
/** Reuse the solver contracts; the repository additionally validates the quotations. */
export const questionScienceProperties={...mathEquationParameters.properties,...mathQuantityParameters.properties,
 sourceText:{type:'string',minLength:1,maxLength:6000,description:'本题题干逐字片段；explanation使用宿主实读题干。绑定片段不证明题意形式化正确'},
 answerText:{type:'string',minLength:1,maxLength:6000,description:'本题参考答案逐字片段；quantity必须提供非null精确expected'},
} as const;
