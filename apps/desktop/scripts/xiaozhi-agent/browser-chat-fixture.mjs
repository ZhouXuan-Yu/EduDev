import http from 'node:http';
import {once} from 'node:events';

export async function createBrowserChatFixture({url,resultText,separate=false,direct=false,onRequest}) {
const actions=[], checks=[];
let usedInitialRef=false;
let planned = false;
let guideRequested = false;
let problem, lastSnapshot, tabId, target;
function observe(messages) {
  const last=messages.findLast(message=>message.role==='tool');
  if (!last) return;
  const text=typeof last.content==='string'?last.content:JSON.stringify(last.content);
  lastSnapshot=text.match(/pisnapshot_[a-f0-9-]+/i)?.[0]??lastSnapshot;
  tabId=text.match(/pibrowser_[a-f0-9-]+/i)?.[0]??tabId;
  target=Number(text.replaceAll('\\','').match(/"matchedRef"\s*:\s*(\d+)/)?.[1]??target);
  return text;
}
const server=http.createServer(async(req,res)=>{
  if(req.url==='/v1/models')return res.end(JSON.stringify({object:'list',data:[{id:'deepseek-flash',input_modalities:['text'],context_window:1048576,max_output_tokens:32768}]}));
  let raw='';for await(const part of req)raw+=part;
  const body=JSON.parse(raw), last=observe(body.messages);
  const step=actions.length;
  if(direct && step===1 && lastSnapshot){
    const matches=[...(last||'').replaceAll('\\','').matchAll(/\[(\d+)\] button "筛选年级"/g)];
    if(matches.length===1){target=Number(matches[0][1]);usedInitialRef=true;}
  }
  const inputs=[
    {action:'navigate',url},
    ...usedInitialRef?[]:[{action:'snapshot',tabId,snapshotId:lastSnapshot,role:'button',name:'筛选年级'}],
    {action:'click',tabId,snapshotId:lastSnapshot,ref:target,...separate?{}:{expectText:resultText}},
    ...separate?[{action:'wait',tabId,snapshotId:lastSnapshot,text:resultText}]:[]
  ];
  const next=inputs[step]?.action;
  onRequest?.({at:Date.now(),next:!guideRequested?'guide':!planned?'plan':next||'answer'});
  const valid=next==='navigate'||next==='snapshot'&&lastSnapshot||next==='click'&&target>0||next==='wait'&&lastSnapshot||!next&&last?.includes(resultText);
  res.setHeader('content-type','text/event-stream');
  const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'browser-test',object:'chat.completion.chunk',created:1,model:'deepseek-flash',choices:[{index:0,delta,finish_reason}]})+'\n\n';
  if (!guideRequested) {
    const system = body.messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    const skill = (system.match(/<skill>[\s\S]*?<\/skill>/g) || []).find(block => block.includes('<name>education-evidence</name>'));
    const location = skill?.match(/<location>([^<]+)<\/location>/)?.[1];
    if (location) {
      guideRequested = true;
      return res.end(chunk({role:'assistant'})+chunk({tool_calls:[{index:0,id:'guide_1',type:'function',function:{name:'read',arguments:JSON.stringify({path:location})}}]})+chunk({},'tool_calls')+'data: [DONE]\n\n');
    }
    problem = {reason:'The current Pi system prompt did not advertise the enabled browser guide'};
  }
  if (!planned) {
    const system = body.messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
    if (guideRequested && last?.includes('内置浏览器操作手册') && last.includes('task_plan_required'))
      checks.push('Pi discovers and reads the managed browser guide');
    else problem ||= {reason:'The governed read did not return the current browser guide', detail:last?.slice(0,180)};
    const line = system.split('\n').findLast(l => l.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'));
    const task = line ? JSON.parse(line) : {requirementsVersion: 1, revision: 0};
    const steps = [
      {id:'open', text:'打开教学资料页面', kind:'web', target:url, dependsOn:[], reported:'pending'},
      {id:'filter', text:'点击筛选并核对列表', kind:'web', target:url, dependsOn:['open'], reported:'pending'},
      {id:'review', text:'教师核对结果', kind:'human', dependsOn:['filter'], reported:'pending'}
    ];
    const args = {schemaVersion:'xiaozhi.task-plan.v3', requirementsVersion:task.requirementsVersion,
      expectedRevision:task.revision, reason:'浏览老师指定的资源并核对筛选结果', steps};
    planned = true;
    return res.end(chunk({role:'assistant'})+chunk({tool_calls:[{index:0,id:'plan_1',type:'function',function:{name:'update_task_plan',arguments:JSON.stringify(args)}}]})+chunk({},'tool_calls')+'data: [DONE]\n\n');
  }
  if(!valid)problem={step,last:last?.slice(0,600),tools:body.tools?.map(t=>t.function.name)};
  if(step<inputs.length&&valid){
    const input={...inputs[step],taskStepId:next==='navigate'||next==='snapshot'?'open':'filter'};actions.push(input.action);
    return res.end(chunk({role:'assistant'})+chunk({tool_calls:[{index:0,id:'browser_'+step,type:'function',function:{name:'office_browser',arguments:JSON.stringify(input)}}]})+chunk({},'tool_calls')+'data: [DONE]\n\n');
  }
  return res.end(chunk({role:'assistant',content:valid?resultText:'夹具未读到真实工具结果'})+chunk({},'stop')+'data: [DONE]\n\n');
});
server.listen(0,'127.0.0.1');await once(server,'listening');
return {server, actions, checks, get problem(){return problem;},
  reset(){usedInitialRef=false;actions.length=0;checks.length=0;planned=false;guideRequested=false;problem=undefined;lastSnapshot=undefined;tabId=undefined;target=undefined;}
};
}
