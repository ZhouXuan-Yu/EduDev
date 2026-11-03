import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {buildBuoyancyDemo} from './buoyancy-demo-bundle.mjs';
import {buoyancyCase} from './buoyancy-fixtures.mjs';
const {BUOYANCY_DEMO_SCHEMA,validBuoyancyDemo}=await import('../../src/shared/buoyancy-demo.ts');
const {prepareHtmlArtifact}=await import('../../src/shared/html-artifact.ts');
const {renderBuoyancyDemo,compileBuoyancyProposal}=await import('../../src/main/xiaozhi-agent/buoyancy-demo.ts');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-buoyancy-demo-')),asset=await buildBuoyancyDemo(),report={ok:false,root,checks:[],files:[],scriptBytes:Buffer.byteLength(asset.script),boundary:'Closed original model and actual offline HTML; UI and real file effects separately required.'};
const spec={schemaVersion:BUOYANCY_DEMO_SCHEMA,title:'浮力：观察、预测与实验',audience:'八年级',model:buoyancyCase()};
const check=(name,fn)=>{fn();report.checks.push(name);console.log('PASS '+name);};
try{
 check('Explicit complete model accepted; unknown schema/conditions, bottom start and out-of-range inputs never become defaults',()=>{
  assert(validBuoyancyDemo(spec));for(const change of [s=>s.schemaVersion+='9',s=>s.model.gravity=null,s=>s.model.conditions.uniformLiquid=null,s=>s.model.conditions.noOtherForces=false,s=>s.model.placement='bottom',s=>s.model.blockDensity.value='0',s=>s.model.liquidDensity.value='900',s=>s.model.downwardLoad.value='7',s=>s.model.cubeSide.value='1000',s=>s.extra=1]){const s=structuredClone(spec);change(s);assert(!validBuoyancyDemo(s));assert.throws(()=>renderBuoyancyDemo(s,asset.script),/invalid_input/);}
 });
 check('Same exact model supports declared units and all classroom density/load edges without mutating source',()=>{
  const before=JSON.stringify(spec);for(const block of ['200','950'])for(const liquid of ['800','1000','1200'])for(const load of ['0','4','5','6']){const s=structuredClone(spec);s.model.blockDensity={value:block,unit:'kg/m^3'};s.model.liquidDensity={value:liquid,unit:'kg/m^3'};s.model.downwardLoad={value:load,unit:'N'};assert(validBuoyancyDemo(s));}
  const s=structuredClone(spec);s.model.blockDensity={value:'0.6',unit:'g/cm^3'};s.model.liquidDensity={value:'1',unit:'g/cm^3'};s.model.downwardLoad={value:'0.004',unit:'kN'};assert(validBuoyancyDemo(s));assert.equal(JSON.stringify(spec),before);
 });
 check('Actual self-contained HTML includes exact pinned model, accessible controls and five teaching phases below original UTF8 limit',()=>{
  const html=prepareHtmlArtifact(renderBuoyancyDemo(spec,asset.script));assert(Buffer.byteLength(html)<=65536);assert(html.includes(BUOYANCY_DEMO_SCHEMA));assert(!/<(?:script|link|img)[^>]+(?:src|href)=["']https?:/i.test(html));assert(!/<details|<summary/i.test(html));
  const encoded=html.match(/<script id="buoyancy-data" type="application\/octet-stream">([^<]+)<\/script>/)[1];assert.deepEqual(JSON.parse(Buffer.from(encoded,'base64')),spec);for(const id of ['block','liquid','load','reset','play','teacher-toggle','input-error','support','net'])assert(html.includes('id="'+id+'"'));assert.equal((html.match(/data-phase="/g)||[]).length,5);
  const file=path.join(root,'浮力探究.html');fs.writeFileSync(file,html);report.files.push({file,bytes:Buffer.byteLength(html),sha256:createHash('sha256').update(html).digest('hex')});
 });
 check('Template request is mutually exclusive with content, create-only HTML; ordinary old content retains exact object/bytes',()=>{
  const old={operation:'create',path:'old.html',content:'<!doctype html><html>原内容</html>'};assert.equal(compileBuoyancyProposal(old),old);
  for(const raw of [{operation:'edit',path:'a.html',buoyancyDemo:spec},{operation:'create',path:'a.md',buoyancyDemo:spec},{operation:'create',path:'a.html',content:'x',buoyancyDemo:spec},{operation:'create',path:'a.html',buoyancyDemo:spec,extra:true}])assert.throws(()=>compileBuoyancyProposal(raw),/invalid_input/);
 });
 check('Original proposal normalizer compiles to complete HTML before original hash without supplying an extra operation or approval',()=>{
  const original=fs.readFileSync;fs.readFileSync=function(file,...args){if(file instanceof URL&&file.pathname.endsWith('/buoyancy-demo.json'))return JSON.stringify(asset);return original.call(this,file,...args);};
  try{const normalized=compileBuoyancyProposal({operation:'create',path:'a.html',buoyancyDemo:spec});assert.deepEqual(Object.keys(normalized),['operation','path','content']);assert.equal(normalized.content,renderBuoyancyDemo(spec,asset.script));assert.equal(normalized.path,'a.html');}finally{fs.readFileSync=original;}
 });
 report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root,error:report.error?.split('\n').slice(0,2).join(' ')}));}
