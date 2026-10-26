# H05 任务步骤确定性绑定合同

状态：`LIMITED_ACCEPTED`

日期：2026-10-22

关联：H05、教师“一张错题到少量练习”主线、题卡/练习卡准入

## 教师结果

教师确认错题文字后，模型已经采用“先提交变式题卡、再提交练习卡”的计划时，即使模型偶然漏填工具参数里的 `taskStepId`，小智也应继续完成当前唯一、已解锁的步骤，而不是让教师等待后失败。宿主仍必须拒绝没有计划、多个同类型可执行步骤、依赖未验证、步骤资源或工具不匹配的调用。

## 真实失败

`education-journey-R5JJQX` 的 native JSONL 证明：

- `update_task_plan` 返回 `adopted:true`；
- 计划包含唯一的 executing `saved_questions` 步骤 `variant-card`；
- 下一次 `education_propose_questions` 参数漏填 `taskStepId`；
- 宿主执行边界在底层题卡工具前返回 `task_plan_required`；
- 模型随后结束本轮并如实说明题卡未提交，教师侧等待核对卡超时。

这不是模型内容错误或网络错误；失败保留在 owned 证据中。

## 实现规则

1. 模型和工具说明继续优先要求目标工具在顶层传 `taskStepId`。
2. 缺少 `taskStepId` 时，宿主先刷新当前 run 的独立证明，再从**最新同 run 计划**查找目标工具所属 criterion kind 的匹配步骤。
3. 只有恰有一个 `executing` 匹配步骤时确定性绑定；没有 executing 时，只有恰有一个 `pending` 或 `needs_fix` 匹配步骤才绑定。
4. 多个匹配、没有计划、步骤 `waiting_dependency`/`verified`、工具 scope 不符、来源/资源变化继续返回既有失败。
5. 绑定后的 admission 仍记录真实 stepId、plan revision、requirements version、callId、tool、input digest、resource 和 criterion IDs；不跳过审计，不重放效果。

## 改动范围

- `src/main/xiaozhi-agent/tasks/plan-runtime.ts`
- `scripts/xiaozhi-agent/pi-task-plan-boundaries.mjs`
- `scripts/education/practice-review-journey.mjs`（验收等待与尺寸门禁）
- `scripts/education/golden-teacher-journeys.mjs`（DT-05-practice 使用 100% DPI）

无新表、DDL、依赖、工具、权限或第二 Agent Loop。

## 验收门禁

- 有计划但依赖未验证时，无 `taskStepId` 写入仍失败且零效果。
- 伪造步骤、错误资源、错误工具、已撤回来源、重放和 human 越权继续失败。
- 读取证明刷新后，唯一 executing 行步骤允许无 `taskStepId` 的确定性绑定并只执行一次。
- 真实错题链从本地 OCR、教师校正、真实 DeepSeek、变式卡、练习核对、教师保存、学生隔离和冷恢复连续两次通过。
- 资料备课、课堂课件、已有课件合并、长历史和教师快捷入口在当前最终构建回归。
- PowerPoint/WPS/投影动态放映单独验收，文件编辑和合并通过不能替代放映。

## 结果

构建`c7e088ca418a65a361d254482553a9c5b0c4fc0b5316f20e1380721fd972374b`/373：

- 边界`pi-task-plan-boundaries-JyTOx4` 17/17；
- 错题少练`education-journey-N9nyqY`、`VcojgR`连续两次12/12；
- 资料备课`pi-teacher-materials-current-oDVIOE` 5/5；
- 自然语言课堂课件`pi-science-natural-ui-LXxDhC` 6/6；
- 已有课件合并`pi-science-merge-ui-YhBc4l` 5/5；
- 长历史`pi-long-history-ui-Zy5NVG` 7/7；
- 教师快捷入口`pi-teacher-quick-starts-qgtDEh` 9/9；
- renderer 240/240，build与`git diff --check`通过。

`pi-science-powerpoint-playback-LXxDhC`打开、渲染、教学文字/备注3项通过，随后动态放映窗口因Windows拒绝`SetForegroundWindow`而为`OPEN`。WPS动态放映、真实教师、无VPN、安装包和投影仍未完成。

本片只收口“唯一执行步骤确定性绑定”；H05整体、H09/H10和Goal继续未完成。
