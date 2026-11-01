/** Prepared only. Parent runs AFTER the final unified build. No model or new task.
 * node scripts/ui-goal-public-replay.mjs --run-after-build
 * Replays a COPY of the existing owned synthetic run; never opens original data in Electron.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.resolve(desktop,process.env.UI_PUBLIC_REPLAY_SOURCE || 'test-results/ui-goal-20261101/chat-live-misconception/run-hJO4Iy');
const suffix='</｜｜DSML｜｜ parameter>\n</｜｜DSML｜｜ invoke>\n</｜｜DSML｜｜ calls>';
const sizeCases=[[1366,768],[1920,1080]];
const safeError=error=>({name:/^[A-Za-z]+$/.test(error?.name||'')?error.name:'Error',
  ...(typeof error?.operator==='string'?{operator:error.operator}:{}),
  frames:String(error?.stack||'').split('\n').filter(line=>/^\s+at /.test(line)).slice(0,4).flatMap(line=>{
    const match=line.match(/([^/\\()\s]+\.(?:mjs|cjs|js)):(\d+):(\d+)\)?$/);
    return match?[{file:match[1],line:Number(match[2]),column:Number(match[3])}]:[];
  })});
function counts(data) {
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try {
    const value=query=>Number(db.prepare(query).get().n);
    return {runs:value('SELECT COUNT(*) n FROM xiaozhi_event_runs'),commands:value('SELECT COUNT(*) n FROM xiaozhi_pi_commands'),
      events:value('SELECT COUNT(*) n FROM xiaozhi_event_journal'),
      modelRequests:value("SELECT COUNT(*) n FROM xiaozhi_event_journal WHERE json_extract(event_json,'$.kind')='model_request'")};
  } finally {db.close();}
}
async function main() {
  const ownedDialog=process.argv.includes('--owned-dialog');
  assert(!ownedDialog||process.argv.includes('--export-readback'),'--owned-dialog requires --export-readback');
  assert(source.startsWith(path.join(desktop,'test-results')+path.sep),'Replay source must be an owned acceptance run');
  assert.equal(fs.realpathSync(source),source,'Replay source must not be redirected');
  const originalData=path.join(source,'data');
  const sourceReport=JSON.parse(fs.readFileSync(path.join(source,'report.json'),'utf8'));
  assert.equal(sourceReport.scenario,'misconception','Use the existing synthetic misconception run');
  const originalAnswer=JSON.parse(fs.readFileSync(path.join(source,'attachment-answer.json'),'utf8'));
  const {sessionId,runId}=originalAnswer;
  assert(/^[A-Za-z0-9_-]+$/.test(sessionId)&&/^[A-Za-z0-9_-]+$/.test(runId),'Bound run identities required');
  assert.equal(originalAnswer.answer.length,1,'Known source has exactly one public answer');
  const raw=originalAnswer.answer[0].text;
  assert(raw.endsWith(suffix),'Original public answer must retain the exact observed DSML tail');
  const expected=raw.slice(0,-suffix.length);
  const originalFingerprint=fingerprint(originalData).sha256;
  const originalReportHash=sha256(fs.readFileSync(path.join(source,'report.json')));
  const mainFile=testMain(desktop),build=fingerprint(path.dirname(path.dirname(mainFile))).sha256;
  const outputRoot=path.join(desktop,'test-results/ui-goal-20261101/public-replay');fs.mkdirSync(outputRoot,{recursive:true});
  const output=fs.mkdtempSync(path.join(outputRoot,'run-')),data=path.join(output,'data'),profile=path.join(output,'profile');
  fs.cpSync(originalData,data,{recursive:true,errorOnExist:true,force:false,dereference:false});
  assert.equal(fingerprint(originalData).sha256,originalFingerprint,'Source must remain stable during copy');
  assert.equal(fingerprint(data).sha256,originalFingerprint,'Copied data must match original bytes');
  const before=counts(data); // Never open the original database, even read-only (WAL sidecars). 
  const report={success:false,preparedOnly:false,sourceRun:path.basename(source),sessionId,runId,output,buildSha256:build,
    scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),originalDataSha256:originalFingerprint,
    originalReportSha256:originalReportHash,checks:[],screens:[],consoleErrors:[],observedEvents:[],humanAccepted:false,
    scope:'Actual Electron cold replay of copied synthetic historical data; no model calls, original files immutable. Analytics/request-card labels not part of this focused check.'};
  const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
  const env={...process.env};
  for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  Object.assign(env,{NODE_ENV:'development',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'});
  let app,page,stage='launch';
  const safeDOM=async()=>{
    assert.equal(await page.locator('[data-testid="agent-raw-reasoning"],[data-testid="model-reasoning"]').count(),0,'Private reasoning UI must be absent before capture');
    assert.equal(await page.getByTestId('office-conversation').locator('details,summary').count(),0,'Conversation must have no native disclosure UI');
  };
  const shot=async name=>{
    await safeDOM();const file=name+'.png';await page.screenshot({path:path.join(output,file),animations:'disabled'});
    report.screens.push({file,...await page.evaluate(()=>({width:innerWidth,height:innerHeight,devicePixelRatio}))});
  };
  try {
    app=await electron.launch({args:[mainFile,`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();
    page.on('pageerror',()=>report.consoleErrors.push({kind:'pageerror'}));page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({kind:'console.error'});});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});
    report.runtime=await assertIsolatedPiMain(app,mainFile,profile);
    await page.evaluate(()=>{
      window.__publicReplayEvents=[];
      window.__publicReplayOff=window.omniEdu.onXiaozhiEvent(event=>{
        if(['assistant_start','tool_start','model_request','status'].includes(event.kind))window.__publicReplayEvents.push({kind:event.kind,runId:event.runId,sequence:event.sequence});
      });
    });
    stage='select-existing-session';
    const composer=page.locator('.office-composer-container:visible');
    if(await composer.getAttribute('data-session-id')!==sessionId)await page.locator('[data-testid="edu-navigation"]:visible').getByTestId(`workbench-session-${sessionId}`).click();
    await page.waitForFunction(id=>[...document.querySelectorAll('.office-composer-container')].some(node=>node.getClientRects().length&&node.getAttribute('data-session-id')===id),sessionId,{timeout:30000});
    stage='cold-public-snapshot';
    const view=await page.evaluate(async ({sessionId,runId,expected})=>{
      const snapshot=await window.omniEdu.getXiaozhiSnapshot(sessionId);
      const turn=snapshot.projection.turns.find(item=>item.id===runId);
      const answers=turn?.items.filter(item=>item.kind==='message'&&item.role==='assistant'&&['final_answer','partial_answer'].includes(item.phase)).map(item=>item.text||'')||[];
      return {found:!!turn,status:turn?.status,running:snapshot.running,answerMatches:answers.length===1&&answers[0]===expected,
        answerNonempty:answers.some(text=>text.trim()),dsmlAbsent:answers.every(text=>!text.includes('</｜｜DSML｜｜ ')),runCount:snapshot.projection.turns.length,sourceSequence:snapshot.projection.sourceSequence};
    },{sessionId,runId,expected});
    assert(view.found&&view.status==='completed'&&!view.running,'Exact completed historical run must restore without restarting');
    assert(view.answerMatches&&view.answerNonempty&&view.dsmlAbsent,'Cold snapshot must equal original answer minus exact DSML suffix');
    report.publicSnapshot=view;check('cold public snapshot removes only the exact observed tail');
    const turn=page.locator(`.office-turn[data-turn-id="${runId}"]:visible`);
    await turn.getByTestId('agent-reply-body').waitFor({state:'visible',timeout:30000});
    const visible=await turn.getByTestId('agent-reply-body').evaluate(element=>({nonempty:!!element.textContent?.trim(),dsmlAbsent:!element.textContent?.includes('</｜｜DSML｜｜ ')}));
    assert(visible.nonempty&&visible.dsmlAbsent,'Actual rendered public body must be nonempty and free of protocol tail');
    assert.equal(await turn.getByTestId('agent-trace-toggle').getAttribute('aria-expanded'),'false','Cold completed process must start collapsed');
    check('actual public body is clean and completed process starts folded');
    for(const [width,height] of sizeCases){
      stage='capture-'+width;await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
      await page.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]);
      await turn.getByTestId('agent-reply-body').scrollIntoViewIfNeeded();await shot('cold-public-body-'+width);
    }
    stage='official-disclosure';
    const toggle=turn.getByTestId('agent-trace-toggle');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await safeDOM();
    await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');check('official process disclosure opens and closes without native triangles');
    if(process.argv.includes('--export-readback')) {
      stage='actual-native-export';
      const directory=path.join(output,'exports');fs.mkdirSync(directory);
      const title='DSML历史回复验收_'+runId.slice(-8);
      if(ownedDialog){
        report.exportChooser={mode:'controlled-owned-directory',manualNative:false,nativeDialogDisplayed:false};
        await app.evaluate(({app,dialog,BrowserWindow},{output,directory})=>{
          const fs=process.getBuiltinModule('fs'),path=process.getBuiltinModule('path');
          const owned=fs.realpathSync(output),chosen=fs.realpathSync(directory),profile=fs.realpathSync(app.getPath('userData'));
          if(profile!==path.join(owned,'profile')||!chosen.startsWith(owned+path.sep)||chosen!==path.join(owned,'exports')||fs.lstatSync(directory).isSymbolicLink())throw Error('chooser_scope');
          const owner=BrowserWindow.getAllWindows()[0];
          if(!owner||owner.isDestroyed()||globalThis.__uiGoalReplyChooser)throw Error('chooser_owner');
          const original=dialog.showOpenDialog;
          const state={hits:0,original,wrapped:undefined};
          state.wrapped=function(...args){
            const [window,options]=args;
            if(state.hits===0&&args.length===2&&window===owner&&!owner.isDestroyed()
              &&options?.title==='确认保存教学内容：选择本地文件夹'
              &&Array.isArray(options.properties)&&options.properties.length===2
              &&options.properties[0]==='openDirectory'&&options.properties[1]==='createDirectory'){
              state.hits++;
              return Promise.resolve({canceled:false,filePaths:[chosen]});
            }
            return original.apply(dialog,args);
          };
          globalThis.__uiGoalReplyChooser=state;dialog.showOpenDialog=state.wrapped;
        },{output,directory});
      }

      const read=query=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return query(db);}finally{db.close();}};
      const storedHash=()=>read(db=>sha256(Buffer.from(JSON.stringify(db.prepare('SELECT id,content,metadata_json FROM ai_conversation_messages WHERE session_id=? ORDER BY id').all(sessionId)))));
      const originalStoredHash=storedHash();
      await turn.hover();await turn.getByTestId('reply-save').click();
      await page.getByTestId('reply-dialog').waitFor({state:'visible'});
      await page.getByTestId('reply-save-title').fill(title);
      // Explicit owned-dialog mode controls only the exact directory chooser.
      // No IPC shortcut or renderer body injection: actual save UI/host checks remain.
      console.log((ownedDialog?'CONTROLLED_OWNED_FOLDER ':'NATIVE_FOLDER_REQUIRED ')+directory);
      await page.getByTestId('reply-save-confirm').click();
      await page.waitForFunction(id=>[...document.querySelectorAll('.office-turn')].find(node=>node.getAttribute('data-turn-id')===id)?.querySelector('[data-testid="reply-action-notice"]')?.textContent?.includes('已保存为本地 Markdown'),runId,{timeout:60000});
      const rows=read(db=>db.prepare('SELECT id,file_path,content_md,content_hash,status FROM document_artifacts WHERE session_id=? AND title=?').all(sessionId,title));
      assert.equal(rows.length,1,'Actual export must create exactly one artifact');const artifact=rows[0];
      assert.equal(artifact.status,'exported');assert.equal(artifact.content_md,expected,'Stored artifact uses exact visible public body');
      assert(path.resolve(artifact.file_path).startsWith(path.resolve(directory)+path.sep),'Native dialog must select the declared owned folder');
      const bytes=fs.readFileSync(artifact.file_path),fileText=bytes.toString('utf8');
      assert.equal(sha256(bytes),artifact.content_hash,'Actual exported file matches persisted hash');
      assert(fileText.includes(expected)&&!fileText.includes('</｜｜DSML｜｜ '),'Actual exported Markdown contains the public body without provider tail');
      assert.equal(storedHash(),originalStoredHash,'Export must not rewrite old stored public records');
      if(ownedDialog){
        const hits=await app.evaluate(()=>globalThis.__uiGoalReplyChooser?.hits);
        assert.equal(hits,1,'Exactly one declared directory chooser must be controlled');report.exportChooser.hits=hits;
      }
      report.exportReadback={artifactId:artifact.id,file:path.basename(artifact.file_path),sha256:artifact.content_hash,storedReplyUnchanged:true,chooserMode:ownedDialog?'controlled-owned-directory':'manual-native',manualNativeDirectorySelected:!ownedDialog};
      await shot('legacy-export-readback');check('actual legacy visible-hash export: '+(ownedDialog?'controlled chooser':'manual native approval')+', SQLite/file readback and immutable source');
    }
    report.observedEvents=await page.evaluate(()=>window.__publicReplayEvents);
    assert.equal(report.observedEvents.filter(event=>['model_request','assistant_start','tool_start'].includes(event.kind)).length,0,'Cold replay must not start model, tool or assistant');
    assert.deepEqual(counts(data),before,'Cold replay must add no run, command, journal event or model request');check('zero new runs, commands, events and model requests');
    assert.deepEqual(report.consoleErrors,[],'No renderer or console errors');
    if(ownedDialog)await app.evaluate(({dialog})=>{const state=globalThis.__uiGoalReplyChooser;if(state){if(dialog.showOpenDialog===state.wrapped)dialog.showOpenDialog=state.original;delete globalThis.__uiGoalReplyChooser;}});
    await app.close();app=undefined;
    stage='immutable-readback';
    assert.deepEqual(counts(data),before,'Closing replay must not append work');
    const nativeBefore=fingerprint(path.join(originalData,'xiaozhi-pi')).files.filter(row=>row.file.endsWith('.jsonl'));
    const nativeAfter=fingerprint(path.join(data,'xiaozhi-pi')).files.filter(row=>row.file.endsWith('.jsonl'));
    assert.deepEqual(nativeAfter,nativeBefore,'Copied native audit must remain byte-identical');
    assert.equal(fingerprint(originalData).sha256,originalFingerprint,'Original database, sidecars and native audit must remain byte-identical');
    assert.equal(sha256(fs.readFileSync(path.join(source,'report.json'))),originalReportHash,'Original acceptance report must remain byte-identical');
    assert.equal(fingerprint(path.dirname(path.dirname(mainFile))).sha256,build,'Build must remain frozen');
    check('original DB/audit/report immutable; copied native audit unchanged; build unchanged');report.success=true;
  } catch(error) {
    report.error={stage,...safeError(error)};process.exitCode=1;
    if(page&&!page.isClosed())try{await shot('failure');}catch{report.failureScreenshot='withheld by private UI guard';}
  } finally {
    if(app&&ownedDialog)await app.evaluate(({dialog})=>{const state=globalThis.__uiGoalReplyChooser;if(state){if(dialog.showOpenDialog===state.wrapped)dialog.showOpenDialog=state.original;delete globalThis.__uiGoalReplyChooser;}}).catch(()=>{});
    await app?.close().catch(()=>{});
    report.originalDataUnchanged=fingerprint(originalData).sha256===originalFingerprint;
    report.originalReportUnchanged=sha256(fs.readFileSync(path.join(source,'report.json')))===originalReportHash;
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));
  }
}
if(process.argv.includes('--run-after-build'))await main();
else console.log(JSON.stringify({preparedOnly:true,source,usage:'Parent after final build: node scripts/ui-goal-public-replay.mjs --run-after-build [--export-readback [--owned-dialog]]. Export uses manual native selection unless explicit owned-dialog mode controls only the exact folder chooser inside this output.',modelCalls:0,scope:'Existing synthetic run copy; no daily data migration; dual viewport cold UI replay'}));
