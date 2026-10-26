# UI样式与公开状态专项审计：根因和最小修复提案

状态：2026-10-23，用户否决上一轮视觉结果；收到根因和A/B提案后，明确选择“实施 A，先恢复官方组件设计”。原未提交改动保留，A正在验证；没有覆盖/重置业务源码，未触碰第三方组件源码。高级感/配色/重排与B公开阶段时间轴不在本阶段自行决定。

## 已核实的根因

1. **组件代码没变，不代表设计没变。** `main.tsx`先引入OSS/Pro CSS，再引入应用styles。DevTools实际层顺序为properties→theme→base→components→utilities→未分层规则。`styles.css`的root颜色变量与font/heading/paragraph/form元素规则处于未分层；聊天、glass和trace适配器也在未分层，因而可以胜过官方components层。只有调整导入顺序无法解决层级优先级。
2. **主题被上游重绑。** `pi-workspace-theme.css:19`起将foreground/muted/background/surface/accent/field等官方语义token映射成pi色。实际过程按钮muted=rgb(89,109,105)，由祖先的未分层规则继承。原厂OSS浅色muted为oklch(55.17% .0138 285.94)；深色主题依赖`.dark/[data-theme=dark]`，应用仅通过media改pi色，未给原厂组件切换正式主题入口。
3. **组件内部slot被再次覆盖。** `office-conversation.css`对消息气泡、正文、工具、过程、PromptInput的颜色、字号、间距、尺寸、边框和阴影都有重写；glass又覆盖气泡、输入壳、发送按钮。过程按钮实测14px/36px/padding0来自`.office-agent-trace [data-slot=chain-of-thought-trigger]`。这些改动需要移除或隔离，不能继续“修补”内部样式。
4. **重复焦点状态。** 实际键盘Tab聚焦同时命中原OSS `.button[data-focus-visible=true]`的box-shadow焦点环，以及`pi-workspace-glass.css:108`的未分层`:focus-visible` outline，出现两套指示。Hover背景来自官方button规则；不能把所有Hover都判为缺失。Active实测scale(.98)仍在。
5. **Streaming不是没有接上。** 真实Pi运行run_ab0fd7ba-54bb-43b5-9000-55852786708a：preparing→waiting_model→assistant_start/text_delta→tool_start/end→waiting_model→responding→completed。运行中实际DOM有chain-of-thought--streaming，aria-expanded=true；终态complete且自动收起。TextShimmer实测animation-name=text-shimmer、duration约1.67s、透明文字填充和渐变均生效。因此不能把本次问题说成Pi事件或动画全部缺失。
6. **公开过程内容不足是独立问题。** activity只保留最后阶段，没形成可回看的阶段时间轴。无工具、无公开前置说明的直接回复在终态展开后只剩“未记录额外步骤”；新真实请求要求公开操作说明后，确实产生commentary→真实工具→final_answer。当前实现无法保障普通回合存在公开步骤记录，不应伪造或接入模型私有推理弥补。流式Trigger还把图标/状态/计时全部传入TextShimmer，偏离官方示例的简洁文本组合。
7. **两个入口的官方CSS顺序相反。** main.tsx为OSS→Pro，browser-status.tsx为Pro→OSS，Vite共享样式合并后OSS.Button压过Pro.Trigger。先隔离应用覆盖后，实测过程按钮变为前景色、12px padding；统一单一heroui-styles入口后恢复Pro.muted、0px padding。这是“组件源文件相同但效果不同”的第二层原因，不能靠新的颜色覆盖修复。中间原始证据保存在after-isolation-before-import-fix.json。
8. **嵌套暗色主题只设dark还不够。** 原厂dark规则继承共享默认token，而父级pi主题仍提供accent/focus。暗色对照检测到#2565ce与原厂oklch(62.04% .195 253.83)不同。保护根同时采用原厂default基础类和data-theme=dark增量，以重建完整原厂主题；不自行复制颜色值。失败对照见dark-token-inheritance-before-fix.json。

## 证据与方法

- `initial-git-status.txt`/`initial-git-stat.txt`：审计起点，包含本会话尚未提交的trace实现与文档；构建产生6个vendor行尾噪声，暂未清理。
- `before-cssom.json`：真实鼠标Hover/Active、键盘Tab Focus、展开、textarea、真实工具。每条包含computed style、DevTools匹配规则/层级/继承/特异性、获胜规则与原源码候选。
- `before-live.json`：正式Electron当前工作树构建、真实DeepSeek、851个公开事件的精简记录与Streaming CSSOM；没有私有reasoning或凭证。
- before截图：当前窗口原生内容1366×768；图片像素受Windows DPI影响，不把PNG像素尺寸当CSS尺寸。
- 获胜规则按CDP提供的origin/layer/specificity/order计算并保留computed值和完整候选；源码无source-map时明确记录sourceCandidates，不将候选伪称精确映射。CSS动画中的实时计算值另列，不声称静态规则能覆盖动画合成值。

## 最小修复提案，待用户确认

**A：先恢复组件原设计。** 为Pi聊天里的官方组件设置明确原厂light/dark主题边界；隔离旧元素规则、移除该边界内对官方BEM/data-slot外观的应用改写，只保留外层布局和业务特有内容。官方组件保留自带Hover/Focus/Pressed/Streaming/reduced-motion；额外focus只用于没有官方焦点实现的自有控件。第三方源码和min.css字节不变，不用全局!important。顺便增加审计/约束，今后未经用户允许不得添加组件内部外观覆盖。新主题、玻璃风、圆角/字号重新设计均不做。

**B：之后补公开阶段时间轴。** 复用已持久化的activity/tool/status公开事件，记录已发生的准备/等待/工具/生成阶段及时间，不展示推理。正文继续流式，终态折叠、失败/等待教师外露。该功能单独列交付合同，不以静态阶段清单冒充真实执行。

验证：亮暗×1366×768/1920×1080×展开/收起、Hover/Focus/Active，运行/完成/失败截图；实际provider核对isStreaming和工具事件，失败路径单独标明真实错误或受控故障，不修改正常provider设置。控制台、renderer组件/专项边界/现有兼容回归；不因恢复外观重写业务数据或已有功能。

## 尚未解决

本提案提供后，用户批准A，指定只用亮色，并继续要求补齐空过程；后续实现/验证见[最终交付](DELIVERY.md)。旧activity实际上未持久化，只保存publicItems，因此仅改renderer不可能恢复旧记录阶段；新记录已增加可选metadata并核对冷读。长历史性能、整套聊天高级感、侧栏/宽幅审核全面迁移、系统DPI/安装器和完整教育业务验收仍另行处理。先前trace草稿不构成视觉接受。
