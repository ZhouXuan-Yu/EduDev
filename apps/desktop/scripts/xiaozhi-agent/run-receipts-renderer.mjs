import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}});
const root=fs.mkdtempSync('test-results/xiaozhi-agent/run-receipts-'),checks=[];
const runId='run_receipts',callId='read_receipts';
const verification={schema:'xiaozhi.verification.v1',runId,state:'partial',scope:'declared_criteria',checkedAt:'2026-11-01T00:00:00.000Z',reason:'execution_failed',checks:[],evidence:[],operations:{succeeded:1,failed:1}};
const recovery={schemaVersion:1,runId,automaticReplay:false,receipts:[{id:`receipt_${runId}_${callId}`,runId,callId,tool:'office_read_text',disposition:'needs_check',native:'missing',effect:'not_checked'}]};
const turn={id:runId,status:'completed',items:[],verification};
function check(name,fn){fn();checks.push(name);console.log('PASS '+name);}
try{
 const {OfficeRunReceipts}=await server.ssrLoadModule('/src/renderer/components/office/OfficeRunReceipts.tsx');
 const render=t=>renderToStaticMarkup(React.createElement(OfficeRunReceipts,{turn:t}));
 const text=t=>render(t).replace(/<!--.*?-->/g,'');
 check('A completed model response still exposes the host partial-operation result and exact run scope',()=>{
  const html=text(turn);assert(html.includes('部分操作未完成'));assert(html.includes('回复结束不代表任务已完成'));assert(html.includes(`data-run-id="${runId}"`));assert(html.includes('核对范围：仅本轮执行记录'));assert(!html.includes('data-open="true"'));
 });
 check('Plain, legacy, invalid and foreign-run verification records add no invented receipt card',()=>{
  for(const v of [undefined,{...verification,runId:'other'}, {...verification,operations:{succeeded:0,failed:-1}}, {...verification,state:'unknown',reason:'no_criteria',operations:{succeeded:0,failed:0}}, {...verification,state:'unknown',reason:'legacy'}])assert.equal(render({...turn,verification:v}),'');
 });
 check('Live and waiting runs never prematurely display a final verification result',()=>{
  for(const status of ['running','waiting_input','waiting_approval'])assert.equal(render({...turn,status}),'');
 });
 check('Human-only criteria retain their own scope rather than becoming a verified teaching conclusion',()=>{
  const html=text({...turn,verification:{...verification,state:'needs_human',reason:'human_review',checks:[{id:'answer:human',state:'needs_human',evidenceIds:[]}],operations:{succeeded:1,failed:0}}});
  assert(html.includes('结果需要你核对'));assert(html.includes('回复内容与图片识别结果是否符合你的要求'));assert(!html.includes('已按核验标准通过'));
 });
 check('Recovery-only uncertainty is visible in the single collapsed summary and has no replay action',()=>{
  const html=text({...turn,status:'interrupted',verification:undefined,recovery});assert(html.includes('操作结果待核对'));assert(html.includes('1 项结果待核对'));assert(html.includes('恢复记录不会再次执行操作'));assert(!html.includes('批准'));assert(!html.includes('重新执行'));
 });
 check('Recovery and verification share one entry; failed recovery cannot hide in a saved-record heading',()=>{
  const html=text({...turn,recovery:{...recovery,receipts:[{...recovery.receipts[0],disposition:'failed'}]}});assert.equal((html.match(/data-testid="office-run-receipts-details"/g)||[]).length,1);assert(html.includes('1 项操作未完成'));assert(html.includes('data-testid="office-verification"'));assert(html.includes('data-testid="office-recovery"'));
 });
 check('Foreign, malformed or replayable recovery is ignored independently of valid verification',()=>{
  for(const r of [{...recovery,runId:'other'},{...recovery,automaticReplay:true},{...recovery,receipts:[{...recovery.receipts[0],privateText:'secret'}]}]){const html=text({...turn,recovery:r});assert(html.includes('office-verification'));assert(!html.includes('office-recovery'));assert(!html.includes('secret'));}
 });
 fs.writeFileSync(root+'/report.json',JSON.stringify({ok:true,checks,scope:'Renderer receipt selection and disclosure markup only; actual Pi interaction is separate.'},null,2));
 console.log(JSON.stringify({ok:true,checks:checks.length,root}));
}catch(error){fs.writeFileSync(root+'/report.json',JSON.stringify({ok:false,checks,error:String(error.stack)},null,2));throw error;}finally{await server.close();}
