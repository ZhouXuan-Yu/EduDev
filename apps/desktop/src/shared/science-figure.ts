import {validScienceTeaching, scienceTeachingParameters, sciencePartCategory, type ScienceTeaching} from './science-teaching';
export const SCIENCE_FIGURE_SCHEMA = 'xiaozhi.science-figure.v1' as const;
export type SciencePart = { kind:'box'|'cylinder'; x:number; y:number; z:number; w:number; d:number; h:number; tone:'lo'|'mid'|'hi'|'lit'; label:string; repeat?:{count:number;dx:number;dy:number;dz:number} };
export type ScienceFigure = { path:string; title:string; caption:string; parts:SciencePart[]; teaching?:ScienceTeaching };
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length&&keys.every(k=>k in v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!/[\x00-\x1f<>]/.test(v);
const number=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const keys=['kind','x','y','z','w','d','h','tone','label'];
function part(v:unknown):v is SciencePart {
  return object(v)&&exact(v,keys)&&['box','cylinder'].includes(String(v.kind))&&['lo','mid','hi','lit'].includes(String(v.tone))
    &&text(v.label,64)&&['x','y'].every(k=>number(v[k],-300,300))&&number(v.z,-50,300)
    &&['w','d','h'].every(k=>number(v[k],0.3,160))&&(v.kind!=='cylinder'||v.w===v.d);
}
/** Only call after validating declarations; returned solids contain no code. */
export function expandScienceParts(parts:SciencePart[]):SciencePart[] {
  return parts.flatMap(({repeat,...p})=>Array.from({length:repeat?.count||1},(_,i)=>({...p,x:p.x+i*(repeat?.dx||0),y:p.y+i*(repeat?.dy||0),z:p.z+i*(repeat?.dz||0),tone:p.tone==='lit'&&i>0?'mid':p.tone})));
}
export function validScienceFigure(v:unknown):v is ScienceFigure {
  if(!object(v)||!exact(v,'teaching' in v?['path','title','caption','parts','teaching']:['path','title','caption','parts'])||typeof v.path!=='string'||v.path.length>500||!/\.(svg|html)$/i.test(v.path)
    ||!text(v.title,80)||!text(v.caption,600)||!Array.isArray(v.parts)||!v.parts.length||v.parts.length>80)return false;
  let total=0;
  for(const raw of v.parts){
    if(!object(raw))return false;
    const {repeat,...base}=raw;if(!part(base))return false;
    if(repeat!==undefined&&(!object(repeat)||!exact(repeat,['count','dx','dy','dz'])||!Number.isInteger(repeat.count)||!number(repeat.count,1,80)||!['dx','dy','dz'].every(k=>number(repeat[k],-160,160))))return false;
    total+=repeat===undefined?1:Number((repeat as Record<string,unknown>).count);if(total>80)return false;
  }
  if(total<40)return false;
  const expanded=expandScienceParts(v.parts as SciencePart[]);
  if('teaching' in v && (!validScienceTeaching(v.teaching) || v.teaching.steps.some(s=>!expanded.some(p=>sciencePartCategory(p.label)===s.part))))return false;
  return expanded.every(part)&&expanded.filter(p=>p.tone==='lit').length===1;
}
export const scienceFigureParameters={type:'object',properties:{teaching:scienceTeachingParameters,path:{type:'string',maxLength:500},title:{type:'string',maxLength:80},caption:{type:'string',maxLength:600},parts:{type:'array',minItems:1,maxItems:80,description:'实体声明，可用repeat精确重复；展开后40至80个实体。保留教师指定数量与尺寸。包围盒不能穿插，可面接触。',items:{type:'object',properties:{kind:{type:'string',enum:['box','cylinder']},x:{type:'number',minimum:-300,maximum:300,description:'包围盒最小x，绝不是中心，沿+x延伸到x+w。'},y:{type:'number',minimum:-300,maximum:300,description:'包围盒最小y，绝不是中心，沿+y延伸到y+d。'},z:{type:'number',minimum:-50,maximum:300,description:'实体底面高度，沿+z到z+h；放在支撑物上时z等于其z+h。'},w:{type:'number',minimum:0.3,maximum:160,description:'x方向尺寸，圆柱直径。'},d:{type:'number',minimum:0.3,maximum:160,description:'y方向尺寸，圆柱d=w。'},h:{type:'number',minimum:0.3,maximum:160,description:'z方向高度。'},tone:{type:'string',enum:['lo','mid','hi','lit'],description:'展开后恰好一个lit。重复组lit仅首个强调，其余自动mid。'},label:{type:'string',maxLength:64},repeat:{type:'object',description:'精确线性重复，例如count=40、dx=3、dy=0、dz=0。第i个起点=(x+i*dx,y+i*dy,z+i*dz)，i从0开始。',properties:{count:{type:'integer',minimum:1,maximum:80},dx:{type:'number',minimum:-160,maximum:160},dy:{type:'number',minimum:-160,maximum:160},dz:{type:'number',minimum:-160,maximum:160}},required:['count','dx','dy','dz'],additionalProperties:false}},required:keys,additionalProperties:false}}},required:['path','title','caption','parts'],additionalProperties:false} as const;
