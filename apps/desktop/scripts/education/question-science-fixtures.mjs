export const n=(a,b=1)=>({op:'number',numerator:String(a),denominator:String(b)}),x={op:'variable'};
export const r=(a,b=1)=>({numerator:String(a),denominator:String(b)});
export const q=(value,unit)=>({op:'quantity',value,unit});
const draft=(stem,answer,analysis,subject='物理')=>({title:'理科审题核验',reason:'核对原式、单位和参考答案',subject,grade:'八年级',knowledgePoint:'原式与单位',items:[{questionType:'short_answer',stem,answer,analysis,options:null,difficulty:'medium'}]});
export function equation(answer=-1){
 const value=draft('求原方程√(x+2)=x的实数解。',`x=${answer}`,`先保留原式限制，再把候选${answer}代回原式。`,'数学');
 return {draft:value,input:{kind:'equation',left:{op:'sqrt',args:[{op:'add',args:[x,n(2)]}]},right:x,domain:'real',roots:[n(answer)],sourceText:value.items[0].stem,answerText:value.items[0].answer}};
}
export function pressure(correct=false){
 const value=draft('100 N的力垂直作用在200 cm²的面积上，求压强。',correct?'5000 Pa':'0.5 Pa','先把面积换成平方米，再用p=F/S计算。');
 return {draft:value,input:{kind:'quantity',expression:{op:'divide',args:[q(r(100),'N'),q(r(200),'cm^2')]},targetUnit:'Pa',expected:correct?r(5000):r(1,2),sourceText:value.items[0].stem,answerText:value.items[0].answer}};
}
export function gravity(changed=false){
 const value=draft(`质量0.6 kg，题给g=${changed?'9.8':'10'} N/kg，求重力。`,changed?'5.88 N':'6 N','依据题给g用G=mg计算，不猜测其它常数。');
 return {draft:value,input:{kind:'quantity',expression:{op:'multiply',args:[q(r(6,10),'kg'),q(changed?r(98,10):r(10),'N/kg')]},targetUnit:'N',expected:changed?r(147,25):r(6),sourceText:value.items[0].stem,answerText:value.items[0].answer}};
}
