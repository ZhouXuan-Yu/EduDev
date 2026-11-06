/** Opt-in A10. Real native provider + public UI only; no stream/DOM/body fabrication. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync,backup} from 'node:sqlite';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {fingerprint} from './evidence.mjs';
import {boundedTree} from './ui-final-queue-recovery.mjs';
import {verifyUpwardNavigation} from './chat-reading-navigation.mjs';
const hash=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const need=(v,c)=>assert(v,c);
export function readingOptions(args){
  if(!args.includes('--a10')){
    need(!args.some(v=>/^--a10-/.test(v)),'A10_FLAG_REQUIRED');return null;
  }
  const get=name=>{const found=args.filter(v=>v.startsWith('--'+name+'='));need(found.length===1,'A10_EXACT_'+name.toUpperCase().replaceAll('-','_'));return found[0].slice(name.length+3);};
  const maxRequests=Number(get('a10-max-requests'));
  need(Number.isInteger(maxRequests)&&maxRequests>=1&&maxRequests<=8,'A10_PROVIDER_CAP_1_TO_8');
  const historyRunId=get('a10-history-run');need(/^run_[a-f0-9-]{36}$/.test(historyRunId),'A10_HISTORY_RUN_INVALID');
  return {pins:get('pins'),history:get('a10-history'),historyRunId,maxRequests,allowPaid:args.includes('--allow-paid')};
}
function logical(db){
  const schema=db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all();
  const tables=schema.filter(v=>v.type==='table').map(({name})=>{
    const stmt=db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"');stmt.setReturnArrays(true);stmt.setReadBigInts(true);
    const rows=[...stmt.iterate()].map(row=>hash(row.map(v=>typeof v==='bigint'?['integer',String(v)]:v instanceof Uint8Array?['blob',Buffer.from(v).toString('hex')]:v))).sort();
    return {table:name,count:rows.length,sha256:hash(rows)};
  });return {schemaSha256:hash(schema),tables,sha256:hash({schema,tables})};
}
const read=(file,work)=>{const db=new DatabaseSync(file,{readOnly:true});try{db.exec('PRAGMA query_only=ON;BEGIN');return work(db);}finally{db.close();}};
export async function prepareReading({root,output,data,profile,options}){
  need(options.allowPaid,'A10_EXPLICIT_ALLOW_PAID_REQUIRED');
  const owned=fs.realpathSync(path.join(root,'test-results'));
  const own=value=>{const file=path.resolve(root,value),rel=path.relative(owned,file);
    need(rel&&!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep)&&fs.realpathSync(file)===file&&!fs.lstatSync(file).isSymbolicLink(),'A10_OWNED_PATH_REQUIRED');return file;};
  const pinsFile=own(options.pins),pinsBytes=fs.readFileSync(pinsFile),pins=JSON.parse(pinsBytes),build=own(pins.buildRoot);
  for(const key of ['source','build'])need(/^[a-f0-9]{64}$/.test(pins[key]??''),'A10_PINS_INVALID');
  const main=own(path.join(build,'main/index.js')),source=own(options.history),oldReportFile=own(path.join(source,'report.json'));
  const old=JSON.parse(fs.readFileSync(oldReportFile));need(old.success===true,'A10_GENUINE_SUCCESSFUL_HISTORY_REQUIRED');
  const runs=old.runs?.filter(r=>r.runId===options.historyRunId);need(runs?.length===1,'A10_EXACT_HISTORY_RUN_REQUIRED');
  const sessionId=runs[0].sessionId;need(/^aisession_[a-f0-9-]{36}$/.test(sessionId),'A10_HISTORY_SESSION_INVALID');
  const declared=Number(fs.readFileSync(path.join(root,'src/main/xiaozhi-agent/budget-state.ts'),'utf8').match(/DEFAULT_PI_BUDGET[^\n]*maxModelCalls:\s*(\d+)/)?.[1]);
  need(Number.isInteger(declared)&&options.maxRequests<=declared,'A10_CAP_EXCEEDS_ORIGINAL_BUDGET');
  const helpers=['scripts/ui-goal-chat-live.mjs','scripts/acceptance/chat-live-reading-probe.mjs',
    'scripts/acceptance/chat-reading-navigation.mjs',
    'scripts/acceptance/chat-live-public-probe.mjs','scripts/acceptance/chat-live-manual-reopen.mjs',
    'scripts/acceptance/chat-paired-scenarios.mjs','scripts/acceptance/ui-final-queue-recovery.mjs',
    'scripts/acceptance/chat-live-blocker.mjs','scripts/acceptance/ui-style-probe.mjs','scripts/acceptance/chat-markdown-disclosure.mjs',
    'scripts/acceptance/evidence.mjs','scripts/acceptance/build-root.mjs'];
  const qa=()=>helpers.map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))})),qaBefore=qa();
  const verifyPins=()=>{need(hash(fs.readFileSync(pinsFile))===hash(pinsBytes),'A10_PINS_CHANGED');
    need(fingerprint(build).sha256===pins.build,'A10_BUILD_CHANGED');need(fingerprint(path.join(root,'src')).sha256===pins.source,'A10_SOURCE_CHANGED');
    assert.deepEqual(qa(),qaBefore,'A10 QA bytes changed');};verifyPins();
  need(process.platform==='win32','A10_PROCESS_PROOF_REQUIRES_WINDOWS');
  const encoded=Buffer.from(source).toString('base64');
  const result=spawnSync('powershell.exe',['-NoProfile','-Command',`$needle=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); @(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'electron.exe' -and $_.CommandLine -and $_.CommandLine.Contains($needle) }).Count`],{encoding:'utf8',windowsHide:true,timeout:8000});
  need(result.status===0&&/^0\s*$/.test(result.stdout),'A10_HISTORY_PROCESS_ACTIVE_OR_UNKNOWN');
  const before=boundedTree(source),sourceDb=path.join(source,'data/app.db');
  const original=read(sourceDb,db=>{
    need(db.prepare("SELECT COUNT(*) n FROM ai_agent_runs WHERE status NOT IN ('succeeded','failed','blocked','cancelled','interrupted')").get().n===0,'A10_ACTIVE_HISTORY_RUN');
    const row=db.prepare('SELECT * FROM ai_agent_runs WHERE id=? AND session_id=?').get(options.historyRunId,sessionId);
    need(row?.status==='succeeded','A10_HISTORY_RUN_NOT_SUCCEEDED');return {row,logical:logical(db)};
  });
  for(const kind of ['data','profile']){
    const inventory=boundedTree(own(path.join(source,kind))),destination=kind==='data'?data:profile;fs.mkdirSync(destination);
    for(const entry of inventory.files){
      const sidecar=/(?:-wal|-shm|-journal)$/i.test(entry.file);
      if(sidecar){need(kind==='data'&&['app.db-wal','app.db-shm'].includes(entry.file)||entry.bytes===0,'A10_OTHER_DATABASE_HOT');continue;}
      if(kind==='data'&&entry.file==='app.db')continue;
      const from=path.join(inventory.root,entry.file),to=path.join(destination,entry.file);
      need(hash(fs.readFileSync(from))===entry.sha256,'A10_HISTORY_CHANGED');fs.mkdirSync(path.dirname(to),{recursive:true});
      fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);need(hash(fs.readFileSync(to))===entry.sha256,'A10_CLONE_CHANGED');
    }
  }
  need(!fs.existsSync(path.join(profile,'xiaozhi-data-selection.v1.json'))&&!fs.existsSync(path.join(data,'xiaozhi-recovery.v1.json')),'A10_RESTORE_SELECTION_FORBIDDEN');
  const db=new DatabaseSync(sourceDb,{readOnly:true});try{db.exec('PRAGMA query_only=ON;BEGIN');await backup(db,path.join(data,'app.db'));need(logical(db).sha256===original.logical.sha256,'A10_HISTORY_CHANGED');}finally{db.close();}
  const cold=new DatabaseSync(path.join(data,'app.db'));try{need(cold.prepare('PRAGMA journal_mode=DELETE').get().journal_mode==='delete','A10_CLONE_NOT_COLD');}finally{cold.close();}
  need(read(path.join(data,'app.db'),logical).sha256===original.logical.sha256,'A10_CLONE_LOGICAL_CHANGED');
  const runIdsBefore=new Set(read(path.join(data,'app.db'),db=>db.prepare('SELECT id FROM ai_agent_runs').all().map(row=>row.id))),countBefore=runIdsBefore.size;
  const observeRuns=()=>read(path.join(data,'app.db'),db=>{const rows=db.prepare('SELECT id,session_id,status FROM ai_agent_runs ORDER BY id').all();
    return {before:countBefore,after:rows.length,added:rows.filter(row=>!runIdsBefore.has(row.id))};});
  const verify=()=>{verifyPins();need(boundedTree(source).sha256===before.sha256,'A10_HISTORY_CHANGED');
    need(read(sourceDb,logical).sha256===original.logical.sha256,'A10_HISTORY_CHANGED');
    assert.deepEqual(read(path.join(data,'app.db'),db=>db.prepare('SELECT * FROM ai_agent_runs WHERE id=?').get(options.historyRunId)),original.row,'Genuine historical run may not change');};
  verify();
  return {main,sessionId,verify,observeRuns,
    verifyRuns:(newRunId)=>{const observed=observeRuns();
      need(observed.after===countBefore+1&&observed.added.length===1,'A10_MORE_THAN_ONE_NEW_TASK');
      const row=observed.added[0];need(row.id===newRunId&&row.session_id===sessionId&&row.status==='succeeded','A10_NEW_RUN_NOT_SUCCEEDED');return row;
    },evidence:{pins:{file:pinsFile,...pins},qaBefore,originalBudgetMax:declared,maxProviderRequests:options.maxRequests,runCountBefore:countBefore,
      history:{root:source,reportSha256:hash(fs.readFileSync(oldReportFile)),fullSha256:before.sha256,logicalSha256:original.logical.sha256,
        originalPins:{source:old.sourceSha256??null,build:old.buildSha256},sessionId,runId:options.historyRunId},
      taskBudget:1,launchBudget:2,coldReplayBudget:0,productAcceptance:false}};
}

/** Count BEFORE calling the original transport; never synthesize a response or events. */
export function installReadingMeter({net,session},options){
  const crypto=process.getBuiltinModule('crypto'),digest=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
  const state={requests:0,wire:0,catalogue:0,catalogueWire:0,escaped:0,fatal:null,limit:options.maxRequests,events:[]},tickets=new Map(),requestBodies=new Set();
  const trip=code=>{state.fatal??=code;state.events.push({code});return Error(code);};
  const original=net.fetch.bind(net);
  net.fetch=async(input,init={})=>{
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url),method=String(init.method??input?.method??'GET').toUpperCase();
    if(state.fatal)throw Error('A10_GUARD_LATCHED');
    if(url.protocol!=='https:'||url.hostname!=='api.deepseek.com'||url.port||url.search||url.username||url.password)throw trip('A10_ENDPOINT_DENIED');
    if(method==='POST'&&['/v1/chat/completions','/chat/completions'].includes(url.pathname)){
      if(state.requests>=options.maxRequests)throw trip('A10_PROVIDER_BUDGET');
      const body=typeof init.body==='string'?init.body:input instanceof Request?await input.clone().text():null;
      if(!body||Buffer.byteLength(body)>2*1024*1024)throw trip('A10_BODY_INVALID');
      let payload;try{payload=JSON.parse(body);}catch{throw trip('A10_BODY_INVALID');}
      if(payload.model!=='deepseek-flash'||payload.stream!==true)throw trip('A10_MODEL_SCOPE');
      // Request.clone().text() yields: concurrent attempts must recheck at wire time.
      if(state.fatal||state.requests>=options.maxRequests)throw trip('A10_PROVIDER_BUDGET');
      const bodyHash=digest(body);
      if(requestBodies.has(bodyHash))throw trip('A10_REPLAYED_MODEL_BODY_DENIED');
      requestBodies.add(bodyHash);
      state.requests++;state.events.push({code:'REAL_PROVIDER_REQUEST',number:state.requests,hash:bodyHash});
    }else if(options.maxRequests>0&&method==='GET'&&['/models','/v1/models'].includes(url.pathname)&&state.catalogue===0){state.catalogue++;state.events.push({code:'REAL_OFFICIAL_CATALOGUE'});}
    else throw trip('A10_UNEXPECTED_HTTP');
    // Same one-use transport ticket as the actual S1 guard. Removed by the
    // default-session header hook before wire; request body/response stay intact.
    const ticket=crypto.randomUUID(),entry={url:url.href,method,wired:false};tickets.set(ticket,entry);
    const headers=new Headers(init.headers??(input instanceof Request?input.headers:undefined));headers.set('X-EduDev-QA-Ticket',ticket);
    try{
      const response=await original(input,{...init,headers,redirect:'error'});
      if(!entry.wired)throw trip('A10_NATIVE_WIRE_NOT_OBSERVED');return response;
    }finally{tickets.delete(ticket);}
  };
  globalThis.fetch=async()=>{throw trip('A10_UNMETERED_FETCH');};
  const web=session.defaultSession.webRequest,register=web.onBeforeRequest.bind(web);let formal;
  const composed=(details,callback)=>{
    let scoped=false;try{const url=new URL(details.url);scoped=url.protocol==='https:'&&url.hostname==='api.deepseek.com'&&!url.port&&!url.search&&!url.username&&!url.password&&
      (details.method==='POST'&&['/chat/completions','/v1/chat/completions'].includes(url.pathname)||details.method==='GET'&&['/models','/v1/models'].includes(url.pathname));}catch{}
    if(/^(https?|wss?):/i.test(details.url)&&!scoped){state.escaped++;trip('A10_WEB_HTTP_DENIED');callback({cancel:true});}
    else if(formal)formal(details,callback);else callback({cancel:false});
  };
  web.onBeforeRequest=(...args)=>{if(args.length!==1||args[0]!==null&&typeof args[0]!=='function')throw trip('A10_POLICY_REPLACEMENT');formal=args[0];register(composed);};register(composed);
  web.onBeforeSendHeaders({urls:['https://api.deepseek.com/*']},(details,callback)=>{
    const headers={...details.requestHeaders},keys=Object.keys(headers).filter(key=>key.toLowerCase()==='x-edudev-qa-ticket');
    const ticket=keys.length===1?headers[keys[0]]:undefined,entry=tickets.get(ticket);for(const key of keys)delete headers[key];tickets.delete(ticket);
    if(state.fatal||!entry||entry.wired||entry.url!==details.url||entry.method!==details.method){state.escaped++;trip('A10_UNRESERVED_NATIVE_WIRE');callback({cancel:true});return;}
    entry.wired=true;if(entry.method==='POST')state.wire++;else state.catalogueWire++;
    callback({requestHeaders:headers});
  });
  globalThis.__a10ReadingMeter={state};
}
export function readingBootstrap({main,profile,maxRequests,stateFile}){
  return `const e=require('electron'),fs=require('node:fs');e.app.setPath('userData',${JSON.stringify(profile)});e.app.setPath('sessionData',${JSON.stringify(profile)});process.once('exit',()=>{if(globalThis.__a10ReadingMeter)fs.writeFileSync(${JSON.stringify(stateFile+'.meter.json')},JSON.stringify(globalThis.__a10ReadingMeter.state),{flag:'wx'});});(async()=>{await e.app.whenReady();(${installReadingMeter.toString()})(e,{maxRequests:${maxRequests}});await import(require('node:url').pathToFileURL(${JSON.stringify(main)}).href);fs.writeFileSync(${JSON.stringify(stateFile)},JSON.stringify({phase:'MAIN_IMPORTED'}),{flag:'wx'});})().catch(error=>{fs.writeFileSync(${JSON.stringify(stateFile+'.error.json')},JSON.stringify({code:'A10_BOOTSTRAP_FAILED',hash:require('node:crypto').createHash('sha256').update(String(error?.stack||error)).digest('hex')}),{flag:'wx'});e.app.exit(1);});`;
}
export function readReadingExit(file,limit,before){
  const stat=fs.lstatSync(file);need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size>0&&stat.size<=65536&&fs.realpathSync(file)===file,'A10_EXIT_METER_INVALID');
  const meter=JSON.parse(fs.readFileSync(file));need(meter.limit===limit&&!meter.fatal&&meter.escaped===0,'A10_EXIT_GUARD_FAILED');
  need(Number.isInteger(meter.requests)&&meter.requests>=0&&meter.requests<=limit&&meter.requests>=(before?.requests??0)&&meter.wire===meter.requests&&
    Number.isInteger(meter.catalogue)&&meter.catalogue>=0&&meter.catalogue<=(limit?1:0)&&meter.catalogueWire===meter.catalogue,'A10_EXIT_BUDGET_FAILED');
  return meter;
}

/** Only reads original DOM, native Selection and existing sanitized public-event metadata.
 * QA state holds node references; no DOM selection setter, scroll setter or event dispatcher. */
export function readingBrowser({op,sessionId,runId,historyRunId}){
  const one=selector=>{const nodes=[...document.querySelectorAll(selector)];if(nodes.length!==1)throw Error('A10_DOM_NOT_UNIQUE');return nodes[0];};
  if(op==='install'){
    if(window.__a10Reading)throw Error('A10_PROBE_ALREADY_INSTALLED');
    const host=one('[data-testid="office-conversation"]'),history=one(`.office-turn[data-turn-id="${historyRunId}"]`),
      run=one(`.office-turn[data-turn-id="${runId}"]`),body=history.querySelectorAll('[data-testid="agent-reply-body"]');
    if(body.length!==1||history.getAttribute('data-state')!=='completed'||body[0].textContent.trim().length<120)throw Error('A10_INSUFFICIENT_GENUINE_HISTORY');
    window.__a10Reading={sessionId,runId,historyRunId,host,history,run,body:body[0],historyText:body[0].textContent,
      content:one('[data-slot="chat-conversation-content"]'),composer:one('.office-composer-container'),nav:one('[data-testid="edu-navigation"]'),
      samples:[],baseline:null,terminal:false};
    const reading=window.__a10Reading;
    reading.wheels=[];reading.inputs=[];
    reading.onWheel=event=>reading.wheels.push({scrollTop:host.scrollTop,deltaY:event.deltaY,
      trusted:event.isTrusted,inside:host.contains(event.target),at:performance.now()});
    host.addEventListener('wheel',reading.onWheel,{capture:true,passive:true});
    return {historyChars:body[0].textContent.length};
  }
  const p=window.__a10Reading;if(!p)throw Error('A10_PROBE_MISSING');
  const own=(window.__uiChatEvents||[]).filter(e=>e.sessionId===p.sessionId&&e.runId===p.runId);
  const sequence=Math.max(0,...own.map(e=>e.sequence));
  const terminal=own.find(e=>e.kind==='status'&&['completed','failed','interrupted'].includes(e.status));
  const h=p.host.getBoundingClientRect();
  if(op==='before-wheel'){
    const input={scrollTop:p.host.scrollTop,at:performance.now()};p.inputs.push(input);return input;
  }
  if(op==='candidate'){
    if(p.host.scrollHeight-p.host.clientHeight<100)throw Error('A10_INSUFFICIENT_SCROLL_HISTORY');
    const walker=document.createTreeWalker(p.body,NodeFilter.SHOW_TEXT);let node;
    while((node=walker.nextNode())){
      if(node.parentElement?.closest('button,a,pre,code')||node.data.trim().length<16)continue;
      for(let i=0;i+12<node.data.length;i++){
        const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+12);const rects=[...range.getClientRects()];
        if(rects.length!==1)continue;const r=rects[0];
        if(r.width<20||r.top<h.top+12||r.bottom>h.bottom-12||r.left<h.left+8||r.right>h.right-8)continue;
        const start=document.createRange(),end=document.createRange();start.setStart(node,i);start.setEnd(node,i+1);end.setStart(node,i+11);end.setEnd(node,i+12);
        const a=start.getBoundingClientRect(),b=end.getBoundingClientRect(),y=(r.top+r.bottom)/2;
        if(!p.history.contains(document.elementFromPoint(a.left+1,y))||!p.history.contains(document.elementFromPoint(b.right-1,y)))continue;
        p.target=node;p.targetText=node.data;return {start:{x:a.left+1,y},end:{x:b.right-1,y},scrollTop:p.host.scrollTop,wheels:p.wheels.slice(),inputs:p.inputs.slice(),host:{x:h.left+h.width/2,y:h.top+h.height/2,height:h.height}};
      }
    }return {scrollTop:p.host.scrollTop,wheels:p.wheels.slice(),inputs:p.inputs.slice(),host:{x:h.left+h.width/2,y:h.top+h.height/2,height:h.height}};
  }
  const selection=document.getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):null;
  const text=selection?.toString()||'',rect=range?.getBoundingClientRect();
  const active=p.run.getAttribute('data-state')==='running'&&!terminal;
  const sample={sequence,terminalSequence:terminal?.sequence??null,active,
    selected:text,anchorOffset:selection?.anchorOffset,focusOffset:selection?.focusOffset,
    anchorNodeSame:selection?.anchorNode===p.target,focusNodeSame:selection?.focusNode===p.target,
    sameShell:p.host===document.querySelector('[data-testid="office-conversation"]')&&p.host.isConnected&&
      p.content===p.host.querySelector('[data-slot="chat-conversation-content"]')&&p.content.isConnected&&
      p.composer===document.querySelector('.office-composer-container')&&p.composer.isConnected&&
      p.nav===document.querySelector('[data-testid="edu-navigation"]')&&p.nav.isConnected&&p.run.isConnected&&p.history.isConnected,
    sameRun:p.composer.getAttribute('data-session-id')===p.sessionId&&p.run.getAttribute('data-turn-id')===p.runId&&
      p.run===document.querySelector(`.office-turn[data-turn-id="${p.runId}"]`),
    bodyChars:[...p.run.querySelectorAll('[data-testid="agent-reply-body"]')].reduce((n,node)=>n+node.textContent.length,0),
    historyUnchanged:p.body.isConnected&&p.body.textContent===p.historyText&&p.target?.data===p.targetText,
    scrollTop:p.host.scrollTop,bottomGap:p.host.scrollHeight-p.host.scrollTop-p.host.clientHeight,
    anchorTop:rect?rect.top-h.top:null,rangeVisible:!!rect&&rect.top>=h.top&&rect.bottom<=h.bottom};
  if(op==='arm'){
    if(!active||text.trim().length<6||!sample.anchorNodeSame||!sample.focusNodeSame||!sample.rangeVisible||sample.bottomGap<40){
      // Before throwing, preserve only predicate/geometry metadata. Never copy
      // selected text, node data, HTML, event bodies or arbitrary error fields.
      const diagnostic={code:'A10_ARM_DIAGNOSTIC',observedAt:Date.now(),sequence,terminalSequence:terminal?.sequence??null,
        active,selectedChars:text.length,selectedTrimmedChars:text.trim().length,
        anchorNodeSame:sample.anchorNodeSame,focusNodeSame:sample.focusNodeSame,rangeVisible:sample.rangeVisible,
        anchorOffset:sample.anchorOffset,focusOffset:sample.focusOffset,
        scrollTop:sample.scrollTop,bottomGap:sample.bottomGap,anchorTop:sample.anchorTop,
        sameShell:sample.sameShell,sameRun:sample.sameRun,historyUnchanged:sample.historyUnchanged,
        targetConnected:!!p.target?.isConnected,bodyChars:sample.bodyChars,
        failedPredicates:[...(!active?['ACTIVE_STREAM']:[]),...(text.trim().length<6?['SELECTION_LENGTH']:[]),
          ...(!sample.anchorNodeSame?['ANCHOR_NODE']:[]),...(!sample.focusNodeSame?['FOCUS_NODE']:[]),
          ...(!sample.rangeVisible?['RANGE_VISIBLE']:[]),...(sample.bottomGap<40?['BOTTOM_GAP']:[])]};
      throw Error('A10_SELECTION_OR_STREAM_WINDOW_MISSING '+JSON.stringify(diagnostic));
    }
    p.baseline=sample;p.samples=[];
    // Sample at original DOM commits and animation frames without mutating it.
    p.schedule=()=>{if(!p.raf)p.raf=requestAnimationFrame(()=>{p.raf=null;p.tick();});};
    p.observer=new MutationObserver(p.schedule);
    p.tick=()=>{const current=readingBrowser({op:'sample'});if(p.samples.length<512)p.samples.push(current);else p.overflow=true;};
    p.observer.observe(p.host,{subtree:true,childList:true,characterData:true});
    p.host.addEventListener('scroll',p.schedule);document.addEventListener('selectionchange',p.schedule);
  }
  if(op==='inspect'||op==='finish'){
    if(op==='finish'){
      p.observer?.disconnect();if(p.raf)cancelAnimationFrame(p.raf);
      p.host.removeEventListener('scroll',p.schedule);document.removeEventListener('selectionchange',p.schedule);
      p.host.removeEventListener('wheel',p.onWheel,true);
    }
    return {baseline:p.baseline,samples:[...p.samples,sample],final:sample,overflow:!!p.overflow,events:own};
  }
  return sample;
}

export function verifyReading(proof,{allowPending=false}={}){
  need(proof?.baseline&&!proof.overflow,'A10_MISSING_OR_TRUNCATED_PROOF');const b=proof.baseline;
  need(b.active&&!b.terminalSequence&&b.selected.trim().length>=6&&b.bottomGap>=40,'A10_LIVE_SELECTION_REQUIRED');
  const ordered=proof.events.slice().sort((a,b)=>a.sequence-b.sequence);
  let phase,subsequent=[];const terminal=ordered.find(e=>e.kind==='status'&&['completed','failed','interrupted'].includes(e.status));
  for(const e of ordered){if(e.kind==='assistant_start')phase=undefined;if(e.kind==='assistant_phase')phase=e.phase;
    if(e.kind==='text_delta'&&phase==='final_answer'&&e.chars>0&&e.sequence>b.sequence&&(!terminal||e.sequence<terminal.sequence))subsequent.push(e.sequence);}
  subsequent=[...new Set(subsequent)];
  const eligible=proof.samples.filter(s=>s.active&&s.bodyChars>b.bodyChars&&s.sequence>=subsequent[1]&&(!terminal||s.sequence<terminal.sequence));
  for(const s of [...proof.samples,proof.final]){
    need(s.sameShell&&s.sameRun&&s.historyUnchanged,'A10_IDENTITY_OR_HISTORY_CHANGED');
    need(s.selected===b.selected&&s.anchorNodeSame&&s.focusNodeSame&&s.anchorOffset===b.anchorOffset&&s.focusOffset===b.focusOffset,'A10_SELECTION_LOST');
    const geometry={baseline:{sequence:b.sequence,scrollTop:b.scrollTop,anchorTop:b.anchorTop,bottomGap:b.bottomGap},
      sample:{sequence:s.sequence,active:s.active,scrollTop:s.scrollTop,anchorTop:s.anchorTop,bottomGap:s.bottomGap,rangeVisible:s.rangeVisible,bodyChars:s.bodyChars}};
    need(s.rangeVisible&&Math.abs(s.anchorTop-b.anchorTop)<=3&&Math.abs(s.scrollTop-b.scrollTop)<=3&&s.bottomGap>=40,
      'A10_FORCED_BOTTOM_OR_ANCHOR_JUMP '+JSON.stringify(geometry));
  }
  // Pending is exclusively the real body barrier. Identity/selection failures
  // above always fail immediately; terminal without the barrier cannot retry.
  if(allowPending&&proof.final.active&&!terminal&&(subsequent.length<2||!eligible.length))
    return {status:'WAITING_REAL_BODY',afterSequence:b.sequence,publicBodyDeltas:subsequent.length,liveSamplesAfterDeltas:eligible.length};
  need(subsequent.length>=2,'A10_TWO_LATER_REAL_BODY_DELTAS_REQUIRED');
  need(eligible.length>0,'A10_NO_LIVE_DOM_SAMPLE_AFTER_DELTAS');
  return {status:'PASS',selectedChars:b.selected.length,selectionSha256:hash(b.selected),afterSequence:b.sequence,
    publicBodyDeltas:subsequent.length,firstLaterSequence:subsequent[0],lastLaterSequence:subsequent.at(-1),
    liveSamplesAfterDeltas:eligible.length,samples:proof.samples.length,anchorTolerancePx:3,
    initialScrollTop:b.scrollTop,finalScrollTop:proof.final.scrollTop,finalBottomGap:proof.final.bottomGap};
}
export async function beginReading({page,sessionId,runId,historyRunId}){
  await page.evaluate(readingBrowser,{op:'install',sessionId,runId,historyRunId});
  let target,initialScrollTop;
  // Bounded real wheel navigation, not an action retry or synthetic scroll event.
  for(let i=0;i<7;i++){
    target=await page.evaluate(readingBrowser,{op:'candidate'});
    initialScrollTop??=target.scrollTop;
    if(target.start&&i>0)break;
    await page.mouse.move(target.host.x,target.host.y);
    await page.evaluate(readingBrowser,{op:'before-wheel'});
    await page.mouse.wheel(0,-Math.round(target.host.height*0.6));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  }
  need(target?.start,'A10_NO_VISIBLE_STABLE_HISTORY_PASSAGE');
  const navigation=verifyUpwardNavigation({initialScrollTop,scrollTop:target.scrollTop,wheels:target.wheels,inputs:target.inputs});
  await page.mouse.move(target.start.x,target.start.y);await page.mouse.down();
  try{await page.mouse.move(target.end.x,target.end.y,{steps:12});}finally{await page.mouse.up();}
  const after=await page.evaluate(readingBrowser,{op:'arm'});
  return {afterSequence:after.sequence,selectedChars:after.selected.length,selectionSha256:hash(after.selected),upwardDistance:navigation.upwardDistance,navigation,
    interaction:'real mouse.wheel upward + mouse.down/move/up on immutable historical final body'};
}
export async function finishReading(page){return verifyReading(await page.evaluate(readingBrowser,{op:'finish'}));}
export async function readingProgress(page){return verifyReading(await page.evaluate(readingBrowser,{op:'inspect'}),{allowPending:true});}

/** Failure-only public geometry. Deliberately excludes selected text and model bodies. */
export function readingDiagnostic(){
  const p=window.__a10Reading;if(!p)return {installed:false};
  const safe=s=>s?Object.fromEntries(['sequence','terminalSequence','active','anchorOffset','focusOffset',
    'anchorNodeSame','focusNodeSame','sameShell','sameRun','bodyChars','historyUnchanged','scrollTop',
    'bottomGap','anchorTop','rangeVisible'].map(key=>[key,s[key]])):null;
  return {installed:true,baseline:safe(p.baseline),samples:p.samples.map(safe),wheels:p.wheels,inputs:p.inputs,
    overflow:!!p.overflow,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
    documentFocus:document.hasFocus(),visibility:document.visibilityState};
}

export async function readingSelfCheck(){
  const base={active:true,terminalSequence:null,selected:'stable public history',bottomGap:100,sequence:3,
    sameShell:true,sameRun:true,historyUnchanged:true,anchorNodeSame:true,focusNodeSame:true,
    anchorOffset:1,focusOffset:22,rangeVisible:true,anchorTop:50,scrollTop:100,bodyChars:10};
  // Verifier unit inputs only; never injected into an application/event transport.
  const proof={baseline:base,samples:[{...base,sequence:6,bodyChars:15}],final:{...base,active:false,sequence:7,bodyChars:20},events:[
    {kind:'assistant_phase',phase:'final_answer',sequence:2},{kind:'text_delta',chars:2,sequence:4},
    {kind:'text_delta',chars:3,sequence:6},{kind:'status',status:'completed',sequence:7}]};
  const checks=[];need(verifyReading(proof).publicBodyDeltas===2,'SELF_CHECK');checks.push('TWO_REAL_BODY_DELTA_BARRIER_VERIFIER');
  for(const [code,patch]of [['SELECTION_LOSS',{selected:''}],['ANCHOR_JUMP',{anchorTop:60}],['FORCED_BOTTOM',{bottomGap:0}],
    ['SHELL_REMOUNT',{sameShell:false}],['RUN_CHANGED',{sameRun:false}],['HISTORY_CHANGED',{historyUnchanged:false}]]){
    const invalid=structuredClone(proof);Object.assign(invalid.samples[0],patch);assert.throws(()=>verifyReading(invalid));checks.push(code+'_REJECTED');
  }
  const late=structuredClone(proof);late.samples[0].active=false;assert.throws(()=>verifyReading(late));checks.push('TERMINAL_ONLY_SAMPLE_REJECTED');
  const old=structuredClone(proof);old.baseline.sequence=6;assert.throws(()=>verifyReading(old));checks.push('PRE_ACTION_DELTAS_REJECTED');
  const noBody=structuredClone(proof);noBody.samples[0].bodyChars=base.bodyChars;assert.throws(()=>verifyReading(noBody));checks.push('EVENTS_WITHOUT_LIVE_BODY_GROWTH_REJECTED');
  const duplicate=structuredClone(proof);duplicate.events[2].sequence=4;assert.throws(()=>verifyReading(duplicate));checks.push('DUPLICATE_SEQUENCE_NOT_TWO_DELTAS');
  const pending=structuredClone(proof);pending.events=pending.events.slice(0,2);pending.samples=[];pending.final={...base,sequence:4};
  assert.equal(verifyReading(pending,{allowPending:true}).status,'WAITING_REAL_BODY');
  assert.throws(()=>verifyReading(pending));checks.push('PENDING_BARRIER_IS_NOT_PASS');
  const pendingLoss=structuredClone(pending);pendingLoss.final.selected='';
  assert.throws(()=>verifyReading(pendingLoss,{allowPending:true}),/A10_SELECTION_LOST/);checks.push('PENDING_SELECTION_FAILURE_FAILS_FAST');
  pending.final.active=false;pending.events.push({kind:'status',status:'completed',sequence:7});
  assert.throws(()=>verifyReading(pending,{allowPending:true}),/A10_TWO_LATER_REAL_BODY_DELTAS_REQUIRED/);checks.push('TERMINAL_WITHOUT_BARRIER_NEVER_PENDING');
  // Execute the actual opt-in run orchestration with unit browser boundaries.
  // No app, SQL, provider, injected stream or acceptance evidence is involved.
  const ts=await import('typescript'),runner=fs.readFileSync(new URL('../ui-goal-chat-live.mjs',import.meta.url),'utf8');
  const tree=ts.createSourceFile('runner.mjs',runner,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);let runSource;
  function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='run')runSource=node.getText(tree);ts.forEachChild(node,visit);}visit(tree);
  need(runSource,'SELF_CHECK_ACTUAL_RUN_SOURCE');
  for(const mode of ['sealed-live','sealed-terminal','pending','invalid-selection','already-final']){
    const calls=[],stop=Error('UNIT_STOP'),invalid=Error('A10_SELECTION_LOST'),ended=Error('A10_SELECTION_OR_STREAM_WINDOW_MISSING'),id='unit-run',sessionId='unit-session';
    let poll=0,expanded='false';const report={runs:[],a10:{}};
    const toggle={waitFor:async()=>{},getAttribute:async()=>expanded};
    const turn={locator:()=>({count:async()=>1}),getByTestId:name=>name==='agent-trace-toggle'?toggle:{isVisible:async()=>true}};
    const context={assert,Date,console,a10:{},sessionId,readingConfig:{historyRunId:'unit-history'},ownedRun:undefined,
      requireManualReopen:true,focusMode:'summary',captureStyles:false,report,limit:180000,scenario:{},
      send:async()=>id,section:()=>turn,readOnlyRunBlocker:()=>null,
      state:async()=>({running:poll<3,turns:[{id,status:poll<3?'running':'completed',tools:[{}],answer:[],publicProcessCount:1,presentation:{handoff:'explicit'}}]}),
      events:async()=>[{runId:id,kind:'tool_start',sequence:1},...(poll>=2||mode==='already-final'?[{runId:id,kind:'assistant_phase',phase:'final_answer',sequence:2}]:[])],
      beginReading:async()=>{calls.push('arm');if(mode==='invalid-selection')throw invalid;if(mode==='already-final')throw ended;return {};},
      readingProgress:async()=>{calls.push('inspect');return {status:poll<2||mode==='pending'?'WAITING_REAL_BODY':'PASS'};},
      finishReading:async()=>{calls.push('seal');return {status:'PASS'};},check:()=>{},
      page:{evaluate:async fn=>{
        if(fn===context.manualReopenCheckpoint)return {running:mode!=='sealed-terminal',terminalSequence:mode==='sealed-terminal'?5:null};
        return {beforeTerminal:true};}},manualReopenCheckpoint:()=>{},
      reopenProcessDuringStream:async({evidence})=>{calls.push('manual');expanded='true';evidence.after={running:true};evidence.afterSequence=4;},
      verifyManualReopen:()=>{calls.push('verify');throw stop;},
      until:async fn=>{for(poll=1;poll<=3;poll++){if(mode==='pending'&&poll===3)throw stop;await fn();}throw stop;}};
    let error;try{await vm.runInNewContext('('+runSource+')',context)('unit prompt','attachment',true);}catch(caught){error=caught;}
    if(mode==='invalid-selection'){assert.equal(error,invalid);assert.deepEqual(calls,['arm']);}
    else if(mode==='already-final'){assert.equal(error,ended);assert.deepEqual(calls,['arm']);}
    else {
      assert.equal(error,stop);assert.equal(calls.filter(v=>v==='arm').length,1);
      if(mode==='pending'){assert(!calls.includes('seal')&&!calls.includes('manual'));}
      else {assert(calls.indexOf('seal')>calls.indexOf('arm'));assert.equal(calls.includes('manual'),mode==='sealed-live');
        if(mode==='sealed-live')assert(calls.indexOf('manual')>calls.indexOf('seal'));
        else assert.equal(report.runs[0].manualReopen.notRunReason,'STREAM_ENDED_AFTER_A10_SEAL');}
    }
    checks.push('ACTUAL_RUN_'+mode.toUpperCase().replaceAll('-','_'));
  }
  assert.throws(()=>readingOptions(['--a10','--a10-max-requests=9']));checks.push('BUDGET_NOT_EXPANDED');
  const source=readingBrowser.toString();need(!/\.scrollTop\s*=(?!=)|\.scrollTo\(|\.setBaseAndExtent\(|\.addRange\(|\.removeAllRanges\(|\.dispatchEvent\(|\.textContent\s*=(?!=)|\.innerHTML\s*=(?!=)/.test(source),'SELF_CHECK_DOM_MUTATION');
  checks.push('BROWSER_PROBE_NEVER_WRITES_DOM_SELECTION_OR_SCROLL');
  // Unit DOM boundary only; exercise the actual serialized failure branch.
  for(const finished of [false,true]){
    const target={data:'PRIVATE_NODE_SENTINEL',isConnected:true},content={isConnected:true},nav={isConnected:true},history={isConnected:true};
    const body={isConnected:true,textContent:'PRIVATE_HISTORY_SENTINEL'};
    const run={isConnected:true,getAttribute:key=>key==='data-state'?(finished?'completed':'running'):'unit-run',querySelectorAll:()=>[{textContent:'public body'}]};
    const composer={isConnected:true,getAttribute:()=> 'unit-session'},host={isConnected:true,scrollTop:100,scrollHeight:700,clientHeight:500,
      getBoundingClientRect:()=>({top:0,bottom:500}),querySelector:()=>content};
    const selectors={'[data-testid="office-conversation"]':host,'.office-composer-container':composer,'[data-testid="edu-navigation"]':nav,'.office-turn[data-turn-id="unit-run"]':run};
    const context={Date,Error,window:{__a10Reading:{sessionId:'unit-session',runId:'unit-run',host,history,run,body,historyText:body.textContent,target,targetText:target.data,content,composer,nav},__uiChatEvents:[]},
      document:{querySelector:selector=>selectors[selector],getSelection:()=>({toString:()=>finished?'PRIVATE_SELECTION_SENTINEL':'',rangeCount:1,
        anchorNode:target,focusNode:target,anchorOffset:0,focusOffset:12,getRangeAt:()=>({getBoundingClientRect:()=>({top:10,bottom:20})})})}};
    let failure;try{vm.runInNewContext('('+readingBrowser.toString()+')',context)({op:'arm'});}catch(error){failure=error;}
    need(failure?.message.startsWith('A10_SELECTION_OR_STREAM_WINDOW_MISSING '),'SELF_CHECK_ARM_DIAGNOSTIC');
    const diagnostic=JSON.parse(failure.message.slice(failure.message.indexOf('{')));
    need(diagnostic.failedPredicates.includes(finished?'ACTIVE_STREAM':'SELECTION_LENGTH'),'SELF_CHECK_ARM_PREDICATE');
    need(!/PRIVATE_|SENTINEL/.test(failure.message),'SELF_CHECK_ARM_PRIVACY');
  }
  checks.push('ARM_FAILURE_DISTINGUISHES_STREAM_AND_SELECTION_WITHOUT_TEXT');
  // Isolated unit transport boundary only: the native stub throws, never emits
  // model content/events or a response. Nothing below launches an application.
  const createMeter=limit=>{
    const sentinel=Error('UNIT_NATIVE_BOUNDARY'),calls=[];let policy,sendHeaders;
    const sandbox={process,Buffer,URL,Request,Headers,Error,net:{fetch:async(input,init)=>{
      const details={url:typeof input==='string'?input:input.url,method:init.method??input.method,requestHeaders:Object.fromEntries(init.headers)};
      let before,wire;policy(details,value=>{before=value;});assert.equal(before.cancel,false);
      sendHeaders(details,value=>{wire=value;});assert.notEqual(wire.cancel,true);
      assert(!Object.keys(wire.requestHeaders).some(k=>k.toLowerCase()==='x-edudev-qa-ticket'));
      calls.push([input,init]);throw sentinel;
    }},session:{defaultSession:{webRequest:{onBeforeRequest:fn=>{policy=fn;},onBeforeSendHeaders:(_filter,fn)=>{sendHeaders=fn;}}}}};
    vm.createContext(sandbox);vm.runInContext(`(${installReadingMeter.toString()})({net,session},{maxRequests:${limit}})`,sandbox);
    return {sandbox,calls,sentinel,get policy(){return policy;},get sendHeaders(){return sendHeaders;},state:sandbox.__a10ReadingMeter.state};
  };
  const endpoint='https://api.deepseek.com/v1/chat/completions',init={method:'POST',body:JSON.stringify({model:'deepseek-flash',stream:true})};
  const meter=createMeter(1);await assert.rejects(meter.sandbox.net.fetch(endpoint,init),error=>error===meter.sentinel);
  assert.equal(meter.calls[0][0],endpoint);assert.equal(meter.calls[0][1].body,init.body);assert.equal(meter.state.requests,1);assert.equal(meter.state.wire,1);
  await assert.rejects(meter.sandbox.net.fetch(endpoint,init),/A10_PROVIDER_BUDGET/);assert.equal(meter.calls.length,1);checks.push('NATIVE_BODY_UNCHANGED_TICKET_STRIPPED_WEBREQUEST_CHAIN_AND_HARD_CAP');
  const concurrent=createMeter(1);await Promise.allSettled([1,2].map(()=>concurrent.sandbox.net.fetch(new Request(endpoint,init))));
  assert.equal(concurrent.calls.length,1);assert.equal(concurrent.state.requests,1);checks.push('CONCURRENT_REQUEST_BODY_CAP');
  const replay=createMeter(2);await assert.rejects(replay.sandbox.net.fetch(endpoint,init),error=>error===replay.sentinel);
  await assert.rejects(replay.sandbox.net.fetch(endpoint,init),/A10_REPLAYED_MODEL_BODY_DENIED/);
  assert.equal(replay.calls.length,1);checks.push('EXACT_PROVIDER_BODY_RETRY_DENIED_BEFORE_WIRE');
  const continuation=createMeter(2);await assert.rejects(continuation.sandbox.net.fetch(endpoint,init),error=>error===continuation.sentinel);
  await assert.rejects(continuation.sandbox.net.fetch(endpoint,{...init,body:JSON.stringify({model:'deepseek-flash',stream:true,messages:[{role:'tool',content:'actual result'}]})}),error=>error===continuation.sentinel);
  assert.equal(continuation.calls.length,2);checks.push('DISTINCT_TOOL_CONTINUATION_BODY_REMAINS_ALLOWED');
  const cold=createMeter(0);await assert.rejects(cold.sandbox.net.fetch(endpoint,init),/A10_PROVIDER_BUDGET/);assert.equal(cold.calls.length,0);checks.push('COLD_PROVIDER_ZERO');
  const unexpected=createMeter(1);await assert.rejects(unexpected.sandbox.net.fetch('https://example.invalid',init),/A10_ENDPOINT_DENIED/);
  await assert.rejects(unexpected.sandbox.net.fetch(endpoint,init),/A10_GUARD_LATCHED/);assert.equal(unexpected.calls.length,0);checks.push('UNEXPECTED_HTTP_LATCHED');
  const web=createMeter(1);web.sandbox.session.defaultSession.webRequest.onBeforeRequest((_d,cb)=>cb({cancel:false}));
  let denied;web.policy({url:'https://example.invalid'},v=>{denied=v.cancel;});assert.equal(denied,true);assert.equal(web.state.escaped,1);checks.push('FORMAL_LISTENER_CANNOT_REPLACE_EARLY_GUARD');
  const noTicket=createMeter(1);let unreserved;noTicket.sendHeaders({url:endpoint,method:'POST',requestHeaders:{}},v=>{unreserved=v.cancel;});
  assert.equal(unreserved,true);assert.equal(noTicket.state.wire,0);checks.push('UNTICKETED_RENDERER_OR_NATIVE_HTTP_DENIED');
  const unmetered=createMeter(1);await assert.rejects(unmetered.sandbox.fetch(endpoint,init),/A10_UNMETERED_FETCH/);assert.equal(unmetered.calls.length,0);checks.push('GLOBAL_FETCH_DENIED');
  return {code:'A10_READING_SELF_CHECK_PASS',checks,electronLaunches:0,modelCalls:0,actualAcceptance:false};
}
