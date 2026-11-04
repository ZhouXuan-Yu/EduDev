import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
// Retained shells may remain mounted: select the visible destination itself.
const productEntry=(page,space)=>page.locator(`[data-testid="edu-navigation"]:visible [data-testid="${{settings:'nav-settings',materials:'nav-knowledge',students:'nav-student-workbench'}[space]}"]:visible`);
// Each click can replace the visible shell. Await its destination before resolving another entry.
const navigate=async(page,space)=>{
  await productEntry(page,space).click();
  await page.locator(`[data-testid="${{settings:'pi-settings-workspace',materials:'materials-workspace',students:'student-workbench-layout'}[space]}"]:visible`).waitFor();
  await productEntry(page,space).and(page.locator('[aria-current="page"]')).waitFor();
};

export async function settingsJourney({get,output,data,profile,restoreActivation=false,report,check,captureBackupLedger,captureRestoreLedger,relaunch}){
  let {app,page}=get(),authority,backupPath,backupHash;
  const shell=()=>page.getByTestId('pi-settings-workspace');
  const shot=name=>page.screenshot({path:path.join(output,name+'.png')});
  const open=async()=>{await navigate(page,'settings');await page.getByTestId('pi-settings-key').waitFor();await page.waitForFunction(()=>!document.querySelector('[data-testid="pi-settings-key"]')?.disabled);};
  const tab=async name=>{const t=page.getByTestId('pi-settings-tab-'+name);if(!await t.isVisible())await page.getByTestId('pi-settings-advanced-toggle').click();await t.click();await page.waitForFunction(n=>document.querySelector('[data-testid="pi-settings-workspace"]')?.getAttribute('data-tab')===n,name);};
  const auth=()=>page.evaluate(async()=>{const list=await window.omniEdu.listAiConversations();return Promise.all(list.sessions.map(async s=>{const v=await window.omniEdu.getXiaozhiSnapshot(s.id);return {id:s.id,workspace:v.workspace??null,memoryScope:v.memoryScope??null,fileWritesEnabled:v.fileWritesEnabled??null,approvals:v.approvals??[],running:v.running,turns:v.projection.turns.length};}));});
  const preference=async(name,selected)=>{const c=page.getByTestId('pi-preference-'+name);if((await c.getAttribute('data-selected')==='true')!==selected)await c.locator('[data-slot="switch-content"]').click();assert.equal(await c.getAttribute('data-selected')==='true',selected);};
  await check('A17-layering','Daily settings, advanced disclosure and original model/skill/tool routes',async()=>{
    authority=await auth();report.authorityBefore=authority;await open();
    assert.equal(await page.getByTestId('pi-settings-advanced-toggle').getAttribute('aria-expanded'),'false');
    for(const n of ['models','permissions','interface','backup','archives'])assert(await page.getByTestId('pi-settings-tab-'+n).isVisible());
    assert(!await page.getByTestId('pi-settings-tab-skills').isVisible());await shot('01-daily');
    await tab('skills');await page.getByTestId('pi-skill-import').waitFor();await shot('02-advanced-skills');
    await tab('tools');await page.getByTestId('pi-mcp-name').waitFor();await shot('03-tools');await tab('models');
    assert(await page.getByTestId('pi-settings-key').isVisible());assert.equal(await page.getByTestId('pi-settings-key').inputValue(),'');
  });
  await check('A17-search-return','Search result navigates, empty search and return preserve original conversation',async()=>{
    await page.getByTestId('pi-settings-search').fill('本地文件面板');
    const result=page.getByTestId('pi-settings-search-results').getByRole('button')
      .filter({has:page.getByText('本地文件面板',{exact:true})})
      .filter({has:page.getByText('界面偏好 / 本地文件面板',{exact:true})});
    await result.waitFor();assert.equal(await result.count(),1,'Expected exactly the local file panel settings result');await result.click();
    assert.equal(await shell().getAttribute('data-tab'),'interface');assert.equal(await page.getByTestId('pi-settings-search').inputValue(),'');
    await page.getByTestId('pi-settings-search').fill('zzzz-no-settings-893');await page.getByTestId('pi-settings-search-empty').waitFor();await shot('04-search-empty');await page.getByTestId('pi-settings-search').press('Escape');
    await page.getByTestId('nav-ai').click();await page.getByTestId('xiaozhi-pi-workspace').waitFor();assert.deepEqual(await auth(),authority);await open();
  });
  await check('A17-preference-save','Local preferences report saved scope and affect blank workspace on return',async()=>{
    await tab('interface');await preference('sidebar',false);await preference('aside',false);await preference('files',true);
    assert.match(await page.getByTestId('pi-preference-notice').innerText(),/已保存，返回小智后生效/);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('xiaozhi.ui.v1'))),{schema:1,sidebar:false,aside:false,files:true});await shot('05-preferences');
    await page.getByTestId('nav-ai').click();await page.getByTestId('xiaozhi-pi-workspace').waitFor();
    assert.equal(await page.locator('[data-testid="edu-navigation"]:visible').getAttribute('data-collapsed'),'true');assert.equal(await page.getByTestId('pi-files-toggle').getAttribute('aria-pressed'),'false');
    await open();
  });
  await check('A17-preference-failure','Storage failure is visible and does not commit the switch',async()=>{
    await tab('interface');const before=await page.evaluate(()=>localStorage.getItem('xiaozhi.ui.v1'));
    await page.evaluate(()=>{window.__ownedSettingsSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='xiaozhi.ui.v1')throw Error('owned-storage-unavailable');return window.__ownedSettingsSet.call(this,k,v);};});
    try{await page.getByTestId('pi-preference-aside').locator('[data-slot="switch-content"]').click();assert.match(await page.getByTestId('pi-preference-notice').innerText(),/未能保存/);assert.equal(await page.getByTestId('pi-preference-aside').getAttribute('data-selected')==='true',false);assert.equal(await page.evaluate(()=>localStorage.getItem('xiaozhi.ui.v1')),before);await shot('06-preference-failure');}
    finally{await page.evaluate(()=>{Storage.prototype.setItem=window.__ownedSettingsSet;delete window.__ownedSettingsSet;});}
  });
  await check('A18-navigation-authority','Settings and space navigation do not enlarge file, memory or write permissions',async()=>{
    await page.getByTestId('nav-ai').click();await page.getByTestId('xiaozhi-pi-workspace').waitFor();
    for(const n of ['materials','students','settings'])await navigate(page,n);
    await shell().waitFor();await tab('permissions');await shot('07-permissions');assert.deepEqual(await auth(),authority);report.authorityAfterNavigation=await auth();
  });
  await check('X07-backup-cancel','Native export chooser cancel creates no backup',async()=>{
    if(!await shell().isVisible())await open();await tab('backup');await page.getByTestId('data-backup-export').click();await page.getByTestId('data-backup-cancelled').waitFor();assert.deepEqual(fs.readdirSync(path.join(output,'backup')),[]);await shot('08-backup-cancel');
  });
  await check('X07-backup-readback','Original UI exports and verifies actual isolated SQLite and manifest',async()=>{
    await page.getByTestId('data-backup-export').click();await page.getByTestId('data-backup-export-success').waitFor({timeout:60000});backupPath=await page.getByTestId('data-backup-export-path').innerText();assert(path.resolve(backupPath).startsWith(path.join(output,'backup')+path.sep));
    const db=new DatabaseSync(path.join(backupPath,'app.db'),{readOnly:true});try{assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
    await page.getByTestId('data-backup-verify').click();await page.getByTestId('data-backup-verify-success').waitFor({timeout:60000});
    backupHash=fs.readFileSync(path.join(backupPath,'omni-edu-backup-manifest.v1.json'),'utf8');report.backupPath=backupPath;await shot('09-backup-verified');
    await captureBackupLedger(backupPath);
  });
  await check('X07-backup-failure','Non-backup owned directory reports failure and releases controls',async()=>{
    await page.getByTestId('data-backup-verify').click();await page.getByTestId('data-backup-verify-failed').waitFor();assert(!await page.getByTestId('data-backup-verify').isDisabled());await shot('10-backup-failure');
  });
  await check('X02-X07-restore-cancel','Restore source cancel and target cancel leave active data and output untouched',async()=>{
    assert(backupPath,'Successful UI backup required');
    await app.evaluate((_e,{backup})=>{process.env.OMNI_EDU_E2E_RESTORE_SOURCE_QUEUE=JSON.stringify(['',backup,backup]);process.env.OMNI_EDU_E2E_RESTORE_TARGET_QUEUE=JSON.stringify(['',process.env.OMNI_EDU_DATA_ROOT.replace(/data$/,'restore')]);},{backup:backupPath});
    for(let i=0;i<2;i++){await page.getByTestId('data-backup-restore').click();await page.getByTestId('data-backup-cancelled').waitFor();assert.equal(await page.evaluate(()=>window.omniEdu.getDataRoot()),data);assert.deepEqual(fs.readdirSync(path.join(output,'restore')),[]);}
    await shot('11-restore-cancel');
  });
  await check('X07-restore-preview','Prepare real separate restore copy, preview impact and leave without activation',async()=>{
    await page.getByTestId('data-backup-restore').click();await page.getByTestId('data-backup-restore-ready').waitFor({timeout:60000});
    const text=await page.getByTestId('data-backup-restore-ready').innerText();assert.match(text,/原目录保留/);assert.match(text,/旧任务不会自动继续/);assert(await page.getByTestId('data-backup-restore-activate').isVisible());
    const dirs=fs.readdirSync(path.join(output,'restore'));assert.equal(dirs.length,1);
    report.restoreCopy=await page.getByTestId('data-backup-restore-ready').locator('.pi-settings-location').innerText();
    assert.equal(path.resolve(report.restoreCopy),path.join(output,'restore',dirs[0],'OmniEduData'));
    assert(fs.existsSync(path.join(report.restoreCopy,'app.db')));
    const receipt=JSON.parse(fs.readFileSync(path.join(report.restoreCopy,'xiaozhi-recovery.v1.json'),'utf8'));assert.equal(receipt.dataRoot,report.restoreCopy);assert.equal(receipt.backupPath,backupPath);
    const restoredDb=new DatabaseSync(path.join(report.restoreCopy,'app.db'),{readOnly:true});try{assert.equal(restoredDb.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{restoredDb.close();}
    await captureRestoreLedger(report.restoreCopy,backupPath);
    assert.equal(await page.evaluate(()=>window.omniEdu.getDataRoot()),data);
    assert.equal(fs.readFileSync(path.join(backupPath,'omni-edu-backup-manifest.v1.json'),'utf8'),backupHash);await shot('12-restore-preview');await tab('interface');
  });
  await check('A17-X07-cold','Cold launch preserves preferences, original active root, authority and no restore activation',async()=>{
    ({app,page}=await relaunch());assert.equal(await page.evaluate(()=>window.omniEdu.getDataRoot()),data);
    assert.equal(await page.locator('[data-testid="edu-navigation"]:visible').getAttribute('data-collapsed'),'true');assert.equal(await page.getByTestId('pi-files-toggle').getAttribute('aria-pressed'),'false');assert.deepEqual(await auth(),authority);
    await open();await tab('interface');for(const [n,v] of [['sidebar',false],['aside',false],['files',true]])assert.equal(await page.getByTestId('pi-preference-'+n).getAttribute('data-selected')==='true',v);
    await shot('13-cold-preferences');await tab('backup');assert.equal(await page.getByTestId('data-backup-restore-ready').count(),0);assert.equal(await page.getByTestId('data-backup-restore-revert').count(),0);await shot('14-cold-backup');
  });
  if(restoreActivation){
    let activatedRoot;
    const selectionPath=path.join(profile,'xiaozhi-data-selection.v1.json');
    const selection=()=>JSON.parse(fs.readFileSync(selectionPath,'utf8'));
    const waitSelection=async(root)=>{
      // Read-only polling observes the original UI's persisted selection, never writes it.
      // Playwright 1.62 treats an async waitForFunction predicate's Promise as truthy,
      // even when it resolves false. Await each IPC read before deciding to poll again.
      const deadline=Date.now()+12000;
      while(true){
        const status=await page.evaluate(()=>window.omniEdu.backupRestoreStatus());
        if(status.dataRoot===root)break;
        assert(Date.now()<deadline,'Timed out waiting for persisted backup selection: '+root);
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      const value=selection();assert.equal(value.baseRoot,data);assert.equal(value.dataRoot,root);
      assert.equal(await page.evaluate(()=>window.omniEdu.getDataRoot()),root===data?activatedRoot:data);
    };
    await check('X07-restore-activation','Original UI selects a verified owned copy without restarting another app',async()=>{
      assert(backupPath,'Successful UI backup required');
      const target=path.join(output,'restore-activation');fs.mkdirSync(target);
      assert.equal(await app.evaluate(()=>process.env.OMNI_EDU_E2E_RESTORE_RELAUNCH),'manual');
      await app.evaluate((_e,{backup,target})=>{process.env.OMNI_EDU_E2E_RESTORE_SOURCE_QUEUE=JSON.stringify([backup]);process.env.OMNI_EDU_E2E_RESTORE_TARGET_QUEUE=JSON.stringify([target]);},{backup:backupPath,target});
      await page.getByTestId('data-backup-restore').click();await page.getByTestId('data-backup-restore-ready').waitFor({timeout:60000});
      activatedRoot=fs.realpathSync(await page.getByTestId('data-backup-restore-ready').locator('.pi-settings-location').innerText());
      const relative=path.relative(fs.realpathSync(target),activatedRoot);assert(relative&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep));
      await captureRestoreLedger(activatedRoot,backupPath);
      await page.getByTestId('data-backup-restore-activate').click();await waitSelection(activatedRoot);
      assert.equal(selection().previousRoot,data);report.activatedRestoreCopy=activatedRoot;
      await shot('15-activation-selected');
    });
    await check('X07-restore-activation-cold','Cold launch uses restored data with preserved authority',async()=>{
      assert(activatedRoot,'Activation copy required');assert.equal(selection().dataRoot,activatedRoot);
      ({app,page}=await relaunch(activatedRoot));assert.deepEqual(await auth(),authority);
      const db=new DatabaseSync(path.join(activatedRoot,'app.db'),{readOnly:true});try{assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');}finally{db.close();}
      await open();await tab('backup');await page.getByTestId('data-backup-restore-revert').waitFor();await shot('16-activation-cold');
    });
    await check('X07-restore-revert-cold','Original UI reverts selection and cold launch returns to original data',async()=>{
      assert.equal(await page.evaluate(()=>window.omniEdu.getDataRoot()),activatedRoot);
      await page.getByTestId('data-backup-restore-revert').click();await waitSelection(data);assert.equal(selection().previousRoot,activatedRoot);
      ({app,page}=await relaunch());assert.deepEqual(await auth(),authority);
      assert.equal(fs.readFileSync(path.join(backupPath,'omni-edu-backup-manifest.v1.json'),'utf8'),backupHash);
      assert(fs.existsSync(path.join(activatedRoot,'app.db')));await open();await tab('backup');await shot('17-revert-cold');
    });
  }
}
