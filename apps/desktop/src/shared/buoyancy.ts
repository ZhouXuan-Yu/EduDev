import {plainStudentInput} from './student-context';

export const BUOYANCY_SCHEMA='xiaozhi.education.cube-buoyancy.v1' as const;
export const BUOYANCY_TOOL='education_analyze_buoyancy' as const;
type Amount<U extends string>={value:string;unit:U};
const conditionLabels={uniformLiquid:'均匀静止液体',rigidCube:'刚性正方体',largeDeepContainer:'容器足够大且足够深',negligibleLoadVolume:'忽略载荷体积',negligibleAirBuoyancy:'忽略空气浮力',noOtherForces:'除重力、浮力、向下载荷和所声明的底部支持外无其他外力'} as const;
type Conditions=Record<keyof typeof conditionLabels,boolean|null>;
export type BuoyancyInput={cubeSide:Amount<'m'|'cm'|'mm'>|null;blockDensity:Amount<'kg/m^3'|'g/cm^3'>|null;liquidDensity:Amount<'kg/m^3'|'g/cm^3'>|null;gravity:Amount<'N/kg'|'m/s^2'>|null;downwardLoad:Amount<'N'|'kN'>|null;placement:'free'|'bottom'|null;conditions:Conditions};
type Rational={n:bigint;d:bigint};
type Measurement={exact:string;decimal:string;unit:string};
type Regime='floating'|'neutral'|'overloaded';
type Values={side:Measurement;area:Measurement;volume:Measurement;mass:Measurement;weight:Measurement;load:Measurement;totalDownwardForce:Measurement;maximumBuoyancy:Measurement;criticalLoad:Measurement;buoyancy:Measurement;displacedVolume:Measurement;immersedHeight:Measurement;emergedHeight:Measurement;downwardMinusBuoyancy:Measurement;netDownwardForce:Measurement;supportForce:Measurement|null};
type Methods={force:{regime:Regime;requiredVolume:Measurement;formula:string};density:{regime:Regime;effectiveDensity:Measurement;requiredFraction:Measurement;formula:string};agree:true};
export type BuoyancyResult={schemaVersion:typeof BUOYANCY_SCHEMA;input:BuoyancyInput;state:'calculated'|'unsupported'|'constraint_conflict';conditionsVerified:false;missingConditions:string[];regime:Regime|null;values:Values|null;methods:Methods|null;notes:string[]};
const units={cubeSide:['m','cm','mm'],blockDensity:['kg/m^3','g/cm^3'],liquidDensity:['kg/m^3','g/cm^3'],gravity:['N/kg','m/s^2'],downwardLoad:['N','kN']} as const;
const quantityLabels={cubeSide:'正方体边长',blockDensity:'物块密度',liquidDensity:'液体密度',gravity:'重力加速度g',downwardLoad:'向下载荷（无载荷也须明确为0）'} as const;
const decimalPattern=/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/;
export function validBuoyancyInput(v:unknown):v is BuoyancyInput{
 if(!plainStudentInput(v,['cubeSide','blockDensity','liquidDensity','gravity','downwardLoad','placement','conditions'])||v.placement!==null&&!['free','bottom'].includes(String(v.placement))||!plainStudentInput(v.conditions,Object.keys(conditionLabels)))return false;
 const c=v.conditions;
 return Object.keys(conditionLabels).every(k=>c[k]===null||typeof c[k]==='boolean')&&Object.entries(units).every(([key,allowed])=>{
  const q=v[key];return q===null||plainStudentInput(q,['value','unit'])&&typeof q.value==='string'&&decimalPattern.test(q.value)&&typeof q.unit==='string'&&(allowed as readonly string[]).includes(q.unit)&&(key==='downwardLoad'||/[1-9]/.test(q.value));
 });
}
const abs=(v:bigint)=>v<0n?-v:v;
function r(n:bigint,d=1n):Rational{if(d===0n)throw Error('invalid_input');if(d<0n){n=-n;d=-d;}let a=abs(n),b=d;while(b){const x=a%b;a=b;b=x;}return{n:n/(a||1n),d:d/(a||1n)};}
const add=(a:Rational,b:Rational)=>r(a.n*b.d+b.n*a.d,a.d*b.d);
const sub=(a:Rational,b:Rational)=>r(a.n*b.d-b.n*a.d,a.d*b.d);
const mul=(a:Rational,b:Rational)=>r(a.n*b.n,a.d*b.d);
const div=(a:Rational,b:Rational)=>r(a.n*b.d,a.d*b.n);
const compare=(a:Rational,b:Rational)=>{const n=a.n*b.d-b.n*a.d;return n<0n?-1:n>0n?1:0;};
const exact=(v:Rational)=>v.d===1n?String(v.n):`${v.n}/${v.d}`;
function decimal(v:Rational){
 const scale=1000000000000n,rounded=(abs(v.n)*scale*2n+v.d)/(2n*v.d);
 if(v.n!==0n&&rounded===0n)return String(Number(v.n)/Number(v.d));
 const text=(rounded/scale).toString()+'.'+(rounded%scale).toString().padStart(12,'0');
 return(v.n<0n&&rounded!==0n?'-':'')+text.replace(/\.?0+$/,'');
}
const measure=(v:Rational,unit:string):Measurement=>({exact:exact(v),decimal:decimal(v),unit});
function si(q:Amount<string>):Rational{
 const [whole,fraction='']=q.value.split('.');const value=r(BigInt(whole+fraction),10n**BigInt(fraction.length));
 const factor=q.unit==='cm'?r(1n,100n):q.unit==='mm'?r(1n,1000n):q.unit==='g/cm^3'||q.unit==='kN'?r(1000n):r(1n);
 return mul(value,factor);
}
const regimeFor=(sign:number):Regime=>sign<0?'floating':sign===0?'neutral':'overloaded';
/** Static, uniform-liquid cube model. Caller declarations never prove natural-language interpretation. */
export function analyzeBuoyancy(input:BuoyancyInput):BuoyancyResult{
 if(!validBuoyancyInput(input))throw Error('invalid_input');
 const missingConditions=Object.entries(conditionLabels).filter(([k])=>input.conditions[k as keyof Conditions]!==true).map(([k,label])=>label+(input.conditions[k as keyof Conditions]===false?'（不满足）':'（未明确）'));
 for(const [key,label]of Object.entries(quantityLabels))if(input[key as keyof typeof units]===null)missingConditions.push(label+'（未给定）');
 if(input.placement===null)missingConditions.push('自由或全浸没触底场景（未明确）');
 const base={schemaVersion:BUOYANCY_SCHEMA,input,conditionsVerified:false as const,missingConditions};
 if(missingConditions.length)return{...base,state:'unsupported',regime:null,values:null,methods:null,notes:['当前条件不支持此近似静水模型，请补充条件或使用适用模型；不能猜成唯一结果。']};
 const zero=r(0n),side=si(input.cubeSide!),rhoB=si(input.blockDensity!),rhoL=si(input.liquidDensity!),g=si(input.gravity!),load=si(input.downwardLoad!);
 const area=mul(side,side),volume=mul(area,side),mass=mul(rhoB,volume),weight=mul(mass,g),down=add(weight,load),maximum=mul(mul(rhoL,g),volume);
 // Force method solves rhoLiquid*g*displacedVolume = weight+load.
 const requiredVolume=div(down,mul(rhoL,g)),forceRegime=regimeFor(compare(down,maximum));
 // Density method starts from rhoEffective = rhoBlock + load/(g*volume).
 const effectiveDensity=add(rhoB,div(load,mul(g,volume))),fraction=div(effectiveDensity,rhoL),densityVolume=mul(volume,fraction),densityRegime=regimeFor(compare(effectiveDensity,rhoL));
 if(compare(requiredVolume,densityVolume)!==0||forceRegime!==densityRegime)throw Error('configuration');
 const floating=forceRegime==='floating'&&input.placement==='free',displaced=floating?requiredVolume:volume,immersed=floating?div(displaced,area):side,buoyancy=mul(mul(rhoL,g),displaced),difference=sub(down,buoyancy);
 const conflict=input.placement==='bottom'&&forceRegime==='floating',support=input.placement==='bottom'?(conflict?null:difference):zero,net=support===null?difference:sub(difference,support);
 const values:Values={side:measure(side,'m'),area:measure(area,'m^2'),volume:measure(volume,'m^3'),mass:measure(mass,'kg'),weight:measure(weight,'N'),load:measure(load,'N'),totalDownwardForce:measure(down,'N'),maximumBuoyancy:measure(maximum,'N'),criticalLoad:measure(sub(maximum,weight),'N'),buoyancy:measure(buoyancy,'N'),displacedVolume:measure(displaced,'m^3'),immersedHeight:measure(immersed,'m'),emergedHeight:measure(sub(side,immersed),'m'),downwardMinusBuoyancy:measure(difference,'N'),netDownwardForce:measure(net,'N'),supportForce:support===null?null:measure(support,'N')};
 const methods:Methods={force:{regime:forceRegime,requiredVolume:measure(requiredVolume,'m^3'),formula:'F浮=ρ液gV排；平衡需F浮=ρ木gV木+F载，比较所需排液体积与物体总体积。'},density:{regime:densityRegime,effectiveDensity:measure(effectiveDensity,'kg/m^3'),requiredFraction:measure(fraction,'1'),formula:'ρ等效=ρ木+F载/(gV木)；比较ρ等效与ρ液，所需浸入比例=ρ等效/ρ液。'},agree:true};
 const notes=['仅适用所声明的近似静水、刚性正方体和外力条件；条件来自调用者，未证明题意翻译或图中信息。','两种计算方法在此模型中交叉一致，不是独立自然教学质量评审。'];
 if(conflict)notes.push('全浸没时浮力大于向下力；无其他向下约束便不能保持触底静止，不能虚构负支持力。');
 else if(floating)notes.push('给出最终漂浮平衡位置；不模拟达到平衡的运动过程。');
 else if(forceRegime==='neutral')notes.push('全浸没临界；此近似模型不能唯一确定完全浸没后的悬浮深度。');
 else if(input.placement==='free')notes.push('超载：这里计算完全浸没、未触底时的浮力及向下合力；合力方向不是速度方向，不推断瞬时速度或加速度。');
 if(input.placement==='bottom'&&!conflict)notes.push('已声明全浸没且触底静止：支持力抵消重力和载荷超过浮力的部分，合力为零；不假定密封贴底。');
 notes.push('底面受液体作用；密封贴底、绳/阻力/表面张力及载荷体积不可忽略等情况需其他模型。');
 return{...base,state:conflict?'constraint_conflict':'calculated',regime:forceRegime,values,methods,notes};
}
/** Recompute this small closed model before exposing persisted numerical claims in public UI. */
export function validBuoyancyResult(v:unknown):v is BuoyancyResult{
 if(!plainStudentInput(v,['schemaVersion','input','state','conditionsVerified','missingConditions','regime','values','methods','notes'])||!validBuoyancyInput(v.input))return false;
 const expected=analyzeBuoyancy(v.input);
 return Object.keys(v).length===Object.keys(expected).length&&Object.entries(expected).every(([k,value])=>JSON.stringify(v[k])===JSON.stringify(value));
}
export function buoyancySummary(v:BuoyancyResult):string{
 if(v.state==='unsupported')return'浮力模型未计算：'+v.missingConditions.join('；')+'。不能补猜条件。';
 const q=v.values!,label={floating:'可漂浮',neutral:'全浸没临界',overloaded:'超载'}[v.regime!];
 const cm=(m:Measurement)=>{const [n,d='1']=m.exact.split('/');return decimal(mul(r(BigInt(n),BigInt(d)),r(100n)));};
 const facts=`${label}。受力法与等效平均密度法结果一致。重力${q.weight.decimal}N，载荷${q.load.decimal}N，向下力${q.totalDownwardForce.decimal}N；最大浮力${q.maximumBuoyancy.decimal}N，临界载荷${q.criticalLoad.decimal}N。`;
 const scene=v.state==='constraint_conflict'?'全浸没浮力大于向下力，不能保持触底静止；无其他约束时不能虚构负支持力。'
  :v.input.placement==='bottom'?`全浸没触底静止：浮力${q.buoyancy.decimal}N，支持力${q.supportForce!.decimal}N，合力为零；底面须受液体作用，密封贴底不适用。`
  :v.regime==='floating'?`漂浮平衡：浮力${q.buoyancy.decimal}N，排液${q.displacedVolume.decimal}m³，浸入${cm(q.immersedHeight)}cm，露出${cm(q.emergedHeight)}cm。`
  :v.regime==='neutral'?`全浸没时浮力${q.buoyancy.decimal}N、合力0N；不能唯一确定完全浸没后的悬浮深度。`
  :`完全浸没未触底：浮力${q.buoyancy.decimal}N，向下合力${q.netDownwardForce.decimal}N。合力方向不是速度方向，不推断瞬时速度或加速度。`;
 return facts+scene+'按声明的静水近似计算，题意和图中条件仍需核对。';
}
const amount=(allowed:readonly string[])=>({anyOf:[{type:'null'},{type:'object',additionalProperties:false,required:['value','unit'],properties:{value:{type:'string',pattern:'^(?:0|[1-9]\\d{0,5})(?:\\.\\d{1,6})?$'},unit:{type:'string',enum:allowed}}}],description:'未给定的量必须为null，不得默认为0或猜g。'});
export const buoyancyParameters={type:'object',additionalProperties:false,required:[...Object.keys(units),'placement','conditions'],properties:{...Object.fromEntries(Object.entries(units).map(([key,allowed])=>[key,amount(allowed)])),placement:{type:['string','null'],enum:['free','bottom',null],description:'free计算漂浮平衡或全浸没未触底边界；bottom明确全浸没且触底静止、底面仍受液体作用，不是密封贴底；场景未明确为null'},conditions:{type:'object',additionalProperties:false,required:Object.keys(conditionLabels),properties:Object.fromEntries(Object.entries(conditionLabels).map(([key,description])=>[key,{type:['boolean','null'],description:description+'；true为明确采用，null为未明确，false为不适用。不能伪称已知。'}]))}}} as const;
