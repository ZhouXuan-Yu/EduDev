import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const { createPiSkillCatalogState, SKILL_LIMITS } = await import('../../src/main/xiaozhi-agent/skill-catalog-state.ts');
const { createManagedEducationSkills } = await import('../../src/main/xiaozhi-agent/managed-skills.ts');
const { createXiaozhiSessionState } = await import('../../src/main/xiaozhi-agent/session-state.ts');
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'), tests = fs.realpathSync(path.join(desktop, 'test-results/xiaozhi-agent'));
const output = fs.mkdtempSync(path.join(tests, 'pi-skills-management-state-'));
const checks = [], report = { suite: 'pi-skills-management-state', success: false, checks, boundaries: [
  'Catalog tests only; management IPC/UI/provider acceptance not covered by this suite',
  'Actual SQLite/files and Pi parser, synthetic teacher packages; no provider calls',
  'Explicit disposable old DB copy; source/business facts are read-only',
] };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const check = async (name, fn) => { await fn(); checks.push({ name, pass: true }); };
const connection = db => ({ run: async (sql, values = []) => db.prepare(sql).run(...values),
  change: async (sql, values = []) => Number(db.prepare(sql).run(...values).changes), all: async (sql, values = []) => db.prepare(sql).all(...values) });
const document = (name, marker = '只起草正文；引用实际资料，不执行脚本。') => `---\nname: ${name}\ndescription: 教师本地教学办公流程\ndefault-enabled: true\n---\n\n# 自定义教学办公\n\n${marker}\n`;
const packageAt = (label, text = document(label)) => {
  const dir = path.join(output, 'imports', label); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), text); return dir;
};
const root = path.join(output, 'managed'), database = path.join(output, 'catalog.db');
let db, busy = false;
try {
  db = new DatabaseSync(database);
  let state = createPiSkillCatalogState(connection(db));
  let manager = createManagedEducationSkills({ root, state, assertIdle: () => { if (busy) throw new Error('busy'); } });
  let catalog = await manager.initialize();
  await check('Fresh catalog seeds four builtin native Skills and initialization is idempotent', async () => {
    assert.equal(catalog.revision, 1); assert.equal(catalog.skills.length, 4); assert(catalog.skills.every(item => item.enabled && item.origin === 'builtin'));
    assert.deepEqual(await manager.initialize(), catalog); assert.equal((await manager.enabledResources()).resources.length, 4);
  });
  const builtin = catalog.skills[0];
  await check('Builtin source is immutable to edit/archive; turning off is revisioned', async () => {
    await assert.rejects(manager.edit(builtin.name, catalog.revision, document(builtin.name)), /permission_denied/);
    await assert.rejects(manager.archive(builtin.name, catalog.revision), /permission_denied/);
    catalog = await manager.setEnabled(builtin.name, catalog.revision, false);
    assert.equal((await manager.enabledResources()).resources.length, 3);
    catalog = await manager.setEnabled(builtin.name, catalog.revision, true);
  });
  const name = 'teacher-office', source = packageAt(name, document(name, `验收代号：${randomUUID()}。只整理教学文稿。`));
  fs.mkdirSync(path.join(source, 'references')); fs.writeFileSync(path.join(source, 'references/guide.md'), '教学文稿引用示例。');
  fs.writeFileSync(path.join(source, 'helper.py'), 'raise RuntimeError("must never execute")\n');
  const original = hash(fs.readFileSync(path.join(source, 'SKILL.md'))), reference = hash(fs.readFileSync(path.join(source, 'references/guide.md')));
  catalog = await manager.importDirectory(source, catalog.revision);
  let custom = catalog.skills.find(item => item.name === name);
  await check('Explicit folder import preserves source and scripts as local bytes; it is disabled regardless of frontmatter', async () => {
    assert(!custom.enabled); assert.equal(custom.version, 1); assert.equal(custom.files.length, 3);
    assert.equal(hash(fs.readFileSync(path.join(source, 'SKILL.md'))), original);
    assert.equal(hash(fs.readFileSync(path.join(source, 'references/guide.md'))), reference);
    assert.equal((await manager.enabledResources()).resources.length, 4);
    const preview = await manager.preview(name); assert.equal(preview.document, fs.readFileSync(path.join(source, 'SKILL.md'), 'utf8'));
  });
  await check('Duplicate active names and builtin collisions reject without overwriting catalog or sources', async () => {
    const before = await manager.catalog(); await assert.rejects(manager.importDirectory(source, catalog.revision), /skill_exists/);
    const clash = packageAt('builtin-clash', document(builtin.name));
    await assert.rejects(manager.importDirectory(clash, catalog.revision), /skill_exists/);
    assert.deepEqual(await manager.catalog(), before);
  });
  catalog = await manager.setEnabled(name, catalog.revision, true);
  await check('Enable produces a verified native descriptor without changing original metadata or source bytes', async () => {
    const resources = (await manager.enabledResources()).resources;
    assert.equal(resources.length, 5); assert(resources.find(item => item.skill.name === name));
    assert.equal(hash(fs.readFileSync(path.join(source, 'SKILL.md'))), original);
  });
  await check('Stale edits and renaming cannot overwrite the current version', async () => {
    await assert.rejects(manager.edit(name, catalog.revision - 1, document(name)), /stale_version/);
    await assert.rejects(manager.edit(name, catalog.revision, document('renamed-office')), /invalid_input/);
    assert.deepEqual(await manager.catalog(), catalog);
  });
  const previous = custom.directory, previousHash = hash(fs.readFileSync(path.join(root, previous, 'SKILL.md')));
  catalog = await manager.edit(name, catalog.revision, document(name, '新版本：按实际资料编写教研会议纪要。'));
  custom = catalog.skills.find(item => item.name === name);
  await check('Editing writes a new immutable version, copies references, resets enabled, and preserves prior/original bytes', async () => {
    assert.equal(custom.version, 2); assert.notEqual(custom.directory, previous); assert(!custom.enabled);
    assert.equal(hash(fs.readFileSync(path.join(root, previous, 'SKILL.md'))), previousHash);
    assert.equal(hash(fs.readFileSync(path.join(root, custom.directory, 'references/guide.md'))), reference);
    assert.equal(hash(fs.readFileSync(path.join(source, 'SKILL.md'))), original);
    assert((await manager.preview(name)).document.includes('新版本'));
  });
  await check('Local manager and main idle guard reject concurrent/active mutations', async () => {
    busy = true; await assert.rejects(manager.setEnabled(name, catalog.revision, true), /busy/); busy = false;
    const outcomes = await Promise.allSettled([manager.setEnabled(name, catalog.revision, true), manager.archive(name, catalog.revision)]);
    assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
    assert.match(String(outcomes.find(item => item.status === 'rejected').reason), /busy/); catalog = await manager.catalog();
  });
  await check('Changed registered reference fails preview/enable; disable and archive still succeed without rewriting source', async () => {
    const referencePath = path.join(root, custom.directory, 'references/guide.md'); fs.writeFileSync(referencePath, 'changed');
    await assert.rejects(manager.preview(name), /skill_source_changed/);
    await assert.rejects(manager.enabledResources(), /skill_source_changed/);
    await assert.rejects(manager.setEnabled(name, catalog.revision, true), /skill_source_changed/);
    catalog = await manager.setEnabled(name, catalog.revision, false);
    assert.equal((await manager.enabledResources()).resources.length, 4);
    catalog = await manager.archive(name, catalog.revision); assert(catalog.skills.find(item => item.name === name).archived);
    assert.equal(fs.readFileSync(referencePath, 'utf8'), 'changed');
  });
  catalog = await manager.importDirectory(source, catalog.revision);
  await check('Explicit reimport of archived custom package increments version and remains disabled', async () => {
    custom = catalog.skills.find(item => item.name === name); assert.equal(custom.version, 3); assert(!custom.enabled && !custom.archived);
    assert.equal(hash(fs.readFileSync(path.join(root, previous, 'SKILL.md'))), previousHash);
  });
  await check('Reopen persists revisions/files/enabled states and native metadata', async () => {
    db.close(); db = new DatabaseSync(database); state = createPiSkillCatalogState(connection(db));
    manager = createManagedEducationSkills({ root, state, assertIdle: () => { if (busy) throw new Error('busy'); } });
    assert.deepEqual(await manager.initialize(), catalog); assert.equal((await manager.enabledResources()).resources.length, 4);
    assert.equal((await manager.preview(name)).version, 3);
  });
  await check('Missing teacher instruction is not recreated, and external source is never a fallback grant', async () => {
    const currentFile = path.join(root, custom.directory, 'SKILL.md'); fs.renameSync(currentFile, `${currentFile}.removed`);
    await assert.rejects(manager.preview(name), /invalid_input|skill_source_changed/);
    await assert.rejects(manager.setEnabled(name, catalog.revision, true), /invalid_input|skill_source_changed/);
    assert(!fs.existsSync(currentFile)); fs.renameSync(`${currentFile}.removed`, currentFile);
  });
  const beforeInvalid = await manager.catalog();
  await check('No implicit subfolder/neighbor discovery and invalid native metadata/name/UTF-8 reject', async () => {
    const absent = path.join(output, 'no-root-skill'); fs.mkdirSync(path.join(absent, 'child'), { recursive: true }); fs.writeFileSync(path.join(absent, 'child/SKILL.md'), document('hidden-child'));
    await assert.rejects(manager.importDirectory(absent, catalog.revision), /invalid_input/);
    for (const [label, content] of [['upper-name', document('Bad_Name')], ['missing-desc', '---\nname: missing-desc\n---\n\nhello'], ['empty-body', '---\nname: empty-body\ndescription: example\n---\n']]) {
      await assert.rejects(manager.importDirectory(packageAt(label, content), catalog.revision), /invalid_input/);
    }
    const invalidUtf = packageAt('invalid-utf'); fs.writeFileSync(path.join(invalidUtf, 'SKILL.md'), Buffer.from([0xff, 0xfe, 0xff]));
    await assert.rejects(manager.importDirectory(invalidUtf, catalog.revision), /invalid_input/); assert.deepEqual(await manager.catalog(), beforeInvalid);
  });
  await check('SKILL/file/count/total/depth/empty-directory bounds reject before metadata publication', async () => {
    const bigSkill = packageAt('big-skill', document('big-skill', 'x'.repeat(SKILL_LIMITS.instructionBytes)));
    await assert.rejects(manager.importDirectory(bigSkill, catalog.revision), /invalid_input/);
    const bigFile = packageAt('big-file'); fs.writeFileSync(path.join(bigFile, 'file.bin'), Buffer.alloc(SKILL_LIMITS.fileBytes + 1));
    await assert.rejects(manager.importDirectory(bigFile, catalog.revision), /invalid_input/);
    const many = packageAt('many-files'); for (let i = 0; i < 64; i++) fs.writeFileSync(path.join(many, `file-${i}.txt`), 'x');
    await assert.rejects(manager.importDirectory(many, catalog.revision), /invalid_input/);
    const total = packageAt('total-bytes'); for (let i = 0; i < 8; i++) fs.writeFileSync(path.join(total, `file-${i}.bin`), Buffer.alloc(SKILL_LIMITS.fileBytes));
    await assert.rejects(manager.importDirectory(total, catalog.revision), /invalid_input/);
    const deep = packageAt('deep'); fs.mkdirSync(path.join(deep, 'a/b/c/d/e'), { recursive: true });
    await assert.rejects(manager.importDirectory(deep, catalog.revision), /invalid_input/);
    const manyDirs = packageAt('many-dirs'); for (let i = 0; i < 129; i++) fs.mkdirSync(path.join(manyDirs, `dir-${i}`));
    await assert.rejects(manager.importDirectory(manyDirs, catalog.revision), /invalid_input/);
    assert.deepEqual(await manager.catalog(), beforeInvalid);
  });
  await check('Directory junction inside package and symlink ancestor refuse; outside bytes are untouched', async () => {
    const outside = path.join(output, 'outside'); fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'secret.txt'), 'outside-local-only');
    const linkPackage = packageAt('link-package'); fs.symlinkSync(outside, path.join(linkPackage, 'reference-link'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(manager.importDirectory(linkPackage, catalog.revision), /skill_source_changed/);
    const ancestor = path.join(output, 'linked-imports'); fs.symlinkSync(path.join(output, 'imports'), ancestor, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(manager.importDirectory(path.join(ancestor, name), catalog.revision), /skill_source_changed/);
    assert.throws(() => createManagedEducationSkills({ root: path.join(ancestor, 'managed-root'), state, assertIdle: () => {} }), /skill_source_changed/);
    assert.equal(fs.readFileSync(path.join(outside, 'secret.txt'), 'utf8'), 'outside-local-only');
    assert(!fs.existsSync(path.join(output, 'imports/managed-root')));
  });
  await check('Windows-invalid and case-colliding stored paths, duplicate names and extra grants reject', async () => {
    for (const relative of ['../outside', 'folder/../SKILL.md', 'C:/host', 'guide.md:secret', 'CON.txt', 'reference/aux', 'folder/file.']) {
      const bad = structuredClone(catalog.skills); bad[0].files.push({ relative, size: 1, sha256: 'a'.repeat(64) });
      await assert.rejects(state.saveSkillCatalog(catalog.revision, bad), /invalid_input/);
    }
    const cases = structuredClone(catalog.skills); cases[0].files.push({ ...cases[0].files[0], relative: 'skill.md' });
    await assert.rejects(state.saveSkillCatalog(catalog.revision, cases), /invalid_input/);
    await assert.rejects(state.saveSkillCatalog(catalog.revision, [...catalog.skills, catalog.skills[0]]), /invalid_input/);
    const extras = structuredClone(catalog.skills); extras[0].shell = true;
    await assert.rejects(state.saveSkillCatalog(catalog.revision, extras), /invalid_input/);
    const directory = structuredClone(catalog.skills); directory[0].directory = '../elsewhere';
    await assert.rejects(state.saveSkillCatalog(catalog.revision, directory), /invalid_input/);
  });
  await check('Two independent state writers with same CAS revision have exactly one winner', async () => {
    const snapshot = await state.skillCatalog(), other = createPiSkillCatalogState(connection(db));
    const result = await Promise.all([state.saveSkillCatalog(snapshot.revision, snapshot.skills), other.saveSkillCatalog(snapshot.revision, snapshot.skills)]);
    assert.equal(result.filter(Boolean).length, 1); catalog = await manager.catalog();
  });
  await check('Future schema and malformed persisted metadata cannot be read or overwritten', async () => {
    const row = db.prepare('SELECT * FROM xiaozhi_pi_skill_catalog').get();
    db.prepare('UPDATE xiaozhi_pi_skill_catalog SET schema_version=2').run();
    await assert.rejects(state.skillCatalog(), /configuration/); await assert.rejects(state.saveSkillCatalog(catalog.revision, catalog.skills), /configuration/);
    db.prepare('UPDATE xiaozhi_pi_skill_catalog SET schema_version=1,payload_json=?').run('{broken');
    await assert.rejects(state.skillCatalog(), /configuration/);
    db.prepare('UPDATE xiaozhi_pi_skill_catalog SET payload_json=?').run(JSON.stringify({ skills: catalog.skills, scripts: true }));
    await assert.rejects(state.skillCatalog(), /configuration/);
    db.prepare('UPDATE xiaozhi_pi_skill_catalog SET payload_json=?').run(row.payload_json);
  });
  await check('Persisted metadata cannot replace builtin reviewed bytes or relabel teacher package as builtin', async () => {
    const row = db.prepare('SELECT payload_json FROM xiaozhi_pi_skill_catalog').get();
    const altered = structuredClone(catalog.skills); altered[0].files[0].sha256 = 'b'.repeat(64);
    db.prepare('UPDATE xiaozhi_pi_skill_catalog SET payload_json=?').run(JSON.stringify({ skills: altered }));
    await assert.rejects(manager.catalog(), /configuration/); await assert.rejects(manager.enabledResources(), /configuration/);
    const relabel = structuredClone(catalog.skills); relabel.find(item => item.name === name).origin = 'builtin';
    db.prepare('UPDATE xiaozhi_pi_skill_catalog SET payload_json=?').run(JSON.stringify({ skills: relabel }));
    await assert.rejects(manager.initialize(), /configuration/);
    db.prepare('UPDATE xiaozhi_pi_skill_catalog SET payload_json=?').run(row.payload_json);
  });
  await check('CAS-lost copied version is inert and never auto-discovered', async () => {
    const lost = createManagedEducationSkills({ root, state: { ...state, saveSkillCatalog: async () => false }, assertIdle: () => {} });
    const orphan = packageAt('orphan-office'); await assert.rejects(lost.importDirectory(orphan, catalog.revision), /stale_version/);
    assert(fs.existsSync(path.join(root, 'versions/orphan-office')));
    assert(!(await manager.catalog()).skills.some(item => item.name === 'orphan-office'));
    assert(!(await manager.enabledResources()).resources.some(item => item.skill.name === 'orphan-office'));
  });
  await check('Source modified during version copy rejects publication and preserves both source and existing catalog', async () => {
    const moving = packageAt('moving-office'), before = await manager.catalog();
    const originalWrite = fs.writeFileSync; let changed = false;
    fs.writeFileSync = function (file, ...args) {
      const result = originalWrite.call(fs, file, ...args);
      if (!changed && String(file).startsWith(path.join(root, 'versions/moving-office'))) {
        changed = true; originalWrite(path.join(moving, 'SKILL.md'), document('moving-office', '源在复制过程中发生变化。'));
      }
      return result;
    };
    try { await assert.rejects(manager.importDirectory(moving, catalog.revision), /skill_source_changed/); }
    finally { fs.writeFileSync = originalWrite; }
    assert(changed); assert.deepEqual(await manager.catalog(), before);
    assert(fs.readFileSync(path.join(moving, 'SKILL.md'), 'utf8').includes('发生变化'));
    assert(!(await manager.enabledResources()).resources.some(item => item.skill.name === 'moving-office'));
  });
  await check('Failed fresh-version write remains unpublished; retry creates its own valid version without deleting source', async () => {
    const partial = packageAt('partial-office'), before = await manager.catalog(), originalWrite = fs.writeFileSync;
    fs.writeFileSync = function (file, ...args) {
      if (String(file).startsWith(path.join(root, 'versions/partial-office'))) throw new Error('controlled_write_failure');
      return originalWrite.call(fs, file, ...args);
    };
    try { await assert.rejects(manager.importDirectory(partial, catalog.revision), /controlled_write_failure/); }
    finally { fs.writeFileSync = originalWrite; }
    assert.deepEqual(await manager.catalog(), before);
    catalog = await manager.importDirectory(partial, catalog.revision);
    assert((await manager.preview('partial-office')).document.includes('只起草正文'));
    assert(fs.existsSync(path.join(partial, 'SKILL.md')));
  });
  await check('Catalog capacity and runtime payload do not grant executable or file-write tools', async () => {
    const tooMany = Array.from({ length: SKILL_LIMITS.skills + 1 }, (_, i) => ({ ...catalog.skills[0], name: `skill-${i}`, directory: `versions/skill-${i}/${randomUUID()}/skill-${i}` }));
    await assert.rejects(state.saveSkillCatalog(catalog.revision, tooMany), /invalid_input/);
    const resources = await manager.enabledResources(); assert(!('tool' in resources)); assert(!('execute' in resources));
  });
  db.close(); db = undefined;
  const sourceDb = fs.realpathSync(path.resolve(desktop, process.argv[2] || 'test-results/xiaozhi-agent/pi-control-ui-2AWPBO/data/app.db'));
  const relative = path.relative(tests, sourceDb); assert(!relative.startsWith('..') && !path.isAbsolute(relative) && path.basename(sourceDb) === 'app.db');
  const sourceHash = hash(fs.readFileSync(sourceDb)), copy = path.join(output, 'old-copy.db'); fs.copyFileSync(sourceDb, copy); db = new DatabaseSync(copy);
  const facts = () => ['students', 'ai_conversation_sessions', 'ai_conversation_messages', 'ai_agent_runs', 'ai_agent_events', 'ai_memory_documents', 'ai_memory_entries', 'ai_memory_l3_documents', 'ai_memory_l3_entries']
    .map(table => ({ table, sha256: hash(JSON.stringify(db.prepare(`SELECT * FROM ${table} ORDER BY id`).all())) }));
  const before = facts(), oldState = createPiSkillCatalogState(connection(db));
  await oldState.migrateSkillCatalog(); await oldState.migrateSkillCatalog();
  await check('Old DB copy gains only idempotent metadata table and preserves business/memory/public history', async () => {
    assert.deepEqual(facts(), before); assert.deepEqual(await oldState.skillCatalog(), { revision: 0, skills: [] });
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='xiaozhi_pi_skill_catalog'").get().n, 1);
    assert.equal(hash(fs.readFileSync(sourceDb)), sourceHash);
  });
  await check('Current session state reads legacy bindings and exposes the integrated metadata adapter', async () => {
    const sessionState = createXiaozhiSessionState(connection(db));
    const binding = db.prepare('SELECT * FROM xiaozhi_pi_session_bindings LIMIT 1').get();
    if (binding) { assert(binding.schema_version <= 3); assert(await sessionState.getBinding(binding.conversation_id)); }
    assert.equal(typeof sessionState.skillCatalog, 'function'); assert.deepEqual(await sessionState.skillCatalog(), { revision: 0, skills: [] });
  });
  report.success = true;
} catch (error) { report.error = String(error?.message || error).slice(0, 600); }
finally {
  db?.close(); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, output })); if (!report.success) process.exitCode = 1;
}
