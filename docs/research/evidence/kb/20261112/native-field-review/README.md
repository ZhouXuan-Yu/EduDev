# Native逐项复核与措辞误判修复

## 本轮交付合同

目标M05/M10。教师通过原资料AI入口或文件夹后台整理后，正确的完整带图题自动进入题本，正式组卷沿原集中确认。

当前严格signature包含完整analysis，真实两遍响应仅解析措辞变化便触发ai_mismatch。原始两份响应、B答案、OCR与完整来源均已保存，本轮从通用协议修复。

新创建的Native单元冻结逐项复核策略，第一遍完整还原，第二遍独立对照原图/OCR和首稿返回版本化复核记录。确认正确时由宿主沿用冻结首稿，修改稿返回有证据的字段修正，宿主重建完整稿。原题号、首稿摘要和逐项检查绑定，题面/答案/公式/数值/选项/图表实质变化继续走严格差异及来源门禁。两次调用和原计费/取消/恢复机制保持。

改动限于Native共享输入、复核schema和归档策略、provider提示词/输出解析、原executeNativeAi及历史转录读取、原创建入口和定向回归。复用现有原图、OCR、writer、回执和原生题图仓库，无新增服务或业务表。前端沿原批次状态、响应查看、题本、检索和组卷入口交付。

旧单元沿冻结策略读取，旧付费响应与题目保持，已有ai_mismatch保留历史。新策略可通过创建入口开关停用，读取能力保留用于历史回溯。源文件变化、隐私、原答案冲突、漏图、缺项、坏摘要、未知schema、取消与重启继续验证。

完成条件包含实际新未付费带图题的本地OCR、两次真实DeepSeek、自动题本、重启原图SHA、自然检索和正常组卷资格。使用当前221份范围中的风洞题作为新样本，旧解析措辞案例做本地协议回归。先冻结全部代码后构建，按顺序运行组件和实际冷读，避免构建中切换入口。最终提交、整合并推送main，完整知识库Goal继续ACTIVE。

## 首次真实复核发现与修复

v1实际调用两次，答案C、原解析保持、年级纠正为高三，但复核返回classification=uncertain及requires_image，进入待核。复盘发现Native提示继承通用文字流程中的图表文字表达限制，且本轮增加的classification复核成为额外完整性门槛。当前v2按完整保留的角色原图与图义判断题面，八项内容复核沿用原完整性规则，分类按原字段修正和缺项规则处理。v1策略与实际回执持续可读。

正式验证改为同一风洞来源的v1/v2单变量对照，两个批次分别经原界面授权。新评估保留原v1题目、响应和账本。两次调用策略、实质差异与未知结果门禁保持。

## 真实消费者缺口与补充合同

v2真实两次调用后自动定稿，题本可读原图，纯原题蓝图选中1/1并由测试代理集中确认。原Pi自然检索完成实读，但返回上下文遗漏archive.number和本地角色图归档信息，导致回答声称没有原题号且原图未保留。

本轮追加范围仅为原question-context-provider的已验证读取投影。originalNumber从已校验归档读取并沿原脱敏，localMedia仅提供各角色的本地图数量与题本入口。响应继续标记originalImagesIncluded=false，保留原脱敏、来源再校验、答案及教师权限语义。无图片上云、业务写入或权限扩展。以旧Native和新review回执、失效来源、非法题号回归，以及实际Pi冷启后回答为验收依据。

第一次修复后的真实回答正确给出第8题及本地图片，但把三个角色误计为三张图片。宿主现提供totalImageCount及分角色计数，contextScope明确指向本次读取，工具说明分别使用答案和解析来源。原失败回答保留在本地native-field-reader-pi-result.json，后续结果单独保存。

## 实现与复用

沿用现有OOXML来源仓库、Native角色图与本地OCR、DeepSeek账户、AI单位租约/计费/writer、题本、混合检索、Pi和组卷/导出能力。没有新增生产依赖、业务表、IPC或独立服务，安装体积增量为代码。

新增material-ai-native-review.ts负责有界复核schema、冻结策略和字段修正。material-ai-native-input.ts与material-ai-repository.ts冻结创建策略。material-ai-provider.ts负责实际请求及版本化输出，material-ai-native.ts按真实回执派生并重建读取权限。question-archive.ts识别新回执策略。question-context-provider.ts保留已验证原题号和本地图统计。

新单元默认native-field-review.v2。首稿SHA、题号、八项适用检查和修正字段均须匹配，额外字段、错误版本、坏摘要、缺项和无依据的不确定性返回失败。宿主仍比较完整物理内容signature，答案、解析、题面、公式、图义或角色来源有实质变化时保留待核。独立答案冲突、来源风险、遗漏结构、取消、隐私及当前原件版本继续生效。只改变分类的修正可沿原规则完成。

## 真实结果与保留事实

测试仍使用已导入221份、328203104B，准备目录987份、1052908695B。原目录归档和folder AI保持暂停。

| 项目 | 结果 |
| --- | --- |
| v1实际整理 | 两次DeepSeek，单元review，批次attention，原回执保留 |
| v2实际整理 | 本地OCR与两次DeepSeek，decision=verified，答案C，高三，ai_final且issues为空 |
| 新题 | question_6128c861-efa9-4d7d-8b47-a63b22e6038b |
| 正常题本 | 两尺寸可读来源PNG，1240×532，SHA 88e97877ed8b2ed422a4a373e7894076ab88315fc7a94d729c96ee7a12ec7953 |
| 原Pi检索 | 真实检索及education_read_question读取新题，三次模型请求 |
| 原蓝图 | 纯原题1/1选中该题，正式确认由自动化测试代理操作原界面 |
| 学生PDF | 一页A4，212996B，题面图像素一致，原解析文本和图片均排除 |
| 教师PDF | 一页A4，255958B，题面及原解析图像素一致，保留答案C及来源说明 |
| 旧事实 | 221份资料、1312分块、原3126条题目全行SHA相同 |
| 旧AI账本 | 原279条AI单元全行SHA相同，22条unknown保留 |
| Word历史 | 当前148份与739条历史保持，最终题目总数3128 |

原题图、完整OCR、真实响应、试卷和截图保存在D:/WorkProject/EduProject-kb-run/flow-1gb-20261111。Git仅收录工程日志和摘要。当前已逐页查看两份实际PDF的本地渲染，题面和原解析清晰完整，独立提取器核对原图像素及学生答案隔离。

## 定向验证

命令均在apps/desktop执行。

```powershell
node --experimental-transform-types scripts/education/kb-native-field-review.mjs D:/WorkProject/EduProject-kb-run/flow-1gb-20261111/preamble-provider-result.json D:/WorkProject/EduProject-kb-run/flow-1gb-20261111/native-field-provider-result.json
node --experimental-transform-types scripts/education/kb-native-dispatch-boundaries.mjs
node --experimental-transform-types scripts/education/kb-ai-batch-boundaries.mjs
node scripts/education/kb-native-reading-context.mjs
node --experimental-transform-types --import ./scripts/office-agent/register-source.mjs scripts/education/kb-question-search-continuation.mjs --with-existing-boundaries
npm run build
npm run test:renderer-components
```

复核29、调度17、provider及批次31、读取4、原检索/上下文/原件50项通过。旧Native账本20、Word证据11、后台升级8、目录Word13、来源29、booklet10、folder AI18项通过。合并协作者组卷筛选后的15项浏览状态通过。

v1候选a0a10ec上的综合smoke完成207/207且exit0。该结果属于首次协议构建。原卷首轮综合脚本清理EPERM的失败记录继续保留，后续构建及组件证据分别注明源码与整树摘要。

本轮协议用保存的真实两遍响应构造受控复核，检验措辞变化修复及旧v1兼容。该项的模型结论由测试构造，真实v2结果来自独立新付费请求。数学整体准确率和自然召回率保持待验收。

## 性能与依赖

同一道实际题，完整首稿1645B，复核405B，仍为两次整理调用。2000轮受控解析CPU对照，旧双完整稿平均0.0460ms，新首稿加复核平均0.0779ms，增加约0.032ms。该结果限于有界schema解析，端到端模型时延、总token费用、峰值内存和约10GB未测。

本轮无新增生产依赖。npm生产依赖audit为22项，8低、6中、8高，保留既有问题。首次直连audit发生TLS断开，单次命令代理重试得到完整报告。

## 失败、恢复和下一缺陷

保留v1真实review、首轮Pi缺题号/本地图片信息、后续Pi图片总数误报的独立证据。测试驱动曾等待旧会话、等待已被图片角色按钮替代的展开按钮，以及把Native原图文字当作PDF可选择文字。已修正驱动并检查实际会话、源图像素及A4渲染，实际付费响应和旧题未改写。

下一优先修复通用Word来源归属造成的批量阻断。当前索引仍有shared_context 3670处、source_warning 2458处、ambiguous_number 1863处和image_scope_uncertain 126处，计数存在重叠，来源无疑点仍133处。继续从当前已导入范围中的共有根因处理公共条件、题号与警告传播，保留真正缺失/归属不明门禁。当前仅证明本轮自然题闭环，完整221份自动质量、PDF局部失败、unknown恢复、缺答联网补答、完整召回与重排、约10GB、普通安装及换机迁移继续OPEN。完整Goal ACTIVE。

回滚可设置OMNI_EDU_AI_NATIVE_FIELD_REVIEW=0，后续创建使用旧整理流程。已冻结v1/v2单元按自身策略恢复，历史读取仍需保留native-reviewed.v2支持。代码回退采用正常新提交并保留SQLite、原件和真实付费回执。未实施不可逆数据迁移。

## 最终整合与冷启动

正常合入协作者main dcc885b，合并183c4e1包含组卷首次浏览筛选，保留其代码和验收资料，无冲突。最后功能985104a包含宿主图片总数与本次读取范围。最终重新build及246组件通过，冻结主进程ee19642e297237e048145d6a035a8a7ddb1f6b6445760d800ec41ed0f970c5a0，整树21eb51aa882432bc9fc3f22fe083c979a547fb4aed4421a8f305cd92fb45656e。实际Electron命令行和renderer路径均指向该冻结目录。

最终冷启读取旧native-complete.v1待核与自动稿、review v1待核、新review v2自动稿四道原图，SHA一致，两尺寸角色按钮可达。新卷confirmed快照及两份PDF SHA一致。修复总数后的真实Pi沿原Composer再次检索/实读，三次模型请求，正确返回第8题、答案C、本地共2张图片、题面1张/解析1张/答案0张以及题本入口，分别说明AI补答案和原资料解析。原先错误回答单独保留，本次结果native-field-reader-total-pi-result.json留本地。

摘要及源码SHA见result.json、manifest.json，26份工程日志压缩后逐份核对解压SHA。原279条单位和3126条题目在最终Pi及导出后仍全行SHA一致。最后测试应用关闭，目录归档及folder AI暂停，恢复先查run-state.json及实际进程，旧端口不复用。

Git收尾曾连续遇到GitHub TLS断开，已验证单次连接解析可正常拉取。系统代理、DNS及凭证配置保持。提交及推送使用正常main快进规则，远端最终一致性以本轮Git读回为准。
