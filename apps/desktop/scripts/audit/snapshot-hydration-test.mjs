import assert from 'node:assert/strict';
import {createPiSnapshotHydrator} from '../../src/renderer/components/office/pi-snapshot-hydrator.ts';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
let passed=0;
function fixture(extra={}){const reads=[],values=[],failures=[];const gate=createPiSnapshotHydrator({read:target=>{const next=deferred();reads.push({target,...next});return next.promise;},publish:value=>values.push(value),failed:()=>failures.push(true),...extra});return {gate,reads,values,failures};}
{
 const f=fixture();f.gate.open('A');const a=f.gate.hydrate('A'),b=f.gate.hydrate('A');assert.equal(a,b);await tick();assert.equal(f.reads.length,1);f.reads[0].resolve('current');await a;assert.deepEqual(f.values,['current']);assert(!f.gate.needsRecovery());passed++;
}
{
 const f=fixture();f.gate.open('A');const a=f.gate.hydrate('A');await tick();for(let i=0;i<100;i++)f.gate.changed();assert.equal(a,f.gate.hydrate('A'));f.reads[0].resolve('stale');await tick();assert.equal(f.reads.length,2);assert.deepEqual(f.values,[]);f.reads[1].resolve('last');await a;assert.deepEqual(f.values,['last']);passed++;
}
{
 const f=fixture();f.gate.open('A');const a=f.gate.hydrate('A');await tick();f.gate.changed();f.reads[0].resolve('old');await tick();f.gate.changed();f.reads[1].resolve('middle');await tick();f.reads[2].resolve('terminal');await a;assert.deepEqual(f.values,['terminal']);assert.equal(f.reads.length,3);passed++;
}
{
 const f=fixture();f.gate.open('A');const a=f.gate.hydrate('A');await tick();f.gate.open('B');const b=f.gate.hydrate('B');await tick();f.reads[0].resolve('late-A');await a;assert.deepEqual(f.values,[]);assert.equal(f.gate.hydrate('B',false),b);f.reads[1].resolve('B');await b;assert.deepEqual(f.values,['B']);passed++;
}
{
 const f=fixture();f.gate.open('A');const old=f.gate.hydrate('A');await tick();f.gate.open('B');f.gate.open('A');const fresh=f.gate.hydrate('A');await tick();f.reads[0].reject(Error('old A failed'));await old;assert.equal(f.failures.length,0);assert.equal(f.gate.hydrate('A',false),fresh);f.reads[1].resolve('new-A');await fresh;assert.deepEqual(f.values,['new-A']);passed++;
}
{
 const f=fixture();f.gate.open('A');const a=f.gate.hydrate('A');await tick();f.gate.reset();f.reads[0].resolve('unmounted');await a;assert.deepEqual(f.values,[]);f.gate.open('A');const b=f.gate.hydrate('A');await tick();f.reads[1].resolve('remounted');await b;assert.deepEqual(f.values,['remounted']);passed++;
}
{
 const f=fixture();f.gate.open('A');const a=f.gate.hydrate('A');const rejected=assert.rejects(a,/offline/);await tick();f.reads[0].reject(Error('offline'));await rejected;assert.equal(f.failures.length,1);f.gate.changed();assert(!f.gate.needsRecovery(),'No event-driven retry storm after a failed read');const b=f.gate.hydrate('A');await tick();f.reads[1].resolve('retry');await b;assert.deepEqual(f.values,['retry']);passed++;
}
{
 const f=fixture();f.gate.open('A');const a=f.gate.hydrate('A');const rejected=assert.rejects(a,/snapshot_changed/);for(let i=0;i<8;i++){await tick();f.gate.changed();f.reads[i].resolve('stale');}await rejected;assert.equal(f.reads.length,8);assert.deepEqual(f.values,[]);assert.equal(f.failures.length,1);const b=f.gate.hydrate('A');await tick();f.reads[8].resolve('after-stop');await b;assert.deepEqual(f.values,['after-stop']);passed++;
}
{
 const f=fixture();await f.gate.hydrate('A');f.gate.open('B');await f.gate.hydrate('A');assert.equal(f.reads.length,0);passed++;
}
{
 const f=fixture();f.gate.open('A');const old=f.gate.hydrate('A');f.gate.reset();f.gate.open('A');const fresh=f.gate.hydrate('A');await tick();assert.equal(f.reads.length,1,'Strict effect cleanup cancels a not-yet-started old read');f.reads[0].resolve('strict');await Promise.all([old,fresh]);assert.deepEqual(f.values,['strict']);passed++;
}
{
 const f=fixture();f.gate.open('A');const a=f.gate.hydrate('A');await tick();const b=f.gate.hydrate('A');assert.equal(a,b);f.reads[0].resolve('before-business-write');await tick();assert.deepEqual(f.values,[]);assert.equal(f.reads.length,2);f.reads[1].resolve('after-business-write');await b;assert.deepEqual(f.values,['after-business-write']);passed++;
}
{
 const f=fixture({canPublish:value=>value.sequence>=3});f.gate.open('A');const a=f.gate.hydrate('A');await tick();f.reads[0].resolve({sequence:2});await tick();assert.deepEqual(f.values,[]);f.reads[1].resolve({sequence:3});await a;assert.deepEqual(f.values,[{sequence:3}]);assert.equal(f.failures.length,0);passed++;
}
{
 const f=fixture({canPublish:()=>false});f.gate.open('A');const a=f.gate.hydrate('A'),rejected=assert.rejects(a,/snapshot_changed/);for(let i=0;i<8;i++){await tick();f.reads[i].resolve({sequence:0});}await rejected;assert.deepEqual(f.values,[]);assert.equal(f.failures.length,1);passed++;
}
{
 let publications=0;const f=fixture({publish:()=>++publications>1});f.gate.open('A');const done=f.gate.hydrate('A');await tick();f.reads[0].resolve('rejected');await tick();assert.equal(f.reads.length,2);f.reads[1].resolve('committed');await done;assert.equal(publications,2);assert(!f.gate.needsRecovery());passed++;
}
{
 let publications=0;const f=fixture({publish:()=>{if(++publications===1)f.gate.changed();}});f.gate.open('A');const done=f.gate.hydrate('A');await tick();f.reads[0].resolve('raced');await tick();assert.equal(f.reads.length,2);f.reads[1].resolve('stable');await done;assert.equal(publications,2);passed++;
}
console.log(JSON.stringify({suite:'pi-snapshot-hydration',passed,total:15,skipped:0}));
