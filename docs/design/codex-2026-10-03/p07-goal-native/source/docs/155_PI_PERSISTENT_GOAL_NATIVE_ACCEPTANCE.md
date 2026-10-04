# P07-E原生持续执行前置验收

日期2026-10-04；合同154。前置原源/A/B证据通过，生产E未实现、整体active/NOT_ACCEPTED。没有新增goal表/IPC/页面或接管日常正在运行会话，不把此报告当持久目标完工。

## 1. 本轮决定与原源

本轮GitHub最新release确认为Pi v1.0.2、Hana v0.450.0；四个已安装Pi精确1.0.2。Hana issue1280仍Open，只是goal提案；原TaskRegistry/DeferredResult不是自动goal完成器。图谱Edu6130/12216 ready，followUp符号实际snippet错位，Hana图谱只到File；因此按明确路径补当前原源，而非靠索引推断功能。

选择原Pi AgentSession extensionFactories / turn_end BoundaryResult entries+continue，原agent-loop finishTurn继续机制，不UI定时器、不agent_end重入prompt、不第二loop。低层Agent可context-only继续，但coding AgentSession必须有runnable context；正式候选用原custom_message draft提交经过main验证的当前目标与下一步，同时另存版本checkpoint。native仍只有一次教师user；provider user从1变2是原custom_message转换，不称provider全程只有一次user，也不是教师新批准。源数据/网页不能生成宿主目标上下文；学生及权限规则保持。

Hana完整原TaskRegistry及atomicWriteSync AST体确实可注册、clone、父会话取消、cold readback；但paused/blocked冷启动转recovering，register可复活终态，JSON持久写失败只warn。实际一次正向update还留下旧tasks.json和新.tmp（根因未明），不宜当正式goal真源。后续SQLite/CAS沿已有persistent-state，Hana仅可选runtime生命周期与去重候选；不整体引入其cron/自动恢复投递。写失败必须可见/停止，不宣称rename稳定性解决。

原源锁scripts/xiaozhi-agent/goal-native-source.lock.json，7原文件246557bytes；Pi MIT/Hana Apache-2.0许可证保留。原TaskRegistry主体不改，只测试logger导出warning及safe-fs import指向原AST atomic体；无新依赖/安装体积/Windows打包改变。精确SHA见锁和报告，原atomic体SHA f69a5e2e54eda8c829d48c29efb2b168322c4969ac5a431a1a4ddfdeec9fbb39。

## 2. 准确执行证据

cwd D:\WorkProject\EduProject\apps\desktop：

```
node --check scripts/xiaozhi-agent/pi-goal-native-preflight.mjs
node scripts/xiaozhi-agent/pi-goal-native-preflight.mjs
```

最终E6W1SV 19/19、exit0，report含script/sourceLock SHA与7固定原源SHA、实际模型/请求状态、之前四失败。S52ZxV前一19也保留；不是3次稳定连续通过。A确定性transport是明确夹具，只原SDK调度证明，B真正官方DeepSeek且只自造公开文本，不真实教师数据。

| 范围 | 已证结果 |
| --- | --- |
| source 1 | 已安装四包1.0.2，固定tag7源/许可SHA严格匹配 |
| Hana正向4 | task/progress/run/parent持久readback；clone隔离；按父会话取消不影响别的会话；completed/result冷恢复 |
| Hana限制3 | paused→recovering；终态重register复活；实际无法写文件时仍返回内存task，不能作为goal事实成功 |
| A原SDK6 | 无伪user仅2请求；工具+continue共2不额外第三次且只执行1；followUp共2不叠继续；end不消费待steer；error会调用finishTurn但忽略continue；abort signal无新增admitted transport |
| B原SDK/官方5 | 公共说明→宿主custom goal context→实际本地只读工具→严格unique code/lessons结果；恰3请求全200；native教师user仅1；工具read仅1且文件SHA不变；三assistant原entry/一toolResult/checkpoint实际关联；原native重开checkpoint保持且请求仍3 |

最终model deepseek-flash，边界entry bdf67b5f/1d90fb73/c77dc16b，实际toolResult d29c999c，与E6W1SV自身native关联。工具码由运行时生成，仅实际工具读取后返回；请求不包含预先泄露答案。报告不存key/完整headers/payload；原native和合成文件仅owned test-results不归档。

## 3. 失败与真实边界

- nvzxr4 9项后错猜setTools API，改源码现有state.tools赋值；未改SDK。
- cdKJ1T 12项后错误断言error不进finishTurn；当前原源明确error仍调用边界后hard return，改断言为会调用但零继续请求。不用返回continue恢复error。
- T9cXrl 14项后真实API只一请求，正文仍开始说明、JSON严格失败。checkpoint已写，canContinue=false；原AgentSession拒绝无runnable context继续。补原custom_message宿主状态，不关闭SDK检查/伪造teacher prompt，最终3真实请求完成。
- uTEkO4 1项后原Hana update readback失败：tasks.json保留初值、tasks.json.tmp含更新，logger当时静默所以具体异常未知。新test logger捕获warnings；E6W1SV通过不抹去首失败或归因杀毒。无法写入fixture在最终报告捕获EEXIST（mkdir目标是文件），只证明其fail-open行为，不证明uTEkO4同根因。
- 探索曾猜错本地safe-fs/脚本路径；改明确固定官方tag源获取。一次apply_patch上下文不匹配未改目标，修正确上下文后再核。

无生产源码改动，故本轮不重跑79/207/build，不沿用153旧门禁当新E交付证明。脚本语法与根git diff --check收尾实际执行；用户33640/Omni-Edu Agent/27464762/RespondingTrue保留，标准out/profile/凭证不维护。人工、日常失败、完整Codex视觉、Skills设置未知参照、无VPN/安装仍未验。没有新Pro/Finesse UI调用或同源码声明。

## 4. 下一唯一动作与完整剩余范围

四根→67§1/2/5/8/9→35→109-E→154/155。冻结生产E纵向合同：沿persistent-state独立goal SQLite/CAS事实与目标/criteria/evidence/run，严格shared/typed preload；在现有nativeResources扩展并列原turn_end，只有当前active/同权限与有效主进程事实可返回custom goal context+continue。current host dispose生命周期必须按goal整段交付调整，不能循环调用renderer发送制造自动继续。

用户明确设立/暂停/恢复/结束，冷启动active→interrupted、paused保持paused，老师wait/审批不继承，目录/模型/Skills/权限/附件版本/摘要原epoch每请求重核。无累计预算；无进展识别依据真实同失败/无新工具结果，非计时器。完成候选绑定criteria及主进程实际文件/来源/回执readback，文字成果需审阅，模型不能自报complete。原Pro/现有OSS goal控件查原源/MCP再复用，真实UI→SQLite/文件/停止等待失败/旧新DB/冷恢复/1366/1920及必要build/79/207后才称生产E完成。

然后全D1–D7、未知Skills/设置参照、P08真实无VPN/安装/备份恢复与最终八组、日常用户同输入配置复测和人工确认；不缩目标。三元暂停、无子agent/commit/push。source-only档案p07-goal-native保留源码/锁/许可/安全报告，不原native/DB/key/profile或fixture文件。

## 5. 来源

[Pi1.0.2原生边界类型](https://github.com/earendil-works/pi/blob/v1.0.2/packages/agent/src/types.ts)、[原AgentSession](https://github.com/earendil-works/pi/blob/v1.0.2/packages/coding-agent/src/core/agent-session.ts)、[Hana原TaskRegistry](https://github.com/liliMozi/openhanako/blob/v0.450.0/lib/task-registry.ts)、[尚未实现的goal提案](https://github.com/liliMozi/openhanako/issues/1280)。
