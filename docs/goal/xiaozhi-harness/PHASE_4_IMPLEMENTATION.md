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
