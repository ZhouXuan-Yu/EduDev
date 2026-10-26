# 对话体验修复交付记录 · 2026-10-23

对应 [原始审查](REVIEW.md) R01–R12，按 [交付合同](IMPLEMENTATION.md) 顺序实施。范围为 M10 对话体验及 M04/M05/M09 入口；Pi 仍是唯一编排，不变更 SQLite schema、正式用户数据、云端上传规则或既有 Office 审批。

## 修复对应表

| 问题 | 本次实际行为 | 验证 |
|---|---|---|
| R01 数学不可读 | 现有 Streamdown 接入官方 math 插件和 KaTeX；聊天、保存预览、教学文件详情统一渲染，原始 Markdown 不变 | 行内、块级、分式、多行、表格、不完整与错误公式；真实回复和教学文件详情 |
| R02 草稿丢失 | 按会话在本机保存未发送正文与技能选择；发送被接受才清除对应原文；存储失败提示 | 会话 A/B 切换、真实退出重启；损坏/不可用存储边界 |
| R03 等待不明 | 宿主真实准备/模型请求/首字事件驱动阶段与计时；活动工具优先显示；长等候提示 | 正式 provider 事件及工具路径；无隐藏思维链、无虚构百分比 |
| R04 空库多轮检索 | 每次请求前核对来源存在性，隐藏已知为空的读取入口；未开启记忆不提供其读取入口；短备课先直接给有假设的建议 | 原始备课提问复测，调用清单/时长分开记录；不保证网络或模型首字时长 |
| R05 空操作像成功 | 工具公开回执增加有界数量、脱敏查询、discovery/read/operation 摘要；0 项明确“未找到匹配” | 真实附件列表/读取、真实资料无匹配；摘要不复制任意原始 payload |
| R06 无交付入口 | 中文复制/修改/保存操作；选区修改先准备可编辑草稿；正文预览、教师确认、系统目录选择后保存 Markdown 到既有教学文件库 | 真实剪贴板、鼠标选区、不自动调用模型、取消零写入、SQLite/文件与来源会话读回 |
| R07 停止无继续 | 停止后“准备继续”，将未完成片段和不重复写入要求放入输入框；由教师决定是否发送 | 流式停止、部分正文、继续不新增 run、重启恢复 |
| R08 阶段混淆 | completed 才标最终答复；failed/interrupted 持久化 partial_answer；历史过程文字折叠 | 实时投影、持久 publicItems、退出重启一致 |
| R09 面板挤压 | 新偏好默认关闭辅助栏；既有显式偏好保留；技能管理等次要入口收进更多菜单 | 首次隔离 profile 与两种尺寸/主题的控件可达性 |
| R10 空白聊天泛化 | 首屏直接提供备课、题目、错题等教师任务建议；点击只填草稿 | 实际点击与草稿、不自动发送 |
| R11 输入区过载 | 运行中追加指令用有名称的模式选择和一个发送按钮；失败保留可编辑文本，草稿冲突给提示 | 组件兼容检查、会话恢复与修改草稿路径；附件/停止能力保留 |
| R12 目录误作依据 | 仅完成的正文读取/核验进入本轮回复来源；目录枚举不是证据；无依据明确提示，旧回复保留各自来源 | 读/查范围区分，附件来源，回复内与侧栏共用来源过滤 |

## 数据、安全与兼容

新增窄通道 `xiaozhi:reply-export`，由 typed preload 暴露。renderer 只能提交版本、会话/run/item、请求 ID、正文 SHA256 与标题；不接受任意正文或路径。main 限主窗口主 frame，重新读取该会话持久化 Pi 回复并核验 SHA，教师在本机选择目录后再次校验；使用现有 `document_artifacts` 与导出服务。重复请求读回同一记录，外部修改文件不覆盖；取消、哈希变化或权限失败不写入。新按钮当前仅保存 Markdown；Word/PDF 仍走既有流程，本次没有宣称新增 Office 版式验收。

共享事件新增可选 activity/resultSummary，旧事件缺省保守显示；旧正文读取按既有宿主标签兼容，未知结果不臆测数量。所有运行、附件、资料导入和文件测试都在独立 Temp 数据/profile/导出目录，未对日常数据库或学生资料写入。回滚为本片代码回退；无数据库迁移。

新增精确锁定依赖 `@streamdown/math@1.0.3`（Apache-2.0），按 [官方 math 文档](https://streamdown.ai/docs/plugins/math) 接入。相对 lock 新增 13 包，安装内容约 302,174 字节；其依赖许可证为 MIT/ISC/Apache-2.0，复用已有 KaTeX，无原生编译组件。Windows 发布包和安装器体积没有重新测量。聊天操作复用当前 Pro 的 `ChatMessage.Actions/Action` 与既有 Modal/Composer，参考 [官方 ChatMessage](https://heroui.pro/docs/react/components/chat-message)，没有新增 UI 框架。

## 验证记录

工作目录：`C:/Users/ZhouXuan/.codex/worktrees/1c54/EduProject/apps/desktop`。实际页面为本工作树 `out/renderer/index.html`，本工作树 Electron 43.2.0，真实 DeepSeek 配置仅用于请求，不输出或改写密钥。

| 精确命令 | 结果 | 证据 |
|---|---|---|
| `npm.cmd run build` | exit 0，包含 TypeScript；已修复 Undici Headers 到 Web Headers 的适配错误 | `test-results/chat-audit-20261023/build-final.log` |
| `npm.cmd run test:renderer-components` | 217/217 | `test-results/chat-audit-20261023/renderer-final.log` |
| `node scripts/xiaozhi-agent/chat-experience-boundary-test.mjs` | 16/16，含 TeX 括号/方括号及代码保留 | `test-results/chat-audit-20261023/boundary-final.log` |
| `npm.cmd run test:smoke` | 207/207，兼容性检查；与真实 provider 实例分列 | `test-results/chat-audit-20261023/smoke-final.log` |
| `node scripts/xiaozhi-agent/chat-experience-electron.mjs` | 23/23，success true，renderer error 0 | `test-results/chat-audit-20261023/electron-accepted.log`、`test-results/chat-experience-qNkoc4/report.json` |
| `git diff --check`（仓库根） | 结果见收尾证据 | `test-results/chat-audit-20261023/closeout.json` |

最后实例为 `test-results/chat-experience-qNkoc4`，Temp根为 `C:/Users/ZhouXuan/AppData/Local/Temp/omni-edu-chat-experience-ZIsHV2`。23 项检查、5 个真实回合（4 succeeded、1停止后blocked）、2 个教学文件记录（一个UI保存、一个幂等/外部改动边界测试）均有记录，失败0、skipped0。原始备课提问复测：首字 **10.99秒**、终态 **20.62秒**、工具 **0次**；原审查17.08/72.62秒、5次工具。两者是本机不同时间的单次真实请求，不能视为平均加速率。中间一次同题仍调用计划/关闭记忆，约65.18秒；过滤关闭记忆并补短任务指引后另一次26.10秒、0工具，但暴露TeX括号显示问题。最终修复对 `\\(...\\)` / `\\[...\\]` 做仅渲染、识别代码区域的兼容处理，保留原文；16项边界与最终实机均通过。

精确路径、通过数、真实调用时长、SQLite/文件记录与构建 SHA 写入同目录 closeout.json。测试未启用产品 mock 模式；原生文件选择器由测试替代为明确的取消或 Temp 选择，以免自动化操作用户目录。老师问答、附件内容、工具执行、provider 请求、数据库、原生剪贴板、文件导出和重启均实际运行。217/16以及最终build在最后公式补丁后执行；207兼容smoke在此前执行，后续仅增加渲染定界符兼容、中文操作标签/详情公式复用和短任务指引/关闭记忆过滤，最终build与专项正式Electron覆盖变化，未重复整套207。

测试过程中保留失败记录：初次导出字段数校验错误已修复；一次资料导航命中了隐藏同名按钮，改为可见工作区内定位；原始提问复测发现模型仍调用计划/关闭状态记忆，随后补充短任务指引及关闭记忆入口过滤；原始提问输出TeX括号仍不可读，补渲染兼容后通过。早期18/20项实例只作阶段证据，不替代最后实例。截图可能捕获Modal动画过渡帧，最终视觉复核另保存稳定预览帧；不把过渡图当作最终静态样式结论。

## 尚未证明的边界

用户后续明确授权每轮Git提交和推送。本次提交前实际执行npm audit：15项（critical1/high7/moderate2/low5）；这不是安全门禁通过，未运行audit fix或跨域升级。告警涉及现有Electron/DOMPurify/网络等依赖和新增math依赖链，原始JSON保留于test-results/chat-audit-20261023/npm-audit-baseline.json；UX-00另比较原始lock并记录，不把依赖总告警当成本片新增15项。

首字速度仍受 provider/网络波动影响；本次不把减少空读取等同于稳定低延迟。没有证明每次模型都不调用可用计划工具，也没有把一次回复认定为所有练习答案正确。未重新验收安装器、125%/150% 系统缩放、Office/WPS/A4、真实教师长期使用、长教材或整体 Master Goal。产物保存是原文落盘和可追溯，不替代教师内容审核。
