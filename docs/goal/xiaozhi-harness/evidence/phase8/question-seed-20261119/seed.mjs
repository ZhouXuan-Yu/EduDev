import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const workspace = 'D:/WorkProject/EduProject-harness';
const baseline = 'C:/Users/ZhouXuan/.codex/worktrees/harness-baseline-20261117/EduProject/apps/desktop';
const {question, fingerprint, sha256} = await import(pathToFileURL(path.join(workspace,
  'apps/desktop/scripts/xiaozhi-agent/phase8-real-model-plan.mjs')).href);
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: baseline, encoding: 'utf8'}).trim();
assert.equal(commit, 'd50ef330f0f9c4995cc7e096e85bd8fd93629c83');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase8-question-seed-'));
console.log(JSON.stringify({output, commit}));
const dataRoot = path.join(output, 'data'), profile = path.join(output, 'profile');
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, [
  "const {app,net}=require('electron');",
  "app.setPath('userData'," + JSON.stringify(profile) + ");",
  "net.fetch=async()=>{throw Error('phase8_seed_network_disabled');};",
  "app.whenReady().then(()=>import(" + JSON.stringify(pathToFileURL(path.join(baseline, 'out/main/index.js')).href) + "));",
].join('\n'));
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !/(KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/iu.test(name) && !name.startsWith('OMNI_EDU_')
  && !['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(name)));
Object.assign(env, {OMNI_EDU_DATA_ROOT:dataRoot,OMNI_EDU_REPO_ROOT:path.resolve(baseline,'../..'),OMNI_EDU_XIAOZHI_PI:'1'});
const require = createRequire(path.join(baseline, 'package.json'));
const fields = {subject:'物理',grade:'初二',knowledgePoint:'浮力与漂浮',questionType:'计算题',difficulty:'medium',
  stem:question,answer:'重力12 N；静止时漂浮；浸入水中体积1.2 L。',
  analysis:'2 L=0.002 m³，质量600×0.002=1.2 kg，重力为12 N。物体漂浮，浸入体积12/(1000×10)=0.0012 m³=1.2 L。'};
const app = await require('playwright')._electron.launch({executablePath:require('electron'),cwd:baseline,args:[bootstrap],env,timeout:60000});
let result;
try {
  const page = await app.firstWindow({timeout:60000});
  await page.waitForFunction(() => Boolean(window.omniEdu?.createQuestionBankItem));
  result = await page.evaluate(async value => {
    const api = window.omniEdu;
    const created = await api.createQuestionBankItem({
      ...value,sourceKind:'local_bank',sourceTitle:'Phase8合成教师题',tags:['phase8-Q3','synthetic'],
    });
    const before = await api.getArchivedQuestionVersion(created.id);
    await api.editArchivedQuestion({questionId:created.id,version:before.version,fields:value,sourceChecked:true});
    const after = await api.getArchivedQuestionVersion(created.id);
    return {id:created.id,beforeVersion:before.version,afterVersion:after.version,question:after.question};
  }, fields);
  assert.equal(result.id, result.question.id);
  assert.equal(result.question.sourceKind, 'local_bank');
  for (const [key,value] of Object.entries(fields)) assert.equal(result.question[key], value);
} finally { await app.close(); }
const data = fingerprint(dataRoot);
fs.writeFileSync(path.join(output,'question-seed-evidence.json'), JSON.stringify({
  schemaVersion:1, commit, questionId:result.id, stemSha256:sha256(question),
  beforeVersion:result.beforeVersion, afterVersion:result.afterVersion, sourceKind:result.question.sourceKind,
  actions:['createQuestionBankItem','getArchivedQuestionVersion','editArchivedQuestion','getArchivedQuestionVersion'],
  modelRequests:0,dataSnapshot:dataRoot,dataSha256:data.sha256,
},null,2));
console.log(JSON.stringify({success:true,output,questionId:result.id,dataSha256:data.sha256}));
