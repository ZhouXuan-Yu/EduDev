import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const out=path.resolve('test-results/a24-a26/navigation-'+Date.now());await mkdir(out,{recursive:true});
await build({entryPoints:['src/renderer/components/paper-ui/paper-adaptation-navigation.ts'],outfile:path.join(out,'navigation.mjs'),bundle:true,format:'esm',platform:'node'});
const {loadAdaptationComposer}=await import(pathToFileURL(path.join(out,'navigation.mjs')).href);const checks=[];
const empty=()=>({text:'',skill:''});
for(const field of ['text','skill','paperExportIntent','paperExportInvalid','pendingPaperExport']){
 let flush=0,nav=0;await assert.rejects(loadAdaptationComposer({current:()=>true,readDraft:()=>({...empty(),[field]:true}),flush:async()=>{flush++;return true;},navigate:()=>{nav++;return true;}}),/已有/);assert.equal(flush,0);assert.equal(nav,0);
}checks.push('all composer draft/export forms block before flush and remain untouched');
for(const change of ['origin','intent','session','basket','revision','dirty']){
 let current=true,release,nav=0;const pending=new Promise(r=>release=r);const result=loadAdaptationComposer({current:()=>current,readDraft:empty,flush:()=>pending,navigate:()=>{nav++;return true;}});current=false;release(true);await assert.rejects(result,/变化/);assert.equal(nav,0);
}checks.push('await boundary rechecks captured origin/intent/session/basket/revision/dirty predicate');
let draft=empty(),release,nav=0;const pending=new Promise(r=>release=r);const result=loadAdaptationComposer({current:()=>true,readDraft:()=>draft,flush:()=>pending,navigate:()=>{nav++;return true;}});draft={text:'并行写入原草稿',skill:''};release(true);await assert.rejects(result,/变化/);assert.equal(nav,0);assert.equal(draft.text,'并行写入原草稿');checks.push('composer created while flush awaits is preserved and blocks navigation');
for(const accept of [false,true])assert.equal(await loadAdaptationComposer({current:()=>true,readDraft:empty,flush:async()=>true,navigate:()=>accept}),accept);
assert.equal(await loadAdaptationComposer({current:()=>true,readDraft:empty,flush:async()=>false,navigate:()=>{throw Error('must not navigate');}}),false);checks.push('Promise<boolean> reports actual navigate result; failed flush never seeds composer');
await writeFile(path.join(out,'report.json'),JSON.stringify({status:'passed',checks},null,2));console.log(checks.map(s=>'PASS '+s).join('\n'));console.log('REPORT '+path.join(out,'report.json'));
