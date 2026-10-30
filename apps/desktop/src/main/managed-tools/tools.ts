import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {createManagedTools} from './service';
import {MANAGED_TOOL_ERRORS} from '../../shared/managed-tools';
import {JAVASCRIPT_COMPONENT as recipe} from './manifest';
export function managedComputationTools(options:{service:ReturnType<typeof createManagedTools>;current:()=>boolean;sanitize:(text:string)=>Promise<string>}):ToolDefinition[]{
  const current=(signal?:AbortSignal)=>{signal?.throwIfAborted();if(!options.current())throw Error('cancelled');};
  return[{name:'prepare_education_tool',label:'准备本地计算工具',description:'检查并准备已认可的免费本地计算组件。先检测已安装工具，缺少时核验固定官方包、检查后激活；不修改系统Python或全局包。未知工具返回需授权，不接受下载地址/脚本。准备就绪后继续原任务调用education_compute，不要要求教师手工安装。',
    parameters:{type:'object',properties:{tool:{type:'string',minLength:1,maxLength:64}},required:['tool'],additionalProperties:false} as ToolDefinition['parameters'],
    execute:async(_id,args,signal,update)=>{
      current(signal);const value=args as {tool?:unknown};if(!value||typeof value.tool!=='string'||Object.keys(value).join(',')!=='tool'||value.tool.length>64)throw Error('invalid_input');
      const before=await options.service.view(value.tool);current(signal);
      if(before.status==='authorization_required'||before.status==='unsupported')return{content:[{type:'text',text:JSON.stringify({success:false,data:before})}],details:{success:false}};
      await options.service.prepare(value.tool,signal,state=>update?.({content:[{type:'text',text:JSON.stringify({phase:state.phase,downloadedBytes:state.downloadedBytes,totalBytes:recipe.archiveBytes})}],details:{success:true}}));current(signal);
      const after=await options.service.view(value.tool);current(signal);return{content:[{type:'text',text:JSON.stringify({success:true,data:after,nextTool:'education_compute'})}],details:{success:true}};
    }},
    {name:'education_compute',label:'运行本地教学计算',description:'在隔离QuickJS中实际运行JavaScript做计算/数据整理。code为函数体，用return返回JSON；input为独立JSON数据，通过变量input读取。可用标准JS/Math；无process、require、fs、fetch或任意模块导入。缺少免费兼容组件时自动准备并继续本次调用。返回实际结果与运行版本；最终文件仍用原文件工具提出审阅，不把临时计算当正式成果。不要声称仅凭运算已证明教学推理。',
      parameters:{type:'object',properties:{code:{type:'string',minLength:1,maxLength:32768},input:{}},required:['code','input'],additionalProperties:false} as ToolDefinition['parameters'],
      execute:async(_id,args,signal,update)=>{
        current(signal);const value=args as {code?:unknown;input?:unknown};if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['code','input'].includes(k))||typeof value.code!=='string'||!value.code.trim()||value.code.length>32768||Buffer.byteLength(JSON.stringify(value.input??null))>65536)throw Error('invalid_input');
        try{
          const input=value.input??null,code=value.code;current(signal);
          const data=await options.service.compute(code,input,signal,state=>update?.({content:[{type:'text',text:JSON.stringify(state)}],details:{success:true}}));current(signal);
          const clean=async(item:unknown,depth=0):Promise<unknown>=>{if(depth>32)throw Error('output_limit');if(typeof item==='string')return options.sanitize(item);if(Array.isArray(item))return Promise.all(item.map(v=>clean(v,depth+1)));if(item&&typeof item==='object')return Object.fromEntries(await Promise.all(Object.entries(item).map(async([key,v])=>[key,await clean(v,depth+1)])));return item;};
          const safe=await clean(data.value);current(signal);
          return{content:[{type:'text',text:JSON.stringify({success:true,data:{...data,value:safe}})}],details:{success:true}};
        }catch(error){current(signal);const message=error instanceof Error?error.message:'configuration';return{content:[{type:'text',text:JSON.stringify({success:false,error:message in MANAGED_TOOL_ERRORS?message:'worker_failed',message:MANAGED_TOOL_ERRORS[message]||MANAGED_TOOL_ERRORS.worker_failed})}],details:{success:false},isError:true};}
      }},
  ];
}
