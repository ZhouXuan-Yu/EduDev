/** Actual existing Pi delivery and original UI. No fake runtime events or writes. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {workspaceNotifications} from '../../src/renderer/components/office/workspace-notifications.ts';

export async function verifySavedWorkspacePanel({page,sessionId,files,size,capture,until}){
  const shell=page.getByTestId('xiaozhi-pi-workspace').filter({visible:true});
  assert.equal(await shell.count(),1,'Exactly one active conversation shell');
  const snapshot=await page.evaluate(async id=>{
    const s=await window.omniEdu.getXiaozhiSnapshot(id);
    const plain=item=>({id:item.id,runId:item.runId,state:item.state,path:item.path});
    return {projection:{turns:s.projection.turns.map(t=>({id:t.id}))},changes:s.changes?.map(plain),
      officeArtifacts:s.officeArtifacts?.map(plain),deliveries:s.deliveries?.map(d=>({id:d.id,runId:d.runId,state:d.state,
        files:d.files.map(f=>({draftId:f.draftId,carried:f.carried,change:f.change&&plain(f.change),artifact:f.artifact&&plain(f.artifact)}))}))};
  },sessionId);
  const expected=workspaceNotifications(snapshot);assert.equal(expected.hasFiles,true,'Actual typed saved delivery produces the notice');
  const saved=[...(snapshot.changes??[]),...(snapshot.officeArtifacts??[]),...(snapshot.deliveries??[]).flatMap(d=>d.files.flatMap(f=>[f.change,f.artifact].filter(Boolean)))].filter(f=>['saved','applied'].includes(f.state)&&f.path);
  const matched=files.filter(f=>saved.some(s=>path.basename(s.path)===path.basename(f.path)));
  assert(matched.length>0,'Notice is bound to genuine independently verified saved Office files');
  const results=[];
  for(const width of [800,1366,1920]){
    await size(width,768);
    const context=shell.getByTestId('edu-context-panel');
    if(await context.isVisible()){await context.getByTestId('workbench-panel-close').click();await context.waitFor({state:'hidden'});}
    const cue=shell.getByTestId('workspace-files-available');await cue.waitFor();assert.equal(await cue.count(),1);
    const input=shell.getByTestId('office-prompt-input');await input.focus();
    const draft=await input.inputValue(),main=shell.locator('.edu-chat-main'),before=await main.boundingBox();assert(before);
    // Repeat actual read-only host delivery reads while the teacher retains focus.
    for(let n=0;n<2;n++){
      await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id).then(()=>undefined),sessionId);
      assert.equal(await context.count(),0,'Host reads do not auto-open the panel');
      assert.equal(await input.evaluate(el=>document.activeElement===el),true,'Readback does not take composer focus');
      assert.deepEqual(await main.boundingBox(),before,'Readback does not reserve panel width');
    }
    const shellNode=await shell.elementHandle();
    await cue.click();await context.waitFor();
    await until(()=>context.getByTestId('workbench-panel-close').evaluate(el=>document.activeElement===el),'panel receives explicit user focus');
    assert.equal(await context.getByTestId('workbench-tab-files').getAttribute('aria-selected'),'true');
    await context.getByTestId('pi-file-panel').waitFor();
    const savedList=context.getByTestId('conversation-saved-files');await savedList.waitFor();
    await until(()=>savedList.getByTestId('conversation-saved-file').count().then(n=>n>=files.length),'actual saved output list loaded');
    const actualIds=await savedList.getByTestId('conversation-saved-file').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-artifact-id')));
    for(const file of files)assert(actualIds.includes(file.artifactId),'All six actual exports must be visible, not just a saved-file notice');
    const catalogue=await page.evaluate(()=>window.omniEdu.listDocumentArtifacts());
    const expectedIds=catalogue.filter(row=>row.sessionId===sessionId&&row.status==='exported'&&(!row.officeVersion||row.officeVersion.currentArtifactId===row.id)).map(row=>row.id).sort();
    assert.deepEqual([...actualIds].sort(),expectedIds,'Only this session current saved records may appear');
    const labels=await savedList.getByTestId('conversation-saved-file').evaluateAll(nodes=>nodes.map(node=>{
      const title=node.querySelector('[data-slot="list-view-title"]')?.getBoundingClientRect(),description=node.querySelector('[data-slot="list-view-description"]')?.getBoundingClientRect();
      const wrapper=node.querySelector('[data-slot="list-view-title"]')?.parentElement,style=wrapper&&getComputedStyle(wrapper);
      return {stacked:!!title&&!!description&&title.height>0&&description.height>0&&title.bottom<=description.top+1,
        title:title&&{top:title.top,bottom:title.bottom,height:title.height},description:description&&{top:description.top,height:description.height},wrapperClass:wrapper?.className,display:style?.display,direction:style?.flexDirection};}));
    assert(labels.every(label=>label.stacked),'Filename and format must have their intended distinct rows: '+JSON.stringify(labels.find(label=>!label.stacked)));
    assert.equal(await shellNode.evaluate(el=>el===document.querySelector('[data-testid="xiaozhi-pi-workspace"]')),true,'Opening does not rebuild the shell');
    await capture('workspace-files-explicit-'+width);
    for(const file of files){
      const item=savedList.locator(`[data-testid="conversation-saved-file"][data-artifact-id="${file.artifactId}"]`);assert.equal(await item.count(),1);
      await item.focus();await item.press('Enter');const preview=context.getByTestId('saved-artifact-preview');await preview.waitFor();
      const document=preview.getByTestId('saved-artifact-document');await document.waitFor({timeout:12000});assert.equal(await document.getAttribute('data-sha256'),file.sha256);assert.equal(await document.getAttribute('data-format'),path.extname(file.path).slice(1));
      assert((await document.innerText()).trim().length>25);assert.equal(await preview.locator('[role="alert"]').count(),0);
      if(file===files[0])await capture('workspace-actual-saved-preview-'+width);
      await preview.getByTestId('saved-artifact-close').click();await preview.waitFor({state:'hidden'});
      await until(()=>item.evaluate(el=>document.activeElement===el),'closing exact artifact restores its own list row');
    }
    await context.getByTestId('workbench-panel-close').click();await context.waitFor({state:'hidden'});
    await until(()=>cue.evaluate(el=>document.activeElement===el),'close returns exact file notice focus');
    assert.equal(await input.inputValue(),draft,'Opening and closing does not change the draft');
    await cue.press('Enter');await context.waitFor();await until(()=>context.getByTestId('workbench-panel-close').evaluate(el=>document.activeElement===el),'Enter opens saved files');
    await page.keyboard.press('Escape');await context.waitFor({state:'hidden'});
    await until(()=>cue.evaluate(el=>document.activeElement===el),'Escape restores file notice focus');
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal document overflow');
    results.push({width,hasRealFiles:true,matchedArtifactIds:matched.map(f=>f.artifactId),hostReads:2,closedWithoutWidthOrFocusChange:true,
      clickOpenClose:true,enterEscape:true,draftUnchanged:true,shellRetained:true});await shellNode.dispose();
  }
  return {sessionId,savedRecords:saved.length,matchedArtifactIds:matched.map(f=>f.artifactId),results,
    boundary:'Real persisted Pi delivery readback and actual UI only; new running-tool events use separate event component/live evidence.'};
}
