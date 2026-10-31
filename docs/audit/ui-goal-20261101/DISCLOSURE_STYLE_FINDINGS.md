# Disclosure 样式根因记录（2026-11-01）

状态：源码局部修复及精准测试已完成；**修复后正式 Electron 截图、CSSOM 和 UI 验收待完成**。本记录不代表 UI 已验收。

## 实际证据基线

父运行构建 `9752656`，当前 out 指纹 `212006364122b2239b065255565c1b4b4f3041a92561aafde01fab4b72922a55`（455 文件）。正式运行 `run-CrlGzr`：100 项检查，98 通过、2 失败，0 console errors；最终报告登记 114 张截图。检查数不等于教师视觉接受。

[原始报告](../../../apps/desktop/test-results/ui-goal-20261101/disclosure-live/run-CrlGzr/report.json) 保持不变。以下为 CSS 1366×768、DPR 1.5 的真实采样，不是静态样张；未缩放截图。

## CSSOM 根因

| 捕获目标/规则 | 来源与 CSS 层 | 实际 computed / 结论 |
|---|---|---|
| `.card`、`.card--default` | `heroui-pro-WPeDvs3H.css`，`components` | Card 宽 724.667px，display:flex，圆角 24px，官方白底/阴影存在；不是官方 CSS 未加载。 |
| `._card_roclo_7`（历史构建应用类） | `index-C4P7gTPa.css`，无 layer | 仅设置 padding；实际 16px。没有覆盖 Disclosure 内部布局。 |
| `.disclosure__trigger` | `heroui-pro-WPeDvs3H.css`，`components` | 获胜 display:inline-block；按钮仅 56×39.0938px。没有设置全宽横排组合。 |
| `svg`；`.disclosure__indicator` | 同一官方 CSS，分别为 `base` / `components` | indicator 实际 display:block、16×16px，落到标题下一行。`margin-left:auto` 无法把这个收缩宽度的按钮变成整行标题栏。 |

证据样本名：`capabilities-1366-no-preference-card/default`、`capabilities-1366-reduce-indicator`。上述获胜值由实际 computed 与对应匹配规则共同核对；不能将全部 CDP 候选规则都称作获胜规则。

**归因：应用使用 primitive 时遗漏布局组合，不是 vendor 污染，也不是旧样式覆盖了官方 trigger。** Card/Disclosure 的官方规则确实已进入层叠并生效。

## 减少动画：测试误判

`capabilities-1366-reduce-indicator/open` 的环境均为 reducedMotion:true。官方 `components` 层在 `(prefers-reduced-motion: reduce)` 下匹配：

- `.disclosure__indicator:not(:is([data-reduce-motion=true],[data-reduce-motion=true] *))`。
- `.disclosure__content:not(:is([data-reduce-motion=true],[data-reduce-motion=true] *))`。

两者获胜 `transition-property:none`、`animation-name:none`；duration 分别仍为 `0.25s` 与 `0.2s, 0.2s`。因此没有有效过渡；仅要求 duration 为零会误报。两个失败位于 `settings-models-1366-reduce` / `settings-models-1920-reduce`，原 runner 第 137 行。QA 已改为判断 property 为 none 或 duration 全为零，不添加生产动画覆盖。

## 已实施的最小应用修复

[DisclosureCard.tsx](../../../apps/desktop/src/renderer/components/ui/DisclosureCard.tsx) 通过官方 className API 组合标题栏；[专用 CSS](../../../apps/desktop/src/renderer/ui-system/disclosure-card.module.css) 设置 trigger 全宽 flex、标题 flex:1/min-width:0/可换行、Indicator flex-shrink:0。保留官方 Card、六个 Disclosure 部件、焦点、受控状态及收起后挂载行为。

这是**应用层布局组合**，不是“恢复上游默认设计”。未修改 vendor、全局选择器、CSS import、Composer 或模型设置分组，未使用 !important。

精准验证：`node scripts/disclosure-card-interaction-test.mjs`，15 项通过，exit 0（含组件严格类型、长标题结构、Enter/Space、焦点、草稿及迟到响应隔离）。这不能证明浏览器中的最终像素布局。

## 前后截图与待验收

| 状态 | 证据 |
|---|---|
| 修复前：标题/Chevron 换行、局部焦点 | [021 capabilities open](../../../apps/desktop/test-results/ui-goal-20261101/disclosure-live/run-CrlGzr/021-capabilities-1366-no-preference-open.png) |
| 修复前：设置整体基线 | [005 settings](../../../apps/desktop/test-results/ui-goal-20261101/disclosure-live/run-CrlGzr/005-settings-1366-no-preference.png)；模型分组及裸 0 由其他 worker 独立处理。 |
| 修复后 | **待父统一构建后运行正式 Electron 并补录；当前无 after 截图，不宣称 UI 验收通过。** |

下一轮须核验两尺寸、正常/减少动画、全宽 trigger、Chevron 同行靠右、长标题、Hover/Focus、Enter/Space、收起后输入保留与控制台错误。现有 QA 新增全宽及同行几何断言，尚未在修复后 out 执行。

CSSOM helper 仅限制后续候选规则/继承/声明序列化并记录截断数，保留完整 computed/rect/state/environment。旧报告离线投影约 91.5MB → 8.9MB（减少约 90%），原报告 SHA、检查及截图清单未变；有界候选不构成完整层叠或获胜选择器证明。
