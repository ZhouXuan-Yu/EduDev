# 2026-11-19 小智主线合并验证

合并工作树为 `D:/WorkProject/EduProject-harness`，功能父提交为 `387a796777109cdf222e0d027e528cf6686cc479`，上游父提交为 `3ba66e5a15c7491dec6445e2c3c1ad3e6ec728e2`。主线收录已验证的小智改动，后续优化在 `codex/xiaozhi-harness-20261112`。

工作台包含跨会话任务总览、持久审批收件箱、中文能力目录和搜索。指定工具依赖可经明确的当前任务授权继续同一 Task。终端关闭后收束作业，PowerShell 缓存保存在受控临时目录。新一轮合并保留知识库功能和双方协作文档，三个生成清单基于合并源码重新生成。开发目录 `D:/WorkProject/EduProject` 当时存在其他工作，保留其检出提交和本地文件。

## 合并后验证

运行目录为上述工作树下的 `apps/desktop`。配置使用隔离的合成数据和本机 loopback 模型服务。实际 DeepSeek 计量账本用量为 0/200。

| 命令 | 结果 |
| --- | --- |
| `npm run build` | PASS，含 TypeScript 检查。481 个产物，目录指纹 `42eaa3ebfff6fc0430cc3ad4ee2f87b1954f70b8fdc1a29be9d2287ebe8cb611` |
| `npm run test:renderer-components` | 253/253 |
| `node scripts/xiaozhi-agent/phase7-workbench-ui-smoke.mjs` | 9/9，见 [Electron 原始记录](main-workbench-9.json) |
| `node scripts/xiaozhi-agent/phase7-workbench-read-smoke.mjs` | 11/11，见 [SQLite 只读专项](main-workbench-read-11.json) |
| `node scripts/xiaozhi-agent/phase7-workbench-renderer-smoke.mjs` | 14/14，见 [渲染专项](main-workbench-renderer-14.json) |
| `node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-next-parent-boundaries.mjs` | 6/6 合成边界。最初缺少参数的启动失败仅为 Node 模块解析和类型转换 |

合并前后 `package-lock.json` 相同。本轮依赖审计返回 29 条既有报告，包括 8 低、13 中、8 高、0 严重。可达性复核沿最终阶段执行。

## 继续范围与回退

固定验收矩阵 70/89 已有阶段范围证据。原生拖窗、最大化还原、全套真实授权显示、真实模型 A/B、缓存性能前后对照和最终安装包仍按原 Goal 验收。续做位置见 [进度](../../../PROGRESS.md)。

出现主线回归时，优先按对应小智功能提交做普通回退提交，并保留两边的任务与原审批记录。回退发布前重新构建原生 helper 与生成清单，复测审批及原数据冷启动。
