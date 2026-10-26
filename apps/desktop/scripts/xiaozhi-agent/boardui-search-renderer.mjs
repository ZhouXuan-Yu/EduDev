import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

const server=await createServer({appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});
const output=fs.mkdtempSync('test-results/xiaozhi-agent/boardui-search-renderer-'),checks=[];
try {
 const {OfficeToolProcess}=await server.ssrLoadModule('/src/renderer/components/office/OfficeToolProcess.tsx');
 const {WebSearch}=await server.ssrLoadModule('/src/renderer/vendor/boardui-web-search/WebSearch.tsx');
 const {JSDOM}=await import('jsdom');
 const base={id:'call_web',kind:'tool',label:'联网搜索',status:'completed',durationMs:2300};
 const render=items=>new JSDOM(renderToStaticMarkup(h(OfficeToolProcess,{items,sessionId:'session_test'}))).window.document;
 const check=(name,fn)=>{fn();checks.push({name,pass:true});};
 check('A running host call remains running after all presentation rows are visible; unknown elapsed time is not invented',()=>{
  const doc=render([{...base,status:'inProgress',durationMs:undefined}]);
  assert.equal(doc.querySelector('[data-testid="pi-web-search-process"]').dataset.state,'running');
  assert(doc.querySelector('.bui-ws-working'));assert(!doc.querySelector('.bui-ws-timer'));
  assert(!doc.body.textContent.includes('2.3'));
 });
 check('Host completion and recorded duration replace Working, without any sample result or input control',()=>{
  const doc=render([base]);assert.equal(doc.querySelector('[data-testid="pi-web-search-process"]').dataset.state,'completed');
  assert(!doc.querySelector('.bui-ws-working'));assert(doc.body.textContent.includes('2 秒'));assert(!doc.querySelector('textarea,input'));
  assert(!/Reddit|GitHub|What do teams|component library/.test(doc.body.textContent));
 });
 check('Failed, stopped, waiting and unknown operations keep accessible details; no state is upgraded to success',()=>{
  for(const [status,code,expected]of[['failed','network','failed'],['failed','cancelled','stopped'],['waiting_input',undefined,'waiting'],['pending',undefined,'unknown']]){
   const attempt=code?{schemaVersion:1,callId:base.id,tool:'office_web_search',attempt:1,maxAttempts:2,state:'failed',code,effect:'none'}:undefined;
   const doc=render([{...base,status,toolAttempt:attempt}]);assert.equal(doc.querySelector('[data-testid="pi-web-search-process"]').dataset.state,expected);
   assert(doc.querySelector('.office-web-search-details[open]'));assert(!doc.querySelector('.bui-ws-working'));
  }
 });
 check('Actual empty result is explicit; source-less success does not invent Sources',()=>{
  const doc=render([{...base,webEmpty:true}]);assert(doc.body.textContent.includes('无可用结果'));assert(!doc.querySelector('.bui-ws-sources-button'));
 });
 check('Twelve receipt rows retain twelve distinct call IDs; this assertion is presentation only, not scheduler throughput',()=>{
  const doc=render(Array.from({length:12},(_,i)=>({...base,id:'call_'+i,status:i===11?'inProgress':'completed'})));
  assert.equal(doc.querySelectorAll('[data-call-id]').length,12);assert.equal(new Set([...doc.querySelectorAll('[data-call-id]')].map(el=>el.dataset.callId)).size,12);
  assert.equal(doc.querySelector('[data-call-count]').dataset.callCount,'12');assert(doc.body.textContent.includes('11/12'));
 });
 check('Only actual HTTP sources render with host-controlled links, correct source kind and safe React text',()=>{
  const sources=[{title:'<script>not executable</script>',url:'https://example.com/read',kind:'read',observedAt:'2026-10-15T00:00:00.000Z'},{title:'摘要',url:'https://example.org/search',kind:'search'},...['javascript:alert(1)','data:text/html,x','https://user:secret@example.com'].map(url=>({title:'DROP',url,kind:'read'}))];
  const doc=render([{...base,sources}]),links=doc.querySelectorAll('.bui-ws-source-link');assert.equal(links.length,2);assert(!doc.querySelector('script'));
  for(const link of links){assert.equal(link.getAttribute('href'),'#');assert.equal(link.getAttribute('target'),null);assert.equal(link.tabIndex,-1);}
  assert(links[0].textContent.includes('已读正文'));assert(links[1].textContent.includes('搜索摘要'));assert(!doc.querySelector('.bui-ws-source-row').textContent.includes('DROP'));
 });
 check('Mixed education and web groups keep the existing complete tool view; malformed attempts cannot enable the new branch',()=>{
  for(const items of[[base,{...base,id:'education',label:'读取知识库'}],[{...base,toolAttempt:{secret:'private'}}]]){
   const doc=render(items);assert(!doc.querySelector('[data-testid="pi-web-search-process"]'));assert(doc.querySelector('[data-testid="office-tool-step"]'));
  }
 });
 check('Controlled component honors supplied elapsed value; non-running states never display a live ticker',()=>{
  const renderState=state=>new JSDOM(renderToStaticMarkup(h(WebSearch,{steps:[{id:'one',label:'读取',status:state}],state,revealed:1,elapsedMs:4500}))).window.document;
  assert.equal(renderState('running').querySelector('.bui-ws-timer').textContent.trim(),'4.5s');assert(!renderState('failed').querySelector('.bui-ws-working'));
 });
 fs.writeFileSync(output+'/report.json',JSON.stringify({success:true,checks,scope:'SSR receipt/presentation boundaries only. No browser, provider, elapsed-timing or real concurrency claim.'},null,2));
 console.log(JSON.stringify({success:true,checks:checks.length,output}));
}catch(error){fs.writeFileSync(output+'/report.json',JSON.stringify({success:false,checks,error:String(error.stack)},null,2));throw error;}
finally{await server.close();}
