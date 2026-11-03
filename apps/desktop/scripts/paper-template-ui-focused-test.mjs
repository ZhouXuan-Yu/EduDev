import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createServer,transformWithEsbuild} from 'vite';
import {chromium} from 'playwright';
const out=fs.mkdtempSync(path.resolve('test-results/a28-c2b/ui-'));
const report={scope:'Headless Chromium production hooks/components with controlled IPC replies; not Electron or host acceptance',passed:[],errors:[]};
const entry=`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import '/src/renderer/heroui-styles.ts';
import {PaperTemplatePanel} from '/src/renderer/components/paper-ui/PaperTemplatePanel.tsx';
import {PaperTemplateRetained} from '/src/renderer/components/paper-ui/PaperTemplateRetained.tsx';
import {PaperReferencePanel} from '/src/renderer/components/paper-ui/PaperReferencePanel.tsx';
import {usePaperTemplates} from '/src/renderer/components/paper-ui/usePaperTemplates.ts';
import {usePaperReference} from '/src/renderer/components/paper-ui/usePaperReference.ts';
const field=value=>({value,status:'known',evidenceIds:[],confirmed:true});
const candidate={schemaVersion:'xiaozhi.paper-reference.v1',parser:'reference-rules.v1',digest:'a'.repeat(64),source:{resourceId:'resource_11111111-1111-4111-8111-111111111111',version:'b'.repeat(64),bodyDigest:'c'.repeat(64),parseEngine:'fixture',complete:true,readChunks:1,totalChunks:1,units:[]},title:field('测试卷'),subject:field('数学'),grade:field('初二'),durationMinutes:field('30'),totalPoints:field('10'),sections:[{id:'section0',label:field('选择'),questionType:field('选择题'),count:field('1'),points:field('10'),difficulty:field(''),knowledgePoint:field('')}],layout:Object.fromEntries(Object.entries({paper:'A4',orientation:'portrait',columns:'2',top:'1134',right:'1134',bottom:'1134',left:'1134',columnGap:'567'}).map(([k,v])=>[k,field(v)])),evidence:[],warnings:[]};
const versions=[],receipts=new Map();window.calls=[];let failOnce=true;
const ref=v=>({templateId:v.templateId,version:v.version,digest:v.digest});
window.omniEdu={listPaperTemplates:async()=>({ok:true,value:{versions:[...versions],unavailable:window.listUnavailable||[]}}),
 readPaperTemplate:async r=>{window.readCalls??=[];window.readCalls.push(r);if(window.readHang)return new Promise(()=>{});return window.readFailure?{ok:false,error:window.readFailure}:({ok:true,value:versions.find(v=>v.templateId===r.templateId&&v.version===r.version)});},
 savePaperTemplateVersion:async r=>{window.calls.push(structuredClone(r));if(receipts.has(r.requestId))return{ok:true,value:receipts.get(r.requestId)};
 const c=structuredClone(candidate);for(const p of r.patches){const parts=p.path.split('.');let parent=c;for(const part of parts.slice(0,-1))parent=parent[part];Object.assign(parent[parts.at(-1)],{teacherValue:p.teacherValue,confirmed:p.confirmed});}
 const v={schemaVersion:'xiaozhi.paper-template.v1',templateId:r.templateId||'xitemplate_'+crypto.randomUUID(),version:r.expectedHeadVersion+1,digest:crypto.randomUUID().replaceAll('-','').repeat(2),candidateDigest:candidate.digest,candidate:c,name:r.name,kind:r.kind,studentId:'',structure:{title:'测试卷',subject:'数学',grade:'初二',durationMinutes:30,totalPoints:10,mode:'source_only',sections:[{id:'template_0',label:'选择',questionType:'选择题',count:1,points:10}]},...(r.derivedFrom?{derivedFrom:r.derivedFrom}:{})};versions.unshift(v);
 const receipt={requestId:r.requestId,operation:'save',template:ref(v)};receipts.set(r.requestId,receipt);if(failOnce){failOnce=false;throw Error('controlled lost response after commit');}return{ok:true,value:receipt};},
 applyPaperTemplates:async r=>{window.applies.push(r);return{ok:true,value:{requestId:r.requestId,operation:'apply',basketId:r.basketId,basketRevision:2}};},
 cancelPaperTemplateOperation:async()=>({ok:true,value:true}),cancelPaperReferenceExtraction:async()=>({ok:true,value:true})};window.applies=[];
const initial={schemaVersion:'xiaozhi.paper-basket.v2',id:'xibasket_11111111-1111-4111-8111-111111111111',sessionId:'aisession_11111111-1111-4111-8111-111111111111',revision:1,state:'active',entries:[],blueprint:{title:'原篮',subject:'数学',grade:'初二',mode:'source_only',durationMinutes:30,totalPoints:5,sections:[{id:'old',label:'旧节',questionType:'选择题',count:1,points:5}]}};
function Fixture(){const [basket,setBasket]=useState(initial);const reference=usePaperReference(basket);const templates=usePaperTemplates(basket,reference,async()=>{setBasket(old=>({...old,revision:2}));return true;});
 window.uiState={basket,editing:templates.editing,mapping:templates.mapping,retryable:templates.retryable,message:templates.message,receipt:templates.committedReceipt};
 const retained={...initial,entries:[{entryId:'entry_old',sectionId:'old'}],c2:{entryPoints:{entry_old:3},retainedSections:[{section:{id:'empty',label:'空旧节',questionType:'选择题',count:1,points:5},entryIds:[],released:false}],unknownRetainedSections:[{sectionId:'unknown',entryIds:[],released:false}]}};
 return <main><button data-testid="fixture-source" onClick={()=>reference.loadCandidate(candidate)}>受控候选</button><PaperReferencePanel state={reference} onMaterials={()=>{}}/><PaperTemplatePanel state={templates} basket={basket} reference={reference} disabled={false}/><PaperTemplateRetained basket={retained} disabled={false} onArrange={op=>window.arrangements.push(op)}/></main>;}
window.arrangements=[];
document.documentElement.dataset.theme='light';createRoot(document.getElementById('root')).render(<Fixture/>);
`;
const server=await createServer({configFile:false,appType:'custom',server:{host:'127.0.0.1',port:0,hmr:false,watch:{ignored:['**/*']}},esbuild:{jsx:'automatic'},optimizeDeps:{include:['react','react-dom/client','react/jsx-runtime','@heroui/react']},
 plugins:[{name:'template-focused',resolveId:id=>id==='/__template.jsx'?'\0template.jsx':undefined,load:id=>id==='\0template.jsx'?transformWithEsbuild(entry,'template.jsx',{loader:'jsx',jsx:'automatic'}):undefined,
 configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/@vite/client"></script><script type="module" src="/__template.jsx"></script>');});}}]});
let browser;
try{await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});page.on('pageerror',e=>report.errors.push(String(e)));
 page.setDefaultTimeout(60000);await page.goto(server.resolvedUrls.local[0],{waitUntil:'domcontentloaded',timeout:120000});await page.getByTestId('fixture-source').click();await page.getByRole('button',{name:'命题结构与卷面模板',exact:true}).click();
 await page.getByTestId('paper-template-name').fill('结构一');await page.getByTestId('paper-template-save-structure').click();await page.getByTestId('paper-template-retry').waitFor();
 await page.getByTestId('paper-template-retry').click();await page.getByTestId('paper-template-version').waitFor();
 const calls=await page.evaluate(()=>window.calls);assert.equal(calls.length,2);assert.equal(calls[0].requestId,calls[1].requestId);assert(!('evidence' in calls[0])&&!('scope' in calls[0]));report.passed.push('save with lost response retries same requestId and sends teacher patches only');
 await page.getByTestId('paper-reference-cancel').click();await page.getByTestId('paper-template-edit').click();await page.getByTestId('paper-template-name').fill('结构二');await page.getByTestId('paper-template-new-version-structure').click();await page.waitForFunction(()=>window.calls.length===3);await page.waitForFunction(()=>window.uiState.editing?.version===2);assert.equal((await page.evaluate(()=>window.calls.at(-1))).expectedHeadVersion,1);report.passed.push('load exact version and save new version through production hook');
 await page.getByTestId('paper-template-copy-structure').click();await page.waitForFunction(()=>window.calls.length===4);assert.equal((await page.evaluate(()=>window.calls.at(-1))).derivedFrom.version,2);report.passed.push('save-as includes exact original reference');
 await page.waitForFunction(()=>!window.uiState.retryable&&window.uiState.message.includes('完成读回'));
 await page.evaluate(()=>{window.readHang=true;});await page.getByTestId('paper-template-new-version-structure').click();
 await page.waitForFunction(()=>window.calls.length===5&&window.uiState.receipt?.template.version===2);
 await page.getByTestId('paper-template-cancel').click();await page.getByTestId('paper-template-retry').waitFor();
 assert.equal(await page.evaluate(()=>window.readCalls.at(-1).requestId),await page.evaluate(()=>window.calls.at(-1).requestId));
 await page.evaluate(()=>{window.readHang=false;});await page.getByTestId('paper-template-retry').click();
 await page.waitForFunction(()=>!window.uiState.retryable&&window.uiState.message.includes('完成读回'));
 assert.equal(await page.evaluate(()=>window.calls.length),5,'Known committed save retry is read-only');
 report.passed.push('Cancel hung post-commit read and recover exact version without saving again');
 await page.getByTestId('paper-reference-cancel').click();
 await page.getByTestId('paper-template-structure').click();await page.getByRole('option').filter({hasText:'结构二'}).first().click();
 assert(await page.getByTestId('paper-template-apply-structure').isDisabled());
 await page.getByTestId('paper-template-mapping-0').click();await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.getByTestId('paper-template-apply-structure').click();await page.waitForFunction(()=>window.applies.length===1);const applied=await page.evaluate(()=>window.applies[0]);assert.equal(applied.mapping[0].templateSectionId,'template_0');assert.deepEqual(applied.mapping[0].target,{kind:'existing',sectionId:'old'});report.passed.push('explicit template-to-basket mapping gates apply');
 await page.getByTestId('paper-template-release-empty').click();await page.getByRole('button',{name:'明确解除未知空旧分节',exact:true}).click();await page.getByTestId('paper-template-accept-points').click();
 assert.deepEqual(await page.evaluate(()=>window.arrangements),[{kind:'release-empty',sectionId:'empty'},{kind:'release-empty',sectionId:'unknown'},{kind:'accept-points',entryId:'entry_old'}]);report.passed.push('known/unknown empty retained release and effective score conflict require explicit actions');
 await page.getByTestId('paper-template-edit').first().click();
 await page.evaluate(()=>{window.readFailure='unavailable';});
 await page.getByTestId('paper-template-new-version-structure').click();
 await page.getByTestId('paper-template-retry').waitFor();assert.ok(await page.evaluate(()=>window.uiState.receipt.template));await page.evaluate(()=>{window.readFailure='source_changed';});await page.getByTestId('paper-template-retry').click();
 await page.waitForFunction(()=>window.uiState.message.includes('当前来源不可用'));
 assert.equal(await page.evaluate(()=>window.uiState.retryable),false);assert.ok(await page.evaluate(()=>window.uiState.receipt.template));
 assert.equal(await page.getByTestId('paper-template-retry').count(),0);
 report.passed.push('committed save plus unavailable remains retryable; definitive source_changed keeps receipt and clears retry/navigation guard');
 await page.evaluate(()=>{window.readFailure=undefined;});await page.getByTestId('paper-template-edit').first().click();await page.evaluate(()=>{window.readFailure='permission_denied';});await page.getByTestId('paper-template-new-version-structure').click();await page.waitForFunction(()=>window.uiState.message.includes('permission_denied'));assert.equal(await page.evaluate(()=>window.uiState.retryable),false);assert.equal(await page.getByTestId('paper-reference-cancel').count(),0);report.passed.push('permission rejection after committed receipt closes candidate and clears navigation guard');
 await page.evaluate(()=>{window.listUnavailable=[{template:{templateId:'xitemplate_stale',version:1,digest:'f'.repeat(64)},reason:'source_changed'}];});await page.getByTestId('paper-template-refresh').click();await page.getByTestId('paper-template-unavailable').waitFor();assert((await page.getByTestId('paper-template-unavailable').innerText()).includes('来源已变化'));assert((await page.getByTestId('paper-template-version').count())>=3);await page.getByTestId('paper-template-structure').click();assert.equal(await page.getByRole('option').filter({hasText:'xitemplate_stale'}).count(),0);await page.keyboard.press('Escape');report.passed.push('S3 new list signature keeps healthy versions selectable and stale reason visible without stale apply option');
 await page.setViewportSize({width:1920,height:1080});assert.equal(report.errors.length,0);await page.screenshot({path:path.join(out,'panel-1920.png')});report.passed.push('mounted panel at 1366/1920 without page errors');
 report.success=true;
}catch(error){report.success=false;report.errors.push(String(error));process.exitCode=1;}finally{await browser?.close();await server.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));console.log('RAW_REPORT '+out);}
