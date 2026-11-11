# 已关闭的题号混合检索缺陷

2026-11-11，基线fcc8c5f2cea0448b5758b7f46f482791d8a7d4a6。

## 实际失败与原因

生产RetrievalRepository在query加questionNumber=77时，词法SQL执行题号过滤，语义分支遗漏过滤。候选有效计数只核对向量事件版本，把其他题号也计入目标数量，首批100个候选即可提前停止。复现返回8道其他题，目标漏失，见before.log。

## 生产修复

修改apps/desktop/src/main/retrieval/repository.ts。在语义候选有效计数中连接当前SQLite题目，复用questionRetrievalWhere已有题号谓词，再经原自适应扩展继续找目标。离开候选层前排除无关题号，减少不必要的题目和来源认证。最终读取并认证当前题目事实后，再按archive.number精确检查题号，防止查询期间题号变化。前导零保留区分，空白按原过滤器规范化。

searchQuestionBank、searchQuestionBankWithCoverage和retrieval:questions均调用这个Repository。原typed preload、界面、SQLite事实和Lance格式继续使用。无新表、依赖、IPC或额外模型处理。原最多1000候选、扩展时限、来源/隐私/版本验证继续执行。

## 定向验证

从D:/WorkProject/EduProject-kb-isolation/apps/desktop执行。

| 命令 | 结果 |
| --- | --- |
| `node --experimental-transform-types scripts/education/kb-retrieval-number-scope.mjs`，修复前 | exit1，错误返回8道其他题号，目标漏失，before.log。 |
| 同上，修复后 | exit0，9组通过，after.log。 |
| `node --experimental-transform-types scripts/education/kb-retrieval-boundaries.mjs` | exit0，17组相关检索/来源/恢复回归通过，related.log。 |
| `node node_modules/typescript/bin/tsc --noEmit` | exit0，无诊断。 |
| `npm audit --json` | exit1，存量28项，8 high/12 moderate/8 low/0 critical，audit-summary.json。依赖及锁文件无改动。 |
| `git diff --check`及暂存区检查 | exit0。 |

定向脚本复用原fixture的真实SQLite、生产Repository及受控向量端口，并用生产searchQuestionRows进行词法过滤。最终把目标向量明确排在150个无关候选后，验证100→200扩展后只返回目标1题。另覆盖空白、前导零、无结果、SQL式字面量、无题号普通检索、词法与语义合并、无向量回退、运行中题号变更、新题号索引追平和非法参数类型。搜索前后业务题目事实一致，竞态组另行显式修改题号以验证版本门禁。

按用户要求，本轮验证集中在该检索缺陷。真实ONNX/Lance排序质量、Electron交互与全库P95本轮保持未验证，既有界面结果按其原报告范围使用。

## 成本与剩余主线

此受控案例修复前查询1轮100候选且错误返回8题，修复后查询100和200候选两轮，正确返回目标1题。最终日志确认只执行1次题目事实读取，150个无关题在昂贵的来源认证前排除。日志单次记录为9.21ms和6.18ms，受控排序及随机事实标识用于复现问题，这些时间仅作排查记录。真实向量端口性能和200条独立查询的Recall/Precision仍需按原标准完成。

本轮关闭题号条件的串题/漏题缺陷。完整Goal保持ACTIVE，后续继续关闭自然题质量、召回及几十GB目录处理中的实现缺口。每轮至少关闭一个可复现缺陷及定向证明的规则已写入1.Agent.md和Master，避免用反复全量验收代替实现。

## 回滚

正常revert本轮代码并重新构建。SQLite、原题及向量数据格式兼容，原始数据无需迁移。回滚会恢复旧题号漏筛选行为。
