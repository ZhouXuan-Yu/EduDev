# 已批准UI基线的正式替换结果

> 2026-10-26版本交付补记：旧锁已由用户清理，UI提交ce98bd1已推送origin/main。下文10月24日锁阻塞/未推送是历史现场。用户指定分支清理、知识库及D盘保留证据见[分支整合审计](../../audit/branch-integration-2026-10-26/README.md)。

2026-10-24。用户已批准统一亮色、无玻璃、内容优先布局与“公开过程正常展开，answer交接时整段收起”的产品时序。本轮在唯一1c54工作树实施；没有往旧D盘checkout复制另一套正式实现。总体产品与逐页业务精修仍DOING，以下为已验证切片。

## 根因与实际修复

1. **旧规则压过原厂**：初审11处CSSOM证实标题栏、侧栏及页头由无layer的旧玻璃选择器获胜，内层Chain正确不代表全局正确。正式入口以html[data-edu-modern]隔离旧根变量和视觉规则；新ui-system只拥有布局及领域内容，原厂组件/CSS和交互态仍由官方文件拥有。
2. **组合冒充原厂示例**：被否决的同名Demo已移除。用户批准的产品编排正式命名AgentProcess；运行时同正文ChatMessage呈现公开说明与真实工具，显式final_answer先整体收起，再增量绘制正文。官方420px多块演示只保留开发审阅对照。无假阶段冒充思考，原始provider reasoning仅主动详情。
3. **图标按钮被错误使用**：ChatMessage.Action原厂内置isIconOnly，原组合塞入“复制/修改/保存”文字导致32px按钮标签重叠。移除额外标签，保留原厂尺寸、图标、Tooltip、aria-label及业务动作。最终三个按钮均32px、无溢出/重叠。
4. **旧历史曾输出伪工具XML**：确实在保存的问候回复中看到字面ask_teacher标签，没有真实调用。未改写历史，也未把文本转换成伪工具。仅澄清展示前缀与原生工具的边界；新真实同句回归通过。不能据此断言展示提示是旧错误的唯一原因。
5. **验收驱动也会失真**：最初1920窗口获焦后变为1691×1012，后又发现自动化缓存视口与原生尺寸可能分离。旧大尺寸矩阵撤回。最终驱动同步Playwright与目标BrowserWindow，在每张截图前同时检查CSS和原生尺寸，PNG也必须匹配；不改生产组件样式来通过测试。

## 修改范围

| 范围 | 主要文件/结果 |
| --- | --- |
| 单一外壳与合同 | ui-system/EduShell.tsx、EduNavigation.tsx、EduPanel.tsx、page-contracts.ts及独立布局/聊天/领域/设置CSS；15页同一导航 |
| 页面入口 | PiWorkspaceShell、PiSettingsWorkspace、PiRuntimeStartup、ProductSpaceShell、DesktopFrame、browser-status；App仅增加运行根标识 |
| 真实列表 | MaterialsWorkspace、TeachingArtifactsWorkspace使用ResourceTable；保留导入、选择、预览及原IPC |
| 过程与正文 | AgentProcess、Timeline、Text、Tool、Glyph、Header、ReasoningDetails；SDK顺序、真实操作图标、顶端用时、整段折叠；不另建模型循环 |
| 样式迁移 | scripts/css-native-boundary.ts只向领域兼容层复制几何声明；原厂根作为终点，不复制旧颜色/字体/token/important |
| 最小协议澄清 | main/xiaozhi-agent/presentation-event-adapter.ts；仅展示与原生工具调用边界，不改权限、审批或来源 |
| 验证 | ui-production-navigation、clipboard-evidence、greeting-evidence、真实provider脚本、逐帧observer、CSSOM/双尺寸驱动 |

已移除无引用旧ProductRail/product-spaces、pi-workspace-glass/theme、native-component-boundary、旧桌面/browser CSS及被否决过程工具类/生成器入口。旧styles.css仍供隔离legacy-test，并通过临时领域几何适配保持复杂内页功能；不能宣称所有历史领域布局都已删除。

原厂16文件指纹、官方示例指纹不变；已有PromptInput中文IME Enter保护补丁保留。无新依赖、DDL、业务IPC、额外生产模型回合或自动资料上传。

## 实际验证

命令均在本工作树apps/desktop运行，日志位于test-results/ui-implementation-20261024。

| 命令/范围 | 结果 |
| --- | --- |
| npm run build / npm run test:smoke | build含tsc通过；旧路径真实Electron207/207，退出0；该套件不等同新Pi每页业务验收 |
| npm run test:renderer-components | 217组件＋8样式保护通过 |
| npm run test:ui-contracts -- --write-docs | 25检查、15页；单一合同源与原厂指纹通过 |
| test:agent-trace / test:reply-presentation / test:desktop-process / test:model-reasoning | 19 / 16 / 7 / 16通过 |
| node scripts/ui-production-navigation.mjs | 42项、0错误；15页双尺寸、真实资料导入→SQLite→冷重启、6设置页、历史及任务面板 |
| test:model-reasoning-electron | real DeepSeek31项、0控制台错误；真实附件工具/教师提问、原生SDK对照、正文复制/Markdown导出、SQLite/重启、停止、受控失败、问候回归 |
| 最终launch-reply-trial | 冷读回真实会话，14个CSSOM/交互样本；亮色1366×768及1920×1080，DPR1、zoom1；CSS/原生内容/PNG尺寸一致 |
| git diff --check | 通过；仅既有LF/CRLF提示 |
| npm audit --json | 20个既有告警：low5、moderate5、high9、critical1；本轮未增依赖，未做不相关依赖升级 |

真实普通正文观察到23个不同长度的运行帧；answer事件至首正文绘制约59.6ms，正文绘制前过程已折叠。工具回合真实有目录、文件读取、教师提问三类图标。普通解释样本0列表行/0标题行；明确要求解法和练习的任务仍可结构化。系统剪贴板原生往返及正文读回最终均通过，先前失败日志保留，不伪称已证实其唯一原因。

只使用亮色，按用户要求不做暗色。自动化及截图不代替教师最终观感验收。

## 前后与交互证据

- [修复前真实旧界面](evidence/rejected-chat.png)、[初审11处CSSOM](evidence/runtime-cssom.json)。
- [真实已完成过程手动展开](evidence/implementation/process-expanded-1920.png)：公开说明、目录/读取/提问图标及原始推理详情关闭；不是重新伪造运行状态。
- [过程默认收起与正文1366](evidence/implementation/answer-collapsed-1366.png)、[1920](evidence/implementation/answer-collapsed-1920.png)。
- [真实等待教师提问](evidence/implementation/waiting-teacher.png)、[资料导入重启后](evidence/implementation/library-restarted.png)。
- [键盘焦点1366](evidence/implementation/keyboard-focus-1366.png)、[页头Hover1920](evidence/implementation/header-hover-1920.png)。
- [1366 CSSOM](evidence/implementation/light-1366-cssom.json)、[1920 CSSOM](evidence/implementation/light-1920-cssom.json)：computed、匹配/获胜候选、原厂/自有源码候选、CSS层级、官方对照。
- [结果摘要](evidence/implementation/results.json)、[正式导航](evidence/implementation/navigation.json)、[冷启动身份](evidence/implementation/cold-runtime.json)。

CSSOM源码候选由同选择器匹配提供；构建CSS URL/行号是真实CDP结果，不把候选误称为唯一source-map定位。

## 当前试用身份

窗口“小智 · 桌面对齐 · 公开过程版（1c54）”，源为当前工作树apps/desktop/out/main/index.js，renderer为index-3E16bBVp.js。main SHA256为98f23b996b3eb89cc7c78b2f43a067dacbd99f851c528b63971be810ed866dcc。使用Temp/xiaozhi-official-agent-trace-TKAXDP/data真实隔离验收库，默认打开普通解释会话，过程收起/原始推理详情关闭，无自动提交provider请求。PID与绝对路径见cold-runtime.json；后续手动关闭或修改源码后应重新核对，不能沿用旧窗口宣称最新。

## 未解决与协作main

- 复杂教学/学生领域内页仍保留既有结构与几何适配；本轮完成共用外壳和列出的实操，不冒充题本/组卷/错题全领域专项验收。后续按独立页面合同逐页退出兼容层；Office/WPS/A4与长历史性能未在本轮重验。
- 首段本地准备仍慢：两个真实样本约13.3s/16.3s，provider首推理约1.3s/3.6s。它们是本轮样本，不是p95；不能用假思考填补等待。后续需单独定位准备路径。
- 旧历史伪工具文本保留，新增协议澄清与回归只能约束后续表现。
- Git已有直接main提交推送授权。已fetch origin/main，HEAD与远端均b5a7fc685070e95f4110b1b98a8304a63d71fb7d，左右差0/0；未遇到现存提交冲突，未reset/force或覆盖协作者改动。
- 实际git add仍失败：D:/WorkProject/EduProject/.git/worktrees/EduProject/index.lock已存在（0字节）。先前删除被自动审批blocked by policy拒绝，未换方法绕过；已有本机释放请求。**尚未提交、合并或推送**。锁释放后须重新fetch并复核协作者最新改动，再按已授权范围整合。
