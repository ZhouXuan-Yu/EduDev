import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
const home=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(process.env.PHASE8_REPO || 'D:/WorkProject/EduProject-harness');
const desktop=path.join(repo,'apps/desktop');
const require=createRequire(path.join(desktop,'package.json'));
const {build}=require('esbuild');
const ts=require('typescript');
const fixture=path.join(os.tmpdir(),'xiaozhi-phase5-production-grcqce');
const mode=process.argv[2] || '--preflight';
assert(['--preflight','--run'].includes(mode),'use --preflight or --run');
assert(path.parse(home).root.toLowerCase()==='c:\\');
assert(home.startsWith(path.resolve(os.tmpdir())+path.sep));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const checkedRead=file=>{const stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1);return fs.readFileSync(file);};
const db=new DatabaseSync(path.join(fixture,'data/app.db'),{readOnly:true});
const read=t=>{const row=db.prepare('SELECT * FROM '+t+' LIMIT 1').get();const value=JSON.parse(row.payload_json);return {row,value};};
const a=read('xiaozhi_acquisition_artifacts_v1'),o=read('xiaozhi_acquisition_operations_v1');db.close();
assert(a.value.status==='ready'&&Date.parse(a.value.expiresAt)>Date.now());
assert(a.value.binding.directory===o.value.plan.directory);
assert(path.resolve(a.value.binding.directory).startsWith(path.join(fixture,'data/managed-tools/capabilities/versions')+path.sep));
const packageDir=a.value.binding.directory;
const pins=a.value.binding.files.map(entry=>{const file=path.join(packageDir,entry.path),bytes=checkedRead(file);assert.equal(bytes.length,entry.bytes);assert.equal(sha(bytes),entry.sha256);return entry;});
assert(pins.some(p=>p.path==='node.exe'&&p.bytes===89935872&&p.sha256==='2ffe3acc0458fdde999f50d11809bbe7c9b7ef204dcf17094e325d26ace101d8'));
const nativeDirectory=path.join(desktop,'src/main/xiaozhi-agent/permissions/windows/generated');
const nativeManifest=JSON.parse(checkedRead(path.join(nativeDirectory,'sandbox-manifest.json')));
assert.equal(sha(checkedRead(path.join(nativeDirectory,nativeManifest.helperFile))),nativeManifest.helperSha256);
const nativeHelper={directory:nativeDirectory,helperSha256:nativeManifest.helperSha256,sourceSha256:nativeManifest.sourceSha256,manifestSha256:sha(checkedRead(path.join(nativeDirectory,'sandbox-manifest.json')))};
const coreManifestSha256=sha(checkedRead(path.join(desktop,'src/main/xiaozhi-agent/capabilities/generated/core-tool-manifest.json')));
const baseline={nativeHelper,coreManifestSha256,fixture,packageDir,artifactId:a.value.id,expiresAt:a.value.expiresAt,executionFiles:pins,installedCount:a.value.installedFiles.length,originalWorkerSha256:sha(checkedRead(path.join(desktop,'scripts/xiaozhi-agent/phase5-production-worker.ts')))};
const output=fs.mkdtempSync(path.join(home,mode==='--run'?'run-':'preflight-'));
fs.writeFileSync(path.join(output,'fixture-contract.json'),JSON.stringify({artifact:a.value,operation:o.value,baseline},null,2));
const sources={};
function replaceOnce(text,from,to,file){assert(text.includes(from),'missing profiling anchor: '+file+' '+from.slice(0,70));assert(text.indexOf(from)===text.lastIndexOf(from),'ambiguous profiling anchor: '+file);return text.replace(from,to);}
function methodReturn(text,file){const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let edit;function walk(n){if(ts.isMethodDeclaration(n)&&n.name.getText(ast)==='forOwner'){const ret=n.body.statements.findLast(ts.isReturnStatement);assert(ret?.expression);edit={start:ret.expression.getStart(ast),end:ret.expression.end};}ts.forEachChild(n,walk);}walk(ast);assert(edit,'missing forOwner return');return text.slice(0,edit.start)+'globalThis.__phase8.ownerObject(frozenOwner, '+text.slice(edit.start,edit.end)+')'+text.slice(edit.end);}
const worker=path.join(desktop,'scripts/xiaozhi-agent/phase5-production-worker.ts');
const plugin={name:'phase8-observation-only',setup(b){b.onLoad({filter:/\.ts$/},args=>{
 let text=fs.readFileSync(args.path,'utf8');sources[path.relative(repo,args.path).replaceAll('\\','/')]=sha(Buffer.from(text));
 const file=args.path.replaceAll('\\','/');
 if(file.endsWith('/capabilities/acquisition/file-hash.ts')){
  text=replaceOnce(text,'export async function hashCapabilityFile(','async function __phase8OriginalHash(',file);
  text+='\nexport async function hashCapabilityFile(filename: string, signal?: AbortSignal) { return globalThis.__phase8.span("file.hash", globalThis.__phase8.fileMeta(filename), () => __phase8OriginalHash(filename, signal)); }\n';
 }
 if(file.endsWith('/mcp-controlled-service.ts'))text=methodReturn(text,file);
 if(file.endsWith('/capabilities/registry.ts')){const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='createCapabilityRegistry');assert(fn?.body);const at=fn.body.getStart(ast)+1;text=text.slice(0,at)+'\nsql = globalThis.__phase8.sql(sql);\n'+text.slice(at);}
 if(file.endsWith('/capabilities/acquisition/service.ts'))text=replaceOnce(text,'const previous = await state.operation(id);','await globalThis.__phase8.seedOperation(context, candidateId, id, state); const previous = await state.operation(id);',file);
 if(file===worker.replaceAll('\\','/'))text=fs.readFileSync(path.join(home,'focused-worker.ts'),'utf8');
 if(file.endsWith('/production-host.ts'))text=replaceOnce(text,'await registerSessionToolGovernance({definitions, registry: store.xiaozhiState.capabilities, mcp: name => mcp.describeTool(name)})','await globalThis.__phase8.withOwner({...run.publisher!.owner, taskId: run.task!.id}, () => registerSessionToolGovernance({definitions, registry: store.xiaozhiState.capabilities, mcp: name => mcp.describeTool(name)}))',file);
 if(file.endsWith('/capabilities/core-governance.ts')){
  const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let body;const visit=n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==='assert')body=n.body;ts.forEachChild(n,visit);};visit(ast);assert(body);const start=body.getStart(ast)+1,end=body.end-1;text=text.slice(0,start)+'return globalThis.__phase8.withOwner(options.owner, async()=>{'+text.slice(start,end)+'});'+text.slice(end);
 }
 if(file.endsWith('/permissions/windows/launcher.ts')){
  text=replaceOnce(text,'export async function runNativeSandbox(','async function __phase8NativeSandbox(',file);
  text+='\nexport async function runNativeSandbox(options: Parameters<typeof __phase8NativeSandbox>[0]) {return globalThis.__phase8.withOwner(options.start.owner, () => globalThis.__phase8.span("native.helper", {executionId:options.start.executionId}, () => __phase8NativeSandbox(options)));}\n';
 }
 if(file.endsWith('/permissions/current.ts'))text+='\nglobalThis.__phase8.permission = currentPermission;\n';
 return {contents:text,loader:'ts',resolveDir:path.dirname(args.path)};
});}};
await build({entryPoints:[worker],outfile:path.join(output,'worker.mjs'),bundle:true,platform:'node',target:'node24',format:'esm',packages:'external',logLevel:'warning',plugins:[plugin]});
fs.writeFileSync(path.join(output,'source-hashes.json'),JSON.stringify(sources,null,2));
fs.writeFileSync(path.join(output,'preflight.json'),JSON.stringify({mode,output,repo,baseline,focusedWorkerSha256:sha(checkedRead(path.join(home,'focused-worker.ts'))),scriptSha256:sha(checkedRead(fileURLToPath(import.meta.url))),workerSha256:sha(checkedRead(path.join(output,'worker.mjs'))),sourceCount:Object.keys(sources).length,noManifestBuild:true,noElectronStarted:mode==='--preflight'},null,2));
if(mode==='--preflight'){console.log(JSON.stringify({success:true,output,...baseline,sourceCount:Object.keys(sources).length}));process.exit(0);}
fs.symlinkSync(path.join(desktop,'node_modules'),path.join(output,'node_modules'),'junction');
fs.copyFileSync(path.join(desktop,'package.json'),path.join(output,'package.json'));
const bootstrap=path.join(output,'bootstrap.cjs');
fs.writeFileSync(bootstrap,`const {app}=require('electron'); app.setPath('userData',${JSON.stringify(path.join(output,'profile'))}); app.whenReady().then(async()=>{try{require(${JSON.stringify(path.join(home,'observer.cjs'))})(${JSON.stringify(output)},${JSON.stringify(repo)}); await import(${JSON.stringify(pathToFileURL(path.join(output,'worker.mjs')).href)});app.exit(process.exitCode||0);}catch(e){console.error(e.stack);app.exit(1);}});`);
const env={...process.env};for(const key of Object.keys(env))if(/(?:API_KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(key))delete env[key];delete env.NODE_OPTIONS;delete env.ELECTRON_RUN_AS_NODE;delete env.PHASE5_RESUME_ROOT;
const log=fs.createWriteStream(path.join(output,'worker.log'));const child=spawn(require('electron'),[bootstrap,output],{cwd:desktop,env,windowsHide:true,stdio:['ignore','pipe','pipe']});child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
const timeout=setTimeout(()=>child.kill(),360000);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});clearTimeout(timeout);await new Promise(r=>log.end(r));
let report;try{report=JSON.parse(fs.readFileSync(path.join(output,'report.json'),'utf8'));}catch{}
const success=code===0&&report?.success===true&&report.checks.length===1&&report.checks.every(c=>c.pass)&&report.sourceRequests.length===0;
console.log(JSON.stringify({success,code,output,root:report?.root,error:report?.error}));if(!success)process.exitCode=1;
