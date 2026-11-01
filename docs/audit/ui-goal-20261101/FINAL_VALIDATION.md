# UI Goal 验证汇总

2026-11-01。最新合入为 `63e3acf0c936865fe7cd34c7884a4aadad0c7d45`，实际Git parents及142文件差异见下；父任务新主线build待结果；新源码artifact-check 9/9、backup-restore 8/8 smoke已exit0。已验bf167批次的build/TSC、renderer240、replay/cards各6项、完整legacy补验exit0及无模型归档2BZXtR 6/6均限定接受；**bf167不是最终整包，旧设置/legacy不覆盖新DataBackupPanel或新增backup restore能力**。

最终编译/240、新构建指纹及预先声明的一次同prompt MIS实际流/A评分仍待父任务补录，不挑最优、不升级旧运行标签。QA-only14项通过（6+6+2），不并入业务计数；原29项、8项及其他失败保持原样。compat接受exit1复制authority边界、非生产缺陷。工程交付、质量、教师接受与ChatGPT parity分别报告；根文档等最终compile/MIS结果后再最小追加，保留已合入他人内容。

## 最终结果摘要（待父任务补齐）

| 项目 | 最终记录 | 已知范围 / 限制 |
| --- | --- | --- |
| 最终source / main交付 | 已合入63e3acf0；正常推送核对待补 | 实际父提交f51efac8 / 331cb538，142文件差异，不再以旧0082的61/14文件快照代表此次合入 |
| 最终build / main / renderer / sourceTree | 待新指纹文件 | 当前已验bf167db0 / main744902f1 / index-CoygKxo3.js，455文件；旧批次只作基线 |
| 最终编译 / renderer240 | build结果待补，240待最终结果 | 只登记63e3acf0合入后门禁；bf167已有build/TSC及240通过，不重标为新构建 |
| 新源码相关边界 | artifact-check 9/9、backup-restore 8/8，均exit0 | 63e3acf0源码上的owned OS-temp真实SQLite/文件受控fixture smoke；不称模型链路、renderer实际流程或完整AT，不与QA14/业务计数合并 |
| 预先声明同prompt MIS一次真实流 | 待实际结果及A评分 | 不挑最优、不覆盖旧样本，工程运行、科学质量与教师接受分别记录 |
| archive-only / legacy补验 | legacy完整补验exit0；2BZXtR归档6/6、exit0 | legacy命令node scripts/electron-smoke.mjs，bf167批次修QA实际Disclosure click后全程通过，不称生产修复；旧hidden exit1及5iqviG 1pass/exit1保留，63e3acf0合入后新构建另列；不合并原29/8项失败为整套设置通过 |
| compat | eBPbd2：整体exit1/incomplete，边界结论接受 | 3项先行通过，复制库grant/legacyworkspace为0，2项blocking不伪造授权；非生产缺陷，ordinary Office2项仅信息 |
| 质量 / 教师 / ChatGPT parity | 尚未完成 | 保留旧质量未通过结论；已有参考运行相观察不等于完整交接或1:1 |

## 命令、退出码与构建范围

以下列已确认命令或可查脚本入口；“入口”不冒称已确认本轮全部CLI参数/环境。进程退出码由父任务提供；本docs worker只读已有报告、日志及哈希，不运行新审计。

| 检查 / 命令或报告入口 | 实际结果 / exit | 构建与接受范围 |
| --- | --- | --- |
| `npm.cmd run build`；[build-integrated-delivery.log](../../../apps/desktop/test-results/ui-goal-20261101/build-integrated-delivery.log) | exit 0；脚本含TSC `tsc --noEmit` | ce5cd373 / bf167db0，工程门禁 |
| `node scripts/xiaozhi-agent/artifact-check-smoke.mjs`；[artifact-check-main-final.log](../../../apps/desktop/test-results/ui-goal-20261101/artifact-check-main-final.log) | 已读ok:true、9checks；父任务报告exit0 | 最新63e3acf0源码边界smoke：原candidate receipt/选中版本、同路径多版本隔离、文件变化/owner撤销/取消等；真实OS-temp SQLite/files受控fixture，非完整AT |
| `node scripts/xiaozhi-agent/backup-restore-smoke.mjs`；[backup-restore-main-final.log](../../../apps/desktop/test-results/ui-goal-20261101/backup-restore-main-final.log) | 已读ok:true、8checks；父任务报告exit0 | 最新63e3acf0源码，owned OS-temp真实SQLite/files与受控fixture，覆盖副本/选择恢复、篡改/目录边界/空间失败/activation身份；非模型调用或DataBackupPanel真实UI全流程；日志含SQLite experimental warning，不称零警告 |
| Renderer入口 `npm.cmd run test:renderer-components` → `scripts/renderer-component-state-test.mjs`；[renderer-integrated-delivery.log](../../../apps/desktop/test-results/ui-goal-20261101/renderer-integrated-delivery.log) | 240/240、exit 0 | bf167db0；保存日志未见Vite警告，不推断runtime 0console |
| [公开replay qtKruK](../../../apps/desktop/test-results/ui-goal-20261101/public-replay/run-qtKruK/report.json)；脚本入口 `scripts/ui-goal-public-replay.mjs` | 6/6、exit 0 | bf167db0；冷读正文/过程折叠及真实legacy visible-hash受控导出/SQLite文件读回、源不变，0新run/command/event/model request；非手动原生目录选择 |
| [Target cards pJufg4](../../../apps/desktop/test-results/ui-goal-20261101/targeted-cards/run-pJufg4/report.json)；脚本入口 `scripts/ui-goal-targeted-cards-live.mjs` | 6/6、exit 0 | bf167db0；请求中性计数/真实receipt、双尺寸键盘及教师DB汇总/后置诊断；无新模型/聊天/学习记录，consoleErrors为空 |
| 设置入口 `scripts/xiaozhi-agent/pi-settings-workspace-ui-smoke.mjs`；[settings-color-reader-integrated.log](../../../apps/desktop/test-results/ui-goal-20261101/settings-color-reader-integrated.log) | 0FGfz0：29pass后历史selector TimeoutError，`success:false`，精确exit未单列 | bf167db0；完整设置仍未通过，QA需先开workbench-manage-history modal再定位历史行；生产ce5未变，continuation结果待补 |
| QA颜色reader入口 `scripts/xiaozhi-agent/settings-background-evidence-test.mjs` / `settings-background-evidence.mjs` | 父任务确认独立6/6通过，未据此额外启动复审 | canvas合成RGB及raw/alpha/ancestor CSSOM元数据，sum>500/4.5不变；settings-color-reader-integrated.log实际是0FGfz0完整设置29项及超时，不能误标为unit6报告 |
| Chrome锚点入口 `scripts/xiaozhi-agent/workspace-chrome-anchors-test.mjs`；[workspace-chrome-anchors-final.log](../../../apps/desktop/test-results/ui-goal-20261101/workspace-chrome-anchors-final.log) | 已读日志6/6、fail 0；父任务报告exit 0 | QA header/input锚点边界检查；不替代无模型archive-only实际续验，不与旧gubq7n的8项累加 |
| QA transition入口 `node scripts/xiaozhi-agent/workspace-transition-settle-test.mjs`；[workspace-transition-settle-final.log](../../../apps/desktop/test-results/ui-goal-20261101/workspace-transition-settle-final.log) | 已读2/2、fail0；父任务报告exit0 | 可见窗口有限transition自然完成、不修改无限动画；仅显式hidden snapshot可完成有限动画。QA-only合计14=background6+anchors6+transition2，不算14项业务通过 |
| 不存在的 `capture-workspace-metrics-test.mjs` 调用 | exit 1，未执行任何测试 | 命令错误，不计功能失败、不冒称unit结果；真实文件为workspace-chrome-anchors-test.mjs |
| `node scripts/ui-goal-classroom-compatibility.mjs --run-after-settings`；[eBPbd2报告](../../../apps/desktop/test-results/ui-goal-20261101/classroom-compatibility/run-eBPbd2/report.json)，日志 `classroom-compatibility-integrated.log` | 3项通过、整轮exit 1，`incomplete_compatibility_boundary` | bf167db0跨构建只读兼容：首开/冷启三页ready课堂及确认/保存实际UI、PPTX hash/CRC、sources 1；绝对receipt authority不改写的2项blocking为已接受的复制环境限制（grant=0/legacyworkspace=0，review会拒，不调用/伪造）；非生产缺陷，ordinary Office schema排除2项仅信息；exit 1/incomplete保持，compat边界结论限定冻结 |
| `node scripts/electron-smoke.mjs`；[legacy-diagnostics-followup.log](../../../apps/desktop/test-results/ui-goal-20261101/legacy-diagnostics-followup.log) | 完整实际运行exit0（父任务提供） | bf167db0；QA先真实点击Disclosure打开诊断后继续全程成功，关闭本例旧hidden入口QA缺口；不称生产修复、不升级为0082合入后整包验证，原exit1不改 |
| `node scripts/electron-smoke.mjs`；[legacy-integrated-delivery.log](../../../apps/desktop/test-results/ui-goal-20261101/legacy-integrated-delivery.log) | exit 1；第1460行隐藏元素waitFor超时 | ce5/bf167db0；实际为getByTestId(ai-observability-workspace)存在但hidden，等待visible 30秒失败；不是此前猜测的mastery_quiz。A已修补折叠入口QA，父任务legacy-diagnostics-followup完整补验已exit0；只关闭本例QA导航缺口，不把原失败改绿或归入旧mastery_quiz |
| 无模型archive-only `2BZXtR`；[settings-archive-settled-final.log](../../../apps/desktop/test-results/ui-goal-20261101/settings-archive-settled-final.log) | 已读success:true、6/6；父任务报告exit0 | bf167批次，0model；U2管理历史、focus trap/Escape取消、实际归档/冷启/native字节不变等通过。只接受此补验，不与原29项及8项整轮失败累加，不覆盖新DataBackupPanel |
| 无模型archive-only `5iqviG`（父任务报告） | 1pass、exit 1 | 首项contrast采样opacity 0、ratio 1，失败保留；原gubq7n已测三项约4.83/5.11/10.42通过，两个运行不互相覆盖。Pasteur仅补QA真实有限portal settle，原阈值/生产不变；最终archive-only结果待补 |
| 设置targeted `gubq7n`（父任务报告，补验入口待返回） | 8pass、exit 1，不与0FGfz0的29项累加 | 三项归档对比度约4.83/5.11/10.42通过；旧assertWorkspaceChrome的header/input空锚点导致后续失败。QA修正后的无模型archive-only实际补验待结果，无新增生产修改 |
| [Bcpic7实际模型HTML](../../../apps/desktop/test-results/ui-goal-20261101/chat-html-functional/run-Bcpic7/report.json)；入口 `scripts/ui-goal-chat-live.mjs` 及opt-in helper `scripts/acceptance/chat-markdown-disclosure.mjs` | 7/7、exit 0 | **集成前50a9398a**；自定义promptOverride，完成/冷启同raw final官方Card/键盘/无原生details-summary；一次practice功能任务，非配对质量benchmark |
| Markdown入口 `scripts/office-markdown-disclosure-test.mjs`（日志/exit未单列） | 父任务报告29项通过；RangeError/A2状态问题关闭 | 425ecff至ce5源码一致性证明见下节；不等于最终whole build重跑raw7 |
| `node scripts/ui-goal-paper-review-followup.mjs --run-paid`；[oNlwq9报告](../../../apps/desktop/test-results/ui-goal-paper-9G2OGc/pi-review-followup-oNlwq9/report.json) | 4/4、exit 0 | **集成前D1rEGGdx**；同prompt/20题、独立教师确认/模型读回、原事实/六文件不变，原29项整轮仍exit 1 |
| [U6 QleUZj](../../../apps/desktop/test-results/ui-goal-20261101/classroom-live/run-QleUZj/report.json)；脚本入口 `scripts/ui-goal-classroom-live.mjs` | 7/7、exit 0 | **集成前D1rEGGdx**；PPTX读回与冷启零重放/零学生事实写入；科学质量待A评分 |
| `npm audit` | 45项：8 high、29 moderate、8 low，exit 1，数量未变 | 非清零；未独立认定归属/可利用性 |

## 交付前风险与保护

- 父任务通报该轮settings/归档旧CLI忽略 `--check` 并误入actual，**该轮不是只读/仅预检**；现已修复未知参数拒绝。此处不重解释不同脚本（例如PiPaperReview）的既有预检证据。本docs worker未启动actual；父任务显式无模型archive-only最新2BZXtR已6/6、exit0，旧5iqviG 1pass/exit1保留，不重跑已接受29项及模型调用。
- 2BZXtR归档6/6及bf167完整legacy补验exit0已限定接受，compat复制边界结论已接受；0FGfz0历史selector、gubq7n旧chrome锚点、legacy隐藏workspace超时及BAGFV6失败均保留。eBPbd2为复制authority环境边界、不算生产缺陷，整体仍exit 1，不判定未证实的生产丢功能；reader修正不降低亮度/4.5门槛。生产源码ce5已冻结，不因QA修复要求新增生产改动。
- 旧Paper/U6、raw7及旧截图保持原构建范围；incoming改变OfficeReplySources、host journal与Office artifacts，不能称同backend或最终整包功能全通过。新集成replay/cards已独立通过，但不替代学科质量与全部业务。
- 人类视觉/使用验收、旧质量失败的修复后复评及ChatGPT parity均未完成；最新参考画面被Python网络授权/Docker错误弹窗遮挡，无法完整观察，早先无遮挡运行相观察仍保留；63e3acf0合入后的main非强制HEAD:main推送/远端一致性及文档交付尚待父任务证据，不移动其他main工作树、不强推或丢弃他人功能。
- 父任务最新复核97项保护文件原始字节/Git blob全不变、exit 0；canonical D三份脏文档hash/size仍与before一致，diff --check为0。保留原清单范围，本worker未新增审计。无root/global/vendor/Composer改动；四份根协作文档等最终结果后再追加指针，1.Agent无新规则不写。

## 最新合入边界（新编译结果待补）

本worker只读核对Git对象：merge commit `63e3acf0c936865fe7cd34c7884a4aadad0c7d45` 的父提交为 `f51efac818bd44118a57429aa4a646234d751bf7` 与 `331cb53822b7b64f684a6b968e6a4dfbcf4f311f`；相对第一父提交为**142 files changed，3652 insertions、117 deletions**。共享仓库fetch已推进，不能仅用此前0082f2b的61文件/14生产统计描述本次合入。

incoming包括KB region/crop质量与backup restore消费者，具体有 `apps/desktop/src/renderer/components/DataBackupPanel.tsx`、`src/main/backup/*`、`shared/backup-restore.ts` 等。父任务当前新主线build结果待补；artifact-check9/backup-restore8已在新源码执行smoke通过，范围如上，不等于新增DataBackupPanel实际UI或完整AT。父任务确认main新功能均保留、无新增native details，该源码结论不替代未完成的最终构建/运行验收。bf167上的设置/归档及legacy只证明旧批次，不能验收新增备份恢复能力。根协作文档已合入他人新增内容（8/16/12/8行），本worker暂不写入，等最终compile/MIS结果后再读当前文件并最小追加自身指针。

## 已验bf167批次及源码证据

已读取[集成指纹](../../../apps/desktop/test-results/ui-goal-20261101/integrated-delivery-build.json)，包含完整455文件清单及sourceTree：

| 字段 | 记录 |
| --- | --- |
| sourceCommit | `ce5cd37399503dda800cda02e2a2cb28a71ad76a` |
| sourceTree | `23d1c24146c8913128c7f9aac42ba697fec0e47c` |
| build SHA-256 | `bf167db0fb26ce23114301b3ac9eec34a88056a5904adeb9564aa8f93a017889` |
| main SHA-256 | `744902f1c89d9dc43b953aff1fc489b3c697030913c160a359ac8f4c43a7e997` |
| renderer | `renderer/assets/index-CoygKxo3.js` |
| 构建/TSC | 父任务执行 `npm.cmd run build`，exit 0；已读[build-integrated-delivery.log](../../../apps/desktop/test-results/ui-goal-20261101/build-integrated-delivery.log)，脚本包含 `tsc --noEmit` |
| renderer检查 | 已读[renderer-integrated-delivery.log](../../../apps/desktop/test-results/ui-goal-20261101/renderer-integrated-delivery.log)，240/240；父任务报告exit 0。该保存日志仅有分组JSON汇总，未见Vite/WebSocket警告，不据此声明运行时0console |

此节仅为已验ce5/bf167批次；最新63e3acf0已合入额外142文件，不能把本节旧工程/运行记录称为最终整包。QA颜色reader修正不改变生产构建。新集成qtKruK与pJufg4均6/6、exit 0，compat已接受exit 1复制环境边界；无模型归档2BZXtR已6/6、exit0，legacy折叠入口QA真实点击后完整补验exit0，原报告exit1保留；main推送尚未提供完成证据。

incoming含OfficeReplySources、host journal及Office artifacts，main指纹已改变。旧Paper/U6明确为D1rEGGdx集成前证据，rawHTML7及PMeI5w/RzTbcE为50a9398a集成前证据；不称同backend或最终整包复跑。

## Markdown源码差异核对（只读，不替代最终功能复跑）

本docs worker已只读核对当前HEAD为 `ce5cd37399503dda800cda02e2a2cb28a71ad76a`。以下两份Markdown源码及29项测试文件，`git show 425ecff:<path>` 与当前HEAD字节一致；working tree在LF归一化后亦一致，未运行测试/模型。SHA-256列为Git内容字节口径，**不是working tree原始字节哈希**：

| 文件 | 当前Git blob | Git内容SHA-256 |
| --- | --- | --- |
| `apps/desktop/src/renderer/components/office/OfficeMarkdown.tsx` | `d4a8a52264c3d0eea3e3b547e1dcfe851d921d91` | `666cd1d333469198b4feb270d4f69eee10a90aed828932970f1e703bee06bab9` |
| `apps/desktop/src/renderer/components/office/OfficeMarkdownDisclosure.tsx` | `a17f699482ca4fb10c95a0f83ad727489c04f5ab` | `897505cc1dc00480c156f4c35b23b0fbc8baaccd3b7f7a77dd3a25ac076cebd1` |
| `apps/desktop/scripts/office-markdown-disclosure-test.mjs` | `17559e1acaaba028a7df6480161f7b4dbb481888` | `433d62f184e58631d72b8decbc63356d2c9c670a186e673afd40f5e850dbd235` |

working tree原始SHA-256分别为 `f308a852f86193f3a54865a4406563f49bc9092b999d991c880b078d227a349b`、`897505cc1dc00480c156f4c35b23b0fbc8baaccd3b7f7a77dd3a25ac076cebd1`、`1e6d81f9b5de0fecb56b7b55b34af62b4d71a7f59661632e1f59576ef7a14c93`，行尾口径分开保存。父任务最新复核确认97项Composer/vendor保护文件原始字节及Git blob全不变、exit 0；canonical三文件hash/size仍true、diff --check 0，保留原清单/复核范围，本worker未重跑97项。

**Bcpic7的7项实际rawHTML功能验证仍只属50a9398a，未在当前whole build重跑。** 两个Markdown消费者及测试源码相同支持限定的源码连续性说明；incoming新增OfficeReplySources/宿主等消费者环境变化，不能由三文件相同推定整包运行等价。

## 实际报告明细（历史失败保持原样）

| 验证 | 当前状态与边界 |
| --- | --- |
| 正式 Disclosure `run-CrlGzr` | 已读取[原始报告](../../../apps/desktop/test-results/ui-goal-20261101/disclosure-live/run-CrlGzr/report.json)：100 checks 中 98 pass、2 fail，`screens` 实际保存 114 条，控制台错误 0，`success:false`。两项 reduced-motion 断言已诊断为误报：有效样式为 `transition:none`。现已由 `run-37Mnx2` 的正式复测关闭该误报事项；原始失败报告保持冻结，不改写历史结果。 |
| 历史冻结构建 Disclosure `run-37Mnx2` | 已读取[AFTER 报告](../../../apps/desktop/test-results/ui-goal-20261101/disclosure-live/run-37Mnx2/report.json)：`success:true`，100/100 checks 通过，errors 0、consoleErrors 0，保存 112 张截图；父任务报告 exit 0，对应历史 `1042579` 冻结源码，不代表当前最新源码。**范围为独立空数据环境的应用路由/空态与 Disclosure 交互样式，不是全部非空业务通过**；`humanAccepted:false`，不代表教师视觉接受。 |
| 真实聊天 `realchat-tkpj` | 仅完成 1 check；U1 focus/setup 失败，本次不接受。未形成真实对话质量或完整交互链路的通过证据。 |
| 历史真实聊天 `run-PR0X9n` | [原始报告](../../../apps/desktop/test-results/ui-goal-20261101/chat-live/run-PR0X9n/report.json)仍为 `success:false`、1 check 通过，控制台错误 0；父任务确认 focus/handoff 已通过，该次失败为首次真实工具前缺少显式公开说明（`requested explicit public commentary must precede the first real tool`）。历史失败保留，不抹除；修复后的默认/误区场景见下文，不将旧 focus 失败照搬为该次根因。 |
| 真实默认聊天 `run-bpn5HD` | 已读取[报告](../../../apps/desktop/test-results/ui-goal-20261101/chat-live/run-bpn5HD/report.json)：`success:true`，6/6 checks 通过，控制台错误 0，使用 `1042579` 构建；限该真实场景，不外推所有聊天任务或 ChatGPT parity。 |
| 真实误区聊天 `run-kias9P` | 已读取[报告](../../../apps/desktop/test-results/ui-goal-20261101/chat-live-misconception/run-kias9P/report.json)：`success:true`，5/5 checks 通过，控制台错误 0，使用相同 `1042579` 构建。 |
| 历史真实 practice 聊天 `run-2zcEMX` | 已读取[失败报告](../../../apps/desktop/test-results/ui-goal-20261101/chat-live-practice/run-2zcEMX/report.json)：`success:false`，仅 1 check 通过，控制台错误 0。父任务确认模型已完成；失败为测试获取工具触发器焦点时 DOM detached 竞态，`locator.focus` 超时 30 秒。不能判为模型未完成，也不能据模型结束将原整轮记为通过；E 的 QA fast-focus 修复 13 项通过、exit 0，旧焦点竞态现由下述 `run-6uAm9e` 实际复测关闭，原失败报告保留。 |
| 修复后真实误区聊天 `run-hJO4Iy` | 已读取[报告](../../../apps/desktop/test-results/ui-goal-20261101/chat-live-misconception/run-hJO4Iy/report.json)：`success:true`，5/5 checks 通过，控制台错误 0；父任务报告 exit 0，使用 `85eae35`。覆盖真实附件、绑定 run/公开过程/正文/工具详情、双尺寸截图、冷启动保留与零模型重放；该回答的公开质量已有审查，整体未通过，详见下文。 |
| 修复后真实 practice 聊天 `run-6uAm9e` | 已读取[报告](../../../apps/desktop/test-results/ui-goal-20261101/chat-live-practice/run-6uAm9e/report.json)：`success:true`，5/5 checks 通过，控制台错误 0；父任务报告 exit 0，使用 `85eae35`。原 composer/focus 场景复测通过，关闭旧 detached 竞态事项；公开内容质量及 provider DSML 结束标签泄漏仍待单独修复/验收，不宣称 U1 全部完成。 |
| 真实 U4 `ui-goal-paper-9G2OGc` | 已读取[原报告](../../../apps/desktop/test-results/ui-goal-paper-9G2OGc/ui-goal-report.json)：`success:false`、29/29 已记录 checks 通过、renderer/console errors 均 0，父任务确认整轮 exit 1。六类真实 Word/PDF 交付及独立 readback、拒绝、来源失效、停止、冷启动、较新确认阻断旧卷导出均已通过；失败仅在附加 PiPaperReview 入口，组卷工具遭 task admission 拒绝，未生成 pending review，runner 第155行超时180秒。原失败保留，不能将前项通过数当整轮成功；[领域准入根因与定向补验](PAPER_ADMISSION_FINDINGS.md)另列。 |
| PiPaperReview 真实定向补验 `pi-review-followup-oNlwq9` | 已读取[新报告](../../../apps/desktop/test-results/ui-goal-paper-9G2OGc/pi-review-followup-oNlwq9/report.json)：`success:true`、4/4 checks通过，父任务报告exit 0，`humanAccepted:false`。同原prompt、同20题，实际Pi pending review等待独立教师操作，确认持久化且模型实际调用 `education_read_paper` 成功；原题库事实、旧确认、六文件不变，一个command/run且无导出重放。`originalSuccess:false`、`originalReportUnchanged:true`，原29项报告SHA保持 `60896baa6de3b4248b0a3bc5e00d9a25a9349b0582612c1f3ed6a8db2e0dff32`。**仅关闭本例实际PiReview缺口**，不改原失败、不外推内容质量或全部U4。父任务标识构建 `D1rEGGdx`（含 `17ac` typed admission及本轮最终backend源码）；报告 `buildSha256=9883db25f0ce47e44bdd01c1cd7ec487fd9091c7596dd7e9f14a46591d41c4e1`、`mainSha256=f4fe3439fb11c0311ce4283f3bc07cd6534424300c8eeda3e4a46393a56eb899`，`buildUnchanged:true`；父任务另确认该build指纹覆盖455文件。不将这些指纹等同搜索占位符修复后的最终构建或全部源码交付。 |
| 新完整设置运行 `ui-settings-workspace-ui-wws5SD` | 父任务提供：构建标识 `D1rEGGdx`，整轮 exit 1；25项通过、renderer errors 0，**前25项限定接受，整体失败保留**。sidebar 持久化、真实备份导出及 SQLite 核验、恢复后冷启动、authority guards 均通过；随后 placeholder/trigger/save 的对比度 `≥4.5` 断言失败，父任务已定位搜索占位符实测比值为 `3.39843`，低于 `4.5`，不是模型调用失败。Sol 已修复应用拥有的搜索 class，使用 `var(--field-placeholder,var(--muted))`，预测比值 `4.8322`；尚待最终构建真实复测，不能据预测关闭失败。此处不推断 console errors 为0，不声明全部设置或最终构建验收通过；报告完整路径与最终复测结果待父任务补录；父任务现已报告Markdown 29项纯检查通过，命令/日志/exit待补；原rawHTML首轮exit 1保留，不能据纯检查替代最终构建动态内容验收。 |
| legacy完整补验 `legacy-diagnostics-followup` | 命令 `node scripts/electron-smoke.mjs`，父任务报告完整实际exit0；[日志](../../../apps/desktop/test-results/ui-goal-20261101/legacy-diagnostics-followup.log)。build仍bf167db0，QA真实点击Disclosure打开诊断后运行全程成功，关闭本例旧hidden selector QA缺口；不改原hidden failure exit1、不称生产修复、不外推最终0082合入后构建。 |
| 集成legacy smoke | 已读[legacy-integrated-delivery.log](../../../apps/desktop/test-results/ui-goal-20261101/legacy-integrated-delivery.log)，命令node scripts/electron-smoke.mjs，父任务报告exit 1。脚本第1460行等待ai-observability-workspace可见，locator实际63次解析到hidden section后30秒TimeoutError；不再归因为旧mastery_quiz猜测。日志有SQLite experimental warning，不能称零警告；A已修补折叠入口QA，父任务真实Disclosure click后的完整legacy补验exit0，不改原失败、不称生产修复。 |
| 无模型archive-only `2BZXtR` | 已读[settings-archive-settled-final.log](../../../apps/desktop/test-results/ui-goal-20261101/settings-archive-settled-final.log)：success:true、checks6，父任务报告exit0。bf167范围内0model，U2历史打开、focus trap/Escape取消、实际归档确认/新会话、selected-skill公开overlay、冷启真实回复/教师标题/native bytes及源夹具不变通过。日志有SQLite experimental warning，不称零警告；不改变原29/8/1项失败结果，不称全套设置或新DataBackupPanel通过。 |
| 无模型archive-only `5iqviG` | 父任务报告1pass、exit 1；首项对比度opacity0、ratio1，原失败保留。原gubq7n实际三项归档对比度约4.83/5.11/10.42通过仍按原运行保留；不能据新采样状态反写旧通过，也不能据旧通过抹除新失败。QA增加有限portal稳定等待，阈值和生产未变；新终态待补。 |
| Targeted设置 `gubq7n` | 父任务报告8pass、exit 1；归档三项对比度约4.83/5.11/10.42均通过，随后旧assertWorkspaceChrome的header/input空锚点失败。Pasteur修QA并做无模型archive补验，尚无通过终态；不与旧29项相加，不据此判定生产归档能力丢失，原失败保留。 |
| 最新完整设置 `0FGfz0` | 已读settings-color-reader-integrated.log：29项PASS后 `success:false`，旧历史selector TimeoutError，脚本pi-settings-workspace-ui-smoke.mjs第313行。实际输出目录 `test-results/xiaozhi-agent/pi-settings-workspace-ui-0FGfz0`；新导航历史入口在workbench-manage-history modal，父任务未见生产丢功能，Pasteur做QA continuation。29项包含完整设置/对比度、真实官方回复等，但不能将先行PASS写为整轮成功。无生产变化，后续settings终态待补。 |
| 集成课堂兼容 `run-eBPbd2` | 已读[报告](../../../apps/desktop/test-results/ui-goal-20261101/classroom-compatibility/run-eBPbd2/report.json)：`success:false`、`incomplete_compatibility_boundary`，父任务报告exit 1，3 checks通过，errors为空不等于整体pass。复制文件字节/PPTX hash+ZIP CRC、首开/冷启同一三页ready课堂及confirmed/saved导出UI通过，sources 1课堂正常；原绝对receipt authority不向复制环境改写引出首开/冷启各1项blocking，属于复制环境边界，不算生产缺陷。ordinary Office版本API排除classroom schema各1项为information，不计为blocking。原证据与构建不变，无新增模型/学生事实；Boyle已确认复制库grant=0、legacyworkspace=0，review将拒绝；不调用、不伪造或改写receipt来换绿。compat复制边界结论限定冻结，整体exit 1/incomplete保留。 |
| 集成完整设置 `BAGFV6` | 父任务提供：新集成out上实际25pass，随后第289行亮度断言失败，整轮失败保留。已测文本对比度均修复，SAVE `10.4188129`、搜索 `4.832895`；父任务已目视PNG，字段实际为白色。当前QA regex假设raw computed使用rgb255，modern color(srgb/oklab)可能触发误报，尚非已关闭结论。QA reader已由Sol及父任务独立确认6项通过，使用canvas合成RGB并记录raw computed、RGBA/alpha、ancestor CSSOM候选及来源元数据；父任务独立6项已通过，完整设置/归档实际补验结果仍待；settings-color-reader-integrated.log记录0FGfz0整轮29pass后的失败，不是unit6汇总。原sum>500及4.5门槛保持。无新增生产变化，复跑终态/精确exit/完整报告路径待补；不把25pass写成整轮通过，也不推定为模型失败。 |
| 最新完整设置复跑 `fgIQdZ` | 父任务报告：实际25pass、整轮exit 1；此次是**不同的对比度失败**。搜索占位符实测 `4.832895`、credential `4.8329`、default trigger `5.1075`，这些已过4.5；启用态SAVE按钮前景RGB(252,252,252)、背景RGB(4,133,247)，比值 `3.588987<4.5`，整轮仍失败。SolPasteur正在应用settings范围修复primary token，尚无新构建复验；该次报告完整路径待补，不推断未提供的console/renderer错误数。早期wws5SD失败不改，本次前25项限定接受且不与旧25项累加。 |
| Sidebar 真实运行 | 父任务报告失败，原报告路径和具体触发条件待补；相关单元修复不等于真实问题已关闭，下一轮实际 UI 验证待进行。本项不被历史 Disclosure 100 项替代 |
| 真实 U6 `run-3QtUDC` | [原始报告](../../../apps/desktop/test-results/ui-goal-20261101/classroom-live/run-3QtUDC/report.json)仅 1 check 通过，`success:false`，失败为 `timeout: real proposed outline`。父任务补充：outline 工具失败 6 次、plan 为 0，归入 F 修复项。只读隔离数据库确认底层 run 为 `succeeded`、事件 run 为 `completed`；运行结束不代表已生成可用课堂计划。修复后的实际链路及独立补验见下两行，原始失败保留。 |
| 新真实 U6 `run-lMlOPD` | 已读取[原报告](../../../apps/desktop/test-results/ui-goal-20261101/classroom-live/run-lMlOPD/report.json)：5/5 已记录 checks 通过，包含真实 sandbox/quiz、独立教师最终确认且不创建学生事实；原整轮仍为 `success:false`、父任务确认 exit 1，QA 推测导出文件路径后 readback 因 `ENOENT` 中止。该失败报告保持原样；独立只读补验已通过，见下行，不把原报告改称 exit 0。 |
| U6 Office 导出与冷启动独立补验 `readback-followup-0KpxmA` | 已读取[补验报告](../../../apps/desktop/test-results/ui-goal-20261101/classroom-live/run-lMlOPD/readback-followup-0KpxmA/report.json)：`success:true`，3/3 checks 通过，errors 0；父任务报告 exit 0。批准回执、host 工作区授权、session/课堂版本与实际文件一致；PPTX **108,031 B**，SHA-256 `7dd39cb0ea5703bffd5e89b54d99a0097c502b1cf07fca5f6174aaca976de22a`，ZIP CRC 有效、4 张幻灯片。相同 profile 冷启动恢复同一 ready plan、已确认课堂和已保存导出，新增模型运行 0、学生记录 0，文件字节及原失败报告未变。关闭本例 QA 推测路径导致的 readback 缺口，不定性为生产写入缺陷；不外推所有导出格式或最终新构建。 |
| 集成target cards `run-pJufg4` | 已读取[报告](../../../apps/desktop/test-results/ui-goal-20261101/targeted-cards/run-pJufg4/report.json)：`success:true`，6/6、父任务报告exit 0，build `bf167db0fb26ce23114301b3ac9eec34a88056a5904adeb9564aa8f93a017889`，consoleErrors为空，`humanAccepted:false`。实际请求中性计数/accepted receipts，官方Card收起展开、1366/1920、hover/键盘，教师四项DB汇总1/0/0/0先于收起诊断；无新模型/聊天/学习记录，原证据及构建不变。合成学生1名，不称零学生写入；仅两条真实UI路由，不等于完整设置或教师接受。 |
| 集成公开replay及legacy回复导出 `run-qtKruK` | 已读取[报告](../../../apps/desktop/test-results/ui-goal-20261101/public-replay/run-qtKruK/report.json)：`success:true`、6/6，父任务报告exit 0，build `bf167db0fb26ce23114301b3ac9eec34a88056a5904adeb9564aa8f93a017889`，`humanAccepted:false`，consoleErrors为空。真实Electron冷重放：仅去除已观测尾部、正文clean、完成过程初始折叠及官方展开/收起无原生三角；真实legacy visible-hash导出使用受控owned目录chooser、SQLite/文件读回且stored reply不变，原DB/audit/report及copied native audit不变、构建不变，0新run/command/event/model request。`manualNative:false`、`nativeDialogDisplayed:false`，不冒称手动原生目录选择；不覆盖analytics/请求Card标签、新模型流或质量验收。 |
| 实际模型HTML功能用例 `run-Bcpic7` | 已读取[报告](../../../apps/desktop/test-results/ui-goal-20261101/chat-html-functional/run-Bcpic7/report.json)：`success:true`、7/7，父任务报告exit 0，build `50a9398a8b989ddac93fbff22a58c733abe6d979932780dbbda556cc0c244ae7`，`humanAccepted:false`。practice场景，`promptOverride:true`、`pairedBenchmark:false`；同一真实raw HTML final在完成及冷启均映射到同一正文消费者的官方Card，native details/summary=0，Enter/Space/焦点保留、双尺寸及阶段折叠、冷启无模型重放通过；consoleErrors为空，报告检查包含无renderer错误及构建指纹不变。限定为一次自定义prompt功能任务，不作为配对质量结果，也不等于单次provider请求。 |
| 最终构建targeted cards `run-RzTbcE` | 已读取[报告](../../../apps/desktop/test-results/ui-goal-20261101/targeted-cards/run-RzTbcE/report.json)：`success:true`、6/6，父任务报告exit 0，`consoleErrors:[]`，`humanAccepted:false`，build `50a9398a8b989ddac93fbff22a58c733abe6d979932780dbbda556cc0c244ae7`。覆盖请求中性标题/实际accepted receipts，官方Card/Disclosure收起与展开、1366/1920双尺寸、Hover及键盘；四项教师汇总1/0/0/0与本地SQLite匹配，在末尾折叠诊断之前。0新模型/聊天工作及学习记录，原证据与构建未变；报告scope注明复制的合成数据及1名UI创建的合成学生，不能称零学生写入。本例请求Card/analytics层级缺口关闭，不替代其他页面/完整设置/科学质量/教师视觉接受。 |
| 最终构建公开replay及回复导出 `PMeI5w` | 父任务提供：6/6、exit 0，使用统一build `50a9398a8b989ddac93fbff22a58c733abe6d979932780dbbda556cc0c244ae7` / main `f4fe3439fb11c0311ce4283f3bc07cd6534424300c8eeda3e4a46393a56eb899` / renderer `index-DO88aOp1.js`。受控文件夹实际导出、冷启DSML修复及原记录/计数器不变已通过。完整报告路径待补，本docs worker未运行该检查；仅接受本次公开重放/导出范围，不替代新生成流、科学质量或所有导出格式验收。 |
| 最新真实 U6 `run-QleUZj` | 已读取[报告](../../../apps/desktop/test-results/ui-goal-20261101/classroom-live/run-QleUZj/report.json)：`success:true`、整轮7/7 checks通过、errors 0，父任务报告exit 0，`humanAccepted:false`。使用 `D1rEGGdx`，报告build指纹 `9883db25f0ce47e44bdd01c1cd7ec487fd9091c7596dd7e9f14a46591d41c4e1`（455文件），main入口指纹与该批次一致。覆盖真实PDF导入/读取、大纲先行及确认前禁止生成、停止保留checkpoint、冷启零重放/显式继续只补缺页、独立课堂确认、sandbox/quiz、Office审批实际保存PPTX及冷启零学生事实写入。新PPTX为106,155 B，SHA-256 `334afcd190ea51441c23f8face5a92508b7905ff21f60f088e914bd89495f613`，ZIP CRC有效、4张幻灯片。**本次工程链路限定接受，科学质量待A评分**；不合并旧5+3计数、不改旧失败，不自动视为最终新renderer验收。 |
| 真实 U3 `run-aHQHFg` | 已读取[materials-live 报告](../../../apps/desktop/test-results/ui-goal-20261101/materials-live/run-aHQHFg/report.json)：`success:true`，11 checks 的 `status` 均为 `pass`，耗时 17,597 ms；父任务报告进程 exit 0。覆盖真实 UI 导入、本地解析与关键词检索、详情卡片、原始页面 PNG、双尺寸 Hover/Focus、未保存笔记及原生设置导航守卫、保存笔记冷启动 readback；源资料未改写、构建指纹未变，模型运行与资料 AI 批次均为 0，errors/page_errors/console_errors 均为 0。使用 `9752656` out，包含全部 U3 生产逻辑和卡片迁移，**未覆盖后续 `7448` 共享标题布局**；不外推到大资料库、语义检索或 OCR 质量。 |
| 真实 U5 `run-pHQGJD` | 已读取[students-live 报告](../../../apps/desktop/test-results/ui-goal-20261101/students-live/run-pHQGJD/report.json)：`success:true`，15 checks 全部通过，errors 0、consoleErrors 0；父任务报告进程 exit 0。该次运行使用 `9752656` out，覆盖 U5 逻辑与新组件迁移；**不包含 `7448` 的共享标题布局，也不包含后续 analytics 顺序调整**，这些后续变化须另验。 |
| 补充原生 headless 选择器测试 | worker 的临时 Chromium 测试中 5 项交互断言通过，但整轮 exit 1：Vite 开发 WebSocket 连接产生控制台错误。保留[失败报告](../../../apps/desktop/test-results/u4-selectors-headless-df5dd173/report.json)，不列为正式通过；该次记录的受保护文件指纹未变化。 |

截图数量不代表截图已逐张通过人工视觉验收；组件测试不替代真实 Electron、权限、模型、文件签名及内容 readback 验收。旧 `ui-goal-paper-rYm7vv` 截图只作历史层级审阅，不证明最终冻结构建的当前视觉状态。

## BEFORE 原始截图

以下三张来自真实 Electron `disclosure-live/run-CrlGzr`，仅作为后续指定修复的 **BEFORE 基线**，不表示项目最初版本，也不构成 AFTER 或修复通过证据。已目视核对：密钥栏无明文密钥，教学空间与数据为空；未复制整页文本或私有推理。

| 原样副本 | 原运行文件 | 用途 |
| --- | --- | --- |
| [settings.png](evidence/before/settings.png) | `005-settings-1366-no-preference.png` | 设置首屏层级基线 |
| [capabilities.png](evidence/before/capabilities.png) | `021-capabilities-1366-no-preference-open.png` | 扩展能力展开与触发器组合基线 |
| [analytics.png](evidence/before/analytics.png) | `017-analytics-1366-no-preference.png` | 额外的信息层级参考，不计入 Goal 达成证据 |

三张均为正常动效偏好（`reducedMotion:false`），CSS 视口 **1366×768**、**DPR 1.5**、窗口 zoom factor 1，PNG 实际像素 **2049×1152**。元数据取自原报告的 `screens`；逐文件复制后 SHA-256 与源文件一致，未缩放、裁剪、重新编码或添加标记。原报告记录的构建指纹为 `212006364122b2239b065255565c1b4b4f3041a92561aafde01fab4b72922a55`，不与 Git 短提交号混称。

## AFTER 原始截图与复测范围

三张对应原图来自 `disclosure-live/run-37Mnx2`。以下匹配页面/状态及视口，不作相同滚动位置或像素一致性的额外推断；`analytics` 仍仅作层级参考。

| 页面 | BEFORE | AFTER | 本次可见变化 |
| --- | --- | --- | --- |
| 设置 | [settings](evidence/before/settings.png) | [settings](evidence/after/settings.png) | 模型配置分组与控件对齐；旧裸 `0` 不再出现 |
| 扩展能力展开 | [capabilities](evidence/before/capabilities.png) | [capabilities](evidence/after/capabilities.png) | 触发器全宽，标题与 Chevron 同行，焦点框覆盖整行 |
| 概览 | [analytics](evidence/before/analytics.png) | [analytics](evidence/after/analytics.png) | 仅 `AiObservabilityWorkspace` 移入底部折叠诊断；「02 AI 与知识资产状态」及 AgentLoop 仍在风险/薄弱点之前直接展示，完整层级要求未完成 |

源文件仍分别为 `005-settings-1366-no-preference.png`、`021-capabilities-1366-no-preference-open.png`、`017-analytics-1366-no-preference.png`。三图均为 CSS **1366×768**、DPR **1.5**、zoom factor 1、PNG **2049×1152**、`reducedMotion:false`；已逐张目视核对安全内容，逐文件 SHA-256 与源图一致，无缩放/裁剪/重编码。AFTER 报告构建指纹为 `59afcfe2a5240286233674b18449c7f0295ff650c6aebf528c7a9aaed5c347f4`（455 文件）。

**analytics 证据更正**：副本确为 `run-37Mnx2/017-analytics-1366-no-preference.png`，副本与源图均为 137,414 B，SHA-256 均为 `c05faa7c9a6ebef31f564b31b0288e0f18a3bdaebf1211979483242baf87e2b9`；报告页面为 `analytics-1366-no-preference`，不是错页或错图。只读核对 `git show 10425793e580f94fa9c03b02a2d84542a4030dc6:apps/desktop/src/renderer/App.tsx`：2647–2655 行仍直接渲染「02 AI 与知识资产状态」及 AgentLoop，2656–2662 行才是风险/薄弱点；2664–2668 行的底部折叠仅包裹 `AiObservabilityWorkspace`。`3136530d4cf9d59ed2e9436bbe400bc436c4b053` 已包含于 `1042579`，其 diff 也只移动后者，遗漏上述静态状态区块。此前“运行状态在后”和“analytics 空态顺序已有证据”的表述过宽，现明确更正：**原图真实，但未达到全部诊断置底折叠的要求；已有 100 项未验证该完整层级要求**。新构建仍由父任务执行，待实际新图验收，不替换或重标旧图。

正式 CSSOM/几何记录：两尺寸 × 正常/减少动画四组中，trigger 均为 `display:flex`，宽约 692.667px，与卡片内宽相等；Indicator 中心偏差约 0.0053px，位于触发器内。Tab/Enter/Space、focus/focusVisible 均已记录；减少动画下 content/indicator 的有效 `transition-property:none`，旧 duration 非零误报关闭。表单保留探针使用的是 **Card 外既有空白设置输入**，不能据此宣称正式运行已覆盖所有 Card 内草稿；细节见 [Disclosure 根因与复测](DISCLOSURE_STYLE_FINDINGS.md)。

100 项检查主要覆盖空态和应用路由，不含全部非空题目/OCR/练习、真实模型任务或导出业务。U3 的 11 项与 U5 的 15 项真实业务证据仍分别使用自己的报告和构建范围，不能被本轮 100 项替代。

## 集成前50a9398a analytics样张（保留历史AFTER）

[analytics-1366.png](evidence/final/analytics-1366.png) 原样来自 `targeted-cards/run-RzTbcE/teacher-diagnostics-collapsed-1366.png`，对应最终候选build `50a9398a…`。CSS视口1366×768、DPR1.5、原PNG2049×1152，81,139 B，SHA-256 `baa761fc69e51848d59f8952882e1958a380718531e403c445889653939df8ec`。已目视安全检查，内容为公开合成数据，无可见凭证/学生身份；父任务亦已审阅。副本与源文件逐字节一致，无缩放、裁剪或重编码。

本次可见四项教师统计为1/0/0/0，之后为单一收起的「运行与诊断」；未见旧AI状态卡或原生黑色披露标记。报告另验证汇总与SQLite匹配、双尺寸及展开/键盘交互；该PNG自身仅展示1366收起状态，不替代其他状态截图或教师接受。

旧 `evidence/after/analytics.png` 仍属1042579部分层级证据，未覆盖、重标或重新解释；旧SHA保持 `c05faa7c9a6ebef31f564b31b0288e0f18a3bdaebf1211979483242baf87e2b9`。上述新结果关闭的是本例新候选的请求Card/analytics层级缺口，不改旧报告结果。

## 实际HTML正文Card样张（功能证据，非质量benchmark）

[chat-html-completed-1366.png](evidence/final/chat-html-completed-1366.png) 原样来自 `chat-html-functional/run-Bcpic7/attachment-completed-1366.png`。CSS视口1366×768、DPR1.5、原PNG2049×1152；119,125 B，SHA-256 `d5f230a3b4d210c00d9a9ef43122bafd1fb1169c97d561774257be1f8fbd30eb`，副本与源逐字节一致，无缩放、裁剪或重编码。

已目视安全检查：可见合成PDF的公开最终正文、展开的「资料依据」Card及焦点框，无可见凭证/学生身份或私有推理。截图仅展示该完成态/滚动位置，冷启、双尺寸和键盘结论依照报告各自检查，不由单张图推导；正文科学质量不在本次功能验收中评分。旧截图及失败报告均保留。

## 今日参考探针边界

最新只读native探针（getApp/getScreenshot，窗口1051204）：前景出现Python的Windows安全中心网络授权及Docker unexpected error弹窗，遮挡参考画面；底层另一个现有Codex聊天仍可见RUNNING。未点Allow/Cancel、未改其他应用、不保存私人截图。**当前无法完整观察参考流程；此前无遮挡运行相观察仍有效，不被本次遮挡抹除，也不证明完整交接1:1。**

此前父任务只读CUA观察：窗口 `1051204` 当时无遮挡，现有其他项目聊天处于 **RUNNING**。可见正常段落的公开工作说明，其下为紧凑工具文字行；过程上方显示总用时「已处理2分49秒」，底部composer保持可见且未变，当前可见工具行无逐工具用时。**这是该次运行阶段的真实视觉观察**；其后新弹窗遮挡不否定该次观察，历史锁屏不作为当前状态。

父任务未交互、未新发消息或新建聊天，也未保存截图，因为画面包含用户私人项目侧栏/diff；本docs worker只登记父任务描述，不复制该私人画面。该观察不证明完整工作流、最终正文交接/折叠、像素或体感parity。此前inventory为 `OpenAI.Codex`、AX不可用且被本任务Electron U6窗口遮挡的探针仍属历史有限证据；锁屏同样仅为历史观测。不绕过认证、不修改其他用户聊天。

## 质量风险及未验收边界

[QUALITY_RESULT.md](QUALITY_RESULT.md) 已记录审查结果，不能再将全部公开内容质量统称为“待验”：旧误区 `run-kias9P` 与首代课堂 `run-lMlOPD` 存在关键科学错误；新误区 `run-hJO4Iy` 已纠正旧受力条件错误，但仍有字数、条件和 DSML 协议残片等缺口，整体质量未通过。新 practice `run-6uAm9e` 的正文尚未在该质量审查中评分，新课堂 `run-QleUZj` 的工程7项已通过，科学内容仍待A评分，不能由旧质量记录或新工程报告推定通过。工程成功、Office 只读补验及源码护栏均不抵消这些质量结论。

不以工程通过抵消质量审查失败；人类视觉/试用、ChatGPT像素与体感parity均未接受。

