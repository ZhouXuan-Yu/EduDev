import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';

const desktop=process.cwd(),sourceProfile=path.join(process.env.APPDATA||'','OmniEduAgent'),sourceData=path.join(sourceProfile,'OmniEduData');
assert(fs.existsSync(path.join(sourceData,'app.db')),'Daily profile database is missing');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-daily-profile-copy-')),profile=path.join(output,'profile'),data=path.join(profile,'OmniEduData');
const buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out'),fixed=fingerprint(buildRoot),main=testMain(desktop);
fs.mkdirSync(data,{recursive:true});
const copyFile=(from,to)=>{if(!fs.existsSync(from))return false;fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);return true;};
const copied={localState:copyFile(path.join(sourceProfile,'Local State'),path.join(profile,'Local State')),
  preferences:copyFile(path.join(sourceProfile,'Preferences'),path.join(profile,'Preferences'))};
for(const name of ['app.db','app.db-wal','app.db-shm'])copied[name]=copyFile(path.join(sourceData,name),path.join(data,name));
if(fs.existsSync(path.join(sourceData,'xiaozhi-pi')))fs.cpSync(path.join(sourceData,'xiaozhi-pi'),path.join(data,'xiaozhi-pi'),{recursive:true});
const sourceDbHash=sha256(fs.readFileSync(path.join(sourceData,'app.db')));
const read=(sql,args=[],root=data)=>{const db=new DatabaseSync(path.join(root,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
const bindings=read(`SELECT s.id,s.title,s.message_count,s.student_id,b.session_file
  FROM ai_conversation_sessions s JOIN xiaozhi_pi_session_bindings b ON b.conversation_id=s.id
  WHERE s.archived_at IS NULL AND s.message_count>0 AND b.session_file!=''
  ORDER BY s.updated_at DESC,s.id DESC`);
const old=bindings.find(row=>fs.existsSync(path.join(data,'xiaozhi-pi',String(row.session_file))));
assert(old,'No readable old daily conversation with a native binding');
const oldMessagesBefore=read('SELECT id,session_id,role,content,metadata_json FROM ai_conversation_messages WHERE session_id=? ORDER BY id',[old.id]);
const oldEventCountBefore=Number(read('SELECT count(*) n FROM xiaozhi_event_journal j JOIN xiaozhi_event_runs r ON r.run_id=j.run_id WHERE r.session_id=?',[old.id])[0].n);
const oldNative=path.join(data,'xiaozhi-pi',String(old.session_file)),oldNativeHash=sha256(fs.readFileSync(oldNative));
const report={success:false,checks:[],build:{root:buildRoot,sha256:fixed.sha256,files:fixed.files.length},source:{dbSha256:sourceDbHash},copy:{...copied,oldSessionId:old.id,oldTitleSha256:sha256(Buffer.from(String(old.title))),oldMessageCount:old.message_count,oldNativeSha256:oldNativeHash},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  layer:'D: owned read-only copy of the user daily profile / frozen formal Electron / real saved DeepSeek configuration',
  humanAccepted:false,
  boundary:'Saved configuration and old-session compatibility through an owned daily-profile copy. No source profile write, teacher files/images copied, VPN-off, installer or curriculum acceptance.'};
let app,page,session;const errors=[];
const until=async(fn,timeout=180000)=>{const end=Date.now()+timeout;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Daily profile copy condition timed out');};
const snapshot=id=>page.evaluate(value=>window.omniEdu.getXiaozhiSnapshot(value),id);
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
try{
  const env={...process.env};
  for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_E2E_'))delete env[key];
  for(const key of ['DEEPSEEK_API_KEY','DEEPSEEK_MODEL','OMNI_EDU_DATA_ROOT','OMNI_EDU_TEST_BUILD_ROOT','ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','OMNI_EDU_XIAOZHI_PI'])delete env[key];
  env.NODE_ENV='development';env.OMNI_EDU_REPO_ROOT=path.resolve('../..');
  app=await electron.launch({args:[main,`--user-data-dir=${profile}`],env,timeout:60000});
  page=await app.firstWindow();page.on('pageerror',error=>errors.push(String(error)));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  await until(async()=>!(await page.getByTestId('office-prompt-input').isDisabled()));
  (report.launches||=[]).push(await assertIsolatedPiMain(app,main,profile));
  const settings=await page.evaluate(()=>window.omniEdu.getXiaozhiSettings());
  report.settings={provider:settings.value.provider,model:settings.value.defaultModel,configured:settings.value.configured,web:settings.value.web};
  assert(settings.value.configured,'Saved daily credential did not load from the copied profile');
  assert(settings.value.web?.enabled);
  assert.equal(settings.value.web?.dnsMode,'auto');
  assert(!env.DEEPSEEK_API_KEY&&!env.DEEPSEEK_MODEL);
  check('Owned daily-profile copy starts the frozen formal main and restores saved credential/model with auto DNS and no environment override');

  if(!await page.getByTestId('ai-conversation-sidebar').isVisible())await page.getByTestId('pi-sidebar-toggle').click();
  const search=page.getByTestId('pi-conversation-search');
  if(await search.count()){await search.click();await page.getByTestId('pi-conversation-search-input').fill(String(old.title));}
  const oldRow=page.getByTestId(`ai-conversation-session-${old.id}`);
  await oldRow.waitFor({state:'visible',timeout:30000});await oldRow.click();
  await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===old.id);
  const oldSnapshot=await until(async()=>{const value=await snapshot(old.id);return value?.projection?.turns?.length?value:undefined;});
  assert.equal(sha256(fs.readFileSync(oldNative)),oldNativeHash);
  assert.deepEqual(read('SELECT id,session_id,role,content,metadata_json FROM ai_conversation_messages WHERE session_id=? ORDER BY id',[old.id]),oldMessagesBefore);
  assert.equal(Number(read('SELECT count(*) n FROM xiaozhi_event_journal j JOIN xiaozhi_event_runs r ON r.run_id=j.run_id WHERE r.session_id=?',[old.id])[0].n),oldEventCountBefore);
  report.oldSession={projectionTurns:oldSnapshot.projection.turns.length,nativeSha256:oldNativeHash};
  check('A real old daily conversation opens through the visible sidebar with its history and exact native/SQLite bytes unchanged');

  const previous=old.id;await page.getByTestId('ai-conversation-new').click();
  session=await until(async()=>{const value=await page.locator('.office-composer-container').getAttribute('data-session-id');return value&&value!==previous?value:undefined;});
  assert.equal((await snapshot(session)).projection.turns.length,0);
  const code='DAILY-COPY-'+randomUUID();
  await page.getByTestId('office-prompt-input').fill('这是配置兼容验收，不涉及任何资料。请只回复下面的无敏感核验码：'+code);
  await page.locator('.office-composer [data-slot="prompt-input-send"]').click();
  const turn=await until(async()=>{const state=await snapshot(session),last=state.projection.turns.at(-1);return !state.running&&last&&['completed','failed','interrupted'].includes(last.status)?last:undefined;});
  assert.equal(turn.status,'completed',turn.error);
  assert(turn.items.some(item=>item.kind==='message'&&item.role==='assistant'&&item.text.includes(code)));
  report.newSession={sessionId:session,runId:turn.id,status:turn.status,usage:turn.items.find(item=>item.kind==='usage')?.usage};
  assert.equal(sha256(fs.readFileSync(oldNative)),oldNativeHash);
  assert.deepEqual(read('SELECT id,session_id,role,content,metadata_json FROM ai_conversation_messages WHERE session_id=? ORDER BY id',[old.id]),oldMessagesBefore);
  check('A new copied-profile conversation completes with the saved real DeepSeek configuration and does not mutate the old conversation');

  if(await page.getByTestId('ai-conversation-sidebar').isVisible())await page.getByTestId('pi-sidebar-toggle').click();
  await until(async()=>!(await page.getByTestId('ai-conversation-sidebar').isVisible()));
  await page.getByTestId('office-conversation').waitFor({state:'visible'});
  await page.setViewportSize({width:1366,height:768});await page.emulateMedia({colorScheme:'light'});await page.screenshot({path:path.join(output,'daily-copy-light-1366.png'),animations:'disabled'});
  await page.setViewportSize({width:1920,height:1080});await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:path.join(output,'daily-copy-dark-1920.png'),animations:'disabled'});
  assert.equal(sha256(fs.readFileSync(path.join(sourceData,'app.db'))),sourceDbHash);
  assert.equal(fingerprint(buildRoot).sha256,fixed.sha256);
  assert.deepEqual(errors,[]);
  report.success=true;
  check('Source daily database, frozen build and old native bytes remain exact; renderer has no errors');
}catch(error){
  report.error=String(error.stack).replace(/sk-[A-Za-z0-9]+/g,'[credential]').slice(0,5000);process.exitCode=1;
  await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});
  if(session)report.lastSnapshot=await snapshot(session).catch(()=>undefined);
}finally{
  await app?.close().catch(()=>{});
  report.sourceDbUnchanged=sha256(fs.readFileSync(path.join(sourceData,'app.db')))===sourceDbHash;
  report.oldNativeUnchanged=sha256(fs.readFileSync(oldNative))===oldNativeHash;
  fs.rmSync(profile,{recursive:true,force:true});
  report.ephemeralProfileRemoved=!fs.existsSync(profile);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));
}
