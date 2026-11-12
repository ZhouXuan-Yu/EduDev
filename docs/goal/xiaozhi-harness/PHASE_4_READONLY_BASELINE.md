# Phase4 Skill System 只读基线

2026-11-12，目标树为 `D:/WorkProject/EduProject-harness`。读取时 HEAD 为 `ad01ec013355ec39e46a5e40ed32d5f704583e5c`，树内已有 Phase3 未提交实现。本报告依据本树当前源码、`11_SKILL_SYSTEM.md`、EXECUTION_BOOK T4.1–T4.4 和 ACCEPTANCE_CRITERIA S-01–S-09。本轮交付为这一份只读交接文档，生产源码、测试、out 和运行数据写入均为 0，build、测试、模型调用均为 0。

本文路径除另有说明均相对 `apps/desktop`。源码接缝属于静态核验，所列验收步骤全部待执行。

## 1. 图谱证据边界

先调用 codebase-memory list_projects、index_status 和 search_graph。目标 `D-WorkProject-EduProject-harness` 显示 nodes=0/root_path 为空，index_status/search_graph 均返回 `project not found or not indexed`。相邻已有 `D-WorkProject-EduProject-agent-stream-tools` 图中可定位 createManagedEducationSkills、createManagedSkillRuntime、createPiSkillCatalogState、createPiSkillEpoch、createSkillManagementApi、registerSkillManagementIpc 和 PiSkillSettings。

邻树图的 inbound trace 给出 `registerXiaozhiIpc → createXiaozhiProductionHost → createManagedEducationSkills`。这些名字仅用于导航，随后逐个读取 harness 本树对应文件确认。本轮使用有界文件读取补齐缺失图路径。没有重建全仓索引或进行新的全仓安全审查，结论属于部分图谱定位加本树源码核验。

## 2. 已有纵向接缝

| 接缝 | 本树锚点 | 实际行为与复用价值 |
|---|---|---|
| 公共协议 | `src/shared/xiaozhi-skills.ts` 第1–24行 | 公共 Skill、catalog、preview、mutation 和错误投影。origin 为 builtin/teacher，version 为整数。管理动作仅 import、enable、edit、archive。 |
| SQLite catalog | `src/main/xiaozhi-agent/skill-catalog-state.ts` 第3–77行 | 单表 `xiaozhi_pi_skill_catalog`，singleton、schema_version=1、revision、payload_json、updated_at。严格校验 payload，CAS insert/update，保留未知 schema 的 configuration 失败。 |
| 数据根与初始化 | `src/main/xiaozhi-agent/production-host.ts` 第317–336行 | managedSkills 位于既有 root/skills，使用原 session-state store，启动 initialize。publicSkills 从启用且未归档的 catalog 生成当前 UI 投影。 |
| 包读取与验证 | `src/main/xiaozhi-agent/managed-skills.ts` 第22–100、129–162行，`skill-package-async.ts` | 校验明确路径与祖先、包节点/深度/文件数/字节、UTF-8、SKILL.md frontmatter、每文件 SHA256，运行时有异步取消和完整资源复核。 |
| 资源版本写入 | `managed-skills.ts` 第164–183、236–280行 | 写入 `versions/<name>/<uuid>/<name>`，文件使用 wx，旧版本目录保留。导入复制原包，编辑产生整数 version+1 的新目录，CAS 后替换当前 catalog 项。教师导入与编辑后的版本默认关闭。 |
| 旧数据迁移 | `managed-skills.ts` 第109–127、204–227行 | 识别原 v1 和当前应用审阅 builtin，验证旧源后增量建立新版本，保留启停选择和 teacher 包。CAS 失败重新读取，未发布目录保持 inert。 |
| typed IPC | `skill-management-api.ts` 第8–54行，`src/preload/index.ts` 第385–387行 | 严格 mutation 字段，固定公开投影，拒绝 renderer 自带路径。三个 channel 为 xiaozhi:skill-catalog / skill-preview / skill-mutate。 |
| 主窗口选择目录 | `src/main/xiaozhi-agent/ipc.ts` 第122–126行 | 注册上述 API，复用 fromMain。导入路径由原生目录选择器返回，取消表示无 catalog 变更。 |
| 主进程管理门禁 | `production-host.ts` 第333–336、1387–1397行 | 管理动作保留全局 skillsMutating、active、starting、choosing、configuring、closing 门禁，预留锁覆盖异步选择器。 |
| 模型资源准备 | `managed-skill-runtime.ts` 第16–85行，`production-host.ts` 第793行 | 原始包留在本地。SKILL.md 和限额内 md/txt/json/csv 引用逐份经 store.sanitizeProblemText 后成为 runtime 文本。固定 authority 缓存目录复核内容，再由原 Pi loadSkillsFromDir 解析。 |
| 只读 Skill Tool | `managed-skill-runtime.ts` 第86–117行 | 公开 Tool 名为 read，只接受当前 expected 映射中绝对文本路径，执行前后检查源/authority，只返回已登记内存文本。没有脚本执行或 Skill 创建动作。 |
| 原生快照与 epoch | `native-skill-epoch.ts` 第17–46行，`vendor/hana/lib/skills/session-skill-snapshot.ts` 第69–183行 | 原 Pi/Hana session pointers、source/runtime identity、xiaozhi.education.skills.v2 authority、taint 与 blockedRunIds。旧 v1 身份兼容，改变 authority 时隔离旧派生上下文。 |
| Pi 实际装配 | `pi-session.ts` 第347–360、723–758、1020、1275–1279行 | createManagedSkillRuntime 与 createPiSkillEpoch 接同一 Pi Session，getSkills 返回既有资源，read 走原工具体系，开始 Run 和交付前执行 epoch 门禁。 |
| 真实页面 | `src/renderer/components/office/PiSkillSettings.tsx` 第10–106行 | 现有读取、刷新、导入、预览、启停、编辑新版本、归档确认和错误提示，沿 typed preload 操作。 |
| 当前导航 | `PiSettingsWorkspace.tsx` 第35、50、163行，`PiEducationWorkspace.tsx` 第354、412、420行 | 设置中的教育技能分类与工作台 Skill 弹层共用 PiSkillSettings。工作台已有选用当前 Skill 与说明预览入口。 |

主路径可以复用为 `现有技能页面 → typed preload → fromMain IPC → main 全局锁/校验 → immutable 文件目录 → SQLite CAS → public catalog → 原 Pi Skill loader/read/epoch`。

## 3. 当前持久化、运行版本和主体事实

### Catalog 与版本

现有 schema v1 只保存每个 name 的当前项和其 files 哈希清单。旧目录的字节保留，但没有发布版本索引、Semantic Versioning、发布与激活分离的指针、回滚/撤回操作及发布审批记录。不能仅凭旧目录还在而把 S-07 算作已实现。

现有每文件哈希可复用为版本资源证明。runtime authority 还混合 sanitized 文本身份，服务于会话资源与上下文 fencing。Phase4 需明确原始不可变发布内容身份和当前脱敏 runtime identity 各自的引用用途。

`session-state.ts` 第36–44、103行复用 serialized SQL、catalog migration 与既有 session store。增量治理表和唯一约束可放入该领域入口，旧单例 catalog 继续承担兼容的 active 投影。当前代码的 schema 严格等值校验需要版本分支或显式 adapter，不能向旧 payload 直接塞入新字段。

### 现有本地主体

`src/main/db.ts` 第6100–6107行已有 users 表，含 id、display_name、role、status、时间字段。第6269–6276行在空表中创建 `user_<uuid>`、默认老师、role=owner、status=active。第6108–6115行已有 teacher_student_assignments。

在本轮检查的 db/main bootstrap/preload/Skill 链与 shared 中，users 只见 schema、统计和默认 seed，Skill 管理 API 未消费可信 current-user/Team membership/管理员状态。教育 session identity 保存的是学生和工具范围。浏览器代理 authenticated 属于本地代理认证接缝。

Phase4 应优先复用可证明的既有本地 users 身份作为个人归属候选。唯一 active 本地 owner 的迁移规则需要 main 明确解析，缺失或多候选返回具体配置状态。既有 users.role=owner 不直接证明 Team admin 或 Official reviewer。新团队/官方审核行为必须依据 main-owned membership/角色/审核事实，renderer 的 actorRole、ownerId 或 official=true 不能产生权限。

## 4. S-01–S-09 实际缺口

| ID | 静态已有能力 | Phase4 仍需交付 |
|---|---|---|
| S-01 自动个人 Skill | 手动目录导入、结构校验、版本写入和原 Pi read | 同一主 Runtime 内的受控 Creator Tool/API，Draft → 结构/内容/依赖/隐私/权限 → 验证证据 → Personal Publish。缺少 AI 自动创建发布入口及持久生命周期。 |
| S-02 私有默认 | 本地数据根，teacher 包默认关闭 | 明确 ownerId、Personal 归属与 main 过滤，迁移既有包，跨主体负例。当前单例 catalog 的本地性不足以证明多主体私有过滤。 |
| S-03 独立分享副本 | importDirectory 按字节复制到新 UUID 目录 | 个人到 Team 的独立 Skill/版本身份、parent/source provenance 和变更隔离。 |
| S-04 团队审批 | 通用 CAS、主进程 mutation 门禁 | 一位教师最多一个 Team 的持久约束、成员/维护者/管理员事实、pending approval 和批准后才可见/可用的读取过滤。 |
| S-05 官方审核 | 应用内 builtin 的审阅定义和哈希校验 | Official 审核元数据、来源/许可证/兼容/验证记录、可信 reviewer/publisher 入口、发布/撤回状态。本阶段先建立本地协议。 |
| S-06 不可变版本 | 新 UUID 目录、wx、per-file hash、整数 version | 可查询的不可变发布记录、SemVer 和原有整数版本兼容映射，published/active 分离，版本冲突与 idempotency。 |
| S-07 回滚 | 旧资源目录保留，native epoch 能区分 authority | 可信版本历史、激活指针 CAS、回滚/撤回 API 和 UI，切换时使用原 epoch/Session 安全点。 |
| S-08 包隐私 | 发送模型前 sanitize，runtime 只开放选定文本 | 发布与分享前的包内容隐私 gate、敏感引用检查和明确验证结果。当前导入原始包仍可保存 PII 和脚本，runtime sanitize 不等于发布包隐私已通过。 |
| S-09 不扩权 | 只读 read、主进程控制实际业务工具，Phase3 Grant 接缝 | Skill Capability ID 依赖和权限需求的版本化声明/检查、未知字段与恶意包反例，确保声明只形成需求，实际 Tool/Provider 继续消费当前 Grant。 |

`capabilities/types.ts` 已有 CapabilityRequirement、CapabilityResolution 和 provider/conformance 元数据，ProviderManifest 支持 type=skill。当前 Skill catalog/runtime 尚未消费这些稳定依赖声明。可以记录 Skill→Capability 引用，Skill 正文继续位于版本资源目录。

外部包当前会保留 helper.py/script.js 等本地字节，runtime 仅筛选必要文本，既有测试也明确验证其不执行。Phase4 自动 Personal Publish 的纯说明资格必须单独检查。可执行内容沿 Extension/受控代码流程申报，原 Skill read 继续保持文本边界。

## 5. 最小领域修改边界

1. 在 `shared/xiaozhi-skills.ts` 或其紧邻独立协议文件增加版本化 governance/draft/validation/publication/history/activation 投影，保留旧管理调用兼容。
2. 在 `main/xiaozhi-agent/skills/` 新增聚焦的 Creator、验证、治理状态、版本/激活和角色解析服务。原 managed-skills 的目录验证、writeVersion、哈希和 CAS 接口继续复用。
3. 在原 session-state migration 增加治理附属表，覆盖 owner/scope、版本/发布、验证证据、Team membership/审核和 Official 审核引用。正文仍在原 immutable 版本目录。具体表名和字段由实施合同冻结。
4. 主体解析复用既有 users。新 main writer 绑定操作的实际 actor、Task/Run/generation 和 expected revision，角色来自持久事实。官方与团队审批权限分别核验。
5. Creator 按原 Tool/Execution Boundary/Pi 注册接入，使用已有 Task 与 Grant。管理 IPC、preload 与原 PiSkillSettings 按治理动作增量扩展。列表、版本、审批与回滚使用同一读取真源。
6. managed-skill-runtime 与 native-skill-epoch 接激活结果和已发布版本引用，继续原 Pi loader/read/session-pointer/authority 链。Phase4 的本地治理协议和 UI 形成真实闭环，外部市场与完整云服务按后续阶段推进。

### Creator 与 idle 门禁的冲突

`production-host.manageSkill` 和 managed-skills.mutate 当前在 active/starting 时拒绝写入。AI Creator 在已有 Run 内直接调用 import/edit 会得到 busy。这是本阶段必须解决的具体接缝。

应保留现有 UI 的全局 idle/mutation 锁。Creator 在同一可信 Task/Run owner 下追加 Draft、验证和不可变 publication，published 与 active 分开。当前 Run 固定原 snapshot，合格个人纯说明版本在主进程安全点或下一 Run 按已授策略激活。新 Creator 的范围不能依靠全局关闭 assertIdle 来获得。

在当前实现中，enabledResources 及其 authority 决定 runtime 资源。出版未激活版本和当前运行资源应分别变更，否则创建动作可能刚发布就触发本 Run skill_scope_changed。

## 6. 最小正常、失败和重启验收集

全部为下一阶段执行计划，状态均为 NOT_RUN。本轮没有产生通过数。

| 组 | 步骤与通过条件 | 覆盖 |
|---|---|---|
| N1 Personal 正向 | 从原工作台请求保存合成可复用方法，真实 Pi 本地 SSE 驱动 Creator Tool，经 main Draft/验证/Publish，SQLite 与版本文件 readback 一致；默认个人归属，当前 Task/Run 保留，后续安全点可使用。 | S-01/02/06/09 |
| N2 Team 正向 | 由 main 可信成员分享发布版本为新副本，管理员批准后团队读取可见。修改个人后副本字节/版本不变，provenance 可查。 | S-03/04 |
| N3 Official 正向 | 本地可信审核流程附来源、许可证与验证记录，批准后发布，正常用户可读取兼容版本。 | S-05 |
| N4 Version 正向 | v1→v2 发布及激活，回滚 v1，验证两份旧字节哈希、history、active 指针和新 Run runtime 身份。 | S-06/07 |
| F1 验证负例 | 缺 required Capability、未知/不兼容 contract、缺必需权限时给出具体缺口，零 publication/零新增 Grant。optional 缺口按协议披露。 | S-01/09 |
| F2 隐私/执行负例 | 合成学生姓名联系方式、教师私有正文、假凭据、隐藏外链/指令与脚本包分别通过真实创建/分享入口。敏感内容不进入发布包和普通审计，脚本执行次数0。 | S-08/09 |
| F3 角色负例 | 非管理员批准、未审批 Team/Official 读取、第二 Team 加入、renderer 伪造 actorRole/official/owner 字段均被主进程拒绝。 | S-02/04/05/09 |
| F4 包与并发负例 | traversal/reparse/hardlink/大小上限、builtin 同名冒充、同 SemVer 不同 hash、stale revision 和并发 publish。受限错误有 UI 反馈，冲突后旧文件/active/revision 一致。 | S-06/09 |
| R1 Draft/审核重启 | 保存 Draft 或待审批状态→实际终止→重启只读展示→显式继续原 Task，验证一次发布。改摘要/角色/依赖/来源后旧审批失效。 | S-01/04/05/09 |
| R2 文件/DB中断 | 写 immutable 目录后、CAS 前故障；重启旧 active 完整，孤立目录保持 inert；按原请求重试不重复发布或覆盖旧版本。 | S-06/07 |
| R3 活动版本与撤回 | v1 Run 执行期间创建/发布 v2，当前 snapshot 稳定。激活/撤回后最新状态门禁和原 epoch 共同阻止旧派生上下文越权恢复。 | S-06/07/09 |
| R4 旧库迁移 | 全新库与明确旧库副本覆盖 builtin v1/v2、teacher 关闭/启用/归档、未知 schema、唯一/缺失/多 active owner。增量幂等，旧目录、旧启停和 native 快照保留，主体歧义有具体状态。 | S-02/06/07 |

上述测试应从既有 typed API、真实 SQLite/文件与原 Pi 入口开始，UI 项补当前导航及冷启 readback。每项报告精确命令、实际结果、原 Task/Run、版本/哈希、状态/审计和未验证边界。1366×768 与 1920×1080 的 Skill 管理可达性及归属/审批/历史展示按项目 UI 验收合同执行。

## 7. 可复用的已有测试锚点

以下仅阅读脚本源码，本轮均未运行。

| 路径，均位于 `scripts/xiaozhi-agent/` | 现有覆盖及使用边界 |
|---|---|
| `pi-skills-management-state-smoke.mjs` | 真实 SQLite、旧库副本、文件/Pi parser、import/edit/version/CAS/损坏源，需按新治理模型补断言。 |
| `pi-skill-capability-migration-smoke.mjs` | builtin v1→v2、保留 teacher/disabled、CAS race、失败目录 inert、冷启和原 native snapshot。脚本首项需要明确 before-report 参数。 |
| `pi-skill-management-api-smoke.mjs` | strict payload、public projection、foreign frame、取消 chooser、stale/busy、原包保留。 |
| `pi-skill-host-lock-smoke.mjs` | 真实 production host 的 chooser/startup/global mutation 锁，关闭后回调和跨会话冲突。 |
| `pi-skills-boundary-smoke.mjs`、`pi-skill-authority-smoke.mjs` | 原 native Skill/authority、blockedRun、撤销/压缩后上下文隔离。 |
| `pi-skill-runtime-io-smoke.mjs` | 实际 runtime 资源 proof 的异步取消、I/O 和事件循环边界。 |
| `pi-skill-existing-ui-smoke.mjs`、`pi-skills-ui-smoke.mjs` | 现有显示/选择/说明入口，运行方式按各脚本依赖核对。 |
| `pi-skill-settings-ui-smoke.mjs`、`pi-skill-capability-ui-smoke.mjs` | 源码读取到真实模型 key/正式 provider 和实际 Electron 路径，后续调用应按 root 模型预算与串行验收安排。 |

另有 `scripts/acceptance/configuration-skill-journey.mjs` 可复用当前设置 UI 的取消导入、无效包、默认关闭、预览、编辑与归档取消路径。package.json 第79–86行已有多个 Skill npm 脚本，其中部分包含 build/tsc。Phase4 的无付费确定性主路径可以沿既有本地 SSE 与真实 Pi 集成方式组织。

## 8. 交接结论

现有文件版本资源、SQLite CAS、原 Pi 只读 Skill Runtime、epoch fencing 和真实管理入口可以承接 Phase4。实施合同需要冻结治理附属状态、已有 users 主体解析、Creator 的 Run 内受控 publication、active 切换安全点、包级隐私和角色审批边界。本报告没有对 S-01–S-09 给出运行时验收结论。
