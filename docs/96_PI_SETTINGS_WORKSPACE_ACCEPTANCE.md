# P06c-C 统一设置工作区验收

日期：2026-10-03。合同 docs/95；M10/M01，复用 M11 本地备份。**C 功能专项通过，完整 Codex 视觉与总目标仍未完成。** 最终 build-final3/index-CQ0eiDPc，未新增依赖/表/格式/通道，未提交或推送。

## 1. 实际交付与设计映射

| 教师入口 | 真实能力/真源 | 复用与适配 |
| --- | --- | --- |
| 模型与连接 | 原 encrypted settings / 官方模型目录 / CAS / native 模型规则 | 原 PiModelSettings 内嵌；默认独立模式保留 |
| 技能 | 原管理 API、版本、启停/编辑/归档权限 | 原 PiSkillSettings 的同一内容内嵌；原 Hana SkillRow 与 Modal 保留 |
| 工作目录与权限 | main 核活动会话后取 snapshot，原 directory chooser / binding / memory scope | 原 PiMemoryScope、Hana Section/Row；既有历史目录明确锁定 |
| 界面偏好 | xiaozhi.ui.v1 schema1 的 sidebar/aside/files 三个展示布尔 | 原 HeroUI Switch；与 Pro 壳共享一个读取/写入帮助模块 |
| 归档 | 原 SQLite 活动/归档列表与主进程公开 snapshot | 原 OfficeConversation/Pro 组件只读查看，未新增恢复或执行入口 |
| 本地备份 | 原 typed exportDataRoot/verifyDataBackup 与原格式 | 原 DataBackupPanel 增现代展示，HeroUI Button；原旧展示保留 |

PiSettingsWorkspace 只编排六类真实能力，App 仅替换正式 Pi 设置入口。SearchField + 原 Hana 搜索 normalizer/ranking 支持中文、英文、多词、全角字符；只索引能力名称/别名/分类，不索引 Key、资料、路径、聊天内容。搜索结果跳转到对应页面/控件位置；空态、清空、Escape 可用。没有 Hana 人格/实验功能等空壳选项。

Hana0.449.0 Apache-2.0 原 SettingsRow/SettingsSection 完整文件，以及类型/搜索函数 AST、导航/search-result CSS 原规则，共四份输出+LICENSE静态5项。source/output hash 和适配在 renderer office/hana-settings/workspace-source.json。HeroUI MCP 已读取文档；SearchField source endpoint 返回 not found，直接复用已安装3.2.2原组件并核本地实际声明/实现，未伪称下载到了它。Switch/现有 Pro 已复用，Pro32文件182153字节来源保持。来源复用不等于 Codex 官方同源。

备份增加主 frame-only sender 校验，选择器期间即占原宿主全局配置 owner，阻止新 run、模型/Skills/目录/记忆竞争。主窗口与关闭状态在选择返回后再次核验；退出拒绝晚到作业，并等待已开始的文件作业结束。没有新备份格式、自动恢复或云端上传。

## 2. 精确命令与结果

以下 cwd 均为 `D:\WorkProject\EduProject\apps\desktop`。源码随后只有脚本/文档调整，最终应用 out 固定在 build-final3。

| 命令 | 结果 | 证据 |
| --- | --- | --- |
| `npm run build` | exit0，最终 index-CQ0eiDPc | p06cc-build-final3.log |
| `npm run test:renderer-components` | 79/79，exit0 | p06cc-renderer-final2.log |
| `node scripts/xiaozhi-agent/pi-settings-workspace-ui-smoke.mjs` | 最终26/26，exit0，异常0 | H8Y85u/report.json；p06cc-ui-final4.log |
| `node scripts/xiaozhi-agent/pi-settings-local-job-smoke.mjs` | 7/7，exit0 | Wk67Qg/report.json；p06cc-job-final.log |
| `node scripts/xiaozhi-agent/pi-model-settings-host-lock-smoke.mjs` | 原6/6，exit0 | fi7Mmc/report.json；p06cc-model-lock.log |
| `node scripts/xiaozhi-agent/pi-skill-settings-ui-smoke.mjs` | 原 Modal 实际25/25，exit0 | PPOo0w/report.json；p06cc-skills-modal2.log |
| `node scripts/xiaozhi-agent/reuse-hana-settings-workspace.mjs --verify` | 静态5/5，exit0 | p06cc-hana-source.log |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 原 Pro32来源保持，exit0 | p06cc-pro-source.log |
| `node scripts/electron-smoke.mjs` | 最终固定 out 207/207，ok=true，exit0 | p06cc-main-smoke-final.log |

标准 git diff --check 与本轮源码/文档非预期尾空白核验见证据目录的 final-diff/scoped-whitespace；doc28原三处 Markdown 两空格硬换行保留。没有 skipped；未覆盖的目标见第4节，不作已验推断。

### 26项真实设置实例

owned新库/独立profile，从可见设置按钮与实际加密表单开始，读取本次官方 DeepSeek 目录。实际中文/英文/全角搜索、Escape/原清空控件；目录选择器返回受控但主进程授权与文件是真实；记忆空选择 scope 明确保存/关闭清空并读回 SQLite（不是含资料的模型撤权实例）。Skills 内建预览/导入本地合成包默认关闭、启用→停用、CAS编辑v2保持关闭；源包字节不变。

偏好只有原三布尔，返回和同profile重启后的真实面板状态一致；owned storage failure显示未保存并保持当前值，未知schema回退，不将路径字段作为授权。归档fixture用既有 typed APIs 创建/写入/归档，教师从设置页读取真实已保存公开文本；未称归档创建UI已验。

真实创建备份、原app.db文件落盘、原verify逐文件校验通过；受控 chooser取消、非备份校验失败、队列耗尽错误可恢复；另一renderer被拒绝两个backup IPC。真实官方 DeepSeek 简短回复完成且输入清空；另一实际运行中 native Settings→Back 保持同run仍active，备份拒绝busy；正常停止，已有历史目录保持锁定。

真实 BrowserWindow content 1366×768/1920×1080，每页主滚动/导航/页面无横溢出，读取区实际700–780范围（最终780），关键动作与返回完整矩形可达；12份稳定截图。不是未知参考DPI下≤2px或人工教师验收。

原 Modal25另含真实自定义技能/reference read、脱敏、原生manual compact/实际provider、编辑/启用/撤销后的模型隔离、原历史/文件保留、重启、教师问题锁与损坏源恢复。Modal25在build-final2运行；之后应用只改统一设置作用域的CSS，Modal组件/宿主均未变；最终build-final3另有正式设置26和主207。两种UI路径的证据范围分别记录，不用静态来源替代执行。

7项宿主使用已关闭的owned旧fixture副本与真实SQLite/本地文件，受控异步 chooser/file barriers，无 provider请求；检查全局反向竞争、失败释放、close拒绝晚启动/等真实copy收尾、原fixturehash不变。模型6仍为原受控host边界。它们不是官方completion实例。

## 3. 失败与修复

- G3YqWN第一UI错误把SearchField清空按钮也计为分类，7≠6；改只计真实tab IDs。不是产品有七个分类。
- 第一脚本发现root/目录button test ID重复，编码时已改独立pi-settings-workspace-choose；Node内联引号写法失败未写文件，改结构化patch，无敏感内容输出。
- 截图显示旧global input边框污染SearchField，作用域清除；flex main的百分比padding相对父宽导致读取区过窄，改固定外padding+内容max-width780。来源原文件没有改。
- 增强双窗口控件完整矩形/读取宽度后，lLUThq测试假定内容只有div而Skills为section；修selector。ubiCrC实际暴露Skills内嵌max-width:none覆盖统一780，修作用域max-width与两列比例；最终H8Y85u26重新通过。失败日志/截图保留在test-results，不称先前图已精准一致。
- 原Modal KRPNun12后停在隐藏pi-compact，旧测试未展开已经存在的“任务详情”。按实际入口展开后PPOo0w25通过，没有force click或改变产品权限/压缩逻辑；旧脚本同时加owned独立profile，保留本次跨重启。
- build-final与final2中间仅main adapter缩进变化；308个out文件逐一hash差异0，identity报告保留。最后CSS修订后重新build-final3、设置26、renderer79及主207；不能把之前out主207当最终门禁。

## 4. 未验证范围与下一第一动作

本轮不证明完整D1–D7像素级一致/所有组件Codex官方同源、真实无VPN/国内多运营商网络、安装包、Office/PDF正文/办公产物/图片工具、最终八组和真实教师库迁移。归档恢复与备份恢复没有新增；含资料的教育记忆模型撤权沿用前序P05/B2证据，本轮只验证统一页scope的保存/清空接线。

原字节截图/report/log/source manifest在 `design/codex-2026-10-03/p06-settings`，artifacts.json记录绝对来源、bytes/SHA256；不复制DB、Key、native JSONL或私有摘要。原R1/R2仍见67。

**下一第一动作：四根→67第1/2/5/8/9→35最新→本文。P06d先对照原R1/R2与当前最终页面逐组件整理D1–D7差距，冻结docs/97视觉交付合同。** 保留唯一Pi/Hana循环、分段公开工作说明/真实工具回执和原Pro闭包；按阅读区、状态行/工具组、侧栏/资料卡、输入框/待办与权限/模型菜单逐项精准适配，先1366再1920，同DPI未知不能虚称≤2px。最终实际过程/工具/澄清/确认/停止/重启验收后再勾对应子项。后续P07办公文件/联网图片产物，P08实际无VPN/安装/最终八组；总目标active，三元题组暂停，无commit/push/系统网络或真实教师数据变更。
