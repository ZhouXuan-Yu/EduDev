import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID,createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const {createWorkspaceFiles,validFileRequest}=await import('../../src/main/xiaozhi-agent/workspace-files.ts');
const {registerWorkspaceFileIpc}=await import('../../src/main/xiaozhi-agent/workspace-file-api.ts');
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),output=fs.mkdtempSync(path.join(desktop,'test-results/xiaozhi-agent/pi-files-'));
const root=path.join(output,'teaching'),outside=path.join(output,'outside');fs.mkdirSync(root);fs.mkdirSync(outside);
const session=`aisession_${randomUUID()}`,version='a'.repeat(64),schemaVersion='xiaozhi.files.v1';let grant={path:root,label:'合成教研目录',version};
const request=(relative='.',extra={})=>({schemaVersion,sessionId:session,requestId:`xifile_${randomUUID()}`,path:relative,...extra});
const files=createWorkspaceFiles(async()=>{if(!grant)throw new Error('no_workspace');return grant;});
const signal=()=>new AbortController().signal;
const report={success:false,checks:[],boundaries:['Actual bounded filesystem/Hana readonly service and real IPC handler functions with sender seam','Synthetic data only; no provider/UI claims']};
const check=async(name,fn)=>{await fn();report.checks.push({name,pass:true});console.log(`PASS ${name}`);};
const read=async(entry,extra={})=>files.preview(request(entry.path,{workspaceVersion:version,version:entry.version,...extra}),signal());
try {
  fs.writeFileSync(path.join(root,'讲义.txt'),'合成随机事实：'+randomUUID());fs.mkdirSync(path.join(root,'备课'));fs.writeFileSync(path.join(root,'备课','计划.md'),'# 分数教学\n\n**37分钟**');
  fs.writeFileSync(path.join(root,'.env.local'),'SYNTHETIC_SECRET');fs.mkdirSync(path.join(root,'.ssh'));fs.writeFileSync(path.join(root,'.ssh','config'),'SYNTHETIC_SECRET');fs.writeFileSync(path.join(outside,'outside.txt'),'OUTSIDE_NOT_AUTHORIZED');
  await check('Strict schema, fields, session/request identity, path/ADS/UNC/traversal/depth validation',async()=>{
    assert(validFileRequest(request()));for(const bad of ['../outside','/outside','D:/outside','\\\\host\\share','foo:ads','a//b','a/./b','a/../b','a\0b',Array(10).fill('a').join('/')])assert(!validFileRequest(request(bad)));
    for(const extra of [{secret:true},{schemaVersion:'v2'},{sessionId:'fake'},{requestId:'fake'},{workspaceVersion:'bad'}])assert(!validFileRequest(request('.',extra)));
    assert(!validFileRequest(request('讲义.txt'),true));
  });
  const listed=await files.list(request(),signal());assert(listed.ok);const entry=listed.data.entries.find(item=>item.name==='讲义.txt');
  await check('Actual Hana-backed directory list projects only relative ordinary entries; credential names hidden',async()=>{assert(entry);assert(!listed.data.entries.some(item=>item.name.startsWith('.')));assert(!JSON.stringify(listed).includes(root));assert.equal(listed.data.partial,false);});
  await check('Actual UTF-8 preview equals disk bytes without cloud sanitation or model calls',async()=>{const result=await read(entry);assert(result.ok);assert.equal(result.data.text,fs.readFileSync(path.join(root,entry.path),'utf8'));});
  await check('Actual nested Markdown list/preview carries version and source',async()=>{const list=await files.list(request('备课',{workspaceVersion:version}),signal());assert(list.ok);const preview=await read(list.data.entries[0]);assert(preview.ok);assert.equal(preview.data.format,'markdown');assert(preview.data.text.includes('37分钟'));});
  await check('File change rejects old expected version',async()=>{fs.appendFileSync(path.join(root,entry.path),'changed');assert.equal((await read(entry)).error,'changed');});
  await check('Changed workspace lease rejects old preview authority',async()=>{assert.equal((await files.list(request('.',{workspaceVersion:'b'.repeat(64)}),signal())).error,'changed');});
  await check('Missing file has explicit not_found, no raw absolute path',async()=>{const result=await read({...entry,path:'absent.txt'});assert.equal(result.error,'not_found');assert(!JSON.stringify(result).includes(root));});
  await check('Root escape and secret-file read are denied by main path guard',async()=>{for(const relative of ['../outside/outside.txt','.env.local','.ssh/config'])assert.equal((await read({...entry,path:relative})).error,'permission_denied');});
  await check('Hardlink and junction are not listed or previewed',async()=>{
    fs.linkSync(path.join(outside,'outside.txt'),path.join(root,'hard.txt'));fs.symlinkSync(outside,path.join(root,'linked'),process.platform==='win32'?'junction':'dir');
    const list=await files.list(request(),signal());assert(list.ok);assert(!list.data.entries.some(item=>['hard.txt','linked'].includes(item.name)));
    assert.equal((await read({...entry,path:'hard.txt'})).error,'permission_denied');assert.equal((await read({...entry,path:'linked/outside.txt'})).error,'permission_denied');
  });
  await check('Oversize text rejected before content allocation',async()=>{fs.writeFileSync(path.join(root,'big.txt'),Buffer.alloc(1048577,65));const list=await files.list(request(),signal());assert.equal((await read(list.data.entries.find(item=>item.path==='big.txt'))).error,'too_large');});
  await check('Invalid UTF-8/NUL is unsupported without partial body disclosure',async()=>{fs.writeFileSync(path.join(root,'invalid.txt'),Buffer.from([255,0,1]));const list=await files.list(request(),signal());const result=await read(list.data.entries.find(item=>item.path==='invalid.txt'));assert.equal(result.error,'unsupported');assert.equal(result.data,undefined);});
  await check('Only signature-verified local raster images are previewed',async()=>{
    const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64');fs.writeFileSync(path.join(root,'图.png'),bytes);fs.writeFileSync(path.join(root,'fake.png'),'<html>not image</html>');
    const list=await files.list(request(),signal()),preview=await read(list.data.entries.find(item=>item.path==='图.png'));assert(preview.ok);assert.equal(preview.data.image,'data:image/png;base64,'+bytes.toString('base64'));assert.equal((await read(list.data.entries.find(item=>item.path==='fake.png'))).error,'unsupported');
  });
  await check('Unknown binary metadata is honest and contains no body (Office now covered by actual native UI)',async()=>{fs.writeFileSync(path.join(root,'课堂.bin'),'%PDF-synthetic');const list=await files.list(request(),signal()),result=await read(list.data.entries.find(item=>item.path==='课堂.bin'));assert(result.ok);assert.equal(result.data.format,'unsupported');assert.equal(result.data.text,undefined);});
  await check('Directory count is bounded and reports partial, not a complete listing',async()=>{fs.mkdirSync(path.join(root,'many'));for(let index=0;index<270;index++)fs.writeFileSync(path.join(root,'many',`f${index}.txt`),'x');const result=await files.list(request('many'),signal());assert(result.ok);assert.equal(result.data.entries.length,256);assert.equal(result.data.partial,true);});
  await check('Cancelled and timed out reads return terminal structured errors',async()=>{for(const [reason,error] of [['cancelled','cancelled'],['timeout','timeout']]){const abort=new AbortController();abort.abort(reason);assert.equal((await files.list(request(),abort.signal)).error,error);}});
  await check('No-workspace failure never falls back to private session files',async()=>{grant=undefined;assert.equal((await files.list(request(),signal())).error,'no_workspace');grant={path:root,label:'合成教研目录',version};});
  const handlers=new Map();let release,entered;const ipcMain={handle:(name,handler)=>handlers.set(name,handler)},event={allowed:true};
  registerWorkspaceFileIpc({ipcMain,allowed:current=>current.allowed===true,resolve:async()=>{if(entered){entered();await new Promise(resolve=>release=resolve);}return grant;}});
  await check('Real IPC functions reject wrong sender/extra fields before read',async()=>{assert.equal((await handlers.get('xiaozhi:files-list')({allowed:false},request())).error,'permission_denied');assert.equal((await handlers.get('xiaozhi:files-list')(event,request('.', {leak:true}))).error,'invalid_input');assert.equal(handlers.get('xiaozhi:files-cancel')({allowed:false},{}).ok,false);});
  await check('Matching scoped cancellation/duplicate ID is enforced in real IPC handler',async()=>{
    let ready;const atBarrier=new Promise(resolve=>ready=resolve);entered=ready;const input=request(),running=handlers.get('xiaozhi:files-list')(event,input);await atBarrier;
    assert.equal((await handlers.get('xiaozhi:files-list')(event,input)).error,'busy');assert(handlers.get('xiaozhi:files-cancel')(event,{sessionId:session,requestId:input.requestId}).ok);assert.equal((await running).error,'cancelled');assert.equal((await handlers.get('xiaozhi:files-list')(event,input)).error,'busy');entered=undefined;release();
  });
  await check('All operations preserve original outside bytes',async()=>assert.equal(fs.readFileSync(path.join(outside,'outside.txt'),'utf8'),'OUTSIDE_NOT_AUTHORIZED'));
  await check('Authority change during read discards already-read result',async()=>{
    let calls=0;const changing=createWorkspaceFiles(async()=>({...grant,version:++calls===1?version:'b'.repeat(64)}));
    assert.equal((await changing.list(request(),signal())).error,'changed');
  });
  await check('Real IPC concurrency limit rejects ninth request and cancelled work returns no data',async()=>{
    const pending=new Map(),bounded=new Map();registerWorkspaceFileIpc({ipcMain:{handle:(key,fn)=>bounded.set(key,fn)},allowed:()=>true,
      resolve:async id=>{await new Promise(resolve=>pending.set(id,resolve));return grant;}});
    const inputs=Array.from({length:8},()=>request('.',{sessionId:`aisession_${randomUUID()}`})),runs=inputs.map(input=>bounded.get('xiaozhi:files-list')(event,input));
    await new Promise(resolve=>setImmediate(resolve));assert.equal((await bounded.get('xiaozhi:files-list')(event,request())).error,'busy');
    for(const input of inputs){bounded.get('xiaozhi:files-cancel')(event,{sessionId:input.sessionId,requestId:input.requestId});pending.get(input.sessionId)();}
    const results=await Promise.all(runs);assert(results.every(result=>!result.ok&&result.error==='cancelled'&&!result.data));
  });
  await check('Actual IPC timeout returns at deadline while blocked native work still holds its bounded slot',async()=>{
    const timed=new Map();let finish;registerWorkspaceFileIpc({ipcMain:{handle:(key,fn)=>timed.set(key,fn)},allowed:()=>true,resolve:async()=>{await new Promise(resolve=>finish=resolve);return grant;}});
    const input=request(),start=performance.now(),result=await timed.get('xiaozhi:files-list')(event,input);assert.equal(result.error,'timeout');assert(performance.now()-start>=9900&&performance.now()-start<15000);
    assert.equal((await timed.get('xiaozhi:files-list')(event,input)).error,'busy');finish();
  });
  report.success=true;
}catch(error){process.exitCode=1;report.error=String(error.stack||error).slice(0,3000);}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,report:path.relative(desktop,path.join(output,'report.json'))}));}
