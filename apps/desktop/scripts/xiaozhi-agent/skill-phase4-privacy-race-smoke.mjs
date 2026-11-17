import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
const {createPiSkillCatalogState} = await import('../../src/main/xiaozhi-agent/skill-catalog-state.ts');
const {createManagedEducationSkills} = await import('../../src/main/xiaozhi-agent/managed-skills.ts');
const {serializeStateWrites} = await import('../../src/main/xiaozhi-agent/serialized-state-sql.ts');
const {createSkillGovernanceState} = await import('../../src/main/xiaozhi-agent/skills/state.ts');
const {createSkillGovernance} = await import('../../src/main/xiaozhi-agent/skills/service.ts');
const {createLegacySkillAdapter} = await import('../../src/main/xiaozhi-agent/skills/legacy.ts');
const {createSkillCreatorTools} = await import('../../src/main/xiaozhi-agent/skills/tools.ts');
const privacy = await import('../../src/main/xiaozhi-agent/skills/private-context.ts');
const {createHanaOfficeTools} = await import('../../src/main/office-agent/hana-tool-adapter.ts');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase4-privacy-race-'));
const db = new DatabaseSync(path.join(root, 'app.sqlite'));
const raw = {run: async (query, args = []) => db.prepare(query).run(...args),
  change: async (query, args = []) => Number(db.prepare(query).run(...args).changes),
  all: async (query, args = []) => db.prepare(query).all(...args)};
const sql = serializeStateWrites(raw);
await sql.run('CREATE TABLE users(id TEXT PRIMARY KEY,display_name TEXT,role TEXT,status TEXT)');
await sql.run("INSERT INTO users VALUES('user-private-fixture','合成教师','owner','active')");
const catalog = createPiSkillCatalogState(sql); await catalog.migrateSkillCatalog();
const managedRoot = path.join(root, 'skills');
const manager = createManagedEducationSkills({root: managedRoot, state: catalog, assertIdle() {}}); await manager.initialize();
const state = createSkillGovernanceState(sql); await state.migrate();
const context = privacy.createSkillPrivateContext();
let rewriteSource;
const service = createSkillGovernance({state, managed: manager, dependency: async () => true, current: async () => true,
  privateContext: async () => context,
  sanitize: async text => {rewriteSource?.(); return text;}});
await service.initialize();
const owner = {sessionId: 'aisession_00000000-0000-4000-8000-000000000004', taskId: 'xitask_private_fixture', runId: 'run_private_fixture', generation: 1};
const creator = createSkillCreatorTools(service, () => owner)[0];
const draft = (name, document) => ({name, document, description: '通用教学核对流程', version: '1.0.0', dependencies: [], permissionRequirements: []});
const checks = [];
const report = {success: false, root, checks, paidCalls: 0, timing: {},
  boundary: 'Actual Native office_read_text, original parser/files, real SQLite and actual Creator Tool. Main owner is controlled synthetic context. Full production Pi path tested separately.'};
const source = '教师私有原文开始：' + Array.from({length: 256}, (_, index) => createHash('sha256').update(`private-source-${index}`).digest('hex')
  .replace(/[0-9a-f]/g, digit => String.fromCharCode(97 + Number.parseInt(digit, 16)))).join('');
const sourceFile = path.join(root, 'long-private.txt'); fs.writeFileSync(sourceFile, source);
const hana = createHanaOfficeTools({workspace: root, sessionId: owner.sessionId, runId: owner.runId});
const native = await hana.execute('office_read_text', 'call_private_read', {path: 'long-private.txt'});
if (!native.success) throw Error('native_private_read_failed');
const captureStarted = performance.now(); privacy.captureSkillPrivateContext(context, 'office_read_text', native);
report.timing.captureMs = performance.now() - captureStarted;
async function create(input) {
  const result = await creator.execute('call_' + input.name, input, new AbortController().signal, undefined, undefined);
  const rows = await state.list('skills');
  const versions = await state.list('versions');
  return {result, rows, versions};
}
for (const [name, fragment] of [['middle32', source.slice(6201, 6233)], ['middle64', source.slice(9300, 9364)], ['tail64', source.slice(-96, -32)]]) {
  const input = draft(`probe-${name}`, '# 通用流程\n' + fragment);
  const created = await create(input);
  const skill = created.rows.find(row => row.name === input.name);
  const version = created.versions.find(row => row.skillId === skill?.id);
  const bytes = version ? manager.verifyItem(version.package).document : '';
  checks.push({name: `G4-F01 Native long-source ${name} cannot enter a published package`,
    pass: version?.state === 'draft' && !bytes.includes(fragment) && !JSON.stringify(created.result).includes(fragment)});
}
const genericStarted = performance.now();
const generic = await create(draft('general-after-long-read', '# 通用方法\n核对任务目标，列出必要步骤，再以实际回执检查交付。'));
report.timing.genericValidationMs = performance.now() - genericStarted;
checks.push({name: 'Generalized instructions remain publishable after the same long private read',
  pass: generic.versions.some(version => version.skillId === generic.rows.find(row => row.name === 'general-after-long-read')?.id && version.state === 'published')});
const sensitiveName = 'teacher-13800138000';
const sensitiveDeclaration = 'sk-ownedfixturecredentialabcdefghijk';
for (const input of [draft(sensitiveName, '# 通用方法\n先核对目标再检查事实。'),
  {...draft('unsafe-declaration', '# 通用方法\n核对实际结果。'), dependencies: [{capabilityId: sensitiveDeclaration, contractVersion: '1.0.0', required: true}],
    permissionRequirements: [sensitiveDeclaration]}]) {
  const created = await create(input);
  const text = JSON.stringify({skills: created.rows, versions: created.versions, result: created.result});
  const files = fs.readdirSync(managedRoot, {recursive: true}).filter(file => file.endsWith('SKILL.md'));
  const contents = files.map(file => fs.readFileSync(path.join(managedRoot, file), 'utf8')).join('\n');
  checks.push({name: `G4-F01 sensitive ${input.name === sensitiveName ? 'name' : 'declaration'} stays out of Draft package SQL and result`,
    pass: !text.includes(input.name === sensitiveName ? sensitiveName : sensitiveDeclaration)
      && !contents.includes(input.name === sensitiveName ? sensitiveName : sensitiveDeclaration)});
}
const imported = path.join(root, 'import-source'); fs.mkdirSync(imported);
const original = '---\nname: race-package\ndescription: 合成导入方法\n---\n# 通用方法\n核对目标并检查实际回执。\n';
fs.writeFileSync(path.join(imported, 'SKILL.md'), original);
let changed = false;
rewriteSource = () => {
  if (changed) return; changed = true;
  fs.writeFileSync(path.join(imported, 'SKILL.md'), original + '\n' + sensitiveDeclaration);
  fs.writeFileSync(path.join(imported, 'evil.py'), 'raise RuntimeError("must not execute")');
};
let importError;
try {await createLegacySkillAdapter(service).importDirectory(imported, (await manager.catalog()).revision);}
catch (error) {importError = error.message;}
rewriteSource = undefined;
const importedSkill = (await state.list('skills')).find(skill => skill.name === 'race-package');
const importedVersion = (await state.list('versions')).find(version => version.skillId === importedSkill?.id);
checks.push({name: 'G4-F02 await-cut source replacement cannot publish unvalidated secret or script bytes',
  pass: changed && importError === 'skill_source_changed' && !importedVersion});
report.privateContext = context.metrics();
context.clear();
let closedRefused = false;
try {context.contains('late private context check');} catch {closedRefused = true;}
checks.push({name: 'Run context release clears its fixed bitmap and retained late references fail closed',
  pass: context.metrics().memoryBytes === 0 && context.metrics().closed === true && closedRefused});
report.afterRelease = context.metrics();
report.success = checks.every(check => check.pass);
db.close(); fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
if (!report.success) process.exitCode = 1;
console.log(JSON.stringify({success: report.success, passed: checks.filter(check => check.pass).length, total: checks.length, root, checks, timing: report.timing}));
