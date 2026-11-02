import {validMathEquationInput,validMathEquationResult,type MathEquationInput,type MathEquationResult} from './math-equation';
import type {MathExpression} from './math-check';
import {plainStudentInput} from './student-context';

export type VariationEquationEvidence={state:'not_applicable'|'answer_unreadable'|'not_run'|'matched'|'mismatch'|'unsupported';sourceText?:string;answerText?:string;result?:MathEquationResult};
type Parsed={state:'not_applicable'}|{state:'answer_unreadable';sourceText:string;answerText:string}|{state:'ready';sourceText:string;answerText:string;input:MathEquationInput};
const normalize=(s:string)=>s.replace(/[−–]/g,'-').replace(/[×·]/g,'*').replace(/÷/g,'/').replace(/[（]/g,'(').replace(/[）]/g,')').replace(/²/g,'^2').replace(/³/g,'^3');
const number=(n:string,d='1'):MathExpression=>({op:'number',numerator:n,denominator:d});
/** A small literal grammar, never eval or a natural-language equation translator. */
function expression(raw:string):MathExpression{
 const input=normalize(raw).replace(/\s/g,'');
 if(!input||input.length>512||/[^0-9x.+*/^()√-]/.test(input))throw new Error('outside_literal_grammar');
 const tokens=input.match(/\d+(?:\.\d+)?|[x.+*/^()√-]/g)!;
 if(tokens.join('')!==input||tokens.length>128)throw new Error('outside_literal_grammar');
 let at=0,depth=0;
 const binary=(op:'add'|'subtract'|'multiply'|'divide'|'power',a:MathExpression,b:MathExpression):MathExpression=>({op,args:[a,b]});
 const atom=():MathExpression=>{
  if(++depth>12)throw new Error('outside_literal_grammar');
  const t=tokens[at++];let v:MathExpression;
  if(t==='('){v=sum();if(tokens[at++]!==')')throw new Error('outside_literal_grammar');}
  else if(t==='√'){if(tokens[at++]!=='(')throw new Error('outside_literal_grammar');v={op:'sqrt',args:[sum()]};if(tokens[at++]!==')')throw new Error('outside_literal_grammar');}
  else if(t==='x')v={op:'variable'};
  else if(/^\d+(?:\.\d+)?$/.test(t||'')){const [whole,fraction='']=t.split('.');if(fraction.length>5)throw new Error('outside_literal_grammar');v=number(BigInt(whole+fraction).toString(),(10n**BigInt(fraction.length)).toString());}
  else throw new Error('outside_literal_grammar');
  depth--;return v;
 };
 const power=():MathExpression=>{const a=atom();return tokens[at]==='^'?(at++,binary('power',a,unary())):a;};
 const unary=():MathExpression=>tokens[at]==='-'?(at++,binary('subtract',number('0'),unary())):tokens[at]==='+'?(at++,unary()):power();
 const product=():MathExpression=>{let a=unary();while(at<tokens.length){const t=tokens[at];if(t==='*'||t==='/'){at++;a=binary(t==='*'?'multiply':'divide',a,unary());}else if(t==='x'||t==='('||t==='√')a=binary('multiply',a,unary());else break;}return a;};
 const sum=():MathExpression=>{let a=product();while(tokens[at]==='+'||tokens[at]==='-'){const t=tokens[at++];a=binary(t==='+'?'add':'subtract',a,product());}return a;};
 const result=sum();if(at!==tokens.length)throw new Error('outside_literal_grammar');return result;
}
/** Only a complete, explicitly stated equation is eligible; extra conditions are not dropped. */
export function parseVariationEquation(q:{stem:string;answer:string;questionType:string}):Parsed{
 if(!['short_answer','written','fill_in_blank'].includes(q.questionType)||q.stem.length>1200)return{state:'not_applicable'};
 const stem=normalize(q.stem.trim());
 const match=stem.match(/^(?:(?:请)?解(?:下列)?方程\s*[:：]?\s*)?([0-9x\s.+*\/^()√-]+)=([0-9x\s.+*\/^()√-]+?)(?:[，,；;。]?\s*(?:求x(?:的值)?|求解))?[。.]?$/);
 if(!match||!/[x]/.test(match[1]+match[2]))return{state:'not_applicable'};
 let left:MathExpression,right:MathExpression;
 try{left=expression(match[1]);right=expression(match[2]);if(!validMathEquationInput({kind:'equation',left,right,domain:'real',roots:[]}))return{state:'not_applicable'};}catch{return{state:'not_applicable'};}
 const sourceText=q.stem,answerText=q.answer;
 let answer=normalize(q.answer.trim()).replace(/[。；;]$/,'').replace(/^(?:解为|答案为|解[:：])\s*/,'');
 let roots:MathExpression[];
 try{
  if(/^(?:无解|无实数解|解集为(?:空集|∅)|∅)$/.test(answer))roots=[];
  else{answer=answer.replace(/^x\s*(?:=|∈)\s*/,'').replace(/^\{(.*)\}$/,'$1');const values=answer.split(/[,，、]/);if(values.length>4||values.some(v=>/[x]/.test(v)||!v.trim()))throw new Error('unreadable');roots=values.map(expression);}
  const input:MathEquationInput={kind:'equation',left,right,domain:'real',roots};
  if(!validMathEquationInput(input))throw new Error('unreadable');
  return{state:'ready',sourceText,answerText,input};
 }catch{return{state:'answer_unreadable',sourceText,answerText};}
}
export function validVariationEquationEvidence(v:unknown):v is VariationEquationEvidence{
 if(!plainStudentInput(v,['state','sourceText','answerText','result']))return false;
 if(v.state==='not_applicable')return v.sourceText===undefined&&v.answerText===undefined&&v.result===undefined;
 if(typeof v.sourceText!=='string'||v.sourceText.length>1200||typeof v.answerText!=='string'||v.answerText.length>8000)return false;
 return v.state==='answer_unreadable'||v.state==='not_run'?v.result===undefined:validMathEquationResult(v.result)&&v.state===v.result.state;
}
export function variationEquationMatches(q:{stem:string;answer:string;questionType:string},v:VariationEquationEvidence):boolean{
 const parsed=parseVariationEquation(q);
 if(parsed.state==='not_applicable')return v.state==='not_applicable';
 if(v.sourceText!==q.stem||v.answerText!==q.answer)return false;
 return parsed.state==='answer_unreadable'?v.state==='answer_unreadable':v.state==='not_run'||!!v.result&&v.result.candidates.length===parsed.input.roots.length;
}
