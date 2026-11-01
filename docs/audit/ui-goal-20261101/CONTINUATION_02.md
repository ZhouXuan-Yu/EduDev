# UI续接02：请求篇幅约束与运行中手动重开

基线：`c59ec05b240b1e0cb56bcd2c300c82c071636733`，上一轮已交付main并启动D盘实际窗口。本片复用独立任务分支，开始时clean。此前工程通过、原失败及M3评分不改写；不扩大为所有UI或质量已通过。

## 已定位的缺口与最小范围

- M3解释307字符，超过原冻结160–240工作容差；已有通用总篇幅要求，缺少当前教师请求中不同部分的篇幅边界，且扩写了不必要知识。此为源码与公开答案支持的机制，不认定为单次模型违令的唯一原因。
- M3显式交接seq92时已观察到终态前自动收起；手动重开在先采集双尺寸截图之后，记录seq522已到终态，后继delta为0。先修验证调度，不据缺证修改组件。
- 生产仅新增当前请求的保守范围提示并沿既有prompt拼接接入；原教师字节置末，授权/来源/物理条件保留。不做UI截字、自动第二模型改写、题目数值特例、全局system/技能/预算变更。
- QA先观察真实交接，再及时用真实键盘或点击重开；后续同run正文delta、完成后展开与冷启默认收起分别验证。双尺寸采集移到不阻塞该窗口的稳定状态，不能将重开截图称为自动收起截图。
- OfficeComposer/工具栏/弹层、vendor、Pi事件语义、审批与持久化不改。U4-V3是另外已确认方向的生产增量，本片不将离线原型26项当实现。

## 运行前冻结的实际验收

实施、独立审查及本地相关测试后，在新源码构建上只声明一轮MIS真实provider运行：`--scenario=misconception`，原教师prompt与PDF字节、模型标签deepseek-flash保持不变，不注入自定义题意。原prompt SHA256 `b3aa3d746779dc9e3384f2856f77889d51ea3c94171b423cfafdcfc36a3743f3`；PDF SHA256 `309735f1bb95aef4b849af7a759848393a4b780d52269abaae0c390f36fccf90`。

1. 解释按原评分口径160–240去空白Unicode字符，公式、标点、公开引用显示文字计入；变式/答案另计。分别核对三力、静止释放、必要适用条件与来源忠实，不通过删引用凑字数。
2. 明确final事件到达时终态前收起；手动重开时仍running，之后有同run公开正文增量，完成后仍展开。错过或无增量则本门禁未通过，不能用旧5项掩盖。
3. 同一会话冷启恢复正文/用时及初始折叠；无新增模型重放，工具内容可查且无每工具用时/原生黑三角。
4. 实际1366×768、1920×1080截图及console、源码/构建指纹，旧结果不覆盖。截图采集时机与人工展开状态明示。
5. 一轮结果交Astra独立评分。若模型不合规或执行失败，原样保留后定位，不反复采样挑绿；受控SSE/单元只证明所列工程状态，不代替此真实结果。

用户教师接受、独立留出、完整ChatGPT parity和U4-V3生产增量仍单列；参考窗口当前被Python网络授权/Docker弹窗遮挡，未替用户允许网络、重置Docker或向其他聊天发送消息。

## 实施与独立检查结果

- `aa95d0e`：新增main-only `response-scope.ts`，经 `pi-session.ts` 仅拼接当前请求的保守提示。没有推断数值上限，不改变稳定system或预算，教师原文CRLF/空白与末尾位置保持。原物理、授权及legacy开关不变。
- QA独立 `chat-live-manual-reopen.mjs` 负责真实Enter与同session/run序列屏障，runner先重开再采集稳定截图。没有改变生产折叠逻辑；两个重复的源码形状测试已删除，以实际Pi传输与真实流证明行为。
- `7f8220d2b2d3896e25fd14d87f23aec134724e69` 正常合入知识库主线 `8c6b705`，无冲突。合入9个KB生产文件及其文档/测试，不删除或改写协作实现。
- Astra对生产/QA只读审查未发现需修复的P1/P2。97项Composer/vendor文件在Git blob和working tree换行归一化后均不变；D盘3份未提交文档的原始size/SHA256保持。

| 命令（cwd为apps/desktop） | 实际结果 | 范围 |
| --- | --- | --- |
| `npm.cmd run build` | exit0，含TSC | 455文件，构建 `31ebaae252a38f209d0ecf0dad9edb5a249bc6a133f5d9176d56392143414ffe`，非零警告声明 |
| `npm.cmd run test:renderer-components` | 240/240，exit0 | 当前整合源码；不替代实际Electron |
| `node --experimental-transform-types scripts/education/kb-ai-page-boundaries.mjs` | 57项，exit0 | durable executor/SQLite及受控image/model；非自然视觉/数学质量 |
| `node --test scripts/acceptance/response-scope-test.mjs scripts/acceptance/physics-answer-quality-test.mjs scripts/acceptance/public-response-prompt-test.mjs scripts/acceptance/chat-live-manual-reopen-test.mjs` | 各4/8/5/7，整轮exit0 | 范围识别、实际Pi受控HTTP传输/稳定system/原文字节、公开协议、同run final增量及错误状态；0付费调用 |
| `node --test scripts/acceptance/chat-paired-scripts-test.mjs` | 14项脚本断言，exit0 | 同prompt/PDF参数、公开观察器及安全元数据；0付费调用 |
| `npm.cmd audit --json` | exit1，45=8高+29中+8低，0 critical | 未升级依赖或把已知审计失败改为通过 |
| `UI_CHAT_REQUIRE_MANUAL_REOPEN=1 node scripts/ui-goal-chat-live.mjs --scenario=misconception` | 唯一预声明M4运行，5/5、exit0 | 真实provider，经原附件UI/正式Pi/独立profile；不是只有1次provider请求，实际两次工具对应3组accepted请求状态 |

完整本地日志为 `apps/desktop/test-results/ui-goal-20261101/` 内 `build-continuation-02.log`、`renderer-continuation-02.log`、`kb-continuation-02.log`、`continuation-02-unit.log`、`audit-continuation-02.json`、`chat-continuation-02-mis.log`。构建逐文件指纹为 `build-continuation-02.json`，保护检查为 `protected-continuation-02.json`。

## M4真实结果与未通过项

`continuation-02-mis/run-J9YdNN`，session `aisession_e1b91587-921a-4fdb-b724-09a318131146`，run `run_cff4dc6b-b474-410e-94c5-4896b6013bf1`。prompt/PDF hash与运行前冻结值逐一匹配，`promptOverride:false`、`humanAccepted:false`。

- 显式交接seq120，collapsed=true、beforeTerminal=true，焦点从工具summary回到process-trigger。两段公开commentary和两个真实附件工具可查；不补造私有思考。
- 真实Enter重开前后running=true；屏障336之后seq337–595为259条同session/run、final_answer、正字符数且终态前的公开增量。完成后expanded=true，required=true、status=passed、missing为空。
- 冷启正文、时间和阶段保持，过程默认收起，模型无重放；consoleErrors为空、测试构建指纹不变。完成态双尺寸截图不冒称运行相。
- Astra独立评分 **90/100**，原解释口径 **243字符**，仍超240上限3字符，保持失败；变式“同一物体”与原场景衔接及静止条件仍有轻微歧义。来源合成边界明确，无公开DSML残片。不是教师盲评或总体质量优胜结论。
- M3的307字符、false/0手动重开缺证及81.25分原样保留；M4补足该工程证据，不回写旧结果。U6的55/70、其他NE和U4-V3生产增量不因本例关闭。

## 完成态可视补验（无新模型调用）

原M4截图在正文底部，不能仅凭文件名证明上方过程标题可见。新增只读脚本 `scripts/ui-goal-chat-completed-readback.mjs`，在owned test-results内逐字节复制原M4 data/profile，使用同一31eb正式out；不改原夹具、native历史或授权回执。

实际命令（cwd为apps/desktop）：`node scripts/ui-goal-chat-completed-readback.mjs --from=test-results/ui-goal-20261101/continuation-02-mis/run-J9YdNN`。最终 `chat-completed-readback/run-5hAo5N` 7项通过、exit0；先设置视口，真实向上滚轮取消底部跟随，再以真实Enter展开/收起。各图均断言过程标题与第一正文元素同时在视口中。早期截图采集失败报告保留，不重跑模型挑选答案。

| 视口 | 收起 | 手动展开 |
| --- | --- | --- |
| 1366×768 | [标题＋正文](evidence/continuation-02/completed-collapsed-1366.png) | [公开说明＋两工具＋正文](evidence/continuation-02/completed-open-1366.png) |
| 1920×1080 | [标题＋正文](evidence/continuation-02/completed-collapsed-1920.png) | [公开说明＋两工具＋正文](evidence/continuation-02/completed-open-1920.png) |

正文/run与17771ms不变，工具内容可达且无每工具计时、无原生details/summary及私有推理UI；0新增run/模型请求/事件，console errors为空。原夹具前后hash `05f8408c86db8c28ce7e8aef841d4066cca7cb2c4ae2371fa630b1dc5617651c`、build及native历史hash均一致。[截图指纹与断言清单](evidence/continuation-02/manifest.json)。网络拦截只观察firstWindow之后，启动前截面不冒称全程拦截；持久账本独立证明没有新增运行或模型请求。此补验只证明完成态读回，不重复计算原M4流式证据。

## 最新主线整合复验

`a17e8785aafbe02eca76312aafec74eb0202518c` 正常合入协作者主线505cb7a（含d76e6e5/4f6ce66窗口几何修复），无冲突。新增生产差异只有 `desktop-chrome/window-geometry.ts` 与main入口，原31eb对应的Pi/helper及renderer源码不变；合作者的完整证据和原失败保留。

- `npm.cmd run build`（apps/desktop）：exit0，含TSC；新out 455文件，SHA256 `95263dc1288eb0129cee1bcdbd9c3f6a3b8805809892bcf13894c5412b2070ac`，逐文件清单为 `build-continuation-02-integrated.json`。原M4及完成态补图仍限定31eb构建，不改写为在9526运行。
- `node scripts/xiaozhi-agent/window-geometry-state-smoke.mjs`：10/10、exit0。仅证明v1尺寸schema/显示算术，不把它冒称原生拖动验收；协作者AT03原生拖动余项仍保留。
- 没有因几何整合重复付费生成M4。原240组件、KB57及scope/传输测试保留各自7f8220d范围；不累加为新的整包功能验收。依赖与lock未变，审计45项仍未关闭。

main推送和D盘新版启动证据在完成后补录；不据已启动首轮或协作者d76窗口冒称本片新代码已运行。
