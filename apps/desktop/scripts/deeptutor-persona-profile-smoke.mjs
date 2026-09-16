import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(tmpdir(), 'omni-edu-persona-profile-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'persona-profile-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { routeAiPrompt } from './src/main/ai-harness/router';
      import { allAiRoleProfiles, buildAiRoleProfileGuidance } from './src/main/ai-harness/role-profile';
      export function runSmoke() {
        const teacher = routeAiPrompt('分析学生当前学习进度', { hasStudent: true });
        const peer = routeAiPrompt('以同伴口吻分析学生当前学习进度', { hasStudent: true });
        const research = routeAiPrompt('以研究助理口吻分析学生当前学习进度', { hasStudent: true });
        assert.equal(teacher.roleProfile, 'teacher'); assert.equal(peer.roleProfile, 'peer'); assert.equal(research.roleProfile, 'research_assistant');
        assert.deepEqual(peer.allowedTools, teacher.allowedTools); assert.deepEqual(peer.contextPolicy, teacher.contextPolicy);
        assert.ok(!research.allowedTools.includes('get_student_profile'), 'research route must not carry student profile tools');
        assert.ok(!research.allowedTools.includes('search_learning_records'), 'research route must not carry learning record tools');
        assert.ok(!research.allowedTools.includes('mastery_status'), 'research route must not carry mastery tools');
        assert.ok(research.allowedTools.includes('generate_research_outline'), 'research route must expose the research outline tool');
        assert.ok(!research.contextPolicy.include.includes('student_profile'), 'research context must not read student profile');
        assert.ok(!research.contextPolicy.include.includes('learning_records'), 'research context must not read learning records');
        assert.equal(allAiRoleProfiles().length, 3); assert.ok(allAiRoleProfiles().every((profile) => buildAiRoleProfileGuidance(profile).length > 20));
        assert.ok(buildAiRoleProfileGuidance('peer').includes('不把建议伪装成权威结论'));
        return { ok: true, profiles: allAiRoleProfiles(), profileInvarianceWithinStudentRoute: true, researchRouteIsolation: true, promptGuidance: true };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' });
    const { runSmoke } = await import(pathToFileURL(outfile).href); console.log(JSON.stringify(runSmoke()));
  } finally { rmSync(bundleRoot, { recursive: true, force: true }); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
