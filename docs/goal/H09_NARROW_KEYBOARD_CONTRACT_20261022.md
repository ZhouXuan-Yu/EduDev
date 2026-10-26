# H09 窄屏与键盘可达合同

## 最终限定结果

构建`8375c55c1fb3f66a36c2b8c550fb226e85bae8e0fe80c9b0a7ca8e24d6e8dda9`/373。产品最小宽度已降为390；`pi-narrow-interface-ui-MhwwDT`与`bmoNMB`连续两次通过1366×768浅色、768×1024浅色、390×844暗色、390 forced-colors及390冷启。`PiWorkspaceShell`在窄屏通过HeroUI `Sidebar.Mobile`显示同一个会话侧栏，Portal专属作用域补齐全高、暗色token和Dialog名称。

两次结果均：无横向溢出，主要Composer控件在视口内，Tab到附件/权限/技能/发送，快捷卡Enter可填草稿，侧栏Enter打开且焦点进入名为“会话侧栏”的Dialog、Escape返回触发器，Chromium accessibility tree含main/textbox/主要按钮和命名Dialog，0消息、0 renderer错误、构建不变。六张截图已查看，包括forced-colors和移动侧栏打开态。同构建网络、图片、文件和教师快捷入口回归通过。

保留失败：`qV9eeq`首窗口时序；`Ycq0Jf/N7OZZq`错误要求fresh profile中不可用模型选项进入Tab；`n36ODA/NbUQge`缺Mobile内容；`3toTED/YFxG8D/TtiGEe/gOGFbB`Portal样式未命中；`sJkVZJ`错误期待背景控件仍暴露在模态Dialog的accessibility tree。真人读屏软件操作、完整动态状态/点击区/对比度、长历史性能和journal压力不在本片通过范围，完整H09/H10仍OPEN。

## 目标

关闭H09中尚未验收的窄屏和键盘入口：在不改变Pi唯一生产循环、typed IPC、持久业务事实、教师确认或文件权限的前提下，教师能在窄窗口看到当前对话、快捷入口、输入框、附件/权限/技能/模型/(发送或停止)控件，以及必要的错误/确认操作；只用键盘可以完成入口选择、输入、发送和停止，不出现被隐藏侧栏或横向溢出截断的关键控件。

## 当前事实与缺口

- 正式主窗口`src/main/index.ts`当前`minWidth:1100`、`minHeight:720`，产品尚未承诺768或390宽度。
- 现有H09证据覆盖1366×768、1920×1080、125%/150% DPI与部分键盘操作，尚不能证明窗口收缩后可达。
- 350/390宽是极端适配探针，用于暴露单列布局、offcanvas侧栏和Composer换行缺陷；不能仅靠Chromium fixture替代真实Electron。
- 768是桌面窄窗/侧边贴靠的现实范围；390若实现成本超出产品边界，仍必须记录`UNSUPPORTED`，不能静默跳过或声称H09完成。

## 冻结范围

- 优先复用现`PiWorkspaceShell`、HeroUI Sidebar/offcanvas、`OfficeComposer`、`PiConversationSurface`、`OfficeConversation`及scoped CSS。
- 测试只使用owned profile/DB和合成输入，不调用模型、不写业务效果、不读日常profile。
- 为观察390布局，测试可在实际BrowserWindow上临时`setMinimumSize(0,0)`并恢复；必须记录真实`innerWidth/innerHeight`、截图和DPR。产品是否降低minWidth必须由同一反例和完整回归决定。
- 允许的小修只限响应式CSS和必要的无状态布局/焦点逻辑；不改Pi工具集、SQLite schema、IPC、权限、审批和业务数据。
- 不新增依赖、第二Loop、移动端产品承诺或远程服务。

## 实施前探针

1. 当前最终构建启动真实Electron与owned profile。
2. 在`1366×768`、`768×1024`、`390×844`分别记录实际content尺寸；390探针允许临时降低min size。
3. 检查横向`scrollWidth > clientWidth`、Composer和主对话区域的bounding box、快捷卡/输入框/附件/权限/技能/模型/发送按钮是否在视口内。
4. 键盘检查焦点顺序至少覆盖：快捷卡→输入框→附件→权限→技能→模型→发送；运行态至少覆盖停止按钮；窄屏offcanvas打开后焦点进入导航并在Escape返回。
5. 检查关键控件accessible name、只读状态与`aria-live/status`错误提示；屏幕阅读器无法在本机真人操作时，保留为需读屏软件复核的证据边界。
6. 每个失败先保存截图、DOM几何、focus/activeElement和实际视口；不得先改CSS。

## 通过标准

1. `768×1024`真实Electron中对话、输入框、快捷入口和全部Composer主要控件可达，无横向溢出，浅暗均通过。
2. `390×844`若宣称支持，主任务区为单列且输入/发送/停止可达，侧栏只能通过明确按钮打开并可用Escape返回，无关键控件被遮挡。
3. Tab顺序与当前可见控件一致，不落入隐藏侧栏；按钮可用Enter/Space激活，textarea保持正常输入/换行，发送和停止只触发一次。
4. 关键按钮有可理解的accessible name；动态错误/同步状态有可见文字和适当的`role=status/alert`。
5. 冷启不改变布局持久业务事实、不重放模型/工具；renderer无错误，build/renderer/专项/diff通过。
6. 原失败保留，证据绑定当前构建SHA和真实脚本hash。

## 明确不计通过

- 只看CSS媒体查询存在。
- 只做浏览器组件fixture，不启动真实Electron。
- 截图生成但未检查实际视口、控件边界和焦点。
- 390测试通过但产品窗口仍无法进入该尺寸却宣称用户已经支持。
- 读屏真人、全量WCAG、长历史性能和journal gap/reorder/reconnect不由本片自动关闭。

## 回滚

若响应式改动引入桌面回归，只撤销本轮CSS/布局差量，保留已生成报告和失败证据；不删除会话、审批、journal或产物，不改变窗口最小尺寸之外的持久数据。
