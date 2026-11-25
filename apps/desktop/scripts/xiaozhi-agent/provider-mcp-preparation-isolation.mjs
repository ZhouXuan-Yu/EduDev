import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {startMcpFixture} from './fixtures/mcp-server.mjs';

const {createMcpRuntime,mcpToolName}=await import('../../src/main/xiaozhi-agent/mcp-runtime.ts');
const acceptance=process.env.OMNI_EDU_PROVIDER_ACCEPTANCE_ROOT;
assert(path.isAbsolute(acceptance??''),'Set the absolute acceptance root');
const root=fs.mkdtempSync(path.join(fs.realpathSync(acceptance),'provider-mcp-preparation-'));
const db=new DatabaseSync(path.join(root,'app.db'));
db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');
const sql={all:async(query,values=[])=>db.prepare(query).all(...values),
  change:async(query,values=[])=>Number(db.prepare(query).run(...values).changes)};
const runtime=createMcpRuntime(sql,undefined,{timeoutMs:4000,preparationTimeoutMs:1600});
const slow=await startMcpFixture(),healthy=await startMcpFixture();
const report={root,ok:false,checks:[],events:[],paidCalls:0};
const event=name=>report.events.push({name,at:performance.now()});
let releaseLate,prepared;

async function trust(name,url) {
  let view=await runtime.add({name,transport:'http',url});
  const serverId=view.servers.find(server=>server.name===name).id;
  const identity=()=>({schemaVersion:view.schemaVersion,revision:view.revision,serverId});
  view=await runtime.inspect(identity());
  view=await runtime.trust({...identity(),schemaHash:view.servers.find(server=>server.id===serverId).schemaHash,tools:['lookup_lesson']});
  return view.servers.find(server=>server.id===serverId);
}

try {
  const offline=await trust('Slow verified source',slow.url);
  const independent=await trust('Independent verified source',healthy.url);
  slow.state.beforeReply=async(request,reply,response)=>{
    if(request.method!=='initialize')return;
    event('slow-request');
    response.once('close',()=>event('slow-transport-closed'));
    await new Promise(resolve=>{releaseLate=resolve;});
    event('slow-reply-released');
    return reply;
  };
  healthy.state.beforeReply=request=>{
    if(request.method==='initialize')event('healthy-request');
    if(request.method==='tools/list')event('healthy-schema');
  };
  prepared=await runtime.tools();
  const observed=await runtime.catalog();
  report.catalog=observed.servers.map(server=>({id:server.id,status:server.status,trustedSchemaHash:server.trustedSchemaHash}));
  report.exposed=prepared.definitions.map(tool=>tool.name);
  const deadline=performance.now()+1500;
  while (!report.events.some(row=>row.name==='slow-transport-closed')&&performance.now()<deadline)await delay(10);
  const seen=name=>report.events.find(row=>row.name===name)?.at;
  assert(seen('slow-transport-closed')>seen('slow-request'),'Time out and close the real hung HTTP request');
  assert(seen('healthy-schema')<seen('slow-transport-closed'),'An independent source must verify while the first actual transport is still hung');
  const only=prepared.definitions.find(tool=>tool.name===mcpToolName(independent.id,'lookup_lesson'));
  assert(only,'Keep the independent verified MCP tool usable for the original turn');
  const read=await only.execute('wp05_independent_read',{topic:'合成物理课程'},new AbortController().signal,undefined,{});
  assert.equal(read.details.success,true);
  assert.match(read.content[0].text,/合成物理课程/u);
  assert.equal(healthy.state.calls,1);
  report.checks.push('Second trusted MCP verifies while the first is hung and reads through the original preparation handle');
  const before=observed.servers.find(server=>server.id===offline.id);
  assert.equal(before.status,'failed');
  assert.equal(before.trustedSchemaHash,offline.trustedSchemaHash);
  releaseLate();
  releaseLate=undefined;
  await delay(40);
  const after=(await runtime.catalog()).servers.find(server=>server.id===offline.id);
  assert.deepEqual(after,before);
  assert.equal(slow.state.calls,0);
  report.checks.push('Closed transport fences late replies and retains the original verified choice');
  report.ok=true;
}catch(error){
  report.error=String(error.stack??error);
  process.exitCode=1;
}finally{
  releaseLate?.();
  await prepared?.dispose();
  await runtime.dispose();
  await Promise.all([slow.close(),healthy.close()]);
  db.close();
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
