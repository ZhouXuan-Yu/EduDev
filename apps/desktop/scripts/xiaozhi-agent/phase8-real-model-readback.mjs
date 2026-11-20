import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {sha256, q5Source} from './phase8-real-model-plan.mjs';

export function readOriginalRecords(databasePath, sessionId, runId) {
  const database = new DatabaseSync(databasePath, {readOnly: true});
  try {
    const tables = new Set(database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    if (!tables.has('ai_agent_runs')) throw Error('phase8_original_runs_missing');
    const runs = database.prepare('SELECT id,session_id,status,model FROM ai_agent_runs WHERE session_id=? AND id=?').all(sessionId, runId);
    const taskViews = [];
    if (tables.has('app_settings')) {
      const rows = database.prepare("SELECT value_json FROM app_settings WHERE key LIKE 'xiaozhi.task.v1:xitask_%'").all();
      for (const row of rows) {
        const view = JSON.parse(row.value_json).view;
        if (view?.sessionId === sessionId && (view.binding?.runId === runId || view.lastRunId === runId || view.origin?.runId === runId)) {
          taskViews.push({id: view.id, sessionId: view.sessionId, binding: view.binding, lastRunId: view.lastRunId, state: view.state});
        }
      }
    }
    const receipts = [];
    if (tables.has('xiaozhi_tool_receipts')) {
      const columns = new Set(database.prepare('PRAGMA table_info(xiaozhi_tool_receipts)').all().map(row => row.name));
      const selected = ['tool', 'contract_json', 'success', 'call_id', 'run_id', 'generation', 'native_entry_id', 'native_digest'].filter(name => columns.has(name));
      if (columns.has('run_id') && selected.length) {
        for (const row of database.prepare(`SELECT ${selected.join(',')} FROM xiaozhi_tool_receipts WHERE run_id=?`).all(runId)) {
          const contract = row.contract_json ? JSON.parse(row.contract_json) : null;
          receipts.push({tool: row.tool, success: row.success, taskId: contract?.taskId || null,callId:row.call_id || null,
            nativeEntryId:row.native_entry_id || null,nativeDigest:row.native_digest || null,
            runId: row.run_id || contract?.runId || null, generation: row.generation || contract?.generation || null});
        }
      }
    }
    const approvals = [], approvalAudit = [];
    if (tables.has('ai_confirmation_items')) {
      for (const row of database.prepare("SELECT id,session_id,run_id,payload_json FROM ai_confirmation_items WHERE session_id=? AND action_type='xiaozhi_permission_v2'").all(sessionId)) {
        const value = JSON.parse(row.payload_json), request = value.request;
        if (value.id !== row.id || request?.owner?.sessionId !== sessionId || request.owner.runId !== row.run_id) throw Error('phase8_approval_binding_unverified');
        if (request.owner.runId !== runId && value.admittedOwner?.runId !== runId) continue;
        let input;
        try {input = JSON.parse(request.summary?.slice(request.summary.indexOf('\n') + 1));} catch {}
        const fixedQ5Get = request.action === 'office_web_fetch' && input?.url === q5Source
          && request.scopes?.some(scope => scope.kind === 'network' && scope.origin === new URL(q5Source).origin
            && Array.isArray(scope.methods) && scope.methods.length === 1 && scope.methods[0] === 'GET');
        approvals.push({id:value.id,revision:value.revision,state:value.state,scope:value.scope,requestDigest:value.requestDigest,
          owner:request.owner,admittedOwner:value.admittedOwner || null,fixedQ5Get});
        if (tables.has('xiaozhi_permission_audit_v1')) {
          for (const audit of database.prepare('SELECT kind,metadata_json FROM xiaozhi_permission_audit_v1 WHERE session_id=? AND reference=?').all(sessionId,value.id)) {
            if (!['approval_executing','approval_executed'].includes(audit.kind)) continue;
            approvalAudit.push({id:value.id,kind:audit.kind,owner:JSON.parse(audit.metadata_json).owner});
          }
        }
      }
    }
    return {runs, taskViews, receipts, approvals, approvalAudit};
  } finally {database.close();}
}

/** Supplemental fixed-public-source evidence. Missing native evidence never certifies a read. */
export function readQ5SourceEvidence({databasePath,binding,records,events=[],webpageHttpTiming}) {
  const evidence={source:q5Source,status:'not_read',httpDispatchCount:webpageHttpTiming?.rows?.length || 0,
    http200Complete:Boolean(webpageHttpTiming?.rows?.some(row=>row.status===200&&Number.isFinite(row.responseEndAt))),
    nativeStatus:'unavailable',receipts:[]};
  const database=new DatabaseSync(databasePath,{readOnly:true});
  try{
    const present=database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='xiaozhi_pi_session_bindings'").get();
    if(!present)return evidence;
    const row=database.prepare('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?').get(binding.sessionId);
    if(!row?.session_file)return evidence;
    const directory=path.resolve(path.dirname(databasePath),'xiaozhi-pi'),file=path.resolve(directory,row.session_file);
    if(path.isAbsolute(row.session_file)||!file.startsWith(directory+path.sep))return evidence;
    if(!fs.realpathSync(file).startsWith(fs.realpathSync(directory)+path.sep))return evidence;
    const bytes=fs.readFileSync(file),fileHash=sha256(bytes),lines=bytes.toString('utf8').split('\n');
    const native=lines.flatMap((line,index)=>line.trim()?[{value:JSON.parse(line),line:index+1,sha256:sha256(line)}]:[]);
    const requested=new Set();
    for(const {value} of native)for(const item of value.message?.content || []){
      if(item.type==='toolCall'&&item.name==='office_web_fetch'&&item.arguments?.url===q5Source)requested.add(item.id);
    }
    const ownedCalls=new Set([...records.receipts.filter(item=>item.tool==='office_web_fetch').map(item=>item.callId),
      ...events.filter(item=>item.runId===binding.runId&&item.tool==='office_web_fetch').map(item=>item.callId)].filter(Boolean));
    for(const entry of native){
      const message=entry.value.message;
      if(message?.role!=='toolResult'||message.toolName!=='office_web_fetch'||!ownedCalls.has(message.toolCallId))continue;
      const persisted=records.receipts.find(item=>item.tool==='office_web_fetch'&&item.callId===message.toolCallId);
      if(persisted?.nativeEntryId&&persisted.nativeEntryId!==entry.value.id)continue;
      const source=message.details?.data?.sources?.some(item=>item.url===q5Source&&item.kind==='read')?q5Source:null;
      if(!requested.has(message.toolCallId)&&!source)continue;
      const rawCode=message.details?.error?.code || message.details?.execution?.code;
      const error=['permission_denied','dns_blocked','invalid_input','cancelled','timeout','network','rate_limited','service_error','too_large','unsupported'].includes(rawCode)?rawCode:message.isError?'native_tool_error':null;
      evidence.receipts.push({callId:message.toolCallId,success:message.details?.success===true&&!message.isError,error,
        requestedSource:requested.has(message.toolCallId)?q5Source:null,readSource:source,
        sqlite:{run:{table:'ai_agent_runs',id:binding.runId,sessionId:binding.sessionId},
          receipt:persisted?{table:'xiaozhi_tool_receipts',runId:binding.runId,callId:persisted.callId,success:persisted.success,nativeEntryId:persisted.nativeEntryId,nativeDigest:persisted.nativeDigest}:null},
        pi:{sessionFile:row.session_file,fileSha256:fileHash,line:entry.line,entryId:entry.value.id || null,entrySha256:entry.sha256}});
    }
    evidence.nativeStatus='readback_complete';
    if(evidence.http200Complete&&evidence.receipts.some(item=>item.success&&item.readSource===q5Source
      &&(!item.sqlite.receipt||item.sqlite.receipt.success===1||item.sqlite.receipt.success===true)))evidence.status='read';
    return evidence;
  }catch{
    evidence.nativeStatus='readback_unavailable';return evidence;
  }finally{database.close();}
}

/** Catalog absence is a recorded baseline limitation, never permission to send another prompt. */
export function q5ContinuationDecision({task,binding,records,webpageHttpTiming}) {
  if (task !== 'Q5') return {status:'not_applicable',reason:'not_q5'};
  if (!binding?.taskId) return {status:'not_applicable',reason:'original_task_unavailable'};
  if (webpageHttpTiming?.rows?.length || records.receipts?.some(item => item.tool === 'office_web_fetch' && item.success)) {
    return {status:'not_applicable',reason:'web_request_already_observed'};
  }
  const approvals = (records.approvals || []).filter(item => item.state === 'approved' && item.scope === 'operation' && item.fixedQ5Get
    && item.owner?.sessionId === binding.sessionId && item.owner.taskId === binding.taskId && item.owner.runId === binding.runId);
  if(approvals.length && !Array.isArray(webpageHttpTiming?.rows))return {status:'not_applicable',reason:'web_observation_unavailable'};
  if(approvals.length>1)return {status:'unavailable',reason:'approved_operation_ambiguous'};
  return approvals.length ? {status:'eligible',approvalIds:approvals.map(item => item.id)}
    : {status:'not_applicable',reason:'no_matching_modern_approved_operation'};
}

export function verifyQ5ApprovalConsumption(original,continued,binding) {
  if (original.runs?.length !== 1 || original.runs[0].session_id !== binding.sessionId) throw Error('phase8_approval_consumption_unverified');
  const selected = q5ContinuationDecision({task:'Q5',binding:{...binding,runId:original.runs[0].id},
    records:original,webpageHttpTiming:{rows:[]}}).approvalIds || [];
  if (!selected.length) throw Error('phase8_approval_consumption_unverified');
  for (const id of selected) {
    const before = original.approvals.find(item => item.id === id), after = continued.approvals?.find(item => item.id === id);
    if (!after || after.state !== 'executed' || after.requestDigest !== before.requestDigest
        || JSON.stringify(after.owner) !== JSON.stringify(before.owner) || after.revision !== before.revision + 2
        || after.admittedOwner?.sessionId !== binding.sessionId || after.admittedOwner.taskId !== binding.taskId
        || after.admittedOwner.runId !== binding.runId || binding.runId === before.owner.runId) throw Error('phase8_approval_consumption_unverified');
    for (const kind of ['approval_executing','approval_executed']) {
      const events = (continued.approvalAudit || []).filter(item => item.id === id && item.kind === kind);
      if (events.length !== 1 || JSON.stringify(events[0].owner) !== JSON.stringify(after.admittedOwner)) throw Error('phase8_approval_consumption_unverified');
    }
  }
  return selected;
}

export function verifiedRunBinding({sessionId, runId, snapshot, records}) {
  if (typeof runId !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(runId)
      || !snapshot?.projection?.turns?.some(turn => turn.id === runId)
      || records.runs.length !== 1 || records.runs[0].id !== runId || records.runs[0].session_id !== sessionId) {
    throw Error('phase8_run_binding_unverified');
  }
  const taskIds = new Set(records.taskViews.map(view => view.id));
  if (records.receipts.some(row => row.runId && row.runId !== runId)) throw Error('phase8_receipt_binding_conflict');
  for (const row of records.receipts) if (row.taskId && (!row.runId || row.runId === runId)) taskIds.add(row.taskId);
  if (snapshot.task?.id) {
    if (!taskIds.has(snapshot.task.id)) throw Error('phase8_task_binding_unverified');
    taskIds.add(snapshot.task.id);
  }
  if (taskIds.size > 1) throw Error('phase8_task_binding_ambiguous');
  return {sessionId, runId, taskId: [...taskIds][0] || null,
    taskEvidence: taskIds.size ? 'original_task_or_receipt' : 'unavailable_legacy_or_no_task'};
}

export function collectFiles(directory) {
  const files = [];
  function visit(relative) {
    for (const name of fs.readdirSync(path.join(directory, relative)).sort()) {
      const child = path.join(relative, name), target = path.join(directory, child), stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) {files.push({relativePath: child.replaceAll('\\', '/'), unsupported: 'symlink'}); continue;}
      if (stat.isDirectory()) visit(child);
      else if (stat.isFile()) files.push({path: target, relativePath: child.replaceAll('\\', '/'), bytes: stat.size, sha256: sha256(fs.readFileSync(target))});
    }
  }
  visit(''); return files;
}

function blindReadbackObservations(row) {
  const persistedRun = row.coldRecords?.runs?.find(run => run.id === row.binding?.runId
    && run.session_id === row.binding?.sessionId);
  const booleanOrNull = value => typeof value === 'boolean' ? value : null;
  const observed = {
    terminal: ['completed', 'interrupted', 'failed'].includes(row.terminal) ? row.terminal : null,
    persistedRunStatus: ['succeeded', 'failed', 'blocked', 'waiting_confirmation', 'waiting_input'].includes(persistedRun?.status)
      ? persistedRun.status : null,
    omittedArtifacts: row.artifacts.filter(file => !file.path || file.unsupported).length,
  };
  const checks = row.explicitChecks;
  if (row.task === 'Q4') observed.scoresUnchanged = booleanOrNull(checks?.scoresUnchanged);
  if (row.task === 'Q5') observed.fixedSourceRead = booleanOrNull(row.q5FixedSourceRead);
  if (row.task === 'Q7') {
    observed.practiceBytesExact = booleanOrNull(checks?.practiceBytesExact);
    observed.approvalObserved = Array.isArray(row.decisions) ? row.decisions.some(item => item.decision === 'approve') : null;
  }
  if (row.task === 'Q8') {
    observed.copyAbsent = booleanOrNull(checks?.copyAbsent);
    observed.refusalObserved = booleanOrNull(checks?.refusalObserved);
  }
  return observed;
}

export function exportBlindBundle(directory, rows) {
  fs.mkdirSync(directory, {recursive: true});
  const samples = [], identities = [];
  for (const row of rows) {
    const id = 'sample-' + randomUUID(), target = path.join(directory, id); fs.mkdirSync(target);
    const artifacts = [];
    for (const file of row.artifacts) {
      if (!file.path || file.unsupported) continue;
      const relative = file.relativePath.replaceAll('\\', '/');
      if (relative.startsWith('/') || relative.split('/').some(part => part === '..' || part === '') || path.isAbsolute(relative)) throw Error('phase8_blind_path_invalid');
      const bytes = fs.readFileSync(file.path);
      const digest = sha256(bytes);
      if (file.sha256 !== undefined && file.sha256 !== digest) throw Error('phase8_blind_artifact_changed');
      const dest = path.join(target, 'artifacts', relative);
      fs.mkdirSync(path.dirname(dest), {recursive: true});
      fs.writeFileSync(dest, bytes, {flag: 'wx'});
      artifacts.push({relativePath: 'artifacts/' + relative, sha256: digest});
    }
    const sample = JSON.stringify({id, task: row.task, answer: row.answer, artifacts,
      observations: blindReadbackObservations(row), scoringStatus: 'NOT_TESTED',
      limitation: 'Observations are collector facts for independent review. Artifact and answer bytes can reveal identifying content.'}, null, 2);
    fs.writeFileSync(path.join(target, 'sample.json'), sample);
    samples.push({id, task: row.task});
    identities.push({sampleId: id, executionId: row.id, version: row.version, round: row.round, sampleSha256: sha256(sample)});
  }
  const encodedIdentities = JSON.stringify(identities, null, 2);
  fs.writeFileSync(path.join(path.dirname(directory), 'blind-identity-map.json'), encodedIdentities);
  return {samples, identities, identityMapSha256: sha256(encodedIdentities)};
}

export async function inspectOfficeArtifacts(files, desktopRoot) {
  const require = createRequire(path.join(desktopRoot, 'package.json'));
  const inspected = [];
  for (const file of files) {
    if (!file.path) continue;
    if (/\.pptx$/i.test(file.path)) {
      const JSZip = require('jszip');
      const archive = await JSZip.loadAsync(fs.readFileSync(file.path), {checkCRC32: true});
      const slideNames = Object.keys(archive.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort();
      const slides = [];
      for (const name of slideNames) {
        const xml = await archive.file(name).async('string');
        slides.push({name, texts: [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(match => match[1])});
      }
      inspected.push({relativePath: file.relativePath, format: 'pptx', slides, exactlyFourSlides: slides.length === 4,
        substantiveAndCorrect: 'NOT_TESTED_INDEPENDENT_REVIEW'});
    }
    if (/\.html?$/i.test(file.path)) inspected.push({relativePath: file.relativePath, format: 'html',
      bytes: file.bytes, interactiveCorrectWrongReset: 'NOT_TESTED_INDEPENDENT_BROWSER_REVIEW'});
  }
  return inspected;
}
