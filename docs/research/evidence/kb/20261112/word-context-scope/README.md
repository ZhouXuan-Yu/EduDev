# Word卷首信息与公共条件归属修复

## 本轮交付合同

目标M02/M03/M05。教师导入目录后，后台能将明确试卷标题、考试日期及行政说明归入来源元数据，完整公共解题条件保留在题面。真实资料作为通用规则的验证范围。

当前148份Word含4226处实际题目，其中shared_context3670处、source_warning2458处，计数重叠。已确认部分共享内容只有试卷标题或括号日期，因原词法匹配范围不足污染全文。图文未知归属、真实修订与缺失仍需保留明确原因。

新增word-question-preamble.v5，冻结旧v4读取语义。修改范围限于原卷首识别、Word题目来源索引、策略常量、原后台升级与兼容检查、对应定向测试。明确学年考试标题采用教育语义及完整字符范围约束，括号日期按有效日历日期识别，行政句须整句匹配。仅对有明确全卷范围且完整可读的参数约定按其原范围保留到各题，模糊或局部适用的共用内容继续待核。

沿用OOXML解析、现有Word历史摘要、原目录升级调度、Native图稿/OCR/DeepSeek、题本与Pi。SQLite/文件继续为真源，无新业务表、IPC、依赖或外部服务。新增派生升级索引采用v5名字，原始文件、旧题、付费回执及历史来源保持。

兼容检查要求原raw total、原题号位置和实际题目bodyIdentity一致，旧v1/v2/v3/v4来源仍由其冻结策略读取。失败、取消、暂停和重启沿原writer恢复。回滚停止后续v5升级并保留历史reader，数据和真实回执不删除。

本轮完成条件为关闭至少一类批量误拦，当前全部148份自然文档的前后统计、旧事实SHA及计划兼容核对通过，真实后台升级及新旧题图冷读通过，一道新受影响题经原界面完成OCR和DeepSeek整理后检索可用。关键不适用规则需有反例，防止年份、数字、单位、题间局部条件和答案风险被卷首识别吞掉。build、组件及相关定向门禁后正常整合推送main。

完整当前221份自动质量、约10GB、完整召回/重排、安装和迁移保持原Goal。新策略不以清除真实风险或修改既有题目作为验收手段。

## 实际交付结果

本轮关闭Word行政卷首误传播造成批量shared_context的缺陷。原目录后台已将当前148份Word全部升级为word-question-preamble.v5，耗时455930ms，升级失败0。后台同时沿原队列处理新可用范围，全部在途单元结束后通过原界面暂停。目录导入继续限于原221份、328203104B。

| 当前全部148份Word来源位置 | v4 | v5 |
| --- | ---: | ---: |
| 原文位置 | 4541 | 4541 |
| 实际题目位置 | 4226 | 4222 |
| 非独立题目位置 | 315 | 319 |
| 无来源疑点 | 133 | 500 |
| shared_context | 3670 | 2146 |
| ambiguous_number | 1863 | 1855 |
| source_warning | 2458 | 2458 |
| image_scope_uncertain | 126 | 126 |

问题计数有重叠。多出的4处非独立位置包含明确全卷适用的物理参数说明，其原文和精确范围仍进入对应题面。公式缺失81处、图片缺失128处及其他真实来源风险仍保持。全部148份计划兼容，实际新旧文档除questionPolicy外逐字段一致。旧v4 reader与b332615旧模块对148份、4541位置的源内容哈希均为d48dae8715f61ee8d2b041a82dde875bac97e558ecdb761eb74fbd9c888ca682。旧来源由历史表读回，历史行739增至887。

实现复用既有OOXML、索引、升级writer及调度。明确教育标题采用语义及完整字符范围约束。有效括号日期和行政条款只在可信卷首识别。首个分节后停止卷首识别，带“求/计算/证明”等动词且无问号的数学题同样结束卷首窗口。全卷g参数须完整、带正确单位、明确全卷适用且无源警告。局部、条件性、无单位、带警告和未知条件继续保留待核。旧v4默认语义冻结。

## 实际用户链路

本轮新增28个AI批次、53次整理调用，产生14道归档题，6道ai_final、8道ai_needs_review。另有真实Pi检索/实读3次模型请求。指定的新受影响题由原资料入口进行本地OCR和两次DeepSeek，答案C，年级经第二遍修正为高三，issues为空。题目question_18b41afa-751f-44c4-b6ea-472c3775dda5的原题图为1240×616，SHA d2b9776b761dcd84073bf011126848fb9873b24a80e379536736090290141c36，已本地目视核对完整源图。

真实Pi通过education_search_questions和education_read_question命中并实读该题，run_6db5cac6-c572-4b9f-b596-b6577511aec1完成。当前小库搜索2511ms、读取141ms。最终主线整合构建通过原找题/加入题篮界面将该题持久化进入实际练习篮，revision2、成员1，题记录逐字节保持。该题本轮推进到练习选题，后续正式确认和新卷导出未在本切片执行。

最终冻结构建对旧3题与新题冷读，角色图片SHA一致。1366×768及1920×1080图片角色控件可达。题卡有独立滚动，完整图像另通过原PNG核对。上一轮已确认试卷及学生/教师两份PDF只读回归保持，历史正式确认由自动化测试代理操作原界面。当前新增题未借用该旧卷的完成状态。

原221份资料、1312分块、3128题和281条旧AI单元全行SHA保持。当前共3142题。原件、旧题和回执均未清理。

## 仍未关闭的实际缺陷

outcome_unknown由22增至26。4项新增均已收到完整provider-envelope.v1回执，error为invalid_response。它们的错误响应保存在本地，未自动重发或晋升为合格稿。

- aibatch_d5be6ed9-4783-40db-beee-d1284510f16d的第二遍对缺答案/缺解析给出uncertain，宿主要求not_applicable，造成待核结论格式拒收。
- aibatch_6bc817d1-0939-4727-9eab-551c526fc832同样涉及缺失角色的逐项复核，完整差异需在下一切片离线定位。
- aibatch_367d19ba-5032-45b3-8d1e-29944ae7fa12首稿同时声明no_questions及非空questions，语义冲突仍被拒收。
- aibatch_ba16ab64-6861-4ec3-a78b-6259d6b86f34首稿未通过格式投影校验，精确字段待利用已存回执定位。

下一项交付优先修复“已收到但无效的响应”与“未获确定响应”的状态和恢复处理，协调缺失答案角色的复核协议。先用这4份本地响应定位及回归，再沿原界面做一次有意义的恢复。冻结历史v2语义，必要时采用新版本，保留付费身份、原始回执和来源门禁。缺图、缺条件、原答案冲突仍需待核。

当前来源source_warning2458处、shared_context2146处，全部221份的自动质量仍OPEN。复杂Word/OLE、缺答案联网补答、完整召回/重排、长期后台、约10GB、普通Windows安装与异机迁移继续按原Goal推进。完整Goal保持ACTIVE。

## 检查范围与证据

生产功能提交9d89374、9acd81d、7a9105d。已整合协作者Harness Phase2和首次选题UI主线，最终代码/生成清单457cdef。最终实际入口为test-results/corpus-flow-1gb/runtime-171c59a0378d-ddf275cd/out/main/index.js，main SHA 171c59a0378d85be40860411d954f1ae6a7fa670db262e073b54b7c9d4490b61，整树SHA ddf275cd2fcfef544a9de478180d6d8980215434306a5645b606816a3dea3d1c。

| 检查 | 结果与范围 |
| --- | --- |
| 新word-context-scope | 9组通过 |
| preamble/question/booklet/history/folder-upgrade/proof/dispatch/ledger/folder-ai | 136组通过，含SQLite及受控边界 |
| Harness Phase2 contract | 10组通过 |
| npm run test:smoke | 207/207、exit0，7a9105d构建，早于最终协作者UI整合 |
| 最终npm run build | 通过，含typecheck及能力制品生成 |
| 最终npm run test:renderer-components | 246/246 |
| node scripts/paper-library-selection-components.mjs | 4组静态检查通过 |
| 最终实际数据冷读和正常选题加入 | 通过，无新增付费 |
| npm audit --omit=dev --json | 22项存量，低8/中6/高8，无新增生产依赖 |

精确执行日志存于本目录，最初源边界失败与后续修复保留。额外练习UI探针最初错误假设“新对话切换组卷归属”和“新建题篮必弹框”，三份失败日志保留。改为当前真实候选搜索/加入原入口后通过。首次选题自动建篮只做了合入后的4组静态检查，其独立真实UI证据由协作者报告负责。

工作目录D:/WorkProject/EduProject-kb-isolation/apps/desktop，已运行命令如下。

```powershell
node scripts/education/kb-word-context-scope.mjs
node scripts/education/kb-word-preamble.mjs
node scripts/education/kb-word-question-boundaries.mjs
node scripts/education/kb-word-booklet-boundaries.mjs
node scripts/education/kb-word-background-upgrade.mjs
node scripts/education/kb-folder-word-upgrade.mjs
node scripts/education/kb-word-proof-repository.mjs
node scripts/education/kb-native-dispatch-boundaries.mjs
node scripts/education/kb-native-ledger-boundaries.mjs
node scripts/education/kb-folder-ai-boundaries.mjs
npm run test:smoke
npm run build
npm run test:renderer-components
node scripts/paper-library-selection-components.mjs
npm audit --omit=dev --json
```

同目录受忽略本地脚本执行了preamble-freeze.mjs、word-scope-upgrade-live.mjs、word-scope-cold-live.mjs、word-scope-practice-add.mjs、word-scope-facts.mjs和word-scope-receipts.mjs。它们用于既有测试根的运行与只读核对，实际结果已抽取本目录元数据。真实材料及模型响应留在本机。

单次同148份已解析文档CPU遍历404.29ms→327.05ms。该测量排除文件IO、模型时间、内存峰值和大库，尚无P95/10GB结论。真实后台455.93秒含队列调度及AI，不与CPU测量等同比较。

本目录只归档工程日志、数量和哈希元数据。原文、完整模型响应、原题图、截图和本地SQLite留在D:/WorkProject/EduProject-kb-run/flow-1gb-20261111。收尾应用已正常关闭，目录归档与folder AI均paused，无在途AI任务。下轮先核对实际进程，旧PID/CDP属于历史。

## 兼容与回滚

新增派生索引idx_material_word_preamble_v5，旧v4索引保留，无新业务表、IPC、外部服务或生产依赖。v4/v5历史reader保持。若需回滚，先暂停后台升级，以正常revert恢复新创建的目标策略并保留新版本reader和历史数据。已产生的v5引用及真实AI回执继续读取，后续重新升级走原幂等writer。不得用删除资料、重置AI单元或移除历史reader作回滚。

复杂Word渲染后续可评估受管LibreOffice转换后复用原PDF/OCR。官方支持命令行PDF导出，分发许可须按实际安装包核对MPL2.0及捆绑组件。本轮只核对官方资料和两个常见安装路径，无组件下载或生产接入。 [转换文档](https://help.libreoffice.org/latest/en-US/text/shared/guide/convertfilters.html) [许可入口](https://www.libreoffice.org/licenses/)
