# 阶段一 UX-00：当前基线结果

日期：2026-10-23。**基线已建立；没有实施下一阶段视觉/任务工作台改造，也没有修复本报告测出的长会话性能问题。**

代码起点 `a54755725bb9fbeb1c7a2e19adfb85aa2a9ee11b`，正式 Electron 43.2.0 / Chromium150；真实 `out/main/index.js` SHA256 `b8577682f802506f21f8948c4ca95ddf01361f5a1ea4fcb2f5ecc96438b89aeb`。本轮重新build得到相同SHA。用户已指定每轮直接提交推送 `origin/main`；远端原无main，已从修复基线建立，master历史与GitHub默认分支设置未改。

原始数据：[baseline.json](baseline.json)。最终实例：`apps/desktop/test-results/ux00-Sp3clS`；独立数据/profile：`C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-ux00-ESJoDZ`。本轮没有模型请求、日常数据库写入或学生资料上传。

## 1. 教师旅程：完成范围与入口成本

操作数是脚本明确记录的点击、导航和字段修改，包含建测试数据/缺题探测；不是所有教师完成任务的最少步骤。执行时间包含截图与自动化，不作教师完成时间指标。

| 旅程 | 实际完成 | 记录点击/字段修改 | 尚未验收 |
|---|---|---|---|
| 普通问答/短备课 | 首屏场景点击填草稿；Shift+Enter换行；isComposing/keyCode229的Enter不提交；无run生成 | 1 / 1 | 本片不再发provider请求；完整真实回复引用同SHA的聊天专项23项证据；硬件中文输入法操作未测 |
| 题库组卷 | 空库生成缺题告警、禁止确认、拒绝；界面创建一题→调整蓝图→生成→教师确认保存 | 11 / 11 | 非复杂100分卷；未执行Word/PDF交付，不证明参考答案正确 |
| 学生错题 | 界面创建学生与错题记录→进入错题→文件选择取消→附件零写入 | 8 / 6 | OCR/原图校正、相似/变式题、练习审核未完成，不能称整条链路通过 |
| 学情复盘 | 从同一学生的实际UI录入合成记录生成本地草稿→编辑→保存→SQLite与重启读回一致 | 3 / 1 | 本地模板报告，非模型分析质量；未做正式文件交付 |

本轮8项脚本检查通过，renderer errors 0；这是基线检查数，不是8个完整教学业务闭环。未执行的后段步骤以上表明确保留，脚本没有把它们计作passed/skipped。

观察到的下一轮问题：

1. 组卷默认六个顶层字段加三组分段配置，首次到达“按蓝图组卷”需要滚动；已保存与拒绝后反馈仍在长页面下方。模板化与集中审阅收益高。
2. 错题入口先要求学生、错题记录，再选图片；无记录时不能直接开始图片处理，页面并列多阶段空区域。需要引导当前阶段，保留OCR/脱敏校正。
3. 复盘编辑器可见SQLite、Markdown、`mistake`类型等工程文字；普通教师必须理解编辑真源/初始快照/最终交付区别。后续需转换为教师语言并关联真实交付入口，不能伪称模板报告是AI诊断。
4. 空会话仍显示“持续目标”、权限与技能，左栏“新建文件夹”先于主要最近记录；参考图的输入分层尚未实施。

## 2. 视觉、缩放与按钮可达

共60张原生Electron合成器截图：5种页面 × 两尺寸 × 浅/深 × 应用zoom100/125/150%。名义窗口尺寸是Electron内容区DIP；截图物理像素另保存在JSON。当前显示器有100%和150%系统DPI；renderer实测devicePixelRatio=1.5，应用放大后为1.875/2.25。本轮**没有把应用zoom称为Windows125%/150%系统缩放验收**，未修改系统显示设置。

最终全部组合：未测出document水平溢出；聊天输入在可视区；22条“初始视口外控件”均在内部滚动后可见且中心hit-test命中，**不属于22个不可达bug**。例如组卷生成和复盘保存要滚动，是操作成本问题。未对全站所有按钮做穷举，不据此宣称全部功能无障碍通过。

第一次截图脚本使用CDP capture，在Electron zoom下取到裁切图，且一次zoom切换几何未稳定；最终改为等待实际CSS视口、有限动画结束、原生`webContents.capturePage`，再记录按钮滚动后命中。早期实例ux00-hh0acF的截图不作最终视觉证据；性能数据作为重复观察保留。曾因未提供正常启动所需本地配置导致启动timeout，补正常配置后正式运行；配置只读、不输出密钥、未发模型请求。

代表截图：

- [1366聊天首屏](screenshots/empty-chat-light-1366-zoom1.png)
- [1366应用150%放大](screenshots/empty-chat-light-1366-zoom1.5.png)
- [1366组卷蓝图](screenshots/paper-blueprint-light-1366-zoom1.png)
- [1920深色确认试卷](screenshots/paper-confirmed-dark-1920-zoom1.png)
- [1366错题空阶段](screenshots/mistake-empty-light-1366-zoom1.png)
- [1920深色复盘](screenshots/review-draft-dark-1920-zoom1.png)

## 3. 长会话实测：需前移处理的性能缺口

合成测试库包含100/1000条持久化消息（50/500回合），每回合短正文及公式、无大附件。直接构造测试SQLite仅用于压力，不当作真实Pi执行/教师事实。正式main负责装载，renderer实际渲染，未替换snapshot或IPC。

每组会话切换、输入与snapshot各30次。会话切换计时包含点击、真实装载、渲染和两帧等待；输入为Playwright fill→两帧绘制等待，**不是原生键盘input-to-paint专用追踪**。snapshot是单独调用typed preload获取JSON并测序列化体积，未统计全部应用IPC流量。下面均排除模型网络等待。

| 指标 | 100条 | 1000条 |
|---|---:|---:|
| 会话打开p50 / p95 | 261 / 372 ms | 1335 / 1498 ms |
| 输入测量p50 / p95 | 36 / 43 ms | 210 / 284 ms |
| snapshot IPC p50 / p95 | 8.9 / 11.4 ms | 18.7 / 23.7 ms |
| 单次snapshot JSON字节 | 37,431 | 271,783 |
| 页面DOM节点 | 4,425 | 41,325 |
| 测量末renderer JS heap | 65.7 MiB | 507.3 MiB |
| 测量末renderer working set | 385.8 MiB | 1459.9 MiB |
| 120帧滚动中>50ms / 最大帧间隔 | 0 / 9.9 ms | 0 / 47.5 ms |

内存值是30次切换后的瞬时采样，未强制GC、不是稳定常驻需求，也不能据此断定内存泄漏。滚动是脚本上下跳转采样，不等同真实连续wheel FPS。前一实例1000条切换p95约1541ms、输入p95约339ms，说明有运行波动；最终基线仍显示量级差异。

源码证据与推断分开：当前`production-host.snapshot`逐条装载消息并返回完整turns，`PiEducationWorkspace`对事件增量投影，`OfficeConversation`映射所有已载turns；不能说每个token都通过IPC全量读库。当前输入草稿与对话共享React组件树，长历史节点量和输入耗时同时显著上升，**提示渲染/组件订阅范围是优先排查对象，尚未用React profiler确认单一根因**。snapshot数据量/耗时也会上升，应单独测分页收益。

冻结下一片性能目标（同机同fixture/同测量方法，目标不是已实现值）：

- 先隔离输入草稿订阅、稳定历史组件和选择器，1000条输入p95≤100ms；100条p95≤60ms。
- 1000条会话打开p95≤1000ms；如要分页或虚拟化，独立冻结typed IPC与恢复合同，确保较早消息、来源、审批、阅读锚点可达。
- 如采用窗口化，初始DOM≤10,000；不通过丢消息或卸载正在编辑审核对象来达标。
- 复跑30次并与当前JSON比较；内存必须记录同样的切换次数与采样点，不凭GC前后数值宣称优化比例。

## 4. 安全依赖基线（未修复）

实际npm audit：原始d3e2dec lock为11项（critical1/high7/moderate2/low1），当前lock为15项（critical1/high7/moderate2/low5）。新增4个低危条目为math/rehype/remark/micromark链上对既有KaTeX告警的传播；不能说新增了4个独立漏洞，也不能说风险为零。现有critical/high项仍存在，本片没有执行audit fix或跨域依赖升级。后续需要独立核对实际可达面/修复版本/兼容，而不是随视觉改造批量升级。

原始完整JSON留在`test-results/chat-audit-20261023/npm-audit-{baseline,original}.json`；本仓库 [checks.json](checks.json) 记录摘要和哈希。audit exit1表示告警存在，不能写成通过。

## 5. 命令、证据和下一步

在`apps/desktop`执行：

| 命令 | 本次结果 |
|---|---|
| `node --check scripts/xiaozhi-agent/ux00-baseline.mjs` | exit0 |
| `node scripts/xiaozhi-agent/ux00-baseline.mjs`（也可`npm.cmd run test:ux00-baseline`） | 最终8项检查、60张图、每组30次；success true，renderer error0 |
| `npm.cmd run build` | exit0，正式main SHA与测量相同 |
| `npm.cmd run test:renderer-components` | 217/217 |
| `node scripts/xiaozhi-agent/chat-experience-boundary-test.mjs` | 16/16 |
| `npm.cmd audit --json`及原始lock临时目录`npm.cmd audit --package-lock-only --json` | 均exit1，以上告警保留 |
| `git diff --check` | 收尾记录于checks.json |

本片无产品业务代码改动，只新增基线脚本、npm入口、证据与约束/状态文档。没有重跑207全兼容或23项真实provider，因为产品构建内容未变；既有结果见上级DELIVERY，不冒充本片新运行。

阶段一交付为**可重复基线与缺口接受**。下一片先处理长历史输入性能，再按参考图实施聊天视觉/输入分层，并复跑本基线；统一任务/成果工作台与后续业务合流按NEXT_IMPLEMENTATION_PLAN逐片推进。本片不越级同时修改所有页面。
