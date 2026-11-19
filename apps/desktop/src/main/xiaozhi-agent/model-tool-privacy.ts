/** Provider context only. Native receipts, source evidence and local terminal
 * views retain their original bytes and continue to own all authorization. */
const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const readers=new Set(['office_read_document','office_read_attachment']);
const terminals=new Set(['exec_command','write_stdin','list_terminals','close_terminal']);
const tools=new Set([...readers,...terminals,'office_list_attachments','read_session_process']);
const protectedPrefix='[小智本会话本地记录，非新增授权]\n';
const protectedText=(value:unknown):value is string=>typeof value==='string'&&value.startsWith(protectedPrefix);
const protectedMessage=(message:Record<string,any>)=>message.role==='user'&&(protectedText(message.content)||Array.isArray(message.content)&&message.content.some(part=>object(part)&&part.type==='text'&&protectedText(part.text)));

export function createModelToolPrivacy(options:{sanitizer:()=>Promise<(text:string)=>Promise<string>>;current?:()=>boolean}){
 async function context<T>(messages:T[],signal?:AbortSignal):Promise<T[]>{
  if(!messages.some(message=>object(message)&&(message.role==='toolResult'&&tools.has(message.toolName)||protectedMessage(message))))return messages;
  const fence=()=>{signal?.throwIfAborted();if(options.current&&!options.current())throw Error('permission_denied');};
  fence();let clean:Awaited<ReturnType<typeof options.sanitizer>>|undefined;
  const sanitize=async(text:string)=>{fence();clean??=await options.sanitizer();fence();const value=await clean(text);fence();return value;};
  // Older native user messages can already contain a host-generated fact index.
  // Rebuild only its display fields; do not sanitize IDs/hashes or the teacher's
  // following request as one serialized blob, and never rewrite native history.
  const protectedIndex=async(text:string)=>{
   const lines=text.split('\n');let changed=false;
   const fields:Record<string,string[]>={'文件审批：':['source','target'],'文件修改：':['file'],'办公产物：':['file'],'教师要求：':['text']};
   for(let index=1;index<lines.length;index++){
    const line=lines[index];if(line==='[教师本次请求]')break;
    if(line.startsWith('已检索来源标题：')){
     const title=await sanitize(line.slice('已检索来源标题：'.length));const next='已检索来源标题：'+title;if(next!==line){changed=true;lines[index]=next;}continue;
    }
    const label=Object.keys(fields).find(value=>line.startsWith(value))||(line.startsWith('计划：')?'计划：':undefined);if(!label)continue;
    let record:unknown;try{record=JSON.parse(line.slice(label.length));}catch{continue;}
    const before=JSON.stringify(record);
    if(label==='计划：'&&Array.isArray(record)){for(const step of record)if(object(step)&&typeof step.text==='string')step.text=await sanitize(step.text);}
    else if(object(record))for(const field of fields[label])if(typeof record[field]==='string')record[field]=await sanitize(record[field]);
    const after=JSON.stringify(record);if(after!==before){changed=true;lines[index]=label+after;}
   }
   return changed?lines.join('\n'):text;
  };
  const output:T[]=[];
  for(const message of messages){
   if(object(message)&&protectedMessage(message)){
    if(protectedText(message.content)){const content=await protectedIndex(message.content);output.push((content===message.content?message:{...message,content}) as T);}
    else{let changed=false;const content=[];for(const part of message.content){if(object(part)&&part.type==='text'&&protectedText(part.text)){const text=await protectedIndex(part.text);changed||=text!==part.text;content.push(text===part.text?part:{...part,text});}else content.push(part);}output.push((changed?{...message,content}:message) as T);}
    continue;
   }
   if(!object(message)||message.role!=='toolResult'||!tools.has(message.toolName)||!Array.isArray(message.content)){output.push(message);continue;}
   let changed=false;const content=[];
   for(const part of message.content){
    if(!object(part)||part.type!=='text'||typeof part.text!=='string'){content.push(part);continue;}
    let parsed:unknown;try{parsed=JSON.parse(part.text);}catch{}
    let text=part.text;
    if(object(parsed)){
     const value=structuredClone(parsed);
     const field=async(row:unknown,key:string)=>{if(object(row)&&typeof row[key]==='string')row[key]=await sanitize(row[key]);};
     if(readers.has(message.toolName)){await field(value,'text');await field(value.source,'title');await field(value,'citation');}
     if(message.toolName==='office_list_attachments'&&Array.isArray(value.items))for(const item of value.items)await field(item,'name');
     if(terminals.has(message.toolName)){
      const terminal=async(row:unknown)=>{if(!object(row))return;for(const key of ['output','command','cwd'])await field(row,key);};
      await terminal(value);await terminal(value.terminal);if(object(value.job))await terminal(value.job.terminal);
      if(Array.isArray(value.jobs))for(const job of value.jobs)if(object(job))await terminal(job.terminal);
     }
     if(message.toolName==='read_session_process'&&object(value.trace)&&Array.isArray(value.trace.events))for(const event of value.trace.events)await field(event,'label');
     const serialized=JSON.stringify(value);if(serialized!==JSON.stringify(parsed))text=serialized;
    }else text=await sanitize(text); // Appended citations and typed error text.
    if(text!==part.text){changed=true;content.push({...part,text});}else content.push(part);
   }
   output.push((changed?{...message,content}:message) as T);
  }
  fence();return output;
 }
 return{context};
}
export type ModelToolPrivacy=ReturnType<typeof createModelToolPrivacy>;
