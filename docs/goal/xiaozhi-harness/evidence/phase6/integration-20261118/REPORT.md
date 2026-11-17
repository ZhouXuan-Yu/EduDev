# Phase6 合并整合验证

INTEGRATION_SOURCE_DONE / RUNTIME_RELEASED。固定整合门禁 493/493 PASS，FAIL 0，skipped 0，全部 runner 完整 exit 0。实际付费 provider 调用为 0。测试与大体积合成资料使用 owned C TEMP，主数据目录与其他 worktree 未作为测试输入。

实际工作树为 `D:/WorkProject/EduProject-harness`。验证时 HEAD 为 Phase6 功能提交 `2376c8433df55e49c33c64b3b4fbdab6ba981a73`，MERGE_HEAD 为 `09d7937a1bf6eaa616ccdcb2ee4897fa670bc8c4`。root 持有当前正常 merge 和 Git 操作。原 Phase6 独立23项及其旧冻结记录继续保留。

原始输出目录为 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase6-integration-writer-20261118-1794947495769`。本目录的 RUNS.json、logs、reports、screenshots 与 manifests 保存精确命令、报告原路径、hash、逐项断言和受测 manifest 原字节。

| 实际命令 | 结果 |
| --- | --- |
| npm run build | exit 0，含全 src tsc --noEmit |
| npm run test:renderer-components | 253/253，exit 0，包含新主线7项 structureReview |
| node scripts/electron-smoke.mjs | 207/207，exit 0 |
| node scripts/xiaozhi-agent/phase6-job-recovery-parent.mjs --only 'J02,J03' | 2/2，exit 0 |
| node scripts/xiaozhi-agent/phase6-terminal-ui-smoke.mjs | 10/10，exit 0 |
| node run-synthetic-boundary.mjs native-reader-boundaries.mjs | 6/6，exit 0 |
| node run-synthetic-boundary.mjs native-gap-boundaries.mjs | 15/15，exit 0 |
| git diff --check | exit 0 |

前三项按 build、renderer、完整 Electron smoke 顺序执行。正常 Host 后再执行实际 UI，使用同一最终 source/out 身份。run-synthetic-boundary.mjs 为本次 owned TEMP 启动器，先导入仓库原 register-source，再调用原脚本，仅将 cwd 指向 owned C TEMP，让原128 MiB合成 PDF 也位于 C 盘。实际 Node 命令的绝对路径和 cwd 在 RUNS.json。

新 native reader 脚本逐字读取后确认自行生成 PDF。实际134217728字节合成文件只读131756字节，原脚本完成 owned 路径核对后清理该合成目录。native gap 全部使用内存 OCR/native fixtures，覆盖来源变化、冲突、取消、低置信度与有界补缺。真实教师 PDF 和目录脚本本轮未运行。

正常 Host 报告为 `xiaozhi-phase6-job-recovery-zvZDri/report.json`。持久 ACK 后 Effect Commit 失败的 unknown 通过原 Teacher review 本地 proof 核对，再完成 Task 与 Job 清理，原 command 无重送、确认阶段无新增模型。两个场景单次观测耗时约470.14 ms和266.57 ms，原始 durationMs 保存于报告，此数据用于本次运行定位。

真实 built UI 报告为 `xiaozhi-phase6-terminal-ui-evidence-GbLXFF/report.json`，10/10、rendererErrors为空。1366×768与1920×1080均实际输入 UTF8、读取原 Task 恢复事实并检查停止按钮中心无遮挡。Ctrl+C、同 Task/Job 自然消息续接、typed EOF、可见 Teacher 复选控件与确认按钮、原 Job 关闭、冷启只读历史均通过。此组 Pi 模型请求4次均为 loopback SSE，教师本地控制和确认阶段增量0，与原 Phase6 最终 UI 的模型请求数相同。延迟与缓存准备的正式性能对照继续按 Phase8 合同执行。

| 身份 | build 前已合并源码及旧输出 | build 后本轮最终候选 |
| --- | --- | --- |
| 生产文件数 | 1711 | 1711 |
| 生产列表 SHA-256 | f4bd8d0d21dbf1ad9a702a256df3babb71a69c815b8cc53994a77de3ff58192c | 00ee45a249a6f9633d31f95566915cb2b8b98c1848e658d237ef86f4f0b3c74e |
| out 文件数 | 478 | 481 |
| out 列表 SHA-256 | 0d55a2c48707128e75ad75077177ecb8d4d4b78faf01e6e7df3581778ae556ad | 6c73be681082a3e6354f56516a32d3d310fc85f6d2dc2c470386e79cf442d8bc |
| core 输入数与 sourceHash | 617 / 1ec5576c70f76863b61e0f77fb5ad7369fd9dff7c64db06adbd938d866f5c00d | 618 / 99dd134fc454b0856f3e6595f8506092091d6e876c701700fb03b2892bd1dfeb |

最终 freeze.json SHA-256为 `97bfc1662f937f9bafcc8cac2eac485ae507b5713244eb3a9d031b0f8e662a1d`。测试终态复核1711生产文件、25个Phase6脚本、全部仓库验证脚本及481输出，漂移全部为0。73个已安装直接依赖 package.json 和 node_modules/.package-lock.json 前后也为0差异。package-lock仍为 `7feeb79907fe3a231d9f9b1d0fd3023684c739d5c791eea5b1bddf6a1b095bc9`。docs、Goal状态和独立Phase8准备脚本由root另行管理。

本轮没有手改业务源。build正常重算两份生成 metadata，完整差异在 build-delta.json。

- core manifest 按合并后的 db/local utility 入口重算，618个输入逐项hash验证为0差异。
- native-stat manifest 仅更新 sources 中 local-utility-host.ts 的摘要，从 `53093c90dd5e4d9a86ab7470191c3a46968895dc7f1745b280c4e74e80b10c10` 到 `401c6710b1b45ca27cdcd924b3a3d2724bbd26966ad070d7a98c9c7fcfefc4c1`。受测 raw manifest SHA为 `98196fd775bb40c677173f884fe6a5661b17350d4153b0463f3fc438f901df6a`。bundle仍为 `bf8b322e1af99bc7c9907f0eb6e1d75d6ab620824728fef8d3f1014d4aab5274`，其余顶层metadata一致。
- sandbox raw manifest仍为 `73deea186d758f1f44781deaebe50b811ce79ff179f726e03a89d6e2ae0c3bb3`。helper58880字节，SHA仍为 `f68e8cb75f0b7cb0f8d1a0eae491163aea3545044d8b491ebef5e6266be079e8`，build复用原二进制，C#、adapter与TrustedRuntimes输入核对通过。
- 最终新增输出包括 pdf-text-worker.js 与 native text/page preview分块，另有正常内容地址替换。build-delta.json保存27个路径的增删或字节变化，最终净增3项。481项共同参与本轮最终冻结。

本轮没有新增依赖。root原fresh audit35项适用同一lock身份，实际可达性与性能按Phase8继续。整合没有重跑整个Phase6/KB领域矩阵，历史领域报告保留其原身份。真实教师资料、新结构自然质量、其他OS、真实provider及打包迁移不计入493项。

当前merge尚由root完成。正常合并提交、atomic push与Phase7正式release在本报告交接后执行。生产和out已冻结，RUNTIME_RELEASED.json记录本writer的关闭与运行窗口归还。
