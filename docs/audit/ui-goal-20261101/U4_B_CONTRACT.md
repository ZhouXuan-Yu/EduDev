# U4-B：本卷题目实例编辑与修订核对合同

日期：2026-11-01；续接2026-11-02。状态：U4-A真实桌面10项已通过；本合同宿主、协议和导出编译路径已实现，三项独立P2已修复并复审接受。正式编辑界面正在接入；整合构建、B真实桌面与六类文件验收尚未完成。合同不是产品验收结论。用户已授权按完整 Goal 继续，无需重复申请开发授权。

**U4-B 可按下列合同交 Sol 实施。** 已核对稳定宿主和真实导出消费者；结论是新增卷内实例协议，并贯通快照、核对和输出，不能只给 A 的题目对象增加编辑字段。A 三项 P2 的接受结论保持冻结，Actual2 另行验收。

1. **完整目标与阶段边界。**
   同一持久题篮支持本卷题干、选项、小问、答案解析编辑，显式换题、原题对照、逐修订核对，以及选题—编辑—预览往返和冷恢复。修改不写回题库，不影响其他篮或历史卷。B 包含这些内容进入实际导出的必要适配；模板复用、OCR、模型改编、noexam、任意逐题分值另片，不据 B 关闭整个 C/D。

2. **四类身份明确分开。**
   建议固定新增：
   - `xiaozhi.paper-basket.v2`：具有实例编辑能力的篮。
   - `xiaozhi.paper-instance.v1`：卷内内容、谱系和核对记录。
   - `xiaozhi.paper-basket-snapshot.v2`：绑定实例修订的不可变整卷。

   `basketId`标识题篮；`entryId`标识稳定位置成员；`questionId + sourceVersion`标识父来源；`instanceRevision + contentDigest`标识本卷内容。不得用收藏版本、updatedAt或实例摘要替代来源版本。当前 A 强制题目摘要等于来源摘要，须保留旧解析、新增独立分支：[paper-basket-state.ts:67](D:/WorkProject/EduProject-sidebar/apps/desktop/src/main/education/paper-basket-state.ts:67)。

3. **v1 兼容与升级规则。**
   旧 basket v1、自动 paper v1/v2、A snapshot v1 的字段、摘要算法、审批及 receipt 保持原义。v2 读取旧篮仅做无写入适配；首次实例修改在同事务升级该篮，保持 basketId/entryId，递增篮修订，不修改历史整卷。
   v2 列表/读取支持两版；v1 列表须有明确版本过滤及一致 total，不能因同 owner 出现 v2 篮而整页解析失败。v1 操作不能降级覆写 v2。旧已提交请求仍查原 receipt、不重放；无法无损返回 v1 时明确 conflict，要求新版重读。损坏或未知 schema 不回退成旧原题。

4. **实例 schema 与唯一内容真源。**
   实例至少包含 `entryId、instanceRevision、contentDigest、sourceBinding、content、review`。宿主建立 sourceBinding，保留父题版本及原 generation 证明；客户端只能提交编辑意图。
   建议内容按 question/answer/analysis 三个角色组织，每个角色严格区分：
   - `source`：使用宿主绑定的未修改来源内容；
   - `edited`：使用教师编辑的有界结构化 blocks。

   blocks 支持文字、公式、表格、选项、小问及受限来源图片引用；禁止任意 HTML、文件路径、URL、dataURL或客户端资产摘要。兼容文字投影由宿主从同一内容派生，不能维护两套独立可写答案。不要伪造原题 `QuestionDocument` 的来源锚点：该结构实际要求资源版本、原图块和投影一致。[question-document.ts:84](D:/WorkProject/EduProject-sidebar/apps/desktop/src/shared/question-document.ts:84)

5. **strict operations 与 typed IPC。**
   沿现有题篮 API 增加显式 v2 分支，外层必含 `schemaVersion/sessionId/basketId/requestId/expectedRevision`。保留 A 的结构操作；新增以下判别联合：

   | 操作 | 必要输入与行为 |
   |---|---|
   | `editEntry` | entryId、expectedInstanceRevision、严格 content；宿主生成新摘要 |
   | `replaceEntry` | entryId、expectedInstanceRevision、新 questionId、expectedSourceVersion；重读候选并原子替换 |
   | `restoreEntrySource` | entryId、expectedInstanceRevision；恢复当前绑定父来源，不自动追随最新版 |
   | `reviewEntry` | entryId、expectedInstanceRevision、expectedContentDigest、confirm/reject；宿主记录核对事实 |

   不接受任意 JSON Patch、客户端 owner、审核时间、sourceKind、generation、digest。来源更新通过显式换题操作，即使 questionId 相同也要核对新版本。结构严格拒绝未知字段、getter、循环、稀疏数组；建议实例内容上限128 KiB，保留100题、20节及32 MiB篮状态上限，修订历史另设明确容量门禁。

6. **谱系、核对与持久化。**
   沿同库增量迁移，可增加一张实例修订表，唯一键绑定 owner/basket/entry/revision；记录操作、前后摘要、父来源及必要内容前态，支持原题/修改对照。换题属于 replacement，不伪称新题由旧题改编；不把无限历史塞入每次篮响应。
   内容修改、换题、恢复来源使当前核对失效；重新核对绑定实例摘要和来源绑定。拒绝核对同样使派生交付失效。核对事件有独立身份，不能把内容修订、核对版本和整卷 revision 混为一项。升级后的 v2 条目缺少核对记录时显示待核对，不能倒造历史确认；旧 v1 整卷仍按旧规则读取。`answerVerified:false`保留，教师确认不冒充独立正确性证明。

7. **权限、事务、CAS和幂等。**
   复用 [db.ts:1113](D:/WorkProject/EduProject-sidebar/apps/desktop/src/main/db.ts:1113) 的同连接事务，以及现有会话/学生绑定和生产写租约。顺序固定为：严格输入校验→授权→receipt比对→篮/实例CAS→业务校验→状态、修订、核对、receipt原子写入→租约复核。
   新领域操作继续计领域额度，UI偏好使用独立额度；旧receipt不删。无变化的保存不得无故增加内容修订，重试不得再次执行。取消、归档、权限变化或任一写失败全部回滚；返回当前资格，不能重放历史“可导出”状态。

8. **来源资格和旧三策略保护。**
   分开验证“父来源仍有效”和“本卷修改已核对”。父来源变化时保留编辑草稿，但阻断正式确认/导出，不自动覆盖。生成父题继续通过当前 owner、质量记录、父题、effectDigest和保存版本检查：[question-review-repository.ts:101](D:/WorkProject/EduProject-sidebar/apps/desktop/src/main/education/question-review-repository.ts:101)。原生成审批只证明父来源，不审批修改后的内容。
   来源配额依据宿主保存的谱系，教师编辑另行标注，不伪造生成身份或教材原文；source_only仍不得引入生成题，hybrid配额和ai_original来源限制不放宽。旧自动选择算法不改。实例修改题型、知识点等匹配属性若纳入输入，必须重新校验分节，不能沿父题属性暗中过关。

9. **原图与编辑文字的输出规则。**
   当前 rich compiler 对 document/native 图稿优先输出原图：[paper-rich-export.ts:25](D:/WorkProject/EduProject-sidebar/apps/desktop/src/main/education/paper-rich-export.ts:25)。B 必须新增按实例角色编译的路径：
   - 未修改角色沿原图文路径；修改角色输出本卷内容，不自动附带旧整题或旧答案截图。
   - 原图仍可作为来源证据查看，证据展示不等于交付内容。
   - 编辑角色保留配图时，必须显式绑定宿主授权的来源图、角色、blockId及版本，并纳入本次核对；整题截图不能冒充独立配图。
   - 图片依赖无法完整表达时，保留草稿并阻断交付；不丢图、不假裁图、不回退摘要。

   图片描述符继续使用**来源**questionId/version；解析仍验证角色、资产摘要和尺寸：[paper-office-images.ts:10](D:/WorkProject/EduProject-sidebar/apps/desktop/src/main/education/paper-office-images.ts:10)。实例摘要只绑定当前内容，不能传给原题图片仓库充当来源版本。

10. **精确快照、历史比较及公开读取一起更新。**
    A 当前生成时重读原题：[paper-basket-repository.ts:264](D:/WorkProject/EduProject-sidebar/apps/desktop/src/main/education/paper-basket-repository.ts:264)；PaperRepository当前要求输出内容摘要等于来源版本：[paper-repository.ts:33](D:/WorkProject/EduProject-sidebar/apps/desktop/src/main/education/paper-repository.ts:33)。保留这些旧分支；v2 快照必须保存精确顺序、实例内容及摘要、来源、核对绑定，不能用原题覆盖修改。确认 digest 覆盖全部绑定，整卷仍是不可变新记录。
    `paper-compare.ts`增加实例内容/答案/核对版本差异，不能把同来源修改报告为 unchanged。`PaperCoordinator.review/decide/latest`及旧聊天核题消费者须兼容新视图；`education_read_paper`仍只返回经过脱敏的实际摘要与 sourceCurrent，不新增私有编辑历史或虚假“答案已验证”。[paper-coordinator.ts:44](D:/WorkProject/EduProject-sidebar/apps/desktop/src/main/education/paper-coordinator.ts:44)

11. **导出贯通到安装，禁止绕 Office 审批编辑。**
    用同一宿主实例投影驱动编辑预览、学生/教师卷及答题卡；选项标签读取当前实例，不能继续固定回退 A–D。文字、表格、公式和图片混排必须保持顺序。尽量复用现有 Office draft v2–v6及 figure schema，不因新增实例另造文件引擎。
    保留 `compilePaperOffice → assertPaperOffice` 的确定性重编译比对，以及生产宿主 validate→resolveImages→commit；最终在 `withConfirmedSource`内检查当前实例、核对、来源、整卷digest和现有最新版本门禁，再同步安装。**不得放宽 Office `revise`来绕过本卷编辑协议**：现有服务会保护 paperSource 并重新校验内容。[office-artifact-service.ts:161](D:/WorkProject/EduProject-sidebar/apps/desktop/src/main/xiaozhi-agent/office-artifact-service.ts:161) 图片仍需实际文件审批中的 imagesReviewed，不能用实例核对替代。

12. **实施文件和完成门禁。**
    最小宿主集合为：新增 `shared/paper-instance.ts`；`shared/paper-basket.ts/paper-blueprint.ts`；`paper-basket-{state,repository,source,api}.ts`及实例校验/投影模块；DB迁移和typed IPC/preload；`paper-repository.ts/paper-compare.ts`；`paper-export.ts/paper-rich-export.ts`及必要图片适配。Coordinator/API、production-host和Office服务仅做必要兼容，不重写框架。renderer后续独立切片，保护 A 导航/恢复修复、Composer和vendor。
    必须用真实SQLite验证：两篮同题只改一篮且原题不变；新旧schema与receipt；编辑/换题/恢复/核对CAS与幂等；来源及生成审批失效；冷恢复；未核对禁止交付；图文和答案角色一致。再验证实例变化发生于 Office prepared→install 之间时实际拒绝安装，并实际打开六类文件核对编辑内容、顺序、分值及答案隔离。单测、build或`--check`均不替代该闭环。

本轮稳定源码指纹仍为：shared basket `A1FBE00E…`、basket repository `121DA4F0…`、PaperRepository `EA3E553A…`、rich export `9E24F6AB…`、paper export `766A2558…`。未写文件、执行 Git/build/app/model，也未将合同建议登记为已实现。
