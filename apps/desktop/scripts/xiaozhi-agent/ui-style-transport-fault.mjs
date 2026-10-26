import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

/** Controlled main-process transport failure in an isolated test profile only.
 * Renderer, preload, Pi error handling and persistence remain the production path.
 * The temporary interceptor is removed in finally; it never changes a key or endpoint.
 */
export async function captureTransportFailure({app,page,auditor,output}){
 const old=await page.locator('.office-composer-container').getAttribute('data-session-id');
 await page.getByTestId('ai-conversation-new').click();
 await page.waitForFunction(old=>{const id=document.querySelector('.office-composer-container')?.dataset.sessionId;return Boolean(id&&id!==old);},old);
 await page.waitForFunction(()=>document.querySelector('[data-testid="office-prompt-input"]')?.disabled===false);
 const sessionId=await page.locator('.office-composer-container').getAttribute('data-session-id');
 await app.evaluate(({net})=>{
   globalThis.__styleAuditFetch=net.fetch;globalThis.__styleAuditFaultCount=0;
   net.fetch=async function(input,...args){
     const address=typeof input==='string'?input:input instanceof URL?input.href:input?.url||'';
     if(/api\.deepseek\.com/.test(address)&&/chat\/completions/.test(address)){
       globalThis.__styleAuditFaultCount++;throw new TypeError('Controlled style-audit transport failure');
     }
     return globalThis.__styleAuditFetch.call(net,input,...args);
   };
 });
 try{
   await page.getByTestId('office-prompt-input').fill('【样式验收：受控故障】请给一句七年级方程课导入。');
   await page.getByTestId('office-prompt-input').press('Enter');
   await page.getByTestId('office-turn-retry').waitFor({timeout:90000});
   const snapshot=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId),turn=snapshot.projection.turns.at(-1);
   const faultCount=await app.evaluate(()=>globalThis.__styleAuditFaultCount);
   assert(faultCount>0,'The intended transport boundary was not intercepted');assert.equal(turn.status,'failed');
   assert.equal(await page.getByTestId('agent-trace-toggle').last().getAttribute('aria-expanded'),'true');
   const styles=[];
   for(const size of [{width:1366,height:768},{width:1920,height:1080}]){
     await app.evaluate(({BrowserWindow},s)=>{const w=BrowserWindow.getAllWindows()[0];if(w.isMinimized())w.restore();w.setContentSize(s.width,s.height);w.show();},size);
     await page.waitForFunction(s=>innerWidth===s.width&&innerHeight===s.height,size);
     await page.getByTestId('office-turn-retry').scrollIntoViewIfNeeded();
     styles.push(await auditor.sample('[data-testid="agent-trace-toggle"]','controlled transport failure '+size.width));
     await page.screenshot({path:path.join(output,'after-light-'+size.width+'-failure-expanded.png')});
     await page.getByTestId('agent-trace-toggle').last().click();
     assert(await page.getByTestId('office-turn-retry').isVisible());
     await page.screenshot({path:path.join(output,'after-light-'+size.width+'-failure-collapsed.png')});
     await page.getByTestId('agent-trace-toggle').last().click();
   }
   const report={kind:'controlled main-process transport fault, not a provider outage',sessionId,runId:turn.id,status:turn.status,error:turn.error,faultCount,styles};
   fs.writeFileSync(path.join(output,'controlled-failure.json'),JSON.stringify(report,null,2));return{sessionId,runId:turn.id,status:turn.status,faultCount};
 }finally{
   await app.evaluate(({net})=>{if(globalThis.__styleAuditFetch)net.fetch=globalThis.__styleAuditFetch;delete globalThis.__styleAuditFetch;delete globalThis.__styleAuditFaultCount;});
 }
}
