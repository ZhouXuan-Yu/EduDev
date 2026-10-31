/** Fixed report DTO. Never forward turn/items/text/errors/payload by reference. */
export function paperReviewRunMetadata(turn){
  if(!turn||typeof turn!=='object')return null;
  const status=value=>['pending','running','completed','failed','interrupted','blocked','cancelled'].includes(value)?value:'unknown';
  const safeCode=value=>['task_blocked','task_plan_required','task_tool_scope','task_step_missing',
    'task_dependency_blocked','task_step_already_verified','task_target_invalid','cancelled',
    'invalid_input','permission_denied','conflict','unavailable'].includes(value)?value:undefined;
  const items=Array.isArray(turn.items)?turn.items:null;
  const counts={message:0,tool:0,other:0};
  if(items){
    for(const item of items)counts[item?.kind==='message'?'message':item?.kind==='tool'?'tool':'other']++;
  }else{
    for(const kind of Object.keys(counts)){
      const value=turn.itemKindCounts?.[kind];
      if(Number.isSafeInteger(value)&&value>=0)counts[kind]=value;
    }
  }
  const tools=items?items.filter(item=>item?.kind==='tool'):Array.isArray(turn.tools)?turn.tools:[];
  return{
    id:typeof turn.id==='string'&&/^run_[a-zA-Z0-9_-]{1,160}$/.test(turn.id)?turn.id:null,
    status:status(turn.status),itemKindCounts:counts,
    tools:tools.filter(tool=>tool&&typeof tool==='object').map(tool=>({
      tool:typeof (tool.toolName??tool.tool)==='string'&&/^[a-z][a-z0-9_]{0,95}$/.test(tool.toolName??tool.tool)?(tool.toolName??tool.tool):'unknown',
      status:status(tool.status),code:safeCode(tool.toolAttempt?.code??tool.code),
    })),
  };
}
