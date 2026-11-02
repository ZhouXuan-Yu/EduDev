import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-private-relocation-'));
const id='aisession_'+randomUUID(),checks=[],report={ok:false,root,checks,
  boundary:'Actual production Pi assembly and native files with synthetic tool definitions; no provider, approvals, output generation or teacher acceptance.'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const types=['office-text','science-figure','office-document','office-artifact','delivery'];
const identities=entries=>entries.filter(e=>e.type==='custom'&&types.some(type=>e.customType===`xiaozhi.education.${type}.v1`));
const priorFetch=globalThis.fetch;let agent,requests=0;
globalThis.fetch=async()=>{requests++;throw Error('No provider request allowed');};
function config(parent){
  const stateRoot=path.join(parent,'xiaozhi-pi',id),workspace=path.join(stateRoot,'workspace');
  fs.mkdirSync(workspace,{recursive:true});
  const output=path.join(parent,'conversation-outputs',id);fs.mkdirSync(output,{recursive:true});
  const tool=name=>({name,label:name,description:'Synthetic identity test only',parameters:{type:'object',properties:{}},
    execute:async()=>({content:[{type:'text',text:workspace}],details:{}})});
  return {stateRoot,workspace,privateWorkspaceId:id,apiKey:'synthetic-only',model:'deepseek-flash',
    capabilities:{id:'deepseek-flash',name:'DeepSeek Flash',contextWindow:1048576,maxOutputTokens:32768,observedAt:new Date().toISOString(),source:'official'},
    fileReadWorkspace:output,fileOutputWorkspace:output,
    officeTextTools:()=>['office_create_text','office_edit_text','office_create_science_figure'].map(tool),
    officeDocumentTools:[tool('office_read_document')],officeArtifactTools:()=>[tool('office_create_document')],
    deliveryTools:()=>[tool('office_deliver_files')]};
}
try{
  const first=config(path.join(root,'original'));agent=await createPiXiaozhiSession(first);
  agent.session.sessionManager.appendMessage({role:'user',content:'Synthetic history must survive relocation.',timestamp:Date.now()});
  const file=agent.sessionFile,originalIdentities=identities(agent.session.sessionManager.getEntries());
  assert.equal(originalIdentities.length,5);await agent.dispose();agent=undefined;
  const originalBytes=fs.readFileSync(file);report.originalSha256=sha(originalBytes);
  checks.push('All five file capability identities are persisted by original Pi assembly');
  const second=config(path.join(root,'restored'));
  fs.cpSync(first.stateRoot,second.stateRoot,{recursive:true});
  const movedFile=path.join(second.stateRoot,path.relative(first.stateRoot,file));
  agent=await createPiXiaozhiSession({...second,sessionFile:movedFile});
  assert.deepEqual(identities(agent.session.sessionManager.getEntries()),originalIdentities);
  assert.equal(agent.session.sessionManager.getHeader().cwd,first.workspace);
  assert.equal(agent.session.agent.state.messages.filter(m=>m.role==='user').length,1);
  assert(agent.session.agent.state.tools.some(t=>t.name==='office_create_text'));
  assert.equal(agent.session.sessionManager.getCwd(),second.workspace);
  checks.push('Relocation reuses unchanged native history/identities with the current runtime cwd and registered file tools');
  await agent.dispose();agent=undefined;
  const beforeRejected=sha(fs.readFileSync(movedFile));
  await assert.rejects(createPiXiaozhiSession({...second,sessionFile:movedFile,privateWorkspaceId:'aisession_'+randomUUID()}),/configuration/);
  assert.equal(sha(fs.readFileSync(movedFile)),beforeRejected);
  checks.push('A different conversation identity cannot authorize relocation or rewrite the copied native file');
  await assert.rejects(createPiXiaozhiSession({...second,sessionFile:movedFile,privateWorkspaceId:undefined}),/configuration/);
  assert.equal(sha(fs.readFileSync(movedFile)),beforeRejected);
  checks.push('An unmarked workspace cannot use private relocation as an external directory grant');
  agent=await createPiXiaozhiSession({...second,sessionFile:movedFile});
  assert.deepEqual(identities(agent.session.sessionManager.getEntries()),originalIdentities);
  await agent.dispose();agent=undefined;
  assert.equal(sha(fs.readFileSync(file)),report.originalSha256);assert.equal(requests,0);
  checks.push('A second cold assembly remains compatible; the original native bytes and zero-request boundary are preserved');
  report.ok=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;}
finally{await agent?.dispose();globalThis.fetch=priorFetch;fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
