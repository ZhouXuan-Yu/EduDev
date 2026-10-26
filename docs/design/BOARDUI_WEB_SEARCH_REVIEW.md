# BoardUI Web Search：组件审查与小智适配设计

日期：2026-10-15。用户指定目录：`C:/Users/ZhouXuan/Desktop/boardui-web-search`。状态：源码及本地演示已查看；用户随后明确要求直接复用，已按复用合同接入生产renderer，限定验收详见apps/desktop/test-results/goal/boardui-20261015。

## 1. 结论

适合用作小智联网检索过程的视觉参考：轻量树线、搜索词、结果数、来源堆叠与展开、工作中动效。它不包含搜索引擎、网页读取、Agent循环或真实来源验证。小智继续使用唯一Pi及现联网宿主；不复制演示驱动逻辑。

截图里的完整聊天壳、附件栏、模型/权限/工作区选择，不都包含在可导出的WebSearch组件中。本地App的聊天输入框是另外的演示，和用户截图并非完整一比一；现小智HeroUI输入框仍为集成基础。

## 2. 已实际核对

| 项目 | 本次证据 / 结论 |
| --- | --- |
| 来源 | README/NOTICE：从BoardUI Pro页面公开前端构建整理的可读实现，不是官方原始TSX；reference保留构建快照 |
| 实际运行 | 阅读start.py后，以 `python start.py --no-open --port 4176` 在回环地址临时预览；实际点击In a chat、发送、展开Sources并查看界面 |
| 数据 | README及demo-data.ts明确为固定示例；本次无真实搜索/模型调用，来源指向示例网站首页，不能当已读取文章 |
| 发送行为 | App.tsx:34附近的onComplete会执行setDraft(demoPrompt)。本次页面结束后确实重新出现原提示；这与用户反馈“发送后输入框仍有信息”冲突，禁止复制 |
| 时序 | timeline.ts:43起自动timer推进；WebSearch.tsx:407起由revealed/总行数控制完成；这种完成只表示展示到末行，不等于工具结束 |
| 工作状态 | WebSearch.tsx:338起用组件挂载后的performance计时，isWorking取决于显示行数；恢复/重排会失真，需绑定host状态和实际耗时 |
| 来源 | WebSearch.tsx:195起直接渲染href/_blank；Sources支持键盘、折叠inert、useId实例隔离、减少动效。生产需改用现主进程来源打开链 |
| 样式 | web-search.css以bui-web-search/bui-ws命名空间和CSS变量限定，可映射现主题；不需Next或全局Tailwind |
| 依赖 | 目录使用React19、motion12、@remixicon/react4；小智已有React19.2.8/motion12.42.2，未见remixicon直接依赖。优先现有lucide，不引入整套品牌图标/字体 |

官方页面访问尝试：web工具上游429；浏览器访问BoardUI官方页超时。未据此猜测当前官方许可或最新版本。HeroUI官方MCP可用，已取得ChainOfThought/ChatTool/ChatSource/PromptInput文档。新组件不用另装第二套UI库。

## 3. 复用范围与许可

NOTICE说明提取项目不额外授予上游许可。用户在审查后明确说明“源码可以直接复用，这个是另一个ai生成的，你来复用参考”；本片遵循该提供源码及直接复用指令，保留UPSTREAM-NOTICE.md和source-manifest.json，不把它另行标成MIT开源包。

实际复制WebSearch/types/CSS/timeline/brands/index；品牌模块作为原源码兼容依赖保留，生产来源只用Globe及真实域名，不用演示品牌结果。箭头改现lucide；不复制App/demo-data/字体/输入框回填。原通用演示ticker仍保留在vendor中供原API兼容，但生产始终显式传revealed与host state，不依赖计时推进/完成回调。未知实际耗时不显示挂载计时。

若新增直接依赖，实施前锁版并记录用途、许可证、安装树/包体积和Windows打包影响；目前未安装任何依赖。现有依赖实际打包增量尚未测量。

## 4. 与小智的集成边界

```text
Pi真实调用 → 原工具边界/事件日志 → typed IPC → 原projection
                                              ↓
                         OfficeToolProcess中的搜索树状视图
                         ↙                      ↘
                  原ChatTool错误/审批      typed来源打开接口
```

- 展示视图只读现projection，不请求模型、不发网络、不写SQLite，不用动画回调结束run。
- 每行稳定绑定runId/callId/itemId；显示查询词前须来自已脱敏公开事件。缺少实际字段时补版本化公共契约，不从模型叙述解析“搜索了三次”。
- 状态为排队/执行中/等待教师/完成/失败/停止/部分完成；来源数来自实际回执，区别搜索摘要和已读正文，实际耗时来自host。
- 12项并发按调用创建顺序锚定，结果更新同一行；单条失败可展开，不能整个组涂绿。冷启已完成过程不重新播放成工作中。
- 问题与教师回答在相应调用位置插入，不统放尾部；保留现图片交付/浏览器截图/资料与题目来源跳转/重试/未知效果提示。
- 来源标题/域名/URL需校验；禁用直接_blank绕过typed IPC，避免模型URL、私网地址或危险协议逃离现主进程边界。
- 中文文案、减少动效、键盘展开、焦点、1366×768和1920×1080浅/暗；用项目字体，不加载外部favicon或跟踪资源。

## 5. 实施与验收

- [x] 本地源码/NOTICE/依赖及实际演示审查。
- [x] 按用户明确授权直接复用，保存原NOTICE/hash及重叠OfficeToolProcess修改前快照。
- [x] 给现OfficeToolProcess补事件受控适配，保持原ChatTool回退路径；混合教育/浏览器组不变。
- [ ] 按飞书方案A15–20验收真实搜索、失败、空结果、12调用、来源展开、停止、旧会话与冷恢复。
- [ ] 按A12–14验收输入框，不复制演示回填；逐尺寸实际查看。

### 本片已验子集

状态边界8、原错误边界5、真实桌面9、键盘/减少动效2均通过；组件217和隔离legacy smoke207通过，最终进程退出码已收取。真实树/失败/来源展开/冷恢复及1366浅色/1920深色已查看。A15–17剩余实时停止、实际12并发及日常环境未验，A12–14完整输入框不属于本片。详见BOARDUI_REUSE_CONTRACT.md和test-results/goal/boardui-20261015，不能把上方未打勾的整体项误标全完成。

当前已实施组件复用，实际测试结果单列；不能称小智联网整体已修复，或将本地演示截图作为正式Electron用户链路证明。来源现接口在主进程校验后调用shell.openExternal，实际交接系统浏览器；内置浏览器页面内容属于F03独立未验事项。截图与DOM检查发现两次读取可被中间说明分成两个过程组，测试须按callId定位，不能假定同一turn只有一个树。


### 2026-10-15 F07收尾时复核

再次直接核对6个原文件及适配文件hash，全部符合原manifest；当前源码SSR8项exit0（YjVUrW）。本轮未重复复制已接入组件。新F07正式固定2df5ce构建保留该视图，提问和确认按原调用位置插入；BoardUI原6c810e真实联网视觉证据仍只归原固定构建。更晚main并行修改、实时12路、完整输入框仍未由该复核验收。
