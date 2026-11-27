import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export async function verifyHandoutMemoryAuthority({page,app,sessionId,bookId,title,until,current,snapshot,sql,versions,output,check,report}){
  const oldText='用数轴解释有理数的相反数。';
  const newText='画数轴并标出一对相反数，写明它们到原点的距离。';
  const marker='教师手改提示：先标明原点与正方向。';
  assert(process.env.OMNI_EDU_R3_FIXTURES,'Specify the frozen R3 fixtures directory');
  const fixturePath=path.join(process.env.OMNI_EDU_R3_FIXTURES,'R3_memory_use_cases.json');
  const fixtureBytes=fs.readFileSync(fixturePath);
  const cases=JSON.parse(fixtureBytes).cases.filter(item=>item.category==='artifact'&&['manual_v2','artifact_version'].includes(item.condition));
  assert.equal(cases.length,2);
  const target=cases[0].taskScope;
  const term=/^(20[0-9]{2})([FS])$/u.exec(target.termRef);
  assert(term);
  const folderId=await page.evaluate(async({sessionId,name})=>{
    const created=await window.omniEdu.createAiConversationFolder({name});
    const folder=created.folders.find(item=>item.name===name);
    await window.omniEdu.moveAiConversationSession(sessionId,folder.id);
    return folder.id;
  },{sessionId,name:target.grade+target.classRef+'班'+target.subject+'（合成）'});
  const settingsOpening=app.waitForEvent('window');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const settings=await settingsOpening;
  await settings.getByTestId('pi-settings-tab-permissions').click();
  const panel=settings.getByTestId('pi-settings-main').getByTestId('pi-memory-scope');
  if(!await panel.getByTestId('pi-memory-enabled').isVisible())await panel.locator('[data-slot="chat-tool-trigger"]').click();
  await panel.getByRole('button',{name:'本会话的班级和学期'}).click();
  await panel.getByLabel('学期年份',{exact:true}).fill(term[1]);
  await panel.getByLabel('学期',{exact:true}).selectOption(term[2]==='F'?'fall':'spring');
  await panel.getByTestId('pi-memory-confirm-class').click();
  await panel.getByText('已确认班级和学期，可重新选择本会话的记忆。',{exact:true}).waitFor();
  const binding=(await snapshot()).memoryScope;
  assert.equal(binding.teachingTarget.folderId,folderId);
  assert.equal(binding.selections.length,0);
  await Promise.all([settings.waitForEvent('close'),settings.getByTestId('settings-window-close').click()]);
  const original=await current();
  const exercise=original.blocks.find(b=>b.metadata.handoutRole==='exercise');
  const solution=original.blocks.find(b=>b.metadata.handoutRole==='exercise_solution');
  const focus=original.blocks.find(b=>b.metadata.handoutRole==='focus');
  const update=(block,title,text,create=false)=>page.evaluate(({block,title,text,create})=>{
    const {pageId,type,status,params,metadata,sourceAnchors,order}=block;
    return window.omniEdu.upsertTeachingBookBlock({pageId,type,status,params,metadata,sourceAnchors,
      order:create?order+20:order,title,payload:{...block.payload,text}},create?undefined:block.id,create?undefined:block.version);
  },{block,title,text,create});
  const confirm=()=>page.evaluate(async bookId=>{
    const preview=await window.omniEdu.previewTeachingBookVersion({bookId});
    if(!preview.ok)throw Error(preview.message);
    const result=await window.omniEdu.confirmTeachingBookVersion({bookId,digest:preview.value.digest});
    if(!result.ok)throw Error(result.message);
    return result.value;
  },bookId);
  const third=await update(exercise,'练习 3 · 基础',oldText,true);
  await update(solution,'练习 3 · 答案与解析','例如 2 与 -2。\n\n这两个点到原点的距离相等。',true);
  const v1=await confirm();
  const prompt=page.getByTestId('office-prompt-input');
  async function submit(phase,text,extra={}){
    const prior=(await snapshot()).projection.turns.at(-1)?.id;
    await app.evaluate((_electron,input)=>Object.assign(globalThis.handoutEditTest,input),{phase,index:0,...extra});
    await prompt.fill(text);
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    return ()=>until(async()=>{
      const state=await snapshot(),turn=state.projection.turns.at(-1);
      if(state.running||turn?.id===prior)return false;
      assert.equal(turn.status,'completed',turn.error);
      return true;
    });
  }
  const archive='讲义数轴练习的版本记录：第三题原文是「'+oldText+'」这是当时的版本。';
  const archiveDone=await submit('authority-archive',archive);
  await archiveDone();
  const [ref]=sql("SELECT id FROM ai_conversation_messages WHERE session_id=? AND role='user' AND content=?",[sessionId,archive]);
  assert(ref);
  await update(third,third.title,newText);
  await update(focus,focus.title,marker);
  const v2=await confirm(),before=await current();
  assert.notEqual(v1.digest,v2.digest);
  const historySettingsOpening=app.waitForEvent('window');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const historySettings=await historySettingsOpening;
  await historySettings.getByTestId('pi-settings-tab-teacher-memory').click();
  await historySettings.getByTestId('history-settings-session').selectOption(sessionId);
  const entry=historySettings.getByTestId('history-settings-source-'+ref.id);
  await entry.getByRole('button',{name:'查看来源'}).click();
  await entry.getByTestId('history-settings-allow').click();
  await historySettings.getByTestId('history-settings-notice').getByText(/已允许查找/).waitFor();
  await Promise.all([historySettings.waitForEvent('close'),historySettings.getByTestId('settings-window-close').click()]);
  const request='继续修改《'+title+'》的数轴练习，只改第三题，把难度调为拓展。请参考先前版本记录。';
  await prompt.fill(request);
  await page.getByTestId('history-lookup-open').click();
  await page.getByTestId('history-lookup-search').click();
  await page.getByTestId('history-candidate-'+ref.id).click();
  await page.getByTestId('history-lookup-preview').getByText(archive,{exact:true}).waitFor();
  // The frozen A desktop had a single confirmation writing the Session scope.
  const selectForSession=report.sourceSha==='ca2a51425619dc14412508839e0799338567c399'
    ?'history-lookup-use':'history-lookup-use-session';
  await page.getByTestId(selectForSession).click();
  await page.getByTestId('history-use-selection').waitFor();
  const scope=(await snapshot()).memoryScope;
  assert(scope.enabled&&scope.selections.length===1&&scope.selections[0].layer==='history');
  check('Teacher permits lookup, previews and explicitly selects actual V1 history after saving V2');
  const done=await submit('authority-edit',request,{target:third.id,oldText,newText,v2Digest:v2.digest});
  const approve=page.getByTestId('pi-handout-edit').last().getByTestId('pi-handout-edit-approve');
  await approve.waitFor();
  await approve.click();
  await done();
  const after=await current(),result=after.blocks.find(b=>b.id===third.id);
  assert.deepEqual(after.blocks.filter(b=>b.id!==third.id),before.blocks.filter(b=>b.id!==third.id));
  assert.deepEqual(after.chapters,before.chapters);
  assert.deepEqual(after.pages,before.pages);
  assert.deepEqual(after.sources,before.sources);
  assert.deepEqual(result.payload,before.blocks.find(b=>b.id===third.id).payload);
  assert.equal(result.title,'练习 3 · 拓展');
  const last=versions().at(-1);
  assert.equal(last.kind,'edited_draft');
  const persisted=JSON.parse(last.image_json).content;
  assert.deepEqual(persisted.blocks,after.blocks);
  assert.equal(persisted.blocks.find(b=>b.id===focus.id).payload.text,marker);
  const wire=await app.evaluate(()=>globalThis.handoutEditTest);
  assert.deepEqual(wire.errors,[]);
  report.authority={fixtureHash:createHash('sha256').update(fixtureBytes).digest('hex'),fixtures:cases.map(c=>c.id),taskScope:target,
    teachingTarget:binding.teachingTarget,selectedIds:scope.selections.map(s=>s.id),v1,v2,review:wire.authorityInput,sourceRef:ref.id,
    tools:wire.requests.filter(r=>r.phase==='authority-edit').map(r=>r.tool).filter(Boolean),
    verifiedVersion:last.id,verifiedDigest:last.digest,verifiedBlocks:persisted.blocks.length,
    provider:'controlled transport',paidRequests:0};
  assert.deepEqual(report.authority.tools,['read_education_memory','education_read_handout_for_edit','education_propose_handout_edit']);
  // The application's own historical preview resolves the saved SQLite version to Markdown.
  const preview=await page.evaluate(input=>window.omniEdu.previewTeachingBookVersion(input),{bookId,versionId:last.id});
  assert(preview.ok);
  assert(preview.value.markdown.includes(marker)&&preview.value.markdown.includes(newText));
  assert(!preview.value.markdown.includes(oldText));
  const artifact=path.join(output,'verified-version.md');
  fs.writeFileSync(artifact,preview.value.markdown,'utf8');
  assert.equal(fs.readFileSync(artifact,'utf8'),preview.value.markdown);
  report.authority.previewFileSha256=createHash('sha256').update(fs.readFileSync(artifact)).digest('hex');
  const card=page.locator('[data-testid="pi-handout-edit"][data-state="applied"]').last();
  const open=card.getByTestId('pi-handout-edit-open');
  if(!await open.isVisible())await card.getByRole('button',{name:/已保存为草稿/u}).click();
  await open.click();
  await page.getByTestId('teaching-book-review-current').click();
  await page.getByTestId('teaching-book-version-confirm').click();
  const approved=await until(()=>{const v=versions().at(-1);return v.kind==='confirmed'&&v.digest===last.digest?v:null;});
  report.authority.confirmedVersion=approved.id;
  report.authority.fileExpectations={required:[newText,marker,result.title],excluded:[oldText]};
  check('Pi read the explicitly selected V1 memory and edited V2 question three. SQLite and the saved preview preserve all other blocks');
}
