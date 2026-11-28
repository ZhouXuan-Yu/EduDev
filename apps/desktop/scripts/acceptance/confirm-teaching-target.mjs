import assert from 'node:assert/strict';

export async function confirmTeachingTarget(until,app,page,sessionId,scope,selectedPreference){
  const folder=await page.evaluate(async name=>{
    const hasFolder=workspace=>workspace.folders.find(folder=>folder.name===name)?.id;
    return hasFolder(await window.omniEdu.listAiConversations())||
      hasFolder(await window.omniEdu.createAiConversationFolder({name}));
  },scope.classRef+' 班');
  assert(folder);
  await page.evaluate(([session,selector])=>window.omniEdu.moveAiConversationSession(session,selector),[sessionId,folder]);
  await until(async()=>{
    const {memoryScope}=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
    return memoryScope?.currentFolderId===folder;
  });
  const opening=app.waitForEvent('window');
  await page.getByRole('button',{name:'设置',exact:true}).click();
  const settings=await opening;
  await settings.getByTestId('pi-settings-tab-teacher-memory').click();
  const initial=await settings.evaluate(()=>window.omniEdu.getTeacherMemorySettings());
  assert(initial.ok);
  const fields=[['subject',scope.subject],['grade',scope.grade]].filter(([field,value])=>initial.value.profile[field]!==value);
  if(fields.length){
    for(const [field,value] of fields){
      await settings.getByTestId('teacher-memory-'+field).click();
      await settings.getByRole('option',{name:value,exact:true}).click();
    }
    await settings.getByTestId('teacher-memory-save').click();
  }
  const profile=await until(async()=>{
    const result=await settings.evaluate(()=>window.omniEdu.getTeacherMemorySettings());
    return result.ok&&result.value.profile.subject===scope.subject&&result.value.profile.grade===scope.grade
      ? result.value.profile:null;
  });
  await settings.getByTestId('pi-settings-tab-permissions').click();
  const memory=settings.getByTestId('pi-memory-scope');
  const memoryTrigger=memory.locator('[data-slot="chat-tool-trigger"]');
  await memoryTrigger.waitFor();
  if(await memoryTrigger.getAttribute('aria-expanded')!=='true')await memoryTrigger.click();
  await memory.getByTestId('pi-memory-enabled').waitFor();
  await memory.getByRole('button',{name:'本会话的班级和学期'}).click();
  const [,year,semester]=/^(20[0-9]{2})([FS])$/.exec(scope.termRef)||[];
  assert(year);
  const term=year+'-'+(semester==='F'?'fall':'spring');
  await memory.getByLabel('学期年份',{exact:true}).fill(year);
  await memory.getByLabel('学期',{exact:true}).selectOption(semester==='F'?'fall':'spring');
  await memory.getByTestId('pi-memory-confirm-class').click();
  await memory.getByText('已确认班级和学期，可重新选择本会话的记忆。',{exact:true}).waitFor();
  if(selectedPreference){
    await memory.getByTestId('pi-memory-source').selectOption({label:'教师确认的记忆'});
    const choice=memory.getByTestId('pi-memory-select-'+selectedPreference.id);
    if(folder===selectedPreference.folder&&term===selectedPreference.term){
      await choice.check();
      await memory.getByTestId('pi-memory-enabled').check();
      await memory.getByTestId('pi-memory-save').click();
      await until(async()=> (await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId))
        .memoryScope.selections.some(s=>s.id===selectedPreference.id&&s.version===selectedPreference.revision&&s.state==='ready'));
    }else{
      await memory.getByText('暂无可选的教师记忆。',{exact:true}).waitFor();
      assert.equal(await choice.count(),0);
    }
  }
  await Promise.all([settings.waitForEvent('close'),settings.getByTestId('settings-window-close').click()]);
  return {folder,term,profile};
}
