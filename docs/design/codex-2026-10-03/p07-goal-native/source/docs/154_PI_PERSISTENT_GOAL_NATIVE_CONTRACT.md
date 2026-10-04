# P07-E 原生持续目标：源码与执行合同

日期2026-10-04；M01/M10，衔接109-E、152/153。完整目标active；本合同不是生产goal完成证据。

## 1. 教师结果与当前缺口

教师明确设立目标后，小智在当前会话持续公开说明、调用已授权工具、审查真实结果，直至完成条件有可审阅证据；暂停/停止立即优先，冷重启保存进度但不自动重放写入/旧批准。当前update_plan只绑定run，production-host每次prompt后dispose，未有跨run目标事实；旧model/Skills/权限/native身份不可破坏。

本轮先验证官方原生通道与Hana生命周期，再冻结生产增量：A层真实SDK+确定性传输夹具，B层原AgentSession+官方DeepSeek/本地合成只读证据。它们不代替后续typed主进程→页面→SQLite/文件→冷恢复的C/D/E验收，不新增假goal UI。

## 2. 当前来源与选择

本轮GitHub releases/latest实查：Pi v1.0.2/MIT、Hana v0.450.0/Apache-2.0，与已安装Pi一致。Hana issue1280仍Open提案，不称现成goal SDK。固定tag原源和许可证下载到owned test-results，记录SHA；本地Hana部分文件不完整，不用其猜测路径当官方实现。

Pi1.0.2原AgentSession扩展turn_end接受BoundaryResult {entries,continue}，在SDK写入assistant/tool原entry后提交draft，并经finishTurn原循环执行继续；原agent_before_settle/agent_settled用于最终审计/闲置。continue只确保一个请求，自然工具/steer/followUp可满足，不叠第二轮。不套renderer定时器、不伪造教师continue、不自行重写agent loop。原session_before_compact已通过同extensionFactories复用，可并列扩展；主进程不在agent_end回调重入prompt。

执行修正：低层Agent可context-only继续，但coding AgentSession要求可运行上下文；仅custom元数据checkpoint+continue:true会被拒绝。正式候选需原custom_message draft提供当前已核宿主目标/下一步（非教师新指令/授权），原convertToLlm将其映射provider user是SDK转换，不等于native教师消息。原JSONL只保留一次原teacher user；同目标上下文来自本地事实，不能把文件/网页当宿主上下文。错误响应仍调用finishTurn但忽略继续决定，宿主必须看outcome。

Hana TaskRegistry可复用任务注册、父会话关系、进度、取消和runtime handlers；其JSON _persist捕获错误只warn，_loadPersisted把paused/blocked也recovering、register可将终态复活，因此不能作为本项目SQLite正式goal真源或自动恢复授权。原atomicWriteSync函数及TaskRegistry主体只测试日志依赖替换，按明确源码SHA核验；不启用cron/schedule/远端插件/子agent。DeferredResultCoordinator去重/当前会话判定可作后续结果投递候选，不直接复用其定时重试和session_start steer恢复。

## 3. 本轮范围、文件与完成定义

新增本合同、scripts/xiaozhi-agent/pi-goal-native-preflight.mjs与验收155；只owned test-results下载原TaskRegistry、safe-fs、许可、Pi原types/agent-loop/agent-session及合成只读证据。现有esbuild/TypeScript/Pi即可，无新依赖/表/IPC/生产页面/凭证修改。复用原atomicWriteSync AST函数体，logger仅测试替身；报告严格分清A原SDK调度夹具/B真实API/Hana任务边界/生产未接。

A检查continue无伪user、原工具调用无额外继续、队列优先/end跳过队列、错误/停止不继续，以及请求前刷新不失效；B从真实prompt→原turn_end持久draft→context-only继续→实际只读合成证据工具→严格结果与原JSONL，记录实际请求/状态/模型/usage而不存密钥/完整payload。Hana检查持久readback/clone/父会话取消/终态/暂停冷恢复行为，实际写失败被吞必须作为拒绝直接真源的证据记录。单项失败保留报告，不调整断言掩盖SDK行为。

本轮没有生产源码变更，不重跑无关79/207；脚本语法和根diff门禁必跑。用户33640/out/profile保持。最终写四根+26/28/35/67，下一唯一生产E合同与真实贯通。

## 4. 下一生产增量（预定，待本轮证据后冻结）

shared goal版本类型→独立goal-state SQLite增量表（goal、criteria/evidence、run绑定、CAS状态，受现有db初始化管理）→主进程goal coordinator→typed preload→原Pro/已有HeroUI目标卡控件。状态active/waiting_teacher/paused/interrupted/review_required/completed；用户设目标/暂停/恢复/结束明确动作。学生及云脱敏/来源版本检查沿现有规则，goal元数据本地，云端只必要脱敏当前目标事实。

恢复构建新run与同native，不重新提交历史附件/审批或复活停止目标；重启active转interrupted并显示恢复入口，paused保持paused；反复无进展由真实相同失败/同输出及无工具事实识别需要教师补充，不设累计tokens/工具数/时间预算，不以模糊计时器暂停。完成候选必须绑定该goal当前criteria、主进程可读实际文件/来源/回执版本和readback，文字型结果留教师审阅；模型只能提议，不能自行把目标设complete。

原Pi boundary追加独立版本goal-checkpoint custom entry（local metadata，不改变旧creation/model/Skills/OCR/public-image身份）；当前正式goal状态每次请求从SQLite重建，摘要不授予权限。目录/模型/Skills/权限变更必须重核，切模型/停止/关闭绝不能形成第二loop。新旧DB副本/全新幂等、取消/错误/等待/重复/停止竞态/冷恢复及1366/1920真正C实例后才算E完成。真正迁移/回滚/控件和完成条件列在下一合同，不靠此规划勾完成。

## 5. 原来源

- https://github.com/earendil-works/pi/releases/tag/v1.0.2
- https://github.com/earendil-works/pi/blob/v1.0.2/packages/agent/src/agent-loop.ts
- https://github.com/earendil-works/pi/blob/v1.0.2/packages/coding-agent/src/core/agent-session.ts
- https://github.com/liliMozi/openhanako/blob/v0.450.0/lib/task-registry.ts
- https://github.com/liliMozi/openhanako/issues/1280
