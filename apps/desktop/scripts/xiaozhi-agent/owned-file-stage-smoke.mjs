import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const {withOwnedFileStage,removeOwnedFileStage,parseOwnedFileStage}=await import('../../src/main/xiaozhi-agent/owned-file-stage.ts');
const bytes=Buffer.from('合成教学成果'),report={ok:false,checks:[]};
if(process.argv[2]==='--cut'){
 const [root,cut]=process.argv.slice(3),file=path.join(root,'formal.txt');
 await withOwnedFileStage(file,bytes,async receipt=>{if(receipt)fs.writeFileSync(path.join(root,'receipt.json'),JSON.stringify(receipt));if(cut==='receipt')process.exit(73);},temporary=>{
  if(cut==='before-install')process.exit(73);
  if(cut==='after-rename')fs.renameSync(temporary,file);else fs.linkSync(temporary,file);
  process.exit(73);
 });throw Error('Expected real process exit');
}
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-owned-stage-'));
const check=async(name,action)=>{await action();report.checks.push(name);console.log('PASS '+name);};
try{
 await check('Normal exclusive install persists identity before bytes, clears only metadata and leaves one formal link',async()=>{
  const dir=fs.mkdtempSync(path.join(root,'normal-')),file=path.join(dir,'formal.txt');let stage;
  await withOwnedFileStage(file,bytes,async receipt=>{stage=receipt;if(receipt)assert.equal(fs.statSync(path.join(dir,receipt.name)).size,0);},temporary=>{fs.linkSync(temporary,file);});
  assert.equal(stage,null);assert.deepEqual(fs.readFileSync(file),bytes);assert.equal(fs.statSync(file).nlink,1);assert.deepEqual(fs.readdirSync(dir),['formal.txt']);
 });
 await check('Rejected receipt and cancelled install remove their own temporary without changing existing files',async()=>{
  const dir=fs.mkdtempSync(path.join(root,'fail-')),file=path.join(dir,'formal.txt');fs.writeFileSync(file,'sentinel');
  await assert.rejects(withOwnedFileStage(file,bytes,async()=>{throw Error('db unavailable');},()=>assert.fail()),/db unavailable/);
  await assert.rejects(withOwnedFileStage(file,bytes,async()=>{},()=>{throw Error('cancelled');}),/cancelled/);
  assert.equal(fs.readFileSync(file,'utf8'),'sentinel');assert.deepEqual(fs.readdirSync(dir),['formal.txt']);
 });
 for(const cut of ['receipt','before-install','after-link','after-rename'])await check('Real process crash '+cut+' reclaims recorded stage and retains exact formal bytes',async()=>{
  const dir=fs.mkdtempSync(path.join(root,'crash-')),file=path.join(dir,'formal.txt'),other=path.join(dir,'.xiaozhi-stage-unowned.tmp');fs.writeFileSync(other,'other task');
  const child=spawnSync(process.execPath,[path.resolve(import.meta.filename),'--cut',dir,cut],{encoding:'utf8',windowsHide:true});assert.equal(child.status,73,child.stderr);
  const stage=parseOwnedFileStage(fs.readFileSync(path.join(dir,'receipt.json'),'utf8'));assert(stage);
  removeOwnedFileStage(file,stage);removeOwnedFileStage(file,stage);
  assert(!fs.existsSync(path.join(dir,stage.name)));assert.equal(fs.readFileSync(other,'utf8'),'other task');
  if(cut==='after-link'||cut==='after-rename'){assert.deepEqual(fs.readFileSync(file),bytes);assert.equal(fs.statSync(file).nlink,1);}else assert(!fs.existsSync(file));
 });
 await check('Replaced stage identity is retained and reported as conflict, never deleted by filename alone',async()=>{
  const dir=fs.mkdtempSync(path.join(root,'replacement-')),file=path.join(dir,'formal.txt');let receipt;
  await assert.rejects(withOwnedFileStage(file,bytes,async stage=>{if(stage)receipt=stage;},temporary=>{fs.renameSync(temporary,temporary+'.old');fs.writeFileSync(temporary,'replacement');}),/conflict/);
  assert.equal(fs.readFileSync(path.join(dir,receipt.name),'utf8'),'replacement');assert.throws(()=>removeOwnedFileStage(file,receipt),/conflict/);
 });
 await check('Legacy nullable receipts stay readable; malformed paths and identity data are rejected',async()=>{
  assert.equal(parseOwnedFileStage(null),null);assert.equal(parseOwnedFileStage(undefined),null);
  for(const value of ['{}','null',JSON.stringify({schemaVersion:1,name:'../formal.txt',dev:'1',ino:'2',birthtimeNs:'3'})])assert.throws(()=>parseOwnedFileStage(value),/configuration/);
 });
 report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,root}));}
