import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';
import {startMcpFixture} from './fixtures/mcp-server.mjs';

const {createMcpRuntime}=await import('../../src/main/xiaozhi-agent/mcp-runtime.ts');
const evidence=process.env.OMNI_EDU_PROVIDER_ACCEPTANCE_ROOT;
assert(evidence&&path.isAbsolute(evidence),'Set the isolated Provider acceptance root');

test('temporary HTTP preparation failure retains the verified tool selection and reconnects safely',async()=>{
  const root=await fs.mkdtemp(path.join(await fs.realpath(evidence),'mcp-http-reconnect-'));
  const db=new DatabaseSync(path.join(root,'isolated.sqlite'));
  db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL)');
  const runtime=createMcpRuntime({all:async(sql,values=[])=>db.prepare(sql).all(...values),
    change:async(sql,values=[])=>Number(db.prepare(sql).run(...values).changes) },undefined,{timeoutMs:500,preparationTimeoutMs:1100});
  const fixture=await startMcpFixture();
  const report={root,transport:'real loopback HTTP',checks:[],success:false};
  const inspect=catalog=>runtime.inspect({schemaVersion:catalog.schemaVersion,revision:catalog.revision,serverId:catalog.servers[0].id});
  const read=()=>{
    const row=db.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.mcp.v1');
    const {revision,servers:[server]}=JSON.parse(row.value_json);
    return {revision,serverRevision:server.revision,status:server.status,schemaHash:server.schemaHash,
      trustedSchemaHash:server.trustedSchemaHash??null,selectedTools:server.selectedTools,lastError:server.lastError??null};
  };
  const call=async handle=>{
    assert.equal(handle.definitions.length,1);
    const result=await handle.definitions[0].execute('fixture-read',{topic:'分数'},new AbortController().signal);
    assert.equal(result.isError,false);
    assert.match(JSON.stringify(result.content),/课程资料/u);
  };
  try{
    const added=await runtime.add({name:'Provider reconnect fixture',transport:'http',url:fixture.url});
    const listed=await inspect(added),server=listed.servers[0];
    await runtime.trust({schemaVersion:listed.schemaVersion,revision:listed.revision,serverId:server.id,
      schemaHash:server.schemaHash,tools:['lookup_lesson']});
    const baseline=await runtime.tools();
    await call(baseline);await baseline.dispose();
    report.baseline=read();
    assert.equal(fixture.state.calls,1);

    fixture.state.hangInitialize=true;
    const requestsBefore=fixture.state.requests,offline=await runtime.tools();
    await offline.dispose();
    report.offline={...read(),requests:fixture.state.requests-requestsBefore,toolCalls:fixture.state.calls};
    assert(report.offline.requests>0,'The test must hit the real HTTP transport');
    assert.equal(offline.definitions.length,0);
    assert.equal(fixture.state.calls,1);
    assert.equal(report.offline.trustedSchemaHash,report.baseline.trustedSchemaHash,'temporary prepare fault erased verified trust');
    assert.deepEqual(report.offline.selectedTools,report.baseline.selectedTools);
    report.checks.push('Actual HTTP failure makes the Provider unavailable and preserves persisted trust');

    fixture.state.hangInitialize=false;
    const resumed=await runtime.tools();
    await call(resumed);await resumed.dispose();
    assert.equal(fixture.state.calls,2);
    assert.equal(read().status,'ready');
    report.resumed=read();
    report.checks.push('The unchanged server is verified and a real read runs without another trust action');

    fixture.state.hangInitialize=true;
    await (await runtime.tools()).dispose();
    fixture.state.hangInitialize=false;
    fixture.state.tools[0].inputSchema.properties.extra={type:'string'};
    const drifted=await runtime.tools();
    assert.equal(drifted.definitions.length,0);
    await drifted.dispose();
    report.drifted=read();
    assert.equal(report.drifted.status,'schema_changed');
    assert.equal(report.drifted.trustedSchemaHash,null);
    assert.deepEqual(report.drifted.selectedTools,[]);
    assert.equal(fixture.state.calls,2);
    report.checks.push('Schema drift during recovery invalidates old trust and sends no read');
    report.success=true;
  }catch(error){report.error=String(error.stack??error);throw error;}
  finally{
    await runtime.dispose();await fixture.close();db.close();
    await fs.writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
    console.log('evidence '+root);
  }
});
