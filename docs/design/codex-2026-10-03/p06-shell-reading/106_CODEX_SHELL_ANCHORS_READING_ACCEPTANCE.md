# P06d-E 壳锚点与长阅读：实际验收及待收敛项

日期：2026-10-04。合同105；M10/M01。**壳锚点和文件/设置阅读保持切片交付，流式阅读间歇漂移仍待收敛，完整P06与目标未完成。** 用户R1/R2与67继续设计真源；嵌入Pi0.80.3/Hana0.449.0，国内DeepSeek；三元题组暂停。

## 1. 已交付与来源

- 复用原Pro AppLayout/Sidebar/ChatConversation/PromptInput/ScrollButton；官方HeroUI MCP查app-layout、chat-conversation、sidebar文档，现有Pro源闭包32文件/182153bytes未改。不称Codex官方前端同源。
- office作用域轨52、侧栏254、主区左306 CSS px；sidebar #f6fdfc，native框 #e6f9f7；native标题栏仍36，AI壳顶部留白8、会话标题52。未改原native overlay/main几何。
- 原R2 2559×1529与实际owned native2558×1529：row500连续主白区均从物理x459开始；sidebar RGB246/253/252、title RGB230/249/247相同。当前actual scale1.5/zoom1；原DPR/字体未知，不能将条件换算写成官方CSS参数或全页像素一致。
- 首次文件分栏重挂载使原历史段落跳至底部；新增OfficeReadingPosition临时视图适配，接原ref/onScroll。session-keyed Context只保留一个thread/atBottom/scrollTop/段落身份、块索引和相对位置；文件/设置返回按真实段落恢复并通知原Pro取消旧初始RAF。换会话销毁，不进入SQLite、模型历史、权限、配置或云端。
- Hana实际use-quick-chat-auto-scroll和use-continuous-bottom-scroll源码查验：基于sticky/用户意图取消follow，没有可直接接原Pro的历史段落重挂载恢复接口。保留一个滚动控制器；本轮只加宿主书签适配，不安装第二套follow循环。Hana参考树为D:\WorkProject\开源\openhanako\desktop\src\react。
- 无新依赖、表、迁移、IPC、业务文件格式或授权；Key仍忽略的本地配置。旧入口和教育脱敏/教师确认/来源谱系保持。

## 2. 固定源码验证

cwd：`D:\WorkProject\EduProject\apps\desktop`。最终runtime build2；renderer `index-TO1Rvh_r.js`。后续只改测试诊断/真实页面操作及文档，最后主smoke同源码重建同入口；活跃实例期间未改out。

| 精确命令 | 实际结果与报告 | 边界 |
| --- | --- | --- |
| `npm run build` | exit0，p06de-build2.log | typecheck/main/preload/renderer |
| `npm run test:renderer-components` | 79/79，exit0，p06de-renderer2.log | 原组件状态 |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 32/182153bytes，exit0，p06de-pro-source.log | 原字节来源，不代替交互 |
| `node scripts/xiaozhi-agent/reuse-window-chrome.mjs --verify` | 2，exit0，p06de-chrome-source.log | 原overlay/许可证 |
| `node scripts/xiaozhi-agent/pi-shell-reading-ui-smoke.mjs` | **13/13两轮，7Fav0X、qxTanz，exit0**，reading5/6-diagnostic.log | 真DeepSeek合成75段中英历史/新增delta/实际wheel/原回底；actual native1366/1920；文件开关/设置返回同段落、多行草稿、焦点、composition协议、native字符输入、新会话隔离及原历史返回。两次早期漂移未确认原因，见§3，不能仅据最后成功关闭稳定性 |
| `node scripts/xiaozhi-agent/pi-workspace-files-ui-smoke.mjs` | **25/25，nGMR4b，exit0**，p06de-files-final.log | 合成文件/typed host/版本/取消/权限/归档、双native窗/重启；无Office/PDF正文 |
| `node scripts/xiaozhi-agent/pi-public-process-ui-smoke.mjs` | **17/17，X1Bkph，exit0**，p06de-process-final.log | 真DeepSeek公开段落与真实工具、来源/耗时、失败、compact/待答/停止/重排/重启；CSS viewport与native捕获分开 |
| `node scripts/xiaozhi-agent/pi-control-menus-ui-smoke.mjs` | **10/10，JqTRNn，exit0**，p06de-menus-final.log | 实际模型/权限菜单、侧栏搜索、两设置返回未发草稿；chooser取消受控 |
| `node scripts/xiaozhi-agent/pi-public-process-approval-ui-smoke.mjs` | **5/5，VdPg8z，exit0**，p06de-process-approval-final.log | 真实拒绝零写、批准一次hash回读、重启不重放 |
| `node scripts/xiaozhi-agent/pi-approval-ui-smoke.mjs` | **22/22，se4WUl，exit0**，p06de-approval-final2.log | 实际等待确认/身份/重复命令/拒绝/停止/源变更/kill/复制后不确定验证/重启；受控crash cut，不是provider故障 |
| `npm run test:smoke` | **207/207、ok=true、exit0**，p06de-smoke-final.log | 最后同源码构建和主冒烟 |
| `git diff --check` | exit0，p06de-diff-check.log | 无commit/push，保留旧脏改动 |

以上最终套件无skipped，不合并为“完整Codex通过”。Windows真人IME、真实系统多屏/DPI变化、官方设置/Skills未知图、全页字形/换行、真实断网、VPN-off/安装均未验。

## 3. 失败保留与结论边界

1. 9vjJfD（adapter前）前5通过，历史合成段落9开文件前offset -3.635，打开后 -7288.302，实际滚到底。书签适配后两最终轮同段落/offset -3.635、scrollTop650保持，关闭/设置返回均通过。
2. ehqyar和QxVuUo各前3通过后流式上读断言失败。Qx实际同thread，scrollTop0→380，阅读块0→5，offset40→-15.219；不是仅数值变化。原因尚未确认，不能写成已修复。加入只观测scroll/scrollTo/wheel事件及有界400条诊断；其后两完整轮保持same item/block/offset40和scrollTop0到终态，未复现不能抹去失败。下一107先定位该间歇问题。
3. ApPbB6前4通过；真实底部是li而非p，测试读取块只找p导致失败。改按p/li/标题/pre真实语义块查验，同身份与位置标准不放宽。
4. R2GELo前11通过；原Pro Sidebar新聊天是链接语义，测试限定button不存在。改点实际可见“新聊天”，后两轮新会话/原历史返回均通过；未改runtime控件或伪建会话。
5. SJWFuz旧审批前2通过，任务详情默认折叠导致原句hidden。夹具改成实际点击pi-task-details-expand后等待原句，原断言保持，se4WUl最终22通过。

证据仅属于owned测试窗口/合成资料。原图不编辑、不生成或缩放替代；档案`design/codex-2026-10-03/p06-shell-reading/artifacts.json`登记原字节与SHA，不复制Key/DB/私有摘要。

## 4. 下一动作和完整待办

第一动作：四根→67§1/2/5/8/9→35最新→105/本文§3。冻结107阅读漂移定位合同：同thread原段落/布局/scrollTo、scrollTop setter、wheel、DOM重挂载及公开delta时序观测，先找真实来源，再做必要适配。不能降低scrollTop/段落身份断言、用假文本或反复碰巧成功关闭问题。

之后按103完整D1–D7核未完成项。P07先冻结持续goal与办公工具共同契约：真实文件变更/版本/审阅撤销、Office/PDF正文与导出、国内联网、附件/图像/产物来源；main→typed→原组件→实际用户链路。P08实际不翻墙、自有中国API、Windows安装/旧数据/最终八组。总目标仍active，不改教育本地真源与教师决策边界。
