import type {SessionManager} from '@earendil-works/pi-coding-agent';
import {withoutPlanBasisReference} from '../plan-native';
import type {PiMemoryRuntime} from '../memory-tools';

const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);

// Display aliases depend on the request order. Compare the actual body and provenance.
function identity(body:Record<string,unknown>) {
  return JSON.stringify([body.layer,body.source,body.version,body.text,body.provenance,
    body.refs,body.sourceDocuments,body.history,body.personal]);
}

function latestRead(manager:Pick<SessionManager,'getBranch'>):Record<string,unknown>[] {
  const entry=manager.getBranch().findLast(entry=>entry.type==='message'&&entry.message.role==='toolResult'
    &&entry.message.toolName==='read_education_memory'&&!entry.message.isError);
  if(entry?.type!=='message'||entry.message.role!=='toolResult')return [];
  const message=entry.message;
  if(!record(message.details)||message.details.success!==true)return [];
  const content=withoutPlanBasisReference(message.content,message.toolCallId,message.toolName);
  if(content.length!==1)return [];
  const [part]=content;
  if(!record(part)||part.type!=='text'||typeof part.text!=='string')return [];
  try{
    const result:unknown=JSON.parse(part.text);
    return record(result)&&Array.isArray(result.memories)&&result.memories.length<=12&&result.memories.every(record)
      ?result.memories:[];
  }catch{return [];}
}

export async function protectedMemoryReadback(
  manager:Pick<SessionManager,'getBranch'>,runtime:PiMemoryRuntime,authority:string,
  currentPersonalIds:readonly string[],signal?:AbortSignal,
) {
  signal?.throwIfAborted();
  const received=latestRead(manager).filter(body=>body.layer!=='personal'||record(body.personal)
    &&typeof body.personal.sourceId==='string'&&currentPersonalIds.includes(body.personal.sourceId));
  if(!received.length)return [];
  const ids=received.flatMap(body=>body.layer==='personal'&&record(body.personal)&&typeof body.personal.sourceId==='string'
    ?[body.personal.sourceId]:[]);
  const allowed=new Set(received.map(identity));
  const current=await runtime.readSelected(authority,signal,ids);
  signal?.throwIfAborted();
  return current.filter(body=>allowed.has(identity(body)));
}
