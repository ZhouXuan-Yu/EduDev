# P07-E 小智持续目标生产切片验收

日期2026-10-04；合同[156](156_PI_PERSISTENT_GOAL_PRODUCTION_CONTRACT.md)。完成本轮有限M01/M10切片；完整Codex体验目标仍active/NOT_ACCEPTED，三元题组暂停，不提交或push。

## 1. 实际交付

- SQLite增量`xiaozhi_pi_goals`保存独立目标、1–8项验收要求、状态/revision、进度、下一步、实际工具/run证据及待审阅结果。CAS、同会话单live目标、幂等命令、归档拒绝；不替换旧native/业务数据。
- shared版本化参数→主frame IPC→typed preload→真实`PiGoalControl`目标入口/进度条/暂停恢复结束/逐项成果验收。直接复用既有Pro ChainOfThought和OSS3.2.2 Button/Modal/TextArea/Checkbox/Label，MCP文档与本地源码核对；未手写新的组件库或声称Codex专有同源码。
- 原Pi1.0.2 `turn_end`/BoundaryResult原生继续，同run仍持有原session。自然工具继续不叠第二请求；纯文本结束且目标未提交验收时写独立原custom checkpoint/custom_message继续。无renderer循环、第二agent loop、fake教师追问或累计次数/时长/token预算。
- 每个模型请求重读当前主进程目标事实，必要脱敏上下文放在稳定前缀之后。普通聊天过滤旧goal custom context、没有目标进度工具和自动继续；原native字节/旧身份不重写。最新自动压缩仍由原Pi/Hana适配负责，不恢复旧预算或旧agent-loop覆盖。
- `report_goal_progress`只能保存进度/提议审阅，不能自行completed。实际工具证据由main收集；教师须逐项勾选，候选文本必须匹配本会话成功持久run/assistant，才完成。这里只验证合成文字清单，文件效果仍按原审批/readback及FILE系列验收。
- pause/end先CAS再取消，只取消实际匹配goalId/runId的目标执行，不取消同会话另一普通聊天。原停止把active/waiting目标转中断，不能覆盖paused/ended。冷启动不自动恢复暂停或重放确认。连续三次相同内容/步骤且无新效果转中断，明确需调整，属于无进展保护而非运行配额。

## 2. 当前构建与原始证据

命令工作目录`D:\WorkProject\EduProject\apps\desktop`；Node24.12.0，Electron/原Pi1.0.2，测试模型`deepseek-flash`，ignored `.env.local`凭证。C使用明确的旧Pi0.80.3合成数据库副本`pi-browser-ui-uY2Gak/data`，原源SHA不变。API环境凭证与隔离profile不是用户日常保存设置验收。

最终独立`pi-goal-build4`与正常`out`共323文件逐项SHA完全一致，整体SHA `3b81b5e6a608ae849d7daf11c4d7aecff2f52d508bb2407493386f5b8b9952d6`，renderer `index-BEcHyfGK.js`。build3→4只局部Checkbox布局CSS，main/preload13文件逐项相同，因此build3的主207门禁对应同一main/preload；最终C18使用build4。

| 层/命令 | 真实结果 |
| --- | --- |
| `npm run build -- --outDir test-results/xiaozhi-agent/pi-goal-build4`；`npm run build` | TypeScript/Electron/Vite exit0；同323文件SHA |
| A `node scripts/xiaozhi-agent/pi-goal-state-smoke.mjs` | 最终`pi-goal-state-NHWhVR`24/24 exit0，真实Electron SQLite/controller及生产原Pi session；模型协议是明确夹具，不冒充官方API |
| C `OMNI_EDU_TEST_BUILD_ROOT=.../pi-goal-build4 node scripts/xiaozhi-agent/pi-goal-ui-smoke.mjs .../pi-browser-ui-uY2Gak/data` | 最终`pi-goal-ui-BRwT0l`18/18 exit0，真实页面/官方DeepSeek/原Pi/旧副本/严格随机码JSON三条检查项及下一步/教师验收/等待暂停恢复结束/普通聊天隔离/冷恢复零重放/双尺寸 |
| `npm run test:renderer-components` | 最终`pi-goal-renderer3.log`79/79 exit0 |
| `OMNI_EDU_TEST_BUILD_ROOT=.../pi-goal-build3 OMNI_EDU_E2E_DIAGNOSTICS=1 node scripts/electron-smoke.mjs` | `pi-goal-main3.log`207/207、ok=true、exit0；与build4 main/preload逐文件相同 |
| A `node --experimental-strip-types scripts/xiaozhi-agent/pi-auto-boundary-smoke.mjs` | `pi-auto-boundary-Q00AHI`11/11 exit0，原1.0.2工具批次安全切点/版本容量/失败；不是本轮真实自动压缩UI复测 |
| B `node scripts/xiaozhi-agent/deepseek-cache-live-smoke.mjs` | `deepseek-cache-live-rHuyAF`四次官方200，输入3240，hit3072/miss168，各94.8148%；固定合成前缀对照，不承诺所有生产任务同命中率 |
| C `OMNI_EDU_TEST_BUILD_ROOT=.../pi-goal-build4 node scripts/xiaozhi-agent/pi-web-ui-smoke.mjs` | 最终`pi-web-ui-srkFGa`19/19 exit0，真实搜索/教育部正文/浏览器正文/错误页/开关/停止/冷恢复；报告新增本次固定构建/脚本SHA及前序失败，不追认旧报告字段。NET-01日期差异/NET-02自然截图完整路径仍下一专项 |
| 复用 `reuse-hana-browser.mjs --verify` / `reuse-hana-cache-prefix.mjs --verify` / `verify-web-reuse.mjs` | 原snapshot/wait/完整cache-prefix及原search/reader/Pro SHA通过，未修改vendor body |

A中的生产装配实际纯文本→原BoundaryResult→实读本地合成文件→报告待验收→最终回复，共四原SDK请求、native真实user一条/真实工具。冷重开普通聊天一请求，无goal context/tool/强制继续，原native prefix保留。C实际模型采用自然工具继续，不虚称它必然触发纯文本checkpoint；两分支分别有实证。

C脚本SHA `7c4c1a1ce1290c6ce40542d784a06de26af6fe568e549bda2838c8ca3f753859`。第一文字目标真实2请求/1进度工具，limitsEnforced=false，实际cacheRead8704、input7861/output560。Pi计数的input不含cacheRead，不能直接以8704/7861造超过100%的命中率；此处不提供跨任务性能保证。

已实际查看最终[1366验收卡](../apps/desktop/test-results/xiaozhi-agent/pi-goal-ui-BRwT0l/teacher-accept-1366.png)与[1920等待目标条](../apps/desktop/test-results/xiaozhi-agent/pi-goal-ui-BRwT0l/waiting-goal-1920.png)，组件横排/完整滚动与按钮可达。不是全页同DPI/Codex像素完全一致或人工签认。

## 3. 原失败永久保留

本轮源码/原上游与许可证/显式脱敏测试指标另归档在[源码证据目录](design/codex-2026-10-03/p07-goal-production/archive-manifest.json)，逐文件SHA清单可复核。归档不含数据库、native会话、凭证、profile、原材料、图片或构建二进制；原失败目录与完整隔离实例仍原位保留。

- `hHYsJ1`：真实工具自然继续、严格结果已过，但测试错误要求必然出现纯文本checkpoint；没有改产品强行制造重复请求。判定改为C真实自然工具继续，A另验生产原边界。transport文本既可能string也可能text数组，修正检测，不将错误检测当上下文缺失。
- `ANrmRI`：6项后验收不能操作，最初Checkbox.Control放在Content之外，违反当前原组件结构。按MCP/实际3.2.2源码改为Content包含Control+Label。
- `7eIRHp`：6项后测试仍点击宽field容器空白；改为原可点击Content并断言真实checkbox selected，不force或直接改state。最终Y3fpXD17过；后续仅当前owner取消及普通聊天隔离增加，SmxudX18和最终BRwT0l18过。
- `pi-goal-state-hymfgX`：22项后把原stream转换后的LLM messages误认成native custom role，改查实际文本，并单独核native custom entries/真实teacher数，不将两角色混同。
- TypeScript首次host闭包推断循环错误，以显式Promise返回类型修正；Windows rg wildcard/两次猜不存在的脚本路径和部分读取路径失败保留事实，不当实现缺失。没有清库、放宽权限或改客观答案去通过。

多次通过为不同构建/脚本及分支修复，不宣称同版本三次稳定重复；所有前序失败仍在后续C报告。

本轮当前官方GitHub release API返回Pi `v1.0.2`（2026-10-04）与Hana `v0.450.0`（2026-08-22），installed Pi四包1.0.2；web搜索缓存仍旧0.87.1，不能盖过当前官方API。[Pi原发布](https://github.com/earendil-works/pi/releases/tag/v1.0.2)、[Hana原发布](https://github.com/liliMozi/openhanako/releases/tag/v0.450.0)、[DeepSeek缓存规则](https://api-docs.deepseek.com/guides/kv_cache/)。官方缓存文档HTTP200，稳定前缀/变化尾部和实际usage是核验依据，不假设缓存必命中。

## 4. 用户窗口、测试说明书与下一步

原33640初期保持响应、未强杀或写out；收尾检查已不在，原因未推断。再次检查没有任何Electron后才正常build，沿既有日常启动授权启动`out/main/index.js`，无测试data/profile/E2E/model/key注入。当前62244/Omni-Edu Agent/handle28246872/Responding=True；只说明可见启动，不发送日常任务、不维护已保存凭证或替代D验收。之后保持窗口与out。

已读根[测试样例说明书](../测试样例说明书.md)，基础23例/A–E/首次失败/人工签认规则保持；新增[持续目标补充](testing/持续目标样例补充.md)与本轮映射，原用户联网/图片问题仍开放。当前E持久目标是有限C通过，完整目标仍active/NOT_ACCEPTED。

**下一唯一：按NET-01完整原文核对官网正文落款、网页发布日期、实施时间，再按NET-02自然请求补齐浏览器当前栏目与截图可交付/打开入口，拒绝白屏与伪来源。** 现有browser screenshot只有本机capture事实不能冒充教师已收到/模型已看图；冻结新切片合同后复用原组件/源与typed真实回执。随后全D1–D7/FILE/CFG/Skills同DPI、日常原反馈、P08实际不翻墙/安装/WPS及最终八组。无累计预算、最新原自动上下文与当前DeepSeek cache策略保持，不因本slice通过标全Harness完成。
