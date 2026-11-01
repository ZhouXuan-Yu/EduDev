import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const {createRepeatToolReminder}=await import('../../src/main/xiaozhi-agent/repeat-tool-reminder.ts');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-repeat-tool-')),report={ok:false,checks:[],root,boundary:'Pure advisory boundaries; no tool execution gate, network, timer, teacher data or natural model quality claim.'};
const check=(name,fn)=>{fn();report.checks.push(name);};
const step=(r,i,p=1)=>r.observe('read-'+i%p,{path:'file-'+i%p},{content:'same-'+i%p,isError:true});
try{
 check('Existing one-tool 3/5/8 pattern continues sparsely at 16/32/64',()=>{const r=createRepeatToolReminder(),hits=[];for(let i=1;i<=64;i++)if(step(r,i))hits.push(i);assert.deepEqual(hits,[3,5,8,16,32,64]);});
 for(const p of [2,3,4])check(p+'-step unchanged cycles are detected without repeated phase warnings',()=>{const r=createRepeatToolReminder(),hits=[];for(let i=0;i<64*p;i++){const m=step(r,i,p);if(m){hits.push(i+1);assert(m.includes(p+' 步'));}}assert.deepEqual(hits,[3,5,8,16,32,64].map(n=>n*p));});
 check('Object key order is irrelevant and input data is not modified',()=>{const r=createRepeatToolReminder(),a={b:2,a:1};r.observe('x',a,{value:1});r.observe('x',{a:1,b:2},{value:1});assert(r.observe('x',a,{value:1}));assert.deepEqual(Object.keys(a),['b','a']);});
 check('Changing poll results including time/progress remain real progress',()=>{const r=createRepeatToolReminder();for(let i=0;i<80;i++)assert(!r.observe('poll',{}, {progress:i%2,time:i}));});
 check('Different arguments or tool identity are not mistaken for one repeated call',()=>{const r=createRepeatToolReminder();for(let i=0;i<30;i++)assert(!r.observe('tool-'+i,{offset:i},'same'));});
 check('New user input resets both single and cyclic history',()=>{for(const p of [1,2,3,4]){const r=createRepeatToolReminder();for(let i=0;i<p*3;i++)step(r,i,p);r.reset();for(let i=0;i<p*3-1;i++)assert(!step(r,i,p));assert(step(r,p*3-1,p));}});
 check('An intervening unrelated call breaks the old cycle',()=>{const r=createRepeatToolReminder();for(let i=0;i<6;i++)step(r,i,2);assert(!r.observe('different',{},'new'));for(let i=0;i<5;i++)assert(!step(r,i,2));assert(step(r,5,2));});
 check('Transient errors changing to success start fresh history',()=>{const r=createRepeatToolReminder();for(let i=0;i<3;i++)r.observe('x',{}, {isError:true});assert(!r.observe('x',{}, {isError:false}));assert(!r.observe('x',{}, {isError:false}));assert(r.observe('x',{}, {isError:false}));});
 check('Oversized, cyclic, deep and excessive-node values clear history without blocking a result',()=>{const cyclic={};cyclic.self=cyclic;let deep={};for(let i=0;i<40;i++)deep={deep};for(const invalid of ['x'.repeat(1024*1024+1),cyclic,deep,Array(17000).fill(1),1n]){const r=createRepeatToolReminder();step(r,0);step(r,0);assert(!r.observe('x',{},invalid));assert(!step(r,0));assert(!step(r,0));assert(step(r,0));}});
 check('Advisory never contains private arguments, result or tool name',()=>{const r=createRepeatToolReminder();let text;for(let i=0;i<3;i++)text=r.observe('SECRET-TOOL',{path:'PRIVATE-PATH'}, {text:'PRIVATE-STUDENT'});assert(text);for(const v of ['SECRET-TOOL','PRIVATE-PATH','PRIVATE-STUDENT'])assert(!text.includes(v));});
 check('Fresh monitor has no previous-run cycle and reminders have no hard stop',()=>{const first=createRepeatToolReminder();for(let i=0;i<1000;i++)step(first,i,2);const next=createRepeatToolReminder();assert(!step(next,0,2));assert(!step(next,1,2));});
 report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root,error:report.error}));}
