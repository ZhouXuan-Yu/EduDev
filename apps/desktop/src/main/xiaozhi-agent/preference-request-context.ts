import type {TranscriptContext} from '@earendil-works/pi-ai';

const requestMarker='\n\n[教师本次请求]\n';
const legacyGuidance=new Map([
 ['[当前教师表达偏好：本机已保存的明确要求；非学生事实、权限或答案依据]','仅在适合任务且教师本次未另行指定时采用；本次明确要求优先。'],
 ['[本轮表达方式试用：来自多次实际讲解修正，尚未成为长期习惯]','仅在当前任务未另有要求时采用；本轮正常完成教学讲解'],
 ['[教师本轮明确要求的讲解修正，仅适用于当前回答]','按本轮要求重写当前讲解，不称已保存长期习惯。'],
]);
const legacyConcise='简洁讲解以约400–600字为宜，含公式和表格尽量控制在800字内。';
const legacySummary=/^(?:The conversation history before this point was compacted into the following summary:|The following is a summary of a branch that this conversation came back from:)\n\n<summary>\n/;

function stripBlocks(text:string):string {
 const lines=text.split('\n'),retained:string[]=[];
 let changed=false;
 for(let i=0;i<lines.length;i++){
  const guidance=legacyGuidance.get(lines[i]);
  if(guidance&&/^(?:\{.*\}|\[.*\])$/.test(lines[i+1]||'')&&lines[i+2]?.startsWith(guidance)){
   changed=true;
   i+=2;
   if(lines[i+1]?.startsWith(legacyConcise))i++;
  }else retained.push(lines[i]);
 }
 return changed?retained.join('\n'):text;
}

function withoutLegacyPreferences(text:string){
 const marker=text.indexOf(requestMarker);
 if(marker>=0)return stripBlocks(text.slice(0,marker))+text.slice(marker);
 return legacySummary.test(text)?stripBlocks(text):text;
}

/** Request projection only. Neither prior turns nor current preferences are written to history. */
export function projectTeacherPreferenceRequest(context:TranscriptContext,submittedText?:string,guidance=''):TranscriptContext {
 const current=guidance&&submittedText?context.messages.findLastIndex(message=>message.role==='user'
  &&(typeof message.content==='string'?message.content===submittedText:
   message.content.some(part=>part.type==='text'&&part.text===submittedText))):-1;
 const messages=context.messages.map<TranscriptContext['messages'][number]>((message,index)=>{
  if(message.role!=='user')return message;
  if(typeof message.content==='string'){
   const text=withoutLegacyPreferences(message.content);
   return {...message,content:index===current?[{type:'text',text},{type:'text',text:guidance}]:text};
  }
  const filtered=message.content.map(part=>part.type==='text'?{...part,text:withoutLegacyPreferences(part.text)}:part);
  if(index===current)filtered.push({type:'text',text:guidance});
  return {...message,content:filtered};
 });
 return {...context,messages};
}
