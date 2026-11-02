import assert from 'node:assert/strict';import fs from 'node:fs';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {createServer} from 'vite';
const server=await createServer({configFile:false,appType:'custom',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false}}),root=fs.mkdtempSync('test-results/xiaozhi-agent/usage-receipt-'),checks=[];
try{
 const {PiUsageReceipt}=await server.ssrLoadModule('/src/renderer/components/office/PiUsageReceipt.tsx');
 const budget={maxModelCalls:16,maxToolCalls:64,maxTokens:100000,activeMs:90000,waitMs:300000};
 const usage={runId:'run_current',budget,modelCalls:2,toolCalls:1,tokens:{input:60,output:12,cacheRead:40,cacheWrite:0,total:112},completeness:'reported',cost:null,activeMs:1234,waitingMs:2300,state:'completed'};
 const render=(value=usage,runId='run_current',limited=false)=>renderToStaticMarkup(React.createElement(PiUsageReceipt,{usage:value,runId,limited})).replace(/<!--.*?-->/g,'');
 function check(name,fn){fn();checks.push(name);}
 check('Reported input includes recorded cache tokens once and preserves unknown billing',()=>{const html=render();assert(html.includes('已记录 Token：112'));assert(html.includes('已记录输入：100；输出：12'));assert(html.includes('缓存读取：40 Token'));assert(html.includes('费用：未知'));assert(!html.includes('%'));assert(!html.includes(' / 16'));});
 check('Partial token values cannot be read as the complete run total',()=>{assert(render({...usage,completeness:'partial'}).includes('部分记录，本轮总量未知'));});
 check('Missing provider usage is unknown rather than zero or free',()=>{const html=render({...usage,tokens:null,completeness:'unknown'});assert(html.includes('Token 用量：未知'));assert(!html.includes('已记录 Token：0'));assert(html.includes('费用：未知'));});
 check('Unconfirmed cache zeros are not represented as a measured zero hit rate',()=>{const html=render({...usage,tokens:{input:100,output:12,cacheRead:0,cacheWrite:0,total:112}});assert(html.includes('缓存命中量：未确认'));assert(!html.includes('0%'));assert(!html.includes('缓存读取：0'));});
 check('Stopped and failed runs preserve observations and disclose possible in-flight charges',()=>{for(const state of ['interrupted','failed']){const html=render({...usage,state});assert(html.includes('在途请求仍可能计费'));assert(html.includes('已记录 Token：112'));}});
 check('An absent or foreign run does not reuse the previous run receipt',()=>{for(const value of [undefined,{...usage,runId:'other'}]){const html=renderToStaticMarkup(React.createElement(PiUsageReceipt,{usage:value,runId:'run_current'}));assert(html.includes('当前轮尚无用量记录'));assert(!html.includes('已记录 Token'));}});
 check('Legacy enforced budgets retain their limits and time labels remain task-specific',()=>{const html=render(usage,'run_current',true);assert(html.includes('2 / 16'));assert(html.includes('1 / 64'));assert(html.includes('任务活动 1.2 秒 · 教师等待 2.3 秒'));assert(!html.includes('首字'));});
 fs.writeFileSync(root+'/report.json',JSON.stringify({ok:true,checks,scope:'Read-only usage presentation boundaries; original Pi interaction tested separately.'},null,2));console.log(JSON.stringify({ok:true,checks:checks.length,root}));
}finally{await server.close();}
