# U4-A 宿主阶段验证

2026-11-02 更新：8baf593 整合构建/TSC、240 组件、43 宿主与真实 Electron 完整 10 项已通过，详[桌面验收](U4_A_DESKTOP_VALIDATION.md)。下文保留首次冻结时的失败及未验范围，不把早期 TSC 失败改写为成功；B 与真实六类文件另验。

日期：2026-11-01。状态：宿主实现及 P2 修复已独立审查；renderer、整包构建和 Electron 闭环未据此关闭。本页记录任务分支的未交付切片，不代表 D 盘日常版已包含题篮。

## 实现范围

六个 typed IPC 入口沿用合法 renderer 校验；题篮及幂等记录使用现有 SQLite 的两张增量表。宿主分配条目身份、保存题面版本、检查 owner/CAS/来源资格，并在同一 paperTransaction 连接内创建确切成员快照。原自动选题不替换成手选逻辑。

新快照绑定 basketId/revision/entryIds；确认及实际 Office 文件安装仍重新核对该绑定和当前来源。UI 恢复偏好不增加内容 revision。没有注册新模型工具、调用模型、迁移资料或新增数据库体系。

## 独立审查与修复

Astra 发现一项 P2：浏览偏好的写入回执与领域操作共用累计额度，可能阻断后续增删、归档和快照。修复后新 UI 回执与新领域回执各有 10,000 条额度，既有回执完整保留，授权、规范输入匹配及已提交请求重试先于额度检查。

UI 额度满时该次偏好写入返回 unavailable 并回滚，不消耗领域额度，也不自动重试。renderer 必须明确说明偏好未保存并允许仅放弃该偏好；不能以此丢弃题目或蓝图。独立复核核对了修复的五文件 SHA，未发现新增 P1/P2；不外推为页面已接受。

修复五文件组合指纹：`d25b56340a1c9fc6edb63070878d5c80ef0c1c10b7cb0d1528028254c8371798`。shared API 指纹保持 `a1fbe00e96c0561af2c3cd116a2ba436bcde389654aada90736600130691528b`。原始交接位于本机临时目录 `omni-paper-basket-wayAFT/handoff.json` 及 `omni-paper-basket-OlkqmM/handoff-p2.json`。

## 已执行检查

以下 cwd 均为 `D:\WorkProject\EduProject-sidebar\apps\desktop`。

| 命令 | 实际结果 | 范围 |
| --- | --- | --- |
| `node scripts/education/paper-basket-boundaries.mjs` | 最终 43/43、exit 0，Sol 执行 | 真实 owned SQLite/文件、受控题源；owner、CAS、幂等、回滚、冷读、三来源策略、确切顺序、确认及真实 DOCX 安装阻断。非 Electron/模型/数学质量验收 |
| `node scripts/education/paper-export-boundaries.mjs` | 21/21、exit 0，Sol 执行 | 首次宿主冻结时的既有导出边界；后续容量修复不冒称重跑本项 |
| `node --experimental-transform-types scripts/education/paper-legacy-source-only.mjs` | 24/24、exit 0，父实际执行 | 调用未改写的原 paperBoundaries；真实 SQLite 与受控原生 Pi 流，fetch 禁用。不是新增模型运行或桌面验收 |
| `node node_modules/typescript/bin/tsc --noEmit` | 首次宿主冻结 exit 0；P2 最终检查 exit 2 | 后者有 3 处并发施工中的 renderer 诊断；不能称整包类型检查已通过。最终集成检查另录 |
| `npm.cmd audit --json` | exit 1；45 项：8 高、29 中、8 低、0 critical | 与上一记录数量一致；未升级依赖、未宣称漏洞已解决 |

43 项报告：`C:\Users\ZhouXuan\AppData\Local\Temp\omni-paper-basket-OlkqmM\report.json`；旧导出报告：`omni-paper-export-qDaRxq/report.json`；24 项报告：`omni-edu-paper-legacy-kXtHWX/report.json`。本地父日志为 `test-results/ui-goal-20261101/u4a-paper-legacy-source-only.log` 与 `u4a-audit.json`。

## 保留的失败与未验项

- 首次直接运行 paper-boundaries.mjs 在 Node 扩展解析阶段失败，exit 1、未执行断言；该文件本身导出测试函数，不是独立 runner。后续 runner 通过正常调用原函数执行 24 项，没有删除或放宽旧断言。
- 全量 `node --experimental-transform-types scripts/education/capability-boundary-smoke.mjs` 在 54 项通过后，learning-review 导入 office-pdf-renderer 时因纯 Node Electron stub 不导出 BrowserWindow 而 exit 1，未执行到 paper。原报告 `omni-edu-education-boundary-Myu8gS/report.json` 和本地 `u4a-education-capabilities.log` 保留；不冒称全量教育门禁通过，也不据此断言生产 Electron 有相同故障。
- Sol 的新题篮早期 source-loader 启动失败及一次 fixture 回调错误（20 项后失败）保留于交接，不覆盖为绿色。部分根文件构造的 TypeScript 检查因缺少完整项目 library context 失败，不作为通过证据。
- 仍须完成 renderer 乱序/失败/恢复、实际主区完整图文、前进后退、双尺寸、来源失效及最终整包构建；U4-B 的本卷内容副本编辑和无考试模式，以及后续 C/D，不由本片宣称实现。

没有性能前后基准、教师视觉接受或最终全套六类文件的本轮桌面验收结论。D 盘保持上一已交付源码，待本切片验证后再正常整合并启动。

## 并行主线资源准备

父重新 fetch 后确认主线已推进至 `be7657c52ac8d2986749a84ebb4330e5d5d76e37`，新增协作者的图文分块及窄窗标题栏修复。此时任务分支源码尚未合并该增量，前述验证不冒称在 be7657c 上执行。

独立图文分块组件的固定开发资源目录在 sidebar 和 canonical D 均缺失。父按该提交的 `page-blocks-runtime-manifest.json`，从协作者已构建的资源逐文件读取并核验 size/SHA256，再以不覆盖方式安装到两处各自的 `.local-ocr/blocks-v1-dist/omni-edu-ocr`。每处 767 文件、417,644,037 bytes 全部核验，实际命令 exit 0；没有替换原 file-v3 OCR 目录、依赖、源码、用户资料或进程。此为正式清单锁定的运行资源安装，不借用另一工作树 node_modules 或 out 充当验证。

首次操作因 PowerShell Split-Path 参数组合错误在第一个源路径检查阶段 exit 1，尚未复制；改用 .NET 路径父级解析后完成。完整本地记录：`test-results/ui-goal-20261101/u4a-page-blocks-install.json`。资源安装不等于源码已合并、图文识别准确或新日常窗口已启动；默认发行是否包含该可选组件沿用协作者合同。
