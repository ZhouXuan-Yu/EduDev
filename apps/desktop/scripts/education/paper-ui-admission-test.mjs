import assert from 'node:assert/strict';
import {admitPaperEnter} from './paper-ui-admission.mjs';

async function fixture(mode){
 let ticks=0,presses=0;
 const report={},existing={command_id:'previous',run_id:'old-run',status:'finished'};
 const admitted={command_id:'new-command',run_id:'new-run',status:'running'};
 const input={isDisabled:async()=>false,inputValue:async()=>presses&&ticks>=6&&mode!=='retained'?'':'seeded request',press:async key=>{assert.equal(key,'Enter');presses++;}};
 const commands=()=>[existing,...(presses&&ticks>=2&&mode!=='no-admission'?[admitted,...(mode==='duplicate'?[{...admitted,command_id:'duplicate'}]:[])]:[])];
 const snapshot=async()=>({running:false,projection:{turns:[{id:'old-run'},...(presses&&ticks>=3?[{id:'new-run'}]:[{id:'pending-send'}])]}});
 const until=async predicate=>{for(let count=0;count<12;count++){if(await predicate())return;ticks++;await Promise.resolve();}throw Error('fixture timeout');};
 let result,error;
 try{result=await admitPaperEnter({input,send:{isDisabled:async()=>false},snapshot,commands,until,report,label:mode});}catch(caught){error=caught;}
 return {result,error,presses,evidence:report.admissions[0]};
}
const delayed=await fixture('delayed');
assert.equal(delayed.error,undefined);assert.equal(delayed.result,'new-run');assert.equal(delayed.presses,1);assert.equal(delayed.evidence.inputCleared,true);
console.log('PASS real admission is required before delayed input-clear assertion');
for(const mode of ['no-admission','retained','duplicate']){
 const result=await fixture(mode);assert(result.error);assert.equal(result.presses,1);assert.equal(result.evidence.inputCleared,false);
 if(mode==='retained'){assert.equal(result.evidence.admitted,true);assert.equal(result.evidence.inputRetained,true);}
 if(mode==='no-admission')assert.equal(result.evidence.admitted,false);
 if(mode==='duplicate')assert.match(result.error.message,/multiple commands/);
 console.log('PASS '+mode+' fails without retrying Enter or hiding the failed clear');
}
console.log('Paper admission helper: 4 scenarios passed; fake timing only, no Electron/model/fixture writes.');
