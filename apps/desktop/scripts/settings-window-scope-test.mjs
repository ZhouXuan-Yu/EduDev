import assert from 'node:assert/strict';
import {SettingsScopeAuthority} from '../src/main/settings-window/scope-authority.ts';
const main={},settings={},untrusted={},frames=[],checks=[];
let alive=true,versions={a:'revision1',b:'revision2'},hold;
const authority=new SettingsScopeAuthority({trustedMain:event=>event===main,trustedSettings:event=>event===settings&&alive,readRevision:async id=>{if(hold)await hold;return versions[id]??null;},changed:scope=>frames.push(scope)});
async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
await check('only trusted main can bind a verified host session',async()=>{
 await assert.rejects(authority.select(settings,'a'),/permission_denied/);await assert.rejects(authority.select(untrusted,'a'),/permission_denied/);
 const a=await authority.select(main,'a');assert.equal(a.sessionId,'a');assert.equal(a.revision,'revision1');
});
await check('invalid selection cannot become a capability or query arbitrary host IDs',async()=>{
 const old=authority.snapshot();await assert.rejects(authority.select(main,'../private'),/invalid_input/);assert.deepEqual(authority.snapshot(),old);
 await assert.rejects(authority.select(main,'missing'),/session_unavailable/);assert.equal(authority.snapshot().sessionId,null);
});
await check('switching sessions invalidates previous permits before lookup completes',async()=>{
 const a=await authority.select(main,'a');let release;hold=new Promise(resolve=>release=resolve);
 const pending=authority.select(main,'b');await assert.rejects(authority.assertCurrent(settings,a,'a'),/scope_changed/);release();hold=undefined;await pending;
});
await check('forged session, epoch or revision fails even in a legitimate settings window',async()=>{
 const b=authority.snapshot();await authority.assertCurrent(settings,b,'b');
 for(const bad of [{...b,sessionId:'a'},{...b,epoch:b.epoch-1},{...b,revision:'old'}])await assert.rejects(authority.assertCurrent(settings,bad,'b'),/scope_changed/);
 await assert.rejects(authority.assertCurrent(settings,b,'a'),/scope_changed/);
});
await check('a prior scope protocol version is rejected instead of silently accepted',async()=>{
 await assert.rejects(authority.assertCurrent(settings,{...authority.snapshot(),schemaVersion:'settings.scope.v0'},'b'),/scope_changed/);
});
await check('host revision changes invalidate the same session and fake windows are denied',async()=>{
 const b=authority.snapshot();versions.b='revision3';await assert.rejects(authority.assertCurrent(settings,b,'b'),/scope_changed/);
 await assert.rejects(authority.assertCurrent(untrusted,b,'b'),/permission_denied/);
});
await check('superseded asynchronous selection cannot publish old scope',async()=>{
 let release;hold=new Promise(resolve=>release=resolve);const first=authority.select(main,'a');const second=authority.select(main,'b');release();hold=undefined;
 await assert.rejects(first,/scope_changed/);await second;assert.equal(authority.snapshot().sessionId,'b');assert.equal(frames.at(-1).sessionId,'b');
});
await check('revoked window fails recheck after awaiting host facts',async()=>{
 const b=authority.snapshot();let release;hold=new Promise(resolve=>release=resolve);const pending=authority.assertCurrent(settings,b,'b');alive=false;release();hold=undefined;await assert.rejects(pending,/permission_denied/);alive=true;
});
await check('caller mutation of a snapshot cannot grant authority',async()=>{
 const b=authority.snapshot();b.sessionId='a';assert.equal(authority.snapshot().sessionId,'b');
 await authority.select(main,null);await assert.rejects(authority.assertCurrent(settings,authority.snapshot(),'a'),/scope_changed/);
});
console.log(JSON.stringify({passed:checks.length,checks,boundary:'Capability/epoch unit contract. Host-adapter and actual settings IPC integration remain required; not a substitute configuration store.'}));
