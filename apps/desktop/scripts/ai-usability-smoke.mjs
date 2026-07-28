import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-usability-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'ai-usability-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import {
            buildUsabilityInstructions,
            getAiUsabilityProfile,
            gradeUsabilityReply,
            structuredReplyToTeacherMarkdown,
          } from './src/main/ai-harness/usability-policy';
          import { runAiUsabilityEvalSuite } from './src/main/ai-harness/usability-eval-cases';

          function router(route, actionLevel = 'answer') {
            return {
              route,
              subIntent: route === 'practice_design' ? 'triplet_practice' : route === 'report_draft' ? 'monthly_report' : 'student_progress',
              confidence: 0.92,
              audience: route === 'report_draft' ? 'parent_material' : 'teacher',
              actionLevel,
              riskLevel: 'normal',
              slots: {
                studentRefs: ['小A'],
                hasMultipleStudentRefs: false,
                timeRange: 'last_week',
                subject: '数学',
                knowledgePoint: '一元一次方程',
                writeIntent: actionLevel === 'write',
              },
              needsStudent: route === 'student_diagnosis' || route === 'practice_design' || route === 'report_draft',
              allowedTools: [],
              contextPolicy: {
                include: [],
                recordLimit: 0,
                knowledgeLimit: 0,
                graphNodeLimit: 0,
                reason: 'usability smoke',
              },
            };
          }

          function reply(r, overrides = {}) {
            return {
              schemaVersion: 'xiazhi.reply.v2',
              route: r.route,
              subIntent: r.subIntent,
              answerMarkdown: '小A最近一周的方程错题集中在移项后符号处理。我建议今天先做 6 道同型短练，再用 1 道变式题确认是否能迁移。',
              facts: [
                { statement: '近 7 天学习记录中，方程移项相关错题出现 3 次', sourceId: 'learning_records', confidence: 'high' },
                { statement: '最近一次订正能写出等量关系，但符号变化漏写', sourceId: 'mistake_20260728', confidence: 'medium' },
              ],
              evidence: [
                { sourceId: 'learning_records', note: '本地学习记录摘要' },
              ],
              inferences: ['主要障碍更像步骤稳定性问题，而不是概念完全缺失。'],
              unknowns: ['还没有看到今天课堂即时反馈。'],
              risks: [{ level: 'normal', category: 'none', mitigation: '不形成永久学生标签。' }],
              teacherConfirmations: [],
              nextActions: [
                '先让小A完成 6 道移项同型题，记录每题是否漏写符号变化。',
                '如果前 4 题正确率低于 75%，先回到等式两边同加同减的口头解释。',
              ],
              artifacts: [],
              routeCheck: { kind: r.route, passed: true, notes: ['route/subIntent 已匹配'] },
              processSummary: ['已完成路由和最小上下文装配。'],
              ...overrides,
            };
          }

          export function runAiUsabilitySmoke() {
            const suite = runAiUsabilityEvalSuite();
            assert.equal(suite.ok, true, JSON.stringify(suite.results.filter((item) => !item.casePassed), null, 2));
            assert.ok(suite.total >= 20, 'usability sample set should cover at least 20 teacher task cases');
            assert.equal(suite.passed, suite.total);
            assert.ok(suite.routeCounts.student_diagnosis >= 4, 'sample set should cover student diagnosis cases');
            assert.ok(suite.issueCounts.manual_module_switch_fallback >= 1, 'sample set should cover manual switch fallback');

            const studentRouter = router('student_diagnosis');
            const instructions = buildUsabilityInstructions(studentRouter);
            assert.match(instructions, /不要输出固定流水线废话/);
            assert.match(instructions, /请手动切换学生数据/);

            const goodStudent = reply(studentRouter);
            const goodGrade = gradeUsabilityReply({ reply: goodStudent, router: studentRouter });
            assert.equal(goodGrade.passed, true, JSON.stringify(goodGrade.issues));
            assert.ok(goodGrade.score >= 75);
            assert.equal(getAiUsabilityProfile(studentRouter).id, 'evidence_snapshot');

            const goodMarkdown = structuredReplyToTeacherMarkdown(goodStudent);
            assert.match(goodMarkdown, /## 依据/);
            assert.match(goodMarkdown, /## 教学判断/);
            assert.match(goodMarkdown, /## 下一步/);
            assert.doesNotMatch(goodMarkdown, /## 事实/);
            assert.doesNotMatch(goodMarkdown, /## 推断/);

            const weakFallback = reply(router('workspace_help'), {
              answerMarkdown: '当前为普通问答模式（general_qa），无法自动切换到学生数据查询模式。请手动选择左侧导航栏中的「学生数据」模块。',
              nextActions: ['请手动切换学生数据。'],
              processSummary: ['当前路由不支持自动切换。'],
            });
            const weakGrade = gradeUsabilityReply({ reply: weakFallback, router: router('workspace_help') });
            assert.equal(weakGrade.passed, false);
            assert.ok(weakGrade.issues.some((item) => item.code === 'manual_module_switch_fallback'));

            const longGeneral = reply(router('general_qa'), {
              answerMarkdown: Array.from({ length: 36 }, () => '这是一段普通问答里不应该反复出现的解释，会让老师读完以后仍然不知道下一步要做什么。').join(''),
              facts: [],
              evidence: [],
              inferences: [],
              nextActions: ['可以进一步分析。', '继续观察。', '建议上传资料。'],
            });
            const longGrade = gradeUsabilityReply({ reply: longGeneral, router: router('general_qa') });
            assert.equal(longGrade.passed, false);
            assert.ok(longGrade.issues.some((item) => item.code === 'answer_too_long_for_route'));
            assert.ok(longGrade.issues.some((item) => item.code === 'too_many_next_actions'));

            const writeRouter = router('report_draft', 'write');
            const badWrite = reply(writeRouter, {
              artifacts: [{ id: 'report_1', title: '小A周报草稿', type: 'report_draft', fileName: 'report.md', description: '待老师确认', requiresTeacherConfirmation: true }],
              teacherConfirmations: [],
            });
            const badWriteGrade = gradeUsabilityReply({ reply: badWrite, router: writeRouter });
            assert.equal(badWriteGrade.passed, false);
            assert.ok(badWriteGrade.issues.some((item) => item.code === 'write_action_without_low_friction_confirmation'));

            const artifactMarkdown = structuredReplyToTeacherMarkdown(reply(router('practice_design'), {
              artifacts: [
                { id: 'doc_1', title: '小A练习说明', type: 'docx', fileName: 'practice.docx', description: '可导出', requiresTeacherConfirmation: false },
                { id: 'pdf_1', title: '小A练习讲义', type: 'pdf', fileName: 'practice.pdf', description: '可导出', requiresTeacherConfirmation: false },
                { id: 'exercise_1', title: '方程三元题组', type: 'exercise_set', fileName: 'exercise.md', description: '待确认', requiresTeacherConfirmation: true },
              ],
            }));
            assert.match(artifactMarkdown, /## 产物/);
            assert.match(artifactMarkdown, /Word 文件：小A练习说明/);
            assert.match(artifactMarkdown, /PDF 文件：小A练习讲义/);
            assert.match(artifactMarkdown, /三元题组草稿：方程三元题组/);

            return {
              ok: true,
              suiteTotal: suite.total,
              suitePassed: suite.passed,
              suiteAverageScore: suite.averageScore,
              goodProfile: goodGrade.profile,
              weakIssue: weakGrade.issues.find((item) => item.code === 'manual_module_switch_fallback')?.code,
              longIssues: longGrade.issues.map((item) => item.code),
              writeIssue: badWriteGrade.issues.find((item) => item.code === 'write_action_without_low_friction_confirmation')?.code,
            };
          }
        `,
        resolveDir: appRoot,
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      logLevel: 'silent',
    });

    const { runAiUsabilitySmoke } = await import(pathToFileURL(outfile).href);
    const result = runAiUsabilitySmoke();
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
