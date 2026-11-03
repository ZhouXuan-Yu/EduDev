import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {buildBuoyancyDemo} from './buoyancy-demo-bundle.mjs';import {buoyancyCase} from './buoyancy-fixtures.mjs';
const {scienceResourceChoices}=await import('../../src/shared/science-resources.ts');
const {createEducationToolCatalog}=await import('../../src/main/xiaozhi-agent/education-tool-catalog.ts');
const {selectedScienceResource}=await import('../../src/main/xiaozhi-agent/science-resource.ts');
const {renderScienceFigure}=await import('../../src/main/xiaozhi-agent/science-figure.ts');
const {renderBuoyancyDemo,compileBuoyancyProposal}=await import('../../src/main/xiaozhi-agent/buoyancy-demo.ts');
const {prepareHtmlArtifact}=await import('../../src/shared/html-artifact.ts');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-science-resources-')),report={ok:false,root,checks:[],files:[],paidRequests:0};
const sha=b=>createHash('sha256').update(b).digest('hex'),asset=await buildBuoyancyDemo();
const spec={schemaVersion:'xiaozhi.buoyancy-demo.v1',title:'浮力：观察、预测与实验',audience:'八年级',model:buoyancyCase()};
const figure={path:'结构.svg',title:'散热片结构',caption:'结构示意，不计算温度或传热率',parts:[{kind:'box',x:0,y:0,z:0,w:120,d:60,h:4,tone:'lo',label:'底板'},{kind:'box',x:0,y:5,z:4,w:1.5,d:50,h:24,tone:'lit',label:'散热肋片',repeat:{count:40,dx:3,dy:0,dz:0}}]};
const metadata=(html,id)=>JSON.parse(Buffer.from(html.match(new RegExp('id="'+id+'"[^>]*>([^<]+)<'))[1],'base64').toString());
const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
try{
 await check('Catalog availability follows actual granted generators; unlicensed PhET is never installed or offered as executable',()=>{
  assert.deepEqual(scienceResourceChoices([]),[]);assert.deepEqual(scienceResourceChoices(['office_create_text']).map(r=>r.id),['xiaozhi-buoyancy','phet-buoyancy']);
  const entries=scienceResourceChoices(['office_create_text','office_create_science_figure']);assert.equal(entries.length,3);const anatomy=entries[0],phet=entries[2];assert.equal(anatomy.license,'MIT');assert.equal(anatomy.version,'1482e8469b0a9e0d8cc18ea2740a01423d29ae80');assert.equal(phet.installed,false);assert.equal(phet.version,null);assert.equal(phet.status,'license_required');assert.deepEqual(phet.alternatives,['xiaozhi-buoyancy']);
 });
 await check('Existing discovery returns fixed resource facts only for relevant queries and never injects an ungranted generator',async()=>{
  const names=['office_create_text','office_create_science_figure'],defs=names.map(name=>({name,label:name,description:'科学 资源 仿真 浮力 Anatomy PhET',parameters:{type:'object',properties:{}},execute:async()=>({content:[]})}));
  const catalog=createEducationToolCatalog('',defs),result=JSON.parse((await catalog.tool.execute('catalog',{query:'科学资源 PhET Anatomy 许可'})).content[0].text);assert.equal(result.scienceResources.length,3);assert(result.tools.every(t=>names.includes(t.name)));const plain=JSON.parse((await catalog.tool.execute('plain',{query:'office_create_text'})).content[0].text);assert(!Object.hasOwn(plain,'scienceResources'));
 });
 await check('Frozen browser runtime and old unselected buoyancy output remain byte-identical',()=>{
  assert.equal(Buffer.byteLength(asset.script),17306);const old=prepareHtmlArtifact(renderBuoyancyDemo(spec,asset.script));assert.equal(Buffer.byteLength(old),24743);assert.equal(sha(old),'9efbc89c493e0d9db17f31375eb6b0b72b5eb0b797b54b4515bec54ad7adeedc');assert(!old.includes('id="science-resource"'));
 });
 await check('Explicit self-made resource adds only truthful provenance and keeps the exact original model, controls and UTF8 budget',()=>{
  const content=renderBuoyancyDemo({...spec,resourceId:'xiaozhi-buoyancy'},asset.script);const m=metadata(content,'science-resource');assert.equal(m.id,'xiaozhi-buoyancy');assert.equal(m.generator,'buoyancyDemo');assert.equal(m.sourceUrl,null);assert.deepEqual(metadata(content,'buoyancy-data'),spec);assert(Buffer.byteLength(content)<64000);const file=path.join(root,'自制浮力.html');fs.writeFileSync(file,content);report.files.push({file,bytes:Buffer.byteLength(content),sha256:sha(content)});
 });
 await check('Actual pinned Anatomy output carries full MIT notice, exact source/version and honest structural scope',()=>{
  const old=renderScienceFigure(figure).content,selected=renderScienceFigure({...figure,resourceId:'anatomy-iso-kit'}).content;assert(!old.includes('id="science-resource"'));const m=metadata(selected,'science-resource');assert.equal(m.license,'MIT');assert.equal(m.version,'1482e8469b0a9e0d8cc18ea2740a01423d29ae80');assert.equal(m.generator,'office_create_science_figure');assert(selected.includes(m.notice));assert(m.notice.startsWith('MIT License\n'));assert(selected.includes('Anatomy · MIT · 1482e84'));assert(selected.includes('结构示意'));assert.equal((selected.match(/data-science-part="/g)||[]).length,41);const file=path.join(root,'已许可结构.svg');fs.writeFileSync(file,selected);report.files.push({file,bytes:Buffer.byteLength(selected),sha256:sha(selected)});
 });
 await check('Missing commercial license, unknown resource and wrong scientific scope fail before producing an output',()=>{
  for(const [id,error] of [['phet-buoyancy','science_resource_license_required'],['not-reviewed','unsupported_science_resource'],['anatomy-iso-kit','science_resource_not_applicable']])assert.throws(()=>renderBuoyancyDemo({...spec,resourceId:id},asset.script),new RegExp(error));
  for(const [id,error] of [['phet-buoyancy','science_resource_license_required'],['not-reviewed','unsupported_science_resource'],['xiaozhi-buoyancy','science_resource_not_applicable']])assert.throws(()=>renderScienceFigure({...figure,resourceId:id}),new RegExp(error));
  assert.throws(()=>compileBuoyancyProposal({operation:'create',path:'phet.html',buoyancyDemo:{...spec,resourceId:'phet-buoyancy'}}),/science_resource_license_required/);assert(!fs.existsSync(path.join(root,'phet.html')));assert.equal(fs.readdirSync(root).filter(f=>/\.(html|svg)$/.test(f)).length,2);
 });
 await check('Changed upstream license text is not advertised as the reviewed MIT source; original newline normalization is safe',()=>{
  const actual=fs.readFileSync;try{fs.readFileSync=function(file,...args){if(String(file).endsWith('/vendor/anatomy/LICENSE'))return 'tampered license';return actual.call(this,file,...args);};assert.throws(()=>selectedScienceResource('anatomy-iso-kit','office_create_science_figure'),/configuration/);}finally{fs.readFileSync=actual;}
  assert.equal(selectedScienceResource('anatomy-iso-kit','office_create_science_figure').notice.length,1061);
 });
 report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,passed:report.checks.length,root,error:report.error?.split('\n').slice(0,2).join(' ')}));}
