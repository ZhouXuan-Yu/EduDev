# Gate4 独立最终验收

结论 **ACCEPTED**，限 Phase4 固定 S-01–S-09 与 A-P0-04、本地 Skill 治理合同。日期为 2026-11-17。

审查树为 `D:/WorkProject/EduProject-harness`，HEAD 为 `052bd6885c4280b49ab36228fe9ac605799a769b`。独立 reviewer 在 root 明确 RUNTIME_RELEASED 后串行亲自执行固定 7 次 runner，95/95 断言通过，7 次进程均 exit0，FAIL 0，skipped 0。本轮生产源码、测试源码、out 修改和应用 build、commit、push、真实模型调用均为 0。测试沿原 runner 写入唯一 test-results 目录及 owned TEMP 合成数据，证据副本集中在本报告同目录。

## 候选身份

冻结原件为 `writer-freeze.json`，来自 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-harness-phase4-freeze-sql-f03-KcIykO/freeze.json`。

| 项目 | 核验结果 |
| --- | --- |
| 本轮 source/test | 37 文件，前后逐文件 bytes/SHA256 一致 |
| 既有 out | 466 文件，前后逐文件 bytes/SHA256 一致 |
| 原依赖 | 原 12 项逐文件 bytes/SHA256 一致，含 package-lock、Pi 安装身份、db、Skill epoch、Execution Boundary、权限服务与 input snapshot |
| 总身份核对 | 515 项，差异 0 |
| sourceListHash | `6fa2d3a63664f239c9ec05088d9f26670cc2f9547de40684d15b65ba3b42a628` |
| outListHash | `753832ea06a7229474ee203c19087ca3dac5b0c00440bd66a33aeb56b2210f86` |
| F03 source SHA256 | `69ac1ce24ab71a3bbb9099d3e8e58e7de311bdf98248488add28357b234348e9` |
| git diff --check | exit0，原始输出见 `git-diff-check.log` |
| 本轮 owned node/electron | 结束后 0 残留，见 `owned-runtime-after.json` |

原依赖清单在 `original-dependency-hashes.json`。完整前后核对在 `verification-before-runtime.json` 与 `verification-after-runtime.json`。与上一已审 history 候选相比仅 `serialized-state-sql.ts` 与 `skill-phase4-state-smoke.mjs` 有 delta，已读源码修复和保留原断言的测试增量。此前 F01/F02 与历史重建源码审查复用同一源身份及原审查记录。

## 独立精确命令与原始结果

以下命令 cwd 均为 `D:/WorkProject/EduProject-harness/apps/desktop`。

| 精确命令 | 结果 | 本目录原始日志 / 报告副本 |
| --- | --- | --- |
| `node scripts/xiaozhi-agent/skill-phase4-state-smoke.mjs` | PASS 21/21，exit0 | `core-native.log` / `native-core-report.json` |
| `node scripts/xiaozhi-agent/skill-phase4-state-smoke.mjs --legacy-sql` | PASS 21/21，exit0 | `core-legacy-sql.log` / `legacy-core-report.json` |
| `node scripts/xiaozhi-agent/skill-phase4-privacy-race-smoke.mjs` | PASS 8/8，exit0 | `privacy-race.log` / `privacy-race-report.json` |
| `node scripts/xiaozhi-agent/skill-phase4-production-smoke.mjs` | PASS 9/9，exit0 | `production.log`、`production-worker.log` / `production-report.json` |
| `node scripts/xiaozhi-agent/skill-phase4-ui-smoke.mjs` | PASS 8/8，exit0 | `ui.log` / `ui-report.json` |
| `node scripts/xiaozhi-agent/skill-phase4-legacy-host-smoke.mjs C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase3-production-JhTgs2/data/app.db` | PASS 原 API15+Host9，exit0 | `original-api-host.log`、`original-api.log`、`original-host-lock.log` / `original-api-host-report.json` 及两个 detailed-report |
| `node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-gate4-review-3625f274df9a45888c3f1953ea5fe083/sql-fallback-probe.mjs` | PASS 4/4，exit0 | `independent-sql-fallback.log` / `independent-sql-fallback-report.json` |

真实 production runner 使用原 OmniEduStore、Production Host、Pi、Task/Run/Journal 和实际 Electron main，16 次请求全部转向合成 loopback SSE，paidCalls=0。原 Host/API 的 15+9 个既有断言运行在真实 Electron main，保留原 chooser/global lock 行为。UI 使用实际 built main/preload、原技能设置导航和实际点击/输入，原生系统 chooser与完整视觉接受沿 Phase7 合同。

## S-01–S-09 验收映射

| ID | 状态 | 实际步骤及读回结果 | 证据 |
| --- | --- | --- | --- |
| S-01 | PASS | 原 Pi skill_create 完成 Draft/验证/Personal publication，仍绑定同一 Task Journal，在途 UI idle 锁有效，后续安全 Run 激活 | native/legacy core3–4，production1–3，UI2 |
| S-02 | PASS | main 唯一 active owner 决定个人归属，跨 owner 和伪造 Snapshot 拒绝，个人默认私有 | core2–4、16，production1，UI2/8 |
| S-03 | PASS | Personal 分享生成独立 Team skillId与 immutable 目录，个人后续版本保持独立 | core8–9，production6–7，UI4 |
| S-04 | PASS | 一人一 Team，普通成员审批拒绝，管理员批准后可用，维护版本审批前保留旧 approved active，撤销/冷启一致 | core8–10、12、17，production6–7，UI4–5/8 |
| S-05 | PASS | Official 来源/许可证/测试/兼容元数据绑定 exact version/hash，由 main-only可信本地 reviewer 记录授权，伪造与撤销后冷启均受阻 | native/legacy core11–12，official-authority 源身份 |
| S-06 | PASS | 旧 schema1 增量幂等迁移，SemVer 与 immutable bytes保留，并发/CAS/失败回滚和重复创建保持一致，Run固定精确版本 | core1、4–5、13–15、20–21，production2–3/7，UI2–3 |
| S-07 | PASS | V2 后可回滚V1，withdrawn 版本不能激活，源损坏失败关闭，冷启动指针一致 | core5、13、19，production7，UI3/8 |
| S-08 | PASS | 长源32/64尾部片段、敏感name/声明、凭据/脚本/隐藏内容和await-cut替包被拒，安全Draft无敏感持久内容，同会话与冷启旧读取证据重建有效 | core6、15，privacy1–8，production4–5/8，UI6 |
| S-09 / A-P0-04 | PASS | 依赖缺失/撤回、权限声明、当前Grant和Membership复核，不合格候选排除，Skill文字无法产生真实进程/写入执行 | core7、12、16–18，production9，原API/Host24 |

## P1 修复复验与历史失败保留

- **G4-F01 CLOSED**。独立8项隐私专项验证 middle32、middle64、tail64和metadata。production额外通过 Run A实际读取、同Task后续Run B不重读直接复制、关闭重开后的Run C直接复制，三份版本均为安全Draft并带 private_source_excerpt。正常通用方法通过发布。
- **G4-F02 CLOSED**。真实 sanitize await 断点替换外部包并加入脚本时返回 skill_source_changed，最终stage绑定已验证A的bytes，旧active和SQL事实保持，B的敏感/脚本bytes不进入publication。
- **G4-F03 CLOSED**。原独立Sql探针4/4。旧无transaction同连接外部view在rollback后才完成，`readBeforeRelease=false`、`visibleIds=[]`、`afterRollbackIds=[]`。内部callback work、闭包/嵌套访问、竞争writer、throw rollback后下一写与native优先均通过。完整legacySql core21进一步覆盖官方审核内部闭包读取。

旧首候选源码finding、F01续聊finding、F01/F02实际失败、F03原3/4 REJECTED均在旧review TEMP与仓库evidence/phase4/review-round1保留。当前接受结论针对这份修复后的固定候选与独立复验结果。

## 独立只读文件与 SQLite readback

除原测试内readback，reviewer另运行本目录 `post-runtime-readback.mjs`，使用 DatabaseSync readOnly 打开本轮新建合成 production/UI 数据库。结果见 `post-runtime-readback.json` 与日志。

- production 的10个Skill、11个版本和11份资源文件逐项满足 payload hash、manifest hash、真实bytes hash。三份 private-copy/private-history-next/private-history-cold 均为Draft，包和版本metadata无合成私有64字符片段。原Task `xitask_f78a4bfe51e711aeb172105ff56007238a3e5962bd277d975dbe0b471d6e8722` 的generation2/3分别固定V1/V2。Team目录与个人目录独立。sandbox_execution_prepared计数0，must-not-write.txt不存在。
- UI的8个Skill、10个版本和10份资源文件身份一致。Personal active V1、V2 withdrawn，Team active V2，7份approved审核记录，冷启ai_agent_runs=0，版本metadata无合成手机号。1366和1920截图已由reviewer实际查看，见 `skills-1366.png`、`skills-1920.png`。
- 该额外helper首轮误用 `file.relativePath` 导致TypeError，原SkillPackageFile字段为 `file.relative`。仅修正自有TEMP helper后readback通过。首版helper和失败记录分别保存在 `post-runtime-readback-first-attempt.mjs`、`post-runtime-readback-first-failure.log`。原固定七次suite全部在该额外helper之前通过。

实际production根为 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase4-production-6elOkc`，UI根为 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase4-ui-HSMUnQ`。原runner报告与截图另保留于仓库 test-results/xiaozhi-agent 的本轮 Ef95mp、WChyjd、IgdhSz目录。

## 性能、边界与回滚

私有源指纹采用NFKC/空白规范化UTF-16 code-unit窗口，window24、source stride8、candidate stride1。普通至少32个规范化code units连续片段包含完整源索引窗。短于24的源无窗，24–30的部分片段覆盖取决对齐，Bloom碰撞具有保守拒绝语义。每ActiveRun第一次已知私有读取或可信native历史重建时lazy分配33,554,432 bytes，结束clear后计数归零、memoryBytes=0、closed=true，迟到引用失败关闭。V8与OS物理内存回收由运行时调度。

本轮16447 sourceCharacters capture=10.3042ms，普通通用方法完整验证=39.3564ms。production九项整体耗时约2552、5244、2101、4404、3038、113、230、4123、6801ms，含真实Host/Pi初始化及工具操作。修前source片段检测不完整，性能样本与当前覆盖范围不同。这些值记录本机单次有界功能样本，P95/吞吐/总系统压力留Phase8。

Official接受范围为本地可信审核协议。Team主体关系为本机持久事实。完整云服务、外部市场/MCP执行、Job CPU/内存与持久PTY沿后续阶段合同推进。完整产品视觉/原生对话框、安装包/换机及真实模型质量由Phase7/8继续验收。本轮未独立重跑应用build或renderer246，root收到的writer同候选构建/组件证据由root保留。

回滚时关闭应用并保存SQLite、managed Skill文件树和当前证据。恢复已接受Phase3 `44cd1a5` 生产接线并重建，同时保留本阶段七张附属表、immutable包、审核/来源/撤回和Task/Journal事实。单版本失败可沿typed管理入口禁用或选择其他有效已批准版本。

root本轮提交前 npm audit 的现有依赖结果为29项，low8/moderate13/high8/critical0，较2026-11-12基线增加moderate1。Phase4未新增依赖且lock字节一致。变更metadata涉及 @hono/node-server、@modelcontextprotocol/sdk、hono、katex、pi-web-access。证据为仓库 evidence/phase4/resume-20261117/npm-audit.json.gz 与 npm-audit-delta.json。该依赖可达性与修复工作按Phase8继续，Gate4结论限本阶段固定合同。

在Phase4固定合同与本次独立执行范围内，未发现未解决P0/P1。Gate4已满足进入下一既定阶段的接受条件，整体Goal继续由root推进。
