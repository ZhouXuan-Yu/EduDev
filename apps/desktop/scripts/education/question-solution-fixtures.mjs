import {solutionCases} from './math-solution-fixtures.mjs';
const draft=(stem,answer,analysis)=>({title:'逐步推导核验',reason:'检查本题解析的每步变形与原式限制',subject:'数学',grade:'八年级',knowledgePoint:'方程变形',items:[{questionType:'short_answer',stem,answer,analysis,options:null,difficulty:'medium'}]});
const bind=(id,d,stepTexts)=>({draft:d,input:{...structuredClone(solutionCases.find(c=>c.id===id).input),sourceText:d.items[0].stem,answerText:d.items[0].answer,stepTexts}});
export function linear(correct=true,changed=false){
 const expanded=changed?'3x−6=2x+9':correct?'3x−6=2x+5':'3x−2=2x+5',answer=changed?'x=15':'x=11';
 return bind(changed?'new-original-condition-recomputed':correct?'fx04-valid-chain':'wrong-expansion-correct-last-answer',draft(`求3(x−2)=2x+${changed?'9':'5'}的实数解，并说明每步方程变形。`,answer,`展开：${expanded}。移项：${answer}。${changed?'重新按原式代回。':'把最后答案代回原式，两边均为27；中间步骤仍须核对。'}`),[expanded,answer]);
}
export function radical(correct=true){
 return bind(correct?'explicit-expansion-and-original-filter':'squaring-not-equivalent',draft('求√(x+2)=x的实数解，平方后须按原式核对。','x=2',`${correct?'平方列出候选':'声称平方等价'}：x+2=x²。按原式代回筛除−1：x=2。`),['x+2=x²','x=2']);
}
export function zeroLost(){return bind('divide-by-x-loses-zero',draft('求x(x−1)=0的全部实数解。','x=0或x=1','两边除以x：x−1=0。该推导需要核对是否丢根。'),['x−1=0']);}
export function unsupported(){return bind('unsupported-middle-not-hidden-by-correct-last-step',draft('求3(x−2)=2x+5的实数解。','x=11','中间声明x⁸=1。最后写x=11。'),['x⁸=1','x=11']);}
