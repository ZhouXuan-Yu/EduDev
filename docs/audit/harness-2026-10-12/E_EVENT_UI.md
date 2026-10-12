# E · 真实事件驱动的任务界面设计

## 1. 已实际核对的HeroUI能力

先访问[官方组件目录](https://heroui.pro/docs/react/components)，然后调用已可访问的HeroUI Pro MCP：`list_components`返回138项（Pro66、OSS72）；`get_component_docs`实取chat-tool、timeline、stepper、disclosure、resizable、file-tree；`get_docs`实取licensing。无需向用户索要PAT。该服务不开放Pro任意源码；文档可访问不等于可免费分发其源码。

当前小智已通过 `src/renderer/heroui-pro/components` 本地源复用，`workspace-source.json`记录源 `D:/WorkProject/HeroUIPro/herouipro-v3/src`、`@ag-ui/pro 1.0.0-beta.7`与SHA。OSS依赖为HeroUI v3，需按lock核精确解析版本；不能拿最新网页API直接覆盖现vendor。继续现本地closure，新增组件按原源码/CSS/utils完整适配，不自动安装最新版Pro。

| 查询确认的组件 / 实际API | 用处 / 接入点 | 复用决策 |
| --- | --- | --- |
| [ChatTool](https://heroui.pro/docs/react/components/chat-tool) / `@heroui-pro/react/chat-tool`，`state/argsText/output/defaultExpanded`；states含input-streaming、input-available、output-available、output-error、requires-action；ChatToolGroup | tool.started/settled、审批、错误；现OfficeToolProcess | 继续本地原组件，增加attempt/输入输出/verification映射；本地支持compound Trigger/Content，先核原API再改 |
| [Timeline](https://heroui.pro/docs/react/components/timeline) / `Timeline.Item/Marker/Content/Rail/Connector` | 真实事件轨迹、计划变更/重试/恢复/验证，拟TaskEventTimeline | 适配本地对应源码；仅过去事件有节点，未来计划独立列表，不用动画编造进度 |
| [Disclosure](https://heroui.pro/docs/react/components/disclosure) / OSS `isExpanded/onExpandedChange/Heading/Trigger/Content` | “执行过程”“输入/输出”“验证依据”可折叠 | 优先已安装OSS，受控展开保存；避免失败一来用key重挂清掉用户状态 |
| [Stepper](https://heroui.pro/docs/react/components/stepper) / `Step/Indicator/Title/Description/Separator` | 短线性任务的阶段切换 | 仅导入→分析→确认→导出等线性向导；复杂依赖/回退/并行不强塞stepper |
| [Resizable](https://heroui.pro/docs/react/components/resizable) / subpath `/resizable`，`Panel/Handle`、orientation/minSize | 桌面聊天与资料/证据pane | 现已复用，保留react-resizable-panels4.11.2；窄屏改sheet，重构任务不重做整个shell |
| [FileTree](https://heroui.pro/docs/react/components/file-tree) / `Item id/textValue/title` | 当前授权目录/产物，不是全电脑文件 | 现本地组件继续；只main公开列表，lazy children，不按模型输出path扫描磁盘 |

HeroUI v3/Tailwind4、onPress、compound，无需新Provider。Pro采用商业许可；[官方许可说明](https://heroui.pro/docs/react/getting-started/licensing)提到购买后可使用相应版本，更新窗口和团队席位另有范围。**当前账号/组织具体分发权限未独立核验**；组件实现不能当MIT公共库打包再分发，项目已保留许可边界。若本地无许可授权，使用OSS Disclosure等实现相同事件交互，不卡住核心Harness验收。

不采用“chain-of-thought”作为产品思考真源。组件叫这个名称不意味着能展示内部推理；计划/行动是公开任务状态，不显示raw reasoning、token级思维或前端定时生成“我在想”。

## 2. 页面结构

Timeline/Stepper在本地HeroUI源可定位，本轮尚未复制进当前renderer；它们属于拟引入组件。E中的事件名称同时包含event.kind与投影state：例如 `tool.failed` 是 `tool.settled.payload.outcome=failed` 的呈现，`task.partial/verified` 是 `task.settled.payload.state` 的呈现，`effect.unknown` 来自工具receipt的effect状态；不另造第二套前端事件协议。

保留用户熟悉的Codex式桌面工作区节奏，但本轮不宣称获得或复用了ChatGPT桌面闭源组件，也不承诺其当前所有功能像素一致。结构按提供截图和教师工作流设计，细节需下一轮实际视觉验收。

```text
┌ 项目/会话侧栏 ┬ 小智 · 教师任务                         资料/证据（可收起）┐
│ 历史/新任务   │ 目标：依据教材准备课堂讲义                              │
│              │ 标准：来源可开 · 讲义可用 · 教师确认                      │
│              │ [任务计划 ▾]  2项已验证 / 4项                           │
│              │   ✓ 读取资料  →  ● 整理结构 → ○ 生成讲义 → ○ 验证交付    │
│              │                                                         │
│              │ 教师消息                                                │
│              │ 小智公开行动说明                                        │
│              │ ▸ 读取了 2 份资料 · 已执行                              │
│              │ ▾ 导出讲义 · 未完成 · 等待修复                          │
│              │   原因 / 实际输入摘要 / 输出证据 / 本次尝试              │
│              │   恢复：核对当前产物，不重新覆盖                         │
│              │ [结果：部分完成] 已得到… / 未满足… / 查看证据            │
│              │                                                         │
│              │ [ + 输入本次要求…            模型模式     发送/停止 ]     │
└──────────────┴─────────────────────────────────────────────────────────┘
```

**目标区**：显示用户任务与可核对标准，默认一行目标+标准摘要；长内容展开。普通聊天不强加目标表单。用户修改形成新revision，提示受影响step需重验。

**计划区**：默认折叠，最多展示当前/下一步和已验证数；展开Task依赖列表，稳定stepId；并行/阻塞有标签。计划变更显示“变更前→变更后/原因/关联工具”，model建议须注明“提议”，宿主执行后才显示已采用。

**对话区**：用户消息、公开行动说明、真实事件行按时间排序。相邻同域tool可分组，每call仍可展开；summary不是成功判定。长任务顶部状态与输入框附近状态同步，滚动阅读不抢位置。

**证据pane**：来源、文件预览、版本/生成时间、适用标准、核验结果；敏感路径只本机主进程管理。默认展示教师有意义的文件名/来源标题，技术原始JSON收在开发诊断而非教师流程。

**结果区**：明确已验证、需教师确认、部分完成、失败、未验证；给产物入口、未满足项、下一步。没有证据时不显示“全部通过”。模型总结与宿主验证并排，发生矛盾以后者为准并说明差异。

## 3. 状态与真实事件映射

| 源事件/状态 | 教师看到 | 交互 / 禁止 |
| --- | --- | --- |
| plan.changed committed | 计划已调整，原因与版本可展开 | 来源是规则/公开建议，不能展示隐藏思维 |
| tool.started / progress | 正在读取/生成…，真实时长 | 未完成不预填结果，不显示无来源百分比 |
| approval.required | 等待你确认：具体文件/用途/范围 | 可批准/拒绝，版本失效需新确认；不能旁路 |
| tool.failed transient | 本次失败，准备第2次只读尝试 | 显示实际开始重试事件；定时器不能伪造重试 |
| effect.unknown | 操作效果尚未确认 | 仅核验已发生效果；禁止一键重做写入 |
| verification.result fail | 标准未满足 / 证据不支持结论 | 展开判据/证据，模型好听回复不变绿 |
| task.partial / blocked | 部分结果保留；缺…/待… | 安全恢复只继续剩余步，保留历史失败 |
| task.paused/cancelled | 已暂停/已结束，已完成操作仍保留 | 不说所有文件已回滚；允许查看产物 |
| snapshot gap/reconnecting | 正在同步执行记录 | 禁用会改变状态的确认直到revision核对完成 |
| task.verified | 所需检查已通过，范围… | 人工标准须已确认；显示证据入口 |

“已执行”与“已验证”分别用字，绿色只给验证pass。图片received显示“供应商已接收”；图形数量/核验码正确才满足image_content，避免重现用户反馈中的假通过。

## 4. 视觉规范

| 项目 | 设计值（拟定，需实际验收） |
| --- | --- |
| 布局 | 左栏240–280px、对话内容680–820px，右pane320–480px，窄屏单栏 |
| 间距 | 4/8/12/16/24/32px；正文行高1.55–1.7；过程行32–40px |
| 字体 | Windows系统中文UI字体；正文15px，过程/附注13px，标题18px；代码只证据细节用等宽 |
| 颜色 | surface白/浅灰，边框中性低对比；主色沿现蓝；失败红、等待琥珀、验证绿；状态始终同时有文字/图标 |
| 圆角 | 输入框20–24px、popover12px、工具/证据8px；过程使用细行/边框，少嵌套卡片 |
| 动效 | 展开/状态150ms左右；真实进行中loading；prefers-reduced-motion停位移；不用装饰渐变/玻璃/发光 |
| 暗色 | 以现theme tokens转换，边框/正文/失败同层级；禁止独立硬编码整页两套颜色 |

保留现OfficeComposer、OfficeMarkdown、DesktopFrame及读取位置机制；新开发TaskHeader、TaskPlan、TaskEventTimeline、VerificationPanel、EvidenceDrawer、RecoveryAction。不要用十几个静态卡片冒充已经实现的能力。

## 5. 输入、键盘、窄屏与无障碍

- 发送成功接收并持久化用户command后清输入；提交失败保留draft；运行中steer/follow-up保留真实queued/dispatching/applied及编辑/撤回边界，复用现queue机制。
- Enter发送，Shift+Enter换行；中文输入法composition期间不发送。停止按钮有可读名称和状态；确认按钮仅匹配最新approval revision。
- Tab可到计划/每个事件展开/证据/确认/输入；Escape关drawer后回原触发点；不能依赖hover或右键。按Ctrl/Cmd+Enter是否启用应统一现产品快捷键，避免冲突。
- timeline使用语义列表与time；折叠用aria-expanded；当前步骤aria-current；error用alert，进度用polite live，流式token不逐字播报。对比度正文至少4.5:1，焦点可见；点击区至少约40px。
- 1366×768、1920×1080、Windows125/150%缩放；窄视口768/390px时右栏Sheet、左栏收起，底部输入与确认不被遮。移动适配指窄窗口布局，不新增学生手机端。

## 6. 性能与验收

真实eventId稳定key，折叠state按event/attempt保存；增量reducer只更新受影响step，补拉不会覆盖更高revision。超过可测阈值才虚拟化历史，不安装库前先比较已有ChatConversation/阅读锚点；delta批量、关键事件立即更新。

H09视觉验收包含浅/暗、上述尺寸、长任务、等待、失败重试、unknown效果、压缩、恢复、最终partial与verified。核验“后台事实→ledger→IPC→UI”一致，每帧绿色必须可解释。截图/模型自评不能替代真实控件操作、DB/文件readback和重启。
