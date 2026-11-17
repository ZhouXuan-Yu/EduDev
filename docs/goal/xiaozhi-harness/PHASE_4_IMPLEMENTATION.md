# Phase4 Skill System 实施合同

## 阶段与教师结果

本合同覆盖 EXECUTION_BOOK T4.1–T4.4、11_SKILL_SYSTEM、S-01–S-09 及 A-P0-04。教师可让小智把已验证、可复用的纯说明流程自动保存为个人 Skill，在原技能设置查看归属、验证状态、不可变版本、来源和回滚。个人默认私有。分享形成独立团队副本，团队管理员批准后发布。官方条目经过独立官方审核协议才发布。声明依赖和权限不会产生 Grant。

当前仅准备合同与定向只读定位。Phase3 最终 source/out 保持冻结，待独立 Gate3、总控整合与明确 RELEASE 后实施 Phase4 生产/测试/构建。付费调用累计 0/200，本阶段测试继续 synthetic-only。

## 复用基线与真实缺口

只读定位由 PHASE_4_READONLY_BASELINE.md 提供，下面锚点已定向核对当前源码。

- managed-skills.ts 的 createManagedEducationSkills 已提供严格路径/链接/文件数量/大小、wx 不可变版本目录、逐文件 SHA256、读取前后校验、原 Pi loadSkillsFromDir 和 revision/CAS。teacher import 默认 disabled，edit 写 integer version+1 并替换当前 catalog 项，新项 disabled。没有可用历史列表/回滚/三层归属流程。
- skill-catalog-state.ts 保存单个 xiaozhi_pi_skill_catalog schema1/revision/payload_json。origin 只有 builtin/teacher，version 为 integer。正文与资源在原 managed skill 目录，catalog 只保存元数据和 file hashes。
- managed-skill-runtime.ts 提供文本资源脱敏、原 Pi/Hana session snapshot、read 工具只读映射和访问前后检查。native-skill-epoch.ts 保存 xiaozhi.education.skills.v2 的 authority/hash identity，复用原 authority/taint/Run fencing。
- skill-management-api.ts 与原 typed preload 目前只有 catalog/preview/import/enable/edit/archive。production-host 的现有管理锁、受保护导入 chooser、managedResources 注入、pi-session 的原 Skill Runtime/Epoch 是唯一接线。
- 当前缺少 AI creator 的 Draft→验证→自动 Personal Publish、可追溯 immutable SemVer 记录/active pointer、Team membership/admin gate/独立副本和 Official review 元数据协议。Capability Registry 不保存 Skill 正文。

## T4.1 个人 Creator 与验证

共享契约先定义 schemaVersion、skillId、owner/visibility、draftId、immutable version/hash、provenance、Capability 依赖、权限需求说明和逐阶段验证结果。新增主进程 skills 领域的治理、版本、验证和 creator 文件，复用 managed-skills 的包解析、路径/size/hash/版本写入与原 runtime。

生产 creator 通过原 Pi Tool Definition 和 Execution Boundary/Task/Journal 入口运行，调用 main 服务。Skill 内容是 bounded 不可信文本，严格冻结输入，禁止接受 authorized、approved、actorRole 等自称 authority。个人纯说明型通过结构、内容、隐私、依赖、权限检查和自动确定性测试后发布，无额外教师逐步批准。非复用的单次结果不自动创建 Skill。

发布验证包括以下实际阻断。

- 结构与 package 文件边界复用原 parser/schema/路径检查，隐藏链接、脚本/可执行内容和禁止资源走 typed 拒绝或 Extension 接口，不在只读 Skill Runtime 执行。
- 主进程既有脱敏/来源分类管线处理教师私有正文、学生标识和秘密，发布产物、版本元数据、日志和 tool result 均不得携带敏感原文或凭据。验证结果仅保存必要摘要、版本/hash 和原因。输入声称 public 不能覆盖 main 分类。
- 依赖使用稳定 Capability ID、Contract 和 Required/Optional/Conditional 要求。复用 Registry/Resolver 的验证结果，缺必要依赖明确 blocked、保留 Draft 并指出可行后续。已发布版本遇撤销/依赖变化保持历史并阻断受影响的新使用。
- 权限需求只形成说明和验证证据，不写入 ScopeGrant，不把 Skill 文字注入为系统授权。实际 Tool/Provider 仍每次消费 Phase3 main Grant、原 Task/Run admission 和 IO 检查。
- 自动测试实际调用原 Skill parser、受控文本 Runtime 资源映射与确定性验证，保留测试版本/输入摘要/结果。任何测试失败不会激活未通过版本。

## T4.2 不可变版本与运行快照

扩展原 Skill state 的附属治理/版本记录，原 catalog 继续承担 active Skill 投影。正文与资源继续存放原 versions 目录，仅记录引用、SemVer、内容 manifest hash、来源父版本、验证和状态。相同 skillId+SemVer 的不同内容拒绝，已发布内容不覆盖。后续 edit 创建新 Draft/version，activate/rollback/withdraw 使用原 serialized transaction/revision CAS 更新 active 引用。

运行中的 Task/Run 固定精确 skillId/version/hash/资源身份。复用原 native Skill Epoch 和 Task/Run 来源，持久快照引用进入 SQLite 原 Task 真源接缝，Pi JSONL 继续保存原 session history/epoch。普通升级不换正在使用的旧 bytes，无关 Skill 更新不扰动当前 Run。旧 bytes 不可用时类型化拒绝，不静默加载新版。撤回/权限/依赖撤销优先于 Snapshot，每次读取/执行重新验证，历史版本和来源证据保留。

回滚只改变 active pointer，重新检查目标版本当前有效性、hash、依赖和权限需求。已撤回或不合格版本不得靠回滚复活。发布文件与 SQL CAS 任一步失败时旧 active 保持，未引用完整目录保持 inert，可诊断清理，不扫描用户任意目录。主进程崩溃重启不自动重放创建/发布副作用。

## T4.3 Team 本地治理

每位教师最多一个 Team，membership 由 main 当前可信主体和持久关系决定，mutation 不能自行指定管理员角色。团队管理员、维护者和普通成员的读取/修改/审核能力分开。创建/加入/离开/分享/审核沿本地协议与 typed UI，保存来源和审核者事实，普通成员不能发布待批版本。

Personal 分享捕获精确不可变版本与内容 hash，创建独立 Team skillId/文件副本/来源链，原个人编辑、撤回或团队编辑不互相修改。分享前再次执行隐私和包验证。pending/rejected 只向申请者与相关管理员投影，普通团队成员的可用列表/Runtime 不出现未批准内容。批准绑定同一副本/version/hash/验证结果及 expected revision，内容变化使旧批准失效。离开团队或撤销成员关系后新访问/激活受阻，已有历史来源事实保留。

## T4.4 Official 本地审核协议

官方条目需来源、许可证、安全、兼容性、跨场景测试与审核记录。建立本地 versioned review/publish/withdraw 接口和校验，不建设云端平台。Personal/Team mutation 无法设置 Official source 或伪造官方身份。main 可信审核主体与固定流程分离于包中声明，审核引用精确 version/hash，未通过条目不进入 Official 可用列表和 Runtime。撤回实时阻断新使用，保留版本和来源。

## 共享类型、SQLite、IPC 与页面切片

| 接缝 | 实施范围 |
| --- | --- |
| shared/xiaozhi-skills.ts | 增量扩展个人/团队/官方、Draft/验证/版本/active/provenance/审核和 typed errors，旧调用者兼容 |
| 原 skill-catalog-state 与新增 skills 领域 state | 复用原 Sql/事务/CAS，增量附属治理/版本/团队/审核和 Task 快照引用，正文保持原文件目录 |
| managed-skills / managed-skill-runtime / native-skill-epoch | 复用 immutable 包解析和 runtime，接 active projection、精确版本快照、撤销/依赖检查，避免第二 Skill Runtime |
| production-host / pi-session / 原 Tool 装配 | 薄接线 main actor、权限服务、Registry 依赖、creator 和原 Task/Journal，不堆大主文件 |
| skill-management-api / typed preload | 扩展 Draft/验证/版本/回滚/分享/审核查询和 mutation，mainFrame/strict schema/CAS，不暴露任意 filesystem 路径或 authority JSON |
| 原技能设置与当前 Skill 列表 | 在现有入口展示三层归属、版本/验证/来源、回滚和对应角色审批。Composer、工具栏与弹层保持 |

UI 继续应用 edudev-design 及已确认决策，复用现有技能设置布局和实际业务控件，仅补完成动作所需信息/状态。个人、Team、Official 和 version/status 清晰，来源详情渐进显示。loading、empty、success、cancel、invalidated、error、retry 都由真实 typed 结果驱动，稳定 testid 用于用户路径测试。完整页面视觉/原生 chooser/所有尺寸完整检查沿 Phase7 Terra。

## 旧数据与恢复

先用真实旧 schema1 catalog/versions 与 Pi Skill v1/v2 history 的副本核对，再增量幂等迁移。原 builtin 与 teacher 的名称、integer version、enabled/archived、每文件 hash 与目录引用保持。已有 builtin 只继承可核验应用来源，教师包回填 Personal 私有，integer→SemVer 保存原版本映射，不凭旧 origin 推导 Team/Official/Grant。未知 schema/损坏 hash 失败关闭，保留原事实。

迁移只读取当前已知目录和记录，不能根据磁盘残留目录猜发布历史。旧历史目录若有可验证旧记录/来源可显式链接，无法证明部分作为未引用 inert 资源。启动恢复只恢复状态和诊断，不发布/分享/执行 Teacher 任务。SQL 回滚或 CAS 失败旧 active/审批保持。

回滚前关闭应用并备份 SQLite、原 managed-skill 目录及版本证据，恢复已接受 Phase3 的接线/构建后重建。新增附属表和不可变版本保留，禁止 DROP 或覆盖教师包。若仅新版本验证失败，原 active pointer 保持，可用原 typed 管理入口关闭损坏条目。Runtime 不采用普通文件读取或外部脚本回退。

## Gate4 可验证完成条件

1. S-01/S-02 使用真实 host/Pi 本地 SSE 自动 creator，Draft→验证→Personal Publish，原 SQLite/文件/typed UI 与冷启一致，其他主体不可见。验证失败仅保留 Draft，无重复创建或错误激活。
2. S-03/S-04 实际独立 Team 副本、单 Team 约束、普通成员拒绝/管理员批准、版本变化 stale、角色撤销和重启读回。原个人文件变化不改团队副本。
3. S-05 Official 本地审核通过/拒绝/撤回，伪 official/role/hash 不可发布或加载，保存本地协议边界。
4. S-06/S-07 真实多版本文件身份、同 version 改内容拒绝、并发 CAS、失败/崩溃保持旧 active、冷启回滚、撤回不复活，在途 Run 使用旧可观测版本，新 Run 使用新版本。
5. S-08/S-09 学生资料/教师私有正文/secret、隐藏指令/脚本/链接/不合格依赖反例，包/日志/SQLite/JSONL 无敏感内容；Skill 扩权文字不改变 Grant，实际未授 IO 次数 0。合法已有 Grant 仍可直接消费。
6. 旧真实 catalog/SQLite/版本文件和 native Skill epoch 的迁移回归，旧 Teacher/内建启停选择、源 hash/fencing 和已有 JSONL 保持。
7. 最终 npm run build、npm run test:renderer-components、相关 Skill/Task/Permission/Capability/教育回归、真实 Pi/SSE/Electron 技能设置主路径和 git diff --check。使用 owned TEMP、隔离 profile、合成资料，不运行会读取真实 key 的旧 UI runner。
8. 记录每份精确命令、PASS/FAIL/skipped、source/out/artifact hash、迁移和回滚证据、冷/热验证与发布/快照耗时、原失败。源码/out 冻结后交独立 Gate4，未获接受前不进入 Phase5。

后续以独立只读基线的实际主体/目录/API 定位补齐本合同文件列表与最小迁移细节，实施开始前明确冻结。当前不执行生产变动。

## 定向源码补充与拟迁移清单

现有 main/db.ts 的 users 表已有 id/display_name/role/status，seedPlatformDefaults 在空表创建 active 的默认老师 owner。Phase4 复用 users.id，新增 main 当前教师解析，只有可证明唯一 active 本地 owner 可自动作为旧个人归属迁移候选。缺失或多候选返回 typed identity_unavailable，不能取任意首行。旧 users.role=owner 不代表 Team admin 或 Official reviewer，相关角色沿 main 持久团队/审核事实单独核验，renderer/Skill payload 无 role 自声明入口。现有 teacher_student_assignments 继续原用途。

计划增量表如下，均在原 Sql/store 生命周期和 serialized transaction 中初始化。

| 表 | 保存内容 |
| --- | --- |
| xiaozhi_skill_governance_v1 | stable skillId、原 catalog name 映射、Personal/Team/Official 归属、users.id/teamId、active version/hash、revision/撤回事实 |
| xiaozhi_skill_versions_v1 | skillId+SemVer 唯一、immutable directory/files manifest/hash、父来源、验证与发布状态，正文仍为原版本文件 |
| xiaozhi_skill_teams_v1 | 本地 Team identity、状态、revision 与来源 |
| xiaozhi_skill_memberships_v1 | users.id 的单一当前 Team、main 验证角色、状态/revision 与撤销来源 |
| xiaozhi_skill_reviews_v1 | Team/Official frozen version/hash、申请/批准/拒绝/撤回、可信审核主体引用与 CAS |
| xiaozhi_skill_run_snapshots_v1 | 原 Task/session/run/generation、精确 Skill version/hash 及来源，不承载独立 Task 状态 |

表名可在 RELEASE 后按原 state 模块惯例收敛，语义与唯一性保持。旧 schema1 catalog 的 active 投影与关联记录必须同事务一致，读取核验 actor/owner/version/hash/index 与 JSON 归属。禁止先更新 catalog 后异步补版本事实。独立团队副本使用独立 skillId 和可被原 Pi parser 接受的唯一包名，保存源 skillId/version/hash。三层同名条目的 UI title 可一致，原 catalog/Pi name 的唯一约束继续生效，旧包名和旧 bytes 保持。

真实 UI 修改入口为 apps/desktop/src/renderer/components/office/PiSkillSettings.tsx，继续复用 hana-skills/SkillRow、既有 Modal/OfficeMutationBoundary/同步围栏。设置入口 PiSettingsWorkspace、会话 PiEducationWorkspace 与 preload/index.ts 仅增量接线。主要测试沿原 managed-skill、native Skill Epoch 与 Pi skill boundaries 扩展，旧可能读取真实 key 的 pi-skill-settings-ui-smoke 不直接执行，使用合成 SSE/独立 profile 的专用 runner。

## AI Creator 的活跃 Run 接缝

现有 managedSkills.mutate 和 host 普通 Skill 管理接口受全局 assertIdle，任何 active/starting Run 都会拒绝 import/edit。UI 门禁继续保留。AI Creator 在实际 owner Task/Run 的受控服务中只创建 Draft、验证与不可变 published version，不能直接调用普通 import/edit 绕过锁，也不能为自动创建全局放开 assertIdle。

published 与 active 明确分开。当前 Run 持有原 Skill Snapshot，新 published 版本在明确安全点或下一 Run 由 main 按当前治理/依赖/权限状态自动激活，不要求教师为合格个人纯说明版本重复点击启用。未激活版本不进入 enabledResources，不使当前 Runtime authority 突变成 skill_scope_changed。多 Run 的精确旧版本资源保留，普通升级不改变历史选择，撤回仍实时阻断。发布/激活 Intent 和结果沿原 Task/Journal/治理事务，不能创建后台第二 Loop。

旧导入允许本地包资源并在发模型前脱敏，尚不等于发布包隐私合格。新增发布/分享 gate 必须在不可变包落为可用版本之前检查原始正文及资源，敏感内容、脚本/执行资源和未经验证外链不能因为运行时会 sanitize 而进入 Personal/Team/Official 包。旧包保持原事实，迁移不自动提升成已经通过新发布审核。

Creator 的保存属于原 Task 下的本地 Skill 管理副作用。Tool Manifest/原 admission 明确其领域效果与 owner，不能要求伪造教学文件 write plan，也不能绕开原 Execution Boundary。请求 idempotency 由 Task 与冻结内容摘要/目标版本绑定，同一次调用重试或写后崩溃核对实际版本与持久结果，不能重复生成多个 Skill/版本。已具权限范围与本应用内部管理策略下的合格个人纯说明自动执行，外部依赖/脚本/扩权仍走对应 Provider/Extension/Permission 流程。

## RELEASE 后实施冻结

2026-11-12 总控明确 RELEASE Phase4，基线为整合提交 44cd1a5（Phase3 a93cccf 与 origin/main 34a139b）。PHASE_4_READONLY_BASELINE.md 已完整读取，图谱缺失与邻树导航后本树核对的边界沿用，不重新全仓索引。上文等待 RELEASE 的段落为合同准备历史，现在开始按此合同串行实施。

精确复用回归为 scripts/xiaozhi-agent/pi-skills-management-state-smoke.mjs、pi-skill-capability-migration-smoke.mjs（显式 before-report）、pi-skill-authority-smoke.mjs、pi-skills-boundary-smoke.mjs、pi-skill-host-lock-smoke.mjs，以及严格 API 的 pi-skill-management-api-smoke.mjs 和异步 proof 的 pi-skill-runtime-io-smoke.mjs。真实 UI 使用 owned profile/合成 SSE，不读取旧脚本中的真实模型 key。

Official 审核本轮采用可核验本地审核协议和 main 可信审核者配置，普通 users.owner 不自动成为 Official reviewer。外部云端账号/市场、stdio 和执行资源配额保持 Phase5。实现逐切片记录实际源码、测试结果与合同偏差。

## 实施结果与真实边界

T4.1–T4.4 已接入原生产链。`skill_create` 由原 Pi Tool 装配、Execution Boundary、Task admission 和 Journal 管理，在当前 Run 只发布不可变 Personal 版本，下一安全 Run 才切换 active。普通设置的 idle 门禁保持。真实 Pi 专项沿同一 Task.id 的新 Run/generation 验证旧 V1 文件、新 V2 文件、历史 Snapshot 与冷启事实。

治理使用原 SQLite 和 managed-skill 目录。实际新增七张附属表，前述六张之外增加 `xiaozhi_skill_official_reviewers_v1`。Official 角色由 main 的受信本地审核记录产生，普通本机 owner 没有该角色，renderer 和包字段不能授予角色。应用内置已审核定义的应用角色与人工本地审核角色独立。测试通过 main-only 受信入口建立合成审核者，验证撤销后冷启不复活。此交付覆盖本地审核协议。

原 schema1 catalog 继续作为 active 兼容投影，在同一事务中维护。integer 版本映射为 `N.0.0` 并保存旧名称、flags、目录与逐文件 hash。Personal、Team、Official 和版本/审核/Run Snapshot 保存在附属记录，正文继续保存在原 immutable 文件包。Team 分享创建独立 skillId 和文件副本，维护者新版本保持 pending，管理员批准前成员继续读取旧批准版本。

发布与使用权限按实际依赖分开校验。发布、分享与审核验证包、声明和已安装 Capability 来源。缺少 idle Run Grant 不阻断纯说明发布，也不会发放 Grant。真正运行时逐次验证当前 Task/Run、ScopeGrant、撤销、成员关系、版本状态和实际包 hash。新 Run 排除不合格 Skill 并披露原因，其他合格资源继续可用。在途已选资源失效仍通过原 Epoch/fencing 拒绝。

`serialized-state-sql.ts` 为旧 Sql 调用者补充同一串行 writer 内的事务 fallback，使用原连接的 BEGIN IMMEDIATE、COMMIT、ROLLBACK。已有事务实现继续优先复用。真实 SQLite 专项覆盖旧无 transaction 调用者、并发和异常回滚。

### G4-F01 隐私修复与内存作用域

修前真实反例位于 `%TEMP%/xiaozhi-phase4-privacy-race-o94Mry/report.json`，7 项中仅普通泛化方法通过，另外 6 项失败。失败涉及长私有源中间和尾部片段、`teacher-13800138000` 名称、敏感依赖/权限声明以及导入包置换。裸数字 `13800138000` 已被原 parser 拒绝，首份 2/7 报告保留该差异，不能将裸数字单例描述为已复现。

本轮为已读取的私有文本建立固定大小的保守拒绝指纹。窗口为 24 个规范化 UTF-16 code units，源步长 8，候选每个位置检查。普通至少 32 code units 的连续片段包含一个完整已索引窗口。覆盖实际返回的全部文本范围及嵌套文本字段，去掉原 4096 截断。该阈值不表示任意短片段均被识别。Bloom 碰撞可能保守拒绝，无法授予权限。原正文没有被复制到指纹持久记录。

每个 Active Run 的 bitmap 在首次合格私有文本读取或历史重建时 lazy 分配，固定 33,554,432 bytes。Run finally 在 agent.dispose 后调用 clear 并删除 Active 字段。clear 释放 bitmap 引用、清空计数并关闭上下文，晚到的 retained 引用无法继续验证发布。测试断言 release 后 memoryBytes 为 0 且 closed 为 true。V8 回收及操作系统 RSS 下降由运行时调度，未声明立即回收物理内存。

同会话后续 Run 与冷启从已经通过原 education session identity 验证的 Native SessionManager.getEntries 重建拒绝指纹。扫描完整原始成功 toolResult entries，包含 compaction 和 branch 之前的已知读取事实。专用 historical callback 只恢复拒绝证据，不进入现场执行 receipt，也不重新读取教师文件或推导 Grant。原始 JSONL 和 Task 来源保持。真实主进程测试覆盖 Run A 读取、同 Task 后续 Run B 直接引用旧正文、关闭重开后的 Run C 直接引用旧正文。

敏感名称改为安全 Draft 名称，失败包只写安全占位说明。依赖和权限声明接受同一隐私校验，失败 Draft 清除敏感声明和可能携带原标识的原因字段。验证范围是 Skill 包、治理元数据和 Creator 对外结果。教师已授权的原会话/本地业务记录继续遵循各自数据合同。

最新定向报告 `%TEMP%/xiaozhi-phase4-privacy-race-JfFm4v/report.json` 为 8/8。16,447 个 sourceCharacters 的 capture 为 13.8847 ms，普通泛化方法的完整验证为 31.8211 ms，正常泛化发布仍通过。此前独立一次 unique-source 样本为 7.9108 ms / 49.3642 ms。修前样本为 0.3256 ms / 40.1167 ms，旧样本没有完整片段检测，不能据其比较宣称性能改善。以上均为本机有界功能样本，未做吞吐或 P95 承诺。

### G4-F02 冻结导入包

旧导入验证 A 后重新读取 B 的 await 接缝已真实复现。现在对已验证 A bytes 调用原 immutable stagePackage，随后再次读取原目录，逐个核对文件集合和 bytes。外部目录在 await 期间改变时返回 skill_source_changed，B 不会进入 staged 包或 publication。失败产生的安全 A orphan 资源仍不被自动发现。定向测试在 sanitize await 断点替换 SKILL.md 并新增 evil.py，结果保持原 active/SQL 事实。

## 候选失败记录与环境适配

所有原始失败保留。修后通过不覆盖修前报告。

- 初次 production 为 0/6。向原 Task.validateCurrent 传入了额外 taskId，严格 owner shape 在准备阶段拒绝。修为原三个 owner 字段，原 Task 门禁保持。
- 初次 UI 为 0/8。Skill 设置属于已有折叠高级导航，夹具改为实际点击展开按钮后再操作，生产导航没有改动。
- 原 API/Host-lock runner 直接 Node 导入当前真实 Host 时依次遇到合并后的 TypeScript 参数属性、JSON import attribute 和 Electron utilityProcess 运行环境边界。最终使用真实 Electron main、实际 OmniEduStore、隔离 profile，保留原全部 15+9 个 Host/API/chooser 锁断言。原夹具的异步 chooser 用明确 entered Promise 同步，不修改生产锁。关闭期间 import 的 source after-await 门禁也已恢复。
- 旧夹具默认 DB 路径不存在，采用显式 owned Phase3 合成旧库副本，原 DB 不写入。原管理状态用 `test-results/xiaozhi-agent/pi-goal-task-store-0VLwmo/data/app.db`。原 Host/API 用 `%TEMP%/xiaozhi-phase3-production-JhTgs2/data/app.db` 及其精确 immutable skill 树。
- v1→v2 原始证据使用 `%TEMP%/xiaozhi-phase4-before-proof-umeQ5G/before-report.json`。该文件只投影既有独立 v1 测试的 builtin 元数据，保存原路径与 whole-file SHA。源文件位于 `D:/WorkProject/EduProject/apps/desktop/test-results/xiaozhi-agent/pi-skill-capability-132ZIf/before-report.json`，只读使用。
- F01 续聊修前报告 `skill-phase4-production-4XMdNQ/report.json` 前 4 项通过，第 5 项真实得到 published，预期 draft。此前 generation 夹具硬编码 2、实际 session generation 为 5 的失败也保留，修为读取原 Snapshot 后递增。修后 Z5r0OM 实际 9/9，但 runner 还硬编码旧 7 项而报告 success=false、进程 exit1。随后仅更新期望项数为 9，保留该 runner FAIL，未放宽业务或测试预算。

## 文件组与依赖

共享契约位于 `src/shared/xiaozhi-skill-governance.ts`。领域实现位于 `src/main/xiaozhi-agent/skills/` 的 state、service、catalog、runtime、validation、private-context、requirements、legacy、teams、official-authority、tools 和 api。main/IPC/preload 使用原 production-host、pi-session、session-state、managed-skills、managed-skill-runtime、skill-package-async、serialized-state-sql、native-stat、tools/manifest 和 tasks/plan-runtime 的薄接线。原明确 Tool 名称和 Schema 保持。

页面沿原 PiSkillSettings，新增 `office/skills/SkillGovernancePanel.tsx`、`SkillPublicationForm.tsx` 和原 CSS 增量。真实 UI 验证创建、版本回滚/撤回、Team 分享/批准/维护、验证失败、伪造角色、两种 viewport 的主要控件可达与冷启一致。测试使用合成资料和隔离 profile，未使用原生文件 chooser。本阶段完整设计与原生系统对话框接受留既定 Phase7。

本轮没有新增 npm 依赖。原 Pi/Hana parser、Tool/Runtime、SQLite 和已锁定构建依赖继续复用。Phase3 C# 源码/47104-byte helper 未改，构建继续复用 exact hash `d0d1a92473cd017ef5e56a3d37940e21fc3c4f3b1a69cdf41ea1c3d217d9e56a`。Native stat artifact 继续为 `bf8b322e1af99bc7c9907f0eb6e1d75d6ab620824728fef8d3f1014d4aab5274`。本轮没有新增执行资源、安装器或许可证范围。

## 回滚与遗留边界

回滚前关闭应用，保存原 SQLite、managed skill 文件树和本阶段证据。恢复已接受 Phase3 整合基线 44cd1a5 的生产接线后重新构建，保留本阶段七张附属表、不可变文件包、审核/撤回/来源与 Task/Journal 事实。禁止 DROP 新表或覆盖原教师目录。单个新版本失败时旧 active pointer 保持，可通过现有 typed 管理入口关闭或选择其他已批准版本。数据库事务失败、CAS 失败、closing/晚到 Creator 和 source 变化均保持旧 active。

SemVer 当前支持严格 `major.minor.patch` 核心格式。Official 使用本地可信审核协议，外部云市场不属于本阶段。Teacher/Team 主体复用本机 users 与本地成员关系。stdio、未知外部代码、Job 级 CPU/内存预算和持久 PTY 按 Phase5/6 原合同继续。本轮完整安装包/换机、真实付费模型质量、全页面视觉和最终总体压力仍由 Phase7/8 集中验证。付费调用 0/200。

## 最终命令、报告与冻结

以下命令工作目录均为 `D:/WorkProject/EduProject-harness/apps/desktop`。日志根为 `C:/Users/ZhouXuan/AppData/Local/Temp`，表中 `%TEMP%` 指向该目录。所有列为 PASS 的 runner 进程 exit0，报告 success=true，组件 runner 为 passed=total=246。没有主动跳过套内用例。未运行的完整 207、OS helper、安装和真实模型验收沿上节边界记录。

| 精确命令 | 通过 | 精确日志 |
| --- | --- | --- |
| `npm run build` | tsc 与主进程/preload/renderer 构建 exit0 | `%TEMP%/xiaozhi-harness-phase4-build-history-final.log` |
| `npm run test:renderer-components` | 246/246 | `%TEMP%/xiaozhi-harness-phase4-renderer-history-final.log` |
| `node scripts/xiaozhi-agent/skill-phase4-state-smoke.mjs` | 21/21 | `%TEMP%/xiaozhi-harness-phase4-state-gate-repair-final.log` |
| `node scripts/xiaozhi-agent/skill-phase4-privacy-race-smoke.mjs` | 8/8 | `%TEMP%/xiaozhi-harness-phase4-g4f01-f02-final.log` |
| `node scripts/xiaozhi-agent/skill-phase4-production-smoke.mjs` | 9/9 | `%TEMP%/xiaozhi-harness-phase4-production-history-final.log` |
| `node scripts/xiaozhi-agent/skill-phase4-ui-smoke.mjs` | 8/8 | `%TEMP%/xiaozhi-harness-phase4-ui-history-final.log` |
| `node scripts/xiaozhi-agent/skill-phase4-legacy-host-smoke.mjs C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase3-production-JhTgs2/data/app.db` | 15+9 | `%TEMP%/xiaozhi-harness-phase4-legacy-host-history-final.log` |
| `node scripts/xiaozhi-agent/pi-skills-management-state-smoke.mjs test-results/xiaozhi-agent/pi-goal-task-store-0VLwmo/data/app.db` | 25/25 | `%TEMP%/xiaozhi-harness-phase4-legacy-state-gate-repair-final.log` |
| `node scripts/xiaozhi-agent/pi-skill-capability-migration-smoke.mjs C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase4-before-proof-umeQ5G/before-report.json` | 10/10 | `%TEMP%/xiaozhi-harness-phase4-legacy-migration-gate-repair-final.log` |
| `node scripts/xiaozhi-agent/pi-skill-authority-smoke.mjs` | 22/22 | `%TEMP%/xiaozhi-harness-phase4-legacy-authority-history-final.log` |
| `node scripts/xiaozhi-agent/pi-skills-boundary-smoke.mjs` | 14/14 | `%TEMP%/xiaozhi-harness-phase4-legacy-boundary-gate-repair-final.log` |
| `node scripts/xiaozhi-agent/pi-skill-runtime-io-smoke.mjs` | 10/10 | `%TEMP%/xiaozhi-harness-phase4-legacy-runtime-io-history-final.log` |
| `node scripts/xiaozhi-agent/capability-phase1-smoke.mjs` | 32/32 | `%TEMP%/xiaozhi-harness-phase4-capability-gate-repair-final.log` |
| `node scripts/xiaozhi-agent/capability-phase2-contract-smoke.mjs` | 10/10 | `%TEMP%/xiaozhi-harness-phase4-contract-gate-repair-final.log` |
| `node scripts/xiaozhi-agent/permission-phase3-store-smoke.mjs` | 13/13 | `%TEMP%/xiaozhi-harness-phase4-permission-gate-repair-final.log` |
| `node scripts/xiaozhi-agent/pi-goal-task-store-smoke.mjs` | 8/8 | `%TEMP%/xiaozhi-harness-phase4-task-gate-repair-final.log` |
| `node scripts/office-agent/hana-tools-smoke.mjs` | 14/14 | `%TEMP%/xiaozhi-harness-phase4-hana-gate-repair-final.log` |
| `node scripts/xiaozhi-agent/pi-office-document-boundary-smoke.mjs` | 12/12 | `%TEMP%/xiaozhi-harness-phase4-office-gate-repair-final.log` |

state/privacy、管理状态/迁移/文件边界和 Capability/Permission/Task/Hana/Office 在 F01 完整片段及 F02 修复后的同一领域源码上通过。之后历史重建增量只改 pi-session、production-host 和两个 production fixture 文件。按该真实 delta 再构建并重跑 production9、UI8、原 Host15+9、authority22、runtimeIO10 和组件246，避免把前一 out 冒充最终执行身份。两轮日志与原失败均保存。

精确报告路径如下。

- state 为 `%TEMP%/xiaozhi-skill-phase4-state-w6IwQx/report.json`。
- privacy/race 为 `%TEMP%/xiaozhi-phase4-privacy-race-JfFm4v/report.json`。
- 最终 production 为 `D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/skill-phase4-production-qYLwOe/report.json`，合成数据根为 `%TEMP%/xiaozhi-phase4-production-m5Z0sx`。
- 最终 UI 为 `D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/skill-phase4-ui-9Ai3LW/report.json`，数据根 `%TEMP%/xiaozhi-phase4-ui-4Yt0Kr`。
- 原 API/Host 为 `D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/skill-phase4-legacy-host-9Jh5gk/report.json`，子报告为 `pi-skill-api-Hugu7A/report.json` 与 `pi-skill-host-lock-lCjdyn/report.json`。
- 原管理状态为 `D:/WorkProject/EduProject-harness/apps/desktop/test-results/xiaozhi-agent/pi-skills-management-state-FOHHMU/report.json`，原迁移为同目录的 `pi-skill-capability-migration-Z0iqvE/report.json`。
- authority 为 `%TEMP%/xiaozhi-pi-skill-authority-Lz6Mfl/report.json`，runtime IO 为 `%TEMP%/omni-skill-runtime-io-MBiNEK/report.json`，boundary 为 `%TEMP%/xiaozhi-pi-skills-boundary-GUK2WW/report.json`。
- Capability 为 `%TEMP%/xiaozhi-capability-phase1-pQQ4Nm/report.json`，Contract 为 `%TEMP%/xiaozhi-capability-phase2-contract-9wx64C/report.json`，Permission 为 `%TEMP%/xiaozhi-permission-phase3-store-KPdTh0/report.json`，Task 为仓内 `pi-goal-task-store-OeJDCQ/report.json`。
- Hana 为 `D:/WorkProject/EduProject-harness/apps/desktop/test-results/office-plan/hana-tools-05CeGa/report.json`，Office 为 `%TEMP%/xiaozhi-office-boundary-U7Qdsu/report.json`。

生产专项 16 次本地 SSE fixture 请求，付费请求 0。九个 case 的整体耗时依次为 2295.05、4992.34、2119.02、4457.75、3134.24、133.10、247.34、4220.57、6213.14 ms。这里包含真实 Host/Pi 准备与多 Tool 调用，无法当作纯 Creator/历史 fingerprint 的孤立耗时。此前 Phase3 已记录的每 Run 本地准备时延仍由 Phase8定位。最终 renderer build 9.51s，前一轮 58.26s，存在缓存/机器负载差异，未据此宣称产品响应加速。

最终冻结为 `%TEMP%/xiaozhi-harness-phase4-freeze-history-k1ea5k/freeze.json`，HEAD `052bd6885c4280b49ab36228fe9ac605799a769b`。

- 37 个本轮 source/test 文件，列表 SHA256 为 `4af4546c89b86b052f26c390932c5fceb187da3e9baa795c4b2fbb3bcaeceaf1`。
- 466 个 out 文件，列表 SHA256 为 `de5592a1ecb98063503215b1fabef1ac34a05b700cb3ee2d9b91f1a736ce8faf`。
- `%TEMP%/xiaozhi-harness-phase4-freeze-history-k1ea5k/after-tests-verification.json` 在最终串行测试结束后核对所有 503 个字节 hash，0 差异。37 个源码扫描 trailing whitespace 为 0，`git diff --check` exit0。原独立 v1 source SHA `69d32a26f7e283aece5856c38e1aa30399323fa893516fdaf1da460847b2aca0` 再次读回一致。
- 初次 source-only `xiaozhi-harness-phase4-freeze-4O5IpX` 与片段修复后 `xiaozhi-harness-phase4-freeze-final-amiiIk` 均保留并标 superseded。最终 source/out 停写并已向总控和独立 reviewer 释放 runtime。本文结果补录不改变受审源码或 out。

独立 Gate4 的最终接受结论由总控记录，本实施报告只记录 writer 的真实运行结果。

## Gate4 G4-F03 事务读隔离定向修复

独立 reviewer 用真实 SQLite、旧 Sql 形态和真实 createSkillGovernance.view 复现了 fallback 的未提交读。写事务插入 skill_owned_pending 并暂停时，外部 view 能看见该记录，随后事务抛错回滚后记录消失。原报告 `%TEMP%/xiaozhi-gate4-sql-fallback-kNB5fU/report.json` 为 3/4，完整保留。callback work 的内部操作、写队列、回滚后下一写和 native transaction 优先本来已通过。

最小修复位于原 serialized-state-sql.ts。旧无 transaction 的同连接 fallback 将外部 all 加入原串行队列，等待当前事务提交或回滚。AsyncLocalStorage 仅标记该 fallback 的当前事务 work 和 active 生命周期，合法内部闭包读写以及嵌套模块调用直接使用同一 work，避免等待自身队列。finally 关闭上下文，已经离开事务的异步引用重新服从队列。原生 source.transaction 继续优先，原生 adapter 的 reader 隔离路径保持。

原独立四项探针命令为 `node C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-gate4-review-3625f274df9a45888c3f1953ea5fe083/sql-fallback-probe.mjs`，工作目录为仓根。修后日志 `%TEMP%/xiaozhi-harness-phase4-sql-f03-after.log`，报告 `%TEMP%/xiaozhi-gate4-sql-fallback-aeFwfb/report.json` 为 4/4，readBeforeRelease 为 false，外部 view 在 rollback 后才返回空集。

核心 state 专项保留原全部断言，并在旧形态 case 增加真实治理 view、暂停事务、内部 wrapper 闭包读、嵌套 transaction 与外部读不提前完成的断言。全套另支持 `--legacy-sql`，使所有 21 项业务操作使用旧无 transaction 连接，覆盖 Official review 内 service.officialReviewers 的闭包读取。两条精确命令均从 apps/desktop 运行。

- `node scripts/xiaozhi-agent/skill-phase4-state-smoke.mjs` 为 21/21，日志 `%TEMP%/xiaozhi-harness-phase4-sql-f03-state-native.log`，报告 `%TEMP%/xiaozhi-skill-phase4-state-WzaDxN/report.json`。
- `node scripts/xiaozhi-agent/skill-phase4-state-smoke.mjs --legacy-sql` 为 21/21，日志 `%TEMP%/xiaozhi-harness-phase4-sql-f03-state-legacy.log`，报告 `%TEMP%/xiaozhi-skill-phase4-state-vKZ0F0/report.json`。

此修复仅修改 serialized-state-sql.ts 与 state fixture。前一 history-k1ea5k 冻结与执行证据继续保留，新的最终构建及受影响回归在下方单独记录。

## 2026-11-17 恢复后的 F03 实施侧收尾

恢复时检查自有进程，暂停前的 Harness runtime 已退出。已完成的构建日志为 `%TEMP%/xiaozhi-harness-phase4-build-sql-f03-final.log`，包含 tsc、main/preload/renderer 的完整成功输出，renderer 构建耗时 10.65s。恢复前后均逐文件核对 F03 冻结，37 source 与 466 outputs 全部保持相同字节。沿此已完成构建执行受影响接缝回归。

以下六套于 2026-11-17 串行实际执行，工作目录为 `D:/WorkProject/EduProject-harness/apps/desktop`。全部进程 exit0、全部套内断言通过，各套 skipped 为 0。原 21 项 native 与 21 项 `--legacy-sql` 专项继续使用上节 F03 修复后、暂停前的真实证据，其源码身份与本轮相同。

| 精确命令 | 实际结果 | 原始日志 |
| --- | --- | --- |
| `node scripts/xiaozhi-agent/permission-phase3-store-smoke.mjs` | 13/13 PASS | `%TEMP%/xiaozhi-harness-phase4-sql-f03-resume-permission.log` |
| `node scripts/xiaozhi-agent/pi-goal-task-store-smoke.mjs` | 8/8 PASS | `%TEMP%/xiaozhi-harness-phase4-sql-f03-resume-task.log` |
| `node scripts/xiaozhi-agent/skill-phase4-legacy-host-smoke.mjs C:/Users/ZhouXuan/AppData/Local/Temp/xiaozhi-phase3-production-JhTgs2/data/app.db` | 原 API 15/15 与 Host-lock 9/9 PASS | `%TEMP%/xiaozhi-harness-phase4-sql-f03-resume-legacy-host.log` |
| `node scripts/xiaozhi-agent/skill-phase4-production-smoke.mjs` | 9/9 PASS | `%TEMP%/xiaozhi-harness-phase4-sql-f03-resume-production.log` |
| `node scripts/xiaozhi-agent/skill-phase4-ui-smoke.mjs` | 8/8 PASS | `%TEMP%/xiaozhi-harness-phase4-sql-f03-resume-ui.log` |
| `npm run test:renderer-components` | 246/246 PASS | `%TEMP%/xiaozhi-harness-phase4-sql-f03-resume-renderer.log` |

精确原始报告分别为 `%TEMP%/xiaozhi-permission-phase3-store-3jJkJ9/report.json`，以及本树 `apps/desktop/test-results/xiaozhi-agent/` 内的 `pi-goal-task-store-HFatUd/report.json`、`skill-phase4-legacy-host-I32r0P/report.json`、`pi-skill-api-iLATr8/report.json`、`pi-skill-host-lock-3hNa0T/report.json`、`skill-phase4-production-LKnkiD/report.json`、`skill-phase4-ui-2jLBUz/report.json`。Host/API 沿真实 Electron main、实际 OmniEduStore 和原断言运行。

生产专项使用 owned TEMP 合成资料与 loopback SSE，16 次 fixture 请求，paidCalls 为 0。九个 case 墙钟耗时依次为 4712.29、4871.80、2027.17、4962.01、3390.74、130.13、293.99、4737.75、8117.13 ms，包含 Host/Pi 初始化与业务工具执行。F03 影响回归验证完成，吞吐及 P95 沿 Phase8 计划定位。

UI 专项使用实际 built main/preload、现有设置导航、typed IPC、SQLite/不可变文件 readback 和冷启。已读取 `skill-phase4-ui-2jLBUz/skills-1366.png` 与 `skills-1920.png`，验证失败反馈及主要动作在两尺寸可见，页面保持原滚动容器。完整页面视觉与原生 chooser 验收沿 Phase7 范围。

实施侧证据独立归档于 `evidence/phase4/implementation-resume-20261117/`。`MANIFEST.json` 保存全部原绝对路径、精确命令、实际状态、27 份原始日志/报告/截图/冻结清单的字节大小与 SHA256，压缩文件另保存自己的 SHA256。此目录属于 implementation side，独立 Gate4 结论由总控另行记录。

最终 freeze 继续为 `%TEMP%/xiaozhi-harness-phase4-freeze-sql-f03-KcIykO/freeze.json`，HEAD `052bd6885c4280b49ab36228fe9ac605799a769b`。sourceListHash 为 `6fa2d3a63664f239c9ec05088d9f26670cc2f9547de40684d15b65ba3b42a628`，outListHash 为 `753832ea06a7229474ee203c19087ca3dac5b0c00440bd66a33aeb56b2210f86`。`after-tests-verification.json` 在六套结束后核验 503 个文件，changed 为空，`git diff --check` exit0。

实施侧已于 2026-11-17 向总控发送 `RUNTIME_RELEASED`，所有自有测试实例已结束，生产与测试源码/out 保持冻结。Phase4 等待独立 Gate4 运行结论及总控整合。Phase5–8 沿既定阶段顺序继续，付费累计 0/200。上节回滚方案及原始失败证据继续有效。
