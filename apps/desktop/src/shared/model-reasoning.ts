import type {OfficeModelReasoning} from './office-agent';
export const MAX_REASONING_TEXT=65536;
export const MAX_REASONING_BLOCKS=32;
/** Readback is deliberately independent of SDK transcript/signatures. */
export function readModelReasoning(value:unknown):OfficeModelReasoning[]{
  if(!value||typeof value!=='object'||!('version' in value)||value.version!==1||!('blocks' in value)||!Array.isArray(value.blocks))return[];
  let remaining=MAX_REASONING_TEXT;
  const seen=new Set<string>();
  return value.blocks.slice(0,MAX_REASONING_BLOCKS).flatMap((b:unknown)=>{
    if(!b||typeof b!=='object')return[];
    const block=b as OfficeModelReasoning;
    if(typeof block.id!=='string'||!/^reasoning:\d+:\d+$/.test(block.id)||seen.has(block.id)||block.source!=='provider'
      ||typeof block.text!=='string'||!['streaming','completed','interrupted','failed'].includes(block.status)
      ||!Number.isFinite(block.startedAt)||block.startedAt<=0||!Number.isFinite(block.durationMs)||block.durationMs<0)return[];
    seen.add(block.id);
    const text=block.text.slice(0,remaining);remaining-=text.length;
    return[{id:block.id,source:'provider' as const,text,status:block.status,startedAt:block.startedAt,durationMs:block.durationMs,
      ...(block.truncated||text.length<block.text.length?{truncated:true}:{})}];
  });
}
