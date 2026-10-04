# 小智办公 UI 复用组件验收

日期：2026-10-02；合同 docs/40，视觉基准 docs/41。组件切片通过，正式主链及整页验收未完成。

## 实际复用与修改

- 已调用 HeroUI Pro MCP 获取 PromptInput 文档/CSS、ChatConversation CSS 与 Dropdown 文档。Pro 实现源码不暴露，按项目规则复用既有本地源码；22 份原始组件文件 hash 一致。
- finesse 固定 commit、产品/AI 工作台规范与 relay 实例读取完成，保留 MIT notice。HeroUI Pro 再分发许可证仍需核验，不能按 npm OSS 包许可证推断 Pro 源码授权。
- 新 OfficeConversation 直接消费 OfficeProjection，保留真实 itemId/顺序、commentary/final_answer、工具状态/实际时长、压缩/失败状态；不展开隐式推理或原始工具结果。
- 新 OfficeComposer 复用 PromptInput/Dropdown：发送快照、立即清空、防重、失败独立重试、模型选择冻结、停止请求/失败反馈及会话状态隔离。
- 原始组件只适配两处：IME/defaultPrevented；用户滚动取消已排队自动滚动 RAF。新局部样式修复工具栏裁切、按钮内图标/文字对齐与正文继承字号。没有新增 npm 依赖、业务表或 IPC。

## 命令与结果

在 `apps/desktop` 执行：

```powershell
node scripts/office-agent/office-ui-component-electron-smoke.mjs --projection test-results/office-plan/codex-p0-146P9Y/public-projection.json
npx tsc --noEmit
npm run test:renderer-components
npm run test:ai-enter-submit
npm run test:smoke
```

仓库根：`git diff --check`。

| 门禁 | 结果与范围 |
| --- | --- |
| Office UI Electron 组件专项 | 9/9、0 failed、0 skipped、exit 0；`test-results/office-plan/office-ui-ykQVbJ/report.json` |
| TypeScript | exit 0 |
| renderer-component-states | 79/79，exit 0 |
| ai-enter-submit | passed=true，exit 0；新 IME 行为另由 Electron 组件专项实测 |
| build + 现有完整 Electron smoke | `npm run test:smoke` exit 0、ok=true；该脚本不提供独立断言数量，不伪造计数 |
| whitespace | `git diff --check` exit 0，仅既有 LF/CRLF 提示 |

专项 9 项：真实 DeepSeek 历史五条消息的 item/phase 保持；私有额外字段不进页面；IME/229/Shift+Enter；清空/快照/重复发送；失败重试保留新草稿；模型菜单/运行冻结/停止失败反馈；用户上滚后新正文不抢滚动与回到底部；切会话后旧失败不污染新草稿；两个视口中外壳及内部控件可见。

消息数据来自已通过真实 provider 验证的 `codex-p0-146P9Y/public-projection.json`，SHA-256 `97dc8096cab7e32252fc2919694010d1f453df65a2cb80968d92b5ebac373472`。输入回调、停止错误、菜单额外选项和长文滚动使用明确的合成边界；不称为生产 API/审批闭环。

截图 `office-ui-ykQVbJ/components-1366x768.png` 和 `components-1920x1080.png` 已查看；对应实际 PNG 尺寸与测试 CSS 视口相同，组件控件无裁切。当前截图只有消息列和输入组件，没有完整侧栏/窗口/设置，不能作整页一比一证据。

## 失败与修复保留

- 早期 8/8 仅检查输入外壳位置，截图发现内部工具栏被裁切；该报告不作为最终可达性证据。增加所有按钮/textarea 的可见外壳边界检查并修复定位。
- Tooltip 包装产生同名嵌套 button；本切片移除滚动按钮的多余包装，保留可访问名称。
- 用户上滚后已排队 RAF 会再次拉回底部；修复原始滚动组件，并在两个实际渲染帧后验证位置。
- 模型状态和切会话测试曾读取提交前的旧 React DOM；改为等待 disabled 与 sessionId 标记，不靠旧输入刚好为空判断新会话已生效。
- 失败报告仍在对应 `office-ui-*` 隔离目录保留，最终只引用最新完整专项结果。

## 未完成与继续位置

H05 系统沙箱初始化授权待答复；不改变账号、防火墙或权限策略。P0 整体尚未放行。A02/A04/A07 的宿主、订阅、SQLite 与 A05 新入口仍未接入。后续绑定实际命令时，onSubmit 返回任务接收确认，模型执行失败由 turn 状态表达；宿主必须提供请求幂等，不能把组件防重当持久幂等。每会话草稿持久保存、审批/文件卡、整页布局、Skills、设置与最终办公实例继续按 docs/35 实现。
