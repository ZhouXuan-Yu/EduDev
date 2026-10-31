import {randomUUID} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {DELIVERY_CHECK_SCHEMA,type DeliveryCheckResult,type DeliveryCheckReport,CHECK_CLASSES} from '../../../shared/xiaozhi-delivery-checks';
import type {createDeliveryChecks} from './service';
export async function inspectionSummary(report:DeliveryCheckReport,clean:(text:string)=>Promise<string>){
  return{state:report.state,id:report.id,candidate:report.candidate===true,createdAt:report.createdAt,requirementsVersion:report.requirementsVersion,requirements:report.requirements?{taskId:report.requirements.taskId,digest:report.requirements.digest,criteria:await Promise.all(report.requirements.criteria.map(async c=>({...c,text:await clean(c.text)})))}:undefined,
   requirementCoverage:report.requirementCoverage?await Promise.all(report.requirementCoverage.map(async c=>({...c,evidence:await Promise.all(c.evidence.map(async e=>({...e,path:await clean(e.path),messages:await Promise.all(e.messages.map(clean))})))}))):undefined,
   requirementNote:'关联检查通过仅证明所声明规则的结果，不证明完整自然语言要求已满足；unmapped/unchecked必须列为未核验。',repairAttempts:report.repairAttempts,repairExhausted:report.repairExhausted,
   files:await Promise.all(report.files.map(async file=>({path:await clean(file.path),state:file.state,sha256:file.sha256,pageCount:file.pageCount,renderedPages:file.renderedPages,visualEvidenceCount:file.visualEvidence?.length||0,
    coverage:Object.fromEntries(CHECK_CLASSES.map(kind=>{const checks=file.checks.filter(c=>c.kind===kind);return[kind,checks.some(c=>c.state==='failed')?'failed':checks.some(c=>c.state==='unchecked')?'unchecked':checks.length?'checked':'unchecked'];})),
    findings:await Promise.all(file.checks.filter(c=>c.state==='failed'||c.state==='unchecked').slice(0,12).map(async c=>({...c,message:await clean(c.message)}))),findingCount:file.checks.length}))) };
 }
export function deliveryCheckTools(options:{sessionId:string;runId:string;scope:()=>string;current:()=>boolean;service:ReturnType<typeof createDeliveryChecks>;sanitizer:()=>Promise<(text:string)=>Promise<string>>}):ToolDefinition[]{
 return[{name:'education_check_delivery',label:'检查教学文件',description:'独立读取当前文件区真实文件，核对结构、页数/备注/正文要求、数值、同名跨文件事实；HTML实际离线运行并按声明操作控件，报告覆盖范围与未检查项。原创建/整包工具会在交付前自动检查候选并有限修复，本工具另可检查已保存文件。files每项path、可选version和rules。DOCX/PPTX可在rules声明officeEngine:"wps"或"microsoft"，默认auto在Microsoft未注册时用WPS；以实际引擎报告为准，不得把Office图冒充WPS图。rules例：{pages:8,notes:true,contains:[{text:"排液体积",page:4,scope:"body"}],numbers:[{id:"total",source:{kind:"column",column:"金额",startRow:2,endRow:4},expected:240}]}。HTML数值source:{kind:"selector",selector:"#force"}；文本数值source:{kind:"label",label:"浸入高度"}。interactions:[{id:"load",actions:[{kind:"set",selector:"#load",value:"5"}],observe:"#force",expectedNumber:10,mustChange:true}]。重复同名数值id用于跨文件一致性；facts:[{id:"question",source:{kind:"label",label:"题目版本"}}]可比较题目或版本文本。数值可不用模型自报expected，改用expectedFrom:{kind:"cube_buoyancy",sideCm:10,objectDensity:600,liquidDensity:1000,gravity:10,loadN:0,quantity:"immersed_cm"}由宿主独立计算6cm；支持weight_n/buoyancy_n/exposed_cm/displaced_cm3/downward_net_n，同样可用于交互规则。bindings可将现任务要求关联到规则，例如[{taskId:"当前上下文taskId",criterionId:"teacher_request",criterionVersion:1,checks:["pages","notes","contains:0","numbers:depth"]}]。先读取现有read_teacher_request/任务上下文取得真实id和版本，不能自造。checks引用当前文件实际声明项：pages/notes、contains:索引、excludes:索引、numbers:id、interactions:id、facts:id。所有要求含未关联项均返回requirementCoverage；关联通过仅证明声明规则，语义仍未检查，不得宣称整条教师要求满足。声明参数须取教师题目/已读取源，不能改条件凑答案。unit需声明真实模型假设。action=read和id重读历史检查，会检查版本过期。未渲染不称视觉通过，partial/stale不当作全完成；先实际修文件再复查，不用模型口头自证。',
  parameters:{type:'object',additionalProperties:false,properties:{action:{type:'string',enum:['inspect','read']},id:{type:'string'},files:{type:'array',minItems:1,maxItems:8,items:{type:'object',additionalProperties:false,required:['path'],properties:{path:{type:'string',maxLength:500},version:{type:'string',pattern:'^[a-f0-9]{64}$'},rules:{type:'object'}}}}}} as ToolDefinition['parameters'],
  execute:async(callId,raw,signal)=>{
   signal?.throwIfAborted();if(!options.current())throw Error('cancelled');let result:DeliveryCheckResult;
   try{
    const value=raw as {action?:unknown;id?:unknown;files?:unknown};if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['action','id','files'].includes(k)))throw Error('invalid_input');
    if(value.action==='read'){
     if(typeof value.id!=='string'||!/^xicheck_[a-f0-9]{64}$/.test(value.id)||value.files!==undefined)throw Error('invalid_input');
     const report=await options.service.get(options.sessionId,value.id);result=report?{ok:true,report}:{ok:false,error:'not_found'};
    }else{
     if(value.action!==undefined&&value.action!=='inspect'||value.id!==undefined)throw Error('invalid_input');
     result=await options.service.inspect({schemaVersion:DELIVERY_CHECK_SCHEMA,sessionId:options.sessionId,requestId:`xicheckreq_${randomUUID()}`,files:value.files},signal||new AbortController().signal,{runId:options.runId,callId,scope:options.scope(),current:options.current});
    }
    signal?.throwIfAborted();if(!options.current())throw Error('cancelled');const data=result.ok?{success:true,report:await inspectionSummary(result.report,await options.sanitizer())}:{success:false,error:result.error,message:'本次未完成检查，已有文件保持原样。'};
    return{content:[{type:'text',text:JSON.stringify(data)}],details:{success:result.ok},isError:!result.ok};
   }catch(error){signal?.throwIfAborted();if(!options.current())throw Error('cancelled');return{content:[{type:'text',text:JSON.stringify({success:false,error:'invalid_input',message:'检查参数或当前文件状态无效，未修改文件。'})}],details:{success:false},isError:true};}
  }}];
}
