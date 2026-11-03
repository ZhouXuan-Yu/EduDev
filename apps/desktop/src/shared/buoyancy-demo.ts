import {analyzeBuoyancy,buoyancyParameters,validBuoyancyInput,type BuoyancyInput} from './buoyancy';
import {plainStudentInput} from './student-context';

export const BUOYANCY_DEMO_SCHEMA='xiaozhi.buoyancy-demo.v1' as const;
export type BuoyancyDemo={schemaVersion:typeof BUOYANCY_DEMO_SCHEMA;title:string;audience:string;model:BuoyancyInput};
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!/[\x00-\x1f<>]/.test(v);
/** A deliberately bounded classroom experiment. Unknown conditions never become defaults. */
export function validBuoyancyDemo(v:unknown):v is BuoyancyDemo{
 if(!plainStudentInput(v,['schemaVersion','title','audience','model'])||v.schemaVersion!==BUOYANCY_DEMO_SCHEMA||!text(v.title,60)||!text(v.audience,40)||!validBuoyancyInput(v.model)||v.model.placement!=='free')return false;
 const r=analyzeBuoyancy(v.model);if(r.state!=='calculated'||!r.values)return false;
 const q=r.values,block=Number(v.model.blockDensity!.value)*(v.model.blockDensity!.unit==='g/cm^3'?1000:1);
 // gravity has two equivalent SI units; density input may also be g/cm^3.
 const rho=Number(v.model.liquidDensity!.value)*(v.model.liquidDensity!.unit==='g/cm^3'?1000:1);
 return block>=200&&block<=950&&[800,1000,1200].includes(rho)
  &&Number(q.load.decimal)>=0&&Number(q.load.decimal)<=6&&Number(q.side.decimal)>=0.01&&Number(q.side.decimal)<=1
  &&Number(v.model.gravity!.value)>=0.1&&Number(v.model.gravity!.value)<=30;
}
export const buoyancyDemoParameters={type:'object',additionalProperties:false,required:['schemaVersion','title','audience','model'],
 description:'可核验的离线正方体浮力探究；与content互斥，仅用于新.html。模型必须来自本题已明确条件，采用现精确双方法。木块200–950kg/m³，液体800/1000/1200kg/m³，向下载荷0–6N，边长0.01–1m、g0.1–30N/kg。初始placement=free，全部适用条件须明确true；缺失不得猜。含观察/预测/实验/解释/检查、参数联动、暂停重置和教师答案。不是速度/加速度仿真。',
 properties:{schemaVersion:{type:'string',const:BUOYANCY_DEMO_SCHEMA},title:{type:'string',minLength:1,maxLength:60},audience:{type:'string',minLength:1,maxLength:40},model:buoyancyParameters}} as const;
