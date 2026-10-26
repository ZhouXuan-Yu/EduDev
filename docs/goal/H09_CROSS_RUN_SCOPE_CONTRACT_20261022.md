# H09 跨轮任务确认与单轮核验范围合同（2026-10-22）

## 当前结果

LIMITED_ACCEPTED。构建`b7535f74ad7239981213ae516626ee77bb7efd28dc33d8e6c282cf44054b4643`/373。正式Electron `pi-task-criteria-ui-2ALLZL`8/8、组件`CltGDF`23/23、SSR `ihhYSs`11/11、renderer240/240。四张跨轮scope双主题双尺寸截图逐张查看，最低对比度浅色5.39336、暗色7.79543。

DPI补充：`pi-task-criteria-views-8H1Q5O`在125%下4/4，`pi-task-criteria-views-Wj6QLG`在150%下4/4；两轮均覆盖1366×768/1920×1080、浅暗主题、保存按钮可达、实际PNG像素等于`round(CSS尺寸×DPR)`、0 renderer错误和0模型请求。完整H09其余范围保持OPEN。

## 目标

M10/M12，教师可见结果：任务核对卡明确表示它确认的是同一任务跨多个执行轮次累计的成果；每轮回复下方的核验提示明确表示只描述该 run。两者可以并列显示，但不能让教师误以为单轮核验覆盖整个任务，或让旧历史被当前确认改写。

## 当前缺口

现有`PiTaskReview`只在“显式目标/任务/本轮”三种标题间变化，没有说明`lastRunId`与`origin.runId`不同时已经发生跨轮恢复。`OfficeVerificationNotice`显示“本轮”相关核对项，但没有可见范围标签。现有H05记录已指出这两类信息并列可能混淆。

## 修改边界

- 仅改`PiTaskReview`、`OfficeVerificationNotice`及对应组件测试。
- 任务卡通过现有`lastRunId`、`origin.runId`派生`cross_run`/`single_run`展示，不从模型文本猜测。
- 单轮提示始终标“仅本轮执行”，并指向任务核对卡查看累计确认。
- 不新增IPC、SQLite、任务字段、依赖或Loop，不修改任何核验状态、时间、证据或历史。

## 验收

1. 首轮任务显示“本轮”，跨run任务显示“同一任务多轮累计”。
2. 跨轮说明明确“本次确认不重放旧工具，单轮历史仍在各自回复中”。
3. 单轮核验组件显示独立scope，历史/malformed/needs_human/partial文案不改变。
4. 组件浏览器测试覆盖首轮、跨run、1366/1920浅暗和键盘可达；SSR核验测试覆盖scope。
5. type/build/renderer专项/diff通过。不得将本片视为完整H09；390窄屏、125/150%DPI、读屏、长历史性能和其他状态仍OPEN。

## 回滚

撤下scope文本和data属性即可，保留任务核对行为和历史核验。
