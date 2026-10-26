# 原厂组件与配置变更政策

用户要求：“保持接进来的组件的设计不变，变动需要经过我的允许。” 用户现已确认统一亮色布局和产品时序，正式替换遵循 IMPLEMENTATION_CONTRACT.md；该授权不允许任意修改原厂内部样式。

## 原样对照的具体含义

- OfficialTraceReference.tsx来自官方文档Agent Trace Streaming代码段，只搬移两个import路径；未替换420px、多块层级、默认展开、isStreaming或内置动画。文档当前导出名为AgentTraceStreaming；它属于示例组合，不是独立SDK组件。
- 同目录component-baseline.json保存官方示例文件和16个现有组件/CSS文件指纹。test:ui-contracts检查变化；不能把更新基线当作通过审查。
- 生成reference.utilities.css补齐官方示例依赖的工具类，限定审阅根，不导入全局preflight。
- 样张ProcessPreview与原厂对照分开；已批准的产品编排正式命名AgentProcess。它在运行时展示公开说明及真实工具，answer交接时换成原厂ChainOfThought整体披露。它不是官方多块演示的原样复现，provider推理仅详情可见。

## 发现并保留的现有差异

与D:\WorkProject\HeroUIPro\herouipro-v3\src本地源逐文件比较：Pro CSS、ChainOfThought、ChatMessage及其它可比文件相同（忽略换行）；PromptInputTextArea存在已有输入法补丁：先调用外部onKeyDown，若defaultPrevented/isComposing/keyCode229则不触发Enter提交。

这处差异共+2/-1行，属于中文输入行为，不是本轮视觉失真的来源。本轮未改、未删除。不能再无条件声称所有vendor源码都与官方完全相同，也不能为恢复外观破坏中文输入。

## 正式组件允许的分工

- 库源码/CSS：只读；升级或必要补丁必须单独说明版本、影响及测试。
- 组合层：内容、事件、受控展开/收起、实际状态允许按最终确认合同接入；显式记录偏离官方示例的部分。
- 视觉props：尺寸、variant、reduceMotion、className/style等不随手调整。内置默认值优先；用户同意的差异进入白名单后再使用。
- 应用CSS：禁止内部slot/BEM选择器、原厂token重绑、全局!important。只管理自有布局与领域内容。
- 协议与业务：UI组件不承担确认权限、重试安全或最终阶段识别；这些仍由Pi/typed事件与既有主进程负责。
