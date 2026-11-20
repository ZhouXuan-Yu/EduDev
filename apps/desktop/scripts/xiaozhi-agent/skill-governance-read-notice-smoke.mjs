import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import React, {act} from 'react';
const output=fs.mkdtempSync(path.join(path.resolve(process.env.OMNI_EDU_TEST_OUTPUT||os.tmpdir()),'skill-read-notice-'));
const report={success:false,output,checks:[],scope:'Actual source component mounted in jsdom; IPC deferred locally and HeroUI/presentation children replaced by native test controls. No Electron build, production data, provider, or visual acceptance claim.'};
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://synthetic.invalid/'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
const defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
const reads=[],mutations=[];
window.omniEdu={getXiaozhiSkillGovernance:()=>{const d=defer();reads.push(d);return d.promise;},mutateXiaozhiSkillGovernance:()=>{const d=defer();mutations.push(d);return d.promise;}};
const source=path.resolve('src/renderer/components/office/skills/SkillGovernancePanel.tsx');
const compiled=await build({entryPoints:[source],bundle:true,write:false,platform:'node',format:'cjs',external:['react','react/jsx-runtime'],plugins:[{name:'native-controls',setup(api){
  api.onResolve({filter:/^@heroui\/react$|SkillPublicationForm$|DisclosureCard$/},args=>({path:args.path,namespace:'test-control'}));
  api.onLoad({filter:/.*/,namespace:'test-control'},args=>({loader:'js',contents:args.path==='@heroui/react'
    ? 'const React=require("react");exports.Button=React.forwardRef(({onPress,isDisabled,children,variant,size,...props},ref)=>React.createElement("button",{...props,ref,disabled:isDisabled,onClick:onPress},children));'
    : args.path.endsWith('SkillPublicationForm')?'exports.SkillPublicationForm=()=>null;':'exports.DisclosureCard=({children})=>children;'}));
}}]});
const module={exports:{}};new Function('require','module','exports',compiled.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const {SkillGovernancePanel}=module.exports;
const view={actor:{displayName:'合成教师'},skills:[],versions:[],team:{name:'合成团队',revision:1},membership:{role:'admin',revision:1},officialReviewer:false,reviews:[{id:'synthetic-review',scope:'team',version:'1.0.0',status:'pending',revision:1,metadata:{license:'private-team-copy',source:'synthetic'},skillId:'synthetic-skill',sha256:'a'.repeat(64)}]};
const root=createRoot(document.getElementById('root'));
const query=id=>document.querySelector(`[data-testid="${id}"]`);
const click=async id=>{await act(async()=>{query(id).click();});};
const resolve=async(d,result)=>{await act(async()=>{d.resolve(result);});};
const notice=()=>query('pi-skill-governance-notice')?.textContent||'';
const check=async(name,action)=>{await action();report.checks.push({name,pass:true});console.log('PASS '+name);};
try {
  await act(async()=>{root.render(React.createElement(SkillGovernancePanel,{disabled:false,onChanged:async()=>{}}));});
  await check('Failed read then successful refresh clears only the stale read error and preserves focus',async()=>{
    await resolve(reads[0],{ok:false,error:'configuration'});assert.match(notice(),/技能治理数据暂时不可用/);
    const trigger=query('pi-skill-governance-refresh');trigger.focus();await click('pi-skill-governance-refresh');
    await resolve(reads[1],{ok:true,value:view});assert.equal(notice(),'');assert(query('pi-skill-governance-select'));assert.equal(document.activeElement,trigger);
  });
  await check('Late failed read cannot overwrite a newer successful refresh',async()=>{
    await click('pi-skill-governance-refresh');const old=reads.at(-1);await click('pi-skill-governance-refresh');const latest=reads.at(-1);
    await resolve(latest,{ok:true,value:view});await resolve(old,{ok:false,error:'configuration'});assert.equal(notice(),'');
  });
  await check('Refresh success preserves approval feedback, including after its own read error',async()=>{
    await click('pi-skill-review-approve');await resolve(mutations.at(-1),{ok:true,value:view});const saved=notice();assert.match(saved,/变更已保存/);
    await click('pi-skill-governance-refresh');await resolve(reads.at(-1),{ok:true,value:view});assert.equal(notice(),saved);
    await click('pi-skill-governance-refresh');await resolve(reads.at(-1),{ok:false,error:'configuration'});assert.match(notice(),/技能治理数据暂时不可用/);
    await click('pi-skill-governance-refresh');await resolve(reads.at(-1),{ok:true,value:view});assert.equal(notice(),saved);assert.equal(document.querySelectorAll('[data-testid="pi-skill-governance-notice"]').length,1);
  });
  await check('Authoritative mutation clears a read error and invalidates any pending read',async()=>{
    await click('pi-skill-governance-refresh');await resolve(reads.at(-1),{ok:false,error:'configuration'});assert.match(notice(),/技能治理数据暂时不可用/);
    await click('pi-skill-governance-refresh');const old=reads.at(-1);await click('pi-skill-review-approve');
    await resolve(mutations.at(-1),{ok:true,value:view});const saved=notice();assert.match(saved,/变更已保存/);assert.doesNotMatch(saved,/暂时不可用/);await resolve(old,{ok:false,error:'configuration'});assert.equal(notice(),saved);
  });
  await check('Unmount invalidates the pending read',async()=>{
    await click('pi-skill-governance-refresh');const pending=reads.at(-1);await act(async()=>{root.unmount();});
    await resolve(pending,{ok:false,error:'configuration'});assert.equal(document.getElementById('root').textContent,'');
  });
  report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{dom.window.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:report.checks.length,output,error:report.error}));}
