import {plainStudentInput} from './student-context';
import {analyzeBuoyancy,validBuoyancyInput,validBuoyancyResult,buoyancySummary,buoyancyParameters,type BuoyancyInput,type BuoyancyResult} from './buoyancy';

const targetLabels={buoyancy:'浮力',criticalLoad:'临界载荷',netDownwardForce:'向下合力',supportForce:'底部支持力',immersedHeight:'浸入高度',emergedHeight:'露出高度'} as const;
type TargetKey=keyof typeof targetLabels;
type Target={quantity:TargetKey;value:string;unit:'N'|'kN'|'m'|'cm'|'mm';answerText:string};
export type QuestionBuoyancyCheck={kind:'buoyancy';model:BuoyancyInput;sourceText:string;assumptionsText:string;targets:Target[]};
type CheckState='matched'|'mismatch'|'unsupported';
export type QuestionBuoyancyProof={kind:'buoyancy';model:BuoyancyResult;targets:(Target&{actual:string|null;state:CheckState})[];state:CheckState};
const quote=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=6000&&!v.includes('\0');
const decimal=/^-?(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/;
const validTargets=(v:unknown):v is Target[]=>Array.isArray(v)&&v.length>=1&&v.length<=6&&v.every(t=>plainStudentInput(t,['quantity','value','unit','answerText'])&&Object.keys(t).length===4&&typeof t.quantity==='string'&&Object.hasOwn(targetLabels,t.quantity)&&typeof t.value==='string'&&decimal.test(t.value)&&quote(t.answerText)&&(t.quantity.endsWith('Height')?['m','cm','mm']:['N','kN']).includes(t.unit as string)&&typeof t.unit==='string')&&new Set(v.map(t=>t.quantity)).size===v.length;
export function validQuestionBuoyancyCheck(v:unknown):v is QuestionBuoyancyCheck{
 return plainStudentInput(v,['kind','model','sourceText','assumptionsText','targets'])&&Object.keys(v).length===5&&v.kind==='buoyancy'&&validBuoyancyInput(v.model)&&quote(v.sourceText)&&quote(v.assumptionsText)&&validTargets(v.targets);
}
const normalized=(s:string)=>s.replace(/立方厘米/g,'cm^3').replace(/立方米/g,'m^3').replace(/千克/g,'kg').replace(/克/g,'g').replace(/厘米/g,'cm').replace(/毫米/g,'mm').replace(/牛顿/g,'N').replace(/米/g,'m').replace(/³/g,'^3').replace(/²/g,'^2').replace(/\s/g,'');
const amountOccurs=(text:string,value:string,unit:string)=>{const s=normalized(text),needle=normalized(value+unit);for(let at=s.indexOf(needle);at>=0;at=s.indexOf(needle,at+1)){if((at===0||!/[\d.+-]/.test(s[at-1]))&&(at+needle.length===s.length||!/[\dA-Za-z^]/.test(s[at+needle.length])))return true;}return false;};
/** Literal quantity/quote binding only: it does not prove density roles, force interpretation or image semantics. */
export function questionBuoyancyBoundToQuestion(v:QuestionBuoyancyCheck,q:{stem:string;answer:string;analysis:string}):boolean{
 return q.stem.includes(v.sourceText)&&q.analysis.includes(v.assumptionsText)&&v.targets.every(t=>q.answer.includes(t.answerText)&&amountOccurs(t.answerText,t.value,t.unit))
  &&(['cubeSide','blockDensity','liquidDensity','gravity','downwardLoad'] as const).every(k=>{const a=v.model[k];return a===null||amountOccurs(v.sourceText,a.value,a.unit)||k==='downwardLoad'&&Number(a.value)===0&&/(?:无载荷|不加载荷|未加载荷)/u.test(v.sourceText);});
}
function expected(t:Target){const scale={N:[1n,1n],kN:[1000n,1n],m:[1n,1n],cm:[1n,100n],mm:[1n,1000n]}[t.unit];const digits=t.value.split('.')[1]?.length??0;return{n:BigInt(t.value.replace('.',''))*scale[0],d:10n**BigInt(digits)*scale[1]};}
export function questionBuoyancyProof(v:QuestionBuoyancyCheck):QuestionBuoyancyProof{
 const model=analyzeBuoyancy(v.model),targets=v.targets.map(t=>{const measured=model.values?.[t.quantity],actual=measured?.exact??null,e=expected(t),parts=actual?.split('/');const state:CheckState=model.state!=='calculated'||!parts?'unsupported':e.n*BigInt(parts[1]??'1')===BigInt(parts[0])*e.d?'matched':'mismatch';return{...t,actual,state};});
 return{kind:'buoyancy',model,targets,state:model.state==='constraint_conflict'||targets.some(t=>t.state==='mismatch')?'mismatch':model.state==='unsupported'||targets.some(t=>t.state==='unsupported')?'unsupported':'matched'};
}
/** Closed host proof; the original immutable plan separately binds every target and quotation. */
export function validQuestionBuoyancyProof(v:unknown):v is QuestionBuoyancyProof{
 try{
  if(!plainStudentInput(v,['kind','model','targets','state'])||Object.keys(v).length!==4||v.kind!=='buoyancy'||!validBuoyancyResult(v.model)||!Array.isArray(v.targets))return false;
  const targets=v.targets.map(t=>{if(!plainStudentInput(t,['quantity','value','unit','answerText','actual','state'])||Object.keys(t).length!==6)throw Error('invalid');const{actual:_a,state:_s,...target}=t;return target;});
  if(!validTargets(targets))return false;return JSON.stringify(questionBuoyancyProof({kind:'buoyancy',model:v.model.input,sourceText:'proof',assumptionsText:'proof',targets}))===JSON.stringify(v);
 }catch{return false;}
}
export function questionBuoyancyCalculation(v:QuestionBuoyancyCheck,includeProof=true):string{
 const basis=`题干数量依据「${v.sourceText}」\n近似模型声明「${v.assumptionsText}」\n`;
 if(!includeProof)return basis+'本版本与原计划已不同；旧浮力计算结果未使用，请重新核对当前条件。';
 const proof=questionBuoyancyProof(v);return basis+buoyancySummary(proof.model)+'\n'+proof.targets.map(t=>`${targetLabels[t.quantity]}：答案片段「${t.answerText}」；目标${t.value}${t.unit}；模型实际${t.actual??'未确定'}${t.quantity.endsWith('Height')?'m':'N'}（${{matched:'数值一致',mismatch:'数值不符',unsupported:'未核验'}[t.state]}）`).join('\n');
}
export function retainsQuestionBuoyancyCheck(parent:QuestionBuoyancyCheck,child:QuestionBuoyancyCheck):boolean{
 return parent.model.placement===child.model.placement&&Object.keys(parent.model.conditions).every(k=>parent.model.conditions[k as keyof BuoyancyInput['conditions']]!==true||child.model.conditions[k as keyof BuoyancyInput['conditions']]===true)
  &&(['cubeSide','blockDensity','liquidDensity','gravity','downwardLoad'] as const).every(k=>parent.model[k]===null||child.model[k]!==null)&&parent.targets.every((t,i)=>child.targets[i]?.quantity===t.quantity);
}
export const questionBuoyancyProperties={model:buoyancyParameters,assumptionsText:{type:'string',minLength:1,maxLength:6000,description:'当前解析逐字片段，明确采用的静水/无其他外力等近似；不是条件已验证声明'},targets:{type:'array',minItems:1,maxItems:6,items:{type:'object',additionalProperties:false,required:['quantity','value','unit','answerText'],properties:{quantity:{type:'string',enum:Object.keys(targetLabels)},value:{type:'string',pattern:decimal.source},unit:{type:'string',enum:['N','kN','m','cm','mm']},answerText:{type:'string',minLength:1,maxLength:6000,description:'当前答案逐字片段，必须含本目标数值与单位；不同物理量不可混写'}}}}} as const;
