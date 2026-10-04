# Pi 持久审批与 Hana 底层对齐验收

日期：2026-10-02。范围 P03/N04，M10/M01/M09；合同见 docs/54。完整 Harness 仍按 docs/35、48 推进。

## 底层选择与复用

Hana 0.449.0 的实际链路为 Engine → Agent/SessionCoordinator → lib/pi-sdk → Pi createAgentSession。它嵌入 SDK，没有调用 Codex CLI。小智采用同款 Pi/core/AI exact 0.80.3（MIT），复用 Hana（Apache-2.0）的会话选项、运行 registry、失败结果转换、流式保护和每轮调用去重；模型循环只由 SDK 管理。

本轮参考 Hana session-permission-wrapper/tool-invocation-permission 的双身份、目录和参数冻结及审批后重验机制，适配现有教育宿主。没有原样复制依赖多渠道/人格服务的完整引擎。ResourceIO 文件实现继续直接复用：COPYFILE_EXCL 拒绝覆盖，本轮新增可选 AbortSignal，在异步 FileRef 解析后、同步复制前检查取消。源/输出 SHA256 与差异已更新 office-agent/vendor/hana/source-manifest.json；运行闭包清单在 xiaozhi-agent/vendor/hana/source-manifest.json。

正式链路：PiEducationWorkspace → typed xiaozhi preload → production-host → Pi AgentSession → 教育/Hana 工具 → 现有 SQLite/授权本地目录。界面使用已移植 HeroUI Pro ChatTool Approval/Actions/Approve/Reject；本轮实际查阅 Pro MCP chat-tool 文档，MCP 不提供 Pro 实现源码，因此继续本地组件复用。finesse 设计参考沿用 docs/40–42。未增加依赖；Pro 再分发许可与已有发布依赖问题仍待核验。

## 实际交付

- 新增版本化 xiaozhi_pi_commands 和 xiaozhi_pi_workspaces，复用私有 SDK binding、公共消息/run/events；文件审批复用 ai_confirmation_items 的 pi_office_copy 类型。旧学生确认列表及执行入口排除此类型，没有伪造学生 ID。
- commandId 绑定本地会话和请求 hash；持久认领、同命令返回原 run、变更参数拒绝，避免重复模型调用/消息/效果。命令认领后、运行创建前退出会显示中断回执，旧命令不自动重放。
- 新会话通过 main 原生选择器授权教学工作目录；磁盘/用户根、数据根及其祖先/子目录、密钥/系统路径和链接拒绝。已有 SDK 历史不静默切换目录。
- 审批绑定会话/run/call、目录指纹、来源 hash 和相对 source/target。主进程 CAS 控制 pending → approved → executing → executed，组件按钮防重仅是交互反馈。不同会话、旧审批、来源变更、重复命令均不能绕过门禁。
- 拒绝与执行前取消保持零效果；复制过程中已提交文件不能伪称撤销。重启将 pending/approved 标 interrupted、executing 标 uncertain。待核验只比较现有文件 hash，不重新复制；核验结果再次重启保留。
- 文件文本先过已有教育脱敏再进入模型私有历史；公开事件只含审批 ID、相对来源/目标和真实状态。等待审批显示“等待确认”，工具拒绝独立显示，文件错误用可行动中文说明。

## 验收证据

所有命令在 apps/desktop 执行，报告在忽略的 test-results/xiaozhi-agent。测试使用合成教研文本/目录，不使用真实学生资料。

| 检查 | 精确命令 | 最终结果 |
|---|---|---|
| 构建 + 正式审批 UI / 真实 DeepSeek | npm run test:xiaozhi-pi-approvals | exit 0，22/22，pi-approval-ui-8u29pJ/report.json；pi-approval-complete-gate.log |
| 原有正式知识检索/发送路径 | node scripts/xiaozhi-agent/pi-production-ui-smoke.mjs | exit 0，11/11，pi-production-ui-8M2rFW/report.json；pi-p03-production-gate.log |
| 最终复制取消边界 | node scripts/xiaozhi-agent/pi-copy-cancel-boundary-smoke.mjs | exit 0，3/3，pi-copy-cancel-oJI1kL/report.json |
| 新旧 schema 副本迁移/未来版本/创建中断 | node scripts/xiaozhi-agent/pi-session-state-migration-smoke.mjs test-results/xiaozhi-agent/pi-approval-ui-tpPfvQ/data/app.db | exit 0，6/6，pi-state-migration-6F0Fao/report.json；pi-p03-migration-gate.log |
| renderer 状态 | npm run test:renderer-components | exit 0，79/79，pi-p03-renderer-gate.log |
| 构建 + 旧教育入口 smoke | npm run test:smoke | exit 0，ok=true，207/207；pi-p03-legacy-gate.log |
| 仓库空白检查 | git diff --check | exit 0，仅 LF/CRLF 提示 |

22 项包含原生选择取消、私有根拒绝、持久授权、待审批零写、同命令防重/参数冲突、跨会话拒绝、双视口、批准真实复制 hash、脱敏、目录锁定、旧确认隔离、重复批准、拒绝、停止迟到、来源冲突、审批等待杀进程、新轮不续旧复制、复制后落库前退出/只读核验、再重启、完成命令重启防重、命令创建中途退出。以上各组有重叠，不相加宣称独立总用例数；最终专项无失败/skip。

强制退出实际结束隔离 Electron 进程树。复制后提交前、命令认领后创建前故障切点只在 E2E 环境启用，真实 provider 工具历史未伪造。迁移使用隔离旧 schema 副本和全新 fixture，不代表全量真实教师库升级放行。

1366×768 与 1920×1080 审批截图已查看：来源/目标、批准/拒绝、输入和停止可达，等待状态准确。字体、窄轨道、侧栏、浮动右卡与控件样式仍未达到 Codex 一比一；不能用可达性代替视觉验收。

## 失败与修复

- pi-approval-ui-EYM7gz / QpDprA 在前 14 项后失败。核对当前 Playwright 实现发现异步 waitForFunction predicate 被直接检查 truthiness，Promise 导致提前返回；改为 Node 中有界 awaited IPC 轮询，后续 17/17、21/21、22/22 及最终 22/22 完整通过。失败报告保留。
- 初版 TypeScript 的 changes 布尔/数字适配与 useRef 初始化问题已修正，最终构建通过。
- 审批等待原先仍显示执行中；公开投影/正文/检查器已同步等待与拒绝状态。复制冲突错误同时可能来自来源变化或目标存在，文案保留两种原因，不声称来源一定变化。
- 文件复制与 SQLite 不具备跨介质原子事务；效果已落盘而结果未提交必须显示 uncertain，不能自动重放或假称全部回滚。

## 未完成范围与下一步

本切片是授权目录内只读与不覆盖复制，加已有教师知识检索。完整文档编辑、DOCX/XLSX/PPTX/PDF 产物、联网搜索/浏览器、Skills、计划/澄清/steer/followUp、预算/压缩/教育记忆整合、权限/模型设置和 Codex 一比一视觉仍待交付。实际关闭 VPN 的完整实例、Windows installer、OS shell 沙箱和全量真实教师库尚未放行。旧入口回退 OMNI_EDU_XIAOZHI_PI=0，不删除旧数据。

下一步第一项 P04：先冻结控制与记忆合同，按 Pi SDK 原生 steer/followUp/SessionManager/压缩和 Hana 协调层实现；贯通真实计划、澄清回答、活跃任务追加、预算与教育记忆作用域，保证重启后的来源/审批事实及迟到事件不越权。完成专项与实例后推进 P05 Skills、P06 界面/设置、P07 办公联网、P08 国内直连与安装最终验收，继续完整总清单。
