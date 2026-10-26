# 原厂组件样式恢复与公开轨迹交付

> 最新接受状态：用户指出准备/等待/生成不是模型思考内容，此意见成立。下文保留原厂样式和运行轨迹的实测证据，不作为模型推理输出验收。用户随后批准接入模型实际返回的推理字段，已实施并单独验证，见 [最新模型推理交付](../MODEL_REASONING_DELIVERY.md)；本文旧“思考过程”截图属于诊断历史。

本轮先审计并提供 [根因与最小方案](ROOT_CAUSE_AND_PLAN.md)，用户明确批准A恢复原设计；随后指定**只用亮色**，并再次要求解决空过程。已完成本片局部修复及验证，整体界面“高级感”没有擅自重设计。Git起点main/a4100b9，审计前未提交改动全部保留；当前提交覆盖本会话已授权的相关增量。

## 根因与修复

| 根因证据 | 局部修复 |
|---|---|
| 官方CSS在components层；styles.css/office/glass的未分层规则覆盖字体、颜色、尺寸、气泡和输入壳；pi主题重新绑定官方token | 应用PostCSS scope在data-heroui-native根止步，恢复官方default/light主题。保留外层布局与业务内容；新增例外表禁止vendor slot/BEM/state/important覆盖 |
| 键盘Focus同时命中官方box-shadow焦点环及glass.css:108额外outline | 保护边界内只保留原厂Focus；Hover、Pressed、Streaming也由原厂规则决定 |
| main入口OSS→Pro，browser-status却Pro→OSS；打包后基础Button反压Pro.Trigger | 两入口统一经过heroui-styles，固定OSS→Pro顺序；没有追加颜色补丁，也没修改官方CSS |
| Pi真实活动/工具事件存在，isStreaming已正确映射；但activity只保存最后阶段，且旧assistant metadata只保存publicItems | publicStages保存真实stage/since/sequence，按事件顺序穿插公开说明和工具；无工具普通问题也能回看准备/等待/生成。限64段并提示省略数；旧数据不补造 |
| 预算SDK时间不包含全部准备阶段，若直播用墙钟、终态切回usage会缩短 | 增加可选finishedAt/traceElapsedMs，保存从首个真实preparing到宿主终态的处理时间；预算usage保持独立。最终首轮22,677ms显示22秒，重启一致 |

审计清单扫描34份应用CSS，识别153条组件相关候选、38条交互候选、10条含important规则；这是待审查候选数，不等于全部都有错误。原始[source-inventory.json](source-inventory.json)、[before-cssom.json](before-cssom.json)保留实际选择器、层级、来源、继承与computed值。构建无source-map的规则明确标sourceCandidates，不伪造原文件映射。

`styles.css`保留原内容，通过构建边界限制其作用范围；没有整份重写或批量覆盖业务页面。当前保护范围是Pi对话、输入、相关下拉/提示及回复弹窗。侧栏/任务资料/教育专用审核面的历史皮肤已入清单，尚未整体迁移，不能称全应用已恢复原厂视觉。

## 修改文件

| 范围 | 文件 |
|---|---|
| CSS隔离与入口 | scripts/css-native-boundary.ts、electron.vite.config.ts、renderer/heroui-styles.ts、main.tsx、browser-status.tsx |
| 保护根/外层布局 | OfficeComposer、OfficeConversation、OfficeReplyActions、PiEducationWorkspace、useNativeHeroUITheme、native-component-boundary.css |
| 公开轨迹与正文 | OfficeAgentTrace、OfficeAgentTurn、agent-trace、OfficeToolProcess、PiConversationSurface |
| 持久化/共享契约 | production-host.ts、office-agent.ts、xiaozhi-agent.ts、xiaozhi-projection.ts、public-trace.ts |
| 固定亮色 | main/index.ts的nativeTheme.themeSource=light及原厂light主题根 |
| 门禁与证据 | ui-style-*脚本、agent-trace-boundaries、chat-experience-electron、UX00亮色选项、package命令及Goal/CURRENT/四协作文档 |

第三方ChainOfThought三个文件与本地原始来源逐字节相同，官方两份CSS也未改，见[vendor-provenance.json](vendor-provenance.json)。无新依赖、DDL、Agent loop或上传规则变化；只在原有消息metadata与现有公开事件上增加可选字段。

## 前后截图与交互验证

- 修复前：[收起](before-light-1366-collapsed.png)、[展开](before-light-1366-expanded.png)、[真实工具](before-light-1366-real-tools.png)。
- 最终：[真实三阶段与正文](final-light-1366-public-stages.png)、[1366展开](after-light-1366-completed-expanded.png)、[1920展开](after-light-1920-completed-expanded.png)、[键盘Focus](after-light-1366-keyboard-focus.png)、[鼠标Active](after-light-1366-active.png)。
- 失败：[展开](after-light-1366-failure-expanded.png)、[收起](after-light-1366-failure-collapsed.png)，重试控件仍外露；1920亦验证。
- 最终亮色双尺寸[matrix-index.json](matrix-index.json)及各matrix文件包含真实innerWidth/innerHeight、DPR1.5、CSSOM和原厂对照。过程按钮、textarea、发送按钮逐项对照仅加载未经修改的官方CSS，字号/字体/色彩/间距/主题token一致；对照iframe只用于样式，不冒充实际运行或交互。
- Streaming实际检测到text-shimmer动画约1.68秒，公开工具及正文由真实Pi/DeepSeek驱动。早期暗色样本仅为根因诊断；用户已取消暗色要求，最终不把暗色当接受范围。一次减弱动画采样时运行已经结束，保留missing，未伪称通过。

## 测试与启动

所有命令在当前工作树apps/desktop执行；精确日志SHA、构建SHA、实例及窗口路径见[checks.json](checks.json)。29项provider实例之后仅删除14条已被保护边界阻止的初版trace覆盖并修正一处类型注释；正式backend字节相同。清理构建后重新执行冷读、双尺寸原厂CSS对照与截图，不将此前provider实例冒充又一次模型调用。压力脚本事后仅纠正一条沿用旧报告的提示语，测量数据没有重写。

| 检查 | 结果与范围 |
|---|---|
| npm.cmd run build | 最终构建/类型通过 |
| npm.cmd run test:renderer-components | 217组件通过；已把6项样式隔离门禁接入该常用命令 |
| npm.cmd run test:agent-trace | 19项通过，含阶段记录/顺序/去重/限长/正文分段/计时/失败与旧记录 |
| node scripts/xiaozhi-agent/chat-experience-boundary-test.mjs | 16项通过 |
| 正式Electron真实DeepSeek | 最终chat-experience-M1HXRq，29项、renderer error0；公开阶段、真实工具顺序、流式正文/完成折叠/重开、数学、选区/复制/修改/保存、停止、教师追问、SQLite/文件与冷重启 |
| 原有electron-smoke | 样式恢复后的207项通过；此后Pi阶段与完整墙钟的可选增量由最终19项/29项覆盖，没有把早先207项冒充最终字节重跑 |
| 真实失败管线 | 最终构建受控Electron net.fetch错误，1次拦截，正式Pi/preload/renderer/本地持久化产生failed；不是供应商事故。finally恢复，最终窗口无拦截，见controlled-failure.json |
| UX00亮色复测 | ux00-mvD4Az：8项、30截图、renderer error0；合成历史与四旅程有限范围，非完整OCR/复杂卷/Office验收 |
| npm.cmd audit --json | 仍15项告警：critical1/high7/moderate2/low5；未自动升级依赖 |

测试失败与修正均保留：选区固定坐标、宿主快照先于DOM、Hover变体断言、iframe加载时序、最小化窗口尺寸检查、global fetch错误注入无效。最终改为真实选区/可见文字、原生窗口恢复与尺寸断言、正确的Electron provider网络边界；没有绕过失败或把静态页面当作闭环。

已启动当前工作树正式构建、独立测试库，选中最终真实备课会话并展开三段公开阶段，正文位于其下。最终窗口固定亮色1366×768，原生文件选择等行为未mock，临时故障拦截已移除。可点击“新聊天”测试新问题；旧历史没有保存的阶段仍会明确显示未记录。

## 未解决事项

| 长历史指标 | UX00旧基线 | 本片复测 |
|---|---:|---:|
| 100条切换p95 | 372ms | 269ms |
| 100条输入p95 | 43ms | 37ms |
| 1000条切换p95 | 1498ms | 1687ms |
| 1000条输入p95 | 284ms | 270ms |
| 1000条DOM节点 | 41325 | 46825 |

千条会话新增原生过程入口后DOM和切换成本增加，输入仍慢；本片不宣称性能门禁达标，后续需单独做长历史渲染隔离/分页。压力复测与最终构建之间仅增加终态墙钟字段与显示优先级，合成历史DOM/CSS不变；不把此复测说成最终构建全量重跑。原始计时含自动化绘制等待，不是原生键盘延迟。完整比较见[performance-after.json](performance-after.json)。

整套高级感、侧栏/专用审核全面原厂化、长期教师使用、原生系统DPI/安装器/Office输出和完整教育闭环均未以本片冒充接受。下一轮视觉方案必须先确认，不能继续自行调整组件设计。
