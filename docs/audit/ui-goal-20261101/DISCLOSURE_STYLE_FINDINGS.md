# Disclosure 样式根因记录（2026-11-01）

状态：源码修复、精准测试及正式 Electron AFTER 复测已完成，`run-37Mnx2` 为 **100/100 checks 通过、0 errors、0 console errors、112 张截图**，父任务报告 exit 0。`humanAccepted:false`；本记录不代表全部业务或教师视觉已验收。

## 实际证据基线

父运行构建 `9752656`，当前 out 指纹 `212006364122b2239b065255565c1b4b4f3041a92561aafde01fab4b72922a55`（455 文件）。正式运行 `run-CrlGzr`：100 项检查，98 通过、2 失败，0 console errors；最终报告登记 114 张截图。检查数不等于教师视觉接受。

[原始报告](../../../apps/desktop/test-results/ui-goal-20261101/disclosure-live/run-CrlGzr/report.json) 保持不变。以下为 CSS 1366×768、DPR 1.5 的真实采样，不是静态样张；未缩放截图。

修复后对应冻结源码 `10425793e580f94fa9c03b02a2d84542a4030dc6`，正式 [AFTER 报告](../../../apps/desktop/test-results/ui-goal-20261101/disclosure-live/run-37Mnx2/report.json) 的 out 指纹为 `59afcfe2a5240286233674b18449c7f0295ff650c6aebf528c7a9aaed5c347f4`（455 文件）。旧报告的 114 张含失败现场，新报告实际保存 112 张，不改写历史计数。

## 修复前 CSSOM 根因

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

**误报事项已关闭**：`run-37Mnx2` 两尺寸、正常/减少动画四组正式交互检查通过；实际减少动画采样仍为 `transition-property:none`、`animation-name:none`，duration 非零不会产生有效过渡。保留旧报告两项失败记录，不据新结果将旧报告重写为成功。

## 已实施的最小应用修复

[DisclosureCard.tsx](../../../apps/desktop/src/renderer/components/ui/DisclosureCard.tsx) 通过官方 className API 组合标题栏；[专用 CSS](../../../apps/desktop/src/renderer/ui-system/disclosure-card.module.css) 设置 trigger 全宽 flex、标题 flex:1/min-width:0/可换行、Indicator flex-shrink:0。保留官方 Card、六个 Disclosure 部件、焦点、受控状态及收起后挂载行为。

这是**应用层布局组合**，不是“恢复上游默认设计”。未修改 vendor、全局选择器、CSS import、Composer 或模型设置分组，未使用 !important。

精准验证：`node scripts/disclosure-card-interaction-test.mjs`，15 项通过，exit 0（含组件严格类型、长标题结构、Enter/Space、焦点、草稿及迟到响应隔离）。这不能证明浏览器中的最终像素布局。

## 修复后正式 CSSOM 与交互

`run-37Mnx2` 的 `interactions` 覆盖 1366/1920 两尺寸 × 正常/减少动画四组。每组记录：Card 宽约 724.667px，内宽与 trigger 宽均约 692.667px；trigger computed `display:flex`；Indicator 在触发器内，中心偏差约 0.0053px。几何断言、Tab/Enter/Space、focus/focusVisible 均通过，AFTER 图中标题与 Chevron 同行。

这是实际 computed/rect 与交互证据，不将有界匹配规则列表冒充完整获胜选择器证明。正式输入保留探针的 `inputScope` 为 **Card 外既有空白设置输入**；不据此声称正式运行验证了所有 Card 内表单。长标题和 Card 内草稿继续以精准组件测试的范围单独报告。

本轮 100 项主要覆盖独立空数据环境的应用路由/空态及 Disclosure 状态；没有业务 fixtures、凭证或模型任务。不能据此宣布全部非空题目、OCR、练习、导出或课堂链路通过。U3 真实 11 项、U5 真实 15 项分别见 [验证汇总](FINAL_VALIDATION.md)，具有各自的构建范围。

## 前后截图与待验收

| 状态 | 证据 |
|---|---|
| 修复前：标题/Chevron 换行、局部焦点 | [BEFORE capabilities](evidence/before/capabilities.png) |
| 修复后：全宽 trigger、同行 Chevron、整行焦点 | [AFTER capabilities](evidence/after/capabilities.png) |
| 设置整体 | [BEFORE settings](evidence/before/settings.png) → [AFTER settings](evidence/after/settings.png)；模型分组及裸 0 由其他 worker 独立处理。 |
| 概览层级（额外参考，完整要求未完成） | [BEFORE analytics](evidence/before/analytics.png) → [AFTER analytics](evidence/after/analytics.png)；静态「02 AI 与知识资产状态」及 AgentLoop 仍在风险/薄弱点之前直接显示，不计为诊断全部置底折叠或分析业务能力验收。 |

上述三组匹配页面/状态的图均为 CSS 1366×768、DPR 1.5、zoom factor 1、正常动效偏好，PNG 原始像素 2049×1152。已目视核对安全内容，逐文件 SHA-256 与对应运行源图相同，未缩放、裁剪、重编码或添加标记；不要求两个版本滚动偏移相同。两尺寸、正常/减少动画、全宽与同行几何、Hover/Focus、键盘及控制台检查本轮已实际执行；教师视觉接受和其他真实业务验收仍待父任务完成。

analytics 原图核对：`run-37Mnx2/017-analytics-1366-no-preference.png` 与 `evidence/after/analytics.png` 同为 137,414 B、SHA-256 `c05faa7c9a6ebef31f564b31b0288e0f18a3bdaebf1211979483242baf87e2b9`，页面记录为 `analytics-1366-no-preference`，不存在复制错图的证据。冻结源码 `1042579` 的 `App.tsx:2647–2655` 仍直接渲染静态技术状态，风险/薄弱点在 2656–2662 行；底部 `analytics-runtime-diagnostics` 仅包裹 `AiObservabilityWorkspace`（2664–2668 行）。祖先提交 `3136530` 只移动后者，未移动前者。因此这张 AFTER 可作为真实未完成项证据，**不能证明完整信息层级已修复**；100 项 Disclosure 检查的既定结果不变，完整层级仍待协调修复及新构建验收。此前汇总的过宽描述已在 [FINAL_VALIDATION](FINAL_VALIDATION.md) 明确更正，原图及原报告不变。

CSSOM helper 仅限制后续候选规则/继承/声明序列化并记录截断数，保留完整 computed/rect/state/environment。旧报告离线投影约 91.5MB → 8.9MB（减少约 90%），原报告 SHA、检查及截图清单未变；有界候选不构成完整层叠或获胜选择器证明。
