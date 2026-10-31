const terminal=new Set(['succeeded','completed','failed','cancelled','interrupted','stopped']);

/** Allow the final durable plan/list update to settle, then retain a true failure. */
export function createClassroomOutlineWait({graceMs=3000,now=Date.now}={}){
 let terminalSince;
 return(planCount,runStatus)=>{
  if(planCount===1){terminalSince=undefined;return true;}
  if(planCount>1)throw Error('classroom_outline_count_unexpected');
  if(!terminal.has(runStatus)){terminalSince=undefined;return false;}
  terminalSince??=now();
  if(now()-terminalSince>=graceMs){
   const error=Error('classroom_outline_missing: terminal run '+runStatus+' produced no persisted outline');
   error.code='classroom_outline_missing';throw error;
  }
  return false;
 };
}
