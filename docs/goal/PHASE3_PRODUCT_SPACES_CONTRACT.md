# Phase3 五个教师空间交付合同

日期：2026-10-05。Master Goal SHA：dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302（执行前以实际 readback 为准）。Goal ACTIVE。

## P3-01 / P3-02 本轮切片

将生产入口统一为「问小智 / 我的资料 / 教学内容 / 学生 / 设置」。复用现有 Pi 工作台、HeroUI Pro AppLayout / Sidebar、Hana 设置与本地教育管理页面。切换空间仍保留同一 Pi 组件、会话、草稿与事件订阅；返回重新读取宿主事实，不重复发送。旧技术菜单不进入生产主导航。

|空间|现有真实入口|本轮适配|后续缺口|
|---|---|---|---|
|问小智|PiEducationWorkspace → typed preload → 唯一 Pi host|五空间入口；持续挂载；原会话侧栏与工具过程保留|完整 Golden 验收仍待后续|
|我的资料|knowledge → 本地资料 IPC|资料浏览的传统入口|当前资料页仍有管线/图谱技术布局，需后续重整|
|教学内容|TeacherNotebook / TeachingBook / QuestionNotebook|备课本、讲义、题本真实页面入口|跨会话 Office 产物中心、完整课堂工作室仍待交付|
|学生|Students / Search / Mastery / Intake / Mistakes / Review / Analytics|空间内二级导航；学生/学习记录查找与真实档案操作|DeepTutor 能力在 Phase4 进一步整合|
|设置|PiSettingsWorkspace → 当前模型/权限/技能/归档/备份|相同五空间入口；保存中禁止离开|高级教育管理与隐形飞轮设置后续完善|

本轮仅接受入口、路由与聊天连续性，不能据此接受全部 Phase3 或 Master Goal。明确跳过测试样例书专项及旧模拟数据兼容；不回填任何模拟业务数据。

## 变化范围与安全

- 新增 renderer 产品导航契约与薄布局适配；App 只连接现有页面，不加入新的业务段落。
- 修改 PiWorkspaceShell、PiSettingsWorkspace 与现有 shell UI 验收脚本。扩展已有组件测试中的导航边界。
- 无数据库表、迁移、文件权限、云端上传规则、凭证或 provider 改动；无新依赖。
- 原十六菜单仅显式隔离 legacy-test 保留作历史回归入口。生产主导航不暴露 Memory、Graph、Checkpoint 等技术概念。
- 保护现有全部脏改动；修改前保存本轮涉及源文件及 SHA。失败可从本轮备份逐文件还原，不恢复整个仓库或真实数据目录。
- 日常 out / 数据不重建、不清空；构建及 Electron 验收仅 owned build / 临时 data / 独立 profile。

## 组件调查与复用

HeroUI React Pro / Design Taste 已阅读。官方 Pro 页面不可读取，Pro MCP 传输失败；依据项目授权复用已纳入仓库的 AppLayout / Sidebar 及其 CSS、工具依赖。OSS Button 文档可读取（https://heroui.com/en/docs/react/components/button），采用 onPress / ghost / isIconOnly / Tooltip，核对当前安装版本。finesse 未在当前可用技能目录中发现，不以未读取技能作为证据。没有迁入新的第三方 Runtime。

## 完成定义

1. 启动默认问小智；五空间在实际 Electron 中可点击，选中与窗口前进/后退一致。
2. 我的资料、教学内容、学生进入现有真实本地页面，不用静态 demo 替代。
3. 草稿和同一会话在跨空间返回后保留；真实 DeepSeek 请求在离开工作台后仍能完成，返回正文与宿主状态一致，无第二个 run。
4. 保存中的设置不能通过主导航离开；原设置/聊天侧栏/技能入口仍能工作。
5. 正常 build、renderer 组件门禁、原 shell 真实链路扩展通过；隔离 profile / build 指纹固定，关键本地数据与 cold readback 一致。
6. 1366×768 / 1920×1080、浅色/暗色逐图检查五空间入口、滚动、控件可达。记录每个通过/失败/未验证边界。
7. 更新根四份和 Goal 四份，写明剩余 Phase3 任务与下一步；git diff --check。

## Next

P3-03：资料页移除管线/图谱技术展示，建立跨会话教学产物目录与重新打开入口；其后逐步完善五空间信息架构，再进入 Phase4。任何未真实运行的传统功能均不因本轮导航而标记完成。

## P3-03 实施合同：教师资料与教学文件目录

开始日期：2026-10-05；P3-01/P3-02 closeout 当前源码/构建/报告/截图指纹核验exit0，上一Goal轮为实际进展。当前Master完整2584行已重新阅读，所有脏工作保留。本切片服务M02/M04/M09/M10。

教师可见结果：我的资料直接添加、按名称/格式查找、查看本地已收录摘录、定位原文件；教学内容默认教学文件，列出跨会话真实Office产物、预览当前授权文件、定位文件、回到来源会话。不会把未解析PDF等显示成可检索正文；目录明确最近100项与筛选范围。

|候选|实读能力与约束|决定|
|---|---|---|
|EduDev已有teacher_resources/resource_chunks与document_artifacts|真实typed导入/overview/list/get/show，Pi已保存Office自动发布document_artifacts；原PiWorkspaceFiles有授权目录/版本/取消/本地Office预览|KEEP/ADAPT，薄产品页面复用，唯一数据真源不改|
|Pi1.0.2|唯一生产编排及session工具；没有教师资料数据库管理页面|保编排，不再建Runtime或第二文件宿主|
|DeepTutor本地be1701108a22c1037bb8004322ef6145302cbf5e / Apache2|上游Knowledge Center有上传/连接知识库、正文与Office预览，依赖原Python/Web/知识库存储|Phase4继续能力适配；本切片不搬独立库/Runtime。已查官方KNOWLEDGE_MIGRATION、README、releases|
|OpenMAIC本地636fab0d7edee5e7c2694117c38ece8f623573f9 / MIT|上游存储有material/asset抽象；历史RFC不代表已完成；完整Web/存储域不适合替换现有SQLite|Phase5课堂/内容能力再用；本切片保现有产物来源|
|HeroUI Pro现有ListView/EmptyState与OSS SearchField|官方Pro站点不可读/MCP传输失败；仓库已有组件/API/CSS/util齐全，OSS SearchField官方可读|复用现有合法项目副本与主题，不引新UI库|

官方参考： https://github.com/HKUDS/DeepTutor/blob/main/KNOWLEDGE_MIGRATION.md 、 https://github.com/HKUDS/DeepTutor/releases 、 https://github.com/THU-MAIC/OpenMAIC 、 https://heroui.com/en/docs/react/components/search-field 。不将上游文档当作本地实现完成证据。

变化：product-spaces新增artifacts二级路由并作为教学默认；App仅连接MaterialsWorkspace/TeachingArtifactsWorkspace，原knowledge仅legacy-test；新增薄产品组件与CSS；扩展原Office UI及renderer组件验收。无表/迁移/删除/新权限/新依赖/外部上传/预算/凭证变化。保原传统备课/讲义/题本入口。修改前owned baseline逐文件备份，失败逐文件还原本轮内容，禁止整体reset或日常数据清空。

完成定义：真实当前Electron native chooser导入合成TXT/Markdown，取消/部分失败/读取失败与空/过滤空/重试可操作；SQLite与文件实际readback；真实DeepSeek生成四格式、教师确认后跨会话目录出现、当前文件预览、原文件缺失明确失败、来源会话/重启恢复不重放；1366×768与1920×1080浅暗截图逐张核查；正常build/renderer/本轮Office扩展和原必要回归、git diff --check。正式独立profile与main清单核验，所有测试资料在owned目录，daily out不替换。

边界：资料解析仍只有当前真正实现的本地文本，PDF/Office资料索引适配、资料全量分页与资源删除/编辑另按后续Phase3/4补齐；WPS版式/人工/无VPN/安装/完整Codex体感仍OPEN。列表或预览成功不等于全部教育闭环完成。

## 实际验收与收口

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-01/P3-02仅导航与聊天连续性实现层 A/C 接受；完整 Phase3、Goal、日常、发布、人工仍 NOT_ACCEPTED。旧接口模拟数据不作为新能力真源，跳过测试样例书与旧模拟业务兼容投入。

固定 build5：324 文件，SHA 335e3ffc90b7d88d0bade37a5ad1c1f30d506c3184b235ff774123e433b7e3b6。正常 build/typecheck exit0；renderer 115/115；正式真实 DeepSeek/Pi 工作台18/18、设置39/39，均 exit0/report.success=true/rendererErrors=[]，同一构建与当前脚本 SHA；实际6次独立 userData/sessionData 与main已加载模块核验，未加载旧 test-runtime。最终工作台21 PNG逐张查看，覆盖五空间浅暗双尺寸1366×768/1920×1080、冷恢复；只接受导航、连续性与本轮控件可达/可读，不代表传统页面整体设计已完成。设置专项全部PNG归档，未宣称逐张人工审阅。

### 精确命令（cwd apps/desktop，owned 构建）

```powershell
npm run build -- --outDir test-results/goal/phase3-spaces-20261005/build5
npm run test:renderer-components
$env:OMNI_EDU_TEST_BUILD_ROOT = (Resolve-Path test-results/goal/phase3-spaces-20261005/build5).Path
node scripts/xiaozhi-agent/pi-workspace-shell-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-settings-workspace-ui-smoke.mjs
node test-results/goal/phase3-spaces-20261005/archive-closeout.mjs
# 本轮原教育门禁在build4，非build5重跑
$env:OMNI_EDU_TEST_BUILD_ROOT = (Resolve-Path test-results/goal/phase3-spaces-20261005/build4).Path
npm run test:smoke
# 仓库root
git diff --check
```

最终工作台pi-shell-ui-3K79h8 18/18，设置pi-settings-workspace-ui-rFcZdH39/39；两个独立进程exit0。build5.log、components-final.log、shell-build5.log/.exit、settings-build5.log/.exit与原报告归档；原教育education-final.log suite.ok=true/207，组合命令组exit0但未单独保存原exit。build5仅提升产品危险按钮CSS作用域优先级，教育证据保build4范围。

生产与共享数据契约未改；新增product导航契约/组件/CSS，修改App、PiWorkspaceShell、PiSettingsWorkspace；扩展原renderer组件、工作台与设置验收脚本。修改前baseline只含当时五个涉及文件，不宣称后增修改的设置脚本已备份；source目录为最终事实副本，不能当修改前回滚。

### 首失败及修复

- DRTfFY：11项后找不到学生space内search，原build导航未同步。同步现有脚本与实际build。
- jdHrCu：11项后窗口前进被隐藏Pi Tooltip“问小智”拦截，复用受控Tooltip/visible并关闭隐藏浮层。
- xfezGB：12项后暗色归档对比1.6800，原旧CSS同优先级覆盖背景；产品作用域明确提高优先级后dark7.5229/light5.6434。三首报告/PNG/日志均保留，非三连稳定。
- 归档脚本一次office路径误写xiaozhi-agent，owned复制ENOENT，graph核路径后修复重跑exit0；无生产修改。

### 层级与边界

仅P3导航/连续性实现A/C接受。21最终工作台PNG逐张查看；设置专项其他PNG归档但未逐张review。真实teacher文件/学生记录全部合成且隔离，main实际profile清单6启动；daily out323 SHA0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981未变。资料页旧管线/图谱/数据表仍可见，传统教学/学生页完整重整、Office跨会话产物目录未验收。未替换日常out/清日常库/提交/push/改凭证或网络配置。P3-03：将资料页面改为教师资料管理，移除管线/数据库/图谱技术展示；建立跨会话教学 Office 产物目录与重新打开入口。随后继续完整 Phase3、Phase4 DeepTutor、Phase5 OpenMAIC、Phase6 飞轮、Phase7 加固、Phase8 Golden A–G。


## P3-03 实际验收与下一步（当前生效）

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-03仅教师资料目录与跨会话教学文件目录实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。新接口使用真实本地事实，旧模拟业务兼容和测试样例书专项不再投入。

固定build4：324文件/SHA 52d657eb2cae96eaeee305aca02ef1fe061fe547eb52c80ec92e713ff99a42fe；正常 build/typecheck 实际进程exit0，日志build4.log；renderer123/123 exit0；真实DeepSeek/Pi正式Electron工作台18/18、Office及目录45/45，均exit0/report.success=true/rendererErrors=[]，同一固定build与当前脚本SHA。实际8次独立userData/sessionData与main已加载模块核验，无旧test-runtime；最终38 PNG逐张查看（工作台21、目录/当前预览/冷恢复17），浅暗1366×768/1920×1080，本轮控件可达/可读。目录标题测量light11.65/dark13.07，只表示已测标题，不是全页WCAG证明。原教育隔离legacy-test回归207/207、suite.ok=true、独立exit0，在build2执行；build4只改生产导航归一与清除旧定位提示，main/shared/legacy业务不变，不冒称207在build4重跑或新教育闭环。证据/源码副本/失败报告见 apps/desktop/test-results/goal/phase3-materials-20261005/closeout.json；manifest SHA 278185debf61bf5944a97e91153740a2b7914b57c648c31d13647c42af82d8dd。

教师资料页使用现有 getKnowledgeOverview/importKnowledgeResources/showKnowledgeResource，显示实际资源/摘录和收录状态，已添加不等于已解析。当前仅TXT/Markdown真的收录；PDF/Office/图片仍正文待处理，不伪称可检索。资源最近100份、摘录最近24块、教学文件最近100份；筛选仅当前已载入名称/格式，非全文或全库检索。教学默认artifacts，跨会话目录显示真实保存事实，历史保存内容与当前本地文件预览分开展示；预览仍复用已有会话授权/version校验，定位由main核实际路径/产物ID后发送OS文件夹定位。文件不存在必须失败，不以旧摘要冒充当前内容。外链/图片不在目录Markdown中自动加载。旧knowledge工程页仅legacy-test，备课/讲义/题本入口保留。

首失败全部保留：shell T1ueYn4项后生产导航旧16项白名单漏artifacts，修为生产product mapping、legacy保旧白名单；Office PsSi4q4项后重复点击选择被取消，改Pro ListView replace+disallowEmptySelection，修旧全局CSS对ItemContent的覆盖；sW5Iyi6项后测试h1命中资料Markdown标题，限定teacher-library-heading；6hrK7K29项后原修订版使真实目录5而断言4、DlI2es30项后DOCX两份而断言1，改实际SQLite目录/格式集与原文件名核对；OxxzdW37项后新会话返回AiConversationDetail被误读id，核typed契约改session.id，最终3Z7iHS45通过。没有修改模型输出来迎合断言，不能宣称三次连续稳定。辅助脚本首次CRLF锚点中断、一次PowerShell内联转义失败均已修复，不涉及日常数据。

本轮 npm run test:smoke 内部先执行 npm run build，忽略隔离验收构建env而短暂重建默认out。发现后核历史逐文件SHA，找回全部323文件，先将意外重建版本改名保存在owned/daily-rebuilt，再恢复原out并核总SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981；详见daily-restoration.json。不能说daily out从未变化。未触及用户日常数据/profile、密钥、系统DNS/proxy/VPN；未提交/push。以后需要保留日常out时必须显式owned build +直接 node scripts/electron-smoke.mjs，不能用会隐式重建out的npm wrapper。

### P3-03 精确命令

```powershell
# cwd D:/WorkProject/EduProject/apps/desktop
npm run build -- --outDir test-results/goal/phase3-materials-20261005/build4
npm run test:renderer-components
$env:OMNI_EDU_TEST_BUILD_ROOT = (Resolve-Path test-results/goal/phase3-materials-20261005/build4).Path
node scripts/xiaozhi-agent/pi-workspace-shell-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-office-artifact-ui-smoke.mjs
node test-results/goal/phase3-materials-20261005/archive-closeout.mjs pi-office-artifact-ui-3Z7iHS
node test-results/goal/phase3-materials-20261005/verify-closeout.mjs
# 原207回归当时使用build2：npm run test:smoke（会先重建默认out；已恢复）
# 后续用显式owned build后直接 node scripts/electron-smoke.mjs
# cwd repository
git diff --check
```

最终shell-XrIyFH18、office-3Z7iHS45，独立进程exit0。原207教育回归是本轮build2，不是最终build4重跑；main/shared指纹与前阶段相同。38最终图逐张查看清单在visual-review.json；首失败图另已核查，不冒称所有未列Office历史截图均人工逐张review。所有attempt报告/日志留存。正常build4进程exit0来自实际执行返回，build4.log保存；未补造缺失的build4.exit。源码副本是最终事实，baseline只含修改前五个涉及文件，不能把新文件source当修改前备份。主进程/typed契约/Schema/数据权限/依赖未改。

Next：P3-04：先比较并复用现有本地 Office/PDF 正文读取与导入接缝，补真实资料收录、状态/失败恢复和超过100份的全量目录访问，贯通 typed 主进程与教师页面；随后完成传统备课/讲义/题本及学生页的教师化整理，再进行完整Phase3验收。之后继续Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。禁止恢复第二Agent Loop。


P3-03收口补记：证据复核脚本首次把两个原验收报告的layer标签都写为同一文字，而shell实际含with real DeepSeek后缀；核原报告后按各自精确标签验证，未改原报告。最终verify-closeout exit0：63真实断言、123组件、207原回归、38逐图、8独立启动；git diff --check exit0（仅既有LF/CRLF提示）。完整Goal仍ACTIVE。

## 2026-10-05 P3-04 冻结交付合同：资料正文与全量目录

目标 M01/M04/M10 / Phase3：教师添加 PDF、DOCX、PPTX、XLSX 后可以浏览真实本地正文，失败/取消/重启后可重试；资料目录超过100份仍可分页并按名称/格式在全库查找，正文分页不受旧全局24块限制。保持Pi唯一Loop、原始文件与事实本地、无自动上传。

研究：EduDev已有Hana0.449.0 Apache-2.0 vendored extractDocument、@firecrawl/anydoc0.1.2 MIT、独立document-worker、15秒单文件超时/50MiB输入/1MiB正文上限与slot管理；直接复用。Pi提供编排与工具，但不管理业务资料目录；不新建Agent。DeepTutor本地 be170110（Apache-2.0）的ParseService支持缓存/engine signature与按需读取，整搬需要Python engine环境；OpenMAIC本地636fab0（MIT）的MinerU结果适配偏云/自部署及页面IR。当前薄adapter比新增服务更贴合本机桌面。官方AnyDoc声明本地多格式转换，扫描PDF仍需OCR；不启用hosted OCR。OpenMAIC ETL RFC不是现成完成能力。

来源：https://github.com/firecrawl/anydoc；https://github.com/HKUDS/DeepTutor/blob/main/KNOWLEDGE_MIGRATION.md；https://github.com/THU-MAIC/OpenMAIC/issues/621；https://heroui.com/en/docs/react/components/pagination 。Hana沿已有source-manifest/NOTICE，不改vendor。依赖/许可证/Windows包均沿锁定现有版本，无新依赖或安装下载。

UI：应用HeroUI React Pro/Design Taste，MCP组件查询transport失败，复用项目既有ListView/Markdown/EmptyState、OSS Pagination/Buttons verified compound API；finesse未安装不冒称使用。遵循当前glass语义浅暗颜色、双尺寸、键盘与可达性。

修改范围：新增shared materials v1契约与main assets薄Repository/IPC adapter；OmniEduStore仅Facade与复用原chunk/metadata算法的事务接缝；typed preload；MaterialsWorkspace真实目录分页/单份正文/状态、重试、停止；扩展原组件与工作台Electron suite，禁止另建一轮一smoke。旧getOverview/导入返回结构增量保持。无Schema迁移，无provider/key/预算/原Pi文件授权改变。新增IPC限制主窗口主frame；importPaths只隔离legacy-test fixture。

提交收录：复制后的本地文件作输入，size/hash校验；原生解析在独立进程，不阻塞main。解析成功后原chunk/graph写入和ready状态必须同一SQLite事务；独立事务连接避免普通对话的写入混入。失败保留已保存原件并记录安全原因；不伪造ready、不展示未提交块。取消终止owned worker/逐文件批次；事务提交前复核signal，已提交资料明确保留。进程退出不永久写running，重启失败/待处理可重试；已ready同hash重试不重复chunks。教师校正/旧已确认内容不覆盖。

完整验收：正常build/typecheck、原组件/IPC边界、真实正式Electron从native chooser导入4格式与独立文件/SQLite/hashreadback；损坏/缺失/取消/恢复/二窗口拒绝、>100目录跨页/全库名称筛选、>24单份正文分页、真实Pi取资料引用、冷启动；浅暗1366×768/1920×1080 PNG逐张审阅；原教育关键回归，git diff --check。保存首失败。所有build/test/profile/data归owned phase3-ingestion目录，默认out/profile不动；显式owned build后直接node suite，不执行隐式npm test:smoke wrapper。

完成定义：以上每项实际证据齐全才接受P3-04；完整Phase3、4–8、Golden A–G、人工/日常/无VPN/安装仍未接受。Next：教师化整理传统备课/讲义/题本与学生页面，然后完整Phase3验收。

### P3-04 验收 readback 发现的实际缺口与追加合同

KccQ9H 虽31/31，但SQLite最终assistant明确只读知识库摘录，未读取资料库正文；原断言只查整turn是否有编号太弱，不作为完整正文工具验收。当前工具将知识库资源ID删成标题，资料原件又不在会话授权目录，不能让模型通过路径旁路读取。追加宿主只读 office_list_materials/office_read_material：只用真实SQLite资料目录、已提交正文与版本；严格ID/offset，不接受路径、学生库或任意SQL，复用既有Office教育脱敏和Hana execution-once。必要分段文本经工具按用户任务发送，原件/整库不上传，收录不等于教师确认。Pi新增独立version1能力marker，位于既有snapshot/fingerprint之后，原JSONL与创建身份不改，冷恢复校验marker且只注册两固定工具。原shell正式suite加强：必须成功正文工具回执、持久最终assistant引用编号/真实资料标题，失败记录保留。扩展原Office boundary检查参数、停/失效、脱敏、真实SDK旧会话增量与撤回/未知版本拒绝，不新增运行时/依赖/单轮专项套件。随后新owned build、正式suite、207回归与证据收口。


## P3-04 实际验收与下一步（当前生效）

Goal ACTIVE；Current Phase：Phase3 Five Product Spaces DOING。P3-04仅资料收录、全量目录与正文工具实现层 A/C 接受；完整Phase3、Goal、日常、发布与人工仍 NOT_ACCEPTED。以下为当前生效状态，后文各轮记录保留历史范围。新接口只取真实本地事实，旧模拟业务兼容与测试样例书专项不再投入，不自动补回演示种子。

实现：复用Hana0.449.0 Apache-2.0 extractDocument、既有AnyDoc0.1.2 MIT/native Windows与document-worker。新增materials v1共享契约、主窗口主frame限定typed IPC、SQLite资料Repository、原chunk/graph算法的独立连接短事务；正文与ready状态原子提交，hash/size/托管目录校验，取消终止实际worker，失败保存原件，重启可重试，同hash ready重试不重复块。全库名称/格式目录50项分页，单份正文10块分页，替代资料页旧最近100份/全局24块限制；外链/图片不自动加载，加载回执到达前旧行与分页不可交互。

Pi工具：office_list_materials与office_read_material从同一SQLite事实按ID/offset只读已提交正文，严格拒绝路径/额外参数/学生库/任意SQL，按当前run及AbortSignal校验，复用Office教育脱敏和Hana execution-once。正文工具一次一块、最多12000字符，返回真实版本、段落来源、nextOffset；teacherConfirmed=false、originalPageLocated=false，不冒称教师确认或原页码。xiaozhi.education.material-read.v1独立marker位于既有snapshot/fingerprint之后，原native JSONL与创建身份不重写，未知/缺失能力拒绝。真实DeepSeek持久最终回答与成功“读取资料库正文”回执均已核验，不用检索摘录冒充全文。

Evidence：固定build9，323文件/SHA 52d6321cd1b974c26ae4ce8c06459bb157744a1660851d54475893780e193f9e；正常build/typecheck exit0，renderer129/129、资料/Office工具边界12/12、真实DeepSeek正式Electron工作台31/31、原教育隔离legacy-test回归207/207，均独立exit0。31项report.success=true/rendererErrors=[]，四次实际独立profile启动、当前构建/脚本指纹与main已加载模块核验；207本轮确实在最终build9重跑，不能作为新教育黄金闭环。37最终PNG归档，其中21张逐张视觉审阅，覆盖本轮资料空/正文/失败/冷恢复及正文工具浅暗1366×768/1920×1080；其他16张只归档。本轮控件可达/可读，不宣称全部Codex像素一致或全页WCAG。归档：apps/desktop/test-results/goal/phase3-ingestion-20261005/closeout.json，SHA 36d6820c3685aef39c4c6b6f85a38efbb1ab11ef7f1d513b29b09d1ae7238585；精确命令与失败见PHASE3_PRODUCT_SPACES_CONTRACT。

Failed（全部留存）：PrB89J 0项后因Repository在dataRoot赋值前初始化，移到constructor；LwD9Tx 18项后PDF自然换行使证据编号断言误报，仅规范断言空白；2Q5uin 20项后误用聊天零溢出断言检查传统页，改实际产品控件几何，同时修轮询query闭包；cUgoPK 21项后分页数字先于数据回执、旧行仍可点，生产隐藏旧行/禁用翻页并核已接收offset；P3gEz1 29项后实际正文调用成功但新工具公开标签仍泛化，修生产projection中文标签。KccQ9H虽31项通过，SQLite最终assistant暴露只读检索摘录、未读资料正文，作为不足断言留档，不接受；追加上述两工具并强化持久最终回答+实际成功正文工具断言，最终Ab1CP5 31通过。未修改模型输出来迎合测试，不宣称三次连续稳定。

边界：PDF只接受已验证文本层路径，扫描OCR未完成；旧doc/xls/ppt不支持。目录查找按全库名称/格式，不是资料全文搜索；Unicode归一仅查询侧，SQLite lower不承诺全Unicode等价。原生选择单批50文件、既有15秒/50MiB输入/1MiB解析输出均为工具边界，不是运行预算。资料收录不等于教师确认；失败保留旧已提交派生正文且不伪称ready。教学Office产物目录仍最近100份，完整分页待后续合同。日常安装、无VPN、WPS版式、人工、全Codex体感、安全/许可、完整教育Golden均OPEN；未以隔离验收替换日常out。

Last verified commit：90d67381a08db8ba040211921288b55c87de3f55。本轮开始HEAD为20aa86656cdb5a0f85e0e11fa21863b50233fcb1，执行中观察到外部提交推进，保留其内容；本Agent未提交或push。Master2584行/SHA dbc1619f5a0390a150b4b8940cbc0e2147623920ae2815c34a2b353860f41302保持。daily out323文件/SHA 0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981本轮未变；P3-03曾意外重建并精确恢复的历史保留。没有新Schema/依赖/vendor/密钥/供应商/系统DNS、proxy、VPN变更，没有清空日常数据。

### P3-04 精确命令

```powershell
# cwd D:/WorkProject/EduProject/apps/desktop
npm run build -- --outDir test-results/goal/phase3-ingestion-20261005/build9
npm run test:renderer-components
$env:OMNI_EDU_TEST_BUILD_ROOT = (Resolve-Path test-results/goal/phase3-ingestion-20261005/build9).Path
node scripts/xiaozhi-agent/pi-workspace-shell-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-office-document-boundary-smoke.mjs
node scripts/electron-smoke.mjs
node test-results/goal/phase3-ingestion-20261005/archive-closeout.mjs
node test-results/goal/phase3-ingestion-20261005/verify-closeout.mjs
# cwd repository
git diff --check
```

最终原report Ab1CP5/workspace31与V41HpU/boundary12；build9.log/.exit、components-last.log/.exit、shell7.log/.exit、material-tools-boundary.log/.exit、education3.log/.exit均保存独立实际exit0。education207报告在education3.log的JSON，而非不存在的独立report路径。正文最终readback/资料SQLite事实回执归档为公开JSON；native私有JSONL、DB、profile、密钥不复制进公共证据目录。source为最终事实副本，before与before-tool-completion才是对应修改前备份。

Next：P3-05，整理传统备课、讲义、题本与学生页面的教师操作体验，盘点实际 typed 入口、业务事实和失败状态，先冻结增量合同，再逐切片实现与验收；随后完整Phase3验收，再Phase4 DeepTutor教育能力、Phase5 OpenMAIC互动课、Phase6飞轮、Phase7加固、Phase8 Golden A–G。Pi保持唯一生产编排。


收口复核：verify-closeout实际exit0，核186个源码/归档/日志/截图指纹及14份当前文档；git diff --check实际exit0，仅现有LF/CRLF提示。首次verifier把分页阶段121误当作所有测试结束后的目录总数；取消/冷恢复各增加一份，最终readback为123份。保留verification-first.log/.exit，按真实阶段分别核121分页与123最终事实；未改变生产代码、正式报告或manifest。

## 2026-10-05 P3-05 冻结合同与第一切片：教师备课本

前轮分类为progress：P3-04实际实现与验收完成、14当前文档更新。本轮重新核旧closeout exit0后推进P3-05；完整Goal/Phase3仍DOING。Master完整主线与root4/Goal4当前基线已恢复，保护当前脏工作，不提交/push。

目标M01/M09/M10：传统备课、讲义、题本与学生页面逐项教师化，既有业务能力保留，旧模拟种子不恢复。第一切片备课本：教师可真实创建/查找/修改备课本、编辑笔记、取消、删除后恢复备课本；切换时不把旧笔记草稿写入另一本，加载失败可刷新且不显示过期内容，冷恢复状态一致。讲义/题本/学生页面与教学文件全量分页仍后续切片，不用本切片冒称P3-05全部完成。

复用对比：EduDev已有完整TeacherNotebook typed IPC/SQLite版本校验/可恢复删除，直接KEEP；Pi1.0.2提供唯一编排，不管理教师目录，不新建Agent；DeepTutor本地be170110 Apache-2.0（已有workflows脏改保留）、OpenMAIC636fab0 MIT（当前clean）的阅读/内容工作区可参考，但整搬引入独立Web/存储/Runtime，后续Phase4/5再适配。已查官方当前README。HeroUI Pro官网可读，MCP list_components本轮transport发送失败；直接复用当前授权项目的ListView/Markdown/EmptyState/CSS/utils与OSS Button/SearchField/TextField等API，HeroUIReactPro/DesignTaste沿用，finesse未发现不冒称应用。无需新依赖、Schema/迁移、目录/文件权限、外部上传或provider变更。

来源：https://heroui.pro/；https://heroui.com/en/docs/react/components/search-field；https://github.com/HKUDS/DeepTutor/blob/main/README.md；https://github.com/THU-MAIC/OpenMAIC/blob/main/README.md。已有组件与其依赖许可证/NOTICE保持，不抓取受限Pro源码，不将官方文档当实际本地验收。

修改：TeacherNotebookWorkspace只整理当前领域边界；新增薄teacher-notebook.css（复用当前pi语义颜色与teacher-library控件/ListView样式），不扩大App.tsx。原版本字段/删除状态/typed接口保持，仅界面中文表达；加载request epoch、切换清编辑草稿、saving锁与失败回执。原shell正式suite增加教师真实操作、readback/冷恢复、失败与慢响应覆盖；原renderer组件与207回归复用，不增加一需求一smoke。

验收：owned build/typecheck、组件、真实正式Pi Electron页面操作/本地SQLite readback与cold；浅暗1366×768/1920×1080备课本空/编辑/失败/恢复截图逐图验收，保存全部首失败；原教育207显式隔离回归、git diff --check。所有合成数据/profile/build归owned验收目录，daily out不变。旧API与原入口保留，源码修改前逐文件备份，失败只还原本轮涉及差异，无整库reset。

完成定义：第一切片所有证据通过才接受P3-05a；随后P3-05b讲义、P3-05c题本、P3-05d学生与全量教学文件，最后完整Phase3。此合同不修改Master、预算、权限、隐私或教师事实。


## DT-02图审新发现（仍属Phase3欠项）

2026-10-05，education-journey-op57MO最终8图实际查看：新学生来源面板/问小智入口双主题双尺寸可读可达；深色已归档学生行原背景/文字对比度偏低，部分公开过程偶发英文；队列真实流式鼠标编辑/保存连续移动超时，最终键盘16通过不替代鼠标验收。均保留体验收尾OPEN，不改用户指定布局或把完整Phase3记接受。
