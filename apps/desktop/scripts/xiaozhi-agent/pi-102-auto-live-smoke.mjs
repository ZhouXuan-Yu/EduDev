import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-102-auto-live-')),root=path.join(output,'state'),workspace=path.join(output,'workspace');fs.mkdirSync(root);fs.mkdirSync(workspace);
const apiKey=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(apiKey);
const response=await fetch('https://api.deepseek.com/v1/models',{headers:{Authorization:'Bearer '+apiKey}});assert.equal(response.status,200);const raw=(await response.json()).data.find(x=>x.id==='deepseek-flash');assert(raw);
const capabilities={id:raw.id,name:raw.name||raw.id,contextWindow:raw.context_window,maxOutputTokens:raw.max_output_tokens,observedAt:new Date().toISOString(),source:'official'};
const marker=randomUUID().slice(0,8),events=[],report={success:false,sdk:'1.0.2',checks:[],boundary:'Actual official DeepSeek/Pi1.0.2, owned synthetic materials/native append-only history, early 32768 test context distinct from official model capacity. Not formal UI or VPN-off proof.'};let agent;
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
const options={stateRoot:root,workspace,apiKey,model:raw.id,capabilities,autoCompaction:true,testContextWindow:32768,limitsEnforced:false,onEvent:event=>events.push(event),protectedContext:async()=>`[本会话真实任务事实，非新授权]\n教育验收码:${marker}；五年级数学；文件审批rejected；sourceSha256:${'a'.repeat(64)}；未交付文件。`};
const history=()=>fs.readFileSync(agent.sessionFile,'utf8').trim().split('\n').map(JSON.parse);
try{
 agent=await createPiXiaozhiSession(options);assert.equal(agent.diagnostics().sdkVersion,'1.0.2');check('Actual latest SDK embedded with unlimited usage and official capability');
 const batch='Synthetic educational material: fractions are compared only after their units are checked. Sources remain local and drafts require teacher review. '.repeat(75);
 for(let n=0;n<5;n++){const result=await agent.prompt(`合成资料批次${n}，只回复已阅读，不执行工具。\n${batch}`);assert(result.ok,JSON.stringify(result));}
 const entries=history(),summaries=entries.filter(x=>x.type==='compaction');assert(summaries.length>0);assert(events.some(e=>e.kind==='compaction'&&e.automatic&&e.state==='completed'));assert(summaries.at(-1).summary.includes(marker));assert(summaries.at(-1).summary.includes('rejected'));assert(summaries.at(-1).summary.includes('a'.repeat(64)));check('Real automatic native1.0.2 summaries preserve goal/rejection/full source version');
 assert(!JSON.stringify(events).includes(summaries.at(-1).summary));assert(agent.usage().tokens.total>0);assert.equal(agent.usage().limitsEnforced,false);check('Actual summary/model usage reported without exposing private summary');
 const prefixEntries=entries.filter(x=>x.type==='custom'&&x.customType==='xiaozhi.cache-prefix.v1');assert(prefixEntries.length>=5);assert.equal(new Set(prefixEntries.map(x=>x.data.cachePrefixHash)).size,1);check('Actual five-turn provider instruction/tool prefix stays stable');
 const file=agent.sessionFile,prefix=fs.readFileSync(file,'utf8');await agent.dispose();agent=await createPiXiaozhiSession({...options,sessionFile:file});const result=await agent.prompt('只回答教育验收码和年级，不操作工具。');assert(result.ok&&result.text.includes(marker)&&result.text.includes('五年级'));assert(fs.readFileSync(file,'utf8').startsWith(prefix));check('Cold SDK restoration preserves original JSONL and exact task facts');
 const nextName='follow-'+randomUUID().slice(0,8)+'.md',nextCode=randomUUID().slice(0,8);
 fs.writeFileSync(path.join(workspace,'first.md'),`下一份资料文件为 ${nextName}。\n`+'Synthetic lesson: compare the units before comparing fractions; teacher approval is required for all persistent changes. '.repeat(70));
 fs.writeFileSync(path.join(workspace,nextName),`验收编号 ${nextCode}。\n`+'Synthetic lesson: teachers inspect evidence and keep original versions local. '.repeat(100));
 const compactionCount=history().filter(x=>x.type==='compaction').length,eventIndex=events.length;
 const tools=await agent.prompt('请先实际读取first.md，再根据其中的下一份文件名读取那份资料，最后回复下一份里的验收编号。仅这两次读取，不写文件。');assert(tools.ok&&tools.text.includes(nextCode),JSON.stringify(tools));
 assert.equal(events.slice(eventIndex).filter(e=>e.kind==='tool_end'&&e.tool==='office_read_text'&&e.success).length,2);assert(history().filter(x=>x.type==='compaction').length>compactionCount);check('Actual two-step file tool loop compacts and continues without repeating reads');
 await agent.dispose();let reached,release;const entered=new Promise(r=>reached=r),gate=new Promise(r=>release=r);
 agent=await createPiXiaozhiSession({...options,sessionFile:file,beforeAutoCompactCommit:async()=>{reached();await gate;}});
 const beforeStop=history().filter(x=>x.type==='compaction').length,running=agent.prompt('阅读合成资料只回复已阅读。\n'+batch);
 await Promise.race([entered,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('No actual summary commit seam reached')),60000);timer.unref();})]);
 const cancelling=agent.abort();release();await cancelling;const stopped=await running;assert.equal(stopped.error,'cancelled');assert.equal(history().filter(x=>x.type==='compaction').length,beforeStop);assert(agent.usage().tokens.total>0);check('Stop after real summarization response commits no checkpoint and retains actual usage');
 await agent.dispose();agent=await createPiXiaozhiSession({...options,sessionFile:file,beforeAutoCompactCommit:async()=>{throw new Error('synthetic-precommit-failure');}});
 const beforeFailure=history().filter(x=>x.type==='compaction').length,failure=await agent.prompt('阅读合成資料后只回复已阅读。\n'+batch);assert.equal(failure.error,'compaction_failed');assert.equal(history().filter(x=>x.type==='compaction').length,beforeFailure);assert(agent.usage().tokens.total>0);check('Real summary followed by admission failure ends closed without truncating or committing history');
 report.compactions=summaries.length;report.usage=agent.usage().tokens;report.success=true;
}catch(error){report.error=String(error.stack).replaceAll(apiKey,'[credential]').slice(0,1800);process.exitCode=1;}finally{await agent?.dispose();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));console.log('REPORT '+output);}
