import assert from 'node:assert/strict';
import {createPiTextViewBuffer,mergePiViewSnapshot} from '../../src/renderer/components/office/pi-text-view-buffer.ts';
let passed=0;
const event=(sequence,delta='字',extra={})=>({sessionId:'A',runId:'R',generation:1,sequence,kind:'text_delta',delta,...extra});
function fixture(){let time=0;const timers=[],applied=[];const buffer=createPiTextViewBuffer({now:()=>time,schedule:(callback,ms)=>{const timer={callback,due:time+ms,cancelled:false};timers.push(timer);return()=>timer.cancelled=true;},text:value=>applied.push({kind:'text',...value}),immediate:value=>applied.push(value)});return {buffer,timers,applied,advance:ms=>{time+=ms;for(const timer of [...timers])if(!timer.cancelled&&timer.due<=time){timer.cancelled=true;timer.callback();}}};}
{
 const f=fixture();f.buffer.accept(event(2,'首'));assert.equal(f.applied.length,1);f.buffer.accept(event(3,'中'));f.buffer.accept(event(4,'尾'));assert.equal(f.applied.length,1);f.advance(31);assert.equal(f.applied.length,1);f.advance(1);assert.deepEqual(f.applied.map(v=>v.delta),['首','中尾']);assert.equal(f.applied[1].firstSequence,3);assert.equal(f.applied[1].throughSequence,4);passed++;
}
{
 const f=fixture();f.buffer.accept(event(1,'a'));f.buffer.accept(event(2,'b'));f.buffer.accept(event(3,'',{kind:'status',status:'completed'}));assert.deepEqual(f.applied.map(v=>v.kind),['text','text','status']);assert.equal(f.applied[1].delta,'b');f.advance(100);assert.equal(f.applied.length,3);passed++;
}
for(const barrier of [{kind:'assistant_start',segment:1},{kind:'assistant_end',segment:0,final:false},{kind:'approval',approval:{}},{kind:'tool_start',callId:'x',tool:'read'},{kind:'control',control:{}}]){
 const f=fixture();f.buffer.accept(event(1,'a'));f.buffer.accept(event(2,'b'));f.buffer.accept(event(3,'',barrier));f.buffer.accept(event(4,'c'));assert.deepEqual(f.applied.map(v=>v.kind),['text','text',barrier.kind,'text']);assert.equal(f.applied.at(-1).delta,'c');passed++;
}
for(const extra of [{runId:'other'},{sessionId:'B'},{generation:2},{sequence:9}]){
 const f=fixture();f.buffer.accept(event(1,'a'));f.buffer.accept(event(2,'b'));f.buffer.accept(event(3,'c',extra));assert.deepEqual(f.applied.map(v=>v.delta),['a','b','c']);passed++;
}
{
 const f=fixture();f.buffer.accept(event(1,'first'));for(let i=2;i<=129;i++)f.buffer.accept(event(i,'x'));assert.equal(f.applied.length,2);assert.equal(f.applied[1].delta.length,128);f.advance(100);assert.equal(f.applied.length,2);passed++;
}
{
 const f=fixture();f.buffer.accept(event(1,'a'));f.buffer.accept(event(2,'x'.repeat(65535)));f.buffer.accept(event(3,'y'));assert.equal(f.applied.at(-1).delta.length,65536);assert(f.timers.every(t=>t.cancelled));passed++;
}
{
 const f=fixture();f.buffer.accept(event(1,'a'));f.buffer.accept(event(2,'x'.repeat(65535)));f.buffer.accept(event(3,'yz'));f.buffer.flush();assert.equal(f.applied.map(v=>v.delta).join(''),'a'+'x'.repeat(65535)+'yz');assert(f.applied.every(v=>v.delta.length<=65536));passed++;
}
{
 const f=fixture();f.buffer.accept(event(1,'a'));f.buffer.accept(event(2,'b'));f.buffer.accept(event(3,'大'.repeat(65537)));assert.equal(f.applied.at(-1).delta.length,65537);assert.equal(f.applied.length,3);passed++;
}
{
 const f=fixture();f.buffer.accept(event(1,'先'));f.buffer.accept(event(2,'\ud83e'));f.buffer.accept(event(3,'\uddee后'));f.buffer.flush();assert.equal(f.applied.map(v=>v.delta).join(''),'先🧮后');passed++;
}
{
 const f=fixture();f.buffer.accept(event(1,'a'));f.buffer.accept(event(2,'old'));const stale=f.timers[0];f.buffer.clear();f.buffer.accept(event(1,'b',{sessionId:'B'}));f.buffer.accept(event(2,'new',{sessionId:'B'}));stale.callback();assert.equal(f.applied.length,2);f.advance(32);assert.equal(f.applied.at(-1).delta,'new');passed++;
}
{
 const f=fixture();f.buffer.accept(event(1,'a'));f.buffer.accept(event(2,'b'));f.buffer.flush();f.buffer.flush();assert.equal(f.applied.map(v=>v.delta).join(''),'ab');assert.equal(f.buffer.pendingRuns(),1);f.buffer.accept(event(3,'',{kind:'status',status:'completed'}));assert.equal(f.buffer.pendingRuns(),1);f.buffer.clear();assert.equal(f.buffer.pendingRuns(),0);passed++;
}
const turn=(id,status='running')=>({id,status,items:[]});
const snapshot=(turns,cursors,hasMoreHistory=false)=>({enabled:true,running:turns.at(-1)?.status==='running',legacyHistory:false,projection:{threadId:'A',turns,sourceSequence:999,hasMoreHistory},eventCursors:cursors});
const cursor=(runId,sequence,generation=1)=>({runId,sequence,generation,revision:sequence});
{
 const f=fixture();f.buffer.accept(event(1,'a',{runId:'A'}));f.buffer.accept(event(1,'b',{runId:'B'}));f.buffer.accept(event(2,'c',{runId:'A'}));assert(!f.buffer.canReplace(snapshot([turn('B')],[cursor('B',1)])));const full=snapshot([turn('A'),turn('B')],[cursor('A',2),cursor('B',1)]);assert(f.buffer.canReplace(full));f.buffer.flush();f.buffer.acknowledge(full);assert.equal(f.buffer.pendingRuns(),0);passed++;
}
{
 const f=fixture();f.buffer.accept(event(2,'a'));assert(!f.buffer.canReplace(snapshot([turn('R')],[])),'Active sourceSequence alone is not generation evidence');assert(!f.buffer.canReplace(snapshot([turn('R')],[cursor('R',99,2)])));assert(!f.buffer.canReplace(snapshot([turn('R')],[cursor('R',1)])));assert(f.buffer.canReplace(snapshot([turn('R')],[cursor('R',2)])));passed++;
}
{
 const f=fixture();f.buffer.accept(event(3,'',{kind:'status',status:'completed',runId:'old'}));f.buffer.accept(event(1,'',{kind:'status',status:'completed',runId:'next'}));const prior={threadId:'A',turns:[turn('old','completed'),turn('next','completed')]};const page=snapshot([turn('next','completed')],[cursor('next',1)],true);assert(f.buffer.canReplace(page,prior));assert(!f.buffer.canReplace({...page,projection:{...page.projection,hasMoreHistory:false}},prior));assert(!f.buffer.canReplace(page));f.buffer.acknowledge(page,prior);assert.equal(f.buffer.pendingRuns(),0);passed++;
}
{
 const f=fixture();f.buffer.accept(event(3,'',{kind:'status',status:'running',runId:'old'}));const prior={threadId:'A',turns:[turn('old'),turn('next','completed')]};assert(!f.buffer.canReplace(snapshot([turn('next','completed')],[cursor('next',1)],true),prior));passed++;
}
{
 const f=fixture();f.buffer.accept(event(3,'',{kind:'status',status:'completed',runId:'new'}));const prior={threadId:'A',turns:[turn('old','completed'),turn('new','completed')]};assert(!f.buffer.canReplace(snapshot([turn('old','completed')],[cursor('old',1)],true),prior),'A missing latest completed run is not a safe page retirement');passed++;
}
{
 const f=fixture();for(let index=0;index<1000;index++){const id='run'+index;f.buffer.accept(event(1,'',{kind:'status',status:'completed',runId:id}));f.buffer.acknowledge(snapshot([turn(id,'completed')],[cursor(id,1)]));assert.equal(f.buffer.pendingRuns(),0);}passed++;
}
{
 const f=fixture();const turns=[];for(let index=0;index<41;index++){const id='run'+index;turns.push(turn(id,'completed'));f.buffer.accept(event(1,'',{kind:'status',status:'completed',runId:id}));}const page=snapshot(turns.slice(1),turns.slice(1).map(turn=>cursor(turn.id,1)),true);assert(f.buffer.canReplace(page,{threadId:'A',turns}));f.buffer.acknowledge(page,{threadId:'A',turns});assert.equal(f.buffer.pendingRuns(),0);passed++;
}
{
 const changed={...turn('old','completed'),items:[{id:'new',kind:'message',role:'assistant',text:'queued prefix'}]},previous=snapshot([changed,turn('next','completed')],[cursor('old',2),cursor('next',1)]),current=snapshot([turn('next','completed'),turn('new')],[cursor('next',1),cursor('new',1)],true);const merged=mergePiViewSnapshot(previous,current);assert.deepEqual(merged.projection.turns.map(turn=>turn.id),['old','next','new']);assert.equal(merged.projection.turns[0],changed);assert.equal(merged.projection.hasMoreHistory,false);passed++;
}
{
 const previous=snapshot([turn('old'),turn('next')],[cursor('old',1),cursor('next',1)],true),current=snapshot([turn('next')],[cursor('next',2)],true);assert.equal(mergePiViewSnapshot(previous,current).projection.hasMoreHistory,true);assert.equal(mergePiViewSnapshot(previous,{...current,projection:{...current.projection,threadId:'B'}}).projection.threadId,'B');passed++;
}
{
 const previous=snapshot([turn('old'),turn('next')],[cursor('old',1),cursor('next',1)]),current=snapshot([turn('old'),turn('next')],[cursor('old',1),cursor('next',2)]);assert.equal(mergePiViewSnapshot(previous,current),current);assert.equal(mergePiViewSnapshot(undefined,current),current);passed++;
}
{
 const f=fixture();f.buffer.accept(event(2,'',{kind:'status',status:'completed',runId:'old'}));const previous=snapshot([turn('old','completed'),turn('A','completed')],[cursor('old',2),cursor('A',1)]),current=snapshot([turn('X'),turn('A','completed')],[cursor('X',1),cursor('A',1)],true);assert(!f.buffer.canReplace(current,previous.projection),'A non-first overlap cannot prove a retained prefix');passed++;
}
{
 const f=fixture();f.buffer.accept(event(2,'a',{runId:'A'}));const previous=snapshot([turn('old','completed'),turn('A'),turn('B')],[cursor('old',1),cursor('A',2),cursor('B',1)]),current=snapshot([turn('B'),turn('A')],[cursor('A',2),cursor('B',1)],true);assert(!f.buffer.canReplace(current,previous.projection));assert.equal(mergePiViewSnapshot(previous,current),previous);passed++;
}
{
 const previous=snapshot([turn('old','completed'),turn('next')],[cursor('old',1),cursor('next',1)]),current=snapshot([turn('next')],[cursor('next',2)],true);const merged=mergePiViewSnapshot(previous,current,[cursor('old',3)]);assert.equal(merged.eventCursors.find(value=>value.runId==='old').sequence,3);assert.equal(merged.eventCursors.find(value=>value.runId==='next').sequence,2);passed++;
}

for (const [ids,next] of [[['old','A'],['X','A']],[['A','B','C'],['A','C']],[['A','B','C'],['B','X','C']],[['A','B'],['X','Y']],[['A','B'],['A','B','A']]]) {
 const f=fixture(),previous=snapshot(ids.map(id=>turn(id,'completed')),ids.map(id=>cursor(id,1))),current=snapshot(next.map(id=>turn(id,'completed')),next.map(id=>cursor(id,1)),true);
 assert.equal(f.buffer.pendingRuns(),0);assert(!f.buffer.canReplace(current,previous.projection));assert.equal(mergePiViewSnapshot(previous,current),previous);passed++;
}
{
 const f=fixture(),previous=snapshot([turn('A','completed'),turn('pending-send')],[cursor('A',1)]),current=snapshot([turn('A','completed'),turn('new')],[cursor('A',1),cursor('new',1)],true);assert(f.buffer.canReplace(current,previous.projection));assert.equal(mergePiViewSnapshot(previous,current),current);passed++;
}
console.log(JSON.stringify({suite:'pi-text-view-buffer',passed,total:37,skipped:0}));assert.equal(passed,37);
