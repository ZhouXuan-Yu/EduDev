import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {openTeachingFiles} from '../product-navigation.mjs';

export async function checkTeachingArtifactReference({page,app,sourceSessionId,third,originalPath,original,oldArtifact,until,check,readSql,root}) {
  const sessions=()=>readSql('SELECT id, student_id, archived_at FROM ai_conversation_sessions');
  const attachments=()=>readSql('SELECT id,conversation_id,relative_path,content_sha256,state,revision,run_id,artifact_origin_json FROM xiaozhi_pi_attachments');
  const previousSessions=sessions().length;
  await openTeachingFiles(page);
  await page.getByTestId('artifacts-search').fill('html');
  await page.getByTestId('artifact-'+third.artifactId).getByRole('button').click();
  const reference=page.getByTestId('artifacts-reference');
  const catalog=await page.evaluate(()=>window.omniEdu.listDocumentArtifacts());
  const selected=catalog.find(item=>item.id===third.artifactId);
  const input={sourceSessionId,artifactId:selected.id,contentHash:selected.contentHash};
  const invoke=payload=>page.evaluate(value=>window.omniEdu.referenceTeachingArtifact(value),payload);
  assert.deepEqual(await invoke({...input,path:originalPath}),{ok:false,error:'invalid_input'});
  assert.deepEqual(await invoke({...input,sourceSessionId:'aisession_00000000-0000-4000-8000-000000000000'}),{ok:false,error:'permission_denied'});
  assert.deepEqual(await invoke({...input,contentHash:'a'.repeat(64)}),{ok:false,error:'changed'});
  assert.equal((await invoke({...input,artifactId:oldArtifact.id})).ok,false);
  fs.appendFileSync(originalPath,'<p>目录外改动</p>');
  await reference.click();
  await until(async()=>(await page.getByTestId('artifacts-error').textContent())?.includes('版本已变化'));
  fs.unlinkSync(originalPath);
  await reference.click();
  await until(async()=>(await page.getByTestId('artifacts-error').textContent())?.includes('不存在'));
  assert.equal(sessions().length,previousSessions);
  assert.equal(attachments().length,0);
  fs.writeFileSync(originalPath,original);
  check('Teaching Files reports changed or missing bytes and rejects stale identity, wrong ownership, hash or renderer path without creating a session');

  const modelCalls=()=>app.evaluate(()=>globalThis.htmlVersions.calls.length);
  const before=await modelCalls();
  await reference.click();
  const composer=page.locator('.office-composer-container');
  const sessionId=await until(async()=>{
    const current=await composer.getAttribute('data-session-id',{timeout:2000}).catch(()=>null);
    return current&&current!==sourceSessionId?current:null;
  });
  const pill=page.getByTestId('pi-agent-attachment-list').getByText(/引用教学文件/).first();
  await pill.waitFor();
  await pill.click();
  const modal=page.getByTestId('pi-attachment-preview');
  assert.match(await modal.getByTestId('pi-science-demo').getAttribute('srcdoc'),/载荷4N/);
  await modal.getByTestId('pi-attachment-preview-close').click();
  const [draft]=attachments();
  const origin=JSON.parse(draft.artifact_origin_json);
  assert.equal(draft.conversation_id,sessionId);
  assert.equal(draft.state,'draft');
  assert.equal(draft.run_id,null);
  assert.equal(draft.content_sha256,selected.contentHash);
  assert.deepEqual(origin,{...input,fileVersion:origin.fileVersion});
  assert.match(origin.fileVersion,/^[a-f0-9]{64}$/);
  assert.deepEqual(fs.readFileSync(path.join(root,'data','xiaozhi-pi','attachments',sessionId,draft.relative_path)),original);
  assert.equal(await modelCalls(),before);
  check('Selecting the current HTML creates a separate new conversation with a byte-identical local draft, precise provenance and zero model requests');

  // The independent copy must still carry the chosen version once the source changes later.
  fs.appendFileSync(originalPath,'<p>NEW-SOURCE-VERSION</p>');
  try {
    await app.evaluate(()=>Object.assign(globalThis.htmlVersions,{mode:'reference',n:0,referenceText:null}));
    await page.getByTestId('office-prompt-input').fill('读取我发送的教学文件附件，帮我制作浮力复习提纲，提取载荷数值。');
    await page.getByRole('button',{name:'发送消息',exact:true}).click();
    const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
    await until(async()=>{
      const status=(await snapshot()).projection.turns.at(-1)?.status;
      if(status==='failed')throw Error('Attachment reference test model failed before the final response');
      return app.evaluate(()=>globalThis.htmlVersions.referenceText);
    });
    await until(async()=>!(await snapshot()).running);
    const modelText=await app.evaluate(()=>globalThis.htmlVersions.referenceText);
    assert.match(modelText,/载荷4N/);
    assert.doesNotMatch(modelText,/NEW-SOURCE-VERSION|载荷5N/);
    const [submitted]=attachments();
    assert.deepEqual(JSON.parse(submitted.artifact_origin_json),origin);
    assert.equal(submitted.state,'submitted');
    assert.ok(submitted.run_id);
    assert.equal(submitted.revision,draft.revision+1);
    check('Explicit Send reads the captured original through the real Pi attachment tool and the new run keeps its source and selected version');
  } finally {fs.writeFileSync(originalPath,original);}
  return {sessionId,attachmentId:draft.id,origin};
}

export async function checkStudentArtifactReference({page,app,readSql,check,root}) {
  const directory=path.join(root,'student-fixture');fs.mkdirSync(directory);
  const fixture=await page.evaluate(async destinationRoot=>{
    const api=window.omniEdu;
    await api.createStudent({displayName:'D3 合成验收学生'});
    const student=(await api.listStudents('')).find(item=>item.displayName==='D3 合成验收学生');
    const source=await api.createAiConversationSession({studentId:student.id});
    const file=await api.exportDocumentArtifact({sessionId:source.session.id,title:'合成学生讲义',type:'markdown',fileName:'合成学生讲义.md',
      contentMd:'# 合成学生讲义\n\n仅用于验证附件授权范围。',destinationRoot});
    return {studentId:student.id,input:{sourceSessionId:source.session.id,artifactId:file.id,contentHash:file.contentHash}};
  },directory);
  const invoke=()=>page.evaluate(input=>window.omniEdu.referenceTeachingArtifact(input),fixture.input);
  const before=await app.evaluate(()=>globalThis.htmlVersions.calls.length);
  const result=await invoke();assert.equal(result.ok,true,JSON.stringify(result));
  const sessions=()=>readSql('SELECT id, student_id FROM ai_conversation_sessions');
  assert.equal(sessions().find(session=>session.id===result.sessionId).student_id,fixture.studentId);
  const rows=readSql('SELECT conversation_id,state,artifact_origin_json FROM xiaozhi_pi_attachments');
  const draft=rows.find(row=>row.conversation_id===result.sessionId);
  assert.equal(draft.state,'draft');
  assert.equal(JSON.parse(draft.artifact_origin_json).artifactId,fixture.input.artifactId);
  const sessionCount=sessions().length;
  await page.evaluate(id=>window.omniEdu.archiveStudent(id),fixture.studentId);
  assert.deepEqual(await invoke(),{ok:false,error:'permission_denied'});
  assert.equal(sessions().length,sessionCount);
  assert.equal(await app.evaluate(()=>globalThis.htmlVersions.calls.length),before);
  check('Existing Markdown exports retain student scope and archived students cannot create additional reference drafts');
}
