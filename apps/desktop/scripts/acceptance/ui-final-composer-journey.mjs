import assert from 'node:assert/strict';
import path from 'node:path';

export async function composerJourney({getPage,output,report,check,notRun,assertNoAdmission,resize,relaunch}){
  let page=getPage();
  const composer=()=>page.locator('.office-composer-container:visible');
  const input=()=>composer().getByTestId('office-prompt-input');
  const send=()=>composer().getByRole('button',{name:'发送消息',exact:true});
  const session=()=>composer().getAttribute('data-session-id');
  const shot=name=>page.screenshot({path:path.join(output,name+'.png')});
  const frame=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const focused=async locator=>{assert.equal(await locator.count(),1);await page.waitForFunction(element=>document.activeElement===element,await locator.elementHandle());};
  const ready=async()=>{
    await input().waitFor();
    await page.waitForFunction(()=>{const input=document.querySelector('[data-testid="office-prompt-input"]');return input&&!input.disabled;});
    const id=await session();assert(id&&id!=='loading','Real session required');
    return id;
  };
  const config=async()=>page.evaluate(async()=>{
    const id=document.querySelector('.office-composer-container')?.getAttribute('data-session-id');
    const snapshot=await window.omniEdu.getXiaozhiSnapshot(id);
    const settings=await window.omniEdu.getXiaozhiSettings({sessionId:id});
    if(!settings.ok)throw Error('Local model settings unavailable');
    return {permission:localStorage.getItem('xiaozhi.permissionMode.v1'),workspace:snapshot.workspace??null,memoryScope:snapshot.memoryScope??null,fileWritesEnabled:snapshot.fileWritesEnabled??null,approvals:snapshot.approvals,models:settings.value};
  });
  const menuKeyboard=async({id,trigger,menu,inspect})=>{
    if(await trigger.count()===0){notRun(id,'Original trigger absent in fresh isolated state; no skills/config seeded');return;}
    if(await trigger.isDisabled()){notRun(id,'Original trigger disabled in current local configuration; no state forced');return;}
    await check(id,'Original menu keyboard navigation and Escape focus return',async()=>{
      const before=await config(),draft=await input().inputValue();
      await trigger.focus();await page.keyboard.press('Enter');await menu.waitFor();
      await page.keyboard.press('ArrowDown');
      await page.waitForFunction(root=>{
        const active=document.activeElement,descendant=root.getAttribute('aria-activedescendant');
        const item=active?.closest('[role^="menuitem"]')||(descendant?document.getElementById(descendant):null);
        return !!item&&root.contains(item)&&item.getAttribute('aria-disabled')!=='true';
      },await menu.elementHandle());
      if(inspect)await inspect(menu);
      await shot(id);await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});await focused(trigger);
      assert.equal(await input().inputValue(),draft);assert.deepEqual(await config(),before,'Opening/navigating/closing a menu must not change authority or model settings');
    });
  };

  await check('A03-empty-disabled','Blank and whitespace Enter retain empty run ledger',async()=>{
    await ready();await input().fill('');assert(await send().isDisabled());await input().press('Enter');await frame();assert.equal(await input().inputValue(),'');
    await input().fill('   ');assert(await send().isDisabled());await input().press('Enter');await frame();assert.equal(await input().inputValue(),'   ');
    assert.equal(await composer().getByTestId('pi-queue-submit').count(),0);await input().fill('');
  });
  await check('A03-ime','Composition Enter and legacy keyCode 229 do not admit a request',async()=>{
    const text='组合输入验收草稿，仅保留不发送';await input().fill(text);await input().focus();
    try{
      await input().dispatchEvent('compositionstart',{data:''});await input().dispatchEvent('compositionupdate',{data:'输入'});
      await input().dispatchEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,which:13,isComposing:true,bubbles:true,cancelable:true});
      await input().dispatchEvent('keyup',{key:'Enter',code:'Enter',keyCode:13,isComposing:true,bubbles:true});
      await frame();assert.equal(await input().inputValue(),text);await assertNoAdmission('IME-isComposing');
      await input().dispatchEvent('keydown',{key:'Enter',code:'Enter',keyCode:229,which:229,isComposing:false,bubbles:true,cancelable:true});
      await frame();assert.equal(await input().inputValue(),text);await assertNoAdmission('IME-keyCode229');
    }finally{await input().dispatchEvent('compositionend',{data:'输入'});}
    await focused(input());await shot('A03-ime');
  });
  await check('A03-shift-enter','Shift+Enter inserts a newline in the original textarea',async()=>{
    await input().fill('第一行');await input().press('End');await input().press('Shift+Enter');await input().pressSequentially('second line');
    assert.equal(await input().inputValue(),'第一行\nsecond line');await focused(input());await shot('A03-newline');
  });

  await menuKeyboard({id:'X01-permissions-menu',trigger:composer().getByTestId('pi-permission-picker'),menu:page.getByRole('menu',{name:'资料与操作权限',exact:true}),inspect:async menu=>{
    for(const mode of ['request','acceptEdits','approveForMe','fullAccess'])await menu.getByTestId('pi-permission-'+mode).waitFor();
    assert.equal(await menu.getByRole('menuitem',{name:'文件写入逐次由教师确认',exact:true}).getAttribute('aria-disabled'),'true');
  }});
  await menuKeyboard({id:'X01-commands-menu',trigger:composer().getByTestId('pi-command-picker'),menu:page.getByRole('menu',{name:'常用命令',exact:true}),inspect:async menu=>{
    for(const command of ['clear','goal','compact','permissions','skills'])await menu.getByTestId('pi-command-'+command).waitFor();
  }});
  await menuKeyboard({id:'X01-skills-menu',trigger:composer().getByTestId('pi-skill-picker'),menu:page.getByRole('menu',{name:'教育技能',exact:true})});
  await menuKeyboard({id:'X01-models-menu',trigger:composer().getByRole('button',{name:'选择模型',exact:true}),menu:page.getByRole('menu',{name:'模型',exact:true})});
  await menuKeyboard({id:'X01-thinking-menu',trigger:composer().getByTestId('pi-thinking-session-trigger'),menu:page.getByRole('menu',{name:'思考强度选项',exact:true}),inspect:async menu=>{
    const disabled=menu.locator('[role^="menuitem"][aria-disabled="true"]');report.thinkingDisabledOptions=await disabled.count();
    // Capture capability-dependent disabled states; do not invent unsupported models.
    report.thinkingOptions=await menu.locator('[role^="menuitem"]').evaluateAll(items=>items.map(item=>({testId:item.getAttribute('data-testid'),disabled:item.getAttribute('aria-disabled')==='true'})));
  }});
  await check('X01-attachment-chooser','Original keyboard attachment trigger, empty chooser result and focus retention',async()=>{
    const trigger=composer().getByRole('button',{name:'添加本地附件',exact:true}),draft=await input().inputValue();
    assert(!await trigger.isDisabled());const before=await config();
    const fileInput=composer().locator('input[type="file"]');assert.equal(await fileInput.count(),1);assert(await fileInput.getAttribute('accept'));assert.equal(await fileInput.getAttribute('multiple'),'');
    await trigger.focus();const pending=page.waitForEvent('filechooser');await page.keyboard.press('Enter');const chooser=await pending;
    assert(chooser.isMultiple());await chooser.setFiles([]);await frame();await page.keyboard.press('Escape');await focused(trigger);
    assert.equal(await fileInput.evaluate(element=>element.files.length),0);assert.equal(await input().inputValue(),draft);assert.deepEqual(await config(),before);await shot('X01-attachment-empty');
  });

  let first,second;const draftA='会话A：仅本机保留的独立草稿',draftB='会话B：不同草稿，不发送';
  const selectSession=async id=>{
    const entry=page.locator(`[data-testid="edu-navigation"]:visible [data-testid="workbench-session-${id}"]`);
    await entry.click();await page.waitForFunction(expected=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')===expected,id);await ready();
  };
  await check('A03-session-drafts','Original UI creates and switches sessions while isolating unsent drafts',async()=>{
    first=await ready();await input().fill(draftA);await page.getByTestId('pi-new-session').click();
    await page.waitForFunction(old=>{const id=document.querySelector('.office-composer-container')?.getAttribute('data-session-id');return id&&id!=='loading'&&id!==old;},first);
    second=await ready();assert.equal(await input().inputValue(),'');await input().fill(draftB);
    await selectSession(first);assert.equal(await input().inputValue(),draftA);await selectSession(second);assert.equal(await input().inputValue(),draftB);
    const stored=await page.evaluate(ids=>ids.map(id=>JSON.parse(localStorage.getItem('xiaozhi.composer-draft.v1:'+id))),[first,second]);
    assert.deepEqual(stored.map(value=>({version:value.version,text:value.text})),[{version:1,text:draftA},{version:1,text:draftB}]);report.draftSessions={first,second};await shot('A03-isolated-drafts');
  });
  await check('A03-draft-navigation','Page and panel round trips retain the same unsent draft',async()=>{
    await page.getByTestId('pi-files-toggle').click();await page.getByTestId('pi-file-panel').waitFor();assert.equal(await input().inputValue(),draftB);
    await page.getByTestId('pi-files-close').click();await page.getByTestId('pi-file-panel').waitFor({state:'hidden'});assert.equal(await input().inputValue(),draftB);
    await page.locator('[data-testid="edu-navigation"]:visible [data-testid="nav-settings"]').click();await page.getByTestId('pi-settings-workspace').waitFor();
    await page.getByTestId('nav-ai').click();await ready();assert.equal(await session(),second);assert.equal(await input().inputValue(),draftB);
  });
  await check('A03-cold-drafts','Owned cold launch restores both original session drafts without admission',async()=>{
    page=await relaunch();await ready();await selectSession(first);assert.equal(await input().inputValue(),draftA);await selectSession(second);assert.equal(await input().inputValue(),draftB);await shot('A03-cold-drafts');
  });
  await check('A03-controls-geometry','Original input and toolbar remain reachable at both required window sizes',async()=>{
    for(const [width,height] of [[1366,768],[1920,1080]]){
      await resize(width,height);
      await frame();
      const controls=composer().locator('textarea, button:visible');const geometry=await controls.evaluateAll(elements=>elements.map(element=>{const rect=element.getBoundingClientRect();return {tag:element.tagName,x:rect.x,y:rect.y,width:rect.width,height:rect.height,viewport:{width:innerWidth,height:innerHeight}};}));
      assert(geometry.length>=6);for(const box of geometry)assert(box.width>0&&box.height>0&&box.x>=0&&box.y>=0&&box.x+box.width<=box.viewport.width+1&&box.y+box.height<=box.viewport.height+1,'Composer control is clipped');
      report.geometry??=[];report.geometry.push({requested:{width,height},controls:geometry});await shot('A03-controls-'+width);
    }
  });
}
