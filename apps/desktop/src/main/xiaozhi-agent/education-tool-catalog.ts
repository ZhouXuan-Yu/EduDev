import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {createToolCatalog} from './vendor/hana/quality/core/tool-catalog';
import {ANSWER_QUALITY_PROMPT} from './answer-quality';

// Local question search/read form the core knowledge path, like material search/read.
// Pin only definitions already granted by the host; discovery still defers writes and enrichment.
const PINNED=new Set(['ask_teacher','read','read_education_memory','read_session_process','office_list_attachments','office_read_attachment','office_list_materials','education_search_materials','office_read_material','education_search_questions','education_read_question','office_list_files','office_read_text','search_teacher_knowledge','office_web_search','office_web_fetch','update_plan','update_task_plan','report_goal_progress']);
export const TOOL_DISCOVERY_NAME='find_education_tools';
/** Keep identity fingerprints unchanged; only the provider-facing assembly is scoped. */
export function createEducationToolCatalog(prompt:string,definitions:readonly ToolDefinition[]) {
  const catalog=createToolCatalog(),loaded=new Set<string>();
  const deferred=definitions.length>24;
  const rules=new Map<string,string[]>(),common:string[]=[];
  for(const line of prompt.split('\n')){
    const owners=definitions.filter(d=>new RegExp(`(?<![a-zA-Z0-9_])${d.name}(?![a-zA-Z0-9_])`).test(line));
    // Only move complete domain lines. General authority/privacy rules stay global.
    if(owners.length&&line.length>100){for(const owner of owners)rules.set(owner.name,[...(rules.get(owner.name)||[]),line]);}
    else common.push(line);
  }
  for(const def of definitions)catalog.registerSource(def.name,[{name:def.name,description:def.description,serverId:'education',origin:'builtin',schemaRef:()=>def.parameters}]);
  const description=(def:ToolDefinition)=>[def.description,...(rules.get(def.name)||[])].join('\n');
  function reset(query:string){
    loaded.clear();
    for(const def of definitions)if(!deferred||PINNED.has(def.name))loaded.add(def.name);
    // Hana BM25 adds task-relevant tools without an extra model request.
    if(deferred)for(const hit of catalog.search(query,{limit:6}))loaded.add(hit.name);
  }
  reset('');
  const tool:ToolDefinition={name:TOOL_DISCOVERY_NAME,label:'查找可用能力',description:'按教师任务查找当前已授权工具，加载参数及领域说明；需要的能力未列出时先查找。不会执行任务或增加权限。query可用中文或精确工具名。',
    parameters:{type:'object',properties:{query:{type:'string',minLength:1,maxLength:160}},required:['query'],additionalProperties:false} as ToolDefinition['parameters'],
    execute:async(_id,args,signal)=>{
      signal?.throwIfAborted();
      if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).join(',')!=='query'||typeof (args as {query?:unknown}).query!=='string')throw Error('invalid_input');
      const query=(args as {query:string}).query.trim();if(!query||query.length>160)throw Error('invalid_input');
      const hits=catalog.search(query,{limit:6});
      for(const hit of hits)loaded.add(hit.name);
      return {content:[{type:'text',text:JSON.stringify({tools:hits.map(hit=>{const def=definitions.find(d=>d.name===hit.name)!;return{name:def.name,description:description(def),parameters:def.parameters};}),note:'仅加载说明；执行仍须通过宿主授权与确认。'})}],details:{success:true,data:{count:hits.length}}};
    }};
  return {tool,reset,description,
    exposed:(name:string)=>name===TOOL_DISCOVERY_NAME||loaded.has(name),
    prompt:[...common,ANSWER_QUALITY_PROMPT,deferred?'可通过 find_education_tools 查找尚未加载的教育、文件制作及外部服务工具。目录摘要只是能力说明，不表示已执行或有资料。\n'+catalog.manifest(1800).text:''].filter(Boolean).join('\n'),
    deferred,
  };
}
