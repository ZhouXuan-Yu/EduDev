import assert from 'node:assert/strict';
import path from 'node:path';

export async function checkTaskContextArtifacts({page,app,first,second,third,snap,root,until,check}) {
  const snapshot=await snap();
  assert.equal(snapshot.taskRunIds.length,1);
  if(!await page.getByTestId('xiaozhi-pi-inspector').isVisible())await page.getByTestId('pi-aside-toggle').click();
  const panel=page.getByTestId('xiaozhi-pi-inspector');
  const task=panel.getByTestId('pi-context-task');
  await task.waitFor();
  assert.equal(await task.getAttribute('data-task-id'),snapshot.task.id);
  assert.match(await task.innerText(),/载荷5N/);
  assert.match(await task.innerText(),/已核验/);
  const sources=await panel.getByTestId('pi-web-aside').innerText();
  assert.match(sources,/浮力\.html/);
  assert.doesNotMatch(sources,/浮力-恢复版/);
  await panel.getByTestId('task-artifact-relations').locator('summary').click();
  const artifacts=panel.getByTestId('task-related-artifact');
  await until(async()=>await artifacts.count()===1);
  assert.equal(await artifacts.first().getAttribute('data-artifact-id'),second.id);
  assert(![first.id,third.artifactId].includes(second.id));
  check('Cold task panel shows verified steps, actual read source, and only the second task’s saved artifact');

  for(const [width,height] of [[1366,768],[1920,1080]]){
    await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
    await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
    await artifacts.first().scrollIntoViewIfNeeded();
    for(const control of [artifacts.first(),page.getByTestId('office-prompt-input')]){
      assert(await control.evaluate(element=>{
        const {x,y,width,height}=element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(x+width/2,y+height/2));
      }));
    }
    await page.screenshot({path:path.join(root,`task-context-${width}x${height}.png`),animations:'disabled'});
  }
  check('Task artifact and message input remain reachable in both native window sizes');

  await artifacts.first().click();
  const versions=page.getByTestId('artifacts-detail').getByTestId('office-versions-body');
  await until(async()=>await versions.getByTestId('office-version-select').count()===1
    &&await versions.getByTestId('office-version-select').inputValue()===second.id);
  assert.match(await versions.getByTestId('office-versions-current').innerText(),/第 3 版/);
  await page.getByTestId('artifacts-conversation').click();
  await page.getByTestId('office-prompt-input').waitFor();
  assert.equal(await app.evaluate(()=>globalThis.htmlVersions.calls.length),0);
  check('The right panel opens its exact saved historical version without model replay');
}

export async function checkTaskContextReference({page,reference,until,check}) {
  await until(async()=>await page.locator('.office-composer-container').getAttribute('data-session-id')===reference.sessionId);
  const panel=page.getByTestId('xiaozhi-pi-inspector');
  if(!await panel.isVisible())await page.getByTestId('pi-aside-toggle').click();
  await panel.getByTestId('pi-context-task').waitFor();
  const sources=await panel.getByTestId('pi-web-aside').innerText();
  assert.match(sources,/浮力-恢复版3\.html/);
  assert.doesNotMatch(sources,/浮力\.html/);
  check('Switching to the reference task shows its actual frozen attachment read and clears the previous task’s source');
  await page.getByTestId('workbench-panel-close').click();
}
