# P06d-D 整体工作区差距与窗口恢复交付合同

日期：2026-10-03。M10/M01。设计真源仍为67的R1/R2、事件映射、组件映射和状态矩阵；101→102只证明限定切片。用户要求的完整目标仍active。

## 压缩后先读这五项

1. 根目录四文档→67第1/2/5/8/9→35最新→本合同和104实际验收。
2. 单一嵌入Pi0.80.3/Hana0.449.0执行链，默认国内DeepSeek；不接Codex CLI或另一执行循环。
3. **公开准备说明→真实工具执行/结果→下一段公开说明→最终答复**。来自实际native text/tool事件；不展示隐藏推理、私有摘要，不伪造过程/百分比/耗时。
4. 截图决定视觉，现成组件负责交互；登记Pro/Hana/ZCode许可证和原源校验。不能称Codex官方同源；参考DPI未知不能声称全页≤2px。
5. 当前run计划不是持续goal。办公正文/PDF/图片/联网/真实产物、持续goal和最终无VPN/安装验收仍保留完整待办，不能用局部通过消掉。

## 1. 整体对齐清单

下表是审计和继续清单，不把已有报告当作本轮重新运行证据。

| 需求 | 当前真实实现与证据 | 剩余差距及完成门禁 |
| --- | --- | --- |
| D1 全页精度 | R1/R2原SHA与双窗DOM/DPR/字体基线在67、81–82；当前native截图记录Windows scale1.5 | 原参考DPI未知；需统一参数的区域测量、锚点/字形/换行/留白叠图，完整父项未通过 |
| D2 边执行边说明 | Pi原text delta→持久投影→Pro ChatConversation/Message/StreamMarkdown；工具细行/组/展开来源、真实计划steps/status，82/98/102 | 全部动作中文、真实长任务/多轮历史阅读、不抢滚动及精确间距仍专项核验 |
| D3 时长、整理、图片 | 实测工具时长/usage轮次时间/native整理细行与恢复，82；文件1px PNG本地解码，102 | 真实查看图片数量/缩略图/图像分析和产物来源未接齐，不能用PNG解码替代 |
| D4 桌面壳与工作区 | ZCode原native overlay/Menu；Pro AppLayout/Sidebar；会话树、标题、资料卡；文件Tabs/tree/preview及min360保持，84/86/88/102 | **当前固定1360×900启动**，上次窗口尺寸/位置/最大化未恢复；本轮复用ZCode尺寸机制补齐。整页/资料卡精度仍未通过 |
| D5 输入与控制 | Pro PromptInput/现成HeroUI菜单；发送清空、问题明确发送、审批/队列真实状态；设置/文件重排保留未发草稿；partial明确准备草稿，100/102 | 长输入/键盘IME/所有等待与失败/窄窗/权限名称和附件完整验收，不以预算故障代替断网 |
| D6 设置与技能 | Hana原Settings primitives/搜索/SkillRow；实际DeepSeek目录/同历史切换/本地授权/Skills/偏好/归档/备份，80/94/96 | 用户未提供官方设置/Skills各状态截图；以已见R1/R2和一致token核现有产品，缺参考标注，不能臆造官方一致 |
| D7 整体实例 | 102限定UI80、renderer79、主207，以及各前序真实报告 | 全状态、双native窗口、原图区域对照、完整办公/联网/图像/产物与最终八组仍未验收，完整P06/P07/P08保持未完成 |

## 2. 本轮教师可见结果和纵向范围

- 启动恢复上次正常窗口尺寸、位置和最大化；显示器范围改变时窗口仍可见。拖动/调宽后关闭重开不重新固定尺寸。
- 首先核现有图谱。EduProject/Openhanako限定窗口symbol检索无结果；当前ZCode文件为`packages/desktop/src/main/desktopWindowSize.ts`。AST提取原clampDimension、resolveDesktopWindowSize、attachDesktopWindowSizePersistence和目标type；本地常量适配原项目1360×900/min1100×720，保留Apache-2.0许可证和源/output SHA。
- 新增main/desktop-chrome内本地schema1 UI几何适配；仅userData的独立`desktop-window.v1.json`，不保存聊天、文件正文、权限、API Key。正常bounds与最大化分开，move/close同步微量原子落盘补ZCode原resize debounce；无业务表/迁移/IPC/preload/UI假状态/新依赖。
- main/createWindow只接restore options/attach persistence；现有native menu/typed IPC、权限、Pi循环和renderer组件不改。关闭屏障/教师任务恢复规则保持。
- malformed/超限/未知version/额外字段降级默认；offscreen移回当前工作区；写入失败不阻止使用且不打印私有路径。`OMNI_EDU_WINDOW_GEOMETRY=0`回到固定启动且不读写旧几何，保留原配置。

## 3. 验收和证据

1. 原源静态验证与纯几何边界：正常/未知/坏值/超大/多显示器坐标裁剪、保持normal vs maximized。
2. 扩展已有真实Electron native chrome套件：先两实际content窗口/原菜单/导航，再真实resize+move关闭重启、最大化重启与恢复普通bounds、损坏配置回退/offscreen可见/写失败不中断/功能开关。独立合成data/profile，不读写教师真实配置，不发provider请求。
3. 固定源码build、renderer组件、原源核验；文件分栏恢复依赖窗口变化，复跑当前文件实例；关键用户路径主smoke207和git diff --check。留截图/实际window/content/DPR/zoom/report/log。
4. 104写精确命令/通过失败/skipped与未验收范围，并更新四根+26/28/35/67，下一工作位置明确。

## 4. 顺序与明确未完成项

### 完整页实际像素审计（2026-10-04）

原R2为2559×1529，当前owned native恢复窗口图为2558×1529。仅读取图像像素，不缩放/生成/编辑参考；row500连续平色区域记录在`p06dd-reference-pixel-anchors.json`。参考侧栏平色从x78到445为RGB246/253/252，主白区连续从459开始；当前轨平色到92、侧栏平色为245/251/251，主白区从549开始。原图字体/DPI仍未知，但图像比例层面主白区左锚点有约90物理px差距，不能以“未知DPI”忽略可见结构差。

当前源码明确rail62 CSS px、sidebar304 CSS px，和当前native scale1.5对应549物理px。下一P06d-E合同105必须先校准rail/sidebar总宽及sidebar底色，按原图归一化宽度确定参数，再两native窗口/菜单/文件/待答与长历史阅读实例；不先继续堆功能卡替代壳精度。不能将条件换算的参考CSS尺寸写成已确认元数据，也不能勾D1或完整D4。

### 实例发现的生命周期补充（修改前记录）

首轮native ZzW3Sf前16通过，在原“设置页新聊天”实例超时：AI/settings已改为保留组件实例，原pending command仅id改变时flush；返回AI时id相同，待处理新聊天未消费。补充范围仅PiEducationWorkspace：可见并完成返回刷新时消费pending；hidden的晚到fresh完成不能覆盖后来的设置导航。沿原native两条既有断言修复，不删测试或放宽时间；无新IPC/业务authority。首轮文件z9ixmY25通过，renderer79/build通过是修复前证据，最终须固定修复后源码复验。

第二轮f8WdBw前20通过，normal height781→783重启漂移。独立owned-profile probe证明150%下constructor/native frame与setBounds有不同舍入；安装原生框后再setBounds原normal尺寸，三次真实启动必须exact相同，不能放宽该恢复断言。全新默认尺寸允许≤1DIP物理舍入；显式功能回退保留旧constructor路径，其height与900固定options允许≤4DIP框架舍入，实际bounds记录。它们不是任意保存尺寸恢复的容差。

第三轮5L3pHS前27通过，三次exact normal/最大化/坏配置均通过，但填满workArea时1707→1708 outward rounding。补测量后校准仅修实际越界，必要减1DIP并把位置移回可见范围。边界实例必须实际bounds完全在workArea内、内缩≤2DIP；普通保存尺寸exact断言保持，不以宽松容差替代防漂移。

第四轮5RyhWM仍27通过，同一贴屏边界1706请求仍被native non-client报告1708，独立edge probe逐值证明1705请求→1706实际。因此校准最多两次、只调整越界字段并读回，不重发未变维度；不能把content宽度当outer宽度或放宽“实际在workArea内”的检查。不是外部阻塞，继续修实际算法。

- [x] 本轮窗口恢复实例与完整差距表持久化，实际门禁/失败/下一步见104；完整D1–D7仍未通过。
- [ ] D1/完整D2–D7视觉与交互逐项关闭；长历史/焦点/IME/失败网络/缺失参照状态专项。
- [ ] P07先冻结持续goal及办公工具共同契约：真实文件变更/版本/撤销/审阅、Office/PDF正文与导出、联网国内可达、图像/附件/产物回执；按依赖逐项接typed/main/工具/前端和实例，不做假卡。
- [ ] P08真实VPN关闭场景、自有中国API、Windows安装/旧数据与最终八组。网络状态未实测不能称“不翻墙验收完成”。

本轮不改教育数据真源、本地优先、必要脱敏、逐次教师确认或来源谱系；不上传教师原资料、不推送/发布、不改系统网络、不派子agent。三元题组暂停。

Electron行为核对来源：[BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)、[screen](https://www.electronjs.org/docs/latest/api/screen)。ZCode是本地可核复用源，不是Codex官方桌面前端源码。
