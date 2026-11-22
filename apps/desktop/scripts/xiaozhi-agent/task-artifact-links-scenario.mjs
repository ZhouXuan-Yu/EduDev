import assert from 'node:assert/strict';

export async function checkTaskArtifactLinks({page,sourceSessionId,reference,first,second,third,multiple,readSql,until,check}) {
  const query=(kind,ids)=>page.evaluate(input=>window.omniEdu.getXiaozhiWorkbenchSummary(input),{schemaVersion:1,kind,...ids});
  const list=async(kind,ids)=>{
    const result=await query(kind,ids);
    assert.equal(result.ok,true,JSON.stringify(result));
    assert.equal(result.value.partial,false);
    return result.value.items;
  };
  const records=readSql("SELECT value_json FROM app_settings WHERE key GLOB 'xiaozhi.task.v1:xitask_*'").map(row=>JSON.parse(row.value_json));
  const changes=readSql('SELECT id,run_id FROM xiaozhi_pi_text_changes');
  const owner=runId=>records.find(record=>record.lineage.some(entry=>entry.runId===runId))?.view.id;
  const taskId=changeId=>owner(changes.find(change=>change.id===changeId)?.run_id);
  const firstTask=taskId(first.id),secondTask=taskId(second.id),multiTask=taskId(multiple[0].id);
  const referenceTask=owner(readSql('SELECT id,run_id FROM xiaozhi_pi_attachments').find(row=>row.id===reference.attachmentId)?.run_id);
  assert([firstTask,secondTask,multiTask,referenceTask].every(Boolean));
  assert.equal(new Set([firstTask,secondTask,multiTask,referenceTask]).size,4);
  assert.equal(taskId(multiple[1].id),multiTask);
  const taskFiles=(taskId,sessionId=sourceSessionId)=>list('task_artifacts',{sessionId,taskId});
  const fileTasks=artifactId=>list('artifact_tasks',{sessionId:sourceSessionId,artifactId});
  const ids=items=>items.map(item=>item.artifactId).sort();

  const firstFiles=await taskFiles(firstTask);
  assert.deepEqual(ids(firstFiles),[first.id,third.artifactId].sort());
  assert.equal(firstFiles.find(item=>item.artifactId===third.artifactId).restored,true);
  assert.deepEqual(ids(await taskFiles(secondTask)),[second.id]);
  const multiFiles=await taskFiles(multiTask);
  assert.deepEqual(ids(multiFiles),multiple.map(row=>row.id).sort());
  assert(multiFiles.every(item=>item.relation==='produced'&&item.version===1&&item.currentArtifactId===item.artifactId));
  const referenced=await taskFiles(referenceTask,reference.sessionId);
  assert.deepEqual(ids(referenced),[third.artifactId]);
  assert.equal(referenced[0].relation,'referenced');
  const reverse=await fileTasks(third.artifactId);
  assert.deepEqual(reverse.map(item=>[item.relation,item.taskId]),[['produced',firstTask],['referenced',referenceTask]]);
  assert.deepEqual((await fileTasks(second.id)).map(item=>item.taskId),[secondTask]);
  check('Cold SQLite and typed IPC distinguish independent tasks in one conversation, two files from one task, and exact restored and referenced versions');

  await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-my_tasks').click();
  await page.getByTestId('my-tasks-workspace').getByTestId('pi-task-filter').selectOption('all');
  const row=id=>page.locator(`[data-testid="pi-task-overview-row"][data-task-id="${id}"]`);
  await row(firstTask).getByTestId('task-artifact-relations').locator('summary').click();
  await row(firstTask).locator(`[data-testid="task-related-artifact"][data-artifact-id="${first.id}"]`).click();
  const version=page.getByTestId('office-versions-body');
  await until(async()=>await version.getByTestId('office-version-select').count()===1
    &&await version.getByTestId('office-version-select').inputValue()===first.id);
  await version.getByTestId('artifact-task-relations').locator('summary').click();
  await version.locator(`[data-testid="artifact-related-task"][data-task-id="${firstTask}"]`).click();
  await row(firstTask).waitFor();
  assert.equal(await page.getByTestId('pi-task-overview-row').count(),1);
  check('The visible task opens its exact historic artifact version and the reverse link opens only the source task');

  await page.evaluate(id=>window.omniEdu.archiveAiConversationSession(id),reference.sessionId);
  assert.equal((await query('task_artifacts',{sessionId:reference.sessionId,taskId:referenceTask})).ok,false);
  assert.deepEqual((await fileTasks(third.artifactId)).map(item=>item.taskId),[firstTask]);
  check('Archiving a synthetic referencing conversation removes its reverse link and denies direct task lookup');
}
