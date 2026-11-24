# 小智 UI / UX R1 交付报告

结论：**BLOCKED**。包编号 XIAOZHI_UI_UX_R1_20261124。28项：23 PASS、1 FAIL（状态证据矩阵不足）、4 BLOCKED。**没有达到 UI_R1_DONE，不将这份报告当作 Goal 已完成。** 教师试用 NOT_RUN。

## 本次实际交付

已按解压包完成Phase0后，在独立工作树修复设置布局变量缺失、交互状态混同、当前会话scope误投射、任务信息层级、默认黑三角、读取失败冒充空数据、PPT卡片保存后busy不释放、窄屏最后入口不可见、文字对比度和紧凑选择器尺寸变化。最后补修模型保存失败丢输入、技能页重复一级标题。14项代码缺陷的前后证据见 records/DEFECT_LOG.csv；不等于28项全部验收通过。

OfficeComposer、工具栏和弹层未重做；消息追加与唯一待处理面板仅按本包授权替换指示符，原DOM、枚举、事件、132×20紧凑尺寸和草稿行为保留。保护证明见 evidence/integration-scope-proof.json。未改vendor源、未加UI依赖、未写配置/权限/记忆/数据库/Harness替代实现。

## 代码、构建与窗口身份

- 源码根：D:/WorkProject/EduProject-ui-ux-r1-20261125；分支 codex/ui-ux-r1-20261125。
- Phase0主线：700143faca7051baca892b50cf5081ff297ec9bb；最后实测源码：6f57863f8ffe04b4201248d51175c673e09b67b5。
- 最终out指纹：9bd597bfcf3d98e825dcb3eda92b1ff47a34170d024830a6a7f18fa4138e45cd，481文件；renderer index-Cxb7xwg_.js。
- 正常合入协作者扫描表格提交，包括de2bb12、e7ac890；不回滚、不强推。源码6f57863已正常推到main且当时远端同SHA，证据 source-main-push-last.json。后续证据/脚本提交与远端包含关系见 final-delivery-receipt.json。
- 已启动实际Electron窗口「小智 · UI R1 验收（独立测试数据）」，PID76252，原生窗口也由sky.list_windows/get_window_state核对；启动和可见性见 evidence/review-window.json、review-window.png。
- 启动命令：在 apps/desktop 执行 node scripts/ui-ux-r1-review-window.mjs。直接打开已验过的out，不重新构建旧目录或只启动浏览器。
- 窗口使用本轮独立虚构资料、2道本地数学题和真实模型PPT，不是D盘日常资料根；Pi与原服务真实运行。D:/WorkProject/EduProject 原有未提交内容和其他AI工作树未覆盖。

## 教师可见效果及截图

[18页当前缩略总览](evidence/verification-pages-jETY5M/contact-sheet.jpg) · [当前设置](evidence/verification-pages-jETY5M/settings-1366-current.png) · [Phase0设置](evidence/baseline-pages-5Sg42U/settings-1366-current.png) · [当前问小智](evidence/verification-pages-jETY5M/ai-1366-current.png)。这些是实际Electron截图，原生150%缩放，截图尺寸含物理像素变化，报告同时保留CSS viewport/DPR。

- 设置保持现有日常与高级分层，恢复4/8/12/16/24/40间距，明确当前分类；真实键盘焦点可见。当前分类文字8.87:1、搜索/密钥placeholder4.83:1、模型保存按钮10.42:1。官方disabled状态保留，不因其低对比度覆盖原厂组件。
- 任务卡保留原要求、关键约束、task/session身份和合法下一步；部分记录不能伪造可恢复按钮。任务关联成果仍展开后才查询。
- 目录/结构/题本/讲义/归档读取失败与真正空数据分开，可重试，不显示假的0数量。
- 选择器与详情使用现有HeroUI Select/Disclosure。原生事件适配器 AppNativeSelect 是本地兼容层，不冒称官方Pro；未迁移退役旧AI页面和课堂原件中的合法原生结构，范围见组件表。

## 真实功能与测试结果

逐项判据及证据hash见 delivery.json，页面、组件、配置、旧合同和状态表在 records/。**57幅正常截图只覆盖18页面×3尺寸加学生选择状态，不能代替完整状态矩阵。**

| 命令 / 用例 | 实际结果与边界 |
| --- | --- |
| npm.cmd run build | 最终6f57863集成构建exit0，含TypeScript检查；独立npm ci依赖，非借用node_modules |
| npm.cmd run test:renderer-components | 最终构建261/261，exit0 |
| node scripts/ui-ux-r1-components.mjs | 17项，exit0 |
| node scripts/ui-ux-r1-read-errors.mjs | 8项故障/重试，exit0；组件注入不是provider验收 |
| node scripts/ui-ux-r1-pending-components.mjs | 4项，唯一面板、切项/收起草稿、失败重试，exit0 |
| node scripts/ui-ux-r1-model-buffer.mjs | 4项，宿主拒绝/异常保留password；成功/放弃清除，exit0；未添加密钥持久化 |
| node scripts/ui-ux-r1-settings.mjs | 10项，真实CAS冲突、保存、scope、冷启、返回和键盘，exit0 |
| node scripts/ui-ux-r1-pages.mjs verification | 18页、3尺寸57幅，console.error=0/pageerror=0，exit0；非全状态验收 |
| composer-follow-up-electron.mjs | 5项，真实Pi+受控SSE；队列排序/编辑/删除/追加/撤回、换行、composition事件、原尺寸和冷启无重放，exit0；未冒称物理IME设备操作 |
| ui-ux-r1-paper-current.mjs + paper-readback.mjs | 原UI创建题篮/实例修改/教师确认/真实Pi正式DOCX+PDF，源题不变；最终构建冷启同basket/question/实例和文件hash/原对话返回，5项+3项，exit0；虚构题库，练习用途，非所有地区自然试卷质量验收 |
| ui-ux-r1-live.mjs + saved-ppt.mjs | 真实provider5项抽题/来源/PPT编辑确认保存往返；当前构建4项PPT冷读/任务三尺寸/来源对话，exit0；实际文件3页和教师改后标题独立XML/hash回读 |
| 已安装PowerPoint读取 | 对之前同一真实流程保存的实际PPT只读打开、3页渲染、原hash未改；准确文件与版本见 ppt-native-open/report.json，非冒称每个PPT都已Office实操 |
| pi-settings-workspace-ui-smoke.mjs | 最终构建41项界面/备份恢复/归档/停止/冷启检查PASS，但整体exit1：旧观察器只抓global.fetch，requests空；**失败保留，不能报全套绿** |
| ui-ux-r1-settings-transport.mjs | 单独真实Electron net.fetch证明已存凭据、空env回退、HTTP200、SQLite completed后结束，3项exit0；41项未重复算作本次重跑 |
| npm.cmd run test:ui-style-isolation | 9/9，exit0 |
| npm.cmd run test:ui-contracts | 28通过1失败，exit1：五项历史prompt-input基线指纹，见B2 |
| npm.cmd run test:smoke | 7a17集成版本全套exit0，底层汇总207及前端Electron链路。未把它称为6f全量重跑；未改消费者的继承证明见integration-scope-proof |
| 窄屏与DPI专项 | 390窄屏5视图/8键盘及冷启通过；强制DPR1.25/1.5共8视图通过；只证明forced DPR，不冒充原生125% |
| UI响应测量 | 同机同数据，独立700143f构建对比；3类各10次。改后30次全部≤200ms，最大20.4/2.1/11.1ms；原始样本保留，不计模型耗时，不声称统计性提速 |
| git diff --check | exit0；构建生成物和LF/CRLF警告单列，不伪报工作树全干净 |
| npm audit --json | 现有锁文件30项：5 high/17 moderate/8 low/0 critical；未升级依赖，不宣称审计无漏洞 |

没有单独可用的ESLint门禁被假称运行通过。精确日志、cwd和退出结果见 logs/ 及各report，历史失败保留在本地，公开版本只整理不含私有推理/密钥的失败摘要。

## 尚未完成与恢复条件

1. **B1 / UIR1-08：原生125%缩放不可验证。** 当前原生150%已记录，强制DPR另列。sky启动已有SystemSettings.exe未得到可定位窗口，再查窗口/进程仍无设置；未改系统缩放和其他13个Harness窗口。解除条件：可操作Display Settings或独立真实125%桌面；验证密集页、确认/关闭/返回/焦点后恢复150%。证据 system-scaling-availability.json。
2. **B2 / UIR1-25、26：受保护prompt-input五个旧指纹不一致。** 差异来自effc6c0109bdc4c8fc892ac7ad7639bfbed99cde，早于Phase0；本轮五个源文件未改，本地官方对应文件也不存在。由Composer/组件基线原负责方核对既有功能与来源后提供可审查基线或兼容修复。不得为通过而改指纹、回退功能或改vendor。旧门禁仍失败。
3. **UIR1-09 FAIL：逐页完整状态证据不足。** 正常三尺寸、实际业务链路、若干错误/重试和任务状态已有证据；各页全部长内容、loading、error组合未完成，STATE_COVERAGE逐页保留NOT_RUN。它是验收缺口，不等于已发现业务错误，也不允许被其他截图覆盖。恢复后应先补这张表的具体缺项，再判UIR1-09；不能只重跑57张正常页。
4. **UIR1-28保持BLOCKED。** 全部28项已登记，但未达到全必选通过。旧A01～36仅做影响和回归映射，课堂、参考卷/模板、改编谱系等其他团队原任务没有接管或取消，UNKNOWN/NOT_RUN不改成PASS。

恢复入口：EXECUTION_STATE.md → delivery.json → records/STATE_COVERAGE.csv。机器记录校验返回2（结构有效、Goal未完成），不是exit0完成证明。环境自动Goal工具读取为null，本轮没有虚假complete、pause或声称已替换工具Goal。

## 文件、协作和回滚

完整文件与用途见 records/CHANGED_FILES.csv。关键生产文件：student-settings-layout.module.css（就近布局与状态）、AppSelect/AppNativeSelect（复用组件与原事件）、PiModelSettings（dirty/失败恢复）、PiSettingsWorkspace（显式当前scope/错误状态）、TaskOverviewCard/PiRecoveryOverview（任务层级）、QuestionNotebookWorkspace/TeachingBookWorkspace/MaterialsWorkspace（真实空与错误）、PiOfficeArtifactCard（busy释放）、workbench-home.css（窄屏可达）。业务模型、原权限和持久化策略未替换。

本轮代码提交：a438902、6cfa15e、9c3c414、c2d93a7、6ec9330、7cc4ddd；主线合并提交保留他人工作，最终实测6f57863。共享main回滚应评审后按反向依赖revert本轮具体提交；**不直接revert带入其他团队的合并提交，不reset、不强推、不删数据**。证据提交单独revert不影响生产功能。

用户可在当前窗口：①查看设置并Tab移动分类焦点；②输入模型字段后切页，确认脏状态守卫/放弃；③在界面偏好修改追加时机再返回；④看我的任务并展开约束；⑤从本地题来源返回原对话；⑥打开已生成PPT并返回，确认草稿不丢。此窗口均为虚构验收资料，日常真实数据继续使用D盘原入口；原目录有并行脏改动，未替用户重启/覆盖。

本轮不再加入新首页、六大分类、课堂引擎或额外美化提案。结论维持BLOCKED，供后续解除依赖与补足验收使用。
