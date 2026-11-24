# 04 HeroUI / HeroUI Pro 组件复用

## 复用顺序

1. 先查项目已有 wrappers / 适配器与实际消费者，复用已投入生产且符合版本的实现。
2. 查当前安装版本匹配的 HeroUI 官方 API。当前快照锁定 3.2.2，在线页面可能是更新版本；禁止无关升级。
3. 需要 Pro 成品时沿仓库规则优先 heroui-pro MCP；不可用或资源受限则核对本地 D:/WorkProject/HeroUIPro/herouipro-v3/src。
4. 本地组件同时检查 components、css、utils 和主题 / 依赖。拿不到可用授权源码时使用已安装 HeroUI 可实现的等价交互；确有必需缺口才记阻塞。不能索要新凭证、临时购买或下载不明源码来绕过条件。

只引入与当前需求直接相关的组件，不整库重装。基础 HeroUI 不冒称 Pro；记录来源与版本，当前 Pro 文件是否存在必须由执行者核实。

## 组件映射建议

| 当前问题 / 用途 | 优先候选 | 验证重点 |
| --- | --- | --- |
| 学科、年级、状态筛选 | 项目 Select / 已有相应 Pro 选择器 | label、受控值、键盘、长选项、Indicator |
| 详情、诊断、来源说明 | 现有 Disclosure / Accordion / ChatSources 等 | 一致 Chevron、expanded 语义、长内容 |
| 任务和成果操作 | Button / Dropdown / 现有菜单组件 | 主要与次要动作、禁用原因、焦点返回 |
| 设置布尔偏好 | Switch（只用于真实布尔项） | 标签与保存语义，不能吞掉多枚举 |
| 设置或工作区分类 | 当前导航 / Tabs | 唯一选中，hover 不冒充 selected |
| 确认与可关闭设置面 | 已有 Modal / Popover / Drawer | 模态语义、Esc、脏内容保护 |
| 加载、空、错误 | Skeleton / Spinner / Alert / 现有空态 | 不伪造成功，状态准确，无强制抢焦点 |
| 表格 / 长列表 | 当前 Table / 可用 Pro DataGrid 或 ListView | 虚拟化和选择沿现有逻辑，不为换皮重写业务 |
| 返回、展开、更多 | 既有 lucide-react 或组件原指示符 | 尺寸 / 笔画 / 对齐一致，可访问名称 |

候选不是已安装 / 已可用的承诺。填写 templates/COMPONENT_REGISTER.csv 后再修改。

## 样式所有权

应用负责布局、间距、阅读区域与业务分组；原厂组件负责内部视觉、状态、slot 和主题。沿现有加载顺序核实 Tailwind、OSS、Pro 及 vendor 适配边界。

禁止修改 vendor、全局 !important、全局 button/input/h1 覆盖、未经分析覆盖 data-slot / BEM、逐页重绑主题变量或重复导入整套 CSS。先查导致污染的源规则和 CSSOM 获胜选择器，再删除或收窄实际冲突，不继续叠补丁。

如确需改变原厂尺寸、variant、主题或受保护控件外观，遵守已有批准范围；不靠本包的新名字绕过项目要求。用户已明确授权替换本次粗黑指示符，采用现有语义和匹配组件即可，不逐项重复询问。

## 黑箭头专项

建立范围内所有原生 select / details / summary 和文本三角的实际使用清单。按语义使用组件配套 Indicator / Chevron；原生实现可作为底层语义，但正式呈现不得露出用户已拒绝的突兀默认三角。

不使用全局隐藏 marker 后让点击 / 展开不可发现，不删除数学三角符号，不批量修改原题文本，不动受保护输入框内部设计。

## 状态和可访问性

逐个代表性控件验证 normal、hover、selected、pressed、focus-visible、expanded、disabled、error 中实际适用的状态。hover 与 selected 视觉不同；焦点不能为了柔和而消失。保留 name / label、aria-expanded / selected 等正确语义；图标按钮有可访问名称。

项目沿既有官方控件尺寸。新改造点击区域至少满足 WCAG 2.5.8 的 24×24 CSS px 或可核实例外；这个标准不是要求把按钮都缩到 24px。复用控件默认更大区域，不为了图标小就缩小可点击面积。

组件内部常规运动沿现有已批准配置并尊重 reduced-motion；正文流式、文件预览不反复入场，不增加装饰动画。
