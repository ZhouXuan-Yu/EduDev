import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const { createXiaozhiSessionState } = await import('../../src/main/xiaozhi-agent/session-state.ts');
const { createXiaozhiProductionHost } = await import('../../src/main/xiaozhi-agent/production-host.ts');
const { createSkillManagementApi, registerSkillManagementIpc } = await import('../../src/main/xiaozhi-agent/skill-management-api.ts');
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), tests = path.join(desktop, 'test-results/xiaozhi-agent');
const sourceDb = path.join(tests, 'pi-control-ui-2AWPBO/data/app.db'), digest = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const originalHash = digest(sourceDb), output = fs.mkdtempSync(path.join(tests, 'pi-skill-api-')); fs.copyFileSync(sourceDb, path.join(output, 'app.db'));
const db = new DatabaseSync(path.join(output, 'app.db'));
const state = createXiaozhiSessionState({ run: async (sql, values = []) => db.prepare(sql).run(...values), change: async (sql, values = []) => Number(db.prepare(sql).run(...values).changes), all: async (sql, values = []) => db.prepare(sql).all(...values) });
const checks = [], report = { suite: 'pi-skill-management-api', success: false, checks, boundaries: ['Actual host/state/native skill package with disposable old DB copy', 'Registered IPC handlers and main-frame authorization injected; no Electron/provider claim'] };
const check = async (name, fn) => { await fn(); checks.push({ name, pass: true }); };
let host;
try {
  await state.init(); host = createXiaozhiProductionHost({ store: { xiaozhiState: state }, dataRoot: output, emit: () => assert.fail('No model operation expected') });
  let chooseCount = 0, chooser = async () => { chooseCount++; return undefined; };
  const api = createSkillManagementApi(host, () => chooser());
  await check('Immediate preview waits for real initialization and returns full registered builtin instructions', async () => { const result = await api.preview({ name: 'lesson-preparation' }); assert(result.ok); assert(result.value.document.includes('备课流程')); });
  let catalog = (await api.catalog()).value;
  await check('Public catalog projects only explicit safe fields, never pointers or private hashes', async () => { assert.equal(catalog.skills.length, 4); assert(!catalog.locked); assert.deepEqual(Object.keys(catalog.skills[0]).sort(), ['name','title','description','origin','version','enabled','archived'].sort()); assert(!JSON.stringify(catalog).includes(output)); });
  await check('Catalog and preview reject path/session overrides and extra fields', async () => { assert.equal((await api.catalog({})).error, 'invalid_input'); for (const value of [null, {name:'../escape'}, {name:'lesson-preparation',path:output}, {name:'lesson-preparation',revision:1}]) assert.equal((await api.preview(value)).error, 'invalid_input'); });
  await check('All mutation schemas reject renderer paths, unknown actions, coerced revision and extra enabled/edit fields before chooser', async () => {
    for (const input of [null, {}, {action:'import',revision:1,path:output}, {action:'enable',revision:'1',name:'lesson-preparation',enabled:true}, {action:'enable',revision:1,name:'lesson-preparation',enabled:1}, {action:'edit',revision:1,name:'lesson-preparation',document:'x',enabled:true}, {action:'archive',revision:1,name:'lesson-preparation',directory:output}, {action:'delete',revision:1,name:'lesson-preparation'}, {action:'edit',revision:1,name:'lesson-preparation',document:'文'.repeat(11000)}, {action:'edit',revision:1,name:'lesson-preparation',document:'x\0'}]) assert.equal((await api.mutate(input)).error, 'invalid_input');
    assert.equal(chooseCount, 0);
  });
  await check('Stale import returns fixed error before opening native chooser', async () => { assert.equal((await api.mutate({action:'import',revision:catalog.revision+1})).error,'stale_version'); assert.equal(chooseCount,0); });
  await check('Native cancel keeps exact SQLite metadata and releases global lock', async () => { const before = await state.skillCatalog(), result = await api.mutate({action:'import',revision:catalog.revision}); assert(result.ok && result.value.cancelled); assert.deepEqual(await state.skillCatalog(),before); assert(!host.skillManagementBusy()); });
  const source = path.join(output, 'explicit-package'); fs.mkdirSync(source); const document = '---\nname: office-review\ndescription: 教学会议草稿复核\n---\n# 会议复核\n仅复核必要文本，写出建议。\n'; fs.writeFileSync(path.join(source,'SKILL.md'),document);
  chooser = async () => { chooseCount++; return source; };
  const imported = await api.mutate({action:'import',revision:catalog.revision}); assert(imported.ok); catalog = imported.value.catalog;
  await check('Registered directory import defaults off and projection contains no selected host path', async () => { assert(!catalog.skills.find(item=>item.name==='office-review').enabled); assert(!JSON.stringify(imported).includes(source)); assert.equal(fs.readFileSync(path.join(source,'SKILL.md'),'utf8'),document); });
  await check('Builtin edit/archive refuse fixed permission without disclosing internals', async () => { for (const input of [{action:'edit',revision:catalog.revision,name:'lesson-preparation',document}, {action:'archive',revision:catalog.revision,name:'lesson-preparation'}]) assert.equal((await api.mutate(input)).error,'permission_denied'); });
  const on = await api.mutate({action:'enable',name:'office-review',enabled:true,revision:catalog.revision}); assert(on.ok); catalog=on.value.catalog;
  await check('Explicit enable commits one revision and stale repeats never toggle the current state', async () => { const stale=await api.mutate({action:'enable',name:'office-review',enabled:false,revision:catalog.revision-1}); assert.equal(stale.error,'stale_version'); assert((await api.catalog()).value.skills.find(item=>item.name==='office-review').enabled); });
  const edited=await api.mutate({action:'edit',name:'office-review',document:document.replace('复核必要文本','复核新的必要文本'),revision:catalog.revision}); assert(edited.ok); catalog=edited.value.catalog;
  await check('Edit publishes distinct disabled version while original selected source remains unchanged', async () => { const item=catalog.skills.find(item=>item.name==='office-review'); assert.equal(item.version,2); assert(!item.enabled); assert.equal(fs.readFileSync(path.join(source,'SKILL.md'),'utf8'),document); });
  const privateItem=(await state.skillCatalog()).skills.find(item=>item.name==='office-review'); fs.appendFileSync(path.join(output,'xiaozhi-pi/skills',privateItem.directory,'SKILL.md'),'\nchanged');
  await check('Invalid source refuses activation but can be explicitly disabled to recover work', async () => { assert.equal((await api.mutate({action:'enable',name:'office-review',enabled:true,revision:catalog.revision})).error,'skill_source_changed'); const off=await api.mutate({action:'enable',name:'office-review',enabled:false,revision:catalog.revision}); assert(off.ok); catalog=off.value.catalog; });
  const handlers=new Map(); registerSkillManagementIpc({ipcMain:{handle:(channel,fn)=>handlers.set(channel,fn)},allowed:event=>event.main===true,host,choose:()=>chooser()});
  await check('All three actual registered handlers reject foreign frame before any operation', async () => { const before=await state.skillCatalog(), count=chooseCount; assert.equal(handlers.size,3); for(const fn of handlers.values())assert.equal((await fn({main:false},{action:'import',revision:catalog.revision})).error,'permission_denied'); assert.deepEqual(await state.skillCatalog(),before); assert.equal(chooseCount,count); });
  await check('Registered main-frame catalog shares projected contract and validates payloads', async () => { const fn=handlers.get('xiaozhi:skill-catalog'); assert((await fn({main:true})).ok); assert.equal((await fn({main:true},{})).error,'invalid_input'); });
  await check('Owned chooser lock is projected and rejects concurrent operations', async () => {
    let release, enteredResolve; const entered=new Promise(resolve=>{enteredResolve=resolve;}); chooser=()=>new Promise(resolve=>{release=resolve;enteredResolve();});
    const pending=api.mutate({action:'import',revision:catalog.revision}); await entered;
    assert((await api.catalog()).value.locked); assert.equal((await api.mutate({action:'archive',revision:catalog.revision,name:'office-review'})).error,'busy');
    release(undefined); const result=await pending; assert(result.ok && result.value.cancelled); assert(!(await api.catalog()).value.locked);
  });
  await check('Explicit old test database source is byte-identical after full main API exercise', async () => assert.equal(digest(sourceDb),originalHash));
  report.success=true;
} catch(error) { report.error=String(error.stack||error).slice(0,2000); process.exitCode=1; }
finally { await host?.close().catch(()=>{}); db.close(); fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify({success:report.success,checks:checks.length,error:report.error,report:path.relative(desktop,path.join(output,'report.json'))})); }
