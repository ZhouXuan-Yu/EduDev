// Formal CFG-01/02: reuse the accepted credential, attachment and native UI harnesses.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain} from '../acceptance/build-root.mjs';
import {fingerprint,sha256} from '../acceptance/evidence.mjs';
import {createSamples} from '../acceptance/create-samples.mjs';

const desktop=process.cwd(),buildRoot=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-saved-credential-tools-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),workspace=path.join(output,'workspace'),samples=path.join(output,'samples');
fs.mkdirSync(workspace);
const key=fs.readFileSync('.env.local','utf8').match(/^DEEPSEEK_API_KEY\s*=\s*(.*?)\s*$/m)?.[1]?.replace(/^['"]|['"]$/g,'');assert(key);
const fixed=fingerprint(buildRoot),report={success:false,checks:[],layer:'C: isolated formal Electron',humanAccepted:false,
  build:{root:buildRoot,files:fixed.files.length,sha256:fixed.sha256},scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  boundary:'Actual UI verification/save, Windows safeStorage, official DeepSeek catalogue and native tools; both environment credentials empty. Dialog chooser selects only owned synthetic files. No daily profile, VPN-off, installer or full Codex style claim.'};
report.previousFailures=fs.readdirSync('test-results/xiaozhi-agent',{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name.startsWith('pi-saved-credential-tools-')&&e.name!==path.basename(output)).flatMap(e=>{
  const f=path.join('test-results/xiaozhi-agent',e.name,'report.json');if(!fs.existsSync(f))return[];const r=JSON.parse(fs.readFileSync(f));return r.success?[]:[{directory:e.name,error:r.error,checks:r.checks.length,buildSha256:r.build?.sha256,scriptSha256:r.scriptSha256}];
});
let app,page,id;const errors=[],requests=[],check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
const until=async(fn,ms=180000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,100));}throw new Error('Saved credential tools condition timed out');};
const query=(sql,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all(...args);}finally{db.close();}};
const rawConfiguration=()=>query('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.provider.v1'])[0]?.value_json;
const snap=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id);
const state=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSettings({sessionId:id}),id);
const final=t=>t.items.filter(v=>v.kind==='message'&&v.role==='assistant'&&v.phase==='final_answer').map(v=>v.text).join('\n');
function native(){const binding=query('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[id])[0];assert(binding);const bytes=fs.readFileSync(path.join(data,'xiaozhi-pi',binding.session_file));return{binding,bytes,rows:bytes.toString().trimEnd().split('\n').map(JSON.parse)};}
const toolResults=(name,from=0)=>native().rows.slice(from).filter(v=>v.message?.role==='toolResult'&&(!name||v.message.toolName===name));
async function transports(){return app.evaluate(()=>globalThis.savedCredentialRequests);}
async function close(){if(!app)return;requests.push(...await transports());await app.close();app=undefined;}
async function launch(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'',DEEPSEEK_MODEL:''};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
  app=await electron.launch({args:[testMain(desktop),`--user-data-dir=${profile}`],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',e=>errors.push(String(e).replaceAll(key,'[credential]')));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
  const current=await page.locator('.office-composer-container').getAttribute('data-session-id');if(id)assert.equal(current,id);else id=current;
  assert(await app.evaluate(()=>process.env.DEEPSEEK_API_KEY===''&&process.env.DEEPSEEK_MODEL===''&&process.env.OMNI_EDU_E2E_DIALOG_MODE==='1'));
  // Observe only safe facts; the actual SDK fetch and real response are unchanged.
  await app.evaluate((_,expectedKey)=>{
    globalThis.savedCredentialRequests=[];const original=globalThis.fetch;
    globalThis.fetch=async function(input,init){
      const url=typeof input==='string'?input:input instanceof URL?input.href:input?.url;let record;
      if(typeof url==='string'&&url.startsWith('https://api.deepseek.com/')&&url.endsWith('/chat/completions')&&typeof init?.body==='string'){
        const body=JSON.parse(init.body),headers=new Headers(init.headers||input?.headers);
        record={model:body.model,credentialMatchesSaved:headers.get('authorization')===`Bearer ${expectedKey}`,imageParts:(body.messages||[]).reduce((n,m)=>n+(Array.isArray(m.content)?m.content.filter(p=>p.type==='image_url').length:0),0),status:null};
        globalThis.savedCredentialRequests.push(record);
      }
      const response=await original.apply(this,arguments);if(record)record.status=response.status;return response;
    };
  },key);
  await page.evaluate(()=>{globalThis.savedCredentialEvents=[];window.omniEdu.onXiaozhiEvent(e=>globalThis.savedCredentialEvents.push(e));});
}
async function settings(){await page.getByRole('button',{name:'小智模型设置',exact:true}).click();await page.getByTestId('pi-model-settings').waitFor();await until(async()=>!await page.getByTestId('pi-settings-key').isDisabled());}
async function back(){await page.getByTestId('nav-ai').click();await page.getByTestId('xiaozhi-pi-workspace').waitFor();await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());}
async function verify(candidate,success){await page.getByTestId('pi-settings-key').fill(candidate);await page.getByTestId('pi-settings-verify').click();await until(async()=>new RegExp(success?'密钥验证通过':'密钥未通过验证').test(await page.getByTestId('pi-settings-feedback').innerText()));await until(async()=>!await page.getByTestId('pi-settings-key').isDisabled());}
async function begin(prompt){const prior=(await snap()).projection.turns.at(-1)?.id;await page.getByTestId('office-prompt-input').fill(prompt);await page.locator('.office-composer [data-slot="prompt-input-send"]').click();assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');return prior;}
async function run(prompt){const prior=await begin(prompt);return until(async()=>{const s=await snap(),t=s.projection.turns.at(-1);if(t?.id!==prior&&!s.running){assert.equal(t.status,'completed',t.error);return t;}});}
async function resize(width,height){await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});}
try{
  await createSamples(samples);const filename='03-资料实读.txt',file=path.join(workspace,filename),code=JSON.parse(fs.readFileSync(path.join(samples,'答案.json'))).file.code;fs.copyFileSync(path.join(samples,filename),file);
  await launch();assert.equal(query('SELECT count(*) AS n FROM app_settings WHERE key=?',['deepseek'])[0].n,0);let view=await state();assert(view.ok&&!view.value.configured&&view.value.version===0);
  await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},workspace);await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();await until(async()=>Boolean((await snap()).workspace));
  check('Fresh owned profile has no legacy or environment credential; workspace authorized before the first native run');
  await settings();const previous=rawConfiguration();await verify('sk-owned-invalid-'+randomUUID(),false);assert.equal(rawConfiguration(),previous);view=await state();assert(view.ok&&!view.value.configured&&view.value.version===0);await page.getByTestId('pi-settings-key').fill('');
  check('CFG-02 invalid candidate actually fails official authentication without saving a key');
  await verify('  '+key+'  ',true);view=await state();assert(view.ok&&!view.value.configured&&view.value.version===0&&view.value.models.length);assert.equal(rawConfiguration(),previous);assert.equal(await page.getByTestId('pi-settings-key').getAttribute('type'),'password');report.officialModels=view.value.models.map(v=>({id:v.id,inputModalities:v.inputModalities,source:v.source,stale:v.stale||false}));
  await page.getByTestId('pi-settings-key').fill('');await page.getByTestId('pi-settings-refresh').click();await until(async()=>await page.getByTestId('pi-settings-catalogue-error').isVisible());assert.match(await page.getByTestId('pi-settings-catalogue-error').innerText(),/密钥未通过验证.*显示上次读取的官方目录/);assert.match(await page.getByTestId('pi-settings-configured').innerText(),/尚未配置/);
  check('CFG-01 valid independent verification is not a save; official catalogue cache cannot validate an absent runtime credential');
  await back();const count=(await transports()).length;await begin('列出我已授权工作目录中的文件，读取03-资料实读.txt正文，告诉我核验码与课堂时长。');await until(async()=>{const s=await snap(),t=s.projection.turns.at(-1);return !s.running&&t?.status==='failed'&&/凭证不可用/.test(t.error);});assert(await page.getByTestId('office-conversation').getByText('DeepSeek 凭证不可用，请检查 API Key。',{exact:true}).isVisible());assert.equal((await transports()).length,count);assert.equal(query('SELECT count(*) AS n FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[id])[0].n,0);assert.equal(rawConfiguration(),previous);
  check('CFG-01 unsaved candidate cannot drive a formal chat or create a native session despite a cached official list');
  await settings();await verify(key,true);await page.getByTestId('pi-settings-default-model').click();await page.getByRole('menuitemradio',{name:'deepseek-flash',exact:true}).click();await page.getByTestId('pi-settings-save').click();assert.equal(await page.getByTestId('pi-settings-key').inputValue(),'');await until(async()=>/已保存/.test(await page.getByTestId('pi-settings-feedback').innerText()));
  view=await state();assert(view.ok&&view.value.configured&&view.value.version===1&&view.value.defaultModel==='deepseek-flash'&&!view.value.catalogueError);const savedRaw=rawConfiguration(),saved=JSON.parse(savedRaw);assert(saved.sealedKey&&!savedRaw.includes(key));assert(!JSON.stringify(view).includes(key));assert(await app.evaluate(({safeStorage},{sealed,key})=>safeStorage.decryptString(Buffer.from(sealed,'base64'))===key,{sealed:saved.sealedKey,key}));
  check('CFG-01 visible save clears password and commits actual Windows-encrypted key and official default; public settings contain no key');
  for(const [width,height]of [[1366,768],[1920,1080]]){await resize(width,height);await page.getByTestId('pi-settings-save').scrollIntoViewIfNeeded();for(const testid of ['pi-settings-save','pi-settings-verify']){const b=await page.getByTestId(testid).boundingBox();assert(b&&b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=height);}assert.equal(await page.getByTestId('pi-settings-key').inputValue(),'');await page.screenshot({path:path.join(output,`saved-settings-${width}.png`),animations:'disabled'});check(`CFG-01 cleared settings/save/verify controls reachable at ${width}x${height}`);}
  await back();const read=await run('列出我已授权工作目录中的文件，读取03-资料实读.txt正文，告诉我核验码与课堂时长。');assert(final(read).includes(code)&&final(read).includes('37'));assert(toolResults('office_list_files').some(v=>!v.message.isError));assert(toolResults('office_read_text').some(v=>!v.message.isError&&JSON.stringify(v.message.content).includes(code)));let sent=await transports();assert(sent.length&&sent.every(v=>v.credentialMatchesSaved&&v.status===200&&v.model==='deepseek-flash'&&v.imageParts===0));report.firstAnswer=final(read);
  check('CFG-01 formal original Pi tools read the random authorized file using the UI-saved key in actual HTTP 200 SDK requests');
  const old=native();await close();const newCode='EDU-COLD-'+randomUUID().slice(0,10).toUpperCase();fs.writeFileSync(file,`教师合成资料\n核验码：${newCode}\n课堂41分钟\n练习8道\n`);
  await launch();view=await state();assert(view.ok&&view.value.configured&&view.value.version===1&&view.value.defaultModel==='deepseek-flash');assert.equal(rawConfiguration(),savedRaw);assert.equal(native().binding.session_file,old.binding.session_file);assert(native().bytes.subarray(0,old.bytes.length).equals(old.bytes));assert(!(await snap()).running);assert.equal((await transports()).length,0);assert.equal((await page.evaluate(()=>globalThis.savedCredentialEvents)).filter(e=>e.kind==='tool_start').length,0);
  check('CFG-01 cold restart with empty environment restores saved configuration and exact native prefix without replay or provider requests');
  const reread=await run('我已更新03-资料实读.txt，请重新读取当前文件正文，告诉我现在的核验码和课堂时长，注明来源。');assert(final(reread).includes(newCode)&&final(reread).includes('41')&&!final(reread).includes(code));assert(toolResults('office_read_text',old.rows.length).some(v=>!v.message.isError&&JSON.stringify(v.message.content).includes(newCode)));sent=await transports();assert(sent.length&&sent.every(v=>v.credentialMatchesSaved&&v.status===200&&v.model==='deepseek-flash'));report.coldAnswer=final(reread);
  check('CFG-01 cold follow-up actually rereads changed disk code/41, not the old answer, with the same saved credential');
  await settings();await page.getByTestId('pi-settings-key').fill('sk-owned-invalid-'+randomUUID());await page.getByTestId('pi-settings-save').click();assert.equal(await page.getByTestId('pi-settings-key').inputValue(),'');await until(async()=>/密钥未通过验证/.test(await page.getByTestId('pi-settings-feedback').innerText()));assert.equal(rawConfiguration(),savedRaw);view=await state();assert(view.ok&&view.value.configured&&view.value.version===1&&view.value.defaultModel==='deepseek-flash');await page.getByTestId('pi-settings-feedback').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'invalid-save.png'),animations:'disabled'});
  check('CFG-02 actual invalid save clears the candidate, reports authentication failure and preserves the working ciphertext/revision/default');
  // An unknown ID is an IPC boundary case, not a model offered to the teacher.
  const invalidModel=await page.evaluate(()=>window.omniEdu.saveXiaozhiSettings({schemaVersion:'xiaozhi.settings.v1',version:1,defaultModel:'owned-nonexistent-model'}));assert(!invalidModel.ok&&invalidModel.error==='model_unavailable');assert.equal(rawConfiguration(),savedRaw);
  check('CFG-02 main rejects a nonexistent model with real official validation and keeps configuration (typed boundary, not UI choice)');
  view=await page.evaluate(id=>window.omniEdu.getXiaozhiSettings({sessionId:id,refresh:true}),id);assert(view.ok&&!view.value.catalogueError);const pro=view.value.models.find(v=>v.id==='deepseek-v4-pro');assert(pro&&pro.source==='official'&&!pro.stale&&pro.inputModalities?.includes('text')&&!pro.inputModalities.includes('image'),'A fresh official text-only model is required for the unsupported-image case');report.freshUnsupportedCapability={id:pro.id,inputModalities:pro.inputModalities,source:pro.source,observedAt:pro.observedAt};await back();const beforeSwitch=native();await page.getByRole('button',{name:'选择模型',exact:true}).click();await page.getByRole('menuitemradio',{name:pro.id,exact:true}).click();await until(async()=>(await snap()).projection.model===pro.id&&!await page.getByTestId('office-prompt-input').isDisabled());assert.equal(native().binding.session_file,beforeSwitch.binding.session_file);assert(native().bytes.subarray(0,beforeSwitch.bytes.length).equals(beforeSwitch.bytes));assert.equal(rawConfiguration(),savedRaw);
  check('CFG-02 visible official model switch retains the existing native history and leaves the new-chat default unchanged');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},path.join(samples,'02-公开视觉.png'));await page.getByRole('button',{name:'添加本地附件',exact:true}).click();await until(async()=>!await page.getByRole('button',{name:'添加本地附件',exact:true}).isDisabled());const beforeImages=native().rows.length,beforeHttp=(await transports()).length;
  const unsupported=await run('请实际查看附件图片：列出每种图形的颜色、数量及左右位置，抄出图内核验码。无法查看时请明确说明。');assert(/无法|不能|不支持|不具备|不提供/.test(final(unsupported))&&/图|视觉/.test(final(unsupported)));assert(!unsupported.items.some(v=>v.imageDelivery?.state==='received'));assert(!native().rows.slice(beforeImages).some(v=>v.message?.content?.some(p=>p.type==='image')));const imageCalls=toolResults('office_view_public_image',beforeImages);assert(imageCalls.every(v=>v.message.isError));sent=(await transports()).slice(beforeHttp);assert(sent.length&&sent.every(v=>v.model===pro.id&&v.imageParts===0&&v.credentialMatchesSaved&&v.status===200));report.unsupportedImage={model:pro.id,answer:final(unsupported),imageToolCalls:imageCalls.length,imageUploaded:false};await page.screenshot({path:path.join(output,'unsupported-image.png'),animations:'disabled'});
  check('CFG-02 formal text-only model explicitly refuses image understanding; zero image bytes/native image blocks/received receipts and no automatic model switch');
  // A new independent task remains usable after the rejected save/capability failure.
  const last=await run('重新读取03-资料实读.txt当前正文，告诉我现在的核验码与课堂时长。');assert(final(last).includes(newCode)&&final(last).includes('41'));assert(toolResults('office_read_text',beforeImages).some(v=>!v.message.isError&&JSON.stringify(v.message.content).includes(newCode)));assert.equal((await snap()).projection.model,pro.id);
  check('CFG-02 after configuration/capability failures, a new natural text-tool task succeeds using the preserved key and explicitly chosen model');
  assert.deepEqual(errors,[]);assert.equal(fingerprint(buildRoot).sha256,fixed.sha256);assert.equal(await page.getByTestId('office-prompt-input').inputValue(),'');report.success=true;
}catch(error){report.error=String(error.stack||error).replaceAll(key,'[credential]').slice(0,4500);process.exitCode=1;await page?.getByTestId('pi-settings-key').fill('').catch(()=>{});await page?.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});if(app)report.lastSnapshot=await snap().catch(()=>undefined);}
finally{await close().catch(()=>{});report.transports=requests;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,error:report.error,output}));}
