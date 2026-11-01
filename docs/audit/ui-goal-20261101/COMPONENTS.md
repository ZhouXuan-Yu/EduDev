# 组件与样式真源

本轮先查 [HeroUI Pro Chain Of Thought](https://heroui.pro/docs/react/components/chain-of-thought) 和 [HeroUI v3 控件目录](https://heroui.com/en/docs/react/components)，再按用户点名 Skill 核对本地源码。官方 ChainOfThought 与 AI SDK 解耦，`isStreaming` 控制 Trigger shimmer，不负责业务阶段、计时或自动折叠；这些必须由宿主的真实事件驱动。

| 组件 | 当前 API / anatomy | 当前本地源核对 | 本轮处理 |
| --- | --- | --- | --- |
| ChainOfThought | Root `isExpanded/onExpandedChange/isStreaming`；Trigger/Content/Steps/Step；`chain-of-thought` BEM | 最新仿制源 718b8518，与已接入 TSX 逐字节一致 | 不改内部设计；产品过程正常正文式展开，交接后用该披露组件收起 |
| ChatConversation | Root/Content 与既有滚动 API | TSX 逐字节一致 | 保留流式阅读、较早历史与锚定 |
| ChatMessage | 既有 User/Assistant 组合、原 BEM | TSX 逐字节一致 | 保留消息组件 |
| ChatTool | 既有组合及状态 API | TSX 逐字节一致 | 旧消费者保留；生产公开工具行用应用独立模块，不覆盖内部样式 |
| PromptInput | 现有组件及底部工具栏、全部弹层 | 既有差异：中文 IME/defaultPrevented 保护与 compat CSS 导入 | 受保护，不为原型改配置或排列 |
| Markdown | 现有流式与公式插件 API | 既有差异：向 Streamdown 透传 plugins | 保留公式能力，不覆盖正文结构 |
| Button/Input/SearchField/Disclosure | 已安装 OSS 3.2.2 的 dot notation/API 与 BEM | 官方预编译 CSS 指纹记录在 heroui-oss-source.json | 复用已安装控件，不随参考仓库升级依赖 |

本地仿制真源：`D:\WorkProject\HeroUIPro\herouipro-v3-latest\packages\ui-pro\src`；它不是官方发布包。旧 beta7 目录只供历史来源追溯。本轮没有修改 vendor 或安装新依赖。完整 hash 比对见本机 `apps/desktop/test-results/ui-goal-20261101/component-source.json`。

## 实际 CSSOM 结论

基线报告保留每组 computed style、匹配选择器、声明、range、layer、stylesheetId 及实际打包 CSS URL。不是只靠源码猜测样式污染。

- Header ghost icon Button：36px 高、24px 圆角、14px 字；Hover 背景由 `.button:hover` / `.button[data-hovered=true]` 的 `--button-bg-hover` 获胜，属于 `components` layer 的已编译 OSS；没有 legacy 全局 button 胜出。
- 输入 textarea：14px / 20px，透明背景；匹配链同时记录 OSS `.textarea`、PromptInput 和生成 utilities。原输入的白底边框/IME 适配是已有产品行为，受本轮保护。
- 页面应用布局按 `ui-system` 自有类维护；旧 CSS 通过 PostCSS 限制在非现代根，应用域只继承允许的几何属性，并在原厂组件边界停止。
- 本轮不能把默认右栏、冗余卡片或错误阶段映射称为 CSS 污染。它们属于产品组合/状态根因，分别局部修复。

样本来源为真实 Electron `out/renderer` CSS，打包后不能仅凭 URL还原原 TSX 行号；原声明来源通过独立源码清单与 layer/selector 复核。后续运行/展开状态与前后对照由正式验收报告补充，未采集状态不在此宣称完成。
