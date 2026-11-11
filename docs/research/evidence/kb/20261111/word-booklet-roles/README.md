# Word试卷说明与独立答案归属

## 本轮合同

上一轮为progress，147份旧Word自动升级、保留历史并推送ab9e952。本轮仍处理当前221份已导入资料，运行实例175064/177648已核对存活，目录归档暂停、AI继续。实际清晰选择题经两遍DeepSeek后仍因shared_context和separate_answers进入待核。新实现属于M02/M03/M05，教师结果为常见试卷说明退出题干、同一Word中明确题号答案表自动按题绑定，原题图和答案角色分别保留，未知归属继续待核。

复用原OOXML结构、Word原生索引、proof渲染、本地OCR、两遍DeepSeek、目录调度、历史快照、原writer和资料/题本UI。新文档冻结word-question-booklet.v3索引策略，旧v1/v2按原语义读取，改变策略产生新documentSha并保留旧表示。正文/原件/题序/付费回执不改。复用原后台升级入口处理现有Word，按原授权范围继续新题。

仅将完全匹配考试元数据语法且纯文本无警告的说明从题干移至保留的资料上下文，公共物理条件、未知叙述和图形继续保留在题面。独立答案区只对题号行与答案行的标准表格按唯一题号和同列绑定，保留实际单元格段落的原锚点/范围，不将整张答案表混入单题。重复题号/表号、合并单元格、残缺列或不明答案保持待核。当前轮覆盖清晰选择题答案表，其他复杂解答区沿原待核规则继续建设。

有明确选择答案时，两遍AI仍须与本地已知答案一致才能自动定稿，冲突保留answer_conflict，禁止以两遍模型一致覆盖原答案。旧已派发单元不改绑来源，新题采用新策略和新proof。旧响应继续保存，涉及新增答案角色的输入使用原授权执行新的真实两遍核验。

预期改动共享Word契约/策略、原parser标记、Word索引内元数据/答案角色、版本升级选择及native答案核验。无新表、依赖、独立服务或云上传边界。前端沿原Word按题图文、资料AI整理和题本/角色图片入口操作，失败仍可定位。验收含原v1/v2摘要稳定、新标准表多题角色隔离、重复/合并/缺失/跨列/公共图文保护、已知答案冲突、原件变化/取消/冷启、自然当前资料至少一题实际新来源输入和两遍结果，不能将局部通过写成完整Goal完成。

按影响范围运行Word索引/后台历史/目录调度/native定向及build/组件，实际Electron读图/检索和SQLite事实回读。性能记录当前自然文档全量索引时间及升级额外存储。回滚使用正常revert，保留新策略读取兼容层、SQLite和原图，不删除已确认题/原件/回执。普通安装、约10GB和完整质量仍在原Goal范围。

收尾审查发现新策略轮询若按JSON逐行判定，会在全部升级完成后持续读取整库Word表示。补充持久化的SQLite局部索引，仅包含需要升级的表示，并在准备查询显式使用该索引；提交表示时由SQLite同步维护。无新列/表，原已完成表示退出此队列。新增空队列查询计划回归，避免将当前小库速度当作大库性能证据。

## 已实现与实际结果

新策略通过WordDocument.questionPolicy冻结，parser仍为word-ooxml.v2，旧缺字段v2和v1继续执行原索引语义。新表示自动进入原历史快照机制，按documentSha区分来源。标准双行答案表的题号与答案按同列、唯一数字关联，单题只获取原答案单元格段落的真实锚点。普通题目中的表格、重复题号、多答案章节、合并单元格、缺列、图形或不明文本不获得自动配答权限。纯文本章节评分说明移入对应题的上下文，原文公共物理条件继续保留。

当前148份Word均已后台升级至word-question-booklet.v3。teacher_resources的221行全行SHA仍为32034ce9fc2ed0ceabb9d207fcc26ecc6c8edf656e72ad16c9dd94d2cccb105b，resource_chunks的1312行仍为b37d0efdfff17443313506b68dafb5818966baef0ae4367a13434ade5c1ee08a。历史表示147→295份，JSON总量10533581→21759262B，增加11225681B。旧原件、正文、隐私标记和回执不改绑。

实际清晰新题由程序从当前资料中选择首个尚未处理、来源无疑点且有明确原答案的候选，命中闵行区2018学年试卷第5题，未按题号写生产特例。原资料页提交aibatch_1b90b180-b8fb-428d-b629-c1b32cfdc806，两次真实DeepSeek返回完成，新增question_809887b8-2c67-4484-8db6-fb9ad4680b1c，ai_final、issues空。题面图1240×464，原答案图1240×96，本地OCR读到D，两遍模型均为D。原答案标source、解析标ai_generated。题本在1366×768与1920×1080实际读取成功，组卷候选资格通过。

真实Pi按自然知识点查询后，education_search_questions和education_read_question均完成并读到这道新题，共3次模型请求，工具耗时2775ms/255ms。随后从原蓝图页按该题实际分类设置高中物理、知识点、1题5分，准确选入这道自动题。代理仅为本地验收执行原确认与文件审批，保留agentConfirmed标记，实际教师确认仍未验收。没有手动修改题干、答案、解析、年级、来源或疑点。

实际生成一页A4学生PDF124014B和教师解析PDF153058B，产物SHA分别为0c6a41da0e027189226b3f19a69d4c2f2a98ad7e8610c9c7a2c76745d0de9677、0d924f54dc089b5950a784cf1e6b8961e9d76ee3fa16bc7d58d8486220a9ce2c。学生卷只有题面图，原答案图像素与整段解析均排除；教师卷有题面及答案两幅原图和完整AI解析。Python独立回读、图像像素比对、A4尺寸及渲染通过，另将教师卷作为学生卷验证，准确因答案图泄漏拒绝。实际渲染人工查看教师页，内容可读、未裁断。原图文字使用像素认证，AI文本解析使用完整文本比对。

## 证据和验证范围

命令在D:/WorkProject/EduProject-kb-isolation/apps/desktop执行。定向脚本使用node --experimental-transform-types，合计131组通过，原断言保留。

| 脚本 | 组数 |
| --- | --- |
| scripts/education/kb-word-booklet-boundaries.mjs | 10 |
| scripts/education/kb-word-background-upgrade.mjs | 8 |
| scripts/education/kb-folder-word-upgrade.mjs | 7 |
| scripts/education/kb-native-dispatch-boundaries.mjs | 5 |
| scripts/education/kb-word-question-boundaries.mjs | 29 |
| scripts/education/kb-native-ledger-boundaries.mjs | 20 |
| scripts/education/kb-word-proof-repository.mjs | 11 |
| scripts/education/kb-folder-ai-boundaries.mjs | 18 |
| scripts/education/kb-folder-pdf-publication-boundaries.mjs | 23 |

npm run build包含tsc --noEmit，通过。npm run test:renderer-components为246/246。实际新题两次provider调用、Pi3次及两个PDF导出均走原本地授权/审批流程，单独证明此切片。上述受控边界覆盖两个模型同错仍须按原答案隔离、未知/缺失策略拒绝、旧来源历史、暂停/取消/原件变化/并发与空升级索引。没有重复运行共享全套验收。

本地证据根为D:/WorkProject/EduProject-kb-run/flow-1gb-20261111。booklet-provider-result.json、booklet-submitted.json、booklet-live.json、booklet-pi-summary.json、booklet-paper.json、booklet-export-readback.json和booklet-export-image-negative.log分别保存原回执、输入、实际角色图读取、Pi调用、蓝图/审批、独立回读与阴性检测。booklet-before、after、cold相关JSON保存原事实及旧来源摘要。原资料、数据库、截图和原生组件保留本地，本轮Git仅提交源码、定向脚本和文档。

生产修改在共享Word策略/校验、word-parser、word-question-source、word-booklet、material-word-repository、word-upgrade-compatible、material-folder-ai、material-ai-native/context。没有新增IPC或前端旁路，原资料页、题本、Pi和组卷入口承担真实用户操作。verify-paper-export.py新增可选forbiddenImagePaths，独立验证学生卷不含原答案图，保留既有文本/像素断言。

## 性能与仍未完成部分

对当前148份存量表示的相同4541处源索引候选，新策略与旧策略分别遍历源索引及摘要474.41ms/469.22ms，单文档最大13.49ms。这个量级只证明当前样本。无来源疑点的候选83→95，其中有原答案的0→6；这是源完整性检查，实际教学正确率、检索指标和全库质量仍需继续建设。新局部索引使已升级文档退出本地准备队列，空队列不再逐份解析document_json。

当前资料仍有明显质量缺口。148份Word中146份存在field_or_symbol、79份unsupported_image、59份embedded_object、48份formula_incomplete等文档警告，警告可能只影响局部题。下一优先调查成熟的MathType/OLE/WMF/EMF转换复用与本地图文恢复，保留现有原件/角色证据。同时本次模型年级仅分类为“高中”，源标题为高三，年级细分仍待修复。复杂填空/综合题答案、公共图文归属、PDF部分页失败、未知请求、本地重排组件、约10GB和普通安装/迁移继续OPEN。

新源已增加答案角色，实际验证使用首个未付费的新题；旧付费单元继续原语义和待核状态。没有把旧两遍响应改绑新来源。初次重复答案表fixture的复制ID碰撞导致失败，改用独立ID后原歧义断言通过。初次本地蓝图助手误读PaperView.items，修正为selection.items后恢复同一已保存卷，未重建或修改题目。负向PDF验证的失败为预期结果。现有npm audit为28项，8high/12moderate/8low，本轮无新依赖。

回滚按正常Git revert，先保留SQLite与原图/历史表示。新策略数据已经产生后，继续保留该策略及按摘要读历史的兼容代码，再停止新任务；旧二进制直接降级未验收。完整Goal保持ACTIVE。

## 最终冷启与后台运行

最终构建main SHA为f73ce74c28c25a7a0011fc127d6a8d284f3e96bc8a8753d2069a4325d2f41288。新增局部索引版本的冷启成功，实际SQLite查询计划使用idx_material_word_booklet_v3，待升级0，当前库空队列100次查询平均2.38ms。全量原件/正文/AI响应没有为构建或验证重写。

三代来源的原单元input/first/final共9个SHA冷启后保持，包括旧v1题、上一轮v2题和本轮v3新题。新题源图/原答案图仍可从原题本入口读取，148份新策略和295份历史保持。此前冷启的旧v1实际来源图1240×688及旧v2自动单摆题语义入口亦通过，语义UI1460ms；该纯读取代码在末次局部索引补充中未改变。

当前控制器工具会话89832/PID33368，Electron173128、inspector52424，renderer错误0，端口以本地cdp.json为准。原UI恢复后folder AI继续当前221份授权范围，目录进一步归档保持暂停。恢复前核对run-state.json和实际进程。已有20项unknown继续保留，本轮出现过原生响应invalid_response，未冒充完成或自动重放未知请求。完整Goal继续ACTIVE。
