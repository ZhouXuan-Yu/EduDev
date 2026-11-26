import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {OmniEduStore} from '../../src/main/db';
import {createAcquisitionState} from '../../src/main/xiaozhi-agent/capabilities/acquisition/state';
import {protocolHash} from '../../src/main/xiaozhi-agent/capabilities/validation';
import {createControlledMcpService, type PreparedStdioBinding} from '../../src/main/xiaozhi-agent/mcp-controlled-service';
import {createMcpRuntime, mcpToolName} from '../../src/main/xiaozhi-agent/mcp-runtime';
import {canonicalMcp} from '../../src/main/xiaozhi-agent/mcp-schema';
import {createPermissionService} from '../../src/main/xiaozhi-agent/permissions/service';
import {createPermissionRuntimeManager} from '../../src/main/xiaozhi-agent/permissions/windows/runtime';
import {digest, filesystemScope} from '../../src/main/xiaozhi-agent/permissions/resources';

const program = String.raw`[Console]::InputEncoding=New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$late=$null
function Send($id,$value) {[Console]::WriteLine((@{jsonrpc='2.0';id=$id;result=$value}|ConvertTo-Json -Depth 20 -Compress))}
while($null -ne ($line=[Console]::ReadLine())){
 $request=$line|ConvertFrom-Json
 if($null -eq $request.id){continue}
 switch($request.method){
  'initialize' {Send $request.id @{protocolVersion=$request.params.protocolVersion;capabilities=@{tools=@{}};serverInfo=@{name='owned-windows-mcp';version='1.0.0'}}}
  'tools/list' {Send $request.id @{tools=@(@{name='echo';description='Read the dedicated synthetic echo marker';inputSchema=@{type='object';properties=@{text=@{type='string'}};required=@('text');additionalProperties=$false}})}}
  'tools/call' {
   $mode=$request.params.arguments.text
   if($mode -in @('native-exit','native-late')){
    [Console]::Error.WriteLine(('NATIVE-PROVIDER-FIXTURE '+$mode+' '+$PID))
    if($mode -eq 'native-late'){$late=$request.id;continue}
    Start-Sleep -Milliseconds 8500
    exit 23
   }
   Send $request.id @{content=@(@{type='text';text=('NATIVE-HEALTHY '+$mode)})}
  }
 }
}
if($null -ne $late){Send $late @{content=@(@{type='text';text='NATIVE-LATE-701-MUST-NOT-PUBLISH'})};exit 31}
`;

const root=process.argv[2], dataRoot=path.join(root,'data'), workspace=path.join(root,'workspace');
const artifactId='xiartifact_'+digest('provider-stdio-isolation-fixture-v1');
const directory=path.join(dataRoot,'managed-tools/capabilities/versions',artifactId);
fs.mkdirSync(directory,{recursive:true});
fs.mkdirSync(workspace);
const filename='owned-fixture.ps1';
const bytes=Buffer.from('\ufeff'+program);
fs.writeFileSync(path.join(directory,filename),bytes,{flag:'wx'});
const store=new OmniEduStore(dataRoot);
const report:Record<string,unknown>={success:false,checks:[],dataRoot,workspace,paidCalls:0};
let mcp:ReturnType<typeof createMcpRuntime>|undefined;
try {
  await store.init();
  const fault=(await store.createAiConversationSession({title:'原 Windows MCP 会话',folderId:null})).session.id;
  const local=(await store.createAiConversationSession({title:'独立查题会话',folderId:null})).session.id;
  await store.xiaozhiState.setWorkspace(fault,workspace,'Owned test workspace');
  const owner={sessionId:fault,taskId:'xitask_'+digest(randomUUID()),runId:'run_provider_native_seed',generation:1};
  const permissionStore=store.xiaozhiState.permissions;
  const runtime=createPermissionRuntimeManager({root:path.join(dataRoot,'managed-tools/permission-runtime'),store:permissionStore});
  const selected=await runtime.systemRuntime();
  const permissions=createPermissionService({store:permissionStore,dataRoot,owner:()=>owner,archived:async()=>false,
    workspace:async()=>({path:workspace}),process:async()=>({executable:selected.path,executableHash:selected.sha256})});
  const binding:PreparedStdioBinding={artifactId,version:'1.0.0',directory,source:'https://example.invalid',package:'owned-mcp-isolation',
    packageHash:digest(bytes),files:[{path:filename,bytes:bytes.length,sha256:digest(bytes)}],executable:{path:selected.path,sha256:selected.sha256},
    arguments:['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File','$PACKAGE/'+filename],workspaceActions:['read'],
    limits:{memoryBytes:536870912,cpuRate:5000,userTimeMs:0,leaseMs:120000,maxInputBytes:4194304,maxOutputBytes:4194304,maxProcesses:4}};
  const nativeScopes: Parameters<typeof permissionStore.issue>[1]=[runtime.recipe(),filesystemScope(workspace,['read']),
    {kind:'process',backend:'appcontainer',executable:selected.path,executableHash:selected.sha256,workspace},
    {kind:'dependency',source:binding.source,package:binding.package,version:binding.version,sha256:binding.packageHash,environment:directory,installScripts:false}];
  await permissionStore.issue(fault,nativeScopes,{kind:'teacher',reference:'owned-mcp-isolation-fixture-grant'});
  const controlled=createControlledMcpService({permissions,store:permissionStore,runtime,binding:async()=>binding});
  const sourceHash=digest(canonicalMcp({transport:'stdio',command:'managed:'+artifactId,args:[],cwd:''}));
  mcp=createMcpRuntime(store.xiaozhiState.sql);
  let catalog=await mcp.add({name:'Owned Windows MCP isolation',transport:'stdio',command:'managed:'+artifactId});
  const serverId=catalog.servers[0].id;
  const input=()=>({schemaVersion:catalog.schemaVersion,revision:catalog.revision,serverId});
  catalog=await mcp.inspect(input(), controlled.forOwner({owner:()=>owner,workspace,signal:new AbortController().signal,requirementsVersion:()=>1}).transport);
  const verified=catalog.servers[0];
  assert.equal(verified.status,'ready',JSON.stringify(verified));
  assert(verified.schemaHash);
  catalog=await mcp.trust({...input(),schemaHash:verified.schemaHash,tools:['echo']});
  await permissionStore.issue(fault,[{kind:'mcp',serverId,sourceHash,schemaHash:verified.schemaHash,tools:['echo']}],
    {kind:'teacher',reference:'owned-mcp-isolation-fixture-tool-grant'});
  if(process.env.OMNI_EDU_PROVIDER_MCP_OWNER_CYCLES==='1'){
    const secondFault=(await store.createAiConversationSession({title:'重复原生故障会话',folderId:null})).session.id;
    await store.xiaozhiState.setWorkspace(secondFault,workspace,'Owned test workspace');
    await permissionStore.issue(secondFault,nativeScopes,{kind:'teacher',reference:'owned-mcp-isolation-fixture-grant'});
    await permissionStore.issue(secondFault,[{kind:'mcp',serverId,sourceHash,schemaHash:verified.schemaHash,tools:['echo']}],
      {kind:'teacher',reference:'owned-mcp-isolation-fixture-tool-grant'});
    report.secondFault=secondFault;
  }
  await createAcquisitionState(store.xiaozhiState.sql).saveArtifact({id:artifactId,name:binding.package,version:binding.version,
    source:binding.source,license:'MIT',revision:1,status:'ready',schemaHash:verified.schemaHash,installedBytes:bytes.length,
    expiresAt:new Date(Date.now()+900000).toISOString(),sourceHash,ownerTaskId:owner.taskId,recipeId:'owned-mcp-isolation',serverId,
    filesHash:protocolHash(binding.files),binding,installedFiles:binding.files,validationRefs:[],attestation:{signature:'unavailable',provenance:'unavailable'}},0);
  if(process.env.OMNI_EDU_PROVIDER_HEALTHY_MCP_URL){
    const url=new URL(process.env.OMNI_EDU_PROVIDER_HEALTHY_MCP_URL);
    assert(url.protocol==='http:'&&url.hostname==='127.0.0.1');
    catalog=await mcp.add({name:'Independent synthetic lesson provider',transport:'http',url:url.href});
    const independentId=catalog.servers.find(row=>row.endpoint===url.origin)!.id;
    const current=()=>({schemaVersion:catalog.schemaVersion,revision:catalog.revision,serverId:independentId});
    catalog=await mcp.inspect(current());
    const source=catalog.servers.find(row=>row.id===independentId)!;
    assert(source.schemaHash);
    catalog=await mcp.trust({...current(),schemaHash:source.schemaHash,tools:['lookup_lesson']});
    const authority=await mcp.authority(independentId);
    assert(authority);
    await permissionStore.issue(local,[{kind:'network',origin:url.origin,methods:['POST'],purpose:'mcp_call'},
      {kind:'egress',origin:url.origin,classifications:['teacher_private']},
      {kind:'mcp',serverId:independentId,sourceHash:authority.sourceHash,schemaHash:authority.schemaHash,tools:['lookup_lesson']}],
    {kind:'teacher',reference:'owned-mcp-isolation-fixture-independent-grant'});
    report.independentTool=mcpToolName(independentId,'lookup_lesson');
  }
  assert.equal(permissions.engine.activeCount(),0);
  Object.assign(report,{fault,local,serverId,schemaHash:verified.schemaHash,tool:mcpToolName(serverId,'echo'),sourceHash,success:true,
    checks:['Real isolated SQLite and Windows AppContainer verified and authorized the frozen synthetic server']});
} catch(error){report.error=String((error as Error).stack);process.exitCode=1;}
finally {
  await mcp?.dispose();
  await store.close();
  fs.writeFileSync(path.join(root,'REPORT.json'),JSON.stringify(report,null,2));
}
