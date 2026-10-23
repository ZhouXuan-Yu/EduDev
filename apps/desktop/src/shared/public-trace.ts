import type {OfficePublicStage} from './office-agent';

export const MAX_PUBLIC_STAGES=64;
/** Additive metadata in existing host-owned Pi messages; old history is never inferred. */
export function readPublicStages(value:unknown):OfficePublicStage[]{
  if(!Array.isArray(value))return[];
  return value.slice(-MAX_PUBLIC_STAGES).flatMap(entry=>{
    if(!entry||!['preparing','waiting_model','responding'].includes(entry.stage)||!Number.isFinite(entry.since)||entry.since<=0)return[];
    if(entry.sequence!==undefined&&(!Number.isSafeInteger(entry.sequence)||entry.sequence<=0))return[];
    return[{stage:entry.stage,since:entry.since,...(entry.sequence===undefined?{}:{sequence:entry.sequence})}];
  });
}
