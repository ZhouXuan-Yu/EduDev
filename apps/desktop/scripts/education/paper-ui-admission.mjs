import assert from 'node:assert/strict';

/** Observe the real Enter path once. Never invoke IPC send or retry a request. */
export async function admitPaperEnter({input,send,snapshot,commands,until,report,label}){
 await until(async()=>!await input.isDisabled()&&!await send.isDisabled()&&!(await snapshot()).running,30000);
 assert((await input.inputValue()).trim(),'Paper request is empty');
 const before=new Set(commands().map(row=>row.command_id));
 const evidence={label,enterPresses:0,admitted:false,inputCleared:false};
 (report.admissions??=[]).push(evidence);
 try{
  await input.press('Enter');evidence.enterPresses=1;
  let admitted;
  await until(async()=>{
   const fresh=commands().filter(row=>!before.has(row.command_id));
   assert(fresh.length<=1,'One Enter admitted multiple commands; never resend');
   if(fresh.length!==1||!fresh[0].run_id)return false;
   const state=await snapshot();
   if(!state.projection.turns.some(turn=>turn.id===fresh[0].run_id&&turn.id!=='pending-send'))return false;
   admitted=fresh[0];return true;
  },30000);
  Object.assign(evidence,{admitted:true,commandId:admitted.command_id,runId:admitted.run_id,status:admitted.status});
  await until(async()=>await input.inputValue()==='',30000);
  assert.equal(await input.inputValue(),'');
  assert.equal(commands().filter(row=>!before.has(row.command_id)).length,1,'Duplicate send detected');
  evidence.inputCleared=true;
  return admitted.run_id;
 }catch(error){
  // Metadata only: never save the request text, full snapshot or reasoning.
  evidence.commands=commands().filter(row=>!before.has(row.command_id)).map(({command_id,run_id,status})=>({commandId:command_id,runId:run_id,status}));
  evidence.inputRetained=(await input.inputValue())!=='';
  throw error;
 }
}
