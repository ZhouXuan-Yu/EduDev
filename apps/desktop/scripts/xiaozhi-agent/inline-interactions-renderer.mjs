import fs from'node:fs';import assert from'node:assert/strict';import{createElement as h}from'react';import{renderToStaticMarkup}from'react-dom/server';import{createServer}from'vite';
import {buildClassroomPreview} from '../education/classroom-preview-bundle.mjs';
// Use the same real preview module as electron.vite.config.ts; the mapper imports
// original artifact cards but does not render a classroom or fake its runtime.
const server=await createServer({plugins:[{name:'inline-use-original-classroom-preview',resolveId(id){if(id==='virtual:classroom-preview')return '\0xiaozhi-classroom-preview';},async load(id){if(id==='\0xiaozhi-classroom-preview'){const p=await buildClassroomPreview();return `export const classroomPreviewScript=${JSON.stringify(p.script)};export const classroomPreviewCss=${JSON.stringify(p.css)};`;}}}],appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}}),output=fs.mkdtempSync('test-results/xiaozhi-agent/inline-interactions-renderer-'),checks=[];
try{
 const{OfficeConversation}=await server.ssrLoadModule('/src/renderer/components/office/OfficeConversation.tsx');const{JSDOM}=await import('jsdom');
 const user={id:'user',kind:'message',role:'user',text:'请先问两项，再完成教案'},tool=id=>({id,kind:'tool',label:'请教师补充',status:'completed'}),message=(id,text)=>({id,kind:'message',role:'assistant',phase:'commentary',text});
 const turn={id:'run_one',status:'completed',items:[user,message('intro','先确认两项'),tool('call_one'),message('middle','第一项已收到，确认第二项'),tool('call_two'),message('answer','根据两次回答生成教案')]};
 const interaction=(id,callId,runId='run_one')=>({id,runId,callId,kind:'question',content:h('div',{'data-question':id},id+' 你的回答：五年级')});
 const render=(interactions,overrides={})=>new JSDOM(renderToStaticMarkup(h(OfficeConversation,{projection:{schemaVersion:'xiaozhi.office.projection.v1',threadId:'session',provider:'deepseek',model:'test',epoch:1,sourceSequence:1,needsHydration:false,hasMoreHistory:false,turns:[turn]},interactions,...overrides}))).window.document;
 const check=(name,fn)=>{fn();checks.push({name,pass:true});};const position=(doc,selector)=>[...doc.querySelectorAll('*')].indexOf(doc.querySelector(selector));
 check('Two teacher question/answer cards remain after their own call and before the following assistant segment',()=>{
  const doc=render([interaction('first','call_one'),interaction('second','call_two')]);
  assert(doc.querySelector('[data-interaction-id="first"]'),'Teacher question is missing from its original action');
  for(const[id,call,next]of[['first','call_one','middle'],['second','call_two','answer']])assert(position(doc,`[data-item-id="${call}"]`)<position(doc,`[data-interaction-id="${id}"]`)&&position(doc,`[data-interaction-id="${id}"]`)<position(doc,`[data-item-id="${next}"]`));
 });
 check('Adjacent tools split at an interactive call so the card is visible before the next call, outside collapsed tool content',()=>{
  const adjacent={...turn,items:[user,tool('call_one'),tool('call_two'),message('answer','已完成')]};
  const doc=render([interaction('first','call_one')],{projection:{threadId:'session',turns:[adjacent]}}),card=doc.querySelector('[data-interaction-id="first"]');assert(position(doc,'[data-item-id="call_one"]')<position(doc,'[data-interaction-id="first"]'));assert(position(doc,'[data-interaction-id="first"]')<position(doc,'[data-item-id="call_two"]'));assert(!card.closest('[data-slot="chat-tool-group-content"],[data-slot="chat-tool-content"]'));
 });
 check('Approval card follows the exact operation and is not copied into every tool or appended after the final answer',()=>{
  const doc=render([{...interaction('approval','call_two'),kind:'approval'}]);assert.equal(doc.querySelectorAll('[data-interaction-id="approval"]').length,1);assert(position(doc,'[data-interaction-id="approval"]')<position(doc,'[data-item-id="answer"]'));
 });
 check('Cross-run call identity cannot anchor a card into another run, and absent-run cards are not leaked',()=>{
  const second={...turn,id:'run_two',items:[tool('call_other'),message('last','第二轮正文')]};const doc=render([interaction('wrong-run','call_one','run_two'),interaction('absent','call_one','not-loaded')],{projection:{threadId:'session',turns:[turn,second]}});
  assert(!doc.querySelector('[data-turn-id="run_one"] [data-interaction-id="wrong-run"]'));assert(doc.querySelector('[data-turn-id="run_two"] [data-interaction-id="wrong-run"][data-position="unanchored"]'));assert(!doc.querySelector('[data-interaction-id="absent"]'));
 });
 check('Legacy question without callId remains reachable in an explicitly unanchored history section rather than a guessed action',()=>{
  const doc=render([interaction('legacy',undefined)]),card=doc.querySelector('[data-interaction-id="legacy"]');assert.equal(card.dataset.position,'unanchored');assert(doc.body.textContent.includes('操作位置未包含在当前记录中'));assert.equal(doc.querySelectorAll('[data-interaction-id="legacy"]').length,1);
 });
 check('Duplicate source rows do not duplicate an actionable card',()=>{const item=interaction('same','call_one'),doc=render([item,item]);assert.equal(doc.querySelectorAll('[data-interaction-id="same"]').length,1);});
 check('Existing renderApprovals consumers remain once at turn end when no new interactions are supplied',()=>{const doc=render(undefined,{renderApprovals:()=>h('div',{'data-legacy':'one'},'兼容审批')});assert.equal(doc.querySelectorAll('[data-legacy]').length,1);assert(position(doc,'[data-item-id="answer"]')<position(doc,'[data-legacy]'));});
 check('Restoring a completed conversation preserves interaction DOM order and saved answer instead of creating a fresh question',()=>{const list=[interaction('first','call_one'),interaction('second','call_two')],a=render(list),b=render(JSON.parse(JSON.stringify(list)).map(item=>({...item,content:h('div',{'data-question':item.id},item.id+' 你的回答：五年级')})));assert.deepEqual([...a.querySelectorAll('[data-interaction-id]')].map(el=>el.dataset.interactionId),[...b.querySelectorAll('[data-interaction-id]')].map(el=>el.dataset.interactionId));assert(b.body.textContent.includes('你的回答：五年级'));});
 const{buildPiInteractions}=await server.ssrLoadModule('/src/renderer/components/office/PiInteractionCards.tsx');
 const callbacks={sessionId:'session',onRefresh:async()=>{},onOpen:()=>{},onDecision:async()=>{},onAnswer:async()=>{},onMutation:async()=>{}};
 check('All original business card families retain persisted call identities and original callbacks in the production mapper',()=>{
  const item={id:'item',runId:'run_one',callId:'call_one'},snapshot={projection:{threadId:'session',turns:[turn]},approvals:[item],changes:[item],officeArtifacts:[item],learningReviews:[item],questionCollections:[item],questionReviews:[item],paperReviews:[item],practiceReviews:[item],controls:[{...item,kind:'question'}]};
  const entries=buildPiInteractions({...callbacks,snapshot});assert.equal(entries.length,9);assert.equal(new Set(entries.map(i=>i.kind)).size,9);assert(entries.every(i=>i.callId==='call_one'&&i.runId==='run_one'&&i.content));assert.equal(entries[0].content.props.onDecision,callbacks.onDecision);
 });
 check('A multi-call original batch stays one original business group at its last actual root call, without guessing from hashed child IDs',()=>{
  const reviews=[{id:'one',runId:'run_one',callId:'hashed_child_1',originalBatch:{id:'batch1',collectionId:'collection',rootCallId:'call_one',index:0,total:1}},{id:'two',runId:'run_one',callId:'hashed_child_2',originalBatch:{id:'batch2',collectionId:'collection',rootCallId:'call_two',index:0,total:1}}];
  const entries=buildPiInteractions({...callbacks,snapshot:{projection:{threadId:'session',turns:[turn]},questionReviews:reviews}});assert.equal(entries.length,1);assert.equal(entries[0].callId,'call_two');assert.equal(entries[0].content.props.reviews.length,2);
 });
 check('Stale-session snapshot produces no actionable cards, and queued instructions remain available with their original mutation handler',()=>{
  assert.deepEqual(buildPiInteractions({...callbacks,snapshot:{projection:{threadId:'other'},controls:[{id:'q',runId:'run_one',kind:'question'}]}}),[]);
  const entries=buildPiInteractions({...callbacks,snapshot:{projection:{threadId:'session',turns:[turn]},controls:[{id:'queue',runId:'run_one',kind:'instruction'}]}});assert.equal(entries.length,1);assert.equal(entries[0].callId,undefined);assert.equal(entries[0].content.props.onMutation,callbacks.onMutation);
 });
 fs.writeFileSync(output+'/report.json',JSON.stringify({success:true,checks,scope:'SSR user-visible placement and compatibility only; no real provider, persistence or approvals accepted'},null,2));console.log(JSON.stringify({success:true,checks:checks.length,output}));
}catch(error){fs.writeFileSync(output+'/report.json',JSON.stringify({success:false,checks,error:String(error.stack)},null,2));throw error;}finally{await server.close();}
