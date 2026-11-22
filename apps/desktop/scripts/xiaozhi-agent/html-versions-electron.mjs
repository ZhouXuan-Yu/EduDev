import {checkTeachingArtifactReference,checkStudentArtifactReference} from './teaching-artifact-reference-scenario.mjs';
import {checkTaskArtifactLinks} from './task-artifact-links-scenario.mjs';
import {openTeachingFiles} from '../product-navigation.mjs';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {_electron as electron} from 'playwright';
const checkMode=process.argv.includes('--checks');
const referenceMode=process.argv.includes('--reference');
const relationMode=process.argv.includes('--relations');
const desktop=path.resolve(import.meta.dirname,'../..'),root=fs.mkdtempSync(path.join(os.tmpdir(),'omni-edu-html-ui-')),data=path.join(root,'data'),profile=path.join(root,'profile'),workspace=path.join(root,'workspace');fs.mkdirSync(workspace);const report={ok:false,checks:[],errors:[],root,boundary:'Original formal Pi/composer/read/edit/approve/history/restore with synthetic SSE, actual disk/SQLite and cold readback; zero paid calls. Complete E08/FX01/252 AT remains pending.'};let app,page,id;const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');const until=async(fn,ms=90000)=>{const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,40));}throw Error('HTML version path timed out');};const check=n=>{report.checks.push(n);console.log('PASS '+n);};const snap=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),id),card=r=>page.locator(`[data-testid="pi-text-change"][data-change-id="${r.id}"]`),hist=r=>card(r).getByTestId('pi-office-versions');
async function launch(){const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'owned-synthetic-not-real',DEEPSEEK_MODEL:'deepseek-flash'};for(const k of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[k];app=await electron.launch({args:[testMain(desktop),'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});await assertIsolatedPiMain(app,testMain(desktop),profile);await app.evaluate(({net})=>{globalThis.htmlVersions={mode:'create',n:0,calls:[]};net.fetch=async(input,init)=>{const url=typeof input==='string'?input:input.url;if(url.includes('/models'))return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});if(!url.includes('/chat/completions'))throw Error('Network blocked');const s=globalThis.htmlVersions,n=s.n++,body=JSON.parse(init.body),system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');let call;s.calls.push({mode:s.mode,n});
    if(s.mode==='multi'){
      const files=['浮力实验甲.html','浮力实验乙.html'];
      if(n===0){
        const line=system.split('\n').findLast(value=>value.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'));
        const task=line?JSON.parse(line):{requirementsVersion:1,revision:0};
        const steps=files.map((target,index)=>({id:`save-${index}`,text:`保存 ${target}`,dependsOn:[],reported:'pending',kind:'saved_text',target}));
        steps.push({id:'review',text:'教师核对两份实验内容',dependsOn:steps.map(step=>step.id),reported:'pending',kind:'human'});
        call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:task.requirementsVersion,
          expectedRevision:task.revision,reason:'保存两份独立的浮力实验文件',steps})};
      }else if(files[n-1]){
        call={name:'office_create_text',arguments:JSON.stringify({path:files[n-1],taskStepId:`save-${n-1}`,
          content:`<!doctype html><html lang="zh-CN"><title>浮力实验 ${n}</title><body><h1>浮力实验 ${n}</h1><p>比较浸没体积和浮力。</p></body></html>`})};
      }
    }else if(s.mode==='reference'){
      const result=body.messages.findLast(m=>m.role==='tool')?.content;
      const toolText=typeof result==='string'?result:JSON.stringify(result);
      if(n===0) call={name:'office_list_attachments',arguments:'{}'};
      else if(n===1){
        const id=toolText?.match(/xiat_[a-f0-9-]{36}/)?.[0],revision=Number(toolText?.match(/"revision"\s*:\s*(\d+)/)?.[1]);
        if(!id||!Number.isSafeInteger(revision))throw Error('The real Pi attachment directory did not return an attachment identity');
        call={name:'office_read_attachment',arguments:JSON.stringify({id,revision})};
      } else s.referenceText=toolText;
    }else if(n===0&&s.mode==='edit')call={name:'office_read_text',arguments:JSON.stringify({path:'浮力.html'})};else if(n===(s.mode==='edit'?1:0)){const line=system.split('\n').findLast(l=>l.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"')),task=line?JSON.parse(line):{requirementsVersion:1,revision:0};call={name:'update_task_plan',arguments:JSON.stringify({schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:task.requirementsVersion,expectedRevision:task.revision,reason:'生成或局部修改真实HTML',steps:[{id:'save',text:'保存HTML教学文件',dependsOn:[],reported:'pending',kind:'saved_text',target:'浮力.html'},{id:'review',text:'教师核对科学内容',dependsOn:['save'],reported:'pending',kind:'human'}]})};}else if(n===(s.mode==='edit'?2:1))call={name:s.mode==='edit'?'office_edit_text':'office_create_text',arguments:JSON.stringify({path:'浮力.html',...(s.mode==='edit'?{edits:[{oldText:'载荷4N',newText:'载荷5N'}]}:{content:'<!doctype html><html lang="zh-CN"><title>浮力课堂</title><body><h1>浮力演示</h1><p>载荷4N</p><button onclick="this.textContent=42">互动</button></body></html>'}),checks:[{path:'浮力.html',rules:{contains:[{text:s.mode==='edit'?'载荷5N':'载荷4N'}]}}],taskStepId:'save'})};const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'owned-html',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';return new Response(chunk({role:'assistant',content:''})+chunk(call?{tool_calls:[{index:0,id:'html-'+s.mode+'-'+n,type:'function',function:call}]}:{content:'已按确认保存，请核对教学内容。'})+chunk({},call?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});};});page=await app.firstWindow();page.on('pageerror',e=>report.errors.push(String(e)));await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());const current=await page.locator('.office-composer-container').getAttribute('data-session-id');if(id)assert.equal(id,current);id=current;}
async function waitForPermittedDraft(mode){
 const expected=mode==='edit'?'office_edit_text':'office_create_text',approved=new Set();
 return until(async()=>{
  const state=await snap(),draft=state.changes.find(row=>row.state==='pending');
  if(draft)return draft;
   const turn=state.projection.turns.at(-1);
   if(!state.running&&turn?.status==='failed')throw Error(JSON.stringify(turn));
  const request=state.approvals.find(row=>row.permission?.state==='pending'&&row.permission.request.action===expected);
  if(request&&!approved.has(request.id)){
   const button=page.locator(`[data-testid="pi-permission-approval"][data-approval-id="${request.id}"]`).getByTestId('pi-permission-approve');
   if(await button.isVisible()&&!await button.isDisabled()){await button.click();approved.add(request.id);}
  }
 });
}
async function generate(mode,text,count=1){
 await app.evaluate((_,mode)=>Object.assign(globalThis.htmlVersions,{mode,n:0}),mode);
 await page.getByTestId('office-prompt-input').fill(text);
 await page.getByRole('button',{name:'发送消息',exact:true}).click();
 const rows=[];
 for(let index=0;index<count;index++){
  const row=await waitForPermittedDraft(mode);
  await until(async()=>!await card(row).getByTestId('pi-text-approve').isDisabled());
  await card(row).getByTestId('pi-text-approve').click();
  await until(async()=>(await snap()).changes.find(change=>change.id===row.id)?.state==='applied');
  rows.push(row);
 }
 await until(async()=>!(await snap()).running&&!await page.getByTestId('office-prompt-input').isDisabled());
 return count===1?rows[0]:rows;
}
const readSql=sql=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(sql).all();}finally{db.close();}};
const checkControl=(scope,artifactId)=>scope.locator('[data-testid="pi-delivery-check"][data-artifact-id="'+artifactId+'"]').first();
async function expandCheck(control){const trigger=control.getByRole('button',{name:/^文件检查/}).first();if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();await until(async()=>!await control.getByTestId('pi-file-check-refresh').isDisabled());await control.getByTestId('pi-artifact-check-status').waitFor();}
async function readArtifact(artifactId){const value=await page.evaluate(input=>window.omniEdu.artifactCheck(input),{schemaVersion:'xiaozhi.artifact-check.v1',sessionId:id,artifactId});assert(value.ok,JSON.stringify(value));return value.value;}
async function history(row){const c=hist(row);await c.getByTestId('office-versions-toggle').click();await c.getByTestId('office-version-select').waitFor();await until(async()=>!await c.getByTestId('office-versions-refresh').isDisabled());return c;}
try{await launch();await app.evaluate(({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});},workspace);await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();await until(async()=>Boolean((await snap()).workspace));
 const other=path.join(workspace,'浮力补充.html');
 fs.writeFileSync(other,'<!doctype html><title>补充练习</title><p>载荷4N</p>');
 const otherHash=sha(other);
 const first=await generate('create','制作一份可离线打开的浮力课堂HTML，主线载荷4N，带互动按钮，实际保存并让我确认。');const original=fs.readFileSync(path.join(workspace,'浮力.html'));const second=await generate('edit','读取刚保存的浮力.html，只把载荷4N改成载荷5N，保留其他内容，先展示让我确认。');const later=fs.readFileSync(path.join(workspace,'浮力.html')),stamp=fs.statSync(path.join(workspace,'浮力.html')).mtimeMs;assert(original.includes(Buffer.from('载荷4N'))&&later.includes(Buffer.from('载荷5N')));check('Formal composer creates and approves HTML, then actual read/edit/approval saves the second version');
 assert.equal(sha(other),otherHash);check('Explicit target edits the named HTML; a second file containing the same text retains its hash');
 if(checkMode){
  const calls=await app.evaluate(()=>globalThis.htmlVersions.calls.length);await openTeachingFiles(page);await page.getByTestId('artifacts-search').fill('html');await page.getByTestId('artifact-'+second.id).getByRole('button').click();const detail=page.getByTestId('artifacts-detail'),current=checkControl(detail,second.id);await expandCheck(current);assert.equal(await current.getByTestId('pi-artifact-check-status').getAttribute('data-current'),'true');assert.notEqual(await current.getByTestId('pi-file-check-result').getAttribute('data-state'),'stale');let exact=await readArtifact(second.id);assert.equal(exact.report.files[0].sha256,sha(path.join(workspace,'浮力.html')));assert(exact.applicable);const before=readSql('SELECT count(*) n FROM xiaozhi_delivery_inspections')[0].n;
  await current.getByTestId('pi-file-check-run').click();await until(async()=>!await current.getByTestId('pi-file-check-refresh').isDisabled());assert.equal(readSql('SELECT count(*) n FROM xiaozhi_delivery_inspections')[0].n,before+1);exact=await readArtifact(second.id);assert(exact.applicable);assert(!exact.report.candidate);assert.equal(await app.evaluate(()=>globalThis.htmlVersions.calls.length),calls);report.currentCheck=exact;check('Teaching Files opens current saved-version receipt and runs actual local HTML inspection with no model request');
  await page.getByTestId('artifacts-conversation').click();await page.getByTestId('xiaozhi-pi-workspace').waitFor();
 }
 let c=await history(first);assert.equal(await c.getByTestId('office-version-select').locator('option').count(),2);await c.getByTestId('office-version-preview').click();assert((await c.getByTestId('pi-science-demo').getAttribute('srcdoc')).includes('载荷4N'));assert.equal(sha(path.join(workspace,'浮力.html')),createHash('sha256').update(later).digest('hex'));check('Original historical card selects and previews exact first-version HTML without changing current disk content');
 if(checkMode){const old=checkControl(c,first.id);await expandCheck(old);assert.equal(await old.getByTestId('pi-file-check-result').getAttribute('data-state'),'stale');assert.equal(await old.getByTestId('pi-artifact-check-status').getAttribute('data-current'),'false');assert((await old.innerText()).includes('仅供对照'));assert.equal(await old.getByTestId('pi-file-check-run').count(),0);const exact=await readArtifact(first.id);assert.equal(exact.report.files[0].sha256,createHash('sha256').update(original).digest('hex'));assert(!exact.applicable);assert(exact.report.files[0].checks.some(f=>f.kind==='content'&&f.state==='passed'));report.historicalCheck=exact;check('Selected older same-path HTML retains its exact original successful findings, visibly historical and unable to certify current content');}
 const count=await app.evaluate(()=>globalThis.htmlVersions.calls.length);await c.getByTestId('office-version-restore').click();await c.getByTestId('office-version-confirm').click();await until(async()=>await c.getByTestId('office-version-select').locator('option').count()===3);await until(async()=>!await c.getByTestId('office-versions-refresh').isDisabled());let view=await page.evaluate(v=>window.omniEdu.officeVersion(v),{schemaVersion:'xiaozhi.office-versions.v1',sessionId:id,artifactId:first.id,action:'view'});assert(view.ok);const third=view.value.versions.at(-1);assert.deepEqual(fs.readFileSync(path.join(workspace,third.path)),original);assert.deepEqual(fs.readFileSync(path.join(workspace,'浮力.html')),later);assert.equal(fs.statSync(path.join(workspace,'浮力.html')).mtimeMs,stamp);assert.equal(await app.evaluate(()=>globalThis.htmlVersions.calls.length),count);check('Visible restore saves byte-identical first HTML as third current file while second version stays untouched, zero model requests');
 if(checkMode){const control=checkControl(c,third.artifactId);await expandCheck(control);assert((await control.innerText()).includes('没有保留匹配'));assert.equal(await control.getByTestId('pi-file-check-result').count(),0);assert.equal((await readArtifact(third.artifactId)).report,null);await control.getByTestId('pi-file-check-run').click();await until(async()=>!await control.getByTestId('pi-file-check-refresh').isDisabled());await control.getByTestId('pi-file-check-result').waitFor();const fresh=await readArtifact(third.artifactId);assert(fresh.applicable&&fresh.report&&!fresh.report.candidate);report.restoredCheck=fresh;check('Restored new identity never inherits an unrelated old receipt; teacher explicitly inspects actual restored file');
  const destination=path.join(workspace,third.path);fs.appendFileSync(destination,'<p>外部改动</p>');await control.getByTestId('pi-file-check-refresh').click();await until(async()=>await control.getByTestId('pi-artifact-check-status').getAttribute('data-integrity')==='changed');assert.equal(await control.getByTestId('pi-file-check-result').getAttribute('data-state'),'stale');assert.equal(await control.getByTestId('pi-file-check-run').count(),0);const changed=await readArtifact(third.artifactId);assert.equal(changed.report.id,fresh.report.id);assert.deepEqual(changed.report.files[0].checks,fresh.report.files[0].checks);fs.unlinkSync(destination);await control.getByTestId('pi-file-check-refresh').click();await until(async()=>await control.getByTestId('pi-artifact-check-status').getAttribute('data-integrity')==='missing');assert((await control.innerText()).includes('仍保留'));assert.equal((await readArtifact(third.artifactId)).report.id,fresh.report.id);fs.writeFileSync(destination,original);check('Actual external edit and deletion invalidate applicability while retaining diagnostic findings, no regenerated output');
 }
 await card(first).getByTestId('pi-text-open').click();await page.getByTestId('pi-file-preview').waitFor();await until(async()=>(await page.getByTestId('pi-file-panel').textContent()).includes(third.path));await page.getByTestId('pi-files-close').click();check('Old chat card default open resolves the new current filename through the same typed host');
 for(const[width,height]of[[1366,768],[1920,1080]]){await app.evaluate(({BrowserWindow},v)=>BrowserWindow.getAllWindows()[0].setContentSize(v.width,v.height),{width,height});await page.waitForFunction(v=>innerWidth===v.width&&innerHeight===v.height,{width,height});await c.getByTestId('office-version-select').scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(root,width+'.png'),animations:'disabled'});}(report.viewports)=[1366,1920];check('Existing history selection and restore controls remain reachable in both native window sizes');
 await app.close();app=undefined;await launch();c=await history(first);assert.equal(await c.getByTestId('office-version-select').locator('option').count(),3);assert.equal(await app.evaluate(()=>globalThis.htmlVersions.calls.length),0);if(checkMode){const control=checkControl(c,first.id);await expandCheck(control);assert.equal(await control.getByTestId('pi-file-check-result').getAttribute('data-state'),'stale');assert.equal((await readArtifact(first.id)).report.id,report.historicalCheck.report.id);await openTeachingFiles(page);await page.getByTestId('artifacts-search').fill('html');await page.getByTestId('artifact-'+third.artifactId).getByRole('button').click();const current=checkControl(page.getByTestId('artifacts-detail'),third.artifactId);await expandCheck(current);assert.equal((await readArtifact(third.artifactId)).report.id,report.restoredCheck.report.id);assert.equal(await app.evaluate(()=>globalThis.htmlVersions.calls.length),0);check('Cold history and Teaching Files retrieve the same selected receipts and honest stale applicability with zero model replay');}assert.deepEqual(fs.readFileSync(path.join(workspace,third.path)),original);assert.deepEqual(report.errors,[]);report.sessionId=id;report.versions=view.value.versions;check('Cold original Pi restores the same three HTML versions and current file with zero replay/errors');
 if(relationMode&&checkMode)await page.getByTestId('artifacts-conversation').click();
 const multiple=relationMode?await generate('multi','新任务：请把浮力实验甲和浮力实验乙分别保存为两份独立的新 HTML 文件，均由我确认保存。',2):[];
 if(referenceMode||relationMode){
    const sourceSessionId=id;
   const reference=await checkTeachingArtifactReference({page,app,sourceSessionId:id,third,originalPath:path.join(workspace,third.path),original,oldArtifact:first,until,check,readSql,root});
   report.reference=reference;
   await app.close();app=undefined;id=undefined;await launch();
   const cold=await page.evaluate(sessionId=>window.omniEdu.getXiaozhiSnapshot(sessionId),reference.sessionId);
   const projected=cold.projection.turns.flatMap(turn=>turn.items).flatMap(item=>item.attachments||[]);
   assert.deepEqual(projected.find(item=>item.id===reference.attachmentId).artifactOrigin,reference.origin);
   assert.equal(await app.evaluate(()=>globalThis.htmlVersions.calls.length),0);
   assert.deepEqual(report.errors,[]);
   check('Cold SQLite readback projects the submitted reference provenance with zero replay and zero renderer errors');
    if(relationMode)await checkTaskArtifactLinks({page,sourceSessionId,reference,first,second,third,multiple,readSql,until,check});
   await checkStudentArtifactReference({page,app,readSql,check,root});
 }
 report.ok=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(report.error);report.snapshot=await snap().catch(()=>null);await page?.screenshot({path:path.join(root,'failure.png')}).catch(()=>{});}finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root}));}
