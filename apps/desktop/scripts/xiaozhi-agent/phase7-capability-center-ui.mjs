import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {expect} from 'playwright/test';
import {fingerprint, sha256} from '../acceptance/evidence.mjs';
import {assertIsolatedPiMain, testMain} from '../acceptance/build-root.mjs';
import {startWorkbenchFixture} from './phase7-workbench-fixture.mjs';

const main = testMain(process.cwd());
const buildRoot = path.dirname(path.dirname(main));
const beforeBuild = fingerprint(buildRoot);
const report = {
  success:false, paidCalls:0, checks:[], pageErrors:[],
  build:{sha256:beforeBuild.sha256, files:beforeBuild.files.length, mainSha256:sha256(fs.readFileSync(main))},
};
let fixture;
const tables = ['xiaozhi_capability_registry_v1','xiaozhi_capability_provider_versions_v1',
  'xiaozhi_acquisition_candidates_v1','ai_agent_runs','ai_confirmation_items','xiaozhi_permission_grants_v1'];

function facts(root) {
  const db = new DatabaseSync(path.join(root,'data','app.db'),{readOnly:true});
  try {
    return Object.fromEntries(tables.map(table=>{
      const rows = db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all();
      return [table, sha256(JSON.stringify(rows))];
    }));
  } finally { db.close(); }
}

try {
  fixture = await startWorkbenchFixture({background:true, capabilityControls:true, onPageError:error=>report.pageErrors.push(error.message)});
  const {page, application, root, output, ids} = fixture;
  await assertIsolatedPiMain(application, main, path.join(root,'profile'));
  const {controlName, candidateName, missingRequired, missingOptional, eligible} = ids.capabilityControls;
  const checkBefore = facts(root);
  const requestsBefore = fixture.requests.length;
  const center = page.getByTestId('pi-capability-center');
  const rows = center.getByTestId('pi-capability-row');
  const search = center.getByTestId('pi-capability-search');

  async function find(query, count) {
    await search.fill(query);
    await search.press('Enter');
    await expect(rows).toHaveCount(count);
    await expect(rows.filter({hasText:query})).toHaveCount(count);
  }

  async function expand(card) {
    const button = card.getByRole('button',{name:'来源与核验详情'});
    await button.scrollIntoViewIfNeeded();
    const bounds = await button.boundingBox();
    assert(bounds && bounds.width>0 && bounds.height>0);
    assert(bounds.x>=0 && bounds.x+bounds.width<=await page.evaluate(()=>innerWidth));
    await button.press('Enter');
    return button;
  }

  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByTestId('pi-settings-tab-capabilities').click();
  await center.waitFor();
  for (const size of [{width:1366,height:768},{width:1920,height:1080}]) {
    const label = size.width + 'x' + size.height;
    await application.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),size);
    await page.setViewportSize(size);
    assert.deepEqual(await page.evaluate(()=>({width:innerWidth,height:innerHeight})),size);

    await find('本地文件元信息',2);
    const full = rows.filter({hasText:'满足当前能力要求'});
    const conditional = rows.filter({hasText:'#workspace'});
    await expect(full).toHaveCount(1);
    await expect(full).toContainText('随应用提供');
    await expect(full).toContainText('已核验');
    await expect(full).toContainText('需任务核对');
    await expect(conditional).toContainText('缺少 1 项可选能力');
    await expect(conditional).not.toContainText('项必需能力');
    await expect(conditional.getByTestId('pi-capability-conditional')).toHaveText('按任务核对 1 项条件要求');
    const builtInDetails = await expand(conditional);
    await expect(conditional.getByTestId('pi-capability-conditional-detail')).toContainText('mime_required');
    await expect(conditional).toContainText('来源指纹');
    await expect(conditional).toContainText('可选项 mime');
    await page.screenshot({path:path.join(output,'native-providers-'+label+'.png')});
    await builtInDetails.press('Enter');
    report.checks.push({size:label, name:'Built-in providers separate conformance, task conditions, and missing optional metadata'});

    await find(controlName,2);
    const blocked = rows.filter({hasText:'当前不可用'});
    const partial = rows.filter({hasText:'部分能力可用'});
    await expect(blocked).toContainText('缺少 1 项必需能力');
    await expect(partial).toContainText('缺少 1 项可选能力');
    await expect(partial).not.toContainText('项必需能力');
    await expand(blocked);
    await expect(blocked).toContainText('必需项 file_metadata');
    await expect(blocked).toContainText(missingRequired);
    await expand(partial);
    await expect(partial).toContainText('可选项 mime');
    await expect(partial).toContainText(missingOptional);
    assert(!eligible.includes(missingRequired) && eligible.includes(missingOptional));
    await page.screenshot({path:path.join(output,'requirements-'+label+'.png')});
    report.checks.push({size:label, name:'Required-gap provider is excluded by the resolver and blocked on the page; optional-gap provider remains selectable'});

    await find(candidateName,1);
    const candidate = rows.first();
    await expect(candidate).toContainText('未安装');
    await expect(candidate).toContainText('待核验');
    await expect(candidate).toContainText('当前不可用');
    await expect(candidate).not.toContainText('已核验');
    await expect(candidate).not.toContainText('当前任务已授权');
    await expand(candidate);
    await expect(candidate).toContainText('候选来源需要审核');
    await page.screenshot({path:path.join(output,'candidate-'+label+'.png')});
    report.checks.push({size:label, name:'Reviewed cached descriptor stays uninstalled, unverified and blocked'});
  }

  assert.deepEqual(facts(root),checkBefore);
  assert.equal(fixture.requests.length,requestsBefore);
  assert.deepEqual(report.pageErrors,[]);
  report.readOnlyVerified = true;
  report.modelRequestsFromReads = fixture.requests.length-requestsBefore;
  const finalBuild = fingerprint(buildRoot);
  assert.deepEqual(finalBuild,beforeBuild);
  report.success = true;
} catch (error) {
  process.exitCode = 1;
  report.error = String(error.stack || error);
  if (fixture) await fixture.page.screenshot({path:path.join(fixture.output,'capability-failure.png')}).catch(()=>{});
} finally {
  if (fixture) {
    report.root = fixture.root;
    await fixture.close().catch(error=>{report.closeError=String(error);report.success=false;process.exitCode=1;});
    fs.writeFileSync(path.join(fixture.output,'capability-center-report.json'),JSON.stringify(report,null,2));
  }
  console.log(JSON.stringify(report));
}
