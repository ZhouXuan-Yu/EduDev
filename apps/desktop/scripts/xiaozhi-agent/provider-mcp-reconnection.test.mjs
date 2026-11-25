import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';
import {startMcpFixture} from './fixtures/mcp-server.mjs';

const {createMcpRuntime}=await import('../../src/main/xiaozhi-agent/mcp-runtime.ts');
const {createMcpPermissionContext}=await import('../../src/main/xiaozhi-agent/permissions/mcp.ts');
const {createPermissionStore}=await import('../../src/main/xiaozhi-agent/permissions/store.ts');
const {createPermissionEngine}=await import('../../src/main/xiaozhi-agent/permissions/engine.ts');
const evidence=process.env.OMNI_EDU_PROVIDER_ACCEPTANCE_ROOT;
assert(evidence&&path.isAbsolute(evidence),'Set the isolated Provider acceptance root');

test('temporary HTTP preparation failure retains the verified tool selection and reconnects safely',async()=>{
  const root=await fs.mkdtemp(path.join(await fs.realpath(evidence),'mcp-http-reconnect-'));
  const db=new DatabaseSync(path.join(root,'isolated.sqlite'));
  db.exec(`CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,action_type TEXT,status TEXT,
      title TEXT,description TEXT,preview_md TEXT,payload_json TEXT,created_at TEXT,updated_at TEXT);`);
  const sql={all:async(query,values=[])=>db.prepare(query).all(...values),
    run:async(query,values=[])=>{db.prepare(query).run(...values);},
    change:async(query,values=[])=>Number(db.prepare(query).run(...values).changes)};
  sql.transaction=async action=>{
    db.exec('BEGIN IMMEDIATE');
    try{const result=await action(sql);db.exec('COMMIT');return result;}
    catch(error){db.exec('ROLLBACK');throw error;}
  };
  const runtime=createMcpRuntime(sql,undefined,{timeoutMs:500,preparationTimeoutMs:1100});
  const fixture=await startMcpFixture();
  const report={root,transport:'real loopback HTTP',checks:[],success:false};
  const store=createPermissionStore(sql);
  await store.migrate();
  const owner={sessionId:'aisession_'+randomUUID(),taskId:'xitask_'+'a'.repeat(64),runId:'run_provider_reconnect',generation:1};
  const engine=createPermissionEngine({store,current:()=>true,verifyRequest:async request=>{
    const source=await runtime.trustedAuthority('mcp_'+request.provider.id.slice('mcp.mcp-'.length));
    return !!source&&source.sourceHash===request.provider.sourceHash&&source.schemaHash===request.provider.schemaHash;
  }});
  const permission=createMcpPermissionContext({permissions:{engine,summarize:async action=>action},store,owner:()=>owner});
  const inspect=catalog=>runtime.inspect({schemaVersion:catalog.schemaVersion,revision:catalog.revision,serverId:catalog.servers[0].id});
  const read=()=>{
    const row=db.prepare('SELECT value_json FROM app_settings WHERE key=?').get('xiaozhi.mcp.v1');
    const {revision,servers:[server]}=JSON.parse(row.value_json);
    return {revision,serverRevision:server.revision,status:server.status,schemaHash:server.schemaHash,
      trustedSchemaHash:server.trustedSchemaHash??null,selectedTools:server.selectedTools,lastError:server.lastError??null};
  };
  const call=async handle=>{
    assert.equal(handle.definitions.length,1);
    const result=await handle.definitions[0].execute('read_'+randomUUID(),{topic:'分数'},new AbortController().signal);
    assert.equal(result.isError,false);
    assert.match(JSON.stringify(result.content),/课程资料/u);
  };
  try{
    const added=await runtime.add({name:'Provider reconnect fixture',transport:'http',url:fixture.url});
    const listed=await inspect(added),server=listed.servers[0];
    await runtime.trust({schemaVersion:listed.schemaVersion,revision:listed.revision,serverId:server.id,
      schemaHash:server.schemaHash,tools:['lookup_lesson']});
    const source=await runtime.authority(server.id),origin=new URL(fixture.url).origin;
    await store.issue(owner.sessionId,[{kind:'network',origin,methods:['POST'],purpose:'mcp_call'},
      {kind:'egress',origin,classifications:['teacher_private']},{kind:'mcp',serverId:source.serverId,
        sourceHash:source.sourceHash,schemaHash:source.schemaHash,tools:['lookup_lesson']}],{kind:'teacher',reference:'isolated-http-reconnection'});
    const baseline=await runtime.tools(permission);
    await call(baseline);
    report.baseline=read();
    assert.equal(fixture.state.calls,1);

    fixture.state.hangInitialize=true;
    const requestsBefore=fixture.state.requests,offline=await runtime.tools(permission);
    await offline.dispose();
    report.offline={...read(),requests:fixture.state.requests-requestsBefore,toolCalls:fixture.state.calls};
    assert(report.offline.requests>0,'The test must hit the real HTTP transport');
    assert.equal(offline.definitions.length,0);
    assert.equal(fixture.state.calls,1);
    assert.equal(report.offline.trustedSchemaHash,report.baseline.trustedSchemaHash,'temporary prepare fault erased verified trust');
    assert.deepEqual(report.offline.selectedTools,report.baseline.selectedTools);
    assert.equal(await runtime.authority(server.id),null);
    assert.deepEqual(await runtime.trustedAuthority(server.id),source);
    report.checks.push('Actual HTTP failure makes the Provider unavailable and preserves persisted trust');

    fixture.state.hangInitialize=false;
    const resumed=await runtime.tools(permission);
    await call(resumed);await resumed.dispose();
    assert.equal(fixture.state.calls,2);
    const oldHandle=await baseline.definitions[0].execute('stale_'+randomUUID(),{topic:'旧代际'},new AbortController().signal);
    assert.equal(oldHandle.details.error.code,'permission_denied');
    assert.equal(fixture.state.calls,2);
    await baseline.dispose();
    assert.equal(read().status,'ready');
    report.resumed=read();
    report.checks.push('The unchanged server is verified and a real read runs without another trust action');

    fixture.state.hangInitialize=true;
    await inspect(await runtime.catalog());
    report.offlineInspection=read();
    assert.equal(report.offlineInspection.status,'failed');
    assert.equal(report.offlineInspection.trustedSchemaHash,report.baseline.trustedSchemaHash);
    assert.deepEqual(report.offlineInspection.selectedTools,report.baseline.selectedTools);
    report.checks.push('The teacher inspection path also keeps selection after a real temporary timeout');
    fixture.state.hangInitialize=false;
    fixture.state.tools[0].inputSchema.properties.extra={type:'string'};
    const drifted=await runtime.tools(permission);
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
