# 教师体验与状态变化：实现说明

本轮将用户的八条体验原则应用到已冻结的 18 页导航与设置入口，不重新设计页面，也不改变宿主授权。实现提交为 `4996957`，随后正常整合 main 的历史记忆提交至 `f3a07f9`。最终构建、交付和未通过项以同目录 RESULT.md 为准。

## 根因和修复

| 项 | 原因与触发 | 本轮处理 | 证据层次 |
|---|---|---|---|
| U01 学生归属 | 切换学生仍共享记录草稿，旧列表/迟到回执可能落在新学生上下文 | 按学生隔离内存草稿；记录和历史报告按当前学生投影；提交回执核对 owner/revision，跨学生提示点名原学生；新建待回执只锁该份表单 | 组件、真实 Electron、原接口读回 |
| U02 时间 | datetime-local 使用 UTC 截取；只改标题也会改原时间 | 局部日期转换；未编辑时间时保留完整原时间戳；无效时间明确提示 | 组件、Asia/Shanghai 实机、重启读回 |
| U03 复盘 | 保存回执覆盖新输入/切换报告；全局 saving 混入当前报告状态 | 提交锁与草稿状态分开；按报告保留修改；生成/保存核对当前对象；放弃仅影响明确点名的报告；离开前保护未保存内容 | 延迟回执组件检查；综合 smoke 单独记录 |
| U04 备课本 | 切换丢稿；子笔记回读版本覆盖未保存改名；旧稿借新版本覆盖并发编辑 | 同本返回沿用草稿；换本明确确认；元数据保留已读基线并检测同字段冲突；笔记绑定打开时版本；明确刷新/放弃重建基线 | 组件并发夹具、真实保存及重启；未将夹具称为双窗口实测 |
| U05 删除 | 单次按下直接删除，后果和对象不清 | 复用 HeroUI Modal，显示对象与恢复边界；取消默认获焦、Esc 返回；整本删除也明确说“删除” | 组件回调、实机取消；综合 smoke 验证隔离虚构数据的完整流程 |
| U06 文件列表 | 读取失败同时显示空列表、零文件 | 未知/失败与真正空态分开；保留旧读数并给重试 | 拒绝读取组件夹具 |
| U07 模型状态 | 未读出设置等同于未配置 | 未知、加载、未配置分开；复用原读取接口重试 | 拒绝读取组件夹具；未改设置服务 |
| U08 搜索 | 用同名标题筛选，丢失结果和焦点；旧记录不在默认前 100 条中 | 保留查询/结果/返回行；按真实 ID 分页定位，找到后才成功；导航意图与读取 epoch 拦住迟到结果 | 组件、超过 100 条真实本地记录的 Electron 路径与后退焦点 |

## 动效按状态变化统一

| 状态变化 | 实现 |
|---|---|
| 按下/悬停/焦点 | 应用控件使用 60ms 按下反馈、120ms 颜色过渡；焦点轮廓不延迟 |
| 展开/收起 | 应用导航使用 180ms 网格过渡、旋转图标；内容保留挂载，收起 inert；原厂 Disclosure 保留原厂行为 |
| 页面内容切换 | 只对应用内容表面做轻量 opacity 入场，快速反向承接当前透明度；不重挂载表单，不重播流式内容；对话页不套页面入场 |
| 窄窗导航 | 展开有轻量位移；关闭、Esc、外点直接回应；打开期间正文 inert，关闭后恢复可操作性 |
| 拖动/调整尺寸 | 每帧合并更新，结束落最终值；Esc/取消恢复起点；只在提交/短暂稳定后保存偏好，不为宽度加追赶动画 |
| 计时/数值 | 应用计时使用等宽数字，避免数字宽度抖动；不对流式 token 或列表每一行追加入场动画 |
| 加载/成功/出错 | 明确区分读失败、空态、保存回执与刷新失败；不因动画延迟真实结果 |
| 减少动态效果 | 应用 motion token 归零；关闭应用旋转动画；原厂组件继续使用原厂兼容机制 |

未改变 OfficeComposer、底部工具栏/弹层、消息队列、PiComposerPendingPanel、HeroUI 内部样式或 vendor。main 整合带入的历史记忆功能归原作者维护，不是本轮重写。

## 文件边界

- `interaction/student-record-draft.ts`、`interaction/locate-record.ts`：拆分学生草稿、日期、分页定位；App.tsx 仅连接现有用户操作和数据。
- `components/ui/ActionConfirmation.tsx`：官方 Modal 的业务确认适配，不重画组件。
- `ReviewReportWorkspace.tsx`、`TeacherNotebookWorkspace.tsx`、`GlobalSearchWorkspace.tsx`：按对象处理草稿、保存、切换与恢复。
- `TeachingArtifactsWorkspace.tsx`、`PiModelSettings.tsx`：读取失败与未知状态。
- `ui-system/motion/`：应用动效 token、内容入场、保留挂载的折叠区；main.tsx 只导入专用 CSS。
- `ColumnResizeHandle.tsx`、`EduShell.tsx`、`WorkbenchNavigation.tsx`：直接操控、终态、导航和焦点。
- 现有应用 CSS：将应用自有的散落节奏统一到前缀变量；不向全局 styles.css 堆补丁，不使用全局 !important。
- `scripts/ux-motion-*.mjs`：可复跑专项、页面矩阵和实测版本启动；`electron-smoke.mjs` 保留原断言，增加取消/确认删除步骤以适配真实交互。

## 参考与复用

采用目的明确、快速且可打断的状态变化，参考 [Apple Motion](https://developer.apple.com/design/human-interface-guidelines/motion)、[Apple Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) 和 [MDN reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion)。这些原则不构成“完全达到苹果原生表现”的证明。

HeroUI 官方 MCP 本轮可用，已核对 [Modal](https://heroui.com/en/docs/react/components/modal) 的 controlled state、退出和焦点管理，以及 [Disclosure](https://heroui.com/en/docs/react/components/disclosure) 的原厂状态/动画。没有新增组件库。

GPT 6.2 Astra 高强度作为只读顾问多轮复审。最后三项已确认解决；约定范围内未留下 P1/P2，交付判断仍以本轮最终测试和剩余门禁为准，不代替教师试用。
