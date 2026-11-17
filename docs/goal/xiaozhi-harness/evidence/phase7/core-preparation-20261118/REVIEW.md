# Phase7 core readonly seam review

DRAFT_REVIEWED_CANDIDATE。2026-11-18。仅只读源码核对和本TEMP反馈写入，生产、scripts、out、依赖均零写入，测试/构建/runtime/模型均NOT_RUN。正式编码基线须重新绑定Gate6模块Git后的实际HEAD。根图search_graph返回not indexed，沿已知源码锚点读取，未重建图谱。

一个 getXiaozhiWorkbenchSummary(query) 足够覆盖三个缺口。推荐统一返回 {ok:true,value:{kind,...}} 或 {ok:false,error:'invalid_input'|'permission_denied'|'changed'|'unavailable'}，value.kind与query.kind严格判别。共享validator限定known keys、字符串界限、50条page上限和cursor绑定query kind/filter/session/search。错误不携带raw payload。summary不承接权限执行。

## 纯读与一致性

原Sql.transaction由serialized-state-sql进入writer queue，并在db.ts:1201使用BEGIN IMMEDIATE。PermissionStore.view也调用该transaction。两者不用于summary。

db.ts:1120 paperTransaction(readOnly)已提供query_only+BEGIN的成熟方向。建议core新增窄withXiaozhiReadSnapshot(action)连接接缝，沿原dbPath与SQLite库直接打开READONLY handle，在同一BEGIN读快照完成page/counts/详情关联，finally直接await该handle.close。不要new OmniEduStore后调用work.close，因为db.ts:1388会关闭materialQueue，后者close→recoverUntracked(true)会走业务恢复。该接缝只提供真实SQLite适配，写语句由READONLY/query_only真实拒绝，不造no-op Sql，也不调用init、migrate、recover。Sql类型有无新增read方法可在正式实施时选最小方案，现不要求全局重构。

既有Task getter、Registry snapshot、Permission profile/grants/approvals和MCP catalog本身均以SELECT解码为主。全局reader不调用coordinator.snapshot/getXiaozhiTask，因为snapshot先recover。Registry.snapshot校验整个blob和hash，是一个不可拆的完整性单元。它失败时记录registry来源unavailable，不能从同一坏blob挑几项当有效Provider。

Task存于app_settings的xiaozhi.task.v1:xitask_*，latest索引是xiaozhi.task.v1:session:<sessionId>。复用task-state现read/decode与原teacher check audit，不复制TaskDocument validator。原inspection额外读sources/checkpoint，summary无需完整inspection。可在原Task state增加只读分页/summary getter，读取单Task需要的原audit，不批量构建会话projection或读取JSONL。status计数是原保存state，resumeCandidate仍只是打开核对候选。

PermissionStore.parseApproval和persistent-state.parse目前私有，适合在原领域内增加readonly row/detail decoder或分页getter，分别复用validApproval与原legacy parser。单行损坏可隔离，不能调用整session approvals().map导致一条坏数据吞掉其它正常行。AcquisitionState.get/list会migrate，需原state模块增加无migrate的inspection/page，并复用现read hash/id/revision校验。不要直接调用acquisitionView/ensureReviewed/search。MCP runtime.catalog→state→validateState/publicServer是纯SELECT且不解密凭据，可复用当前已初始化服务的catalog或抽轻量readonly decoder。不要调用tools/inspect/probe。ExtensionState.read/list是纯读，package-manager.read是hash/manifest/provenance验证路径，选取metadata，不调用binding/readyRoot/prepare。

## DTO需要的窄修订

审批详情必须按approval kind判别。Permission v2带revision number，legacy copy当前没有revision。推荐detail ref为 {kind:'permission_v2',sessionId,id,revision} 或 {kind:'legacy_copy',sessionId,id,version:string}。legacy version由原row身份、updated_at与payload摘要派生，只是只读旧返回识别，原决定动作仍用原API。legacy的classification/expiresAt/taskId缺失显示unknown/null，不能补默认public或永久有效。原publicPermissionApproval可供现代单项安全投影，summary只取purpose/resources/classification等必要字段，密钥、secret值和完整工具输入不进入返回。

Page的matched/total/counts只在原解码与同一筛选宇宙完整核对后才可标精确。若损坏行无法判定state/filter或某个聚合来源损坏，matched/total应允许null，counts加exact或countBasis，显示已核对数/至少数和partial。unavailableCount区分可计数坏row与无法计数的聚合来源，后者由sourceFailures明确。不能把UNKNOWN当0。大集合可按有界batch读取元数据并让出事件循环；如扫描未完成则返回诚实partial，不为简单展示新增索引真源。分页为当前事实的keyset，单响应同快照，跨页不承诺历史快照永不变；UI按身份去重并在操作后重读。

Capability无Task或只有idle/旧Task时，context显式none/current/stale，当前Task不等于活动Run。authorization默认task_check_required，页面显示需任务核对。Registry/source/health/expiry是已保存元数据事实，不能推成当前调用已获准。Engine.evaluate虽然不直接写，但verifyRequest会读取并同步hash真实文件、verifyProvider可能进入其它领域，泛能力中心没有具体operation/resource和完整request时不调用它。结构conformance可用现assessConformance，并展示required/triggered conditional缺口为blocked、optional缺口为partial。记录已verified与本次已授权是两个字段。candidate仍候选，Registry收录不变成安全通过。

## 正常动作与旧数据兼容

总览先原sessionNavigation.select(sessionId)，再原getXiaozhiTask重读精确Task/requirements/revision。main canResume仅服务原previewResume允许的剩余机器步骤，见task-state.ts:137要求latest并taskHasRemainingSteps。缺剩余步骤不能显示无效resume按钮。

旧no_criteria普通Task有现成“同任务继续核对”路径。原startXiaozhi输入继续使用 {sessionId,commandId,prompt,continueTask:{taskId,requirementsVersion}}。coordinator.ts:65起明确允许非Goal的latest paused/interrupted/review_required，随后同Task新Run/new generation，旧效果不自动重放。前端选择并重读后显示原因“需要重新核对现有成果并生成新候选”，显式点击才启动，双击复用commandId。此动作会进入原模型Loop，不能宣传零模型；纯已持久ACK的Teacher确认仍是Phase6已验证的本地路径。active/completed/ended/非latest Task只打开历史，不伪造可继续动作。Goal沿原Goal控制入口。

Inbox选择一项才读详情；现代decideXiaozhiPermission保留revision和scope，legacy沿原decideXiaozhi/resumeXiaozhiLegacyApproval路径。summary.canDecide最多表示保存状态的待核对候选，最终source/Grant/过期/拒绝检查由原决定API执行。索引和详情读取不触发invalidate。拒绝后保留原因与原任务选择，不自动再申请。

## 正式释放时的core文件边界

新增 src/shared/xiaozhi-workbench.ts、src/main/xiaozhi-agent/workbench-summary.ts 和可选同域workbench-api.ts。薄接 src/main/xiaozhi-agent/ipc.ts、src/preload/index.ts，OmniEduApi现为typeof api，无需造第二接口。若直接在原IPC注册readonly reader，可不改production-host；若Host暴露薄方法则仅注入reader。

必要原领域纯读接缝只限 tasks/task-state.ts、permissions/store.ts、persistent-state.ts、capabilities/acquisition/state.ts；MCP/Extension仅实际需要导出既有parser时做窄变动。db.ts仅新增上文只读连接生命周期，session-state.ts/serialized-state-sql.ts只有最终选择把read capability放Sql时才需薄接，不预设为必改。没有新表、Planner、Task、写队列或权限模型。原共享Task/Permission/Acquisition的执行协议保持由各领域维护。

本反馈不扩大草案三页面范围。Skills与Terminals沿最终Gate6已有页面复验，正式Phase7源与测试等root释放。
