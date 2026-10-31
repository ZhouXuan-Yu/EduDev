# U2–U5 三项 finding 只读复核

2026-11-01，Astra。协调器报告阶段提交1f6a5af、统一build退出0；本次读取当前源码，未运行Git、构建或测试，不修改生产及U6文件。

## 原 finding 闭环

| 原问题 | 当前源码证据 | 结论 |
| --- | --- | --- |
| 原生快捷键绕过材料dirty | DesktopFrame.tsx:31–46 在native命令分发和navigate前执行guard，62–65覆盖历史；useMaterialDraftGuard.ts:6注册，MaterialBodyPanel.tsx:32合并original/AI/study dirty | 源码闭环；拒绝的命令直接消费，不留待保存后重放 |
| 蓝图跨页丢稿 | PaperBlueprintWorkspace.tsx:19注册draftEdited/busy，44–49提供明确放弃恢复路径；App.tsx:setActiveView先检查navigate返回值 | 原离页丢稿路径已阻断；存在下述定向交接回归 |
| 确认A期间打开B导致B永久busy | PaperReviewPanel.tsx:11–16 按sessionId+paperId重建PaperSnapshotReview，旧实例清理generation使迟到响应不回写，新实例busy独立 | 源码闭环 |

学生档案：App.tsx:469已将非closed编辑态注册统一guard；切换学生仍保留原显式放弃确认。此结论只覆盖已查档案编辑入口，不扩大为全部学生表单已验收。

只读检查 `scripts/desktop-navigation-guard-test.mjs`：包含native settings/new-chat/files/sidebar、前后退、navigate返回值、被拒命令不重放、App更新顺序以及材料三类dirty合并。未在本次执行该脚本。正式Electron验证由协调器负责。

## P1 新回归：组卷“前往小智补充题组”被自己的dirty guard拦截

定位：`apps/desktop/src/renderer/components/PaperBlueprintWorkspace.tsx:19,24,50–52`；`paper-ui/PaperBlueprintEditor.tsx:21,32`；`desktop/DesktopFrame.tsx:44–46`。

可达路径：新蓝图切换AI原创或混合模式 → modeChange调用change令draftEdited=true → 点击“前往小智补充题组” → supplement（没有上下文时先创建会话）调用navigate → 自身dirty guard拒绝。留在组卷页，没有将完整蓝图交给小智。若按提示先放弃修改，会恢复默认/已保存蓝图，丢掉原待补题要求；反复点击在无contextOwner时还会先创建多余会话。

建议写集仅限组卷交接和必要的导航接口：增加明确的“保留并交接当前蓝图”确认，先捕获完整蓝图/上下文及可恢复草稿，再在用户明确交接后完成受控导航；只释放本owner的这一条已确认动作，其他dirty owner仍有效。不得把全局guard关掉，也不得要求放弃目标蓝图才能补题。创建会话应在交接获准后执行并有单次请求保护；确认弹层取消不得创建会话或改稿。

验收：无已确认题组的新蓝图分别选AI原创/混合、修改标题和配额 → 点击补题 → 取消保留全部字段且无新会话 → 确认后只创建/复用一个会话，composer draft含原完整蓝图；返回可恢复该蓝图；其他脏稿保护继续生效。真实模型调用不属于验证这个导航回归的必要条件。

未扩大重审U1、U6或组件内部设计。该finding是guard引入的业务交接阻断，不是此前源码尚未完成的瞬时状态。

## 最新复核补记

- 原三项源码修复仍成立。已读取现有 `checks-u1-u5/desktop-navigation-guard-test.log`：success=true、16项；`paper-draft-decision-interaction-test.log`：success=true、24项。这是已有挂载组件/preload fixture测试记录，不冒充真实Electron复测。
- 学生目录修复：App.tsx:1556先处理未保存确认，1557调用rememberStudentContext，之后才设置activeStudentId；StudentWorkbench.tsx通过同一helper维护显式选择偏好。取消切换时不会写入B偏好；旧route目录选择B后，返回home重新挂载可读到B，源码路径闭环。
- 已读学生真实UI报告 `students-live/run-t8gEFA/report.json`：11项已通过，整体success=false，返回home缺陷为该次真实运行失败；不得改写旧报告为成功。协调器回报修复已commit、聚焦测试41项通过，最终构建后Electron回归仍待执行。
- 本次再读PaperBlueprintWorkspace.tsx，补题导航仍是先建会话再navigate，guard仍检查draftEdited||busy；上面的P1仍未闭环。未把它列成新重复finding，也未改生产实现。
