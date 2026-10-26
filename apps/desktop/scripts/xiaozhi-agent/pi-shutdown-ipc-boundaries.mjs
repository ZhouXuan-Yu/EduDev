import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {EventEmitter} from 'node:events';
const {createDesktopIpcLifetime}=await import('../../src/main/desktop-ipc-lifetime.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-shutdown-ipc-')),report={success:false,checks:[],scope:'Actual IPC lifetime adapter with controlled asynchronous listeners; not Electron/native/provider acceptance.'};
const check=(name)=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function setup(){const handlers=new Map(),target=Object.assign(new EventEmitter(),{handle(channel,fn){if(handlers.has(channel))throw Error('duplicate');handlers.set(channel,fn);},removeHandler(channel){handlers.delete(channel);}}),life=createDesktopIpcLifetime(target);return{life,handlers};}
try{
 const{life,handlers}=setup(),tx=deferred(),order=[];let calls=0;
 life.ipcMain.handle('write',async()=>{calls++;order.push('admitted');await tx.promise;order.push('committed');return 'saved';});
 const result=handlers.get('write')({}),closed=life.close().then(()=>order.push('closed'));await Promise.resolve();assert.deepEqual(order,['admitted']);assert.throws(()=>handlers.get('write')({}),/application_closing/);assert.equal(calls,1);check('Shutdown refuses new IPC effects but waits for an admitted transaction');
 tx.resolve();assert.equal(await result,'saved');await closed;assert.deepEqual(order,['admitted','committed','closed']);check('Database shutdown barrier releases only after actual admitted work settles');
 const b=setup();let closeInside;b.life.ipcMain.handle('sync',()=>{closeInside=b.life.close();return 42;});assert.equal(await b.handlers.get('sync')({}),42);await closeInside;assert.strictEqual(b.life.close(),closeInside);check('Listener-triggered quit registers its own work first and repeated shutdown shares one barrier');
 const c=setup();c.life.ipcMain.handle('fail',()=>{throw Error('owned failure');});await assert.rejects(c.handlers.get('fail')({}),/owned failure/);await c.life.close();check('Rejected IPC remains a rejection and cannot leak an unhandled drain promise');
 const d=setup();let events=0;d.life.ipcMain.on('owned',()=>events++);d.life.ipcMain.emit('owned');assert.equal(events,1);d.life.ipcMain.handle('remove',()=>1);d.life.ipcMain.removeHandler('remove');assert(!d.handlers.has('remove'));await d.life.close();check('Existing Electron event and handler-removal behavior keeps the original target receiver');
 report.success=true;
}catch(e){report.error=String(e.stack||e);process.exitCode=1;}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
