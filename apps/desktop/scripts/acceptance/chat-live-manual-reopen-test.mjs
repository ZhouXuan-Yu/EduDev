import test from 'node:test';
import assert from 'node:assert/strict';
import {reopenProcessDuringStream, verifyManualReopen} from './chat-live-manual-reopen.mjs';

const sessionId='owned-session', runId='owned-run';
const event=(sequence,kind,extra={})=>({sessionId,runId,sequence,kind,...extra});
const finalEvents=[event(92,'assistant_phase',{phase:'final_answer'}),event(94,'text_delta',{chars:4}),event(98,'text_delta',{chars:8}),event(110,'status',{status:'completed'})];
const evidence=(required=true)=>({sessionId,runId,required,before:{running:true},after:{running:true},afterSequence:95});

test('requires a later final public delta from the same session/run and retained open state',()=>{
  const proof=verifyManualReopen(evidence(),finalEvents,'true');
  assert.equal(proof.status,'passed');assert.equal(proof.publicDeltasAfterManualReopen,1);assert.equal(proof.firstPublicDeltaSequence,98);
});
test('earlier tokens, other run/session, commentary, zero-length or post-terminal deltas cannot satisfy gate',()=>{
  const events=[...finalEvents.filter(item=>item.sequence!==98),
    event(99,'text_delta',{runId:'other',chars:10}),event(100,'text_delta',{sessionId:'other',chars:10}),
    event(101,'text_delta',{chars:0}),event(102,'assistant_phase',{phase:'commentary'}),
    event(103,'text_delta',{chars:10}),event(104,'assistant_phase',{phase:'final_answer'}),
    event(111,'text_delta',{chars:10})];
  const proof=evidence();assert.throws(()=>verifyManualReopen(proof,events,'true'),/subsequent-final-public-delta/);
  assert.equal(proof.status,'missing-evidence');assert.equal(proof.publicDeltasAfterManualReopen,0);
});
test('late reopening fails even when later-looking event metadata exists',()=>{
  const proof=evidence();proof.after={running:false,terminalSequence:110};
  assert.throws(()=>verifyManualReopen(proof,finalEvents,'true'),/live-reopen-window/);
});
test('open must survive completion before screenshot interactions',()=>{
  assert.throws(()=>verifyManualReopen(evidence(),finalEvents,'false'),/open-at-completion/);
});
test('optional mode explicitly reports missing evidence rather than claiming a pass',()=>{
  const proof=verifyManualReopen(evidence(false),[],'true');assert.equal(proof.status,'missing-evidence');
  assert.deepEqual(proof.missing,['subsequent-final-public-delta']);
});
async function interaction(after={running:true,expanded:'true',sourceSequence:97,eventSequence:96}) {
  const actions=[],proof={sessionId,runId,required:true};
  const checkpoints=[{running:true,expanded:'false',sourceSequence:94,eventSequence:94},after];
  const trigger={focus:async()=>actions.push('focus'),evaluate:async()=>true,press:async key=>actions.push(key)};
  const options={page:{evaluate:async()=>{actions.push('checkpoint');return checkpoints.shift();}},
    turn:{getByTestId:id=>{assert.equal(id,'agent-trace-toggle');return trigger;}},sessionId,runId,evidence:proof};
  return {actions,proof,run:()=>reopenProcessDuringStream(options)};
}
test('real interaction API is focus then Enter with conservative post-action sequence barrier',async()=>{
  const {actions,proof,run}=await interaction();await run();
  assert.deepEqual(actions,['checkpoint','focus','Enter','checkpoint']);assert.equal(proof.afterSequence,97);
});
test('stream ending during keyboard interaction fails and leaves diagnostic evidence',async()=>{
  const {proof,run}=await interaction({running:false,expanded:'true',sourceSequence:110,eventSequence:110,terminalSequence:110});
  await assert.rejects(run(),/missed the live stream window/);assert.equal(proof.status,'missing-evidence');
});
