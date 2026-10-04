# P06d-F 原生滚动中断与键盘阅读验收

日期：2026-10-04。合同107；M10/M01。**确定的原生动画竞态已修复并实际验收，整体Codex目标仍active。** 旧Qx/ehqyar没有完整scroll命令时序，不宣称已确证与本轮同源；原失败保留。R1/R2/67、嵌入Pi/Hana、中国API、教育办公边界保持。

## 1. 因果证据与实际修改

诊断器仅在隔离Electron实例观察真实scrollTo/scrollBy/scrollIntoView、scrollTop setter、wheel/keydown/focus、DOM重挂载和resize，有界1200条，不替换provider文本或用户动作。原方法参数/返回语义保持，公开模型输出从typed snapshot核验，不采私有reasoning。

- Xp6ajE原13项、pIw18y含流式中段14项通过。hJmnW6前6通过，原ScrollButton发smooth scrollTo(10939)，23ms后actual wheel -30000在同host1/top655.333到达；无新smooth命令，浏览器仍完成到10072.667底部。容器、宽度/高度不变，证明在途原生动画未被原Pro取消RAF逻辑结束，不能把该失效解释成DOM重挂载。
- OfficeReadingPosition在原容器接短原生wheel/keydown监听：上读时instant当前位置结束在途动画，经原scroll通知取消待执行RAF并更新原Pro状态；不preventDefault、不计算滚轮位移、不加第二follow循环，不改Pro源。输入/textarea/role textbox/isContentEditable排除阅读键盘干预，hidden和卸载清理监听。
- 0Veaft第一修复轮前6后超时：诊断已停在top654，零后续移动。新增夹具错误假定一个wheel同时取消smooth且到top0；Chrome消费了本次默认位移。只修新增中断实例为实际中断后同段落/id/块/offset和top在600ms后保持，再第二次actual wheel必须到top0。原有流式顶部/中段位置断言不放宽，不以注入scrollTop代替用户动作。
- 原ChatConversation Root补标准tabIndex=0，实际点击阅读区→PageDown→Home可用。消息、输入、按钮、回底仍原组件；键盘Enter/IME/原生字符输入与同会话草稿保持。
- 新增observe-reading.mjs仅测试诊断，不进入runtime。没有新依赖、共享schema、表、迁移、IPC、权限、数据根或上传规则；原Pro闭包32文件/182153bytes原字节不变，Finesse的真实运行/常驻停止/回执原则和用户截图继续。

旧Qx的top0→380精确归因仍缺时序。本轮以确定反例修复实际竞态，再用原流式顶部和新增中段/中断/键盘/重排场景验收，**不能把两次旧失败删除或改写成已知浏览器问题**；如再次出现，沿本诊断收集原因，不以反复碰巧通过关闭。

## 2. 固定源码、真实实例与门禁

cwd均为`D:\WorkProject\EduProject\apps\desktop`。最终runtime build2，renderer `index-BM1rsdTp.js`；实例期间未改源码/out。随后测试脚本仅加明确reading-width选项，1920实例实际layout和1366元数据分别读回；最后主smoke同源码重建同入口。

| 精确命令 | 最终结果 | 实际边界 |
| --- | --- | --- |
| `npm run build` | exit0，p06df-build2.log | typecheck/main/preload/renderer |
| `npm run test:renderer-components` | 79/79，exit0，p06df-renderer2.log | 原组件状态，不是用户闭环 |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 32/182153bytes，exit0，p06df-source-pro.log | 原组件/BEM等闭包来源 |
| `node scripts/xiaozhi-agent/reuse-window-chrome.mjs --verify` | 2，exit0，p06df-source-chrome.log | 原overlay/许可证，未改main几何 |
| `node scripts/xiaozhi-agent/pi-shell-reading-ui-smoke.mjs` | **16/16，55Ntl1，exit0**，p06df-reading5-keyboard.log | actual native壳两尺寸；实际1920×1080长阅读、真DeepSeek75段历史/公开增长/终态、原回底、流式中段同段落、smooth中断与下一wheel、native PageDown/Home、文件设置/草稿/焦点、composition协议与native字符、新会话和旧历史返回 |
| `$env:OMNI_EDU_E2E_READING_WIDTH='1366'; node scripts/xiaozhi-agent/pi-shell-reading-ui-smoke.mjs` | **16/16，NOm6wY，exit0**，p06df-reading6-1366.log | 相同正式用户路径在actual native1366×768，readingViewport/owned截图/DOM读回；测试进程结束清理该env |
| `node scripts/xiaozhi-agent/pi-public-process-ui-smoke.mjs` | **17/17，A1qTbY，exit0**，p06df-process-final.log | 真DeepSeek公开说明/真实工具/来源耗时、失败/compact/待答/停止/重排draft/重启；CSS viewport与native窗证明分开 |
| `node scripts/xiaozhi-agent/pi-public-process-approval-ui-smoke.mjs` | **5/5，k8W8WQ，exit0**，p06df-approval-final.log | 实际拒绝零写/批准一次hash回读/重启不重放；只合成教研目录 |
| `node scripts/xiaozhi-agent/pi-control-menus-ui-smoke.mjs` | **10/10，Sj3qPH，exit0**，p06df-menus-final.log | 原模型权限菜单/侧栏搜索/两设置返回同草稿；chooser取消受控 |
| `npm run test:smoke` | **207/207、ok=true、exit0**，p06df-smoke-final.log | 最后同源码构建/主冒烟 |
| `git diff --check` | exit0，p06df-diff-check.log | 保留旧脏改动，无commit/push |

以上最终专项零失败/零skipped。不能将这64条套件检查（含两个窗口的相同路径）当完整Codex要求的64个独立功能或全页精度证明。Windows真人IME、真实网络故障/VPN-off/安装、官方未知Skills/设置状态、图片/OfficePDF/持续goal仍独立待验。

Pro官方MCP chat-conversation文档核对支持阅读上移不抢滚动与原ScrollButton；Pro源码未由MCP暴露，本地源校验不声称Codex官方同源。下一办公代码已核Pi0.80.3/MIT root exports和EditOperations可插入操作/原diff；Hana document-extract/AnyDoc lazy/native扩展与媒体读原源是候选，不称已集成。共同合同109固定剩余P07全范围。

## 3. 数据与证据

最终1366中段reading top650/同item块9/offset -3.635，在真实新增delta与终态后完全相同；smooth中断top656.667/offset -10.302，600ms后完全相同，后续真实wheel到顶部。1920对应同语义/位置也通过。原Top0/offset40的流式断言保留。

旧hJmnW6和0Veaft失败、两个前置诊断成功及两最终native成功、过程/审批/菜单图、metrics/report/log/源码/原组件文档元数据和bundle hash原字节归档到`design/codex-2026-10-03/p06-native-reading/artifacts.json`。不复制Key、DB、native私有摘要或教师真实资料，不编辑/生成参考图。

## 4. 下一第一动作

四根→67§1/2/5/8/9→35最新→本文与109。**冻结110 P07-A文本产物/编辑/版本审阅撤销具体合同**，优先Pi原编辑算法/custom EditOperations与当前Hana权限/审批链，不写另一套替换/diff算法；shared版本类型→main proposal/确认提交及恢复→typed API→原组件review/变更/文件打开→真实自然任务/拒绝/批准/冲突/停止/重启/撤销实例。

109还保留OfficePDF、国内联网、附件图像产物及持久目标全部范围；A通过再B/C/D/E和P08，不能缩为Markdown编辑器。已请求补官方Skills/设置图，等待期间继续已授权的真实能力，不推断用户回复。全D1–D7/总目标仍active，三元题组暂停。
