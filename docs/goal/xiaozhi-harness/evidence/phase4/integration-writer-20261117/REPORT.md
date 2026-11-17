# Phase4 整合后实施侧回归

2026-11-17，工作树为 `D:/WorkProject/EduProject-harness`。构建时 HEAD 为功能提交 `4b73441762d910a0ee811c2179449c49cdb2f95c`，root 已解决与 `origin/main 37512e4` 的合并冲突，merge commit 待 root 完成。本报告属于 integration implementation side。

## 实际执行

命令工作目录均为 `D:/WorkProject/EduProject-harness/apps/desktop`，按表顺序集中串行运行。TEMP 唯一日志根为 `C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase4-integration-20261117-fAQFNC`。全部进程 exit0，五套共 305/305 断言通过，skipped 为 0。`MANIFEST.json` 保存精确命令、日志原路径和逐文件 SHA256。

| 命令 | 实际结果 | 归档日志 |
| --- | --- | --- |
| `npm run build` | PASS，包含 tsc 与 main/preload/renderer；renderer 23.07s | `build.log.gz` |
| `npm run test:renderer-components` | 246/246 PASS | `renderer.log.gz` |
| `node scripts/xiaozhi-agent/skill-phase4-state-smoke.mjs` | 21/21 PASS | `state-native.log.gz` |
| `node scripts/xiaozhi-agent/skill-phase4-state-smoke.mjs --legacy-sql` | 21/21 PASS | `state-legacy.log.gz` |
| `node scripts/xiaozhi-agent/skill-phase4-ui-smoke.mjs` | 8/8 PASS | `ui.log.gz` |
| `npx tsc --noEmit` | PASS | `typecheck.log.gz` |
| `node scripts/xiaozhi-agent/skill-phase4-production-smoke.mjs` | 9/9 PASS | `production.log.gz` |

实际报告为 `%TEMP%/xiaozhi-skill-phase4-state-t1svba/report.json`、`%TEMP%/xiaozhi-skill-phase4-state-NhWiSK/report.json`，以及本树 `apps/desktop/test-results/xiaozhi-agent/skill-phase4-ui-j7rWXs/report.json` 和 `skill-phase4-production-vCc6A8/report.json`。同名报告已压缩归档。

因协作者更新 `main/db.ts`，补跑原实际 Electron Host/Pi 生产专项 9 项，覆盖 Creator、旧新版本、Task/Run Snapshot、私有资料捕获、续聊、冷启、Team 审核和权限阻断。16 次请求全部由 owned loopback SSE 响应，paidCalls 为 0。

UI 使用整合后新 out 的真实 Electron main/preload、现有设置导航、typed IPC、SQLite/不可变文件与冷启回读。已读取两张 1366×768 和 1920×1080 截图，保存验证失败反馈与主要动作可达证据。完整页面独立接受沿既定 Phase7。

## 整合身份与实际变化

原独立 Gate4 的 37 份 Phase4 source 继续保持相同 bytes，sourceListHash 为 `6fa2d3a63664f239c9ec05088d9f26670cc2f9547de40684d15b65ba3b42a628`。原 12 份依赖中 `apps/desktop/src/main/db.ts` 已变化，当前为 398948 bytes，SHA256 `3484fc36a42f3539cfd8a4c178ac36d5e5b31c2b5a84be61c25658e66e0ce7f7`。其余 11 份依赖保留原身份。

本轮记录整个 `apps/desktop/src` 的 1588 文件清单，其中包含 generated 文件。build 前、build 后、测试后保持相同字节，列表 SHA256 为 `aebaaab27fc91de27a4d8c3c33c6cd4446f24490e74ed4395bbdc199ff1e9263`。三个完整身份快照分别归档为 `before-build.json.gz`、`after-build.json.gz` 和 `after-tests.json.gz`。

整合后 out 为 467 份文件，列表 SHA256 为 `f7db20b95a694adf3853357f861968941433a8b6429242c86f1a0492b5cd79e6`。相对整合构建前的 466 文件增加 12 个路径、移除 11 个旧 chunk 路径、3 个同路径文件改字节。精确集合见 `output-delta.json.gz`，build 后至测试后 out 的全部字节保持一致。主入口 `out/main/index.js` 为 4731827 bytes，SHA256 `f0dab4aefad2ebd39b6ca8166b11feb29b60677a31d3b65fb51889c78277efa1`。

列表哈希均为身份收集器产生的 `{path,size,sha256}` 数组之 `JSON.stringify` UTF-8 SHA256，目录逐层使用英文 localeCompare 排序。归档 `identity-collector.mjs.gz` 保存相同计算方法。旧输出路径在新构建中消失时明确保存 missing/removed，当前输出清单另以实际文件树核验。

| 构建身份 | bytes | SHA256 |
| --- | --- | --- |
| sandbox helper | 47104 | `d0d1a92473cd017ef5e56a3d37940e21fc3c4f3b1a69cdf41ea1c3d217d9e56a` |
| Native stat artifact | 88737 | `bf8b322e1af99bc7c9907f0eb6e1d75d6ab620824728fef8d3f1014d4aab5274` |
| sandbox-manifest.json | 3487 | `79d75a116152f82b08b1c8ead7f954e7e98beb311114063008a8db911b1b6ac2` |
| native-stat-manifest.json | 3895 | `819aca5629e4c55fa3e4605e1c1e824af2964e75412dded68d71a34662d8a438` |

上表、`NativeSandbox.cs`、`PlatformInfo.cs` 和 `TrustedRuntimes.cs` 在 build 前后及测试后均保持逐字节一致，build 日志记录 permission runtime reused 为 true。资源安全矩阵继续引用已接受原 helper 的阶段证据。

## 证据与释放

20 份压缩原始证据已逐一解压核验 SHA256。`VERIFICATION.json` 保存受测身份、源/依赖/输出变化和最终冻结状态，SHA256 为 `c4850e334efecbce778baaf65dcaf4176185168418c1e9ff616fb1600de76008`。`MANIFEST.json` SHA256 为 `c6b1b50bfb701eff1da2c64e2620bdd019c0a5a41e335d8bc46f10500b44f39d`。

仓库 `git diff --check` exit0。全部自有 Electron/Node 测试进程已结束，已向 root 发送 `INTEGRATION_RUNTIME_RELEASED`。源码/out 冻结在本轮新身份，merge commit、正常推送和下一阶段 RELEASE 由 root 接续。付费累计 0/200。
