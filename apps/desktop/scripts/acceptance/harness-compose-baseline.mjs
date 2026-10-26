import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from './evidence.mjs';
import {HARNESS_CASES, validateHarnessReport} from './harness-evidence.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
if (process.cwd() !== desktop) throw new Error('Run from apps/desktop');
const [networkDir, visionDir, fileDir] = process.argv.slice(2).map(value => path.resolve(value));
if (!networkDir || !visionDir || !fileDir) throw new Error('Usage: harness-compose-baseline.mjs <network-dir> <vision-dir> <file-dir>');
const output = fs.mkdtempSync(path.join(desktop, 'test-results/acceptance/harness-baseline-composed-'));
const read = directory => JSON.parse(fs.readFileSync(path.join(directory, 'report.json'), 'utf8'));
const suites = [
  {
    id: 'NET-01',
    directory: networkDir,
    report: read(networkDir),
    patterns: [/^Exact NET-01 natural input actually searches and reads official MOE body$/, /^Final NET-01 distinguishes notice signature March25, page publication April21 and autumn2022 implementation$/],
  },
  {
    id: 'NET-02',
    directory: networkDir,
    report: read(networkDir),
    patterns: [/^Exact NET-02 natural input opens real internal MOE browser, answers a column present in the current DOM and captures the page$/, /^Delivered capture matches actual current URL, owned PNG hash and image dimensions$/],
  },
  {
    id: 'IMG-04',
    directory: visionDir,
    report: read(visionDir),
    patterns: [/^Natural teacher prompt selects real image tool and visible explicit public-purpose confirmation; no image is transmitted before the teacher answers$/, /^Formal original Pi\/official DeepSeek image request returns exact visual code\/counts\/positions, genuine received source and segmented public explanation while preserving original native prefix$/],
  },
  {
    id: 'FILE-01',
    directory: fileDir,
    report: read(fileDir),
    patterns: [/^FILE-01 exact natural prompt actually reads random attachment body and cites code\/37\/8\/source with cleared composer$/],
  },
];
for (const suite of suites) {
  if (!suite.report?.success || suite.report.build?.sha256 === undefined) throw new Error(`${suite.id}: source suite did not pass`);
}
const buildSha256 = suites[0].report.build.sha256;
if (suites.some(suite => suite.report.build.sha256 !== buildSha256)) throw new Error('Source suites use different builds');
const artifacts = directory => fs.readdirSync(directory, {withFileTypes: true})
  .filter(entry => entry.isFile() && (entry.name === 'report.json' || entry.name.endsWith('.png')))
  .map(entry => {
    const file = path.join(directory, entry.name);
    const bytes = fs.readFileSync(file);
    return {file, bytes: bytes.length, sha256: sha256(bytes)};
  })
  .filter(artifact => artifact.bytes > 0);
const cases = suites.map(suite => {
  const assertions = suite.report.checks.filter(check => suite.patterns.some(pattern => pattern.test(check.name)));
  if (assertions.length !== suite.patterns.length || assertions.some(check => check.pass !== true || check.skipped)) throw new Error(`${suite.id}: required assertions missing`);
  return {
    id: suite.id,
    status: 'PASS',
    layer: 'C',
    synthetic: true,
    modelJudged: false,
    buildSha256,
    scriptSha256: suite.report.scriptSha256,
    assertions,
    artifacts: artifacts(suite.directory),
    output: suite.directory,
    reason: 'Frozen current build, actual isolated Electron/provider suite, source-bound assertions and artifact readback',
  };
});
if (HARNESS_CASES.some(id => !cases.some(item => item.id === id))) throw new Error('Case coverage incomplete');
const report = {
  schema: 'xiaozhi.harness-baseline.v1',
  started: new Date().toISOString(),
  finished: new Date().toISOString(),
  output,
  overall: 'NOT_ACCEPTED',
  dailyAccepted: false,
  vpnOffAccepted: false,
  userFailuresClosed: false,
  feedback: ['NET-USER-001', 'IMG-USER-001'],
  environment: {
    node: process.version,
    profile: 'fresh owned isolated profiles; not daily settings',
    model: 'deepseek-flash selected by the source suites',
    vpn: 'UNKNOWN; no system changes',
    credentialSource: 'existing ignored .env.local; value never recorded',
    sourceBuildCorrespondence: 'All source suites fingerprint the same frozen 373-file build',
    nativeChooser: 'controlled native dialog responses in tests; manual chooser unverified',
  },
  cases,
  attempts: suites.map(suite => ({
    suite: suite.id,
    output: suite.directory,
    grade: {status: 'PASS', reasons: [], assertionCount: suite.report.checks.length},
    cases: [cases.find(item => item.id === suite.id)],
    error: '',
  })),
  build: {
    sha256: buildSha256,
    files: suites[0].report.build.files,
    root: suites[0].report.build.root,
    unchanged: true,
    source: 'Existing frozen build used by all three source suites',
  },
  validation: null,
};
report.validation = validateHarnessReport(report, {readArtifacts: true, evidenceRoot: path.join(desktop, 'test-results')});
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(output, '验收报告.md'), [
  '# H10 当前软件基线',
  '',
  `构建：${buildSha256} / ${report.build.files} 文件`,
  '',
  '|Case|结果|来源|',
  '|---|---|---|',
  ...cases.map(item => `|${item.id}|PASS|${item.output}|`),
  '',
  '这是隔离 Electron/真实 DeepSeek 的软件基线。日常保存配置、VPN-off、安装包、真人教师和 Office/WPS 放映仍未验。',
].join('\n'));
console.log(JSON.stringify({output, build: buildSha256, files: report.build.files, cases: cases.map(item => item.id), validation: report.validation}));
process.exitCode = report.validation.valid && cases.every(item => item.status === 'PASS') ? 2 : 1;
