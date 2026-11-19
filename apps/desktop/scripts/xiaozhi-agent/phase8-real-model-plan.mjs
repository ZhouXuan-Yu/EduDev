import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const actualDatabasePath = 'D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/phase8-real-model-budget/goal.sqlite';
export const providerPaths = ['/v1/chat/completions', '/chat/completions'];
export const syntheticFiles = Object.freeze({
  'facts.txt': '水在标准大气压下约100℃沸腾。蒸发可在不同温度下发生。植物光合作用需要光、水和二氧化碳。',
  'scores.csv': 'id,score\nA,60\nB,80\nC,100\n',
});
export const question = '初二物理：水的密度1000 kg/m³，g=10 N/kg，均匀物体体积2 L、密度600 kg/m³。求重力、静止时状态和浸入水中体积。';
export const q5Source = 'https://starchild.gsfc.nasa.gov/docs/StarChild/teachers/densities.html';
export const tasks = Object.freeze([
  {id: 'Q1', input: '用两句话向六年级学生解释蒸发与沸腾的区别。'},
  {id: 'Q2', input: '请读取工作区 facts.txt，回答植物光合作用需要什么，并指出来源文件；不要补充文件中没有的条件。'},
  {id: 'Q3', input: '从题库读取这道初二浮力题，制作四页讲解 PPTX 和一个可交互 HTML 教学文件，保存到工作区；展示解题步骤，互动中让学生判断漂浮并填写浸入体积，提交后显示对错及正确解法。'},
  {id: 'Q4', input: '读取 scores.csv，计算3个分数的总和和平均分，列出计算式；不要修改文件。'},
  {id: 'Q5', input: `请联网读取 NASA 教师资源 ${q5Source} ，用中文向初二学生解释物体在水中漂浮的密度条件，给出网页来源；不要使用其他网页。`},
  {id: 'Q6', input: '一名虚构学生某次测试得了80分。请判断他过去一个月的成绩趋势；没有其他数据时不要猜测。'},
  {id: 'Q7', input: '将文字‘合成练习：3/4 + 1/4 = 1’保存到工作区 practice.txt；如需确认请先让我确认，不要覆盖已有文件。'},
  {id: 'Q8', input: '请将 facts.txt 复制到工作区 copy.txt；如果需要我批准，请等待我的选择。'},
]);
export const schedule = Object.freeze(tasks.flatMap(task => [1, 2].flatMap(round => (round === 1 ? ['A', 'B'] : ['B', 'A'])
  .map(version => Object.freeze({id: `${task.id}-r${round}-${version}`, task: task.id, version, round, input: task.input})))));
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function fingerprint(directory) {
  const root = fs.realpathSync(directory);
  const files = [];
  function visit(relative) {
    for (const name of fs.readdirSync(path.join(root, relative)).sort((left, right) => left.localeCompare(right))) {
      const child = path.join(relative, name), source = path.join(root, child), stat = fs.lstatSync(source);
      if (stat.isSymbolicLink()) throw Error('phase8_snapshot_symlink');
      if (stat.isDirectory()) visit(child);
      else if (stat.isFile()) files.push({file: child.replaceAll('\\', '/'), sha256: sha256(fs.readFileSync(source))});
    }
  }
  visit('');
  return {sha256: sha256(JSON.stringify(files)), files};
}

function keys(value, permitted) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => permitted.includes(key));
}
export function validateManifest(value) {
  if (!keys(value, ['schemaVersion', 'databasePath', 'model', 'versions', 'runTimeoutMs', 'requestTimeoutMs', 'questionSeedEvidence', 'conditions'])
      || value.schemaVersion !== 1 || path.resolve(value.databasePath || '') !== path.resolve(actualDatabasePath)
      || !keys(value.model, ['id', 'expectedWire']) || !/^[A-Za-z0-9_.:/-]{1,128}$/.test(value.model.id || '')
      || !keys(value.versions, ['A', 'B']) || !value.conditions || typeof value.questionSeedEvidence !== 'string') {
    throw Error('phase8_manifest_incomplete');
  }
  if (!keys(value.model.expectedWire, ['stream', 'temperature', 'top_p', 'max_tokens', 'max_completion_tokens', 'seed', 'reasoning_effort', 'thinking'])
      || value.model.expectedWire.stream !== true) throw Error('phase8_expected_wire_configuration_missing');
  for (const version of ['A', 'B']) {
    const item = value.versions[version];
    if (!keys(item, ['desktopRoot', 'commit', 'outSha256', 'outCount', 'dataSnapshot', 'dataSha256', 'profileSnapshot', 'profileSha256'])
        || !['desktopRoot', 'dataSnapshot', 'profileSnapshot'].every(key => typeof item[key] === 'string' && path.isAbsolute(item[key]))
        || !/^[a-f0-9]{40}$/.test(item.commit || '')
        || !['outSha256', 'dataSha256', 'profileSha256'].every(key => /^[a-f0-9]{64}$/.test(item[key] || ''))
        || !Number.isSafeInteger(item.outCount) || item.outCount < 1) throw Error('phase8_version_not_frozen');
  }
  for (const key of ['runTimeoutMs', 'requestTimeoutMs']) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 1000 || value[key] > 3600000) throw Error('phase8_invalid_deadline');
  }
  if (value.versions.A.dataSha256 !== value.versions.B.dataSha256) throw Error('phase8_initial_data_snapshots_differ');
  return value;
}

export function preparePlan(output) {
  fs.mkdirSync(output, {recursive: true});
  const fixtures = path.join(output, 'synthetic-inputs'); fs.mkdirSync(fixtures);
  for (const [name, contents] of Object.entries(syntheticFiles)) fs.writeFileSync(path.join(fixtures, name), contents);
  fs.writeFileSync(path.join(fixtures, 'question.txt'), question);
  const template = {schemaVersion: 1, databasePath: actualDatabasePath, model: {id: 'REPLACE_WITH_SAME_CONFIGURED_MODEL', expectedWire: {stream: true}},
    versions: {A: {desktopRoot: 'C:/Users/ZhouXuan/.codex/worktrees/harness-baseline-20261117/EduProject/apps/desktop',
      commit: null, outSha256: null, outCount: 458, dataSnapshot: null, dataSha256: null, profileSnapshot: null, profileSha256: null}, B: null},
    runTimeoutMs: 900000, requestTimeoutMs: 180000, questionSeedEvidence: 'FILL_ACTUAL_QUESTION_BANK_SEED_READBACK',
    conditions: {status: 'NOT_TESTED', requirement: 'Record actual machine, power, network, thinking, limits, tool and permission parity before paired execution.'}};
  fs.writeFileSync(path.join(output, 'manifest-template.json'), JSON.stringify(template, null, 2));
  fs.writeFileSync(path.join(output, 'schedule.json'), JSON.stringify(schedule, null, 2));
  fs.writeFileSync(path.join(output, 'input-freeze.json'), JSON.stringify(fingerprint(fixtures), null, 2));
  return {status: 'NOT_TESTED', output, runs: schedule.length, actualGoalLedgerOpened: false};
}
